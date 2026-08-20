"use client";

import { useSyncExternalStore } from "react";

const THAI_DAYS = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
];
const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function nowLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const year = String((d.getFullYear() + 543) % 100).padStart(2, "0");
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${year} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * เวลาปัจจุบันคือ state ที่อยู่นอก React จึงใช้ useSyncExternalStore
 * แทน useState + useEffect — ได้ค่าที่ถูกต้องโดยไม่เกิด render ซ้อน
 * และ getServerSnapshot คืน null เพื่อไม่ให้ HTML ฝั่งเซิร์ฟเวอร์
 * มีเวลาที่ต่างจากฝั่งเบราว์เซอร์ (hydration mismatch)
 */
let cachedLabel = null;

function subscribe(onStoreChange) {
  const id = setInterval(() => {
    cachedLabel = nowLabel();
    onStoreChange();
  }, 30_000);
  return () => clearInterval(id);
}

function getSnapshot() {
  // คำนวณครั้งแรกตอนถูกอ่านบนเบราว์เซอร์ แล้วแคชไว้
  // เพื่อให้ snapshot คงที่ระหว่าง render รอบเดียวกัน
  cachedLabel ??= nowLabel();
  return cachedLabel;
}

function getServerSnapshot() {
  return null;
}

export default function Clock() {
  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span className="tnum hidden font-head text-xs whitespace-nowrap text-ink-muted sm:inline">
      {label ?? "—"}
    </span>
  );
}
