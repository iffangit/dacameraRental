"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { closeOrderTx, returnItemsTx, ReturnError } from "@/lib/returns";

function toResult(error) {
  if (error instanceof ReturnError) {
    return { ok: false, message: error.message, code: error.code };
  }
  console.error("[returns] ล้มเหลว:", error);
  return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
}

function revalidateAll() {
  revalidatePath("/returns");
  revalidatePath("/dashboard");
  revalidatePath("/queue");
  revalidatePath("/stock");
  revalidatePath("/approval");
}

/**
 * รับคืนอุปกรณ์
 *
 * ฟอร์มส่งมาเป็นชุด: เลือกชิ้นไหนบ้าง (returnItemIds) พร้อมสภาพและหมายเหตุของแต่ละชิ้น
 * (condition-<itemId> / note-<itemId>) เพราะลูกค้าคืนไม่ครบในครั้งเดียวได้
 */
export async function returnItems(prevState, formData) {
  const admin = await requireAdmin();

  const orderId = Number(formData.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, message: "ไม่พบออเดอร์ที่ระบุ" };
  }

  const returns = formData
    .getAll("returnItemIds")
    .map((id) => ({
      itemId: Number(id),
      condition: formData.get(`condition-${id}`),
      note: formData.get(`note-${id}`),
    }))
    .filter((r) => Number.isInteger(r.itemId) && r.itemId > 0);

  try {
    const result = await prisma.$transaction((tx) =>
      returnItemsTx(tx, { orderId, returns, adminId: admin.id }),
    );
    revalidateAll();
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/** ปิดออเดอร์ที่รับคืนครบแล้วแต่ค้างเรื่องค่าเสียหาย */
export async function closeOrder(prevState, formData) {
  const admin = await requireAdmin();

  const orderId = Number(formData.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, message: "ไม่พบออเดอร์ที่ระบุ" };
  }

  try {
    const result = await prisma.$transaction((tx) =>
      closeOrderTx(tx, { orderId, adminId: admin.id }),
    );
    revalidateAll();
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}
