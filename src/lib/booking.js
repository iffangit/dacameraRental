import { Prisma } from "@prisma/client";

/**
 * การตรวจคิวชนกัน — หัวใจของ NFR "Data Integrity 100%"
 *
 * ใช้ 2 ที่ด้วยตรรกะเดียวกัน:
 *   1. ตอนเรนเดอร์หน้า Approval — เตือนแอดมินล่วงหน้าว่าคำขอนี้ชนคิว (lock = false)
 *   2. ตอนกดอนุมัติจริง — ตรวจซ้ำใน transaction พร้อมล็อกแถว (lock = true)
 *
 * ที่ต้องตรวจสองรอบเพราะระหว่างที่แอดมินอ่านรายละเอียดอยู่
 * อาจมีคนอื่นอนุมัติคำขอที่ทับเวลากันไปแล้ว การตรวจตอนเรนเดอร์
 * จึงเป็นแค่การเตือน ส่วนตัวที่กันของจริงคือการตรวจใน transaction
 */

/** ออเดอร์ที่ "ยึดของจริง" แล้ว — คำขออื่นทับช่วงนี้ไม่ได้ */
export const CONFLICTING_STATUSES = ["APPROVED", "ACTIVE_RENTAL"];

/** สถานะอุปกรณ์ที่ส่งมอบไม่ได้ ต่อให้คิวว่าง */
export const UNAVAILABLE_UNIT_STATUSES = ["MAINTENANCE", "CLEANING", "RETIRED"];

/**
 * หารายการจองที่ทับช่วงเวลาของออเดอร์นี้
 *
 * @param client  prisma client หรือ transaction client
 * @param lock    true = ต่อท้าย FOR UPDATE เพื่อล็อกแถวจนจบ transaction
 *                ป้องกันสองคำขอที่ชนกันถูกอนุมัติพร้อมกัน (race condition)
 */
export async function findConflicts(
  client,
  { orderId, unitIds, startDate, endDate, lock = false },
) {
  if (unitIds.length === 0) return [];

  return client.$queryRaw`
    SELECT
      i.id            AS itemId,
      i.equipmentUnitId,
      i.startDate,
      i.endDate,
      o.orderCode,
      o.status,
      u.serialNumber,
      e.name          AS equipmentName,
      c.fullName      AS customerName
    FROM \`RentalOrderItem\` i
    JOIN \`RentalOrder\`    o ON o.id = i.orderId
    JOIN \`EquipmentUnit\`  u ON u.id = i.equipmentUnitId
    JOIN \`Equipment\`      e ON e.id = u.equipmentId
    JOIN \`User\`           c ON c.id = o.userId
    WHERE i.equipmentUnitId IN (${Prisma.join(unitIds)})
      AND i.orderId <> ${orderId}
      AND o.status IN (${Prisma.join(CONFLICTING_STATUSES)})
      AND i.startDate <= ${endDate}
      AND i.endDate   >= ${startDate}
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
  `;
}

/** อุปกรณ์ในคำขอที่สถานะไม่พร้อมส่งมอบ (ส่งซ่อม/รอทำความสะอาด/ปลดระวาง) */
export function findUnavailableUnits(items) {
  return items
    .filter((item) => UNAVAILABLE_UNIT_STATUSES.includes(item.unit.status))
    .map((item) => ({
      serialNumber: item.unit.serialNumber,
      equipmentName: item.unit.equipment.name,
      status: item.unit.status,
    }));
}
