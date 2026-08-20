import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPublicAvailability, PUBLIC_DAYS } from "@/lib/catalog";
import { formatBaht } from "@/lib/domain";
import { dayKey, today } from "@/lib/queue";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";

const THAI_DAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export async function generateMetadata({ params }) {
  const { id } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { id: Number(id) || 0 },
    select: { name: true, isActive: true },
  });

  return {
    title: equipment?.isActive
      ? `${equipment.name} | DaCamera Rental`
      : "ไม่พบอุปกรณ์ | DaCamera Rental",
  };
}

export default async function EquipmentDetailPage({ params }) {
  const { id } = await params;
  const item = await loadPublicAvailability(prisma, Number(id) || 0);

  if (!item) notFound();

  const todayKey = dayKey(today());
  const freeToday = item.days[0]?.free ?? 0;

  return (
    <PublicShell>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-primary"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5">
          <path d="M10 3L5 8l5 5" strokeLinecap="square" />
        </svg>
        กลับไปหน้าอุปกรณ์ทั้งหมด
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        {/* ---- รูปและราคา ---- */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden border border-line bg-canvas">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="(max-width: 1024px) 100vw, 380px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-head text-[12px] text-ink-muted">
                  ยังไม่มีรูป
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 border border-line bg-surface p-4">
            <div className="text-[12px] text-ink-muted">
              {item.brandName} · {item.categoryName}
            </div>
            <h1 className="mt-0.5 font-head text-[18px] font-semibold">
              {item.name}
            </h1>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="tnum font-head text-[24px] font-semibold">
                {formatBaht(item.dailyRate)}
              </span>
              <span className="text-[13px] text-ink-muted">/ วัน</span>
            </div>

            <p
              className="mt-3 border-l-[3px] px-3 py-2 text-[12.5px]"
              style={
                freeToday > 0
                  ? {
                      borderColor: "var(--color-available)",
                      background:
                        "color-mix(in oklch, var(--color-available) 8%, white)",
                      color: "var(--color-available)",
                    }
                  : {
                      borderColor: "var(--color-line-strong)",
                      background: "var(--color-canvas)",
                      color: "var(--color-ink-muted)",
                    }
              }
            >
              {freeToday > 0
                ? `วันนี้ว่าง ${freeToday} จาก ${item.totalUnits} ชิ้น`
                : `วันนี้ไม่ว่าง — ดูวันอื่นในตารางด้านขวา`}
            </p>

            {item.description && (
              <p className="mt-3 text-[13px] leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* ---- ปฏิทินความว่าง ---- */}
        <div>
          <div className="border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
              <h2 className="font-head text-[13.5px] font-semibold">
                คิวว่าง {PUBLIC_DAYS} วันข้างหน้า
              </h2>
              <span className="text-[11.5px] text-ink-muted">
                อัปเดตเรียลไทม์
              </span>
            </div>

            <div className="grid grid-cols-7 gap-px bg-line p-px">
              {item.days.map((day) => {
                const isToday = day.key === todayKey;
                const isFree = day.free > 0;

                return (
                  <div
                    key={day.key}
                    className="flex flex-col items-center gap-1 bg-surface px-1 py-2.5"
                    title={
                      isFree
                        ? `ว่าง ${day.free} ชิ้น`
                        : "ไม่ว่าง — ถูกจองครบแล้ว"
                    }
                  >
                    <span className="font-head text-[10px] text-ink-muted">
                      {THAI_DAY_SHORT[day.date.getUTCDay()]}
                    </span>
                    <span
                      className={`tnum font-head text-[13px] ${
                        isToday ? "font-bold text-primary" : "font-semibold"
                      }`}
                    >
                      {day.date.getUTCDate()}
                    </span>
                    <span className="font-head text-[9.5px] text-ink-muted">
                      {THAI_MONTH_SHORT[day.date.getUTCMonth()]}
                    </span>

                    <span
                      className="mt-1 grid h-7 w-full place-items-center border font-head text-[11px] font-semibold"
                      style={
                        isFree
                          ? {
                              background: "var(--color-available)",
                              borderColor: "var(--color-available)",
                              color: "white",
                            }
                          : {
                              background: "var(--color-canvas)",
                              borderColor: "var(--color-line-strong)",
                              color: "var(--color-ink-muted)",
                            }
                      }
                    >
                      {isFree ? day.free : "เต็ม"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            ตัวเลขในช่องคือ<b>จำนวนชิ้นที่ยังว่าง</b>ในวันนั้น ·
            อุปกรณ์ที่อยู่ระหว่างส่งซ่อมหรือรอทำความสะอาดจะไม่ถูกนับ ·
            ต้องการจองกรุณาติดต่อร้านโดยตรง
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
