/**
 * โครงสร้างเมนูฝั่งแอดมิน — ใช้ร่วมกันระหว่าง Sidebar และ Topbar
 * (Topbar อ่าน title/subtitle จากที่นี่ตาม pathname ปัจจุบัน)
 */
export const NAV_GROUPS = [
  {
    label: "การจัดการ",
    items: [
      {
        href: "/dashboard",
        tag: "EQ",
        title: "Dashboard",
        subtitle: "ภาพรวมสถานะอุปกรณ์และคิวเช่าแบบเรียลไทม์",
      },
      {
        href: "/walkin",
        tag: "POS",
        title: "เช่าหน้าร้าน",
        subtitle: "จัดเซ็ตอุปกรณ์และทำรายการให้ลูกค้าที่มาที่ร้าน",
      },
      {
        href: "/returns",
        tag: "RET",
        title: "รับคืนอุปกรณ์",
        subtitle: "ตรวจสภาพและรับของกลับเข้าสต็อก",
        badgeKey: "openReturns",
      },
      {
        href: "/queue",
        tag: "RT",
        title: "ตารางคิวอุปกรณ์",
        subtitle: "ปฏิทินความว่างรายอุปกรณ์ 7 วันข้างหน้า",
      },
      {
        href: "/stock",
        tag: "SN",
        title: "จัดการสต็อก",
        subtitle: "บริหารอุปกรณ์แยกตาม Serial Number",
      },
      {
        href: "/approval",
        tag: "PA",
        title: "อนุมัติคำขอเช่า",
        subtitle: "ตรวจสอบคำขอและเกรดความเสี่ยงของสมาชิก",
        badgeKey: "pendingOrders",
      },
    ],
  },
  {
    label: "ปัญญาประดิษฐ์",
    items: [
      {
        href: "/marketing",
        tag: "AI",
        title: "AI Marketing",
        subtitle: "ร่างโปรโมชั่นอัตโนมัติสำหรับอุปกรณ์คิวว่าง",
      },
    ],
  },
  {
    label: "ตั้งค่า",
    items: [
      {
        href: "/settings",
        tag: "SET",
        title: "ตั้งค่าร้าน",
        subtitle: "กำหนดเงินมัดจำจองคิวและค่าตั้งต้นของระบบ",
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** หา title/subtitle ของหน้าปัจจุบันจาก pathname */
export function findNavItem(pathname) {
  return (
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? NAV_ITEMS[0]
  );
}
