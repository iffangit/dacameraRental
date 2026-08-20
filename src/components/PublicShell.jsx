import Link from "next/link";
import { getSession } from "@/lib/auth";

/**
 * โครงหน้าฝั่งลูกค้า — ไม่ต้องล็อกอิน
 *
 * แยกจาก AdminShell เพราะคนละกลุ่มผู้ใช้และคนละเป้าหมาย
 * ฝั่งลูกค้าต้องการเห็นของกับราคาเร็วที่สุด ไม่ต้องมีเมนูจัดการ
 */
export default async function PublicShell({ children }) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-[61px] max-w-[1100px] items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-[34px] shrink-0 place-items-center bg-primary font-head text-[13px] font-bold tracking-wide text-white">
              DC
            </span>
            <span>
              <span className="block font-head text-[14px] font-semibold">
                DaCamera Rental
              </span>
              <span className="block text-[11px] text-ink-muted">
                ให้เช่าอุปกรณ์ถ่ายภาพ · ยะลา
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden h-8 items-center px-3 font-head text-[12.5px] hover:text-primary sm:inline-flex"
            >
              อุปกรณ์ให้เช่า
            </Link>

            {session ? (
              <Link
                href={session.role === "ADMIN" ? "/dashboard" : "/me"}
                className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12.5px] hover:border-primary hover:text-primary"
              >
                {session.role === "ADMIN" ? "หน้าผู้ดูแลระบบ" : "บัญชีของฉัน"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12.5px] hover:border-primary hover:text-primary"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-6">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1100px] px-5 py-5 text-[12px] text-ink-muted">
          <p className="font-head font-semibold text-ink">DaCamera Rental</p>
          <p className="mt-1">
            ระบบบริหารจัดการและจัดคิวเช่าอุปกรณ์การถ่ายภาพ · วิทยาลัยเทคนิคยะลา
          </p>
          <p className="mt-1">
            คิวว่างที่แสดงเป็นข้อมูลเรียลไทม์ — สอบถามและจองได้ที่ร้าน
          </p>
        </div>
      </footer>
    </div>
  );
}
