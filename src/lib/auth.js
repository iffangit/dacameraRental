import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

/**
 * ระบบยืนยันตัวตนและสิทธิ์ — SRS §2 User Roles & Access Matrix
 *
 * เก็บ session ไว้ใน cookie ที่เซ็นด้วย JWT แทนการเก็บตารางใน DB
 * เพราะระบบนี้ผู้ใช้ไม่เยอะ และการอ่าน session ทุก request โดยไม่ต้อง
 * query DB ช่วยให้เข้าเกณฑ์ NFR Performance (หน้าตารางคิว < 2 วินาที)
 *
 * ไฟล์นี้มี "server-only" กำกับไว้ เพื่อให้ build พังทันทีถ้ามีใคร
 * เผลอ import จาก Client Component — ป้องกัน secret หลุดไปฝั่งเบราว์เซอร์
 */

const COOKIE_NAME = "dacamera_session";
const SESSION_DAYS = 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ในไฟล์ .env ต้องมีอย่างน้อย 32 ตัวอักษร — สร้างด้วย: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  return new TextEncoder().encode(secret);
}

// ------------------------------------------------------------
//  รหัสผ่าน — SRS §4.2 (bcrypt)
// ------------------------------------------------------------

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ------------------------------------------------------------
//  Session
// ------------------------------------------------------------

/** ออก token แล้วเซ็ตลง cookie */
export async function createSession(user) {
  const token = await new SignJWT({
    uid: user.id,
    role: user.role,
    name: user.fullName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true, // JS ฝั่งเบราว์เซอร์อ่านไม่ได้ กัน XSS ขโมย session
    sameSite: "lax", // กัน CSRF ขั้นพื้นฐาน แต่ยังกดลิงก์จากภายนอกเข้ามาได้
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * อ่าน session ปัจจุบัน — คืน null ถ้าไม่ได้ล็อกอินหรือ token ใช้ไม่ได้
 *
 * ยืนยันข้อมูลกับฐานข้อมูลอีกชั้นเสมอ เพราะ token มีอายุ 7 วัน
 * ถ้าระหว่างนั้นแอดมินโดนถอดสิทธิ์หรือถูกระงับบัญชี
 * ข้อมูลใน token จะเก่าและให้สิทธิ์เกินจริง
 */
export async function getSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey()));
  } catch {
    return null; // หมดอายุ ถูกแก้ไข หรือ secret เปลี่ยน
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      grade: true,
      isSuspended: true,
    },
  });

  if (!user || user.isSuspended) return null;
  return user;
}

// ------------------------------------------------------------
//  การ์ดสิทธิ์
// ------------------------------------------------------------

/** บังคับว่าต้องล็อกอินแล้ว — ถ้าไม่ ส่งไปหน้า login พร้อมจำปลายทางไว้ */
export async function requireUser(returnTo) {
  const user = await getSession();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

/** บังคับว่าต้องเป็นแอดมิน — ใช้กับทุกหน้าในกลุ่ม (admin) */
export async function requireAdmin(returnTo) {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") {
    redirect("/login?error=forbidden");
  }
  return user;
}
