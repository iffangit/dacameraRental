"use client";

import { useActionState, useMemo, useState } from "react";
import { createWalkIn } from "./actions";
import { UNIT_STATUS, formatBaht } from "@/lib/domain";
import { rangesOverlap } from "@/lib/queue";
import { withToast } from "@/components/Toast";
import ConfirmButton from "@/components/ConfirmButton";

const field =
  "h-9 w-full border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-primary focus:bg-white disabled:opacity-60";
const label =
  "mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase";

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000) + 1;
}

/**
 * หน้าทำรายการเช่าหน้าร้าน — REQ-RENT-003 (จัดเซ็ตอุปกรณ์) + การเช่า Walk-in
 *
 * ตรวจ "ว่างหรือไม่" ในเบราว์เซอร์เพื่อให้เปลี่ยนวันที่แล้วเห็นผลทันที
 * โดยใช้ rangesOverlap() ตัวเดียวกับที่ฝั่ง server ใช้ตรวจตอนบันทึกจริง
 * ถ้าใช้คนละสูตร สิ่งที่พนักงานเห็นกับสิ่งที่ระบบยอมรับจะไม่ตรงกัน
 */
export default function WalkInForm({ units, customers, bookingDeposit, todayKey }) {
  // ทำรายการเสร็จแล้วล้างฟอร์มให้พร้อมรับลูกค้าคนถัดไป
  // ถ้าไม่ล้าง พนักงานอาจเผลอกดบันทึกซ้ำด้วยรายการเดิม
  const [, formAction, pending] = useActionState(
    withToast(createWalkIn, () => {
      setCart([]);
      setDiscount("0");
      setDiscountNote("");
      setGuestName("");
      setGuestPhone("");
      setCustomerId("");
    }),
    null,
  );

  const [mode, setMode] = useState("new");
  const [customerId, setCustomerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [discountNote, setDiscountNote] = useState("");
  const [search, setSearch] = useState("");

  const days = Math.max(1, daysBetween(startDate, endDate));
  const isImmediate = startDate <= todayKey;

  /** ชิ้นไหนว่างในช่วงวันที่เลือก */
  const availability = useMemo(() => {
    const map = new Map();
    for (const u of units) {
      if (["MAINTENANCE", "CLEANING", "RETIRED"].includes(u.status)) {
        map.set(u.id, { ok: false, reason: UNIT_STATUS[u.status].label });
        continue;
      }
      const clash = u.bookings.find((b) =>
        rangesOverlap(b.start, b.end, startDate, endDate),
      );
      map.set(
        u.id,
        clash
          ? { ok: false, reason: `ติดคิว ${clash.orderCode}` }
          : { ok: true, reason: null },
      );
    }
    return map;
  }, [units, startDate, endDate]);

  const visibleUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) =>
      `${u.name} ${u.brand} ${u.serialNumber} ${u.category}`
        .toLowerCase()
        .includes(q),
    );
  }, [units, search]);

  const cartUnits = cart
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean);

  // คิดเงินแบบเดียวกับ calculateRental() ฝั่ง server
  const rentalFee = cartUnits.reduce((sum, u) => sum + u.dailyRate * days, 0);
  const discountValue = Math.max(0, Math.min(Number(discount) || 0, rentalFee));
  const netAmount = rentalFee - discountValue;
  const deposit = isImmediate ? 0 : Math.min(bookingDeposit, netAmount);
  const balanceDue = netAmount - deposit;

  function toggle(id) {
    setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  const customerReady =
    mode === "existing"
      ? Boolean(customerId)
      : guestName.trim().length >= 2 && guestPhone.replace(/\D/g, "").length >= 9;
  const canSubmit = customerReady && cart.length > 0 && !pending;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />
      {cart.map((id) => (
        <input key={id} type="hidden" name="unitIds" value={id} />
      ))}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_380px]">
        {/* ---------------- ซ้าย: ลูกค้า + อุปกรณ์ ---------------- */}
        <div className="flex flex-col gap-4">
          {/* ลูกค้า */}
          <div className="border border-line bg-surface">
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <h3 className="font-head text-[13.5px] font-semibold">ลูกค้า</h3>
              <div className="ml-auto flex gap-1.5">
                {[
                  { key: "new", text: "ลูกค้าใหม่ / ไม่ได้เป็นสมาชิก" },
                  { key: "existing", text: "เลือกจากที่มีอยู่" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMode(opt.key)}
                    className={`h-7 border px-2.5 font-head text-[11.5px] ${
                      mode === opt.key
                        ? "border-primary bg-primary-soft font-semibold text-primary"
                        : "border-line-strong hover:border-primary hover:text-primary"
                    }`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {mode === "new" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="guestName">
                      ชื่อ-นามสกุล
                    </label>
                    <input
                      id="guestName"
                      name="guestName"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      disabled={pending}
                      placeholder="เช่น สมชาย ใจดี"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="guestPhone">
                      เบอร์โทร
                    </label>
                    <input
                      id="guestPhone"
                      name="guestPhone"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      disabled={pending}
                      placeholder="081-234-5678"
                      inputMode="tel"
                      className={field}
                    />
                    <p className="mt-1 text-[11px] text-ink-muted">
                      ถ้าเบอร์นี้เคยเช่ามาก่อน ระบบจะผูกกับประวัติเดิมให้อัตโนมัติ
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={label} htmlFor="customerId">
                    เลือกลูกค้า
                  </label>
                  <select
                    id="customerId"
                    name="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={pending}
                    className={field}
                  >
                    <option value="">— เลือกลูกค้า —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} · เกรด {c.grade}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ช่วงวันที่ */}
          <div className="border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-head text-[13.5px] font-semibold">ช่วงเวลาเช่า</h3>
            </div>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div>
                <label className={label} htmlFor="start">
                  วันเริ่มเช่า
                </label>
                <input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  disabled={pending}
                  className={`${field} w-[170px]`}
                />
              </div>
              <div>
                <label className={label} htmlFor="end">
                  กำหนดคืน
                </label>
                <input
                  id="end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={pending}
                  className={`${field} w-[170px]`}
                />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                {[1, 2, 3, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEndDate(addDays(startDate, n - 1))}
                    className="h-8 border border-line-strong px-2.5 font-head text-[11.5px] hover:border-primary hover:text-primary"
                  >
                    {n} วัน
                  </button>
                ))}
              </div>
              <div className="pb-1 font-head text-[12.5px]">
                รวม <b className="tnum">{days}</b> วัน
                {isImmediate ? (
                  <span className="ml-2 border border-available px-1.5 py-0.5 text-[10.5px] text-available">
                    รับของวันนี้
                  </span>
                ) : (
                  <span className="ml-2 border border-maintenance px-1.5 py-0.5 text-[10.5px] text-maintenance">
                    จองล่วงหน้า
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* เลือกอุปกรณ์ */}
          <div className="border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
              <h3 className="font-head text-[13.5px] font-semibold">จัดเซ็ตอุปกรณ์</h3>
              <span className="text-[11.5px] text-ink-muted">
                เลือกได้หลายชิ้นใน 1 รายการ
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารุ่น / Serial No."
                className="ml-auto h-8 w-[220px] border border-line bg-canvas px-2.5 text-[12.5px] outline-none focus:border-primary focus:bg-white"
              />
            </div>

            <div className="max-h-[440px] divide-y divide-line overflow-y-auto">
              {visibleUnits.map((u) => {
                const av = availability.get(u.id);
                const selected = cart.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => av.ok && toggle(u.id)}
                    disabled={!av.ok || pending}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-primary-soft"
                        : av.ok
                          ? "hover:bg-canvas"
                          : "cursor-not-allowed opacity-45"
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center border ${
                        selected
                          ? "border-primary bg-primary text-white"
                          : "border-line-strong"
                      }`}
                    >
                      {selected && (
                        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-6" strokeLinecap="square" />
                        </svg>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {u.name}
                      </span>
                      <span className="block font-head text-[11px] tracking-wide text-ink-muted">
                        {u.serialNumber} · {u.category}
                      </span>
                    </span>

                    {!av.ok && (
                      <span className="shrink-0 text-[11.5px] text-primary">
                        {av.reason}
                      </span>
                    )}
                    <span className="tnum shrink-0 font-head text-[12.5px]">
                      {formatBaht(u.dailyRate)}/วัน
                    </span>
                  </button>
                );
              })}
              {visibleUnits.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  ไม่พบอุปกรณ์ที่ค้นหา
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- ขวา: สรุปรายการ ---------------- */}
        <div className="sticky top-[77px] border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-head text-[13.5px] font-semibold">สรุปรายการ</h3>
          </div>

          <div className="max-h-[280px] divide-y divide-line overflow-y-auto">
            {cartUnits.length === 0 && (
              <p className="px-4 py-8 text-center text-[12.5px] text-ink-muted">
                ยังไม่ได้เลือกอุปกรณ์
              </p>
            )}
            {cartUnits.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">
                    {u.name}
                  </div>
                  <div className="tnum font-head text-[11px] text-ink-muted">
                    {u.serialNumber} · {formatBaht(u.dailyRate)} × {days}
                  </div>
                </div>
                <span className="tnum shrink-0 font-head text-[12.5px]">
                  {formatBaht(u.dailyRate * days)}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  disabled={pending}
                  aria-label="เอาออก"
                  className="shrink-0 text-ink-muted hover:text-primary"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-line p-4">
            <label className={label} htmlFor="discountAmount">
              ส่วนลด (บาท)
            </label>
            <input
              id="discountAmount"
              name="discountAmount"
              type="number"
              min="0"
              max={rentalFee || undefined}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={pending || cartUnits.length === 0}
              className={field}
            />
            {discountValue > 0 && (
              <input
                name="discountNote"
                value={discountNote}
                onChange={(e) => setDiscountNote(e.target.value)}
                disabled={pending}
                placeholder="เหตุผลที่ลด เช่น ลูกค้าประจำ"
                className={`${field} mt-2`}
              />
            )}
            {Number(discount) > rentalFee && rentalFee > 0 && (
              <p className="mt-1 text-[11.5px] text-primary">
                ส่วนลดเกินค่าเช่า ระบบจะลดให้สูงสุด {formatBaht(rentalFee)}
              </p>
            )}
          </div>

          <div className="border-t border-line">
            <Row label={`ค่าเช่า ${cartUnits.length} ชิ้น × ${days} วัน`} value={rentalFee} />
            {discountValue > 0 && <Row label="ส่วนลด" value={-discountValue} />}
            {!isImmediate && deposit > 0 && (
              <Row label="หัก มัดจำจองคิว" value={-deposit} />
            )}
            <Row
              label={isImmediate ? "ยอดที่ต้องเก็บวันนี้" : "ยอดคงเหลือตอนรับของ"}
              value={balanceDue}
              emphasis
            />
          </div>

          <div className="border-t border-line p-4">
            <label className={label} htmlFor="note">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              disabled={pending}
              placeholder="เช่น งานที่ลูกค้าจะไปถ่าย"
              className="w-full resize-y border border-line bg-canvas px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:bg-white"
            />

            <ConfirmButton
              disabled={!canSubmit}
              pending={pending}
              confirmTitle={
                isImmediate ? "ส่งมอบอุปกรณ์ให้ลูกค้า?" : "บันทึกการจองล่วงหน้า?"
              }
              confirmDescription={
                isImmediate
                  ? `${cartUnits.length} ชิ้น · ${days} วัน · เก็บเงิน ${formatBaht(balanceDue)} — อุปกรณ์จะถูกเปลี่ยนเป็นสถานะถูกเช่าทันที`
                  : `${cartUnits.length} ชิ้น · ${days} วัน · กันคิวไว้ให้ลูกค้าตั้งแต่วันที่ระบุ`
              }
              confirmLabel={isImmediate ? "ส่งมอบ" : "บันทึกการจอง"}
              tone="safe"
              className="mt-3 inline-flex h-9 w-full items-center justify-center border border-primary bg-primary font-head text-[13px] font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line disabled:text-ink-muted"
            >
              {pending
                ? "กำลังบันทึก..."
                : isImmediate
                  ? "บันทึกและส่งมอบอุปกรณ์"
                  : "บันทึกการจอง"}
            </ConfirmButton>

            {!customerReady && cart.length > 0 && (
              <p className="mt-2 text-[11.5px] text-ink-muted">
                กรอกข้อมูลลูกค้าให้ครบก่อนบันทึก
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, emphasis = false }) {
  const isDeduction = value < 0;
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-4 py-2 ${
        emphasis ? "border-t border-line bg-canvas" : ""
      }`}
    >
      <span
        className={`text-[12.5px] ${emphasis ? "font-semibold" : "text-ink-muted"}`}
      >
        {label}
      </span>
      <span
        className={`tnum font-head font-semibold ${
          emphasis ? "text-[16px]" : "text-[13px]"
        } ${isDeduction ? "text-ink-muted" : ""}`}
      >
        {isDeduction ? "−" : ""}
        {formatBaht(Math.abs(value))}
      </span>
    </div>
  );
}
