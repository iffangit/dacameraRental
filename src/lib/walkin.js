import { findConflicts, UNAVAILABLE_UNIT_STATUSES } from "./booking.js";
import { calculateRental, UNIT_STATUS } from "./domain.js";
import { getShopSettings } from "./settings.js";
import { dayKey, today } from "./queue.js";

/**
 * การเช่าหน้าร้าน (Walk-in) — ลูกค้าเดินเข้ามาเช่า พนักงานทำรายการให้
 *
 * ต่างจากคำขอออนไลน์ตรงที่ไม่ต้องผ่านการอนุมัติ เพราะเจ้าของร้านเป็นคนทำรายการเอง
 * และลูกค้ายืนอยู่ตรงหน้าแล้ว — แต่ยังต้องตรวจคิวชนเหมือนกันทุกประการ
 * เพราะอุปกรณ์ชิ้นเดียวกันอาจถูกจองล่วงหน้าไว้แล้วจากออนไลน์
 */

export class WalkInError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WalkInError";
    this.code = code;
  }
}

/** เบอร์โทรไทยแบบหลวม ๆ — ตัดอักขระที่ไม่ใช่ตัวเลขออกก่อนตรวจ */
function normalisePhone(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

/**
 * หาเลขที่ออเดอร์ถัดไปของปีนี้
 * นับจากเลขสูงสุดที่มีอยู่ ไม่ใช่จำนวนแถว เพราะออเดอร์ที่ถูกลบจะทำให้เลขซ้ำ
 */
async function nextOrderCode(tx) {
  const thaiYear = new Date().getFullYear() + 543;
  const prefix = `ORD-${thaiYear}-`;

  const latest = await tx.rentalOrder.findFirst({
    where: { orderCode: { startsWith: prefix } },
    orderBy: { orderCode: "desc" },
    select: { orderCode: true },
  });

  const lastNumber = latest ? Number(latest.orderCode.slice(prefix.length)) : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

/**
 * หาหรือสร้างลูกค้าหน้าร้าน
 *
 * ค้นด้วยเบอร์โทรก่อน เพราะลูกค้าที่เคยมาแล้วควรได้ประวัติต่อเนื่อง
 * ไม่ใช่ถูกสร้างโปรไฟล์ใหม่ทุกครั้งที่มา ซึ่งจะทำให้เกรดความเสี่ยงไม่มีความหมาย
 */
/**
 * ตรวจรูปแบบข้อมูลลูกค้าก่อนแตะฐานข้อมูล
 *
 * แยกออกมาเพื่อให้เรียกได้ตั้งแต่ต้น — ถ้าพนักงานพิมพ์เบอร์ผิด
 * ควรได้ข้อความเรื่องเบอร์ ไม่ใช่ข้อความเรื่องอุปกรณ์ที่ตรวจเจอทีหลัง
 */
function validateGuestInput({ customerId, guestName, guestPhone }) {
  if (customerId) return;

  const name = String(guestName ?? "").trim();
  const phone = normalisePhone(guestPhone);

  if (name.length < 2) {
    throw new WalkInError("กรุณากรอกชื่อลูกค้า", "INVALID_NAME");
  }
  if (phone.length < 9 || phone.length > 10) {
    throw new WalkInError(
      "เบอร์โทรไม่ถูกต้อง — ต้องมี 9-10 หลัก",
      "INVALID_PHONE",
    );
  }
}

async function resolveCustomer(tx, { customerId, guestName, guestPhone }) {
  if (customerId) {
    const existing = await tx.user.findUnique({ where: { id: customerId } });
    if (!existing) throw new WalkInError("ไม่พบลูกค้าที่เลือก", "CUSTOMER_NOT_FOUND");
    if (existing.isSuspended) {
      throw new WalkInError(
        `บัญชีของ ${existing.fullName} ถูกระงับการใช้งาน`,
        "CUSTOMER_SUSPENDED",
      );
    }
    return existing;
  }

  const name = String(guestName ?? "").trim();
  const phone = normalisePhone(guestPhone);

  // เคยมาแล้วหรือยัง
  const known = await tx.user.findFirst({ where: { phone } });
  if (known) {
    if (known.isSuspended) {
      throw new WalkInError(
        `บัญชีของ ${known.fullName} ถูกระงับการใช้งาน`,
        "CUSTOMER_SUSPENDED",
      );
    }
    return known;
  }

  // ลูกค้าใหม่ — สร้างโปรไฟล์ให้โดยไม่มีรหัสผ่าน (ล็อกอินไม่ได้จนกว่าจะสมัครเอง)
  return tx.user.create({
    data: {
      fullName: name,
      phone,
      email: null,
      passwordHash: null,
      role: "MEMBER",
      grade: "B",
    },
  });
}

/**
 * สร้างรายการเช่าหน้าร้าน
 *
 * ต้องเรียกภายใน transaction เสมอ เพราะการตรวจคิวชนกับการสร้างออเดอร์
 * ต้องเป็นอะตอมมิก ไม่งั้นสองเครื่องที่ทำรายการพร้อมกันอาจจองซ้อนได้
 */
export async function createWalkInOrderTx(tx, input) {
  const {
    customerId,
    guestName,
    guestPhone,
    unitIds,
    startDate,
    endDate,
    discountAmount = 0,
    discountNote,
    note,
    adminId,
  } = input;

  // ---------- ตรวจข้อมูลที่พนักงานกรอกก่อน (ถูกที่สุด ตรงจุดที่สุด) ----------
  validateGuestInput({ customerId, guestName, guestPhone });

  // ---------- ตรวจอุปกรณ์ ----------
  const ids = [...new Set((unitIds ?? []).map(Number).filter(Boolean))];
  if (ids.length === 0) {
    throw new WalkInError("กรุณาเลือกอุปกรณ์อย่างน้อย 1 ชิ้น", "NO_ITEMS");
  }

  // ---------- ตรวจวันที่ ----------
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new WalkInError("วันที่ไม่ถูกต้อง", "INVALID_DATE");
  }
  if (dayKey(end) < dayKey(start)) {
    throw new WalkInError("วันคืนต้องไม่ก่อนวันเริ่มเช่า", "END_BEFORE_START");
  }

  const days =
    Math.round((new Date(dayKey(end)) - new Date(dayKey(start))) / 86_400_000) + 1;
  if (days > 90) {
    throw new WalkInError("เช่าได้ไม่เกิน 90 วันต่อครั้ง", "TOO_LONG");
  }

  const units = await tx.equipmentUnit.findMany({
    where: { id: { in: ids }, isActive: true },
    include: { equipment: true },
  });

  if (units.length !== ids.length) {
    throw new WalkInError("มีอุปกรณ์บางชิ้นไม่อยู่ในระบบแล้ว", "UNIT_NOT_FOUND");
  }

  // ด่าน 1 — สภาพอุปกรณ์ต้องพร้อมส่งมอบ
  const unavailable = units.filter((u) =>
    UNAVAILABLE_UNIT_STATUSES.includes(u.status),
  );
  if (unavailable.length > 0) {
    const detail = unavailable
      .map(
        (u) =>
          `${u.equipment.name} (${u.serialNumber}) — ${UNIT_STATUS[u.status].label}`,
      )
      .join(", ");
    throw new WalkInError(`อุปกรณ์ไม่พร้อมให้เช่า: ${detail}`, "UNIT_UNAVAILABLE");
  }

  // ด่าน 2 — คิวต้องไม่ชนกับที่จองไว้แล้ว (ล็อกแถวจนจบ transaction)
  // ส่ง orderId = 0 เพราะยังไม่มีออเดอร์นี้ในระบบ จึงไม่ต้องยกเว้นตัวเอง
  const conflicts = await findConflicts(tx, {
    orderId: 0,
    unitIds: ids,
    startDate: start,
    endDate: end,
    lock: true,
  });

  if (conflicts.length > 0) {
    const detail = conflicts
      .map((c) => `${c.equipmentName} (${c.serialNumber}) ติดคิว ${c.orderCode}`)
      .join(", ");
    throw new WalkInError(`คิวชนกัน: ${detail}`, "QUEUE_CONFLICT");
  }

  // ---------- ลูกค้า ----------
  const customer = await resolveCustomer(tx, { customerId, guestName, guestPhone });

  // ---------- คิดเงิน ----------
  const settings = await getShopSettings(tx);
  const money = calculateRental(
    units.map((u) => ({ dailyRate: Number(u.equipment.dailyRate) })),
    days,
    // รับของทันทีจึงไม่ต้องเก็บมัดจำจองคิว เพราะมัดจำมีไว้กันลูกค้าจองแล้วไม่มา
    // ถ้าเป็นการจองล่วงหน้าที่หน้าร้าน ยังเก็บตามค่าที่ตั้งไว้
    dayKey(start) <= dayKey(today()) ? 0 : settings.bookingDeposit,
    Number(discountAmount) || 0,
  );

  // ---------- สร้างออเดอร์ ----------
  // รับของวันนี้ = กำลังเช่าทันที, จองไว้ล่วงหน้า = อนุมัติแล้วรอรับ
  const isImmediate = dayKey(start) <= dayKey(today());
  const status = isImmediate ? "ACTIVE_RENTAL" : "APPROVED";
  const orderCode = await nextOrderCode(tx);

  const order = await tx.rentalOrder.create({
    data: {
      orderCode,
      userId: customer.id,
      channel: "WALK_IN",
      status,
      startDate: start,
      endDate: end,
      rentalDays: days,
      rentalFee: money.rentalFee,
      discountAmount: money.discountAmount,
      discountNote: discountNote?.trim() || null,
      depositAmount: money.depositAmount,
      gradeAtRequest: customer.grade,
      customerNote: note?.trim() || null,
      approvedById: adminId ?? null,
      approvedAt: new Date(),
      items: {
        create: units.map((u) => ({
          equipmentUnitId: u.id,
          startDate: start,
          endDate: end,
          dailyRate: u.equipment.dailyRate,
          days,
          subtotal: Number(u.equipment.dailyRate) * days,
        })),
      },
    },
  });

  // ของออกจากร้านแล้ว จึงเปลี่ยนสถานะเป็นถูกเช่าทันที
  if (isImmediate) {
    await tx.equipmentUnit.updateMany({
      where: { id: { in: ids } },
      data: { status: "RENTED" },
    });
  }

  await tx.activityLog.create({
    data: {
      type: "ORDER_CREATED",
      message: `เช่าหน้าร้าน ${orderCode} — ${customer.fullName} · ${units.length} ชิ้น ${days} วัน${
        money.discountAmount > 0
          ? ` · ลด ${money.discountAmount.toLocaleString("th-TH")} บาท`
          : ""
      }`,
      actorId: adminId ?? null,
      refType: "RentalOrder",
      refId: order.id,
    },
  });

  return {
    order,
    customer,
    money,
    isNewCustomer: !customerId && customer.createdAt >= new Date(Date.now() - 5000),
    message: `บันทึกการเช่า ${orderCode} เรียบร้อย — ${customer.fullName}`,
  };
}
