import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { GradeBadge } from "@/components/ui";
import {
  CUSTOMER_GRADE,
  ORDER_STATUS,
  formatBaht,
  formatThaiDate,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata = { title: "บัญชีของฉัน | DaCamera Rental" };

/**
 * หน้าสมาชิก — ยังเป็นแบบอ่านอย่างเดียว
 * ส่วนจัดชุดอุปกรณ์และส่งคำขอเช่าเอง (REQ-RENT-003) ยังไม่ได้ทำ
 */
export default async function MePage() {
  const session = await requireUser("/me");

  const [user, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    prisma.rentalOrder.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            unit: {
              select: {
                serialNumber: true,
                equipment: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const grade = CUSTOMER_GRADE[user.grade];

  return (
    <main className="mx-auto max-w-[880px] p-5">
      {/* หัวหน้า */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border border-line bg-surface px-4 py-3.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-head text-[15px] font-semibold text-white">
          {user.fullName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-head text-[15px] font-semibold">
              {user.fullName}
            </h1>
            <GradeBadge grade={user.grade} />
            {user.role === "VIP" && (
              <span className="border border-primary px-1.5 font-head text-[10px] font-bold text-primary">
                VIP
              </span>
            )}
          </div>
          <p className="text-[12px] text-ink-muted">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12.5px] hover:border-primary hover:text-primary"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>

      {/* เกรดและสถิติ — REQ-RISK-001 */}
      <div className="mb-4 border border-line bg-surface p-4">
        <h2 className="mb-2.5 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          เกรดสมาชิกและประวัติ
        </h2>
        <p
          className="mb-3 border-l-[3px] bg-canvas px-3 py-2 text-[12.5px]"
          style={{ borderColor: grade.color }}
        >
          <b>{grade.label}</b> — {grade.description}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
          {[
            ["เช่าทั้งหมด", `${user.totalRentals} ครั้ง`],
            ["คืนตรงเวลา", `${user.onTimeReturns} ครั้ง`],
            ["คืนช้า", `${user.lateReturns} ครั้ง`],
            ["ความเสียหาย", `${user.damageIncidents} ครั้ง`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="tnum font-head font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ประวัติการเช่า */}
      <div className="border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-head text-[13.5px] font-semibold">
            ประวัติการเช่า{" "}
            <span className="text-ink-muted">({orders.length})</span>
          </h2>
        </div>

        {orders.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-muted">
            ยังไม่มีประวัติการเช่า
          </p>
        ) : (
          <div className="divide-y divide-line">
            {orders.map((order) => {
              const status = ORDER_STATUS[order.status];
              return (
                <div key={order.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-head text-[12.5px] font-semibold">
                      {order.orderCode}
                    </span>
                    <span
                      className="border px-1.5 py-0.5 font-head text-[10.5px] font-semibold"
                      style={{ borderColor: status.color, color: status.color }}
                    >
                      {status.label}
                    </span>
                    {order.channel === "WALK_IN" && (
                      <span className="border border-line-strong px-1.5 py-0.5 font-head text-[10.5px] text-ink-muted">
                        เช่าหน้าร้าน
                      </span>
                    )}
                    <span className="tnum ml-auto font-head text-[12px]">
                      {formatBaht(Number(order.rentalFee))}
                    </span>
                  </div>

                  <div className="tnum mt-1 text-[12px] text-ink-muted">
                    {formatThaiDate(order.startDate)} –{" "}
                    {formatThaiDate(order.endDate)} · {order.rentalDays} วัน
                    {Number(order.discountAmount) > 0 &&
                      ` · ส่วนลด ${formatBaht(Number(order.discountAmount))}`}
                    {Number(order.depositAmount) > 0 &&
                      ` · จ่ายมัดจำแล้ว ${formatBaht(Number(order.depositAmount))}`}
                    {" · คงเหลือ "}
                    {formatBaht(
                      Number(order.rentalFee) -
                        Number(order.discountAmount) -
                        Number(order.depositAmount),
                    )}
                  </div>

                  <ul className="mt-1.5 space-y-0.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-[12.5px]">
                        • {item.unit.equipment.name}{" "}
                        <span className="font-head text-[11px] text-ink-muted">
                          ({item.unit.serialNumber})
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.adminNote && (
                    <p className="mt-1.5 text-[12px] text-ink-muted">
                      หมายเหตุจากร้าน: {order.adminNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-[12px] text-ink-muted">
        ส่วนจัดชุดอุปกรณ์และส่งคำขอเช่าด้วยตนเอง (REQ-RENT-003)
        รวมถึง AI Wizard แนะนำอุปกรณ์ (REQ-AI-001) ยังอยู่ระหว่างพัฒนา
      </p>
    </main>
  );
}
