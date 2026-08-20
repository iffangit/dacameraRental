"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, findNavItem } from "@/lib/nav";
import { logout } from "@/app/login/actions";
import Clock from "./Clock";
import NotificationBell from "./NotificationBell";
import { ToastViewport } from "./Toast";

/**
 * โครงหน้าฝั่งแอดมิน — sidebar ยุบ/ขยายได้ + topbar ที่อ่านชื่อหน้าจาก route
 * รับ badges มาจาก Server Component (layout) เพื่อให้ตัวเลข "รออนุมัติ"
 * บนเมนูเป็นค่าจริงจาก DB ไม่ใช่ค่า hardcode
 */
export default function AdminShell({
  children,
  badges = {},
  admin,
  notifications = { items: [], urgentCount: 0 },
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <div className="flex min-h-screen">
      {/* ---------------- Sidebar ---------------- */}
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-16 md:w-[236px]"
        }`}
      >
        {/* Brand */}
        <div className="flex h-[61px] shrink-0 items-center gap-2.5 overflow-hidden border-b border-line px-3.5">
          <div className="grid size-[34px] shrink-0 place-items-center bg-primary font-head text-[13px] font-bold tracking-wide text-white">
            DC
          </div>
          {!collapsed && (
            <div className="hidden min-w-0 md:block">
              <div className="whitespace-nowrap font-head text-[13.5px] font-semibold">
                DaCamera Rental
              </div>
              <div className="whitespace-nowrap text-[11px] text-ink-muted">
                Admin Console v1.0
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="hidden px-4 pt-2.5 pb-1.5 font-head text-[10.5px] font-semibold tracking-[0.09em] text-ink-muted uppercase md:block">
                  {group.label}
                </div>
              )}
              {collapsed && <div className="h-3" />}

              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badgeKey ? badges[item.badgeKey] : null;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    className={`flex w-full items-center gap-3 border-l-[3px] px-4 py-2.5 transition-colors ${
                      active
                        ? "border-primary bg-primary-soft font-semibold text-primary"
                        : "border-transparent text-ink-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span
                      className={`tag shrink-0 ${
                        active ? "border-primary bg-white text-primary" : ""
                      }`}
                    >
                      {item.tag}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="hidden overflow-hidden whitespace-nowrap text-[13.5px] md:block">
                          {item.title}
                        </span>
                        {badge > 0 && (
                          <span className="ml-auto hidden h-[19px] min-w-[19px] place-items-center bg-primary px-1.5 font-head text-[10.5px] font-semibold text-white md:grid">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ผู้ใช้ที่ล็อกอิน */}
        <div className="border-t border-line p-2.5">
          <div className="flex items-center gap-2.5 px-1.5 py-1.5">
            <div className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary font-head text-xs font-semibold text-white">
              {admin.fullName.charAt(0)}
            </div>
            {!collapsed && (
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-[12.5px] font-semibold">
                  {admin.fullName}
                </div>
                <div className="truncate text-[11px] text-ink-muted">
                  {admin.email}
                </div>
              </div>
            )}
          </div>

          <form action={logout}>
            <button
              type="submit"
              title="ออกจากระบบ"
              className="mt-1 flex w-full items-center gap-3 px-1.5 py-1.5 text-ink-muted hover:text-primary"
            >
              <span className="grid size-[30px] shrink-0 place-items-center border border-line">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="size-3.5"
                >
                  <path d="M6 2H3v12h3M10 11l3-3-3-3M13 8H6" strokeLinecap="square" />
                </svg>
              </span>
              {!collapsed && (
                <span className="hidden text-[12.5px] md:block">ออกจากระบบ</span>
              )}
            </button>
          </form>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[61px] items-center gap-3.5 border-b border-line bg-surface px-5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="ย่อ/ขยายเมนู"
            title="ย่อ/ขยายเมนู"
            className="grid size-8 shrink-0 place-items-center border border-line text-ink-muted hover:border-primary hover:text-primary"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="square"
              className="size-[15px]"
            >
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="truncate font-head text-base font-semibold">
              {current.title}
            </div>
            <div className="truncate text-[11.5px] text-ink-muted">
              {current.subtitle}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <label className="hidden h-8 min-w-[210px] items-center gap-2 border border-line bg-canvas px-2.5 focus-within:border-primary focus-within:bg-white lg:flex">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-[13px] shrink-0 text-ink-muted"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" strokeLinecap="square" />
              </svg>
              <input
                type="text"
                placeholder="ค้นหาอุปกรณ์ / Serial No. / สมาชิก"
                className="w-full bg-transparent text-[12.5px] outline-none"
              />
            </label>
            <NotificationBell
              items={notifications.items}
              urgentCount={notifications.urgentCount}
            />
            <Clock />
          </div>
        </header>

        <div className="flex-1 p-5">{children}</div>
      </div>

      <ToastViewport />
    </div>
  );
}
