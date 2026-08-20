import { prisma } from "@/lib/prisma";
import { getShopSettings } from "@/lib/settings";
import { BLOCKING_ORDER_STATUSES } from "@/lib/domain";
import { dayKey, today, DAY_MS } from "@/lib/queue";
import WalkInForm from "./WalkInForm";

export const dynamic = "force-dynamic";

/**
 * เตรียมข้อมูลให้ฟอร์มคำนวณ "ว่างหรือไม่" ได้เองในเบราว์เซอร์
 *
 * ส่งการจองของแต่ละชิ้นในช่วง 120 วันข้างหน้าไปด้วย เพื่อให้พนักงาน
 * เปลี่ยนวันที่แล้วเห็นผลทันทีโดยไม่ต้องรอ server ตอบทุกครั้ง
 * (ตัวที่กันจองซ้อนจริงยังเป็นการตรวจซ้ำใน transaction ฝั่ง server)
 */
async function loadWalkInData() {
  const start = today();
  const horizon = new Date(start.getTime() + 120 * DAY_MS);

  const [units, customers, settings] = await Promise.all([
    prisma.equipmentUnit.findMany({
      where: { isActive: true },
      include: {
        equipment: {
          select: {
            name: true,
            brand: { select: { name: true } },
            dailyRate: true,
            category: { select: { name: true, sortOrder: true } },
          },
        },
        orderItems: {
          where: {
            order: { status: { in: BLOCKING_ORDER_STATUSES } },
            endDate: { gte: start },
            startDate: { lte: horizon },
          },
          select: {
            startDate: true,
            endDate: true,
            order: { select: { orderCode: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["MEMBER", "VIP"] }, isSuspended: false },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true, grade: true },
    }),
    getShopSettings(prisma),
  ]);

  units.sort(
    (a, b) =>
      a.equipment.category.sortOrder - b.equipment.category.sortOrder ||
      a.equipment.name.localeCompare(b.equipment.name, "th") ||
      a.serialNumber.localeCompare(b.serialNumber),
  );

  return {
    settings,
    customers,
    units: units.map((u) => ({
      id: u.id,
      serialNumber: u.serialNumber,
      status: u.status,
      name: u.equipment.name,
      brand: u.equipment.brand.name,
      category: u.equipment.category.name,
      dailyRate: Number(u.equipment.dailyRate),
      // แปลงเป็นสตริง YYYY-MM-DD ตั้งแต่ฝั่ง server เพื่อให้เทียบวันในเบราว์เซอร์
      // ได้ตรง ๆ ไม่ต้องกังวลเรื่อง timezone ตอน serialize Date
      bookings: u.orderItems.map((i) => ({
        start: dayKey(i.startDate),
        end: dayKey(i.endDate),
        orderCode: i.order.orderCode,
      })),
    })),
  };
}

export default async function WalkInPage() {
  const data = await loadWalkInData();

  return (
    <WalkInForm
      units={data.units}
      customers={data.customers}
      bookingDeposit={data.settings.bookingDeposit}
      todayKey={dayKey(today())}
    />
  );
}
