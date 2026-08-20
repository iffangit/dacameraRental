"use client";

import { useActionState, useState } from "react";
import { changeUnitStatus } from "./actions";
import { MANUAL_UNIT_STATUSES } from "@/lib/stock";
import { UNIT_STATUS } from "@/lib/domain";
import { withToast } from "@/components/Toast";
import ConfirmButton from "@/components/ConfirmButton";

/**
 * ตัวควบคุมสถานะประจำแถวในตารางสต็อก
 *
 * ช่องหมายเหตุจะโผล่ก็ต่อเมื่อเลือกสถานะที่ต้องอธิบาย (ส่งซ่อม/ทำความสะอาด/ปลดระวาง)
 * เพื่อไม่ให้ตารางรกด้วยช่องกรอกที่ส่วนใหญ่ไม่ได้ใช้
 *
 * การปลดระวางถามยืนยันก่อน เพราะเป็นการเอาอุปกรณ์ออกจากระบบ
 * ส่วนการเปลี่ยนสถานะอื่นกดแล้วเปลี่ยนกลับได้ จึงไม่ต้องถาม
 */
export default function UnitStatusForm({
  unitId,
  currentStatus,
  serialNumber,
  equipmentName,
  disabled,
}) {
  const [, formAction, pending] = useActionState(
    withToast(changeUnitStatus),
    null,
  );
  const [selected, setSelected] = useState(currentStatus);

  const changed = selected !== currentStatus;
  const needsNote = changed && selected !== "AVAILABLE";
  const isRetiring = selected === "RETIRED";

  const buttonClass =
    "h-7 shrink-0 border border-line-strong px-2 font-head text-[11.5px] hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="unitId" value={unitId} />

      <div className="flex items-center gap-1.5">
        <select
          name="nextStatus"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending || disabled}
          aria-label={`เปลี่ยนสถานะของ ${serialNumber}`}
          className="h-7 min-w-[132px] border border-line bg-canvas px-1.5 text-[12px] outline-none focus:border-primary focus:bg-white disabled:opacity-50"
        >
          {/* สถานะปัจจุบันอาจเป็น RENTED ซึ่งตั้งเองไม่ได้ จึงต้องมีเป็นตัวเลือกตั้งต้น */}
          {!MANUAL_UNIT_STATUSES.includes(currentStatus) && (
            <option value={currentStatus}>
              {UNIT_STATUS[currentStatus].label} (ปัจจุบัน)
            </option>
          )}
          {MANUAL_UNIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {UNIT_STATUS[s].label}
              {s === currentStatus ? " (ปัจจุบัน)" : ""}
            </option>
          ))}
        </select>

        {isRetiring ? (
          <ConfirmButton
            disabled={pending || disabled || !changed}
            pending={pending}
            tone="danger"
            confirmTitle={`ปลดระวาง ${serialNumber}?`}
            confirmDescription={`${equipmentName} จะถูกซ่อนจากระบบและเช่าต่อไม่ได้ แต่ประวัติการเช่าเดิมยังอยู่ครบ`}
            confirmLabel="ปลดระวาง"
            className={buttonClass}
          >
            บันทึก
          </ConfirmButton>
        ) : (
          <button
            type="submit"
            disabled={pending || disabled || !changed}
            className={buttonClass}
          >
            {pending ? "..." : "บันทึก"}
          </button>
        )}
      </div>

      {needsNote && (
        <input
          type="text"
          name="note"
          placeholder="หมายเหตุ เช่น อาการเสีย"
          disabled={pending}
          className="h-7 w-full border border-line bg-canvas px-2 text-[12px] outline-none focus:border-primary focus:bg-white"
        />
      )}
    </form>
  );
}
