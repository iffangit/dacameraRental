import { dayKey, today, DAY_MS } from "./queue.js";

/**
 * การรับคืนอุปกรณ์ — REQ-RENT-005 / REQ-RISK-002 / REQ-RISK-003 / REQ-RISK-001
 *
 * จังหวะรับคืนเป็นจุดที่ข้อมูลสำคัญหลายอย่างเกิดขึ้นพร้อมกัน จึงรวมไว้ที่เดียว:
 *   - ของกลับเข้าสต็อกตามสภาพที่ตรวจพบ
 *   - ตัวนับรอบเช่า/วันใช้งานเพิ่มขึ้น แล้วอาจถูกดึงออกจากคิวอัตโนมัติ
 *   - สถิติของลูกค้าถูกอัปเดต แล้วเกรดความเสี่ยงถูกคำนวณใหม่
 */

export class ReturnError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ReturnError";
    this.code = code;
  }
}

/** สภาพที่รับคืนได้ → สถานะที่อุปกรณ์จะกลับไปอยู่ */
export const CONDITION_TO_STATUS = {
  GOOD: "AVAILABLE",
  NEEDS_CLEANING: "CLEANING",
  DAMAGED: "MAINTENANCE",
};

export const CONDITION_LABEL = {
  GOOD: "ปกติ พร้อมปล่อยเช่าต่อ",
  NEEDS_CLEANING: "ต้องทำความสะอาดก่อน",
  DAMAGED: "พบความเสียหาย ต้องส่งซ่อม",
};

/**
 * คำนวณเกรดความเสี่ยงจากประวัติจริง — REQ-RISK-001
 *
 * ใช้สัดส่วนการคืนตรงเวลาเป็นหลัก และให้ความเสียหายมีน้ำหนักมากกว่าการคืนช้า
 * เพราะของพังคือต้นทุนที่ร้านต้องจ่ายจริง ส่วนคืนช้าคิดค่าเช่าเพิ่มได้อยู่แล้ว
 *
 * ลูกค้าใหม่ที่ยังไม่มีประวัติได้เกรด B (กลาง ๆ) ไม่ใช่ A เพราะยังพิสูจน์ตัวเองไม่พอ
 */
export function computeGrade({ totalRentals, onTimeReturns, lateReturns, damageIncidents }) {
  if (totalRentals < 3) return "B";

  const onTimeRate = onTimeReturns / totalRentals;

  if (damageIncidents >= 2) return "C";
  if (damageIncidents >= 1 && onTimeRate < 0.8) return "C";
  if (lateReturns >= 3 && onTimeRate < 0.7) return "C";

  if (damageIncidents === 0 && onTimeRate >= 0.9) return "A";

  return "B";
}

/** ออเดอร์ที่ยังมีของค้างอยู่กับลูกค้า เรียงของที่เลยกำหนดขึ้นก่อน */
export async function listOpenRentals(client) {
  const orders = await client.rentalOrder.findMany({
    where: {
      status: { in: ["ACTIVE_RENTAL", "RETURNED_INSPECTED"] },
    },
    include: {
      customer: {
        select: { id: true, fullName: true, phone: true, grade: true },
      },
      items: {
        include: {
          unit: {
            select: {
              id: true,
              serialNumber: true,
              status: true,
              rentalCount: true,
              cycleLimit: true,
              totalDaysUsed: true,
              usageDaysLimit: true,
              equipment: { select: { name: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  const todayKey = dayKey(today());

  return orders
    .map((order) => {
      const pending = order.items.filter((i) => !i.returnedAt);
      const overdueDays = Math.max(
        0,
        Math.round((today() - new Date(dayKey(order.endDate))) / DAY_MS),
      );

      return {
        ...order,
        pendingCount: pending.length,
        isOverdue: pending.length > 0 && dayKey(order.endDate) < todayKey,
        overdueDays,
      };
    })
    .filter((o) => o.pendingCount > 0 || o.status === "RETURNED_INSPECTED")
    .sort(
      (a, b) =>
        Number(b.isOverdue) - Number(a.isOverdue) ||
        new Date(a.endDate) - new Date(b.endDate),
    );
}

/**
 * รับคืนอุปกรณ์บางชิ้นหรือทั้งหมดของออเดอร์
 *
 * @param returns [{ itemId, condition, note }]
 */
export async function returnItemsTx(tx, { orderId, returns, adminId }) {
  if (!Array.isArray(returns) || returns.length === 0) {
    throw new ReturnError("กรุณาเลือกอุปกรณ์ที่จะรับคืน", "NO_ITEMS");
  }

  const order = await tx.rentalOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { unit: { include: { equipment: true } } } },
    },
  });

  if (!order) throw new ReturnError("ไม่พบออเดอร์นี้", "NOT_FOUND");
  if (!["ACTIVE_RENTAL", "RETURNED_INSPECTED"].includes(order.status)) {
    throw new ReturnError(
      `ออเดอร์นี้อยู่ในสถานะที่รับคืนไม่ได้ (${order.status})`,
      "BAD_STATUS",
    );
  }

  const now = new Date();
  const todayDate = today();
  const dueKey = dayKey(order.endDate);
  const lateDays = Math.max(
    0,
    Math.round((todayDate - new Date(dueKey)) / DAY_MS),
  );

  let totalLateFee = 0;
  let damagedCount = 0;
  const returnedNames = [];

  for (const entry of returns) {
    const item = order.items.find((i) => i.id === Number(entry.itemId));
    if (!item) {
      throw new ReturnError("ไม่พบรายการอุปกรณ์ที่ระบุ", "ITEM_NOT_FOUND");
    }
    if (item.returnedAt) {
      throw new ReturnError(
        `${item.unit.equipment.name} (${item.unit.serialNumber}) ถูกรับคืนไปแล้ว`,
        "ALREADY_RETURNED",
      );
    }

    const condition = entry.condition;
    if (!CONDITION_TO_STATUS[condition]) {
      throw new ReturnError("กรุณาเลือกสภาพอุปกรณ์", "INVALID_CONDITION");
    }
    if (condition === "DAMAGED" && !String(entry.note ?? "").trim()) {
      throw new ReturnError(
        `กรุณาระบุความเสียหายของ ${item.unit.equipment.name} (${item.unit.serialNumber})`,
        "DAMAGE_NOTE_REQUIRED",
      );
    }

    // คืนช้าคิดเป็นค่าเช่าส่วนเกินตามจำนวนวันที่เกิน ไม่ใช่ค่าปรับแยก
    // เพราะของถูกใช้งานต่อจริงในช่วงนั้น
    const lateFee = lateDays * Number(item.dailyRate);
    totalLateFee += lateFee;
    if (condition === "DAMAGED") damagedCount += 1;

    await tx.rentalOrderItem.update({
      where: { id: item.id },
      data: {
        returnedAt: now,
        returnCondition: condition,
        returnNote: String(entry.note ?? "").trim() || null,
        lateDays,
        lateFee,
        returnedById: adminId ?? null,
      },
    });

    // ---- อุปกรณ์กลับเข้าสต็อกตามสภาพ + เดินตัวนับบำรุงรักษา (REQ-RISK-003) ----
    const usedDays = item.days + lateDays;
    const nextRentalCount = item.unit.rentalCount + 1;
    const nextUsageDays = item.unit.totalDaysUsed + usedDays;

    // ครบเกณฑ์แล้วต้องถูกดึงออกจากคิวทันที ไม่รอให้ใครมากดเอง
    const hitLimit =
      nextRentalCount >= item.unit.cycleLimit ||
      nextUsageDays >= item.unit.usageDaysLimit;

    let nextStatus = CONDITION_TO_STATUS[condition];
    if (nextStatus === "AVAILABLE" && hitLimit) nextStatus = "CLEANING";

    await tx.equipmentUnit.update({
      where: { id: item.equipmentUnitId },
      data: {
        status: nextStatus,
        rentalCount: nextRentalCount,
        totalDaysUsed: nextUsageDays,
      },
    });

    if (nextStatus !== "AVAILABLE") {
      await tx.maintenanceRecord.create({
        data: {
          equipmentUnitId: item.equipmentUnitId,
          reason:
            condition === "DAMAGED"
              ? "DAMAGE_REPORTED"
              : nextRentalCount >= item.unit.cycleLimit
                ? "RENTAL_CYCLE_LIMIT"
                : nextUsageDays >= item.unit.usageDaysLimit
                  ? "USAGE_DAYS_LIMIT"
                  : "ROUTINE_CLEANING",
          isAutomatic: condition !== "DAMAGED",
          note: String(entry.note ?? "").trim() || null,
        },
      });
    }

    // ---- บันทึกการตรวจสภาพตอนรับคืน (REQ-RISK-002) ----
    // ตัวรูปภาพยังไม่ได้ทำ แต่บันทึกผลตรวจไว้ก่อนเพื่อให้มีหลักฐานว่าตรวจแล้ว
    await tx.inspectionLog.create({
      data: {
        orderId,
        equipmentUnitId: item.equipmentUnitId,
        phase: "AFTER_RETURN",
        damageNote: String(entry.note ?? "").trim() || null,
        hasNewDamage: condition === "DAMAGED",
        inspectedById: adminId,
      },
    });

    returnedNames.push(
      `${item.unit.equipment.name} (${item.unit.serialNumber})`,
    );
  }

  // ---- ปิดออเดอร์ถ้าคืนครบแล้ว ----
  const stillPending = await tx.rentalOrderItem.count({
    where: { orderId, returnedAt: null },
  });

  const accumulatedLateFee = Number(order.lateFee) + totalLateFee;
  let finalStatus = order.status;

  if (stillPending === 0) {
    const damagedTotal = await tx.rentalOrderItem.count({
      where: { orderId, returnCondition: "DAMAGED" },
    });

    // พบความเสียหาย = ยังปิดไม่ได้ ต้องเคลียร์ค่าเสียหายกับลูกค้าก่อน
    finalStatus = damagedTotal > 0 ? "RETURNED_INSPECTED" : "CLOSED";

    await tx.rentalOrder.update({
      where: { id: orderId },
      data: { status: finalStatus, returnedAt: now, lateFee: accumulatedLateFee },
    });

    await updateCustomerStatsTx(tx, {
      userId: order.userId,
      wasLate: lateDays > 0,
      hadDamage: damagedTotal > 0,
    });
  } else {
    await tx.rentalOrder.update({
      where: { id: orderId },
      data: { lateFee: accumulatedLateFee },
    });
  }

  await tx.activityLog.create({
    data: {
      type: "ORDER_RETURNED",
      message: `รับคืน ${returnedNames.join(", ")} จาก ${order.customer.fullName} (${order.orderCode})${
        lateDays > 0 ? ` · คืนช้า ${lateDays} วัน เก็บเพิ่ม ${totalLateFee.toLocaleString("th-TH")} บาท` : ""
      }${damagedCount > 0 ? ` · พบความเสียหาย ${damagedCount} ชิ้น` : ""}`,
      actorId: adminId ?? null,
      refType: "RentalOrder",
      refId: orderId,
    },
  });

  return {
    message:
      stillPending === 0
        ? finalStatus === "CLOSED"
          ? `รับคืนครบแล้ว ปิดออเดอร์ ${order.orderCode} เรียบร้อย`
          : `รับคืนครบแล้ว — ${order.orderCode} รอเคลียร์ค่าเสียหายก่อนปิด`
        : `รับคืน ${returns.length} ชิ้นแล้ว เหลืออีก ${stillPending} ชิ้น`,
    stillPending,
    lateDays,
    lateFee: totalLateFee,
    status: finalStatus,
  };
}

/**
 * อัปเดตสถิติและเกรดของลูกค้าหลังจบการเช่า — REQ-RISK-001
 * เรียกตอนคืนครบเท่านั้น เพราะ 1 ออเดอร์ = การเช่า 1 ครั้ง
 */
export async function updateCustomerStatsTx(tx, { userId, wasLate, hadDamage }) {
  const user = await tx.user.findUnique({ where: { id: userId } });

  const stats = {
    totalRentals: user.totalRentals + 1,
    onTimeReturns: user.onTimeReturns + (wasLate ? 0 : 1),
    lateReturns: user.lateReturns + (wasLate ? 1 : 0),
    damageIncidents: user.damageIncidents + (hadDamage ? 1 : 0),
  };

  const grade = computeGrade(stats);

  await tx.user.update({
    where: { id: userId },
    data: {
      ...stats,
      grade,
      // คะแนนความเสี่ยงใช้แสดงผลคร่าว ๆ — อิงสัดส่วนคืนตรงเวลา หักด้วยความเสียหาย
      riskScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (stats.onTimeReturns / stats.totalRentals) * 100 -
              stats.damageIncidents * 15,
          ),
        ),
      ),
    },
  });

  return { grade, ...stats };
}

/** ปิดออเดอร์ที่ค้างอยู่หลังเคลียร์ค่าเสียหายแล้ว */
export async function closeOrderTx(tx, { orderId, adminId }) {
  const order = await tx.rentalOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderCode: true, status: true },
  });

  if (!order) throw new ReturnError("ไม่พบออเดอร์นี้", "NOT_FOUND");
  if (order.status !== "RETURNED_INSPECTED") {
    throw new ReturnError(
      "ปิดได้เฉพาะออเดอร์ที่รับคืนครบและรอเคลียร์ค่าเสียหาย",
      "BAD_STATUS",
    );
  }

  await tx.rentalOrder.update({
    where: { id: orderId },
    data: { status: "CLOSED" },
  });

  await tx.activityLog.create({
    data: {
      type: "ORDER_RETURNED",
      message: `ปิดออเดอร์ ${order.orderCode} หลังเคลียร์ค่าเสียหายเรียบร้อย`,
      actorId: adminId ?? null,
      refType: "RentalOrder",
      refId: orderId,
    },
  });

  return { message: `ปิดออเดอร์ ${order.orderCode} เรียบร้อย` };
}
