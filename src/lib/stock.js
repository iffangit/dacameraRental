import { BLOCKING_ORDER_STATUSES } from "./domain.js";
import { today } from "./queue.js";

/**
 * กฎการจัดการสต็อกรายชิ้น — REQ-RENT-002 / REQ-RISK-003
 * แยกจาก Server Action ด้วยเหตุผลเดียวกับ orders.js คือให้เขียนเทสต์ได้
 */

export class StockError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "StockError";
    this.code = code;
  }
}

// ------------------------------------------------------------
//  เลข Serial Number — รูปแบบ SN-<รหัสรุ่น>-<ลำดับ 3 หลัก>
// ------------------------------------------------------------

/**
 * คำที่ไม่ช่วยแยกแยะรุ่น ตัดออกได้
 * เก็บ RF ไว้เพราะเป็นชื่อเมาท์ที่คนเรียกติดปาก (RF50) ต่างจาก EOS/FE ที่ตัดได้
 */
const NOISE_WORDS = /\b(EOS|FE|PRO|USM|MARK)\b/gi;
/** "24-70mm" → "24-70" — หน่วยไม่ได้ใช้แยกรุ่น */
const MILLIMETRE = /(\d)\s*mm\b/gi;
/** รูรับแสงอย่าง f/2.8 หรือ f1.2L ไม่ได้ใช้แยกรุ่น */
const APERTURE = /f\/?\d+(\.\d+)?L?/gi;
const ROMAN = { IV: "4", III: "3", II: "2", I: "1" };

/**
 * เดารหัสรุ่นจากชื่อ — ใช้เป็น "ข้อเสนอ" เท่านั้น แอดมินแก้ได้เสมอ
 *
 * ไม่พยายามทำให้ฉลาดเกินไป เพราะรหัสที่ร้านใช้จริงมาจากการย่อแบบมนุษย์
 * (Canon EOS R6 Mark II → R6M2) ซึ่งอัลกอริทึมเดาให้ตรงทุกเคสไม่ได้
 * หน้าที่ของมันคือกรอกให้ 80% แล้วให้คนแก้ที่เหลือ
 */
export function suggestModelCode(name, brand = "") {
  let text = String(name ?? "");

  // ตัดชื่อยี่ห้อออก เพราะรหัสรุ่นไม่ควรซ้ำกับข้อมูลที่มีอยู่แล้วในระบบ
  if (brand) {
    text = text.replace(new RegExp(`\\b${brand}\\b`, "gi"), " ");
  }

  // "Mark II" → M2 (ย่อแบบที่ร้านใช้จริง) แต่เลขโรมันที่ยืนเดี่ยว ๆ เก็บไว้ตามเดิม
  // เพราะ "Z6 III" คนอ่านออกว่า Z6III ส่วน "Z63" อ่านไม่ออกว่าคือรุ่นไหน
  text = text.replace(/Mark\s+([IVX]+)/gi, (_, r) => `M${ROMAN[r.toUpperCase()] ?? r}`);
  text = text.replace(APERTURE, " ");
  text = text.replace(MILLIMETRE, "$1");
  text = text.replace(NOISE_WORDS, " ");
  text = text.replace(/[^a-zA-Z0-9]/g, "");

  // "AD200Pro" เขียนติดกันจึงไม่โดนตัดตอนกรองคำ — ตัดหางทิ้งอีกรอบ
  text = text.replace(/PRO$/i, "");

  return text.toUpperCase().slice(0, 12) || "MODEL";
}

/** ทำให้รหัสอยู่ในรูปที่ใช้กับ serial ได้ */
export function normaliseCode(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

/** ประกอบ prefix ของ Serial — <ย่อแบรนด์>-<ย่อรุ่น>- */
export function serialPrefix(brandCode, modelCode) {
  return `${normaliseCode(brandCode)}-${normaliseCode(modelCode)}-`;
}

/**
 * หาเลข Serial ถัดไปของรุ่นนี้
 *
 * นับจากเลขสูงสุดที่เคยใช้ ไม่ใช่จำนวนชิ้นที่มีอยู่ เพราะถ้าเคยปลดระวางไปแล้ว
 * การนับจำนวนจะให้เลขที่ถูกใช้ไปแล้ว แล้วชนกับ unique constraint
 */
export async function nextSerialFor(client, equipmentId) {
  const equipment = await client.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      name: true,
      code: true,
      brand: { select: { name: true, code: true } },
    },
  });
  if (!equipment) throw new StockError("ไม่พบรุ่นอุปกรณ์นี้", "NOT_FOUND");

  const modelCode =
    equipment.code ||
    normaliseCode(suggestModelCode(equipment.name, equipment.brand.name));
  const prefix = serialPrefix(equipment.brand.code, modelCode);

  const units = await client.equipmentUnit.findMany({
    where: { serialNumber: { startsWith: prefix } },
    select: { serialNumber: true },
  });

  const highest = units.reduce((max, u) => {
    const n = Number(u.serialNumber.slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

/**
 * สถานะที่แอดมินตั้งเองได้
 *
 * ไม่มี RENTED เพราะสถานะนั้นต้องมาจากการมีออเดอร์จริงเท่านั้น
 * ถ้าปล่อยให้กดตั้งเองได้ ตัวเลขในระบบจะเพี้ยนจากคิวจริงทันที
 */
export const MANUAL_UNIT_STATUSES = [
  "AVAILABLE",
  "CLEANING",
  "MAINTENANCE",
  "RETIRED",
];

/** คิวที่ยังไม่จบของอุปกรณ์ชิ้นนี้ (วันนี้เป็นต้นไป) */
export async function upcomingBookings(client, unitId) {
  return client.rentalOrderItem.findMany({
    where: {
      equipmentUnitId: unitId,
      endDate: { gte: today() },
      order: { status: { in: BLOCKING_ORDER_STATUSES } },
    },
    orderBy: { startDate: "asc" },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
          customer: { select: { fullName: true } },
        },
      },
    },
  });
}

/**
 * เปลี่ยนสถานะอุปกรณ์รายชิ้น
 *
 * เมื่อปิดงานซ่อม/ทำความสะอาด (กลับมา AVAILABLE) ระบบจะรีเซ็ตตัวนับรอบ
 * เพราะตัวนับมีไว้ตอบคำถามว่า "ใช้งานมากี่รอบตั้งแต่บำรุงรักษาครั้งล่าสุด"
 * ถ้าไม่รีเซ็ต อุปกรณ์จะค้างสถานะครบเกณฑ์ตลอดไปและถูกดึงออกจากคิวซ้ำ ๆ
 */
export async function changeUnitStatusTx(tx, { unitId, nextStatus, note, adminId }) {
  if (!MANUAL_UNIT_STATUSES.includes(nextStatus)) {
    throw new StockError(
      "สถานะ 'ถูกเช่า' ตั้งเองไม่ได้ ต้องเกิดจากการอนุมัติคำขอเช่าเท่านั้น",
      "STATUS_NOT_MANUAL",
    );
  }

  const unit = await tx.equipmentUnit.findUnique({
    where: { id: unitId },
    include: { equipment: { select: { name: true } } },
  });

  if (!unit) throw new StockError("ไม่พบอุปกรณ์ชิ้นนี้", "NOT_FOUND");
  if (unit.status === nextStatus) {
    throw new StockError("อุปกรณ์อยู่ในสถานะนี้อยู่แล้ว", "NO_CHANGE");
  }

  const pending = await upcomingBookings(tx, unitId);

  // ปลดระวางของที่ยังมีคิวค้างไม่ได้ ลูกค้าจองไว้แล้ว
  if (nextStatus === "RETIRED" && pending.length > 0) {
    const detail = pending
      .map((p) => `${p.order.orderCode} (${p.order.customer.fullName})`)
      .join(", ");
    throw new StockError(
      `ปลดระวางไม่ได้ เพราะยังมีคิวค้างอยู่: ${detail} — ต้องยกเลิกคำขอเหล่านี้ก่อน`,
      "HAS_UPCOMING_BOOKINGS",
    );
  }

  // ของที่กำลังถูกเช่าอยู่ ยังส่งซ่อมไม่ได้ ต้องรับคืนก่อน
  if (unit.status === "RENTED" && nextStatus !== "AVAILABLE") {
    throw new StockError(
      "อุปกรณ์กำลังถูกเช่าอยู่ ต้องรับคืนก่อนจึงจะเปลี่ยนสถานะได้",
      "CURRENTLY_RENTED",
    );
  }

  const closingMaintenance =
    ["MAINTENANCE", "CLEANING"].includes(unit.status) &&
    nextStatus === "AVAILABLE";

  await tx.equipmentUnit.update({
    where: { id: unitId },
    data: {
      status: nextStatus,
      isActive: nextStatus !== "RETIRED",
      ...(closingMaintenance ? { rentalCount: 0, totalDaysUsed: 0 } : {}),
      ...(note ? { notes: note } : {}),
    },
  });

  // ปิดใบงานบำรุงรักษาที่ยังค้างอยู่
  if (closingMaintenance) {
    await tx.maintenanceRecord.updateMany({
      where: { equipmentUnitId: unitId, completedAt: null },
      data: { completedAt: new Date(), note: note || undefined },
    });
  }

  // เปิดใบงานใหม่เมื่อส่งซ่อม/ส่งทำความสะอาด
  if (["MAINTENANCE", "CLEANING"].includes(nextStatus)) {
    await tx.maintenanceRecord.create({
      data: {
        equipmentUnitId: unitId,
        reason: nextStatus === "CLEANING" ? "ROUTINE_CLEANING" : "MANUAL",
        isAutomatic: false,
        note: note || null,
      },
    });
  }

  await tx.activityLog.create({
    data: {
      type: "UNIT_MAINTENANCE",
      message: `เปลี่ยนสถานะ ${unit.equipment.name} (${unit.serialNumber}) เป็น ${STATUS_LABEL[nextStatus]}${
        closingMaintenance ? " และรีเซ็ตตัวนับรอบบำรุงรักษา" : ""
      }${note ? ` — ${note}` : ""}`,
      actorId: adminId ?? null,
      refType: "EquipmentUnit",
      refId: unitId,
    },
  });

  return {
    message: `อัปเดต ${unit.serialNumber} เป็น "${STATUS_LABEL[nextStatus]}" แล้ว`,
  };
}

const STATUS_LABEL = {
  AVAILABLE: "ว่าง",
  CLEANING: "รอทำความสะอาด",
  MAINTENANCE: "ซ่อมบำรุง",
  RETIRED: "ปลดระวาง",
};

/**
 * แก้ไขข้อมูลรุ่นอุปกรณ์ — REQ-RENT-002 (Update)
 *
 * การเปลี่ยนค่าเช่ามีผลกับ "คำขอที่สร้างหลังจากนี้" เท่านั้น
 * ออเดอร์เดิมไม่กระทบ เพราะราคาถูก snapshot ไว้ที่ RentalOrderItem.dailyRate
 * ตั้งแต่ตอนสร้างคำขอแล้ว — ถ้าย้อนไปเปลี่ยนด้วย บิลเก่าที่ลูกค้าจ่ายไปแล้วจะเพี้ยน
 */
export async function updateEquipmentTx(tx, input) {
  const equipmentId = Number(input.equipmentId);

  const equipment = await tx.equipment.findUnique({
    where: { id: equipmentId },
    include: { _count: { select: { units: true } } },
  });
  if (!equipment) throw new StockError("ไม่พบรุ่นอุปกรณ์นี้", "NOT_FOUND");

  const name = (input.name ?? "").trim();
  const brandId = Number(input.brandId);
  const categoryId = Number(input.categoryId);
  const dailyRate = Number(input.dailyRate);
  const replacementValue = Number(input.replacementValue);

  if (name.length < 2) {
    throw new StockError("กรุณากรอกชื่อรุ่น", "INVALID_NAME");
  }
  if (!Number.isInteger(brandId) || brandId <= 0) {
    throw new StockError("กรุณาเลือกยี่ห้อ", "INVALID_BRAND");
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new StockError("กรุณาเลือกหมวดหมู่", "INVALID_CATEGORY");
  }
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    throw new StockError("ค่าเช่าต่อวันต้องมากกว่า 0", "INVALID_RATE");
  }
  if (!Number.isFinite(replacementValue) || replacementValue <= 0) {
    throw new StockError("มูลค่าทรัพย์สินต้องมากกว่า 0", "INVALID_VALUE");
  }

  // ชื่อรุ่นซ้ำกับรุ่นอื่นทำให้พนักงานหยิบผิดตัวตอนทำรายการหน้าร้าน
  const duplicate = await tx.equipment.findFirst({
    where: { name, id: { not: equipmentId } },
  });
  if (duplicate) {
    throw new StockError(`มีรุ่นชื่อ "${name}" อยู่แล้วในระบบ`, "DUPLICATE_NAME");
  }

  const oldRate = Number(equipment.dailyRate);
  const rateChanged = oldRate !== dailyRate;

  await tx.equipment.update({
    where: { id: equipmentId },
    data: {
      name,
      brandId,
      categoryId,
      dailyRate,
      replacementValue,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl ?? null,
    },
  });

  await tx.activityLog.create({
    data: {
      type: "SETTING_CHANGED",
      message: rateChanged
        ? `แก้ไขรุ่น ${equipment.name} — เปลี่ยนค่าเช่าจาก ${oldRate.toLocaleString("th-TH")} เป็น ${dailyRate.toLocaleString("th-TH")} บาท/วัน`
        : `แก้ไขข้อมูลรุ่น ${equipment.name}`,
      actorId: input.adminId ?? null,
      refType: "Equipment",
      refId: equipmentId,
    },
  });

  return {
    message: rateChanged
      ? `บันทึกแล้ว — ค่าเช่า ${name} เปลี่ยนเป็น ${dailyRate.toLocaleString("th-TH")} บาท/วัน (มีผลกับคำขอใหม่เท่านั้น)`
      : `บันทึกข้อมูล ${name} เรียบร้อย`,
  };
}

/**
 * เพิ่มอุปกรณ์รายชิ้นใหม่ — REQ-RENT-002
 * รองรับทั้งการเพิ่ม Serial ให้รุ่นที่มีอยู่ และการสร้างรุ่นใหม่พร้อม Serial แรก
 */
export async function addUnitTx(tx, input) {
  let equipmentId = input.equipmentId;

  // สร้างรุ่นใหม่ถ้าไม่ได้เลือกรุ่นที่มีอยู่
  if (!equipmentId) {
    const name = (input.newEquipmentName ?? "").trim();
    const brandId = Number(input.brandId);
    const dailyRate = Number(input.newDailyRate);
    const replacementValue = Number(input.newReplacementValue);

    if (!name) {
      throw new StockError("กรุณากรอกชื่อรุ่น", "INVALID_EQUIPMENT");
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      throw new StockError("กรุณาเลือกยี่ห้อ", "INVALID_BRAND");
    }

    const brandRow = await tx.brand.findUnique({ where: { id: brandId } });
    if (!brandRow || !brandRow.isActive) {
      throw new StockError("ไม่พบยี่ห้อที่เลือก หรือถูกปิดใช้งานแล้ว", "BRAND_NOT_FOUND");
    }
    const brand = brandRow.name;
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
      throw new StockError("ค่าเช่าต่อวันต้องมากกว่า 0", "INVALID_RATE");
    }
    if (!Number.isFinite(replacementValue) || replacementValue <= 0) {
      throw new StockError("มูลค่าทรัพย์สินต้องมากกว่า 0", "INVALID_VALUE");
    }
    if (!input.categoryId) {
      throw new StockError("กรุณาเลือกหมวดหมู่", "INVALID_CATEGORY");
    }

    // รหัสรุ่นใช้ประกอบเลข Serial — ถ้าไม่ได้กรอกมาให้เดาจากชื่อ
    const code = normaliseCode(input.code || suggestModelCode(name, brand));
    const codeTaken = await tx.equipment.findFirst({ where: { code } });
    if (codeTaken) {
      throw new StockError(
        `รหัสรุ่น "${code}" ถูกใช้กับ ${codeTaken.name} ไปแล้ว — กรุณาตั้งรหัสอื่น`,
        "DUPLICATE_CODE",
      );
    }

    const created = await tx.equipment.create({
      data: {
        name,
        brandId,
        code,
        categoryId: input.categoryId,
        dailyRate,
        replacementValue,
        description: input.newDescription?.trim() || null,
      },
    });
    equipmentId = created.id;
  }

  const equipment = await tx.equipment.findUnique({
    where: { id: equipmentId },
    select: { name: true },
  });
  if (!equipment) throw new StockError("ไม่พบรุ่นอุปกรณ์ที่เลือก", "EQUIPMENT_NOT_FOUND");

  // เว้นว่างไว้ = ให้ระบบเจนต่อจากเลขล่าสุดของรุ่นนี้
  const serialNumber = (input.serialNumber ?? "").trim()
    ? (input.serialNumber ?? "").trim().toUpperCase()
    : await nextSerialFor(tx, equipmentId);

  if (serialNumber.length < 3) {
    throw new StockError("Serial Number สั้นเกินไป (อย่างน้อย 3 ตัวอักษร)", "INVALID_SERIAL");
  }

  const duplicate = await tx.equipmentUnit.findUnique({
    where: { serialNumber },
    include: { equipment: { select: { name: true } } },
  });
  if (duplicate) {
    throw new StockError(
      `Serial Number "${serialNumber}" ถูกใช้กับ ${duplicate.equipment.name} ไปแล้ว`,
      "DUPLICATE_SERIAL",
    );
  }

  const unit = await tx.equipmentUnit.create({
    data: {
      equipmentId,
      serialNumber,
      status: "AVAILABLE",
      cycleLimit: Number(input.cycleLimit) || 10,
      usageDaysLimit: Number(input.usageDaysLimit) || 50,
      purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
    },
  });

  await tx.activityLog.create({
    data: {
      type: "UNIT_MAINTENANCE",
      message: `เพิ่มอุปกรณ์ใหม่ ${equipment.name} (${serialNumber}) เข้าสต็อก`,
      actorId: input.adminId ?? null,
      refType: "EquipmentUnit",
      refId: unit.id,
    },
  });

  return { message: `เพิ่ม ${equipment.name} (${serialNumber}) เข้าสต็อกแล้ว`, unitId: unit.id };
}
