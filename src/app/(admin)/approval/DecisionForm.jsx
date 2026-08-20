"use client";

import { useActionState } from "react";
import { decideOrder } from "./actions";
import { withToast } from "@/components/Toast";
import ConfirmButton from "@/components/ConfirmButton";

/**
 * ปุ่มอนุมัติ/ปฏิเสธ + ช่องหมายเหตุ
 *
 * ทั้งสองปุ่มถามยืนยันก่อน เพราะการอนุมัติทำให้อุปกรณ์ถูกกันคิวทันที
 * และการปฏิเสธส่งผลถึงลูกค้าโดยตรง — ทั้งคู่ย้อนกลับเองไม่ได้ในระบบตอนนี้
 *
 * ใช้ useActionState ตัวเดียวคุมทั้งสองปุ่ม (แยกด้วย value ของ name="decision")
 * เพื่อให้ระหว่างที่ server action ทำงาน ปุ่มทั้งคู่ถูก disable พร้อมกัน
 */
export default function DecisionForm({ orderId, orderCode, customerName, blockers }) {
  const [, formAction, pending] = useActionState(withToast(decideOrder), null);
  const hasBlockers = blockers.length > 0;

  return (
    <form action={formAction} className="border-t border-line p-4">
      <input type="hidden" name="orderId" value={orderId} />

      <label
        htmlFor="adminNote"
        className="mb-1.5 block font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
      >
        หมายเหตุถึงลูกค้า (ไม่บังคับ)
      </label>
      <textarea
        id="adminNote"
        name="adminNote"
        rows={2}
        disabled={pending}
        placeholder="เช่น เหตุผลที่ไม่อนุมัติ หรือเงื่อนไขเพิ่มเติมตอนรับของ"
        className="w-full resize-y border border-line bg-canvas px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:bg-white disabled:opacity-60"
      />

      <div className="mt-3 flex gap-2">
        <ConfirmButton
          name="decision"
          value="APPROVE"
          disabled={pending || hasBlockers}
          pending={pending}
          title={
            hasBlockers ? "แก้ปัญหาที่ระบบเตือนด้านบนก่อนจึงจะอนุมัติได้" : undefined
          }
          confirmTitle={`อนุมัติคำขอ ${orderCode}?`}
          confirmDescription={`อุปกรณ์ทั้งหมดในคำขอของ ${customerName} จะถูกกันคิวไว้ทันที`}
          confirmLabel="อนุมัติ"
          tone="safe"
          className="inline-flex h-8 flex-1 items-center justify-center border border-primary bg-primary px-3.5 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line disabled:text-ink-muted"
        >
          {pending ? "กำลังบันทึก..." : "อนุมัติคำขอ"}
        </ConfirmButton>

        <ConfirmButton
          name="decision"
          value="REJECT"
          disabled={pending}
          pending={pending}
          confirmTitle={`ไม่อนุมัติคำขอ ${orderCode}?`}
          confirmDescription={`${customerName} จะเห็นว่าคำขอถูกปฏิเสธ พร้อมหมายเหตุที่คุณกรอกไว้`}
          confirmLabel="ไม่อนุมัติ"
          tone="danger"
          className="inline-flex h-8 items-center border border-line-strong bg-surface px-3.5 font-head text-[12.5px] font-medium hover:border-primary hover:text-primary disabled:opacity-50"
        >
          ไม่อนุมัติ
        </ConfirmButton>
      </div>

      {hasBlockers && (
        <p className="mt-2 text-[11.5px] text-ink-muted">
          ปุ่มอนุมัติถูกปิดไว้เพราะมีปัญหาค้างอยู่ — ถึงกดได้ ระบบก็จะปฏิเสธซ้ำอีกชั้นตอนบันทึก
        </p>
      )}
    </form>
  );
}
