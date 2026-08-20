"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decideOrderWithRetry } from "@/lib/orders";
import { requireAdmin } from "@/lib/auth";

/**
 * อนุมัติหรือปฏิเสธคำขอเช่า — REQ-RENT-005
 *
 * Server Action ทำแค่ 3 อย่าง: ตรวจ input, เรียกกฎธุรกิจ, revalidate หน้า
 * ตัวกฎทั้งหมดอยู่ใน src/lib/orders.js เพื่อให้เขียนเทสต์ได้
 * และเรียกซ้ำจากที่อื่นได้ (เช่น LINE bot ใน Roadmap)
 *
 * ทั้งสองปุ่มใช้ action เดียวกัน แยกด้วย formData.decision เพื่อให้หน้าเว็บ
 * มี useActionState ชุดเดียว และสถานะ pending ครอบทั้งสองปุ่ม
 */
export async function decideOrder(prevState, formData) {
  const orderId = Number(formData.get("orderId"));
  const decision = formData.get("decision");
  const adminNote = (formData.get("adminNote") ?? "").toString().trim();

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, message: "ไม่พบรหัสคำขอที่ถูกต้อง" };
  }
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { ok: false, message: "คำสั่งไม่ถูกต้อง" };
  }

  // ตรวจสิทธิ์ซ้ำที่ตัว action ไม่พึ่ง layout อย่างเดียว
  // เพราะ Server Action ถูกเรียกตรงผ่าน HTTP ได้ ไม่ได้ผ่านการเรนเดอร์หน้า
  const admin = await requireAdmin();

  const result = await decideOrderWithRetry(prisma, {
    orderId,
    decision,
    adminNote,
    adminId: admin.id,
  });

  if (result.ok) {
    revalidatePath("/approval");
    revalidatePath("/dashboard");
    revalidatePath("/queue");
  }

  return result;
}
