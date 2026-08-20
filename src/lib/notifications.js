import { today, DAY_MS } from "./queue.js";

/**
 * รายการแจ้งเตือนสำหรับกระดิ่งบน topbar
 *
 * ไม่ได้เก็บเป็นตารางแยก แต่คำนวณสด ๆ จากสถานะจริงของระบบ
 * เพราะการแจ้งเตือนพวกนี้เป็น "สิ่งที่ค้างอยู่ตอนนี้" ไม่ใช่ "เหตุการณ์ที่เคยเกิด"
 * ถ้าเก็บเป็นแถวจะต้องคอยลบเองเมื่อปัญหาถูกแก้ ซึ่งพลาดง่ายและทำให้เห็นแจ้งเตือนค้าง
 * (ActivityLog ที่มีอยู่แล้วทำหน้าที่บันทึกประวัติเหตุการณ์อยู่)
 */
export async function getNotifications(client) {
  const start = today();
  const endOfToday = new Date(start.getTime() + DAY_MS - 1);
  const dayAgo = new Date(Date.now() - DAY_MS);

  const [stalePending, pending, attentionUnits, aiDrafts, overdue, dueToday] =
    await Promise.all([
      client.rentalOrder.count({
        where: { status: "PENDING_APPROVAL", createdAt: { lt: dayAgo } },
      }),
      client.rentalOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      client.equipmentUnit.count({
        where: { isActive: true, status: { in: ["MAINTENANCE", "CLEANING"] } },
      }),
      client.aiMarketingPost.count({ where: { status: "DRAFT" } }),
      client.rentalOrderItem.count({
        where: { endDate: { lt: start }, order: { status: "ACTIVE_RENTAL" } },
      }),
      client.rentalOrderItem.count({
        where: {
          endDate: { gte: start, lte: endOfToday },
          order: { status: "ACTIVE_RENTAL" },
        },
      }),
    ]);

  const list = [];

  // เรียงจากเร่งด่วนที่สุดลงมา — ของเลยกำหนดคืนคือเงินและทรัพย์สินที่กำลังเสี่ยง
  if (overdue > 0) {
    list.push({
      key: "overdue",
      tag: "!",
      color: "var(--color-primary)",
      title: `เลยกำหนดคืน ${overdue} ชิ้น`,
      detail: "ติดต่อลูกค้าเพื่อติดตามอุปกรณ์",
      href: "/queue",
      urgent: true,
    });
  }

  if (stalePending > 0) {
    list.push({
      key: "stale",
      tag: "PA",
      color: "var(--color-primary)",
      title: `คำขอค้างเกิน 24 ชั่วโมง ${stalePending} รายการ`,
      detail: "ลูกค้ารอคำตอบนานแล้ว",
      href: "/approval",
      urgent: true,
    });
  } else if (pending > 0) {
    list.push({
      key: "pending",
      tag: "PA",
      color: "var(--color-maintenance)",
      title: `คำขอรออนุมัติ ${pending} รายการ`,
      detail: "ตรวจสอบและอนุมัติคิว",
      href: "/approval",
    });
  }

  if (dueToday > 0) {
    list.push({
      key: "due-today",
      tag: "RT",
      color: "var(--color-maintenance)",
      title: `ครบกำหนดคืนวันนี้ ${dueToday} ชิ้น`,
      detail: "เตรียมรับคืนและตรวจสภาพ",
      href: "/queue",
    });
  }

  if (attentionUnits > 0) {
    list.push({
      key: "maintenance",
      tag: "MNT",
      color: "var(--color-maintenance)",
      title: `อุปกรณ์รอบำรุงรักษา ${attentionUnits} ชิ้น`,
      detail: "ถูกตัดออกจากคิวจองชั่วคราว",
      href: "/stock?status=MAINTENANCE",
    });
  }

  if (aiDrafts > 0) {
    list.push({
      key: "ai",
      tag: "AI",
      color: "var(--color-cleaning)",
      title: `ร่างโพส AI รอตรวจ ${aiDrafts} รายการ`,
      detail: "ตรวจเนื้อหาก่อนเผยแพร่",
      href: "/marketing",
    });
  }

  return {
    items: list,
    urgentCount: list.filter((i) => i.urgent).length,
    total: list.length,
  };
}
