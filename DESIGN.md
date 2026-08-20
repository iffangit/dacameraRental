# ระบบแอดมิน – Smart Camera & Equipment Rental Management
Theme: Red / White, Enterprise style

## ภาพรวม
Interactive prototype ของหน้า Admin สำหรับระบบเช่าอุปกรณ์กล้อง ครอบคลุม 5 หน้าหลัก เชื่อมด้วย sidebar navigation

## Design Tokens
- **สีหลัก (Primary Red):** `oklch(0.55 0.21 25)` — ปุ่ม, active state, accent
- **พื้นหลัง:** `oklch(0.985 0.003 25)` (canvas), `white` (card/sidebar/header)
- **เส้นขอบ:** `oklch(0.92 0.01 25)`
- **ข้อความหลัก:** `oklch(0.22 0.02 25)` / **ข้อความรอง:** `oklch(0.55 0.02 25)`
- **สถานะ:** ว่าง = เขียว `oklch(0.5 0.14 150)`, ถูกเช่า = แดง (primary), ซ่อมบำรุง = ส้ม `oklch(0.55 0.15 70)`, รอทำความสะอาด = เทา `oklch(0.45 0.02 250)`
- **Typeface:** Prompt (หัวข้อ/ตัวเลข), Sarabun (เนื้อหา)
- **มุม:** ไม่ปัดมุม (sharp corners) ยกเว้นจุดวงกลมสถานะ/avatar
- **ไอคอน:** ใช้ text-tag (EQ, RT, PA, OK, IMG, AI, MNT, NEW) แทน emoji

## โครงสร้างหน้า
1. **Dashboard** – Stat cards (อุปกรณ์ทั้งหมด/กำลังเช่า/รออนุมัติ/รายได้), รายการสถานะอุปกรณ์ล่าสุด, feed กิจกรรม
2. **ตารางคิวอุปกรณ์ (Queue)** – ปฏิทินความว่าง 7 วัน แสดงต่อรายอุปกรณ์ พร้อม legend สี
3. **จัดการสต็อก (Stock)** – ตารางอุปกรณ์ + Serial Number, หมวดหมู่, สถานะ, จำนวนครั้งที่เช่า, ปุ่มเพิ่มอุปกรณ์
4. **อนุมัติคำขอเช่า (Approval)** – รายการคำขอ (คลิกเพื่อดูรายละเอียด) + panel รายละเอียด พร้อมปุ่มอนุมัติ/ปฏิเสธ (มี state จริง)
5. **AI Marketing** – การ์ดโพสที่ AI ร่างให้ แก้ไข caption ได้ และ Approve & Broadcast

## Interaction ที่ทำงานจริง
- สลับหน้าผ่าน sidebar (active state)
- Toggle sidebar เปิด/ปิด
- เลือกคำขอเช่าเพื่อดูรายละเอียด → อนุมัติ/ปฏิเสธ พร้อม toast แจ้งผล
- แก้ไข caption โพส AI แบบ inline → Approve & Broadcast

## ข้อมูลตัวอย่าง
อุปกรณ์และเลนส์จริงในตลาด (Sony A7 III, Canon EOS R6 II, Sony 24-70mm GM II, Canon RF 50mm f1.2L, DJI RS3 Pro, Godox AD200Pro) และชื่อ/คำขอสมาชิกสมมติ

## ไฟล์
- `Rental Admin System.dc.html` — ไฟล์งานหลัก (Design Component, เปิดตรงในเบราว์เซอร์)
