import AdminShell from "@/components/AdminShell";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";

// ตัวเลขบนเมนูต้องสดเสมอ ไม่ให้ Next แคชหน้าไว้แบบ static
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  // ด่านเดียวที่คุมทุกหน้าในกลุ่ม (admin) — ไม่ใช่แอดมินจะถูกเด้งไปหน้า login
  const admin = await requireAdmin();

  // นับคำขอที่รออนุมัติไว้แสดงเป็น badge บนเมนู (REQ-RENT-005)
  const [pendingOrders, openReturns, notifications] = await Promise.all([
    prisma.rentalOrder.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.rentalOrder.count({
      where: { status: { in: ["ACTIVE_RENTAL", "RETURNED_INSPECTED"] } },
    }),
    getNotifications(prisma),
  ]);

  return (
    <AdminShell
      badges={{ pendingOrders, openReturns }}
      admin={admin}
      notifications={notifications}
    >
      {children}
    </AdminShell>
  );
}
