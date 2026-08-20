/**
 * ตรรกะปฏิทินคิวอุปกรณ์ — REQ-RENT-001 / REQ-RENT-002
 *
 * แยกออกจาก React component เพราะหน้า Approval ต้องใช้ตรรกะ
 * "ช่วงเวลาทับซ้อนกันไหม" ตัวเดียวกันนี้ตอนตรวจก่อนอนุมัติคำขอ
 *
 * เรื่องวันที่: คอลัมน์ `@db.Date` ถูกส่งกลับมาเป็น Date ที่เที่ยงคืน UTC
 * จึงใช้สตริง `YYYY-MM-DD` เป็นคีย์เปรียบเทียบตลอด แทนการเทียบ Date object
 * (สตริง ISO เรียงตามตัวอักษร = เรียงตามเวลาพอดี จึงใช้ <= >= ได้ตรง ๆ)
 */

export const DAY_MS = 86_400_000;
export const QUEUE_DAYS = 7;

/** Date → "YYYY-MM-DD" (อิงปฏิทิน UTC ซึ่งตรงกับที่ MySQL เก็บ) */
export function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** สร้าง Date ที่เที่ยงคืน UTC จากวันตามปฏิทินท้องถิ่น */
export function utcDay(year, month, date) {
  return new Date(Date.UTC(year, month, date));
}

/** วันนี้ตามปฏิทินของผู้ใช้ (ไม่ใช่ของ UTC) */
export function today() {
  const now = new Date();
  return utcDay(now.getFullYear(), now.getMonth(), now.getDate());
}

/** แปลง "YYYY-MM-DD" เป็น Date — คืน null ถ้ารูปแบบผิด */
export function parseDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** ไล่วันต่อเนื่อง count วันจาก start */
export function buildDays(start, count = QUEUE_DAYS) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY_MS);
    return { date, key: dayKey(date) };
  });
}

// ------------------------------------------------------------
//  สถานะของช่องในปฏิทิน
// ------------------------------------------------------------

/**
 * สถานะช่องมี 5 แบบ ต่างจากสถานะอุปกรณ์ 4 แบบตรงที่แยก
 * "จองแล้วรออนุมัติ" ออกจาก "ถูกเช่า" — เพราะแอดมินต้องเห็นว่า
 * ช่องนั้นถูกกันไว้ด้วยคำขอที่ยังไม่อนุมัติ ไม่ใช่ของที่ส่งมอบไปแล้ว
 */
/**
 * สีของช่องปฏิทิน — ให้ "พื้น" เป็นตัวบอกสถานะหลัก ไม่ใช่เส้นขอบ
 *
 * ทุกสถานะใช้พื้นสีเต็มเหมือนกันหมด เพื่อให้อ่านตารางได้ด้วยการกวาดสายตา
 * ไม่ต้องเพ่งดูเส้นขอบทีละช่อง
 *
 * RESERVED ใช้ลายทางสีเดียวกับ RENTED เพราะเป็นการจองเหมือนกัน
 * ต่างกันแค่ยังไม่ได้อนุมัติ — ลายทางสื่อว่า "ยังไม่แน่นอน" โดยไม่ต้องเพิ่มสีใหม่
 * ให้จำ ซึ่งจะทำให้ legend อ่านยากขึ้นโดยไม่จำเป็น
 */
export const CELL_STATE = {
  AVAILABLE: {
    label: "ว่าง",
    color: "var(--color-available)",
    fill: "var(--color-available)",
    border: "var(--color-available)",
    text: "white",
  },
  RENTED: {
    label: "ถูกเช่า",
    color: "var(--color-rented)",
    fill: "var(--color-rented)",
    border: "var(--color-rented)",
    text: "white",
  },
  RESERVED: {
    label: "จองแล้ว (รออนุมัติ)",
    color: "var(--color-rented)",
    fill: `repeating-linear-gradient(135deg,
      color-mix(in oklch, var(--color-rented) 30%, white) 0 5px,
      color-mix(in oklch, var(--color-rented) 14%, white) 5px 10px)`,
    border: "color-mix(in oklch, var(--color-rented) 55%, white)",
    text: "color-mix(in oklch, var(--color-rented) 85%, black)",
  },
  MAINTENANCE: {
    label: "ซ่อมบำรุง",
    color: "var(--color-maintenance)",
    fill: "var(--color-maintenance)",
    border: "var(--color-maintenance)",
    text: "white",
  },
  CLEANING: {
    label: "รอทำความสะอาด",
    color: "var(--color-cleaning)",
    fill: "var(--color-cleaning)",
    border: "var(--color-cleaning)",
    text: "white",
  },
};

/** ช่วง [aStart, aEnd] กับ [bStart, bEnd] ทับกันไหม (คีย์เป็นสตริง YYYY-MM-DD) */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

/** หา booking ที่กินวันนั้นของ unit — คืน null ถ้าวันนั้นไม่มีใครจอง */
export function bookingOn(unit, key) {
  return (
    unit.orderItems.find((item) =>
      rangesOverlap(dayKey(item.startDate), dayKey(item.endDate), key, key),
    ) ?? null
  );
}

/**
 * คำนวณสถานะช่อง 1 ช่อง
 *
 * ลำดับความสำคัญ: การจองมาก่อนสถานะของตัวเครื่อง เพราะถ้าอุปกรณ์
 * ถูกส่งซ่อมทั้งที่ยังมีคิวค้างอยู่ แอดมินต้องเห็นคิวนั้นเพื่อไปติดต่อลูกค้า
 * ส่วนสถานะซ่อม/ทำความสะอาดมีผลเฉพาะวันนี้เป็นต้นไป — วันที่ผ่านมาแล้ว
 * ให้แสดงตามประวัติการจองจริง ไม่ใช่ย้อนไปทาสีตามสถานะปัจจุบัน
 */
export function cellStateFor(unit, key, todayKey) {
  const booking = bookingOn(unit, key);

  if (booking) {
    return {
      state: booking.order.status === "PENDING_APPROVAL" ? "RESERVED" : "RENTED",
      booking,
    };
  }

  if (
    key >= todayKey &&
    (unit.status === "MAINTENANCE" || unit.status === "CLEANING")
  ) {
    return { state: unit.status, booking: null };
  }

  return { state: "AVAILABLE", booking: null };
}

/** สร้างตารางทั้งผืน: แถวละ 1 อุปกรณ์ (Serial No.) พร้อมช่องของแต่ละวัน */
export function buildQueueGrid(units, days, todayKey) {
  return units.map((unit) => {
    const cells = days.map((day) => ({
      key: day.key,
      isToday: day.key === todayKey,
      ...cellStateFor(unit, day.key, todayKey),
    }));

    // ทำเครื่องหมายช่องแรกของการจองแต่ละก้อน เพื่อให้เขียนชื่อผู้เช่า
    // แค่ครั้งเดียวต่อการจอง ไม่ใช่ซ้ำทุกช่องจนอ่านไม่ออก
    cells.forEach((cell, i) => {
      const prev = cells[i - 1];
      cell.runStart =
        Boolean(cell.booking) && cell.booking.id !== prev?.booking?.id;
    });

    return { unit, cells };
  });
}

/** นับจำนวนช่องแต่ละสถานะ ใช้ทำแถบสรุปด้านบน */
export function summarise(rows) {
  const counts = { AVAILABLE: 0, RENTED: 0, RESERVED: 0, MAINTENANCE: 0, CLEANING: 0 };
  for (const row of rows) {
    for (const cell of row.cells) counts[cell.state] += 1;
  }
  return counts;
}
