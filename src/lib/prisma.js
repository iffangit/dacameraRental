import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Prisma 7 ต่อ DB ผ่าน driver adapter แทนการอ่าน url จาก schema.prisma
 *
 * แปลง DATABASE_URL เป็น PoolConfig เองแทนการส่ง string ตรง ๆ
 * เพราะ driver ของ mariadb คาดหวัง scheme `mariadb://` ส่วนเราเขียน `mysql://`
 * ตามมาตรฐาน Prisma — แปลงเองจึงรองรับทั้งสองแบบและอ่านง่ายกว่า
 */
function poolConfigFromUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error(
      "ไม่พบ DATABASE_URL — ตรวจสอบไฟล์ .env ที่ root ของโปรเจกต์",
    );
  }

  const url = new URL(rawUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    // เพดาน connection ของ dev server — กัน hot reload เปิด connection ค้าง
    connectionLimit: 5,
    // ไม่ตั้ง timezone เป็นชื่อโซน IANA เพราะ MariaDB ของ XAMPP
    // ยังไม่ได้โหลดตาราง tz (mysql_tzinfo_to_sql) — ใช้เวลาท้องถิ่นของเซิร์ฟเวอร์แทน
  };
}

const adapter = new PrismaMariaDb(poolConfigFromUrl(process.env.DATABASE_URL));

/**
 * Next.js dev mode รีโหลดโมดูลทุกครั้งที่แก้ไฟล์
 * ถ้าสร้าง PrismaClient ใหม่ทุกรอบจะเปิด connection pool ทิ้งไว้จนเต็ม
 * จึงเก็บ instance ไว้บน globalThis เฉพาะตอน dev
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
