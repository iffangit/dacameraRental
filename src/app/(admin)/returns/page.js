import { prisma } from "@/lib/prisma";
import { listOpenRentals } from "@/lib/returns";
import { Card } from "@/components/ui";
import ReturnCard from "./ReturnCard";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const orders = await listOpenRentals(prisma);

  const overdue = orders.filter((o) => o.isOverdue).length;
  const waitingClear = orders.filter((o) => o.pendingCount === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 border border-line bg-surface px-4 py-3">
        <h2 className="font-head text-[13.5px] font-semibold">รับคืนอุปกรณ์</h2>
        <span className="text-[12px] text-ink-muted">
          {orders.length} ออเดอร์ที่ยังไม่ปิด
          {overdue > 0 && (
            <>
              {" · "}
              <b className="text-primary">เลยกำหนด {overdue} รายการ</b>
            </>
          )}
          {waitingClear > 0 && ` · รอเคลียร์ค่าเสียหาย ${waitingClear} รายการ`}
        </span>
      </div>

      {orders.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="text-[13px] text-ink-muted">
            ไม่มีอุปกรณ์ค้างอยู่กับลูกค้า — ของอยู่ในร้านครบทุกชิ้น
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <ReturnCard
              key={order.id}
              order={{
                id: order.id,
                orderCode: order.orderCode,
                channel: order.channel,
                status: order.status,
                startDate: order.startDate,
                endDate: order.endDate,
                rentalDays: order.rentalDays,
                rentalFee: Number(order.rentalFee),
                lateFee: Number(order.lateFee),
                isOverdue: order.isOverdue,
                overdueDays: order.overdueDays,
                pendingCount: order.pendingCount,
                customerName: order.customer.fullName,
                customerPhone: order.customer.phone,
                // แปลง Decimal เป็น number ตั้งแต่ฝั่ง server
                // เพราะ Client Component รับ Decimal ของ Prisma ไม่ได้
                items: order.items.map((i) => ({
                  id: i.id,
                  equipmentName: i.unit.equipment.name,
                  serialNumber: i.unit.serialNumber,
                  dailyRate: Number(i.dailyRate),
                  days: i.days,
                  rentalCount: i.unit.rentalCount,
                  cycleLimit: i.unit.cycleLimit,
                  totalDaysUsed: i.unit.totalDaysUsed,
                  usageDaysLimit: i.unit.usageDaysLimit,
                  returnedAt: i.returnedAt ? i.returnedAt.toISOString() : null,
                  returnCondition: i.returnCondition,
                  returnNote: i.returnNote,
                })),
              }}
            />
          ))}
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        คืนช้าคิดเป็น<b>ค่าเช่าส่วนเกินตามจำนวนวันที่เกิน</b> ไม่ใช่ค่าปรับแยก
        เพราะอุปกรณ์ถูกใช้งานจริงในช่วงนั้น · เมื่อรับคืนแล้ว ตัวนับรอบเช่าและวันใช้งานจะเพิ่มขึ้น
        และถ้าครบเกณฑ์ ระบบจะดึงอุปกรณ์ออกจากคิวจองทันที (REQ-RISK-003) ·
        ออเดอร์ที่พบความเสียหายจะไม่ปิดอัตโนมัติ ต้องกดปิดเองหลังเคลียร์กับลูกค้า
      </p>
    </div>
  );
}
