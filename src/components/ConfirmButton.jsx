"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";

/**
 * ปุ่ม submit ที่ถามยืนยันก่อนส่งฟอร์ม — ใช้กับการกระทำที่ย้อนกลับไม่ได้
 *
 * ปุ่มที่ผู้ใช้เห็นเป็น type="button" (ไม่ส่งฟอร์ม) ส่วนปุ่ม submit ตัวจริง
 * ถูกซ่อนไว้และถูกกดด้วยโค้ดเมื่อผู้ใช้ยืนยัน
 *
 * ที่ต้องทำแบบนี้เพราะ formData ต้องมี name/value ของ "ปุ่มที่กด" ติดไปด้วย
 * (เช่น decision=APPROVE) ถ้าเรียก form.requestSubmit() เฉย ๆ ค่านั้นจะหายไป
 * และ action จะไม่รู้ว่าผู้ใช้กดปุ่มไหน
 */
export default function ConfirmButton({
  children,
  name,
  value,
  disabled,
  className = "",
  title,
  confirmTitle,
  confirmDescription,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "primary",
  pending = false,
}) {
  const [open, setOpen] = useState(false);
  const hiddenRef = useRef(null);

  function confirm() {
    setOpen(false);
    hiddenRef.current?.click();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>

      <button
        ref={hiddenRef}
        type="submit"
        name={name}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={confirmTitle}
        description={confirmDescription}
        width={460}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center border border-line-strong bg-surface px-3.5 font-head text-[12.5px] hover:border-primary hover:text-primary"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={
                tone === "danger"
                  ? "inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                  : "inline-flex h-8 items-center border border-available bg-available px-4 font-head text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60"
              }
            >
              {confirmLabel}
            </button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed">
          {tone === "danger"
            ? "การกระทำนี้ย้อนกลับไม่ได้ ตรวจสอบให้แน่ใจก่อนยืนยัน"
            : "ตรวจสอบข้อมูลให้เรียบร้อยก่อนยืนยัน"}
        </p>
      </Modal>
    </>
  );
}
