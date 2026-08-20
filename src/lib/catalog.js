import { BLOCKING_ORDER_STATUSES } from "./domain.js";
import { DAY_MS, buildDays, dayKey, rangesOverlap, today } from "./queue.js";

/**
 * ข้อมูลสำหรับหน้าร้านฝั่งลูกค้า (public) — REQ-RENT-001
 *
 * หน้านี้ไม่ต้องล็อกอิน จึงต้องระวังเป็นพิเศษว่า **ห้ามหลุดข้อมูลลูกค้าคนอื่น**
 * ฟังก์ชันในไฟล์นี้จึงคืนแค่ "ว่าง / ไม่ว่าง" เท่านั้น ไม่คืนชื่อผู้เช่า
 * เลขที่ออเดอร์ หรือ Serial Number ซึ่งเป็นข้อมูลภายในร้าน
 */

/** จำนวนวันที่แสดงในปฏิทินหน้าร้าน — ยาวกว่าฝั่งแอดมินเพราะลูกค้าวางแผนล่วงหน้า */
export const PUBLIC_DAYS = 14;

/**
 * รายการอุปกรณ์ทั้งหมดที่เปิดให้เช่า พร้อมจำนวนที่ว่างวันนี้
 * นับเป็น "รุ่น" ไม่ใช่รายชิ้น เพราะลูกค้าเลือกจากรุ่น ไม่ได้เลือก Serial
 */
export async function loadCatalog(client, { q = "", categoryId = null } = {}) {
  const start = today();
  const horizon = new Date(start.getTime() + PUBLIC_DAYS * DAY_MS);
  const todayKey = dayKey(start);

  const equipments = await client.equipment.findMany({
    where: {
      isActive: true,
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { brand: { name: { contains: q } } },
            ],
          }
        : {}),
      // รุ่นที่ไม่มีของเลยไม่ต้องโชว์ ลูกค้าเห็นแล้วเสียเวลา
      units: { some: { isActive: true } },
    },
    include: {
      brand: { select: { name: true } },
      category: { select: { id: true, name: true, sortOrder: true } },
      units: {
        where: { isActive: true },
        select: {
          id: true,
          status: true,
          orderItems: {
            where: {
              order: { status: { in: BLOCKING_ORDER_STATUSES } },
              endDate: { gte: start },
              startDate: { lte: horizon },
            },
            select: { startDate: true, endDate: true },
          },
        },
      },
    },
  });

  const rows = equipments.map((eq) => {
    const freeToday = eq.units.filter((u) => {
      if (u.status !== "AVAILABLE") return false;
      return !u.orderItems.some((i) =>
        rangesOverlap(dayKey(i.startDate), dayKey(i.endDate), todayKey, todayKey),
      );
    }).length;

    return {
      id: eq.id,
      name: eq.name,
      brandName: eq.brand.name,
      categoryId: eq.category.id,
      categoryName: eq.category.name,
      categorySort: eq.category.sortOrder,
      dailyRate: Number(eq.dailyRate),
      description: eq.description,
      imageUrl: eq.imageUrl,
      totalUnits: eq.units.length,
      freeToday,
    };
  });

  rows.sort(
    (a, b) =>
      a.categorySort - b.categorySort ||
      b.freeToday - a.freeToday ||
      a.name.localeCompare(b.name, "th"),
  );

  return rows;
}

/**
 * ปฏิทินความว่างของรุ่นหนึ่ง ๆ สำหรับหน้าร้าน
 * คืนเป็นจำนวนชิ้นที่ว่างในแต่ละวัน ไม่บอกว่าใครจองหรือ Serial ไหนถูกจอง
 */
export async function loadPublicAvailability(client, equipmentId, startDate) {
  const start = startDate ?? today();
  const end = new Date(start.getTime() + (PUBLIC_DAYS - 1) * DAY_MS);

  const equipment = await client.equipment.findUnique({
    where: { id: Number(equipmentId) },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      units: {
        where: { isActive: true },
        select: {
          id: true,
          status: true,
          orderItems: {
            where: {
              order: { status: { in: BLOCKING_ORDER_STATUSES } },
              endDate: { gte: start },
              startDate: { lte: end },
            },
            select: { startDate: true, endDate: true },
          },
        },
      },
    },
  });

  if (!equipment || !equipment.isActive) return null;

  const days = buildDays(start, PUBLIC_DAYS).map((day) => {
    const free = equipment.units.filter((u) => {
      // ของที่ส่งซ่อมหรือรอทำความสะอาดถือว่าเช่าไม่ได้ตลอดช่วงที่แสดง
      if (u.status !== "AVAILABLE" && u.status !== "RENTED") return false;

      return !u.orderItems.some((i) =>
        rangesOverlap(dayKey(i.startDate), dayKey(i.endDate), day.key, day.key),
      );
    }).length;

    return { ...day, free };
  });

  return {
    id: equipment.id,
    name: equipment.name,
    brandName: equipment.brand.name,
    categoryName: equipment.category.name,
    dailyRate: Number(equipment.dailyRate),
    description: equipment.description,
    imageUrl: equipment.imageUrl,
    totalUnits: equipment.units.length,
    days,
  };
}
