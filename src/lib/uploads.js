import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * จัดการไฟล์รูปที่อัปโหลด — เก็บลงดิสก์ในเครื่องใต้ data/uploads/
 *
 * เลือกเก็บในเครื่องเพราะโปรเจกต์นี้ deploy บน VPS ตัวเดียว ไม่มีค่าใช้จ่าย
 * และไม่ต้องพึ่งบริการภายนอก — แลกกับว่าถ้าย้ายเครื่องต้องก๊อปโฟลเดอร์นี้ไปด้วย
 * และต้องกันไม่ให้ถูกลบตอน deploy ใหม่
 *
 * ทำไมถึงไม่เก็บใน public/uploads ทั้งที่ Next เสิร์ฟ public/ ให้ฟรี:
 * `next start` อ่านรายชื่อไฟล์ใน public/ แค่ตอนบูตครั้งเดียว รูปที่ผู้ใช้
 * เพิ่งอัปโหลดจึงขึ้น 404 จนกว่าจะรีสตาร์ทเซิร์ฟเวอร์ (ตอน next dev ไม่เจอ
 * เพราะ dev server สแกนใหม่ตลอด — บั๊กจะไปโผล่ตอน production เท่านั้น)
 * จึงย้ายออกมานอก public/ แล้วเสิร์ฟผ่าน route handler ที่ src/app/uploads/
 * ซึ่งอ่านดิสก์ตอนมี request จริง
 *
 * path ที่เก็บใน DB ยังเป็น /uploads/... เหมือนเดิม ไม่ต้องแก้ข้อมูลเก่า
 */

export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");

/** ชนิดไฟล์ที่ยอมรับ — ตรวจจาก magic bytes ไม่ใช่แค่ที่เบราว์เซอร์แจ้งมา */
const SIGNATURES = [
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "webp", mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export class UploadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

/**
 * ตรวจว่าเป็นรูปจริงไหมจากไบต์ต้นไฟล์
 *
 * ไม่เชื่อ file.type ที่เบราว์เซอร์ส่งมา เพราะปลอมได้ง่าย
 * ถ้าเชื่ออย่างเดียว คนอัปโหลดสคริปต์แล้วตั้งชื่อ .jpg ก็ผ่านเข้ามาได้
 */
function detectImageType(buffer) {
  return SIGNATURES.find((sig) =>
    sig.bytes.every((byte, i) => buffer[i] === byte),
  );
}

/**
 * บันทึกรูปลงดิสก์ แล้วคืน path สำหรับใช้ใน <img src>
 *
 * @param file    File จาก formData
 * @param folder  โฟลเดอร์ย่อยใต้ uploads เช่น "equipment" หรือ "inspections"
 */
export async function saveImage(file, folder = "misc") {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new UploadError("ไม่พบไฟล์ที่อัปโหลด", "NO_FILE");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB (ไฟล์นี้ ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      "TOO_LARGE",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected) {
    throw new UploadError(
      "รองรับเฉพาะไฟล์รูป JPG, PNG และ WebP เท่านั้น",
      "BAD_TYPE",
    );
  }

  // ชื่อไฟล์สุ่มใหม่เสมอ ไม่ใช้ชื่อเดิมจากผู้ใช้
  // เพราะชื่อไฟล์เป็นช่องทางคลาสสิกของ path traversal (../../etc/passwd)
  // และกันชื่อซ้ำกันเองด้วย
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "") || "misc";
  const fileName = `${randomUUID()}.${detected.ext}`;
  const targetDir = path.join(UPLOAD_ROOT, safeFolder);

  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, fileName), buffer);

  return `/uploads/${safeFolder}/${fileName}`;
}

/**
 * ลบไฟล์เก่าเมื่อถูกแทนที่ — ไม่งั้นดิสก์จะโตขึ้นเรื่อย ๆ ด้วยรูปที่ไม่มีใครใช้
 * เงียบไว้ถ้าลบไม่ได้ เพราะการลบไฟล์เก่าไม่สำเร็จไม่ควรทำให้การบันทึกทั้งหมดล้ม
 */
export async function deleteImage(publicPath) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;

  // ประกอบ path เองจากส่วนที่ตรวจแล้ว ไม่ต่อสตริงดิบจากฐานข้อมูลตรง ๆ
  const relative = publicPath.replace(/^\/uploads\//, "");
  if (relative.includes("..")) return;

  try {
    await unlink(path.join(UPLOAD_ROOT, relative));
  } catch {
    // ไฟล์อาจถูกลบไปแล้วหรือไม่เคยมี — ไม่ใช่เรื่องที่ต้องหยุดงาน
  }
}
