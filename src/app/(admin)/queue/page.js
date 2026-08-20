import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, StatusBadge } from "@/components/ui";
import { BLOCKING_ORDER_STATUSES, formatThaiDate } from "@/lib/domain";
import {
  CELL_STATE,
  DAY_MS,
  QUEUE_DAYS,
  buildDays,
  buildQueueGrid,
  dayKey,
  parseDayKey,
  summarise,
  today,
} from "@/lib/queue";

export const dynamic = "force-dynamic";

const THAI_DAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

async function loadQueue(rangeStart) {
  const rangeEnd = new Date(rangeStart.getTime() + (QUEUE_DAYS - 1) * DAY_MS);

  const units = await prisma.equipmentUnit.findMany({
    where: { isActive: true },
    include: {
      equipment: {
        select: {
          name: true,
          brand: { select: { name: true } },
          dailyRate: true,
          category: { select: { name: true, sortOrder: true } },
        },
      },
      // ดึงเฉพาะการจองที่ทับกับช่วง 7 วันที่กำลังดู และเฉพาะสถานะที่ยังกินคิว
      orderItems: {
        where: {
          order: { status: { in: BLOCKING_ORDER_STATUSES } },
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
        },
        include: {
          order: {
            select: {
              orderCode: true,
              status: true,
              customer: { select: { fullName: true, grade: true } },
            },
          },
        },
      },
    },
  });

  // เรียงตามหมวดหมู่ → ชื่อรุ่น → Serial No. เพื่อให้ของชนิดเดียวกันอยู่ติดกัน
  units.sort(
    (a, b) =>
      a.equipment.category.sortOrder - b.equipment.category.sortOrder ||
      a.equipment.name.localeCompare(b.equipment.name, "th") ||
      a.serialNumber.localeCompare(b.serialNumber),
  );

  return { units, rangeEnd };
}

export default async function QueuePage({ searchParams }) {
  const params = await searchParams;

  const todayDate = today();
  const todayKey = dayKey(todayDate);
  const rangeStart = parseDayKey(params?.start) ?? todayDate;

  const { units, rangeEnd } = await loadQueue(rangeStart);
  const days = buildDays(rangeStart, QUEUE_DAYS);
  const rows = buildQueueGrid(units, days, todayKey);
  const counts = summarise(rows);

  const prevKey = dayKey(new Date(rangeStart.getTime() - QUEUE_DAYS * DAY_MS));
  const nextKey = dayKey(new Date(rangeStart.getTime() + QUEUE_DAYS * DAY_MS));
  const isCurrentWeek = dayKey(rangeStart) === todayKey;

  return (
    <>
      {/* ---------------- แถบควบคุมช่วงวันที่ ---------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center">
          <Link
            href={`/queue?start=${prevKey}`}
            aria-label="สัปดาห์ก่อนหน้า"
            className="grid size-8 place-items-center border border-line-strong bg-surface hover:border-primary hover:text-primary"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5">
              <path d="M10 3L5 8l5 5" strokeLinecap="square" />
            </svg>
          </Link>
          <Link
            href="/queue"
            className={`inline-flex h-8 items-center border border-l-0 border-line-strong px-3 font-head text-[12.5px] ${
              isCurrentWeek
                ? "bg-primary-soft font-semibold text-primary"
                : "bg-surface hover:border-primary hover:text-primary"
            }`}
          >
            วันนี้
          </Link>
          <Link
            href={`/queue?start=${nextKey}`}
            aria-label="สัปดาห์ถัดไป"
            className="grid size-8 place-items-center border border-l-0 border-line-strong bg-surface hover:border-primary hover:text-primary"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5">
              <path d="M6 3l5 5-5 5" strokeLinecap="square" />
            </svg>
          </Link>
        </div>

        <div className="font-head text-[13.5px] font-semibold">
          {formatThaiDate(rangeStart)} – {formatThaiDate(rangeEnd)}
        </div>

        {/* ---- Legend ---- */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {Object.entries(CELL_STATE).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11.5px]">
              <i
                className="size-3.5 shrink-0 border"
                style={{ background: meta.fill, borderColor: meta.border }}
              />
              <span className="text-ink-muted">{meta.label}</span>
              <span className="tnum font-head font-semibold">
                {counts[key]}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- ตารางคิว ---------------- */}
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px] border-r border-b border-line bg-canvas px-4 py-2.5 text-left font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
                อุปกรณ์ / Serial No.
              </th>
              {days.map((day) => {
                const isToday = day.key === todayKey;
                const isWeekend = [0, 6].includes(day.date.getUTCDay());
                return (
                  <th
                    key={day.key}
                    className={`min-w-[92px] border-b border-line px-2 py-2 text-center font-head ${
                      isToday
                        ? "bg-primary-soft text-primary"
                        : isWeekend
                          ? "bg-canvas text-ink-muted"
                          : "bg-canvas text-ink-muted"
                    }`}
                  >
                    <div className="text-[10.5px] tracking-wide uppercase">
                      {THAI_DAY_SHORT[day.date.getUTCDay()]}
                    </div>
                    <div
                      className={`tnum text-[13px] ${isToday ? "font-bold" : "font-semibold text-ink"}`}
                    >
                      {day.date.getUTCDate()}
                    </div>
                    <div className="text-[10px]">
                      {THAI_MONTH_SHORT[day.date.getUTCMonth()]}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const prevRow = rows[index - 1];
              const categoryName = row.unit.equipment.category.name;
              const startsGroup =
                prevRow?.unit.equipment.category.name !== categoryName;

              return (
                <Fragment key={row.unit.id}>
                  {startsGroup && (
                    <tr>
                      <td
                        colSpan={days.length + 1}
                        className="sticky left-0 border-y border-line bg-canvas px-4 py-1.5 font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
                      >
                        {categoryName}
                      </td>
                    </tr>
                  )}

                  <tr className="hover:bg-primary-soft/40">
                    <td className="sticky left-0 z-10 border-r border-b border-line bg-surface px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">
                            {row.unit.equipment.name}
                          </div>
                          <div className="font-head text-[11px] tracking-wide text-ink-muted">
                            {row.unit.serialNumber}
                          </div>
                        </div>
                        <StatusBadge status={row.unit.status} />
                      </div>
                    </td>

                    {row.cells.map((cell) => {
                      const meta = CELL_STATE[cell.state];
                      const order = cell.booking?.order;

                      return (
                        <td
                          key={cell.key}
                          className={`border-b border-line px-1 py-1 text-center align-middle ${
                            cell.isToday ? "bg-primary-soft/40" : ""
                          }`}
                          title={
                            order
                              ? `${meta.label} · ${order.orderCode} · ${order.customer.fullName}`
                              : `${meta.label} · ${row.unit.serialNumber}`
                          }
                        >
                          <div
                            className="flex h-8 items-center justify-center overflow-hidden border px-1"
                            style={{
                              background: meta.fill,
                              borderColor: meta.border,
                            }}
                          >
                            {cell.runStart && (
                              <span
                                className="truncate font-head text-[10.5px] font-semibold"
                                style={{ color: meta.text }}
                              >
                                {order.customer.fullName.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ---------------- คำอธิบายกฎกันจองซ้อน ---------------- */}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        ปฏิทินนี้แสดงคิวแยกตาม <b>Serial Number รายตัว</b> ไม่ใช่ยอดรวมของรุ่น
        อุปกรณ์รุ่นเดียวกันจึงมีคิวคนละแถว และช่องที่ถูกจองไว้แล้วจะไม่ถูกเสนอให้จองซ้ำ
        (REQ-RENT-002) ส่วนช่อง <b>จองแล้ว (รออนุมัติ)</b> คือคำขอที่ยังไม่ผ่านการอนุมัติ
        แต่ระบบกันคิวไว้ให้แล้วเพื่อไม่ให้เกิดการจองซ้อน
      </p>
    </>
  );
}
