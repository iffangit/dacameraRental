"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SettingError, updateShopSettingsTx } from "@/lib/settings";
import { createBrandTx, updateBrandTx } from "@/lib/brands";
import { StockError } from "@/lib/stock";

function toResult(error) {
  if (error instanceof SettingError || error instanceof StockError) {
    return { ok: false, message: error.message, code: error.code };
  }
  console.error("[settings] ล้มเหลว:", error);
  return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
}

/** เพิ่มยี่ห้อใหม่ */
export async function createBrand(prevState, formData) {
  const admin = await requireAdmin();
  try {
    const result = await prisma.$transaction((tx) =>
      createBrandTx(tx, {
        name: formData.get("name"),
        code: formData.get("code"),
        adminId: admin.id,
      }),
    );
    revalidatePath("/settings");
    revalidatePath("/stock");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/** แก้ไขยี่ห้อ (ชื่อ / ตัวย่อ / เปิด-ปิดใช้งาน) */
export async function updateBrand(prevState, formData) {
  const admin = await requireAdmin();
  const brandId = Number(formData.get("brandId"));
  if (!Number.isInteger(brandId) || brandId <= 0) {
    return { ok: false, message: "ไม่พบยี่ห้อที่ระบุ" };
  }

  try {
    const result = await prisma.$transaction((tx) =>
      updateBrandTx(tx, {
        brandId,
        name: formData.get("name"),
        code: formData.get("code"),
        isActive: formData.get("isActive") === "on",
        adminId: admin.id,
      }),
    );
    revalidatePath("/settings");
    revalidatePath("/stock");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateSettings(prevState, formData) {
  // ตรวจสิทธิ์ที่ตัว action เอง ไม่พึ่ง layout
  // เพราะ Server Action ถูกยิงตรงผ่าน HTTP ได้โดยไม่ผ่านการเรนเดอร์หน้า
  const admin = await requireAdmin();

  try {
    const result = await prisma.$transaction((tx) =>
      updateShopSettingsTx(tx, {
        bookingDeposit: formData.get("bookingDeposit"),
        adminId: admin.id,
      }),
    );

    revalidatePath("/settings");
    revalidatePath("/approval");
    revalidatePath("/dashboard");

    return { ok: true, message: result.message };
  } catch (error) {
    if (error instanceof SettingError) {
      return { ok: false, message: error.message, code: error.code };
    }
    console.error("[settings] ล้มเหลว:", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
}
