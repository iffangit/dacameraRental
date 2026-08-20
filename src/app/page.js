import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { loadCatalog } from "@/lib/catalog";
import { formatBaht } from "@/lib/domain";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "อุปกรณ์ให้เช่า | DaCamera Rental",
  description:
    "เช่ากล้อง เลนส์ และอุปกรณ์ถ่ายภาพในยะลา ดูคิวว่างแบบเรียลไทม์",
};

export default async function PublicCatalogPage({ searchParams }) {
  const params = await searchParams;
  const q = params?.q ?? "";
  const categoryId = params?.category ?? "";

  const [items, categories] = await Promise.all([
    loadCatalog(prisma, { q, categoryId }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const freeNow = items.reduce((sum, i) => sum + i.freeToday, 0);

  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="font-head text-[20px] font-semibold">อุปกรณ์ให้เช่า</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {items.length} รุ่น · ว่างพร้อมให้เช่าวันนี้{" "}
          <b className="text-available">{freeNow} ชิ้น</b> ·
          กดที่อุปกรณ์เพื่อดูคิวว่าง 14 วันข้างหน้า
        </p>
      </div>

      {/* ---- ค้นหา + กรองหมวดหมู่ ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={q ? `/?q=${encodeURIComponent(q)}` : "/"}
          className={`inline-flex h-8 items-center border px-3 font-head text-[12.5px] ${
            categoryId
              ? "border-line-strong bg-surface hover:border-primary hover:text-primary"
              : "border-primary bg-primary-soft font-semibold text-primary"
          }`}
        >
          ทั้งหมด
        </Link>
        {categories.map((c) => {
          const active = String(c.id) === String(categoryId);
          const href = `/?category=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={c.id}
              href={href}
              className={`inline-flex h-8 items-center border px-3 font-head text-[12.5px] ${
                active
                  ? "border-primary bg-primary-soft font-semibold text-primary"
                  : "border-line-strong bg-surface hover:border-primary hover:text-primary"
              }`}
            >
              {c.name}
            </Link>
          );
        })}

        <form action="/" className="ml-auto flex items-center gap-2">
          {categoryId && (
            <input type="hidden" name="category" value={categoryId} />
          )}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="ค้นหารุ่น / ยี่ห้อ"
            className="h-8 w-[200px] border border-line bg-surface px-2.5 text-[12.5px] outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="h-8 border border-line-strong bg-surface px-3 font-head text-[12.5px] hover:border-primary hover:text-primary"
          >
            ค้นหา
          </button>
        </form>
      </div>

      {/* ---- รายการอุปกรณ์ ---- */}
      {items.length === 0 ? (
        <div className="border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="text-[13px] text-ink-muted">
            ไม่พบอุปกรณ์ที่ค้นหา — ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/equipment/${item.id}`}
              className="group flex flex-col border border-line bg-surface transition-colors hover:border-primary"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-head text-[11px] tracking-wide text-ink-muted">
                      ยังไม่มีรูป
                    </span>
                  </div>
                )}

                <span
                  className="absolute top-2 left-2 border px-1.5 py-0.5 font-head text-[10.5px] font-semibold"
                  style={
                    item.freeToday > 0
                      ? {
                          background: "var(--color-available)",
                          borderColor: "var(--color-available)",
                          color: "white",
                        }
                      : {
                          background: "var(--color-surface)",
                          borderColor: "var(--color-line-strong)",
                          color: "var(--color-ink-muted)",
                        }
                  }
                >
                  {item.freeToday > 0
                    ? `ว่างวันนี้ ${item.freeToday} ชิ้น`
                    : "วันนี้ไม่ว่าง"}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-3.5">
                <div className="text-[11px] text-ink-muted">
                  {item.brandName} · {item.categoryName}
                </div>
                <h2 className="mt-0.5 font-head text-[14px] font-semibold group-hover:text-primary">
                  {item.name}
                </h2>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] text-ink-muted">
                    {item.description}
                  </p>
                )}

                <div className="mt-auto flex items-baseline gap-1.5 pt-3">
                  <span className="tnum font-head text-[18px] font-semibold">
                    {formatBaht(item.dailyRate)}
                  </span>
                  <span className="text-[12px] text-ink-muted">/ วัน</span>
                  <span className="ml-auto text-[11.5px] text-ink-muted">
                    มีทั้งหมด {item.totalUnits} ชิ้น
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
