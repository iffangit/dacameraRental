import { findConflicts, UNAVAILABLE_UNIT_STATUSES } from "./booking.js";
import { UNIT_STATUS } from "./domain.js";

/**
 * แกนกลางของการอนุมัติ/ปฏิเสธคำขอเช่า — REQ-RENT-005
 *
 * แยกออกจาก Server Action เพราะสองเหตุผล
 *   1. ทดสอบได้ — เรียกจากสคริปต์ธรรมดาได้โดยไม่ต้องมี Next runtime
 *   2. เรียกซ้ำได้ — อนาคตถ้ามี API สำหรับ LINE bot (Roadmap ข้อ 1)
 *      ก็เรียกฟังก์ชันเดียวกันนี้ ไม่ต้องเขียนกฎซ้ำ
 *
 * ต้องถูกเรียกภายใน transaction เสมอ (รับ tx เข้ามา) เพราะการตรวจคิว
 * กับการเปลี่ยนสถานะต้องเป็นอะตอมมิก ไม่งั้นสองคำขอที่ชนกัน
 * อาจถูกอนุมัติพร้อมกันได้
 */
export class OrderDecisionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrderDecisionError";
    this.code = code;
  }
}

/**
 * เมื่อสองแอดมินกดอนุมัติคำขอที่ใช้อุปกรณ์ชิ้นเดียวกันพร้อมกัน
 * InnoDB จะตัดสินด้วยการ deadlock แล้วยกเลิก transaction ฝั่งหนึ่งทิ้ง
 *
 * นี่ไม่ใช่ข้อผิดพลาดของระบบ แต่เป็นกลไกปกติของฐานข้อมูล — ทางแก้มาตรฐาน
 * คือลองใหม่ เพราะรอบสองจะเห็นผลของ transaction ที่สำเร็จไปแล้ว
 * แล้วถูกปฏิเสธด้วยข้อความ "คิวชนกัน" ที่อ่านรู้เรื่อง แทน "Raw query failed"
 */
const RETRYABLE = /deadlock|lock wait timeout|raw query failed/i;
const MAX_ATTEMPTS = 3;

/**
 * ห่อ decideOrderTx ด้วย transaction + retry
 * คืน { ok, message } เสมอ ไม่ throw เพื่อให้ฝั่งเรียกใช้ส่งต่อให้ UI ได้ทันที
 */
export async function decideOrderWithRetry(client, params) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await client.$transaction((tx) => decideOrderTx(tx, params));
      return { ok: true, message: result.message };
    } catch (error) {
      // กฎธุรกิจปฏิเสธ = คำตอบสุดท้าย ไม่ต้องลองใหม่
      if (error instanceof OrderDecisionError) {
        return { ok: false, message: error.message, code: error.code };
      }

      const retryable = RETRYABLE.test(error?.message ?? "");
      if (!retryable || attempt === MAX_ATTEMPTS) {
        console.error("[decideOrder] ล้มเหลว:", error);
        return {
          ok: false,
          code: retryable ? "LOCK_CONTENTION" : "UNKNOWN",
          message: retryable
            ? "ระบบกำลังประมวลผลคำขออื่นที่ใช้อุปกรณ์ชิ้นเดียวกันอยู่ — กรุณากดอีกครั้ง"
            : "เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่",
        };
      }

      // หน่วงสั้น ๆ แบบเพิ่มขึ้นทีละรอบ ให้ transaction อีกฝั่งทำงานจบก่อน
      await new Promise((resolve) => setTimeout(resolve, attempt * 60));
    }
  }
}

export async function decideOrderTx(tx, { orderId, decision, adminNote, adminId }) {
  // ล็อกแถวออเดอร์ไว้ก่อน กันสองแอดมินกดพร้อมกัน
  const [locked] = await tx.$queryRaw`
    SELECT id, status FROM \`RentalOrder\` WHERE id = ${orderId} FOR UPDATE
  `;

  if (!locked) {
    throw new OrderDecisionError("ไม่พบคำขอเช่านี้ในระบบ", "NOT_FOUND");
  }
  if (locked.status !== "PENDING_APPROVAL") {
    throw new OrderDecisionError(
      "คำขอนี้ถูกดำเนินการไปแล้ว (อาจมีแอดมินอีกคนกดไปก่อน) — รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
      "ALREADY_DECIDED",
    );
  }

  const order = await tx.rentalOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { fullName: true } },
      items: {
        include: {
          unit: {
            select: {
              id: true,
              serialNumber: true,
              status: true,
              equipment: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // ---------- ปฏิเสธ: ไม่ต้องตรวจคิว ----------
  if (decision === "REJECT") {
    await tx.rentalOrder.update({
      where: { id: orderId },
      data: {
        status: "REJECTED",
        adminNote: adminNote || null,
        approvedById: adminId ?? null,
        approvedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        type: "ORDER_REJECTED",
        message: `ไม่อนุมัติคำขอ ${order.orderCode} ของ ${order.customer.fullName}${
          adminNote ? ` — เหตุผล: ${adminNote}` : ""
        }`,
        actorId: adminId ?? null,
        refType: "RentalOrder",
        refId: orderId,
      },
    });

    return { message: `ไม่อนุมัติคำขอ ${order.orderCode} แล้ว` };
  }

  // ---------- อนุมัติ: ผ่านด่านตรวจ 2 ชั้น ----------

  // ด่าน 1 — อุปกรณ์ต้องอยู่ในสภาพพร้อมส่งมอบ
  const unavailable = order.items.filter((item) =>
    UNAVAILABLE_UNIT_STATUSES.includes(item.unit.status),
  );
  if (unavailable.length > 0) {
    const detail = unavailable
      .map(
        (i) =>
          `${i.unit.equipment.name} (${i.unit.serialNumber}) — ${UNIT_STATUS[i.unit.status].label}`,
      )
      .join(", ");
    throw new OrderDecisionError(
      `อนุมัติไม่ได้ เพราะอุปกรณ์ไม่พร้อมส่งมอบ: ${detail}`,
      "UNIT_UNAVAILABLE",
    );
  }

  // ด่าน 2 — คิวต้องไม่ทับกับออเดอร์ที่ยึดของไปแล้ว (ล็อกแถวด้วย FOR UPDATE)
  const conflicts = await findConflicts(tx, {
    orderId,
    unitIds: order.items.map((i) => i.equipmentUnitId),
    startDate: order.startDate,
    endDate: order.endDate,
    lock: true,
  });

  if (conflicts.length > 0) {
    const detail = conflicts
      .map((c) => `${c.equipmentName} (${c.serialNumber}) ติดคิว ${c.orderCode}`)
      .join(", ");
    throw new OrderDecisionError(
      `อนุมัติไม่ได้ เพราะคิวชนกัน: ${detail}`,
      "QUEUE_CONFLICT",
    );
  }

  await tx.rentalOrder.update({
    where: { id: orderId },
    data: {
      status: "APPROVED",
      adminNote: adminNote || null,
      approvedById: adminId ?? null,
      approvedAt: new Date(),
    },
  });

  await tx.activityLog.create({
    data: {
      type: "ORDER_APPROVED",
      message: `อนุมัติคำขอ ${order.orderCode} ของ ${order.customer.fullName} — ${order.items.length} รายการ ${order.rentalDays} วัน`,
      actorId: adminId ?? null,
      refType: "RentalOrder",
      refId: orderId,
    },
  });

  return { message: `อนุมัติคำขอ ${order.orderCode} เรียบร้อย` };
}
