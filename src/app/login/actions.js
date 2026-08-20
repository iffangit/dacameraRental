"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

/**
 * เข้าสู่ระบบ — SRS §4.2 Security
 *
 * ข้อความผิดพลาดจงใจไม่บอกว่า "ไม่พบอีเมลนี้" หรือ "รหัสผ่านผิด" แยกกัน
 * เพราะการแยกจะทำให้คนภายนอกไล่เดาได้ว่าอีเมลไหนมีในระบบบ้าง (user enumeration)
 */
export async function login(prevState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { ok: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // เรียก verify แม้ไม่พบผู้ใช้ เพื่อให้เวลาตอบกลับใกล้เคียงกันทั้งสองกรณี
  // ไม่งั้นผู้โจมตีจับเวลาแล้วรู้ได้ว่าอีเมลไหนมีอยู่จริง (timing attack)
  const dummyHash = "$2b$10$1234567890123456789012345678901234567890123456789012";
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !valid) {
    return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  if (user.isSuspended) {
    return {
      ok: false,
      message: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อร้าน",
    };
  }

  await createSession(user);

  // ส่งกลับไปหน้าที่ตั้งใจจะเข้าตอนแรก แต่ต้องเป็นเส้นทางภายในเท่านั้น
  // ป้องกัน open redirect ไปเว็บนอก
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(safeNext ?? (user.role === "ADMIN" ? "/dashboard" : "/me"));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
