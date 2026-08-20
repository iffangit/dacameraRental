"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createWalkInOrderTx, WalkInError } from "@/lib/walkin";

/** เลขที่ออเดอร์อาจชนกันได้ถ้าสองเครื่องกดพร้อมกัน — ลองใหม่สั้น ๆ */
const RETRYABLE = /Unique constraint|orderCode|deadlock|lock wait timeout/i;
const MAX_ATTEMPTS = 3;

export async function createWalkIn(prevState, formData) {
  const admin = await requireAdmin();

  const payload = {
    customerId: Number(formData.get("customerId")) || null,
    guestName: formData.get("guestName"),
    guestPhone: formData.get("guestPhone"),
    unitIds: formData.getAll("unitIds"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    discountAmount: formData.get("discountAmount"),
    discountNote: formData.get("discountNote"),
    note: formData.get("note"),
    adminId: admin.id,
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction((tx) =>
        createWalkInOrderTx(tx, payload),
      );

      revalidatePath("/walkin");
      revalidatePath("/dashboard");
      revalidatePath("/queue");
      revalidatePath("/stock");

      return {
        ok: true,
        message: result.message,
        orderCode: result.order.orderCode,
        summary: {
          customer: result.customer.fullName,
          items: payload.unitIds.length,
          ...result.money,
        },
      };
    } catch (error) {
      // กฎธุรกิจปฏิเสธ = คำตอบสุดท้าย
      if (error instanceof WalkInError) {
        return { ok: false, message: error.message, code: error.code };
      }

      const retryable = RETRYABLE.test(error?.message ?? "");
      if (!retryable || attempt === MAX_ATTEMPTS) {
        console.error("[walkin] ล้มเหลว:", error);
        return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 80));
    }
  }
}
