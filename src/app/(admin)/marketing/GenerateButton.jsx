"use client";

import { useActionState } from "react";
import { generateDraft } from "./actions";
import { withToast } from "@/components/Toast";

/**
 * ปุ่มสั่ง AI ร่างโพส
 *
 * การเรียก Gemini ใช้เวลาราว 10 วินาที จึงต้องบอกสถานะให้ชัด
 * ไม่งั้นแอดมินจะคิดว่าปุ่มค้างแล้วกดซ้ำ
 */
export default function GenerateButton({ equipmentId, disabled }) {
  const [state, formAction, pending] = useActionState(
    withToast(generateDraft),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <button
        type="submit"
        disabled={pending || disabled}
        className="inline-flex h-8 shrink-0 items-center border border-primary bg-primary px-3 font-head text-[12px] font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line disabled:text-ink-muted"
      >
        {pending ? "AI กำลังเขียน..." : "ให้ AI ร่างโพส"}
      </button>

      {state && !state.ok && (
        <span className="max-w-[260px] text-right text-[11.5px] text-primary">
          {state.message}
        </span>
      )}
    </form>
  );
}
