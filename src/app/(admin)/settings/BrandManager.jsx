"use client";

import { useActionState, useState } from "react";
import { createBrand, updateBrand } from "./actions";
import Modal from "@/components/Modal";
import { withToast } from "@/components/Toast";
import { normaliseBrandCode, suggestBrandCode } from "@/lib/brands";

const field =
  "h-8 w-full border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-primary focus:bg-white disabled:opacity-60";
const label =
  "mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase";

/**
 * จัดการยี่ห้ออุปกรณ์ — ตัวย่อของยี่ห้อถูกใช้ขึ้นต้นเลข Serial ของทุกชิ้น
 *
 * ปิดใช้งานแทนการลบ เพราะยี่ห้อที่เคยมีอุปกรณ์ผูกอยู่ ลบทิ้งไม่ได้
 * (จะทำให้ข้อมูลรุ่นอุปกรณ์ที่อ้างถึงมันพัง) การปิดใช้งานทำให้ไม่โผล่ใน
 * dropdown ตอนเพิ่มของใหม่ แต่ของเดิมยังอยู่ครบ
 */
export default function BrandManager({ brands }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const [, createAction, creating] = useActionState(
    withToast(createBrand, () => setAdding(false)),
    null,
  );
  const [, updateActionFn, updating] = useActionState(
    withToast(updateBrand, () => setEditing(null)),
    null,
  );

  // ชื่อ → ตัวย่ออัตโนมัติ (แก้ทับได้)
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);

  function onNameChange(value) {
    setNewName(value);
    if (!codeEdited) setNewCode(suggestBrandCode(value));
  }

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
        <h3 className="font-head text-[13.5px] font-semibold">ยี่ห้ออุปกรณ์</h3>
        <span className="text-[11.5px] text-ink-muted">
          ตัวย่อใช้ขึ้นต้นเลข Serial · {brands.length} ยี่ห้อ
        </span>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setNewName("");
            setNewCode("");
            setCodeEdited(false);
          }}
          className="ml-auto inline-flex h-8 items-center border border-primary bg-primary px-3.5 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover"
        >
          + เพิ่มยี่ห้อ
        </button>
      </div>

      <div className="divide-y divide-line">
        {brands.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span
              className="grid h-7 min-w-[42px] place-items-center border border-line-strong bg-canvas px-2 font-head text-[12.5px] font-bold"
              style={b.isActive ? undefined : { opacity: 0.45 }}
            >
              {b.code}
            </span>
            <span className={`text-[13px] ${b.isActive ? "" : "text-ink-muted line-through"}`}>
              {b.name}
            </span>
            <span className="text-[11.5px] text-ink-muted">
              {b.equipmentCount} รุ่น · Serial ขึ้นต้น {b.code}-
            </span>
            {!b.isActive && (
              <span className="border border-line-strong px-1.5 font-head text-[10px] text-ink-muted">
                ปิดใช้งาน
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing(b)}
              className="ml-auto inline-flex h-7 items-center border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
            >
              แก้ไข
            </button>
          </div>
        ))}
      </div>

      {/* ---------------- เพิ่มยี่ห้อ ---------------- */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="เพิ่มยี่ห้อ"
        description="ตัวย่อจะถูกใช้ขึ้นต้นเลข Serial ของอุปกรณ์ยี่ห้อนี้ทุกชิ้น"
        width={480}
      >
        <form action={createAction}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className={label} htmlFor="name">
                ชื่อยี่ห้อ
              </label>
              <input
                id="name"
                name="name"
                required
                disabled={creating}
                value={newName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="เช่น Nikon"
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="code">
                ตัวย่อ
              </label>
              <input
                id="code"
                name="code"
                required
                maxLength={4}
                disabled={creating}
                value={newCode}
                onChange={(e) => {
                  setCodeEdited(true);
                  setNewCode(normaliseBrandCode(e.target.value));
                }}
                placeholder="NK"
                className={`${field} font-head font-bold tracking-widest uppercase`}
              />
            </div>
          </div>

          {newCode && (
            <p className="mt-3 border-l-[3px] border-line-strong bg-canvas px-3 py-2 text-[12.5px]">
              เลข Serial จะออกมาเป็น{" "}
              <b className="font-head">{newCode}-&lt;รหัสรุ่น&gt;-001</b>
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={creating}
              className="inline-flex h-8 items-center border border-line-strong bg-surface px-3.5 font-head text-[12.5px] hover:border-primary hover:text-primary"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {creating ? "กำลังบันทึก..." : "เพิ่มยี่ห้อ"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- แก้ไขยี่ห้อ ---------------- */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `แก้ไขยี่ห้อ ${editing.name}` : ""}
        width={480}
      >
        {editing && (
          <form action={updateActionFn} key={editing.id}>
            <input type="hidden" name="brandId" value={editing.id} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <label className={label} htmlFor="edit-name">
                  ชื่อยี่ห้อ
                </label>
                <input
                  id="edit-name"
                  name="name"
                  required
                  disabled={updating}
                  defaultValue={editing.name}
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="edit-code">
                  ตัวย่อ
                </label>
                <input
                  id="edit-code"
                  name="code"
                  required
                  maxLength={4}
                  disabled={updating || editing.equipmentCount > 0}
                  defaultValue={editing.code}
                  className={`${field} font-head font-bold tracking-widest uppercase`}
                />
              </div>
            </div>

            {editing.equipmentCount > 0 && (
              <p className="mt-2 text-[11.5px] text-ink-muted">
                แก้ตัวย่อไม่ได้ เพราะมีอุปกรณ์ {editing.equipmentCount} รุ่นใช้{" "}
                <b>{editing.code}-</b> อยู่แล้ว — เลขบนสติกเกอร์ที่แปะไว้จะไม่ตรงกับระบบ
              </p>
            )}

            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing.isActive}
                disabled={updating}
                className="size-4 accent-[var(--color-primary)]"
              />
              เปิดใช้งาน (ปิดแล้วจะไม่โผล่ตอนเพิ่มอุปกรณ์ใหม่ แต่ของเดิมยังอยู่)
            </label>

            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={updating}
                className="inline-flex h-8 items-center border border-line-strong bg-surface px-3.5 font-head text-[12.5px] hover:border-primary hover:text-primary"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={updating}
                className="inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {updating ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
