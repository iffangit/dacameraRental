import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "เข้าสู่ระบบ | Smart Camera & Equipment Rental",
};

const ERROR_MESSAGES = {
  forbidden: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าผู้ดูแลระบบ",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const session = await getSession();

  // ล็อกอินอยู่แล้วไม่ต้องเห็นหน้านี้ซ้ำ — ยกเว้นกรณีถูกเด้งมาเพราะสิทธิ์ไม่พอ
  if (session && params?.error !== "forbidden") {
    redirect(session.role === "ADMIN" ? "/dashboard" : "/me");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center bg-primary font-head text-[15px] font-bold tracking-wide text-white">
            DC
          </div>
          <div>
            <h1 className="font-head text-[16px] font-semibold">
              DaCamera Rental
            </h1>
            <p className="text-[12px] text-ink-muted">
              ระบบบริหารจัดการและจัดคิวเช่าอุปกรณ์ถ่ายภาพ
            </p>
          </div>
        </div>

        <LoginForm
          next={params?.next}
          initialError={ERROR_MESSAGES[params?.error]}
        />

        <p className="mt-4 text-center text-[11.5px] text-ink-muted">
          วิทยาลัยเทคนิคยะลา · Yala Technical College
        </p>
      </div>
    </main>
  );
}
