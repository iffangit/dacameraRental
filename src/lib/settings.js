/**
 * ค่าตั้งค่าระดับร้าน — เจ้าของร้านแก้เองได้ผ่านหน้า /settings
 *
 * แยกกฎออกจาก Server Action เหมือน orders.js และ stock.js เพื่อให้เขียนเทสต์ได้
 */

export class SettingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SettingError";
    this.code = code;
  }
}

/** ใช้เมื่อยังไม่เคยตั้งค่า เพื่อให้ระบบทำงานได้ทันทีหลังติดตั้ง */
export const DEFAULT_SETTINGS = {
  bookingDeposit: 100,
};

/** เพดานกันพิมพ์ผิด — มัดจำจองคิวหลักหมื่นแปลว่ากรอกผิดแน่ ๆ */
const MAX_BOOKING_DEPOSIT = 10_000;

/**
 * อ่านค่าตั้งค่าปัจจุบัน
 * คืนค่าเริ่มต้นถ้ายังไม่มีแถวในตาราง แทนการโยน error
 * เพราะหน้าอื่นทั้งระบบพึ่งค่านี้ ถ้าพังจะพังทั้งแอป
 */
export async function getShopSettings(client) {
  const row = await client.shopSetting.findUnique({ where: { id: 1 } });
  if (!row) return { ...DEFAULT_SETTINGS, isDefault: true };

  return {
    bookingDeposit: Number(row.bookingDeposit),
    updatedAt: row.updatedAt,
    isDefault: false,
  };
}

/** แก้ค่าตั้งค่า — upsert เพราะแถวอาจยังไม่ถูกสร้าง */
export async function updateShopSettingsTx(tx, { bookingDeposit, adminId }) {
  const amount = Number(bookingDeposit);

  if (!Number.isFinite(amount)) {
    throw new SettingError("กรุณากรอกค่ามัดจำเป็นตัวเลข", "NOT_A_NUMBER");
  }
  if (amount < 0) {
    throw new SettingError("ค่ามัดจำติดลบไม่ได้", "NEGATIVE");
  }
  if (amount > MAX_BOOKING_DEPOSIT) {
    throw new SettingError(
      `ค่ามัดจำสูงผิดปกติ (เกิน ${MAX_BOOKING_DEPOSIT.toLocaleString("th-TH")} บาท) — ตรวจสอบว่ากรอกถูกหรือไม่`,
      "TOO_HIGH",
    );
  }

  const rounded = Math.round(amount * 100) / 100;
  const previous = await tx.shopSetting.findUnique({ where: { id: 1 } });

  await tx.shopSetting.upsert({
    where: { id: 1 },
    create: { id: 1, bookingDeposit: rounded, updatedById: adminId ?? null },
    update: { bookingDeposit: rounded, updatedById: adminId ?? null },
  });

  await tx.activityLog.create({
    data: {
      type: "SETTING_CHANGED",
      message: `เปลี่ยนเงินมัดจำจองคิวจาก ${Number(previous?.bookingDeposit ?? DEFAULT_SETTINGS.bookingDeposit).toLocaleString("th-TH")} เป็น ${rounded.toLocaleString("th-TH")} บาทต่อคำขอ`,
      actorId: adminId ?? null,
      refType: "ShopSetting",
      refId: 1,
    },
  });

  return {
    message: `บันทึกแล้ว — เงินมัดจำจองคิวคือ ${rounded.toLocaleString("th-TH")} บาทต่อคำขอ`,
  };
}
