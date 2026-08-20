"use client";

import { useActionState, useState } from "react";
import { returnItems, closeOrder } from "./actions";
import { withToast } from "@/components/Toast";
import ConfirmButton from "@/components/ConfirmButton";
import { formatBaht, formatThaiDate } from "@/lib/domain";
import { CONDITION_LABEL } from "@/lib/returns";

const CONDITIONS = ["GOOD", "NEEDS_CLEANING", "DAMAGED"];

/**
 * การ์ดรับคืนของ 1 ออเดอร์
 *
 * เลือกคืนทีละชิ้นได้ เพราะลูกค้ามักคืนไม่ครบในครั้งเดียว
 * (เช่น คืนกล้องก่อน แต่ขอยืมเลนส์ต่ออีกวัน) ถ้าบังคับคืนทั้งออเดอร์
 * พนักงานจะต้องเลี่ยงไปแก้ข้อมูลในฐานข้อมูลเอง
 */
export default function ReturnCard({ order }) {
  const [selected, setSelected] = useState([]);
  const [conditions, setConditions] = useState({});
  const [, formAction, pending] = useActionState(
    withToast(returnItems, () => {
      setSelected([]);
      setConditions({});
    }),
    null,
  );
  const [, closeAction, closing] = useActionState(withToast(closeOrder), null);

  const pendingItems = order.items.filter((i) => !i.returnedAt);
  const returnedItems = order.items.filter((i) => i.returnedAt);
  const allReturned = pendingItems.length === 0;

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const lateFeePreview = selected.reduce((sum, id) => {
    const item = pendingItems.find((i) => i.id === id);
    return sum + (item ? order.overdueDays * item.dailyRate : 0);
  }, 0);

  return (
    <div
      className="border border-line bg-surface"
      style={
        order.isOverdue
          ? { borderLeft: "3px solid var(--color-primary)" }
          : undefined
      }
    >
      {/* หัวออเดอร์ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-head text-[13.5px] font-semibold">
          {order.orderCode}
        </span>
        {order.channel === "WALK_IN" && (
          <span className="border border-line-strong px-1.5 font-head text-[10px] text-ink-muted">
            หน้าร้าน
          </span>
        )}
        {order.isOverdue && (
          <span className="border border-primary px-1.5 font-head text-[10px] font-bold text-primary">
            เลยกำหนด {order.overdueDays} วัน
          </span>
        )}
        {allReturned && (
          <span className="border border-maintenance px-1.5 font-head text-[10px] font-bold text-maintenance">
            รอเคลียร์ค่าเสียหาย
          </span>
        )}

        <span className="ml-auto text-[12px] text-ink-muted">
          {order.customerName} · {order.customerPhone ?? "—"}
        </span>
      </div>

      <div className="tnum border-b border-line bg-canvas px-4 py-2 text-[12px] text-ink-muted">
        เช่า {formatThaiDate(order.startDate)} – {formatThaiDate(order.endDate)} ·{" "}
        {order.rentalDays} วัน · ค่าเช่า {formatBaht(order.rentalFee)}
        {order.lateFee > 0 && (
          <>
            {" "}
            · <span className="text-primary">ค่าเช่าส่วนเกินสะสม {formatBaht(order.lateFee)}</span>
          </>
        )}
      </div>

      {allReturned ? (
        <div className="p-4">
          <p className="mb-3 text-[13px]">
            รับคืนครบทุกชิ้นแล้ว แต่พบความเสียหาย จึงยังไม่ปิดออเดอร์อัตโนมัติ —
            ปิดเมื่อเคลียร์ค่าเสียหายกับลูกค้าเรียบร้อยแล้ว
          </p>
          <ul className="mb-3 space-y-1">
            {returnedItems.map((i) => (
              <li key={i.id} className="text-[12.5px]">
                • {i.equipmentName}{" "}
                <span className="font-head text-[11px] text-ink-muted">
                  ({i.serialNumber})
                </span>{" "}
                — {CONDITION_LABEL[i.returnCondition]}
                {i.returnNote ? ` · ${i.returnNote}` : ""}
              </li>
            ))}
          </ul>
          <form action={closeAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <ConfirmButton
              pending={closing}
              disabled={closing}
              confirmTitle={`ปิดออเดอร์ ${order.orderCode}?`}
              confirmDescription="ยืนยันว่าเคลียร์ค่าเสียหายกับลูกค้าเรียบร้อยแล้ว"
              confirmLabel="ปิดออเดอร์"
              tone="safe"
              className="inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {closing ? "กำลังปิด..." : "ปิดออเดอร์"}
            </ConfirmButton>
          </form>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="orderId" value={order.id} />

          <div className="divide-y divide-line">
            {pendingItems.map((item) => {
              const checked = selected.includes(item.id);
              const condition = conditions[item.id] ?? "GOOD";
              const willHitLimit =
                item.rentalCount + 1 >= item.cycleLimit ||
                item.totalDaysUsed + item.days + order.overdueDays >=
                  item.usageDaysLimit;

              return (
                <div key={item.id} className="px-4 py-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      name="returnItemIds"
                      value={item.id}
                      checked={checked}
                      onChange={() => toggle(item.id)}
                      disabled={pending}
                      className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">
                        {item.equipmentName}
                      </span>
                      <span className="block font-head text-[11px] tracking-wide text-ink-muted">
                        {item.serialNumber} · รอบเช่า {item.rentalCount}/
                        {item.cycleLimit} · ใช้งาน {item.totalDaysUsed}/
                        {item.usageDaysLimit} วัน
                      </span>
                    </span>
                  </label>

                  {checked && (
                    <div className="mt-2.5 ml-6.5 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {CONDITIONS.map((c) => (
                          <label
                            key={c}
                            className={`inline-flex h-7 cursor-pointer items-center border px-2.5 font-head text-[11.5px] ${
                              condition === c
                                ? "border-primary bg-primary-soft font-semibold text-primary"
                                : "border-line-strong hover:border-primary"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`condition-${item.id}`}
                              value={c}
                              checked={condition === c}
                              onChange={() =>
                                setConditions((s) => ({ ...s, [item.id]: c }))
                              }
                              className="sr-only"
                            />
                            {CONDITION_LABEL[c]}
                          </label>
                        ))}
                      </div>

                      <input
                        type="text"
                        name={`note-${item.id}`}
                        disabled={pending}
                        placeholder={
                          condition === "DAMAGED"
                            ? "ระบุความเสียหาย (จำเป็น)"
                            : "หมายเหตุ (ไม่บังคับ)"
                        }
                        className="h-8 w-full border border-line bg-canvas px-2.5 text-[12.5px] outline-none focus:border-primary focus:bg-white"
                      />

                      {willHitLimit && condition === "GOOD" && (
                        <p className="text-[11.5px] text-maintenance">
                          ชิ้นนี้จะครบเกณฑ์บำรุงรักษาหลังรับคืน —
                          ระบบจะดึงออกจากคิวจองให้อัตโนมัติ
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
            <span className="text-[12.5px] text-ink-muted">
              เลือกแล้ว <b className="tnum text-ink">{selected.length}</b> /{" "}
              {pendingItems.length} ชิ้น
            </span>

            {order.isOverdue && selected.length > 0 && (
              <span className="text-[12.5px] text-primary">
                ค่าเช่าส่วนเกิน {order.overdueDays} วัน ={" "}
                <b className="tnum">{formatBaht(lateFeePreview)}</b>
              </span>
            )}

            <ConfirmButton
              disabled={pending || selected.length === 0}
              pending={pending}
              confirmTitle={`รับคืน ${selected.length} ชิ้น?`}
              confirmDescription={
                order.isOverdue
                  ? `คืนช้า ${order.overdueDays} วัน — ระบบจะเก็บค่าเช่าส่วนเกิน ${formatBaht(lateFeePreview)} และบันทึกประวัติคืนช้าให้ลูกค้า`
                  : "อุปกรณ์จะกลับเข้าสต็อกตามสภาพที่เลือก และตัวนับรอบบำรุงรักษาจะเพิ่มขึ้น"
              }
              confirmLabel="รับคืน"
              tone="safe"
              className="ml-auto inline-flex h-8 items-center border border-primary bg-primary px-4 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line disabled:text-ink-muted"
            >
              {pending ? "กำลังบันทึก..." : "รับคืนอุปกรณ์"}
            </ConfirmButton>
          </div>
        </form>
      )}
    </div>
  );
}
