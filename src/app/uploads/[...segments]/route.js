import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { UPLOAD_ROOT } from "@/lib/uploads";

/**
 * เสิร์ฟรูปที่ผู้ใช้อัปโหลดจาก data/uploads/ (นอก public/)
 *
 * public/ ใช้ไม่ได้เพราะ `next start` อ่านรายชื่อไฟล์ตอนบูตครั้งเดียว
 * รูปที่เพิ่งอัปโหลดจะขึ้น 404 จนกว่าจะรีสตาร์ท — route handler อ่านดิสก์
 * ตอนมี request จริงจึงเห็นไฟล์ใหม่ทันที ดูคำอธิบายเต็มใน src/lib/uploads.js
 */

// อ่านไฟล์จากดิสก์ทุก request ห้าม prerender เป็น static
export const dynamic = "force-dynamic";

/** ยอมเฉพาะนามสกุลที่ saveImage() เขียนลงดิสก์ได้จริง */
const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(request, { params }) {
  const { segments } = await params;

  // ประกอบ path เองแล้วเช็คว่ายังอยู่ใต้ UPLOAD_ROOT จริง
  // ถึง Next จะถอด ../ ใน URL ให้แล้ว แต่ยังมี %2e%2e และ symlink เล็ดลอดได้
  const relative = path.join(...segments);
  const filePath = path.resolve(UPLOAD_ROOT, relative);

  if (
    filePath !== path.resolve(UPLOAD_ROOT) &&
    !filePath.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!info.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  // แปลง Node stream เป็น Web stream ก่อน เพราะ Response ของ Web API
  // ไม่รับ Readable ของ Node ตรง ๆ
  return new Response(Readable.toWeb(createReadStream(filePath)), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      // ชื่อไฟล์เป็น uuid สุ่มใหม่ทุกครั้งที่อัปโหลด ไฟล์เดิมจึงไม่มีวันเปลี่ยนเนื้อหา
      // แคชยาวได้เต็มที่ ถ้าเปลี่ยนรูป path ก็เปลี่ยนตาม
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
