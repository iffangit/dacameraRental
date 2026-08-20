import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardHead,
  StatCard,
  StatusBadge,
  GradeBadge,
  CycleBar,
  Tag,
} from "@/components/ui";
import {
  ACTIVITY_STYLE,
  BLOCKING_ORDER_STATUSES,
  formatThaiDate,
  formatThaiTime,
  formatBaht,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

/** ต้นเดือนปัจจุบัน ใช้เป็นขอบล่างของยอดรายได้ */
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function loadDashboard() {
  const monthStart = startOfMonth();
  const prevMonthStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1,
  );
  const todayStart = startOfToday();
  const todayEnd = new Date(todayStart.getTime() + 86_400_000 - 1);
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [
    totalUnits,
    categoryCount,
    rentedUnits,
    pendingOrders,
    stalePendingOrders,
    dueTodayItems,
    revenueThisMonth,
    revenuePrevMonth,
    attentionUnits,
    recentUnits,
    activities,
  ] = await Promise.all([
    prisma.equipmentUnit.count({ where: { isActive: true } }),
    prisma.category.count(),
    prisma.equipmentUnit.count({ where: { isActive: true, status: "RENTED" } }),
    prisma.rentalOrder.count({ where: { status: "PENDING_APPROVAL" } }),
    // คำขอที่ค้างเกิน 24 ชม. — ตัวชี้วัดว่าแอดมินตอบช้า
    prisma.rentalOrder.count({
      where: { status: "PENDING_APPROVAL", createdAt: { lt: dayAgo } },
    }),
    // ของที่ครบกำหนดคืนวันนี้
    prisma.rentalOrderItem.count({
      where: {
        endDate: { gte: todayStart, lte: todayEnd },
        order: { status: "ACTIVE_RENTAL" },
      },
    }),
    prisma.rentalOrder.aggregate({
      _sum: { rentalFee: true },
      where: {
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    }),
    prisma.rentalOrder.aggregate({
      _sum: { rentalFee: true },
      where: {
        createdAt: { gte: prevMonthStart, lt: monthStart },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    }),
    // อุปกรณ์ที่ระบบดึงออกจากคิวเพราะครบรอบบำรุงรักษา — REQ-RISK-003
    prisma.equipmentUnit.findMany({
      where: { isActive: true, status: { in: ["MAINTENANCE", "CLEANING"] } },
      include: { equipment: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    // 8 รายการล่าสุด พร้อมข้อมูลผู้เช่าปัจจุบัน (ถ้ามี)
    prisma.equipmentUnit.findMany({
      where: { isActive: true },
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: {
        equipment: {
          select: { name: true, category: { select: { name: true } } },
        },
        orderItems: {
          where: {
            order: { status: { in: BLOCKING_ORDER_STATUSES } },
            endDate: { gte: todayStart },
          },
          orderBy: { startDate: "asc" },
          take: 1,
          include: {
            order: {
              select: {
                status: true,
                customer: { select: { fullName: true, grade: true } },
              },
            },
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      take: 7,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { fullName: true } } },
    }),
  ]);

  const revenue = Number(revenueThisMonth._sum.rentalFee ?? 0);
  const prevRevenue = Number(revenuePrevMonth._sum.rentalFee ?? 0);
  const revenueDelta =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  return {
    totalUnits,
    categoryCount,
    rentedUnits,
    pendingOrders,
    stalePendingOrders,
    dueTodayItems,
    revenue,
    revenueDelta,
    attentionUnits,
    recentUnits,
    activities,
  };
}

export default async function DashboardPage() {
  const data = await loadDashboard();

  const utilisation =
    data.totalUnits > 0
      ? ((data.rentedUnits / data.totalUnits) * 100).toFixed(1)
      : "0.0";

  return (
    <>
      {/* ---------------- Stat cards ---------------- */}
      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="อุปกรณ์ทั้งหมด"
          value={data.totalUnits}
          detail={`แยกตาม Serial No. · ${data.categoryCount} หมวดหมู่`}
          accent="var(--color-cleaning)"
        />
        <StatCard
          label="กำลังถูกเช่า"
          value={data.rentedUnits}
          detail={
            <>
              อัตราหมุนเวียน{" "}
              <span className="font-semibold text-available">{utilisation}%</span>{" "}
              · คืนวันนี้ {data.dueTodayItems} ชิ้น
            </>
          }
          accent="var(--color-primary)"
        />
        <StatCard
          label="รออนุมัติ"
          value={data.pendingOrders}
          detail={
            data.stalePendingOrders > 0 ? (
              <>
                <span className="font-semibold text-maintenance">
                  {data.stalePendingOrders} คำขอ
                </span>{" "}
                ค้างเกิน 24 ชม.
              </>
            ) : (
              "ไม่มีคำขอค้างเกิน 24 ชม."
            )
          }
          accent="var(--color-maintenance)"
        />
        <StatCard
          label="รายได้เดือนนี้"
          value={formatBaht(data.revenue)}
          detail={
            data.revenueDelta === null ? (
              "ยังไม่มีข้อมูลเดือนก่อนเทียบ"
            ) : (
              <>
                <span
                  className={
                    data.revenueDelta >= 0
                      ? "font-semibold text-available"
                      : "font-semibold text-primary"
                  }
                >
                  {data.revenueDelta >= 0 ? "+" : ""}
                  {data.revenueDelta.toFixed(1)}%
                </span>{" "}
                เทียบเดือนก่อน
              </>
            )
          }
          accent="var(--color-available)"
        />
      </div>

      {/* ---------------- Alert: auto maintenance (REQ-RISK-003) ---------------- */}
      {data.attentionUnits.length > 0 && (
        <div className="mb-4 flex items-start gap-3 border border-line border-l-[3px] border-l-maintenance bg-surface px-4 py-3">
          <Tag color="var(--color-maintenance)">MNT</Tag>
          <div className="min-w-0 flex-1">
            <b className="font-head text-[13px] font-semibold">
              อุปกรณ์ {data.attentionUnits.length} ชิ้นครบรอบบำรุงรักษาอัตโนมัติ
            </b>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {data.attentionUnits.slice(0, 3).map((unit, i) => (
                <span key={unit.id}>
                  {i > 0 && " · "}
                  {unit.equipment.name} ({unit.serialNumber}){" "}
                  {unit.rentalCount >= unit.cycleLimit
                    ? `ครบ ${unit.cycleLimit} รอบเช่า`
                    : unit.totalDaysUsed >= unit.usageDaysLimit
                      ? `ครบ ${unit.usageDaysLimit} วันใช้งาน`
                      : "รอทำความสะอาด"}
                </span>
              ))}
              {data.attentionUnits.length > 3 &&
                ` และอีก ${data.attentionUnits.length - 3} ชิ้น`}
              {" — ระบบตัดออกจากคิวจองแล้ว"}
            </p>
          </div>
          <Link
            href="/stock"
            className="inline-flex h-[26px] shrink-0 items-center border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
          >
            จัดการ
          </Link>
        </div>
      )}

      {/* ---------------- ตาราง + feed ---------------- */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.9fr_1fr]">
        {/* สถานะอุปกรณ์ล่าสุด */}
        <Card>
          <CardHead
            title="สถานะอุปกรณ์ล่าสุด"
            hint={`อัปเดตเรียลไทม์ · แสดง ${data.recentUnits.length} จาก ${data.totalUnits} รายการ`}
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "อุปกรณ์ / Serial No.",
                    "หมวดหมู่",
                    "สถานะ",
                    "ผู้เช่า",
                    "กำหนดคืน",
                    "รอบบำรุงรักษา",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-line bg-canvas px-4 py-2.5 text-left font-head text-[11px] font-semibold tracking-[0.05em] whitespace-nowrap text-ink-muted uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentUnits.map((unit) => {
                  const booking = unit.orderItems[0];
                  const renter = booking?.order.customer;

                  return (
                    <tr
                      key={unit.id}
                      className="border-b border-line last:border-b-0 hover:bg-primary-soft"
                    >
                      <td className="px-4 py-2.5">
                        <div className="text-[13px] font-semibold">
                          {unit.equipment.name}
                        </div>
                        <div className="font-head text-[11px] tracking-wide text-ink-muted">
                          {unit.serialNumber}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">
                        {unit.equipment.category.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={unit.status} />
                      </td>
                      <td className="px-4 py-2.5 text-[13px] whitespace-nowrap">
                        {renter ? (
                          <span className="inline-flex items-center gap-1.5">
                            {renter.fullName}
                            <GradeBadge grade={renter.grade} />
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="tnum px-4 py-2.5 text-[13px] whitespace-nowrap">
                        {booking ? (
                          formatThaiDate(booking.endDate)
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <CycleBar
                          current={unit.rentalCount}
                          limit={unit.cycleLimit}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-line px-4 py-2.5">
            <Link
              href="/stock"
              className="inline-flex h-[26px] items-center border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
            >
              ดูสต็อกทั้งหมด
            </Link>
          </div>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHead title="กิจกรรมล่าสุด" hint="เรียงตามเวลาล่าสุด" />
          <div className="max-h-[436px] overflow-y-auto py-1.5">
            {data.activities.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
                ยังไม่มีกิจกรรมในระบบ
              </p>
            )}
            {data.activities.map((item) => {
              const style = ACTIVITY_STYLE[item.type];
              return (
                <div
                  key={item.id}
                  className="flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <Tag color={style.color}>{style.tag}</Tag>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-relaxed">
                      {item.message}
                    </p>
                    <div className="mt-0.5 font-head text-[10.5px] text-ink-muted">
                      {formatThaiTime(item.createdAt)} ·{" "}
                      {formatThaiDate(item.createdAt)} ·{" "}
                      {item.actor ? `โดย ${item.actor.fullName}` : "ระบบอัตโนมัติ"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-line px-4 py-2.5">
            <Link
              href="/approval"
              className="inline-flex h-[26px] flex-1 items-center justify-center border border-primary bg-primary px-2.5 font-head text-[11.5px] text-white hover:bg-primary-hover"
            >
              ไปหน้าอนุมัติ ({data.pendingOrders})
            </Link>
            <Link
              href="/marketing"
              className="inline-flex h-[26px] items-center border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
            >
              AI Marketing
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
