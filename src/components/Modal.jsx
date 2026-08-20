"use client";

import { useEffect, useRef } from "react";

/**
 * Modal — ใช้ <dialog> ของเบราว์เซอร์แทนการทำ overlay เอง
 *
 * ได้พฤติกรรมที่ถูกต้องมาฟรีโดยไม่ต้องเขียนเอง: กัก focus ไว้ในกล่อง,
 * กด Esc เพื่อปิด, ซ่อนเนื้อหาข้างหลังจากโปรแกรมอ่านหน้าจอ และ backdrop
 * ถ้าทำเองด้วย div จะต้องเขียน focus trap เองซึ่งพลาดง่ายและมักตกหล่นเรื่อง accessibility
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // ผู้ใช้กด Esc — <dialog> ปิดตัวเอง จึงต้องบอก state ข้างนอกให้ตรงกัน
    const handleClose = () => onClose?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? "modal-title" : undefined}
      // คลิกนอกกล่อง = คลิกที่ตัว dialog เอง (ส่วน backdrop) จึงเช็ค target
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
      className="m-auto w-[min(var(--modal-w),calc(100vw-2rem))] border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      style={{ "--modal-w": `${width}px` }}
    >
      {title && (
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="font-head text-[14.5px] font-semibold">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 text-ink-muted hover:text-primary"
          >
            ✕
          </button>
        </div>
      )}

      <div className="p-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
