"use client";

import { useActionState, useState } from "react";
import { updateSettings } from "./actions";
import { withToast } from "@/components/Toast";

export default function SettingsForm({ current }) {
  const [, formAction, pending] = useActionState(withToast(updateSettings), null);
  const [value, setValue] = useState(String(current));

  const changed = Number(value) !== Number(current);

  return (
    <form action={formAction} className="border-t border-line p-4">
      <label
        htmlFor="bookingDeposit"
        className="mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase"
      >
        เงินมัดจำจองคิว (บาทต่อ 1 คำขอเช่า)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="bookingDeposit"
          name="bookingDeposit"
          type="number"
          min="0"
          step="1"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="tnum h-9 w-[160px] border border-line bg-canvas px-3 font-head text-[15px] font-semibold outline-none focus:border-primary focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !changed}
          title={changed ? undefined : "ยังไม่มีการเปลี่ยนแปลง"}
          className="inline-flex h-9 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line disabled:text-ink-muted"
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      <ul className="mt-3 space-y-1 text-[12.5px] text-ink-muted">
        <li>• เก็บครั้งเดียวต่อคำขอ ไม่ว่าจะเช่ากี่ชิ้นก็ตาม</li>
        <li>
          • <b>หักเป็นส่วนหนึ่งของค่าเช่า</b> ไม่ใช่เงินเพิ่ม —
          ลูกค้าจ่ายส่วนที่เหลือตอนมารับของ
        </li>
        <li>
          • มีผลกับคำขอที่ยื่นหลังจากนี้เท่านั้น{" "}
          <b>ออเดอร์เดิมยังใช้ค่าที่บันทึกไว้ตอนยื่น</b>
        </li>
        <li>
          • ถ้าค่าเช่ารวมน้อยกว่าค่ามัดจำ ระบบจะเก็บเท่ากับค่าเช่า
          เพื่อไม่ให้ยอดคงเหลือติดลบ
        </li>
      </ul>

    </form>
  );
}
