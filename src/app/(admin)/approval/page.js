import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHead, GradeBadge, StatusBadge, Tag } from "@/components/ui";
import {
  CUSTOMER_GRADE,
  ORDER_STATUS,
  UNIT_STATUS,
  formatBaht,
  formatThaiDate,
  formatThaiTime,
} from "@/lib/domain";
import { findConflicts, findUnavailableUnits } from "@/lib/booking";
import DecisionForm from "./DecisionForm";

export const dynamic = "force-dynamic";

const ORDER_DETAIL_INCLUDE = {
  customer: true,
  approvedBy: { select: { fullName: true } },
  items: {
    include: {
      unit: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
          equipment: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
    },
  },
};

async function loadOrders() {
  const [pending, decided] = await Promise.all([
    // คิวด่วนของ VIP ขึ้นก่อน จากนั้นเรียงตามคำขอที่รอนานที่สุด (FIFO)
    prisma.rentalOrder.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: [{ isRushRequest: "desc" }, { createdAt: "asc" }],
      include: {
        customer: { select: { fullName: true, grade: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.rentalOrder.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { approvedAt: "desc" },
      take: 6,
      include: {
        customer: { select: { fullName: true, grade: true } },
        items: { select: { id: true } },
      },
    }),
  ]);

  return { pending, decided };
}

/** ปัญหาที่ทำให้อนุมัติไม่ได้ — ตรวจตอนเรนเดอร์เพื่อเตือนล่วงหน้า */
async function findBlockers(order) {
  if (order.status !== "PENDING_APPROVAL") return [];

  const [conflicts, unavailable] = await Promise.all([
    findConflicts(prisma, {
      orderId: order.id,
      unitIds: order.items.map((i) => i.equipmentUnitId),
      startDate: order.startDate,
      endDate: order.endDate,
    }),
    Promise.resolve(findUnavailableUnits(order.items)),
  ]);

  return [
    ...unavailable.map((u) => ({
      kind: "UNIT",
      text: `${u.equipmentName} (${u.serialNumber}) อยู่ในสถานะ${UNIT_STATUS[u.status].label} — ส่งมอบไม่ได้`,
    })),
    ...conflicts.map((c) => ({
      kind: "CONFLICT",
      text: `${c.equipmentName} (${c.serialNumber}) ติดคิวของ ${c.orderCode} (${c.customerName}) วันที่ ${formatThaiDate(c.startDate)}–${formatThaiDate(c.endDate)}`,
    })),
  ];
}

export default async function ApprovalPage({ searchParams }) {
  const params = await searchParams;
  const { pending, decided } = await loadOrders();

  const requestedId = Number(params?.order);
  const fallbackId = pending[0]?.id ?? decided[0]?.id ?? null;
  const selectedId = Number.isInteger(requestedId) ? requestedId : fallbackId;

  const order = selectedId
    ? await prisma.rentalOrder.findUnique({
        where: { id: selectedId },
        include: ORDER_DETAIL_INCLUDE,
      })
    : null;

  const blockers = order ? await findBlockers(order) : [];

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[340px_1fr]">
      {/* ---------------- รายการคำขอ ---------------- */}
      <Card>
        <CardHead
          title="คำขอเช่า"
          hint={`รออนุมัติ ${pending.length} รายการ`}
        />
        <div className="max-h-[720px] overflow-y-auto">
          {pending.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
              ไม่มีคำขอที่รออนุมัติ
            </p>
          )}

          {pending.map((item) => (
            <OrderRow
              key={item.id}
              order={item}
              active={item.id === selectedId}
            />
          ))}

          {decided.length > 0 && (
            <div className="border-y border-line bg-canvas px-4 py-1.5 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              ดำเนินการแล้วล่าสุด
            </div>
          )}
          {decided.map((item) => (
            <OrderRow
              key={item.id}
              order={item}
              active={item.id === selectedId}
              muted
            />
          ))}
        </div>
      </Card>

      {/* ---------------- รายละเอียด ---------------- */}
      {order ? (
        <OrderDetail order={order} blockers={blockers} />
      ) : (
        <Card className="px-6 py-14 text-center">
          <p className="text-[13px] text-ink-muted">
            เลือกคำขอจากรายการด้านซ้ายเพื่อดูรายละเอียด
          </p>
        </Card>
      )}
    </div>
  );
}

/** แถวคำขอในรายการซ้าย */
function OrderRow({ order, active, muted = false }) {
  const status = ORDER_STATUS[order.status];

  return (
    <Link
      href={`/approval?order=${order.id}`}
      className={`flex flex-col gap-1 border-b border-line border-l-[3px] px-4 py-2.5 transition-colors ${
        active
          ? "border-l-primary bg-primary-soft"
          : "border-l-transparent hover:bg-canvas"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-head text-[12px] font-semibold">
          {order.orderCode}
        </span>
        {order.isRushRequest && (
          <span className="border border-primary px-1 font-head text-[9.5px] font-bold text-primary">
            ด่วน
          </span>
        )}
        <span
          className="ml-auto text-[11px] font-semibold whitespace-nowrap"
          style={{ color: status.color }}
        >
          {status.label}
        </span>
      </div>

      <div
        className={`flex items-center gap-1.5 text-[13px] ${muted ? "text-ink-muted" : ""}`}
      >
        <span className="truncate">{order.customer.fullName}</span>
        <GradeBadge grade={order.customer.grade} />
      </div>

      <div className="tnum font-head text-[11px] text-ink-muted">
        {formatThaiDate(order.startDate)} – {formatThaiDate(order.endDate)} ·{" "}
        {order.items.length} ชิ้น · {formatBaht(Number(order.rentalFee))}
      </div>
    </Link>
  );
}

/** panel รายละเอียดฝั่งขวา */
function OrderDetail({ order, blockers }) {
  const status = ORDER_STATUS[order.status];
  const grade = CUSTOMER_GRADE[order.gradeAtRequest];
  const customer = order.customer;
  const isPending = order.status === "PENDING_APPROVAL";

  return (
    <Card>
      {/* หัวออเดอร์ */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
        <h3 className="font-head text-[15px] font-semibold">
          {order.orderCode}
        </h3>
        {order.isRushRequest && (
          <span className="border border-primary px-1.5 font-head text-[10px] font-bold text-primary">
            คิวด่วน VIP
          </span>
        )}
        {order.channel === "WALK_IN" && (
          <span className="border border-line-strong px-1.5 font-head text-[10px] font-bold text-ink-muted">
            เช่าหน้าร้าน
          </span>
        )}
        <span
          className="border px-2 py-0.5 font-head text-[11px] font-semibold"
          style={{ borderColor: status.color, color: status.color }}
        >
          {status.label}
        </span>
        <span className="ml-auto text-[11.5px] text-ink-muted">
          ยื่นคำขอ {formatThaiDate(order.createdAt)} {formatThaiTime(order.createdAt)}
        </span>
      </div>

      {/* คำเตือนก่อนอนุมัติ */}
      {blockers.length > 0 && (
        <div className="flex items-start gap-3 border-b border-line border-l-[3px] border-l-primary bg-primary-soft px-4 py-3">
          <Tag color="var(--color-primary)">!</Tag>
          <div className="min-w-0 flex-1">
            <b className="font-head text-[13px] font-semibold text-primary">
              อนุมัติไม่ได้ — พบปัญหา {blockers.length} ข้อ
            </b>
            <ul className="mt-1 space-y-0.5">
              {blockers.map((b, i) => (
                <li key={i} className="text-[12.5px] text-ink">
                  • {b.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-2">
        {/* ---- ข้อมูลลูกค้า + ความเสี่ยง ---- */}
        <section className="bg-surface p-4">
          <h4 className="mb-2.5 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
            ผู้ขอเช่าและความเสี่ยง
          </h4>

          <div className="flex items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-head text-[13px] font-semibold text-white">
              {customer.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold">
                  {customer.fullName}
                </span>
                <GradeBadge grade={customer.grade} />
              </div>
              <div className="text-[11.5px] text-ink-muted">
                {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
            <Stat label="คะแนนความเสี่ยง" value={`${customer.riskScore}/100`} />
            <Stat label="เช่าทั้งหมด" value={`${customer.totalRentals} ครั้ง`} />
            <Stat label="คืนตรงเวลา" value={`${customer.onTimeReturns} ครั้ง`} />
            <Stat
              label="คืนช้า"
              value={`${customer.lateReturns} ครั้ง`}
              warn={customer.lateReturns > 0}
            />
            <Stat
              label="ประวัติความเสียหาย"
              value={`${customer.damageIncidents} ครั้ง`}
              warn={customer.damageIncidents > 0}
            />
            <Stat
              label="สถานะบัญชี"
              value={customer.isSuspended ? "ถูกระงับ" : "ปกติ"}
              warn={customer.isSuspended}
            />
          </dl>

          <p className="mt-3 border-l-[3px] bg-canvas px-3 py-2 text-[12px] text-ink-muted"
             style={{ borderColor: grade.color }}>
            {grade.label} — {grade.description}
          </p>
        </section>

        {/* ---- ช่วงเวลาและค่าใช้จ่าย ---- */}
        <section className="bg-surface p-4">
          <h4 className="mb-2.5 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
            ช่วงเวลาและค่าใช้จ่าย
          </h4>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
            <Stat label="วันเริ่มเช่า" value={formatThaiDate(order.startDate)} />
            <Stat label="กำหนดคืน" value={formatThaiDate(order.endDate)} />
            <Stat label="จำนวนวัน" value={`${order.rentalDays} วัน`} />
            <Stat label="จำนวนอุปกรณ์" value={`${order.items.length} ชิ้น`} />
          </dl>

          <div className="mt-3 border border-line">
            <Money label="ค่าเช่ารวม" value={Number(order.rentalFee)} />
            {Number(order.discountAmount) > 0 && (
              <Money
                label={`ส่วนลด${order.discountNote ? ` (${order.discountNote})` : ""}`}
                value={-Number(order.discountAmount)}
              />
            )}
            {Number(order.depositAmount) > 0 && (
              <Money
                label="หัก มัดจำจองคิว (จ่ายแล้ว)"
                value={-Number(order.depositAmount)}
              />
            )}
            <Money
              label="ยอดคงเหลือ (เก็บตอนรับของ)"
              value={
                Number(order.rentalFee) -
                Number(order.discountAmount) -
                Number(order.depositAmount)
              }
              emphasis
            />
          </div>

          {order.customerNote && (
            <p className="mt-3 text-[12.5px]">
              <span className="text-ink-muted">หมายเหตุจากลูกค้า: </span>
              {order.customerNote}
            </p>
          )}
          {order.adminNote && (
            <p className="mt-1.5 text-[12.5px]">
              <span className="text-ink-muted">หมายเหตุจากแอดมิน: </span>
              {order.adminNote}
            </p>
          )}
        </section>
      </div>

      {/* ---- รายการอุปกรณ์ ---- */}
      <div className="border-t border-line">
        <h4 className="px-4 pt-3 pb-2 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          อุปกรณ์ในคำขอ ({order.items.length} ชิ้น)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["อุปกรณ์ / Serial No.", "สถานะปัจจุบัน", "ค่าเช่า/วัน", "วัน", "รวม"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-y border-line bg-canvas px-4 py-2 text-left font-head text-[10.5px] font-semibold tracking-[0.05em] whitespace-nowrap text-ink-muted uppercase last:text-right"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5">
                    <div className="text-[13px] font-semibold">
                      {item.unit.equipment.name}
                    </div>
                    <div className="font-head text-[11px] tracking-wide text-ink-muted">
                      {item.unit.serialNumber}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={item.unit.status} />
                  </td>
                  <td className="tnum px-4 py-2.5 text-[13px]">
                    {formatBaht(Number(item.dailyRate))}
                  </td>
                  <td className="tnum px-4 py-2.5 text-[13px]">{item.days}</td>
                  <td className="tnum px-4 py-2.5 text-right text-[13px] font-semibold">
                    {formatBaht(Number(item.subtotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- ปุ่มตัดสินใจ ---- */}
      {isPending ? (
        <DecisionForm
          key={order.id}
          orderId={order.id}
          orderCode={order.orderCode}
          customerName={customer.fullName}
          blockers={blockers}
        />
      ) : (
        <p className="border-t border-line px-4 py-3 text-[12.5px] text-ink-muted">
          คำขอนี้{status.label}แล้ว
          {order.approvedAt
            ? ` เมื่อ ${formatThaiDate(order.approvedAt)} ${formatThaiTime(order.approvedAt)}`
            : ""}
          {order.approvedBy ? ` โดย ${order.approvedBy.fullName}` : ""}
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, warn = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={`tnum font-head font-semibold ${warn ? "text-primary" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Money({ label, value, emphasis = false }) {
  // ค่าติดลบคือรายการหัก แสดงเครื่องหมายลบไว้หน้าสัญลักษณ์เงิน (−฿100)
  // แทนที่จะให้ toLocaleString วางไว้หลัง ฿ ซึ่งอ่านแล้วสะดุด
  const isDeduction = value < 0;

  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-3 py-2 ${
        emphasis ? "border-t border-line bg-canvas" : ""
      }`}
    >
      <span
        className={`text-[12.5px] ${emphasis ? "font-semibold" : "text-ink-muted"}`}
      >
        {label}
      </span>
      <span
        className={`tnum font-head font-semibold ${
          emphasis ? "text-[15px]" : "text-[13px]"
        } ${isDeduction ? "text-ink-muted" : ""}`}
      >
        {isDeduction ? "−" : ""}
        {formatBaht(Math.abs(value))}
      </span>
    </div>
  );
}
