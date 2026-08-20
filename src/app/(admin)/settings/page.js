import { prisma } from "@/lib/prisma";
import { getShopSettings } from "@/lib/settings";
import { listBrands } from "@/lib/brands";
import { Card, CardHead } from "@/components/ui";
import { formatThaiDate, formatThaiTime } from "@/lib/domain";
import SettingsForm from "./SettingsForm";
import BrandManager from "./BrandManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, brands] = await Promise.all([
    getShopSettings(prisma),
    listBrands(prisma),
  ]);

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <Card>
        <CardHead
          title="การเงิน"
          hint={
            settings.isDefault
              ? "ยังไม่เคยตั้งค่า — ใช้ค่าเริ่มต้นอยู่"
              : `แก้ไขล่าสุด ${formatThaiDate(settings.updatedAt)} ${formatThaiTime(settings.updatedAt)}`
          }
        />
        <SettingsForm current={settings.bookingDeposit} />
      </Card>

      <BrandManager brands={brands} />

      <p className="text-[12px] leading-relaxed text-ink-muted">
        เงินมัดจำจองคิวมีไว้กันลูกค้าจองแล้วไม่มารับของ จึงเป็นจำนวนเงินคงที่
        ไม่ผูกกับมูลค่าอุปกรณ์และไม่ผูกกับเกรดลูกค้า —
        ส่วน<b>เกรดลูกค้า (A/B/C)</b> มีผลกับลำดับและเงื่อนไขการอนุมัติคิวแทน
        (REQ-RISK-001) · <b>มูลค่าทรัพย์สิน</b> ที่กรอกไว้ในหน้าจัดการสต็อก
        ใช้ประเมินค่าเสียหายตอนรับคืน ไม่ได้ใช้คำนวณมัดจำ
      </p>
    </div>
  );
}
