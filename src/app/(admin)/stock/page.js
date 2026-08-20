import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHead, StatusBadge, CycleBar } from "@/components/ui";
import {
  BLOCKING_ORDER_STATUSES,
  UNIT_STATUS,
  formatBaht,
  formatThaiDate,
} from "@/lib/domain";
import { today } from "@/lib/queue";
import AddUnitPanel from "./AddUnitPanel";
import EquipmentTable from "./EquipmentTable";
import UnitStatusForm from "./UnitStatusForm";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "", label: "ทั้งหมด" },
  { key: "AVAILABLE", label: "ว่าง" },
  { key: "RENTED", label: "ถูกเช่า" },
  { key: "CLEANING", label: "รอทำความสะอาด" },
  { key: "MAINTENANCE", label: "ซ่อมบำรุง" },
];

function buildQuery(params, patch) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (v) next.set(k, String(v));
  }
  const qs = next.toString();
  return qs ? `/stock?${qs}` : "/stock";
}

async function loadStock({ q, status, category, retired }) {
  const where = {
    // ปลดระวางแล้วถูกซ่อนไว้เป็นค่าเริ่มต้น (Soft Delete ตาม CRUD Matrix)
    ...(retired ? {} : { isActive: true }),
    ...(status ? { status } : {}),
    ...(category ? { equipment: { categoryId: Number(category) } } : {}),
    ...(q
      ? {
          OR: [
            { serialNumber: { contains: q } },
            { equipment: { name: { contains: q } } },
            { equipment: { brand: { name: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [units, categories, brands, statusCounts, equipments, totalActive] =
    await Promise.all([
      prisma.equipmentUnit.findMany({
        where,
        include: {
          equipment: {
            select: {
              name: true,
              brand: { select: { name: true } },
              dailyRate: true,
              replacementValue: true,
              category: { select: { id: true, name: true, sortOrder: true } },
            },
          },
          // คิวถัดไปที่ยังไม่จบ ใช้เตือนก่อนปลดระวาง
          orderItems: {
            where: {
              endDate: { gte: today() },
              order: { status: { in: BLOCKING_ORDER_STATUSES } },
            },
            orderBy: { startDate: "asc" },
            take: 1,
            include: {
              order: {
                select: {
                  orderCode: true,
                  customer: { select: { fullName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true },
      }),
      prisma.equipmentUnit.groupBy({
        by: ["status"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.equipment.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          brand: { select: { id: true, name: true, code: true } },
          code: true,
          imageUrl: true,
          description: true,
          dailyRate: true,
          replacementValue: true,
          categoryId: true,
          category: { select: { name: true } },
          _count: { select: { units: true } },
        },
      }),
      prisma.equipmentUnit.count({ where: { isActive: true } }),
    ]);

  units.sort(
    (a, b) =>
      a.equipment.category.sortOrder - b.equipment.category.sortOrder ||
      a.equipment.name.localeCompare(b.equipment.name, "th") ||
      a.serialNumber.localeCompare(b.serialNumber),
  );

  return {
    units,
    categories,
    brands,
    totalActive,
    counts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    // แปลง Decimal เป็น number ตั้งแต่ฝั่ง server เพราะ Client Component
    // รับ Decimal ของ Prisma ไม่ได้ (ไม่ใช่ค่าที่ serialize ข้ามไปได้)
    equipments: equipments.map((e) => ({
      id: e.id,
      name: e.name,
      brandId: e.brand.id,
      brandName: e.brand.name,
      brandCode: e.brand.code,
      code: e.code,
      imageUrl: e.imageUrl,
      description: e.description,
      dailyRate: Number(e.dailyRate),
      replacementValue: Number(e.replacementValue),
      categoryId: e.categoryId,
      categoryName: e.category.name,
      unitCount: e._count.units,
    })),
  };
}

export default async function StockPage({ searchParams }) {
  const params = await searchParams;
  const q = params?.q ?? "";
  const status = params?.status ?? "";
  const category = params?.category ?? "";
  const retired = params?.retired ?? "";

  const data = await loadStock({ q, status, category, retired });
  const current = { q, status, category, retired };

  return (
    <div className="flex flex-col gap-4">
      <AddUnitPanel
        equipments={data.equipments}
        categories={data.categories}
        brands={data.brands}
      />

      <EquipmentTable
        equipments={data.equipments}
        categories={data.categories}
        brands={data.brands}
      />

      {/* ---------------- ตัวกรอง ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.key;
          const count = f.key ? (data.counts[f.key] ?? 0) : data.totalActive;
          return (
            <Link
              key={f.key || "all"}
              href={buildQuery(current, { status: f.key })}
              className={`inline-flex h-8 items-center gap-1.5 border px-3 font-head text-[12.5px] ${
                active
                  ? "border-primary bg-primary-soft font-semibold text-primary"
                  : "border-line-strong bg-surface hover:border-primary hover:text-primary"
              }`}
            >
              {f.label}
              <span className="tnum text-[11.5px] opacity-70">{count}</span>
            </Link>
          );
        })}

        <form action="/stock" className="ml-auto flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {category && <input type="hidden" name="category" value={category} />}
          {retired && <input type="hidden" name="retired" value={retired} />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="ค้นหาชื่อรุ่น / ยี่ห้อ / Serial No."
            className="h-8 w-[240px] border border-line bg-surface px-2.5 text-[12.5px] outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="h-8 border border-line-strong bg-surface px-3 font-head text-[12.5px] hover:border-primary hover:text-primary"
          >
            ค้นหา
          </button>
          {(q || status || category || retired) && (
            <Link
              href="/stock"
              className="h-8 border border-line-strong bg-surface px-3 font-head text-[12.5px] leading-8 hover:border-primary hover:text-primary"
            >
              ล้าง
            </Link>
          )}
        </form>
      </div>

      {/* กรองตามหมวดหมู่ + สลับดูของที่ปลดระวาง */}
      <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
        <span className="text-ink-muted">หมวดหมู่:</span>
        <Link
          href={buildQuery(current, { category: "" })}
          className={category ? "text-ink-muted hover:text-primary" : "font-semibold text-primary"}
        >
          ทั้งหมด
        </Link>
        {data.categories.map((c) => (
          <Link
            key={c.id}
            href={buildQuery(current, { category: c.id })}
            className={
              String(c.id) === String(category)
                ? "font-semibold text-primary"
                : "text-ink-muted hover:text-primary"
            }
          >
            {c.name}
          </Link>
        ))}
        <Link
          href={buildQuery(current, { retired: retired ? "" : "1" })}
          className={`ml-auto ${retired ? "font-semibold text-primary" : "text-ink-muted hover:text-primary"}`}
        >
          {retired ? "✓ รวมของที่ปลดระวางแล้ว" : "แสดงของที่ปลดระวางแล้วด้วย"}
        </Link>
      </div>

      {/* ---------------- ตารางสต็อก ---------------- */}
      <Card>
        <CardHead
          title="อุปกรณ์รายชิ้น"
          hint={`แสดง ${data.units.length} รายการ`}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "อุปกรณ์ / Serial No.",
                  "หมวดหมู่",
                  "ค่าเช่า/วัน",
                  "สถานะ",
                  "รอบเช่า",
                  "วันใช้งาน",
                  "คิวถัดไป",
                  "เปลี่ยนสถานะ",
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-line bg-canvas px-4 py-2.5 text-left font-head text-[11px] font-semibold tracking-[0.05em] whitespace-nowrap text-ink-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.units.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[13px] text-ink-muted"
                  >
                    ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}

              {data.units.map((unit) => {
                const next = unit.orderItems[0];
                const isRetired = unit.status === "RETIRED";

                return (
                  <tr
                    key={unit.id}
                    className={`border-b border-line last:border-b-0 ${
                      isRetired ? "opacity-50" : "hover:bg-primary-soft/40"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-[13px] font-semibold">
                        {unit.equipment.name}
                      </div>
                      <div className="font-head text-[11px] tracking-wide text-ink-muted">
                        {unit.serialNumber} · {unit.equipment.brand.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] whitespace-nowrap">
                      {unit.equipment.category.name}
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px] whitespace-nowrap">
                      {formatBaht(Number(unit.equipment.dailyRate))}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={unit.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <CycleBar
                        current={unit.rentalCount}
                        limit={unit.cycleLimit}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <CycleBar
                        current={unit.totalDaysUsed}
                        limit={unit.usageDaysLimit}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] whitespace-nowrap">
                      {next ? (
                        <>
                          <div className="tnum">
                            {formatThaiDate(next.startDate)}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {next.order.orderCode} ·{" "}
                            {next.order.customer.fullName}
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-muted">ไม่มีคิว</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <UnitStatusForm
                        unitId={unit.id}
                        currentStatus={unit.status}
                        serialNumber={unit.serialNumber}
                        equipmentName={unit.equipment.name}
                        disabled={isRetired}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        สถานะ <b>{UNIT_STATUS.RENTED.label}</b> ตั้งเองไม่ได้ — ต้องเกิดจากการอนุมัติคำขอเช่าเท่านั้น
        เพื่อไม่ให้ตัวเลขในระบบเพี้ยนจากคิวจริง · การปลดระวางเป็น <b>Soft Delete</b> (ซ่อนจากระบบ
        แต่ไม่ลบประวัติการเช่า) และทำไม่ได้ถ้าอุปกรณ์ยังมีคิวค้างอยู่ ·
        เมื่อปิดงานซ่อมบำรุงกลับมาเป็น <b>ว่าง</b> ระบบจะรีเซ็ตตัวนับรอบให้อัตโนมัติ (REQ-RISK-003)
      </p>
    </div>
  );
}
