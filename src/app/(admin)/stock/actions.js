"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  addUnitTx,
  changeUnitStatusTx,
  nextSerialFor,
  normaliseCode,
  suggestModelCode,
  updateEquipmentTx,
  StockError,
} from "@/lib/stock";
import { requireAdmin } from "@/lib/auth";
import { deleteImage, saveImage, UploadError } from "@/lib/uploads";

/**
 * ตรวจสิทธิ์ซ้ำที่ตัว action ไม่พึ่ง layout อย่างเดียว
 * เพราะ Server Action ถูกเรียกตรงผ่าน HTTP ได้ ไม่ได้ผ่านการเรนเดอร์หน้า
 */
async function currentAdminId() {
  const admin = await requireAdmin();
  return admin.id;
}

function toResult(error) {
  if (error instanceof StockError || error instanceof UploadError) {
    return { ok: false, message: error.message, code: error.code };
  }
  console.error("[stock] ล้มเหลว:", error);
  return { ok: false, message: "เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่" };
}

function revalidateStockPages() {
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/queue");
}

/** เปลี่ยนสถานะอุปกรณ์รายชิ้น */
export async function changeUnitStatus(prevState, formData) {
  const unitId = Number(formData.get("unitId"));
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!Number.isInteger(unitId) || unitId <= 0) {
    return { ok: false, message: "ไม่พบอุปกรณ์ที่ระบุ" };
  }

  try {
    const adminId = await currentAdminId();
    const result = await prisma.$transaction((tx) =>
      changeUnitStatusTx(tx, { unitId, nextStatus, note, adminId }),
    );
    revalidateStockPages();
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * ขอเลข Serial ถัดไปของรุ่นที่เลือก — ใช้เติมช่องกรอกให้อัตโนมัติ
 * เป็นแค่ข้อเสนอ ยังพิมพ์ทับเองได้ และระบบจะตรวจซ้ำอีกครั้งตอนบันทึกจริง
 */
export async function suggestSerial(equipmentId) {
  await requireAdmin();

  const id = Number(equipmentId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, serial: "" };

  try {
    return { ok: true, serial: await nextSerialFor(prisma, id) };
  } catch {
    return { ok: false, serial: "" };
  }
}

/** เดารหัสรุ่นจากชื่อ + ยี่ห้อ สำหรับตอนเพิ่มรุ่นใหม่ */
export async function suggestCodeForNewModel(name, brand) {
  await requireAdmin();
  return { code: normaliseCode(suggestModelCode(name, brand)) };
}

/** แก้ไขข้อมูลรุ่นอุปกรณ์ รวมถึงค่าเช่าต่อวันและรูปพรีวิว */
export async function updateEquipment(prevState, formData) {
  const equipmentId = Number(formData.get("equipmentId"));
  if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
    return { ok: false, message: "ไม่พบรุ่นอุปกรณ์ที่ระบุ" };
  }

  try {
    const adminId = await currentAdminId();

    // ---- รูปพรีวิว ----
    // อัปโหลดไฟล์ก่อนเข้า transaction เพราะการเขียนดิสก์ย้อนกลับไม่ได้
    // ถ้าเขียนไฟล์ระหว่าง transaction แล้ว transaction ล้ม ไฟล์จะค้างเป็นขยะ
    const current = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { imageUrl: true },
    });

    const file = formData.get("image");
    const removeImage = formData.get("removeImage") === "1";
    let imageUrl = current?.imageUrl ?? null;

    if (removeImage) {
      imageUrl = null;
    } else if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
      imageUrl = await saveImage(file, "equipment");
    }
    const result = await prisma.$transaction((tx) =>
      updateEquipmentTx(tx, {
        adminId,
        equipmentId,
        name: formData.get("name"),
        brandId: formData.get("brandId"),
        categoryId: formData.get("categoryId"),
        dailyRate: formData.get("dailyRate"),
        replacementValue: formData.get("replacementValue"),
        description: formData.get("description"),
        imageUrl,
      }),
    );

    // ลบไฟล์เก่าหลังบันทึกสำเร็จเท่านั้น ถ้าลบก่อนแล้วบันทึกล้ม รูปจะหายฟรี
    if (current?.imageUrl && current.imageUrl !== imageUrl) {
      await deleteImage(current.imageUrl);
    }

    revalidateStockPages();
    revalidatePath("/walkin");
    revalidatePath("/");
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}

/** เพิ่มอุปกรณ์รายชิ้นใหม่ (Serial ใหม่ของรุ่นเดิม หรือรุ่นใหม่ทั้งหมด) */
export async function addUnit(prevState, formData) {
  const mode = String(formData.get("mode") ?? "existing");
  const equipmentId =
    mode === "existing" ? Number(formData.get("equipmentId")) : null;

  if (mode === "existing" && (!Number.isInteger(equipmentId) || equipmentId <= 0)) {
    return { ok: false, message: "กรุณาเลือกรุ่นอุปกรณ์" };
  }

  try {
    const adminId = await currentAdminId();
    const result = await prisma.$transaction((tx) =>
      addUnitTx(tx, {
        adminId,
        equipmentId,
        serialNumber: formData.get("serialNumber"),
        cycleLimit: formData.get("cycleLimit"),
        usageDaysLimit: formData.get("usageDaysLimit"),
        purchasedAt: formData.get("purchasedAt") || null,
        categoryId: Number(formData.get("categoryId")) || null,
        brandId: formData.get("brandId"),
        code: formData.get("code"),
        newEquipmentName: formData.get("newEquipmentName"),
        newDailyRate: formData.get("newDailyRate"),
        newReplacementValue: formData.get("newReplacementValue"),
        newDescription: formData.get("newDescription"),
      }),
    );
    revalidateStockPages();
    return { ok: true, message: result.message };
  } catch (error) {
    return toResult(error);
  }
}
