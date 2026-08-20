"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { updateEquipment } from "./actions";
import Modal from "@/components/Modal";
import { withToast } from "@/components/Toast";
import { formatBaht } from "@/lib/domain";

const field =
  "h-8 w-full border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-primary focus:bg-white disabled:opacity-60";
const label =
  "mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase";

/**
 * ตารางรุ่นอุปกรณ์และราคา — REQ-RENT-002 (Update)
 *
 * แยกจากตารางอุปกรณ์รายชิ้นด้านล่าง เพราะเป็นข้อมูลคนละระดับ
 * ราคาและสเปกผูกกับ "รุ่น" ส่วนสถานะและรอบบำรุงรักษาผูกกับ "ตัวเครื่องแต่ละชิ้น"
 * ถ้าเอาปุ่มแก้ราคาไปไว้ในแถวของแต่ละ Serial จะดูเหมือนว่าแก้ได้ทีละชิ้น
 * ทั้งที่จริงแก้แล้วมีผลกับทุกชิ้นของรุ่นนั้น
 */
export default function EquipmentTable({ equipments, categories, brands }) {
  const [editing, setEditing] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [, formAction, pending] = useActionState(
    withToast(updateEquipment, () => setEditing(null)),
    null,
  );

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
        <h3 className="font-head text-[13.5px] font-semibold">รุ่นอุปกรณ์และราคา</h3>
        <span className="text-[11.5px] text-ink-muted">
          {equipments.length} รุ่น · แก้ไขแล้วมีผลกับทุกชิ้นของรุ่นนั้น
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["รุ่น", "หมวดหมู่", "ค่าเช่า/วัน", "มูลค่าทรัพย์สิน", "จำนวนชิ้น", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b border-line bg-canvas px-4 py-2.5 text-left font-head text-[11px] font-semibold tracking-[0.05em] whitespace-nowrap text-ink-muted uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {equipments.map((e) => (
              <tr
                key={e.id}
                className="border-b border-line last:border-b-0 hover:bg-primary-soft/40"
              >
                <td className="px-4 py-2.5">
                  <div className="text-[13px] font-semibold">{e.name}</div>
                  <div className="text-[11px] text-ink-muted">{e.brandName} · Serial ขึ้นต้น {e.brandCode}-{e.code}-</div>
                </td>
                <td className="px-4 py-2.5 text-[13px] whitespace-nowrap">
                  {e.categoryName}
                </td>
                <td className="tnum px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap">
                  {formatBaht(e.dailyRate)}
                </td>
                <td className="tnum px-4 py-2.5 text-[13px] whitespace-nowrap text-ink-muted">
                  {formatBaht(e.replacementValue)}
                </td>
                <td className="tnum px-4 py-2.5 text-[13px]">{e.unitCount}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => { setEditing(e); setRemoveImage(false); }}
                    className="inline-flex h-7 items-center border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
                  >
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `แก้ไขรุ่น ${editing.name}` : ""}
        description="ข้อมูลนี้ใช้ร่วมกันทุกชิ้นของรุ่นนี้"
        width={640}
      >
        {editing && (
          // key บังคับให้ฟอร์มสร้างใหม่เมื่อสลับรุ่น ไม่งั้น defaultValue จะค้างค่าเดิม
          <form action={formAction} key={editing.id}>
            <input type="hidden" name="equipmentId" value={editing.id} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="name">
                  ชื่อรุ่น
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  disabled={pending}
                  defaultValue={editing.name}
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="brandId">
                  ยี่ห้อ
                </label>
                <select
                  id="brandId"
                  name="brandId"
                  required
                  disabled={pending}
                  defaultValue={editing.brandId}
                  className={field}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="categoryId">
                  หมวดหมู่
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  required
                  disabled={pending}
                  defaultValue={editing.categoryId}
                  className={field}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="dailyRate">
                  ค่าเช่าต่อวัน (บาท)
                </label>
                <input
                  id="dailyRate"
                  name="dailyRate"
                  type="number"
                  min="1"
                  required
                  disabled={pending}
                  defaultValue={editing.dailyRate}
                  className={`${field} font-head font-semibold`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="replacementValue">
                  มูลค่าทรัพย์สิน (บาท)
                </label>
                <input
                  id="replacementValue"
                  name="replacementValue"
                  type="number"
                  min="1"
                  required
                  disabled={pending}
                  defaultValue={editing.replacementValue}
                  className={field}
                />
                <p className="mt-1 text-[11px] text-ink-muted">
                  ใช้ประเมินค่าเสียหายตอนรับคืน ไม่ได้ใช้คำนวณเงินมัดจำ
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="image">
                  รูปพรีวิว (ลูกค้าเห็นในหน้าร้าน)
                </label>
                <div className="flex items-start gap-3">
                  {editing.imageUrl && !removeImage && (
                    <Image
                      src={editing.imageUrl}
                      alt={editing.name}
                      width={80}
                      height={80}
                      className="size-20 shrink-0 border border-line object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <input
                      id="image"
                      name="image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending || removeImage}
                      className="w-full text-[12.5px] file:mr-2 file:border file:border-line-strong file:bg-canvas file:px-2.5 file:py-1 file:font-head file:text-[12px]"
                    />
                    <p className="mt-1 text-[11px] text-ink-muted">
                      JPG, PNG หรือ WebP · ไม่เกิน 5 MB
                    </p>
                    {editing.imageUrl && (
                      <label className="mt-1.5 flex items-center gap-1.5 text-[12px]">
                        <input
                          type="checkbox"
                          name="removeImage"
                          value="1"
                          checked={removeImage}
                          onChange={(e) => setRemoveImage(e.target.checked)}
                          disabled={pending}
                          className="size-3.5 accent-[var(--color-primary)]"
                        />
                        ลบรูปนี้ออก
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={label} htmlFor="description">
                  รายละเอียด (ไม่บังคับ)
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  disabled={pending}
                  defaultValue={editing.description ?? ""}
                  placeholder="จุดเด่นของอุปกรณ์ — AI ใช้ข้อมูลนี้ตอนร่างโพสโปรโมชั่นด้วย"
                  className="w-full resize-y border border-line bg-canvas px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>

            <p className="mt-3 border-l-[3px] border-line-strong bg-canvas px-3 py-2 text-[12px] text-ink-muted">
              การเปลี่ยนค่าเช่ามีผลกับ<b>คำขอที่สร้างหลังจากนี้</b>เท่านั้น —
              ออเดอร์เดิมยังใช้ราคาที่บันทึกไว้ตอนทำรายการ บิลเก่าจึงไม่เปลี่ยนตาม
            </p>

            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={pending}
                className="inline-flex h-8 items-center border border-line-strong bg-surface px-3.5 font-head text-[12.5px] hover:border-primary hover:text-primary"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
