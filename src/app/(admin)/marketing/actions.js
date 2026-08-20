"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  broadcastPostTx,
  generateDraftForEquipment,
  MarketingError,
  rejectPostTx,
  updatePostTx,
} from "@/lib/marketing";
import { GeminiError } from "@/lib/gemini";
import { requireAdmin } from "@/lib/auth";

/**
 * ตรวจสิทธิ์ซ้ำที่ตัว action ไม่พึ่ง layout อย่างเดียว
 * เพราะ Server Action ถูกเรียกตรงผ่าน HTTP ได้ ไม่ได้ผ่านการเรนเดอร์หน้า
 */
async function currentAdminId() {
  const admin = await requireAdmin();
  return admin.id;
}

function toResult(error) {
  // ทั้งสองชนิดนี้มีข้อความภาษาไทยที่เขียนให้ผู้ใช้อ่านอยู่แล้ว
  if (error instanceof MarketingError || error instanceof GeminiError) {
    return { ok: false, message: error.message, code: error.code };
  }
  console.error("[marketing] ล้มเหลว:", error);
  return { ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
}

/** สั่ง AI ร่างโพสให้อุปกรณ์รุ่นที่เลือก — REQ-AI-002 */
export async function generateDraft(prevState, formData) {
  const equipmentId = Number(formData.get("equipmentId"));
  if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
    return { ok: false, message: "ไม่พบรุ่นอุปกรณ์ที่ระบุ" };
  }

  try {
    const adminId = await currentAdminId();
    const post = await generateDraftForEquipment(prisma, { equipmentId, adminId });
    revalidatePath("/marketing");
    revalidatePath("/dashboard");
    return { ok: true, message: `AI ร่างโพสให้แล้ว: "${post.headline}"` };
  } catch (error) {
    return toResult(error);
  }
}

/** บันทึกเนื้อหาที่แอดมินแก้ไข */
export async function savePost(prevState, formData) {
  const postId = Number(formData.get("postId"));
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "ไม่พบโพสที่ระบุ" };
  }

  try {
    const result = await updatePostTx(prisma, {
      postId,
      headline: String(formData.get("headline") ?? ""),
      caption: String(formData.get("caption") ?? ""),
    });
    revalidatePath("/marketing");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Approve & Broadcast — บันทึกการแก้ไขล่าสุดก่อนเผยแพร่เสมอ
 *
 * เพราะแอดมินมักแก้ข้อความแล้วกดเผยแพร่เลยโดยไม่กดบันทึกก่อน
 * ถ้าไม่รวมสองขั้นตอนนี้ไว้ด้วยกัน สิ่งที่เผยแพร่จะเป็นข้อความก่อนแก้
 */
export async function broadcastPost(prevState, formData) {
  const postId = Number(formData.get("postId"));
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "ไม่พบโพสที่ระบุ" };
  }

  try {
    const adminId = await currentAdminId();
    const headline = formData.get("headline");
    const caption = formData.get("caption");

    const result = await prisma.$transaction(async (tx) => {
      if (headline != null && caption != null) {
        await updatePostTx(tx, {
          postId,
          headline: String(headline),
          caption: String(caption),
        });
      }
      return broadcastPostTx(tx, { postId, adminId });
    });

    revalidatePath("/marketing");
    revalidatePath("/dashboard");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/** ไม่อนุมัติร่างโพส */
export async function rejectPost(prevState, formData) {
  const postId = Number(formData.get("postId"));
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "ไม่พบโพสที่ระบุ" };
  }

  try {
    const adminId = await currentAdminId();
    const result = await rejectPostTx(prisma, { postId, adminId });
    revalidatePath("/marketing");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}
