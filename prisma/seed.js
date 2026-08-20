// สคริปต์นี้รันด้วย `node` ตรง ๆ (ไม่ผ่าน bundler ของ Next) จึงใช้ CommonJS
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const bcrypt = require("bcryptjs");

// ------------------------------------------------------------
//  เชื่อมต่อ DB (แปลง DATABASE_URL เป็น PoolConfig เหมือน src/lib/prisma.js)
// ------------------------------------------------------------
const url = new URL(process.env.DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

// ------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------
const DAY = 86_400_000;

/**
 * ฐานเวลาต้องเป็นเที่ยงคืน "UTC" ของวันตามปฏิทินไทย ไม่ใช่เที่ยงคืนเวลาไทย
 *
 * เพราะคอลัมน์ `@db.Date` ถูกตัดเก็บโดยอิงปฏิทิน UTC ถ้าใช้ setHours(0,0,0,0)
 * จะได้ 00:00 เวลาไทย ซึ่งเท่ากับ 17:00 UTC ของ "วันก่อนหน้า" ทำให้วันที่
 * ที่บันทึกลงฐานข้อมูลร่นไป 1 วันทั้งระบบ
 */
const nowLocal = new Date();
const today = new Date(
  Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate()),
);

/** วันที่นับจากวันนี้ (+n = อนาคต, -n = อดีต) */
const day = (n) => new Date(today.getTime() + n * DAY);
/** เวลาย้อนหลัง n ชั่วโมงจากตอนนี้ */
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);

/**
 * รหัสผ่านของบัญชีทดสอบทุกบัญชี — hash จริงตอนรัน seed
 *
 * เดิมเคยฝัง hash ไว้เป็นค่าคงที่ แต่ค่านั้นไม่ตรงกับรหัสผ่านที่ประกาศไว้
 * ทำให้ล็อกอินไม่ได้จริง จึงเปลี่ยนมา hash สด ๆ ด้วย bcrypt (SRS §4.2)
 */
const DEMO_PASSWORD = "password123";
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

// ------------------------------------------------------------
//  ข้อมูลตั้งต้น
// ------------------------------------------------------------
const BRANDS = [
  { name: "Sony", code: "SN", sortOrder: 1 },
  { name: "Canon", code: "CN", sortOrder: 2 },
  { name: "Godox", code: "GD", sortOrder: 3 },
  { name: "DJI", code: "DJ", sortOrder: 4 },
  { name: "Rode", code: "RD", sortOrder: 5 },
];

const CATEGORIES = [
  { name: "Camera Body", code: "CAM", sortOrder: 1 },
  { name: "Lens", code: "LEN", sortOrder: 2 },
  { name: "Gimbal", code: "GMB", sortOrder: 3 },
  { name: "Lighting", code: "LGT", sortOrder: 4 },
  { name: "Audio", code: "AUD", sortOrder: 5 },
];

const EQUIPMENTS = [
  {
    name: "Sony A7 III",
    brand: "Sony",
    code: "A7M3",
    category: "Camera Body",
    dailyRate: 1200,
    replacementValue: 62000,
    description: "Full-frame 24MP ไวแสงดี เหมาะงานอีเวนต์และงานแต่ง",
    units: [
      { serialNumber: "SN-A7M3-001", rentalCount: 6, totalDaysUsed: 24 },
      {
        serialNumber: "SN-A7M3-002",
        rentalCount: 10,
        totalDaysUsed: 41,
        status: "MAINTENANCE",
      },
    ],
  },
  {
    name: "Canon EOS R6 Mark II",
    brand: "Canon",
    code: "R6M2",
    category: "Camera Body",
    dailyRate: 1500,
    replacementValue: 78000,
    description: "AF ติดตามวัตถุแม่นยำ ถ่ายวิดีโอ 4K 60p ไม่มี crop",
    units: [
      { serialNumber: "CN-R6M2-001", rentalCount: 3, totalDaysUsed: 11 },
      { serialNumber: "CN-R6M2-002", rentalCount: 5, totalDaysUsed: 19 },
    ],
  },
  {
    name: "Sony FE 24-70mm f/2.8 GM II",
    brand: "Sony",
    code: "2470GM",
    category: "Lens",
    dailyRate: 900,
    replacementValue: 78000,
    description: "เลนส์ซูมมาตรฐาน คมทั้งช่วง น้ำหนักเบากว่ารุ่นแรก",
    units: [
      { serialNumber: "SN-2470GM-001", rentalCount: 8, totalDaysUsed: 33 },
    ],
  },
  {
    name: "Canon RF 50mm f/1.2L USM",
    brand: "Canon",
    code: "RF50",
    category: "Lens",
    dailyRate: 800,
    replacementValue: 72000,
    description: "เลนส์พอร์ตเทรตละลายหลังสวย รูรับแสงกว้างพิเศษ",
    units: [
      {
        serialNumber: "CN-RF50-001",
        rentalCount: 9,
        totalDaysUsed: 50,
        status: "CLEANING",
      },
    ],
  },
  {
    name: "DJI RS3 Pro",
    brand: "DJI",
    code: "RS3",
    category: "Gimbal",
    dailyRate: 700,
    replacementValue: 32000,
    description: "กันสั่น 3 แกน รับน้ำหนักได้ถึง 4.5 กก.",
    units: [
      {
        serialNumber: "DJ-RS3-001",
        rentalCount: 7,
        totalDaysUsed: 28,
        status: "CLEANING",
      },
    ],
  },
  {
    name: "Godox AD200Pro",
    brand: "Godox",
    code: "AD200",
    category: "Lighting",
    dailyRate: 400,
    replacementValue: 14000,
    description: "แฟลชพกพา 200Ws เปลี่ยนหัวได้ทั้งหลอดและ speedlite",
    units: [
      { serialNumber: "GD-AD200-001", rentalCount: 2, totalDaysUsed: 7 },
      { serialNumber: "GD-AD200-002", rentalCount: 4, totalDaysUsed: 15 },
      { serialNumber: "GD-AD200-003", rentalCount: 1, totalDaysUsed: 3 },
    ],
  },
  {
    name: "Rode Wireless GO II",
    brand: "Rode",
    code: "RWG2",
    category: "Audio",
    dailyRate: 350,
    replacementValue: 11500,
    description: "ไมค์ไร้สาย 2 ช่อง บันทึกในตัวได้ เหมาะงานสัมภาษณ์",
    units: [{ serialNumber: "RD-RWG2-001", rentalCount: 5, totalDaysUsed: 18 }],
  },
];

const USERS = [
  {
    email: "admin@dacamera.local",
    fullName: "อธิป ศรีสุวรรณ",
    role: "ADMIN",
    grade: "A",
    phone: "081-234-5678",
    riskScore: 100,
  },
  {
    email: "nattapong@example.com",
    fullName: "ณัฐพงศ์ กิตติวัฒน์",
    role: "VIP",
    grade: "A",
    phone: "089-111-2233",
    riskScore: 95,
    totalRentals: 14,
    onTimeReturns: 14,
  },
  {
    email: "siriporn@example.com",
    fullName: "ศิริพร วงศ์ดี",
    role: "MEMBER",
    grade: "B",
    phone: "086-555-7788",
    riskScore: 72,
    totalRentals: 6,
    onTimeReturns: 5,
    lateReturns: 1,
  },
  {
    email: "teerapat@example.com",
    fullName: "ธีรภัทร์ สุขใจ",
    role: "MEMBER",
    grade: "C",
    phone: "082-999-4455",
    riskScore: 48,
    totalRentals: 4,
    onTimeReturns: 2,
    lateReturns: 2,
    damageIncidents: 1,
  },
  {
    email: "kanyarat@example.com",
    fullName: "กัญญารัตน์ พูนสุข",
    role: "MEMBER",
    grade: "B",
    phone: "084-321-6600",
    riskScore: 78,
    totalRentals: 3,
    onTimeReturns: 3,
  },
];

/**
 * เงินมัดจำจองคิวต่อ 1 คำขอ — ค่าเดียวกันทุกเกรด
 * ตรงกับที่ร้านเก็บจริง และตรงกับค่าเริ่มต้นใน ShopSetting
 */
const BOOKING_DEPOSIT = 100;

// ------------------------------------------------------------
//  Seed
// ------------------------------------------------------------
async function main() {
  console.log("🧹 ล้างข้อมูลเดิม...");
  // ลบเรียงตาม dependency (ลูกก่อนแม่)
  await prisma.inspectionPhoto.deleteMany();
  await prisma.inspectionLog.deleteMany();
  await prisma.rentalOrderItem.deleteMany();
  await prisma.rentalOrder.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.aiMarketingPost.deleteMany();
  await prisma.equipmentUnit.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  // ต้องลบก่อน user เพราะ ShopSetting.updatedById อ้างถึง User อยู่
  await prisma.shopSetting.deleteMany();
  await prisma.user.deleteMany();

  console.log("⚙️  ตั้งค่าร้าน...");
  await prisma.shopSetting.upsert({
    where: { id: 1 },
    create: { id: 1, bookingDeposit: BOOKING_DEPOSIT },
    update: { bookingDeposit: BOOKING_DEPOSIT },
  });

  console.log("🏷  สร้างยี่ห้อ...");
  const brands = {};
  for (const b of BRANDS) {
    brands[b.name] = await prisma.brand.create({ data: b });
  }

  console.log("📁 สร้างหมวดหมู่...");
  const categories = {};
  for (const c of CATEGORIES) {
    categories[c.name] = await prisma.category.create({ data: c });
  }

  console.log("👤 สร้างผู้ใช้...");
  const users = {};
  for (const u of USERS) {
    users[u.email] = await prisma.user.create({
      data: { ...u, passwordHash: DEMO_HASH },
    });
  }
  const admin = users["admin@dacamera.local"];

  console.log("📷 สร้างอุปกรณ์และ Serial Number...");
  const unitsBySerial = {};
  for (const eq of EQUIPMENTS) {
    const { units, category, brand, ...rest } = eq;
    const created = await prisma.equipment.create({
      data: { ...rest, categoryId: categories[category].id, brandId: brands[brand].id },
    });

    for (const u of units) {
      unitsBySerial[u.serialNumber] = await prisma.equipmentUnit.create({
        data: {
          equipmentId: created.id,
          serialNumber: u.serialNumber,
          status: u.status ?? "AVAILABLE",
          rentalCount: u.rentalCount ?? 0,
          totalDaysUsed: u.totalDaysUsed ?? 0,
          purchasedAt: day(-380),
        },
      });
    }
  }

  console.log("🔧 บันทึกรอบบำรุงรักษา (REQ-RISK-003)...");
  await prisma.maintenanceRecord.createMany({
    data: [
      {
        equipmentUnitId: unitsBySerial["SN-A7M3-002"].id,
        reason: "RENTAL_CYCLE_LIMIT",
        isAutomatic: true,
        note: "ครบ 10 รอบเช่า — ส่งทำความสะอาดเซนเซอร์",
        startedAt: hoursAgo(6),
      },
      {
        equipmentUnitId: unitsBySerial["CN-RF50-001"].id,
        reason: "USAGE_DAYS_LIMIT",
        isAutomatic: true,
        note: "ครบ 50 วันใช้งาน — ตรวจเช็คมอเตอร์โฟกัส",
        startedAt: hoursAgo(30),
      },
      {
        equipmentUnitId: unitsBySerial["DJ-RS3-001"].id,
        reason: "ROUTINE_CLEANING",
        isAutomatic: false,
        note: "ทำความสะอาดหลังใช้งานกลางแจ้ง",
        startedAt: hoursAgo(20),
      },
    ],
  });

  console.log("📋 สร้างคำขอเช่า...");

  /** สร้างออเดอร์ 1 ใบพร้อมรายการอุปกรณ์ */
  async function createOrder({
    code,
    email,
    serials,
    start,
    end,
    status,
    note,
    createdAt,
    isRush = false,
    approvedAt = null,
    channel = "ONLINE",
    discountAmount = 0,
    discountNote = null,
  }) {
    const customer = users[email];
    const days = Math.round((end - start) / DAY) + 1;

    const units = await Promise.all(
      serials.map((sn) =>
        prisma.equipmentUnit.findUnique({
          where: { id: unitsBySerial[sn].id },
          include: { equipment: true },
        }),
      ),
    );

    const rentalFee = units.reduce(
      (sum, u) => sum + Number(u.equipment.dailyRate) * days,
      0,
    );
    const discount = Math.max(0, Math.min(discountAmount, rentalFee));
    const netAmount = rentalFee - discount;
    // เช่าหน้าร้านรับของทันทีจึงไม่เก็บมัดจำจองคิว
    // และมัดจำต้องไม่เกินยอดสุทธิ ไม่งั้นยอดคงเหลือติดลบ
    const depositAmount =
      channel === "WALK_IN" ? 0 : Math.min(BOOKING_DEPOSIT, netAmount);

    return prisma.rentalOrder.create({
      data: {
        orderCode: code,
        userId: customer.id,
        status,
        startDate: start,
        endDate: end,
        rentalDays: days,
        rentalFee,
        discountAmount: discount,
        discountNote,
        depositAmount,
        channel,
        gradeAtRequest: customer.grade,
        isRushRequest: isRush,
        customerNote: note,
        createdAt,
        approvedById: approvedAt ? admin.id : null,
        approvedAt,
        items: {
          create: units.map((u) => ({
            equipmentUnitId: u.id,
            startDate: start,
            endDate: end,
            dailyRate: u.equipment.dailyRate,
            days,
            subtotal: Number(u.equipment.dailyRate) * days,
          })),
        },
      },
    });
  }

  // กำลังเช่าอยู่ (ACTIVE_RENTAL)
  await createOrder({
    code: "ORD-2569-0181",
    email: "siriporn@example.com",
    serials: ["SN-2470GM-001"],
    start: day(-3),
    end: day(1),
    status: "ACTIVE_RENTAL",
    note: "ถ่ายงานรับปริญญา",
    createdAt: day(-5),
    approvedAt: day(-4),
  });

  await createOrder({
    code: "ORD-2569-0182",
    email: "teerapat@example.com",
    serials: ["GD-AD200-002"],
    start: day(-2),
    end: day(0),
    status: "ACTIVE_RENTAL",
    note: "ถ่ายสินค้าในสตูดิโอ",
    createdAt: day(-4),
    approvedAt: day(-3),
  });

  await createOrder({
    code: "ORD-2569-0184",
    email: "nattapong@example.com",
    serials: ["SN-A7M3-001", "RD-RWG2-001"],
    start: day(-1),
    end: day(3),
    status: "ACTIVE_RENTAL",
    note: "ถ่ายสัมภาษณ์ + วิดีโอองค์กร",
    createdAt: day(-3),
    approvedAt: day(-2),
    isRush: true,
  });

  // รออนุมัติ (PENDING_APPROVAL) — 6 ใบ ให้ตรงกับ badge
  await createOrder({
    code: "ORD-2569-0185",
    email: "nattapong@example.com",
    serials: ["CN-R6M2-001", "GD-AD200-001"],
    start: day(2),
    end: day(5),
    status: "PENDING_APPROVAL",
    note: "งานแต่งนอกสถานที่ ต้องการชุดพร้อมแฟลช",
    createdAt: hoursAgo(2),
    isRush: true,
  });

  await createOrder({
    code: "ORD-2569-0186",
    email: "kanyarat@example.com",
    serials: ["CN-R6M2-002"],
    start: day(4),
    end: day(6),
    status: "PENDING_APPROVAL",
    note: "ถ่ายทำคลิปสั้นลง TikTok",
    createdAt: hoursAgo(9),
  });

  await createOrder({
    code: "ORD-2569-0187",
    email: "siriporn@example.com",
    serials: ["GD-AD200-003"],
    start: day(3),
    end: day(4),
    status: "PENDING_APPROVAL",
    note: "ถ่ายพอร์ตโฟลิโอ",
    createdAt: hoursAgo(14),
  });

  await createOrder({
    code: "ORD-2569-0188",
    email: "teerapat@example.com",
    serials: ["RD-RWG2-001"],
    start: day(6),
    end: day(8),
    status: "PENDING_APPROVAL",
    note: "อัดพอดแคสต์นอกสถานที่",
    createdAt: hoursAgo(28),
  });

  await createOrder({
    code: "ORD-2569-0189",
    email: "kanyarat@example.com",
    serials: ["SN-A7M3-001"],
    start: day(5),
    end: day(7),
    status: "PENDING_APPROVAL",
    note: "ถ่ายงานบวช",
    createdAt: hoursAgo(33),
  });

  await createOrder({
    code: "ORD-2569-0190",
    email: "nattapong@example.com",
    serials: ["SN-2470GM-001"],
    start: day(7),
    end: day(9),
    status: "PENDING_APPROVAL",
    note: "งานอีเวนต์บริษัท",
    createdAt: hoursAgo(1),
  });

  // ปิดออเดอร์แล้ว — ใช้คิดยอดรายได้เดือนนี้
  await createOrder({
    code: "ORD-2569-0175",
    email: "siriporn@example.com",
    serials: ["CN-R6M2-002"],
    start: day(-12),
    end: day(-9),
    status: "CLOSED",
    note: "ถ่ายงานสัมมนา",
    createdAt: day(-14),
    approvedAt: day(-13),
  });

  await createOrder({
    code: "ORD-2569-0170",
    email: "nattapong@example.com",
    serials: ["SN-A7M3-002", "SN-2470GM-001"],
    start: day(-20),
    end: day(-16),
    status: "CLOSED",
    note: "ทริปถ่ายภาพทะเล",
    createdAt: day(-22),
    approvedAt: day(-21),
  });

  console.log("🏪 สร้างรายการเช่าหน้าร้าน (walk-in)...");
  // ลูกค้าเดินเข้าร้าน ไม่ได้สมัครสมาชิก จึงไม่มีอีเมลและล็อกอินไม่ได้
  users["walkin-guest"] = await prisma.user.create({
    data: {
      fullName: "ประเสริฐ มานะกิจ",
      phone: "0899876543",
      email: null,
      passwordHash: null,
      role: "MEMBER",
      grade: "B",
    },
  });

  await createOrder({
    code: "ORD-2569-0191",
    email: "walkin-guest",
    serials: ["CN-R6M2-002", "GD-AD200-001"],
    start: day(-1),
    end: day(1),
    status: "ACTIVE_RENTAL",
    note: "ลูกค้ามารับที่ร้าน ถ่ายงานบวชในตัวเมือง",
    createdAt: hoursAgo(26),
    approvedAt: hoursAgo(26),
    channel: "WALK_IN",
    discountAmount: 500,
    discountNote: "ลูกค้าประจำ",
  });

  console.log("🖼  บันทึกภาพตรวจสภาพ (REQ-RISK-002)...");
  const activeOrder = await prisma.rentalOrder.findUnique({
    where: { orderCode: "ORD-2569-0184" },
  });
  const inspection = await prisma.inspectionLog.create({
    data: {
      orderId: activeOrder.id,
      equipmentUnitId: unitsBySerial["SN-A7M3-001"].id,
      phase: "BEFORE_HANDOVER",
      damageNote: "มีรอยถลอกเล็กน้อยที่ฐานขาตั้ง (รอยเดิม)",
      inspectedById: admin.id,
      inspectedAt: hoursAgo(29),
    },
  });
  await prisma.inspectionPhoto.createMany({
    data: [
      { logId: inspection.id, angle: "FRONT", imageUrl: "/uploads/demo/a7m3-front.jpg" },
      { logId: inspection.id, angle: "BACK", imageUrl: "/uploads/demo/a7m3-back.jpg" },
      { logId: inspection.id, angle: "LEFT", imageUrl: "/uploads/demo/a7m3-left.jpg" },
      { logId: inspection.id, angle: "RIGHT", imageUrl: "/uploads/demo/a7m3-right.jpg" },
      {
        logId: inspection.id,
        angle: "EXISTING_DAMAGE",
        imageUrl: "/uploads/demo/a7m3-scratch.jpg",
        caption: "รอยถลอกฐานขาตั้ง",
      },
    ],
  });

  console.log("🤖 สร้างร่างโพส AI Marketing (REQ-AI-002)...");
  const rs3 = await prisma.equipment.findFirst({ where: { name: "DJI RS3 Pro" } });
  const rode = await prisma.equipment.findFirst({
    where: { name: "Rode Wireless GO II" },
  });
  await prisma.aiMarketingPost.createMany({
    data: [
      {
        equipmentId: rs3.id,
        status: "DRAFT",
        headline: "ยกกล้องนิ่งทั้งวัน กับ DJI RS3 Pro ลด 25%",
        caption:
          "ภาพสั่นทำงานพังมานักต่อนัก — RS3 Pro กันสั่น 3 แกน รับน้ำหนักได้ถึง 4.5 กก. เหมาะกับทั้งงานแต่งและงานวิดีโอองค์กร สัปดาห์นี้เช่าเพียงวันละ 525 บาท จองคิวได้เลย",
        highlights: [
          "กันสั่น 3 แกน มอเตอร์แรงขึ้น 20%",
          "รับน้ำหนักกล้อง + เลนส์ได้ถึง 4.5 กก.",
          "แบตอยู่ได้ 12 ชม. ชาร์จเร็ว 1.5 ชม.",
        ],
        triggerReason: "คิวว่างต่อเนื่อง 9 วัน",
        idleDays: 9,
        generatedAt: hoursAgo(5),
      },
      {
        equipmentId: rode.id,
        status: "DRAFT",
        headline: "เสียงชัดทุกคำ Rode Wireless GO II วันละ 350 บาท",
        caption:
          "ไมค์ไร้สาย 2 ช่องสัญญาณ บันทึกเสียงในตัวได้แม้สัญญาณหลุด เหมาะกับงานสัมภาษณ์ พอดแคสต์ และคอนเทนต์สายวิดีโอ พร้อมให้เช่าแล้ววันนี้",
        highlights: [
          "ส่งสัญญาณ 2 ช่องพร้อมกัน",
          "บันทึกสำรองในตัว 40 ชม.",
          "ระยะส่ง 200 เมตรในที่โล่ง",
        ],
        triggerReason: "อัตราการเช่าต่ำกว่าค่าเฉลี่ย 40%",
        idleDays: 6,
        generatedAt: hoursAgo(5),
      },
    ],
  });

  console.log("📣 สร้าง activity log...");
  await prisma.activityLog.createMany({
    data: [
      {
        type: "ORDER_CREATED",
        message:
          "ณัฐพงศ์ กิตติวัฒน์ ส่งคำขอเช่าเซ็ต 2 ชิ้น (EOS R6 II + AD200Pro) พร้อมขอคิวด่วน",
        actorId: users["nattapong@example.com"].id,
        refType: "RentalOrder",
        createdAt: hoursAgo(2),
      },
      {
        type: "UNIT_MAINTENANCE",
        message:
          "ระบบเปลี่ยนสถานะ SN-A7M3-002 เป็นซ่อมบำรุงอัตโนมัติ (ครบ 10 รอบเช่า)",
        refType: "EquipmentUnit",
        refId: unitsBySerial["SN-A7M3-002"].id,
        createdAt: hoursAgo(6),
      },
      {
        type: "AI_POST_GENERATED",
        message: "AI ร่างโพสโปรโมชั่น 2 รายการ สำหรับอุปกรณ์ที่คิวว่างเกิน 7 วัน",
        refType: "AiMarketingPost",
        createdAt: hoursAgo(5),
      },
      {
        type: "ORDER_RETURNED",
        message:
          "รับคืน Canon EOS R6 Mark II จาก ศิริพร วงศ์ดี — ตรวจสภาพผ่าน ไม่พบรอยใหม่",
        actorId: admin.id,
        refType: "RentalOrder",
        createdAt: hoursAgo(8),
      },
      {
        type: "INSPECTION_LOGGED",
        message: "บันทึกภาพตรวจสภาพก่อนส่งมอบ 5 รูป ออเดอร์ #ORD-2569-0184",
        actorId: admin.id,
        refType: "InspectionLog",
        refId: inspection.id,
        createdAt: hoursAgo(29),
      },
      {
        type: "ORDER_APPROVED",
        message:
          "อนุมัติคิวด่วนให้ ธีรภัทร์ สุขใจ — เกรด C ต้องวางมัดจำเต็มจำนวน",
        actorId: admin.id,
        refType: "RentalOrder",
        createdAt: hoursAgo(31),
      },
      {
        type: "UNIT_MAINTENANCE",
        message: "CN-RF50-001 ครบ 50 วันใช้งาน — ส่งตรวจเช็คมอเตอร์โฟกัส",
        refType: "EquipmentUnit",
        refId: unitsBySerial["CN-RF50-001"].id,
        createdAt: hoursAgo(30),
      },
    ],
  });

  // ------------------------------------------------------------
  //  ซิงก์สถานะอุปกรณ์ให้ตรงกับออเดอร์ที่กำลังใช้งานจริง
  // ------------------------------------------------------------
  console.log("🔄 ซิงก์สถานะอุปกรณ์...");
  const activeItems = await prisma.rentalOrderItem.findMany({
    where: {
      order: { status: "ACTIVE_RENTAL" },
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: { equipmentUnitId: true },
  });

  await prisma.equipmentUnit.updateMany({
    where: {
      id: { in: activeItems.map((i) => i.equipmentUnitId) },
      status: "AVAILABLE",
    },
    data: { status: "RENTED" },
  });

  // ------------------------------------------------------------
  //  สรุป
  // ------------------------------------------------------------
  const summary = {
    ผู้ใช้: await prisma.user.count(),
    หมวดหมู่: await prisma.category.count(),
    รุ่นอุปกรณ์: await prisma.equipment.count(),
    "อุปกรณ์รายชิ้น (SN)": await prisma.equipmentUnit.count(),
    ออเดอร์: await prisma.rentalOrder.count(),
    รายการในออเดอร์: await prisma.rentalOrderItem.count(),
    รออนุมัติ: await prisma.rentalOrder.count({
      where: { status: "PENDING_APPROVAL" },
    }),
    กำลังเช่า: await prisma.equipmentUnit.count({ where: { status: "RENTED" } }),
    "โพส AI": await prisma.aiMarketingPost.count(),
    กิจกรรม: await prisma.activityLog.count(),
  };

  console.log("\n✅ Seed เสร็จสมบูรณ์");
  console.table(summary);
  console.log("\n🔑 บัญชีทดสอบ (รหัสผ่านเดียวกันทุกบัญชี):");
  console.log(`   แอดมิน : admin@dacamera.local / ${DEMO_PASSWORD}`);
  console.log(`   สมาชิก : nattapong@example.com / ${DEMO_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
