"use client";

import { useActionState, useState, useTransition } from "react";
import { addUnit, suggestSerial } from "./actions";
import Modal from "@/components/Modal";
import { withToast } from "@/components/Toast";
import { normaliseCode, suggestModelCode } from "@/lib/stock";

const field =
  "h-8 w-full border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-primary focus:bg-white disabled:opacity-60";
const label =
  "mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase";

/**
 * ฟอร์มเพิ่มอุปกรณ์ — REQ-RENT-002
 *
 * อยู่ใน modal เพราะเป็นงานที่ทำเป็นครั้งคราว ไม่ใช่งานประจำวัน
 * ถ้าแปะไว้บนหน้าตลอดเวลาจะเบียดพื้นที่ของตารางสต็อกซึ่งเป็นสิ่งที่ต้องดูทุกวัน
 *
 * รองรับสองโหมดในฟอร์มเดียว เพราะงานจริงมีทั้ง "ซื้อตัวที่สองของรุ่นเดิม"
 * (พบบ่อยที่สุด) และ "ซื้อรุ่นที่ร้านยังไม่เคยมี"
 */
export default function AddUnitPanel({ equipments, categories, brands }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("existing");

  // ---- สถานะสำหรับเจนเลข Serial ----
  const [serial, setSerial] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [newName, setNewName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [loadingSerial, startLoadingSerial] = useTransition();

  function resetForm() {
    setSerial("");
    setCode("");
    setCodeEdited(false);
    setNewName("");
    setBrandId("");
  }

  // ปิดกล่องเมื่อบันทึกสำเร็จ (ล้มเหลวให้เปิดค้างไว้เพื่อแก้ข้อมูลต่อ)
  const [, formAction, pending] = useActionState(
    withToast(addUnit, () => {
      setOpen(false);
      resetForm();
    }),
    null,
  );

  /** เลือกรุ่นเดิม → ขอเลขถัดไปจาก server เพราะต้องรู้เลขล่าสุดในฐานข้อมูล */
  function pickEquipment(equipmentId) {
    if (!equipmentId) return setSerial("");
    startLoadingSerial(async () => {
      const result = await suggestSerial(equipmentId);
      if (result.ok) setSerial(result.serial);
    });
  }

  /**
   * รุ่นใหม่ → คำนวณเลข Serial ในเบราว์เซอร์ได้เลย ไม่ต้องถาม server
   * เพราะ suggestModelCode() เป็นฟังก์ชันบริสุทธิ์ที่ใช้ร่วมกันทั้งสองฝั่ง
   * เลือกยี่ห้อหรือพิมพ์ชื่อรุ่นแล้วเห็นเลขขยับตามทันที
   *
   * ตัวย่อยี่ห้อมาจากตาราง Brand (ที่ตั้งไว้ในหน้าตั้งค่า)
   * ส่วนชื่อยี่ห้อใช้ตัดออกจากชื่อรุ่น ไม่ให้รหัสรุ่นซ้ำกับข้อมูลที่มีอยู่แล้ว
   */
  function refreshNewModel(name, nextBrandId, forcedCode) {
    const brand = brands.find((b) => String(b.id) === String(nextBrandId));

    const nextCode =
      forcedCode !== undefined
        ? normaliseCode(forcedCode)
        : codeEdited
          ? code
          : normaliseCode(suggestModelCode(name, brand?.name ?? ""));

    setCode(nextCode);
    setSerial(brand && nextCode ? `${brand.code}-${nextCode}-001` : "");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 border border-line bg-surface px-4 py-3">
        <h3 className="font-head text-[13.5px] font-semibold">สต็อกอุปกรณ์</h3>
        <span className="text-[11.5px] text-ink-muted">
          อุปกรณ์ 1 ชิ้น = 1 Serial Number
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex h-8 items-center border border-primary bg-primary px-3.5 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover"
        >
          + เพิ่มอุปกรณ์
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มอุปกรณ์เข้าสต็อก"
        description="กรอกข้อมูลอุปกรณ์รายชิ้น พร้อมเกณฑ์รอบบำรุงรักษา"
        width={720}
      >
        <form action={formAction} id="add-unit-form">
          <input type="hidden" name="mode" value={mode} />

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: "existing", text: "เพิ่ม Serial ให้รุ่นที่มีอยู่" },
              { key: "new", text: "เพิ่มรุ่นใหม่ทั้งหมด" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={`h-8 border px-3 font-head text-[12.5px] ${
                  mode === opt.key
                    ? "border-primary bg-primary-soft font-semibold text-primary"
                    : "border-line-strong hover:border-primary hover:text-primary"
                }`}
              >
                {opt.text}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mode === "existing" ? (
              <div className="sm:col-span-2">
                <label className={label} htmlFor="equipmentId">
                  รุ่นอุปกรณ์
                </label>
                <select
                  id="equipmentId"
                  name="equipmentId"
                  required
                  disabled={pending}
                  defaultValue=""
                  onChange={(e) => pickEquipment(e.target.value)}
                  className={field}
                >
                  <option value="" disabled>
                    — เลือกรุ่น —
                  </option>
                  {equipments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.unitCount} ชิ้นในระบบ)
                      {e.code ? ` · รหัส ${e.code}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className={label} htmlFor="newEquipmentName">
                    ชื่อรุ่น
                  </label>
                  <input
                    id="newEquipmentName"
                    name="newEquipmentName"
                    required
                    disabled={pending}
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      refreshNewModel(e.target.value, brandId);
                    }}
                    placeholder="เช่น Nikon Z6 III"
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
                    value={brandId}
                    onChange={(e) => {
                      setBrandId(e.target.value);
                      refreshNewModel(newName, e.target.value);
                    }}
                    className={field}
                  >
                    <option value="" disabled>
                      — เลือกยี่ห้อ —
                    </option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={label} htmlFor="code">
                    รหัสรุ่น (ใช้ประกอบเลข Serial)
                  </label>
                  <input
                    id="code"
                    name="code"
                    required
                    disabled={pending}
                    value={code}
                    onChange={(e) => {
                      setCodeEdited(true);
                      refreshNewModel(newName, brandId, e.target.value);
                    }}
                    placeholder="Z6III"
                    className={`${field} font-head tracking-wide uppercase`}
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {codeEdited
                      ? "ตั้งเอง — แก้ได้ตามต้องการ"
                      : "ระบบเดาจากชื่อรุ่นให้ พิมพ์ทับได้"}
                  </p>
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
                    defaultValue=""
                    className={field}
                  >
                    <option value="" disabled>
                      — เลือกหมวดหมู่ —
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="newDailyRate">
                    ค่าเช่าต่อวัน (บาท)
                  </label>
                  <input
                    id="newDailyRate"
                    name="newDailyRate"
                    type="number"
                    min="1"
                    required
                    disabled={pending}
                    placeholder="1200"
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="newReplacementValue">
                    มูลค่าทรัพย์สิน (บาท)
                  </label>
                  <input
                    id="newReplacementValue"
                    name="newReplacementValue"
                    type="number"
                    min="1"
                    required
                    disabled={pending}
                    placeholder="62000"
                    className={field}
                  />
                  <p className="mt-1 text-[11px] text-ink-muted">
                    ใช้ประเมินค่าเสียหายตอนรับคืน ไม่ได้ใช้คำนวณเงินมัดจำ
                  </p>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className={label} htmlFor="serialNumber">
                Serial Number
              </label>
              <div className="flex gap-2">
                <input
                  id="serialNumber"
                  name="serialNumber"
                  disabled={pending}
                  value={loadingSerial ? "กำลังเจน..." : serial}
                  onChange={(e) => setSerial(e.target.value.toUpperCase())}
                  placeholder={
                    mode === "existing"
                      ? "เลือกรุ่นแล้วระบบจะเจนให้"
                      : "กรอกชื่อรุ่นแล้วระบบจะเจนให้"
                  }
                  className={`${field} font-head tracking-wide uppercase`}
                />
                {mode === "existing" && (
                  <button
                    type="button"
                    disabled={pending || loadingSerial}
                    onClick={() =>
                      pickEquipment(
                        document.getElementById("equipmentId")?.value,
                      )
                    }
                    className="h-8 shrink-0 border border-line-strong px-3 font-head text-[12px] hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    เจนใหม่
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                ระบบเจนต่อจากเลขล่าสุดของรุ่นนั้นให้อัตโนมัติ — พิมพ์ทับเองได้ถ้าอยากใช้เลขอื่น
              </p>
            </div>
            <div>
              <label className={label} htmlFor="purchasedAt">
                วันที่ซื้อ (ไม่บังคับ)
              </label>
              <input
                id="purchasedAt"
                name="purchasedAt"
                type="date"
                disabled={pending}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="cycleLimit">
                รอบเช่าก่อนบำรุงรักษา
              </label>
              <input
                id="cycleLimit"
                name="cycleLimit"
                type="number"
                min="1"
                defaultValue={10}
                disabled={pending}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="usageDaysLimit">
                วันใช้งานก่อนบำรุงรักษา
              </label>
              <input
                id="usageDaysLimit"
                name="usageDaysLimit"
                type="number"
                min="1"
                defaultValue={50}
                disabled={pending}
                className={field}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
              {pending ? "กำลังบันทึก..." : "บันทึกอุปกรณ์"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
