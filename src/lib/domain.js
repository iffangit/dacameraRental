/**
 * กฎทางธุรกิจและป้ายกำกับภาษาไทย รวมไว้ที่เดียว
 * เพื่อให้ทุกหน้าอ่านค่าเดียวกัน ไม่ต้องเขียน mapping ซ้ำ
 */

// ------------------------------------------------------------
//  สถานะอุปกรณ์ — REQ-RENT-001
// ------------------------------------------------------------
export const UNIT_STATUS = {
  AVAILABLE: { label: "ว่าง", color: "var(--color-available)", tag: "OK" },
  RENTED: { label: "ถูกเช่า", color: "var(--color-rented)", tag: "RT" },
  MAINTENANCE: {
    label: "ซ่อมบำรุง",
    color: "var(--color-maintenance)",
    tag: "MNT",
  },
  CLEANING: {
    label: "รอทำความสะอาด",
    color: "var(--color-cleaning)",
    tag: "CLN",
  },
  RETIRED: { label: "ปลดระวาง", color: "var(--color-ink-muted)", tag: "OFF" },
};

// ------------------------------------------------------------
//  Workflow ออเดอร์ — REQ-RENT-005
// ------------------------------------------------------------
export const ORDER_STATUS = {
  PENDING_APPROVAL: { label: "รออนุมัติ", color: "var(--color-maintenance)" },
  APPROVED: { label: "อนุมัติแล้ว", color: "var(--color-available)" },
  ACTIVE_RENTAL: { label: "กำลังเช่า", color: "var(--color-rented)" },
  RETURNED_INSPECTED: {
    label: "คืนแล้ว/ตรวจสภาพ",
    color: "var(--color-cleaning)",
  },
  CLOSED: { label: "ปิดออเดอร์", color: "var(--color-ink-muted)" },
  CANCELLED: { label: "ยกเลิก", color: "var(--color-ink-muted)" },
  REJECTED: { label: "ไม่อนุมัติ", color: "var(--color-primary)" },
};

/** สถานะที่ยังกินคิวอยู่ — ใช้เช็ค overlap ตอนกันจองซ้อน */
export const BLOCKING_ORDER_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE_RENTAL",
];

// ------------------------------------------------------------
//  เกรดลูกค้า — REQ-RISK-001
//
//  เกรดมีผลกับ "ลำดับและเงื่อนไขการอนุมัติคิว" เท่านั้น
//  ไม่มีผลกับค่ามัดจำ เพราะร้านเก็บมัดจำจองคิวเท่ากันทุกคน
// ------------------------------------------------------------
export const CUSTOMER_GRADE = {
  A: {
    label: "เกรด A",
    description: "ประวัติดีเยี่ยม — ได้สิทธิ์คิวด่วนและอนุมัติก่อน",
    color: "var(--color-available)",
  },
  B: {
    label: "เกรด B",
    description: "ประวัติปกติ — อนุมัติตามลำดับคิว",
    color: "var(--color-maintenance)",
  },
  C: {
    label: "เกรด C",
    description: "มีประวัติคืนช้าหรือทำของเสียหาย — ควรตรวจสอบก่อนอนุมัติ",
    color: "var(--color-primary)",
  },
};

/**
 * คำนวณค่าเช่าและยอดที่ต้องจ่าย — REQ-RENT-004
 *
 * เงินมัดจำจองคิวเป็นค่าคงที่ต่อ 1 คำขอที่ร้านตั้งเอง (ไม่ใช่ต่อชิ้น
 * ไม่ผูกกับมูลค่าอุปกรณ์ และไม่ผูกกับเกรดลูกค้า) และถูก "หัก" จากค่าเช่า
 * ไม่ใช่บวกเพิ่ม ลูกค้าจึงจ่ายรวมทั้งหมดเท่ากับค่าเช่าพอดี
 *
 * @param {{dailyRate:number}[]} units อุปกรณ์ในออเดอร์
 * @param {number} days จำนวนวันเช่า (inclusive)
 * @param {number} bookingDeposit เงินมัดจำจองคิวจากหน้าตั้งค่าร้าน
 */
export function calculateRental(units, days, bookingDeposit, discountAmount = 0) {
  const rentalFee = units.reduce((sum, u) => sum + u.dailyRate * days, 0);

  // ส่วนลดต้องไม่เกินค่าเช่า ไม่งั้นยอดสุทธิติดลบ (เท่ากับร้านจ่ายเงินให้ลูกค้า)
  const discount = Math.max(0, Math.min(discountAmount, rentalFee));
  const netAmount = rentalFee - discount;

  // มัดจำต้องไม่เกินยอดสุทธิ ไม่งั้นยอดคงเหลือจะติดลบ
  // (เกิดได้จริงถ้าเช่าของถูกวันเดียว เช่น ค่าเช่า 350 แต่ตั้งมัดจำไว้ 500)
  const depositAmount = Math.min(bookingDeposit, netAmount);

  return {
    rentalFee,
    discountAmount: discount,
    netAmount,
    depositAmount,
    balanceDue: netAmount - depositAmount,
  };
}

/** จำนวนวันเช่าแบบนับรวมวันเริ่มและวันคืน */
export function rentalDays(startDate, endDate) {
  const MS_PER_DAY = 86_400_000;
  const start = new Date(startDate).setHours(0, 0, 0, 0);
  const end = new Date(endDate).setHours(0, 0, 0, 0);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

// ------------------------------------------------------------
//  Activity feed — ชนิดเหตุการณ์ → ป้าย + สี
// ------------------------------------------------------------
export const ACTIVITY_STYLE = {
  ORDER_CREATED: { tag: "NEW", color: "var(--color-primary)" },
  ORDER_APPROVED: { tag: "PA", color: "var(--color-available)" },
  ORDER_REJECTED: { tag: "PA", color: "var(--color-primary)" },
  ORDER_RETURNED: { tag: "OK", color: "var(--color-available)" },
  UNIT_MAINTENANCE: { tag: "MNT", color: "var(--color-maintenance)" },
  INSPECTION_LOGGED: { tag: "IMG", color: "var(--color-cleaning)" },
  AI_POST_GENERATED: { tag: "AI", color: "var(--color-cleaning)" },
  AI_POST_BROADCAST: { tag: "AI", color: "var(--color-available)" },
  SETTING_CHANGED: { tag: "SET", color: "var(--color-cleaning)" },
};

// ------------------------------------------------------------
//  Formatters (ไทย + พ.ศ.)
// ------------------------------------------------------------
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** 16 ส.ค. 69 */
export function formatThaiDate(date) {
  const d = new Date(date);
  const year = (d.getFullYear() + 543) % 100;
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${String(year).padStart(2, "0")}`;
}

/** 09:42 น. */
export function formatThaiTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} น.`;
}

/** ฿184,500 */
export function formatBaht(amount) {
  return `฿${Number(amount).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}
