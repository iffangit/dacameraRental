"use client";

import { useSyncExternalStore } from "react";

/**
 * ระบบ Toast — แจ้งผลลัพธ์ของการกระทำแบบชั่วคราว
 *
 * เก็บ state ไว้นอก React แล้วอ่านด้วย useSyncExternalStore แทน Context
 * เพราะสองเหตุผล
 *   1. เรียก toast.success() ได้จากทุกที่โดยไม่ต้องมี hook หรือ provider ครอบ
 *   2. ไม่ทำให้ทั้ง subtree re-render เวลามี toast ใหม่ — มีแค่ตัว ToastViewport ที่อัปเดต
 */

let items = [];
const listeners = new Set();
let nextId = 1;

function emit() {
  // ต้องสร้าง array ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore จะมองว่าไม่มีอะไรเปลี่ยน
  items = [...items];
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

const EMPTY = [];
function getServerSnapshot() {
  return EMPTY;
}

function dismiss(id) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(message, { type = "info", duration = 4500 } = {}) {
  const id = nextId++;
  items = [...items, { id, message, type }];
  emit();

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toast = {
  success: (message, opts) => push(message, { ...opts, type: "success" }),
  error: (message, opts) => push(message, { ...opts, type: "error", duration: 7000 }),
  info: (message, opts) => push(message, { ...opts, type: "info" }),
  dismiss,
  /** ช่วยลดโค้ดซ้ำ — รับผลลัพธ์จาก Server Action แล้วเลือกสีให้เอง */
  fromResult: (result) => {
    if (!result) return;
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  },
};

/**
 * ห่อ Server Action ให้ยิง toast ทันทีที่ได้ผลลัพธ์
 *
 * ต้องยิงตรงนี้ ไม่ใช่ใน useEffect ที่ผูกกับ state ของฟอร์ม เพราะ action
 * เรียก revalidatePath() ทำให้ server ส่งหน้าใหม่มาแทน component เดิม
 * บางหน้า component ที่เป็นเจ้าของ effect หายไปเลยหลังทำงานสำเร็จ
 * (เช่น ฟอร์มอนุมัติที่หายไปเมื่อคำขอไม่ใช่ "รออนุมัติ" อีกต่อไป)
 * effect จึงไม่มีวันได้ทำงาน และ toast ไม่เคยแสดง
 *
 * @param action    Server Action ที่รับ (prevState, formData)
 * @param onSuccess ทำอะไรต่อเมื่อสำเร็จ เช่น ปิด modal หรือล้างฟอร์ม
 */
export function withToast(action, onSuccess) {
  return async (prevState, formData) => {
    const result = await action(prevState, formData);
    toast.fromResult(result);
    if (result?.ok) onSuccess?.(result);
    return result;
  };
}

const STYLE = {
  success: {
    border: "var(--color-available)",
    tag: "OK",
    bg: "color-mix(in oklch, var(--color-available) 10%, white)",
  },
  error: {
    border: "var(--color-primary)",
    tag: "!",
    bg: "var(--color-primary-soft)",
  },
  info: {
    border: "var(--color-cleaning)",
    tag: "i",
    bg: "color-mix(in oklch, var(--color-cleaning) 8%, white)",
  },
};

/** วางไว้ครั้งเดียวใน layout — เป็นที่แสดง toast ทั้งหมด */
export function ToastViewport() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (list.length === 0) return null;

  return (
    <div
      // aria-live ทำให้โปรแกรมอ่านหน้าจออ่านข้อความใหม่ให้โดยไม่ต้องย้ายโฟกัส
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
    >
      {list.map((item) => {
        const style = STYLE[item.type];
        return (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2.5 border border-l-[3px] border-line px-3.5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            style={{ borderLeftColor: style.border, background: style.bg }}
          >
            <span
              className="tag mt-px shrink-0"
              style={{ borderColor: style.border, color: style.border, background: "white" }}
            >
              {style.tag}
            </span>
            <p className="flex-1 text-[12.5px] leading-relaxed">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="ปิดข้อความ"
              className="shrink-0 text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
