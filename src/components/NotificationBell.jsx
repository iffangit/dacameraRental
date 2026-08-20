"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * กระดิ่งแจ้งเตือนบน topbar
 *
 * ใช้ popover ไม่ใช่ modal เพราะการแจ้งเตือนเป็นข้อมูลประกอบ ไม่ใช่สิ่งที่ต้อง
 * ตัดสินใจทันที ถ้าใช้ modal จะบังหน้าจอและขวางงานที่ผู้ใช้ทำอยู่
 */
export default function NotificationBell({ items, urgentCount }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = items.length;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          count > 0 ? `การแจ้งเตือน ${count} รายการ` : "การแจ้งเตือน"
        }
        className="relative grid size-8 place-items-center border border-line text-ink-muted hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-[15px]"
        >
          <path d="M4 6.5a4 4 0 018 0c0 3 1 4 1 4H3s1-1 1-4z" strokeLinejoin="round" />
          <path d="M6.5 13a1.5 1.5 0 003 0" />
        </svg>

        {count > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center px-1 font-head text-[9.5px] font-bold text-white"
            style={{
              background:
                urgentCount > 0
                  ? "var(--color-primary)"
                  : "var(--color-maintenance)",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-[320px] border border-line bg-surface shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
          <div className="border-b border-line px-3.5 py-2.5">
            <span className="font-head text-[12.5px] font-semibold">
              การแจ้งเตือน
            </span>
            {count > 0 && (
              <span className="ml-1.5 text-[11.5px] text-ink-muted">
                {count} รายการ
              </span>
            )}
          </div>

          {count === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-muted">
              ไม่มีรายการค้าง — ระบบเรียบร้อยดี
            </p>
          ) : (
            <div className="max-h-[340px] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-2.5 px-3.5 py-2.5 hover:bg-canvas"
                >
                  <span
                    className="tag mt-px shrink-0"
                    style={{ borderColor: item.color, color: item.color }}
                  >
                    {item.tag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold">
                      {item.title}
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
