import { StockError } from "./stock.js";

/**
 * ยี่ห้ออุปกรณ์ — เจ้าของร้านจัดการเองที่หน้าตั้งค่า
 *
 * ตัวย่อ (code) ถูกใช้ขึ้นต้นเลข Serial ของทุกชิ้นในยี่ห้อนั้น
 * จึงห้ามซ้ำ และเปลี่ยนภายหลังไม่ได้ถ้ามีอุปกรณ์ผูกอยู่แล้ว
 * ไม่งั้นเลขบนสติกเกอร์ที่แปะไปแล้วจะไม่ตรงกับระบบ
 */

export const MAX_CODE_LENGTH = 4;

/** เดาตัวย่อจากชื่อยี่ห้อ — 2 ตัวอักษรแรกที่เป็นพยัญชนะ */
export function suggestBrandCode(name) {
  const clean = String(name ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!clean) return "";

  // Sony → SN, Canon → CN : ตัวแรก + พยัญชนะถัดไป อ่านออกว่าเป็นยี่ห้ออะไร
  const consonants = clean.slice(1).replace(/[AEIOU]/g, "");
  return (clean[0] + (consonants[0] ?? clean[1] ?? "")).slice(0, 2);
}

export function normaliseBrandCode(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_CODE_LENGTH);
}

export async function listBrands(client, { includeInactive = true } = {}) {
  const brands = await client.brand.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { equipments: true } } },
  });

  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    isActive: b.isActive,
    equipmentCount: b._count.equipments,
  }));
}

export async function createBrandTx(tx, { name, code, adminId }) {
  const cleanName = String(name ?? "").trim();
  const cleanCode = normaliseBrandCode(code || suggestBrandCode(cleanName));

  if (cleanName.length < 2) {
    throw new StockError("กรุณากรอกชื่อยี่ห้อ", "INVALID_NAME");
  }
  if (cleanCode.length < 2) {
    throw new StockError("ตัวย่อต้องมีอย่างน้อย 2 ตัวอักษร", "INVALID_CODE");
  }

  const dupName = await tx.brand.findUnique({ where: { name: cleanName } });
  if (dupName) throw new StockError(`มียี่ห้อ "${cleanName}" อยู่แล้ว`, "DUPLICATE_NAME");

  const dupCode = await tx.brand.findUnique({ where: { code: cleanCode } });
  if (dupCode) {
    throw new StockError(
      `ตัวย่อ "${cleanCode}" ถูกใช้กับ ${dupCode.name} ไปแล้ว`,
      "DUPLICATE_CODE",
    );
  }

  const brand = await tx.brand.create({
    data: { name: cleanName, code: cleanCode },
  });

  await tx.activityLog.create({
    data: {
      type: "SETTING_CHANGED",
      message: `เพิ่มยี่ห้อ ${cleanName} (ตัวย่อ ${cleanCode})`,
      actorId: adminId ?? null,
      refType: "Brand",
      refId: brand.id,
    },
  });

  return { brand, message: `เพิ่มยี่ห้อ ${cleanName} แล้ว — Serial จะขึ้นต้นด้วย ${cleanCode}-` };
}

export async function updateBrandTx(tx, { brandId, name, code, isActive, adminId }) {
  const brand = await tx.brand.findUnique({
    where: { id: brandId },
    include: { _count: { select: { equipments: true } } },
  });
  if (!brand) throw new StockError("ไม่พบยี่ห้อนี้", "NOT_FOUND");

  const cleanName = String(name ?? "").trim();
  const cleanCode = normaliseBrandCode(code);

  if (cleanName.length < 2) {
    throw new StockError("กรุณากรอกชื่อยี่ห้อ", "INVALID_NAME");
  }
  if (cleanCode.length < 2) {
    throw new StockError("ตัวย่อต้องมีอย่างน้อย 2 ตัวอักษร", "INVALID_CODE");
  }

  // เปลี่ยนตัวย่อทั้งที่มีอุปกรณ์ผูกอยู่ = เลขบนสติกเกอร์กับในระบบจะไม่ตรงกัน
  if (cleanCode !== brand.code && brand._count.equipments > 0) {
    throw new StockError(
      `เปลี่ยนตัวย่อไม่ได้ เพราะมีอุปกรณ์ ${brand._count.equipments} รุ่นใช้ตัวย่อ "${brand.code}" อยู่แล้ว — เลข Serial ที่แปะไว้จะไม่ตรงกับระบบ`,
      "CODE_IN_USE",
    );
  }

  const dupName = await tx.brand.findFirst({
    where: { name: cleanName, id: { not: brandId } },
  });
  if (dupName) throw new StockError(`มียี่ห้อ "${cleanName}" อยู่แล้ว`, "DUPLICATE_NAME");

  const dupCode = await tx.brand.findFirst({
    where: { code: cleanCode, id: { not: brandId } },
  });
  if (dupCode) {
    throw new StockError(
      `ตัวย่อ "${cleanCode}" ถูกใช้กับ ${dupCode.name} ไปแล้ว`,
      "DUPLICATE_CODE",
    );
  }

  await tx.brand.update({
    where: { id: brandId },
    data: { name: cleanName, code: cleanCode, isActive: Boolean(isActive) },
  });

  await tx.activityLog.create({
    data: {
      type: "SETTING_CHANGED",
      message: `แก้ไขยี่ห้อ ${brand.name} → ${cleanName} (${cleanCode})${
        !isActive ? " · ปิดใช้งาน" : ""
      }`,
      actorId: adminId ?? null,
      refType: "Brand",
      refId: brandId,
    },
  });

  return { message: `บันทึกยี่ห้อ ${cleanName} แล้ว` };
}
