# Software Requirements Specification (SRS)
## Project Name: Smart Camera & Equipment Rental Management System
**Version:** 1.0.0  
**Target Environment:** Web Application (PHP, MySQL, Tailwind CSS, JavaScript)  
**Organization:** Yala Technical College  

---

## 1. Document Overview
เอกสารข้อกำหนดความต้องการทางซอฟต์แวร์ (Software Requirements Specification) ฉบับนี้ จัดทำขึ้นเพื่อรวบรวมฟีเจอร์และข้อกำหนดทางเทคนิคทั้งหมดของ **ระบบบริหารจัดการและจัดคิวเช่าอุปกรณ์การถ่ายภาพอัจฉริยะ (Smart Camera & Equipment Rental Management System)** ซึ่งครอบคลุมการบริหารจัดการสต็อก คิวเช่า การประยุกต์ใช้ AI เพื่อการแนะนำอุปกรณ์และการตลาด ตลอดจนระบบบริหารความเสี่ยงสำหรับธุรกิจเช่ากล้อง

---

## 2. User Roles & Access Matrix

| Role | Description | Access Permissions |
| :--- | :--- | :--- |
| **Guest / Public User** | ผู้ใช้งานทั่วไปที่ยังไม่ได้เข้าสู่ระบบ | ดูคิวว่างอุปกรณ์, สัมผัสประสบการณ์ AI Wizard Recommendation |
| **Registered Member** | ลูกค้าที่ลงทะเบียนเข้าสู่ระบบ | จัดเซ็ตอุปกรณ์เอง, ส่งคำขอเช่า, ติดตามสถานะคำขอ, ดูประวัติการเช่า |
| **VIP Member** | สมาชิกประวัติดี (Grade A/B) | ได้รับสิทธิ์อนุมัติคิวด่วน, ได้รับการพิจารณาอนุมัติก่อน, เลือกแพ็กเกจ Custom แบบพิเศษ |
| **Admin / Store Owner** | เจ้าของร้าน / ผู้ดูแลระบบ | จัดการสต็อก/Serial Number, อนุมัติคิว, บันทึกสภาพอุปกรณ์, อนุมัติ AI Content, ดู Dashboard |

---

## 3. System Functional Requirements

### 3.1 Core Rental & Queue Management (ระบบบริหารคิวและสต็อกอุปกรณ์)
- **REQ-RENT-001 (Real-time Queue Visibility):** ระบบต้องแสดงตารางปฏิทิน/ไทม์ไลน์สถานะคิวจองอุปกรณ์แต่ละรายการแบบ Real-time โดยระบุสถานะ: `ว่าง (Available)`, `ถูกเช่า (Rented)`, `อยู่ระหว่างส่งซ่อม (Maintenance)`, `รอทำความสะอาด (Cleaning)`
- **REQ-RENT-002 (Serial Number Level Tracking):** ระบบต้องบริหารจัดการอุปกรณ์แยกตาม **Serial Number** รายตัว (ไม่ใช่แค่มองเป็นจำนวนรวม) เพื่อป้องกันการจองคิวซ้อน (Double Booking)
- **REQ-RENT-003 (Custom Bundle Assembly):** สามารถเลือกจัดชุดอุปกรณ์ได้ (เช่น Body + Lens + Accessories 2 ชิ้น) รวมเป็น 1 คำขอเช่า (Single Order Transaction) โดยจัดเซ็ตแบบสดตอนทำรายการ ไม่ใช่เลือกจากแพ็กเกจสำเร็จรูป และ **เจ้าของร้านสามารถใส่ส่วนลดเป็นจำนวนเงินให้กับเซ็ตนั้นได้** พร้อมระบุเหตุผลกำกับ
- **REQ-RENT-006 (Walk-in Rental):** รองรับลูกค้าที่เดินเข้ามาเช่าที่ร้านโดยตรง โดยเจ้าของร้านเป็นผู้ทำรายการให้
  - ลูกค้าไม่จำเป็นต้องเป็นสมาชิก — บันทึกเพียงชื่อและเบอร์โทร ระบบจะสร้างโปรไฟล์ให้อัตโนมัติ และถ้าเบอร์เดิมเคยเช่ามาก่อนจะผูกกับประวัติเดิมเพื่อให้การจัดเกรดความเสี่ยงยังใช้ได้
  - ไม่ต้องผ่านขั้นตอนอนุมัติ เพราะเจ้าของร้านเป็นผู้ทำรายการเอง — ออเดอร์เข้าสถานะ `Active Rental` ทันทีเมื่อรับของวันนั้น หรือ `Approved` ถ้าเป็นการจองล่วงหน้า
  - ไม่เก็บเงินมัดจำจองคิวเมื่อรับของทันที เพราะมัดจำมีไว้กันการจองแล้วไม่มารับ
  - ยังต้องผ่านการตรวจคิวชนและสถานะอุปกรณ์เหมือนคำขอออนไลน์ทุกประการ
- **REQ-RENT-004 (Rental Duration & Fee Calculation):** ระบบต้องคำนวณค่าเช่ารวมอัตโนมัติตามจำนวนวัน (Start Date - End Date) และเก็บ **เงินมัดจำจองคิว** ซึ่งเป็นจำนวนเงินคงที่ต่อ 1 คำขอเช่าที่เจ้าของร้านกำหนดเองได้ (ค่าเริ่มต้น 100 บาท) โดยเงินมัดจำนี้ถูกหักเป็นส่วนหนึ่งของค่าเช่า ไม่ใช่เงินประกันที่คืนภายหลัง และไม่ผูกกับมูลค่าอุปกรณ์หรือเกรดสมาชิก
- **REQ-RENT-005 (Order Lifecycle Management):** รองรับการเปลี่ยนสถานะออเดอร์ตาม Workflow:  
  `Pending Approval` $\rightarrow$ `Approved` $\rightarrow$ `Active Rental` $\rightarrow$ `Returned & Inspected` $\rightarrow$ `Closed` (หรือ `Cancelled`)
  - **การรับคืนทำได้ทีละชิ้น** เพราะลูกค้ามักคืนไม่ครบในครั้งเดียว ออเดอร์จะปิดเมื่อคืนครบทุกชิ้นแล้วเท่านั้น
  - ออเดอร์ที่พบความเสียหายจะหยุดที่ `Returned & Inspected` ไม่ปิดอัตโนมัติ ต้องให้เจ้าของร้านกดปิดหลังเคลียร์ค่าเสียหายกับลูกค้าแล้ว
  - **คืนช้าคิดเป็นค่าเช่าส่วนเกินตามจำนวนวันที่เกิน** ไม่ใช่ค่าปรับแยก เพราะอุปกรณ์ถูกใช้งานจริงในช่วงนั้น

### 3.2 Artificial Intelligence Integration (ระบบผู้ช่วยปัญญาประดิษฐ์)
- **REQ-AI-001 (Smart Recommendation Wizard):**
  - มี Interactive Form ให้ลูกค้ากรอกข้อมูล 3-4 ประการ: (1) ลักษณะงาน (2) สภาพแสง/เวลาถ่าย (3) งบประมาณ
  - ระบบเชื่อมต่อกับ **Gemini API** เพื่อวิเคราะห์ และดึงอุปกรณ์ที่มีคิวว่างในระบบมาจัดเป็นเซ็ตแพ็กเกจที่เหมาะสมที่สุดพร้อมเหตุผลประกอบ
  - มีปุ่ม "กดจองเซ็ตนี้ทันที" เพื่อสร้างคำขอเช่าโดยอัตโนมัติ
- **REQ-AI-002 (AI Marketing Content Generator):**
  - ระบบตรวจจับอุปกรณ์ที่มีอัตราการถูกเช่าต่ำ หรือมีคิวว่างต่อเนื่องเกินกำหนดในสัปดาห์นั้น
  - AI ทำการเจนเนอเรตข้อความโปรโมชั่น รูปแบบแคปชั่น และจุดเด่นของอุปกรณ์ให้อัตโนมัติ
  - เจ้าของร้านสามารถตรวจสอบ แก้ไข และกด **"Approve & Broadcast"** เพื่อส่งข่าวสารไปยังหน้าประกาศ/แจ้งเตือนของระบบ
- **REQ-AI-003 (Developer Assistance):** ใช้ AI ช่วยในการสอบถาม SQL Query Optimization, Schema Validation และข้อผิดพลาดจากซอร์สโค้ดในขั้นตอนพัฒนา

### 3.3 Risk & Asset Management (ระบบบริหารความเสี่ยงและทรัพย์สิน)
- **REQ-RISK-001 (Customer Risk Scoring & Grading):**
  - ระบบประเมินและจัดเกรดลูกค้าอัตโนมัติ (Grade A, B, C) โดยคำนวณจากประวัติการเช่า, การคืนตรงเวลา, และประวัติความเสียหาย
  - กำหนดเงื่อนไขและลำดับการอนุมัติคิวตามเกรดของสมาชิก (เกรด A ได้รับสิทธิ์คิวด่วนและพิจารณาก่อน, เกรด C ต้องตรวจสอบประวัติก่อนอนุมัติ)

> **หมายเหตุการเปลี่ยนแปลง (v1.1):** เดิมกำหนดให้เกรดสมาชิกเป็นตัวกำหนดอัตราเงินมัดจำ ภายหลังเจ้าของร้านยืนยันว่าร้านเก็บเงินมัดจำจองคิวเพียง **100 บาทต่อคำขอเท่ากันทุกเกรด** และหักเป็นส่วนหนึ่งของค่าเช่า จึงแยกบทบาทให้ชัดเจนว่า *เงินมัดจำ* ใช้กันการจองแล้วไม่มารับของ ส่วน *เกรดสมาชิก* ใช้กำหนดลำดับและเงื่อนไขการอนุมัติคิว
- **REQ-RISK-002 (Visual Asset Inspection Log):**
  - ก่อนส่งมอบอุปกรณ์ พนักงานต้องอัปโหลดรูปถ่ายสภาพอุปกรณ์ 4 มุม + รอยเดิม แนบไว้ในออเดอร์
  - เมื่อรับคืนอุปกรณ์ พนักงานทำการอัปโหลดรูปถ่ายเปรียบเทียบสภาพ เพื่อเป็นหลักฐานป้องกันข้อขัดแย้งเรื่องรอยชำรุดใหม่
- **REQ-RISK-003 (Maintenance & Sensor Cleaning Scheduler):**
  - ระบบนับรอบการเช่าของอุปกรณ์แต่ละชิ้น (เช่น ถูกเช่าครบ 10 ครั้ง หรือใช้งานครบ 50 วัน)
  - ระบบจะทำการเปลี่ยนสถานะเป็น `รอทำความสะอาด/ซ่อมบำรุง` อัตโนมัติ พร้อมแจ้งเตือน Admin บน Dashboard

### 3.4 CRUD Matrix Summary

| Data Entity | Create | Read | Update | Delete |
| :--- | :--- | :--- | :--- | :--- |
| **Equipment & Serial No.** | เพิ่มอุปกรณ์/SN ใหม่ | ดูรายการ/สถานะ/ประวัติการเช่า | แก้ไขข้อมูล/สถานะการซ่อม | Soft Delete (ซ่อนอุปกรณ์) |
| **User & Member Profile** | ลงทะเบียนสมาชิกใหม่ | ดูข้อมูลโปรไฟล์/เกรดความเสี่ยง | อัปเดตข้อมูล/ปรับเกรดเกรด | ระงับสิทธิ์การใช้งาน |
| **Rental Order & Queue** | สร้างคำขอเช่า | ดูตารางคิว/สถานะออเดอร์ | เปลี่ยนสถานะการเช่า/อนุมัติ | ยกเลิกคำขอ (ก่อนอนุมัติ) |
| **Inspection Log** | บันทึกรูปภาพก่อน-หลังเช่า | ดูเปรียบเทียบรูปภาพสภาพ | แก้ไขหมายเหตุความเสียหาย | N/A (คงไว้เพื่อหลักฐาน) |
| **AI Marketing Post** | AI สร้างร่างข้อความโพส | ดูรายการร่างโปรโมชั่น | แก้ไขข้อความคอนเทนต์ | ลบโพสที่ไม่ต้องการ |

---

## 4. Technical Architecture & Non-Functional Requirements

### 4.1 System Architecture & Tech Stack
- **Architecture Pattern:** Monolithic Architecture with Modular Design (Separation of Views, Logic, and Data Access) — ใช้ Next.js App Router แบ่งชั้นเป็น Route (View) / Server Action (Logic) / Prisma (Data Access)
- **Frontend Layer:** React 19 (JSX), Tailwind CSS v4 (Responsive Design), Server Components เป็นค่าเริ่มต้นและใช้ Client Component เฉพาะส่วนที่ต้องมี interactive state
- **Backend Layer:** Next.js 16 (Node.js 22) — Server Components + Server Actions + Route Handlers
- **Database Layer:** MySQL / MariaDB (Relational Database) เข้าถึงผ่าน Prisma ORM 7 พร้อม Driver Adapter
- **Deployment Server:** Linux VPS managed via aaPanel (Nginx Reverse Proxy → Node.js process ที่ควบคุมด้วย PM2)

> **หมายเหตุการเปลี่ยนแปลง (v1.1):** เดิมกำหนดเป็น Pure PHP 8 + PHP-FPM ภายหลังเปลี่ยนมาใช้ Next.js เนื่องจากส่วนที่ซับซ้อนที่สุดของระบบ (ปฏิทินคิวแบบเรียลไทม์ REQ-RENT-001, การจัดชุดอุปกรณ์หลายชิ้นใน 1 คำขอ REQ-RENT-003 และการสตรีมผลลัพธ์จาก AI Wizard REQ-AI-001) ล้วนเป็น UI ที่มี client state จำนวนมาก ซึ่ง React จัดการได้ตรงกว่าการเขียน DOM manipulation ด้วย Vanilla JS ทั้งนี้ข้อกำหนดด้าน Data Integrity, Security และ Performance ในหัวข้อ 4.2 ยังคงเดิมทุกข้อ

### 4.2 Non-Functional Requirements (NFR)
- **Performance:** หน้าแสดงผลตารางคิวอุปกรณ์ต้องใช้เวลาโหลดไม่เกิน 2 วินาที
- **Data Integrity:** Database Constraint และ Transaction Handling ต้องรับประกันว่าอุปกรณ์ 1 Serial Number ไม่สามารถถูกจองซ้อนในช่วงเวลาเดียวกันได้ 100%
- **Usability:** รองรับการใช้งานผ่านหน้าจอ Mobile, Tablet และ Desktop (Responsive Web)
- **Security:** 
  - การเข้ารหัสรหัสผ่านด้วย Bcrypt (`bcrypt` / `argon2` ผ่าน Node.js — เทียบเท่า `password_hash()` เดิม)
  - ป้องกัน SQL Injection ด้วย Parameterized Query ที่ Prisma สร้างให้อัตโนมัติ (เทียบเท่า Prepared Statements)
  - ป้องกัน Cross-Site Scripting (XSS) ด้วยการ Escape Data Output ซึ่ง React ทำให้โดยอัตโนมัติเมื่อเรนเดอร์ค่าใน JSX

---

## 5. Capstone Project Extension Roadmap (ปวส. 2)
1. **LINE Official Account & Chatbot Integration:** เชื่อมต่อ LINE Messaging API เพื่อส่ง Notification อนุมัติคิว/แจ้งเตือนวันคืน และพัฒนาบอทตอบคำถามคิวว่าง
2. **On-site QR Code / Barcode Scanner:** เพิ่มระบบสแกน QR Code บนตัวกล้องผ่านเบราว์เซอร์มือถือ เพื่อความรวดเร็วในการรับ-คืนอุปกรณ์
3. **AI Image Damage Detection:** ประยุกต์ใช้ Computer Vision (OpenCV / TensorFlow) ในการเปรียบเทียบรูปถ่ายก่อน-หลังเช่าเพื่อตรวจหารอยขีดข่วนอัตโนมัติ
