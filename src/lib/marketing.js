import { generateJson } from "./gemini.js";
import { today, DAY_MS, dayKey } from "./queue.js";

/**
 * AI Marketing Content Generator — REQ-AI-002
 *
 * ระบบตรวจจับอุปกรณ์ที่มีอัตราการถูกเช่าต่ำหรือคิวว่างต่อเนื่อง
 * แล้วให้ AI ร่างโพสโปรโมชั่นให้เจ้าของร้านตรวจก่อนเผยแพร่
 */

export class MarketingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "MarketingError";
    this.code = code;
  }
}

/** สถานะออเดอร์ที่ถือว่า "ถูกเช่าจริง" ใช้นับสถิติ */
const REAL_RENTAL_STATUSES = ["APPROVED", "ACTIVE_RENTAL", "RETURNED_INSPECTED", "CLOSED"];

/**
 * หาอุปกรณ์ที่ควรเอามาโปรโมต
 *
 * เกณฑ์สองข้อ ใช้ OR กัน เพราะสองสถานการณ์นี้ต่างกัน
 *   - ว่างมานาน: เคยเช่าดีแต่ช่วงนี้ไม่มีใครจอง
 *   - แทบไม่เคยถูกเช่า: ของใหม่หรือของที่ลูกค้าไม่รู้จัก
 */
export async function findIdleEquipment(client, { minIdleDays = 7, limit = 6 } = {}) {
  const now = today();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const equipments = await client.equipment.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      units: {
        where: { isActive: true },
        select: {
          id: true,
          status: true,
          rentalCount: true,
          orderItems: {
            where: { order: { status: { in: REAL_RENTAL_STATUSES } } },
            orderBy: { endDate: "desc" },
            select: { startDate: true, endDate: true },
          },
        },
      },
    },
  });

  const scored = equipments
    .filter((eq) => eq.units.length > 0)
    .map((eq) => {
      const allItems = eq.units.flatMap((u) => u.orderItems);

      // วันที่คืนล่าสุด — ใช้วัดว่าปล่อยว่างมากี่วัน
      const lastEnd = allItems.reduce(
        (latest, item) => (!latest || item.endDate > latest ? item.endDate : latest),
        null,
      );

      const idleDays = lastEnd
        ? Math.max(0, Math.round((now - lastEnd) / DAY_MS))
        : Math.round((now - eq.createdAt) / DAY_MS);

      const rentalsLast30 = allItems.filter(
        (item) => item.startDate >= thirtyDaysAgo,
      ).length;

      // มีคิวจองล่วงหน้าไหม ถ้ามีก็ไม่ต้องโปรโมต
      const hasUpcoming = allItems.some((item) => dayKey(item.endDate) >= dayKey(now));

      const availableUnits = eq.units.filter((u) => u.status === "AVAILABLE").length;

      return {
        equipment: eq,
        idleDays,
        rentalsLast30,
        hasUpcoming,
        availableUnits,
        neverRented: allItems.length === 0,
      };
    })
    // ต้องมีของว่างให้เช่าจริง ไม่งั้นโปรโมตไปก็จองไม่ได้
    .filter((row) => row.availableUnits > 0 && !row.hasUpcoming)
    .filter((row) => row.idleDays >= minIdleDays || row.rentalsLast30 === 0)
    .sort((a, b) => b.idleDays - a.idleDays)
    .slice(0, limit);

  return scored.map((row) => ({
    ...row,
    triggerReason: row.neverRented
      ? "ยังไม่เคยถูกเช่าเลย"
      : row.rentalsLast30 === 0
        ? `ไม่มีการเช่าเลยใน 30 วันที่ผ่านมา (ว่าง ${row.idleDays} วัน)`
        : `คิวว่างต่อเนื่อง ${row.idleDays} วัน`,
  }));
}

// ------------------------------------------------------------
//  สร้างร่างโพสด้วย Gemini
// ------------------------------------------------------------

const POST_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "พาดหัวโพสภาษาไทย ไม่เกิน 60 ตัวอักษร ดึงดูดแต่ไม่เกินจริง",
    },
    caption: {
      type: "string",
      description:
        "แคปชั่นภาษาไทย 2-4 ประโยค บอกว่าเหมาะกับงานแบบไหน และปิดท้ายด้วยการชวนจอง",
    },
    highlights: {
      type: "array",
      description: "จุดเด่นของอุปกรณ์ 3 ข้อ ข้อละไม่เกิน 40 ตัวอักษร",
      items: { type: "string" },
    },
  },
  required: ["headline", "caption", "highlights"],
};

const SYSTEM_INSTRUCTION = `คุณเป็นนักเขียนคอนเทนต์การตลาดของร้านให้เช่าอุปกรณ์ถ่ายภาพในจังหวัดยะลา ประเทศไทย
กลุ่มลูกค้าคือช่างภาพอิสระ นักศึกษา และผู้รับงานอีเวนต์ในพื้นที่

หลักการเขียน:
- ใช้ภาษาไทยที่เป็นกันเอง อ่านง่าย ไม่ใช้ศัพท์เทคนิคเกินจำเป็น
- ระบุให้ชัดว่าอุปกรณ์นี้เหมาะกับงานแบบไหน (งานแต่ง อีเวนต์ ถ่ายสินค้า คอนเทนต์วิดีโอ)
- ห้ามกล่าวอ้างสรรพคุณเกินจริง และห้ามแต่งสเปกที่ไม่ได้ให้มา
- ห้ามใส่ราคาที่ไม่ได้ระบุมาให้ และห้ามสัญญาส่วนลดที่ไม่มีอยู่จริง
- ห้ามใช้ emoji

สำคัญที่สุด — ข้อมูลภายในร้านห้ามหลุดออกไปในโพสเด็ดขาด:
ห้ามพูดถึงจำนวนวันที่อุปกรณ์ว่าง สถิติการเช่า หรือเหตุผลที่ร้านเลือกอุปกรณ์นี้มาโปรโมต
เพราะการบอกลูกค้าว่า "ของชิ้นนี้ไม่มีคนเช่ามาหลายวัน" เท่ากับประกาศว่าของไม่เป็นที่นิยม
ให้พูดถึงความพร้อมในเชิงบวกแทน เช่น "ว่างพร้อมให้จอง" โดยไม่ระบุตัวเลขวันที่ว่าง`;

/** สั่ง Gemini ร่างโพสสำหรับอุปกรณ์ 1 รุ่น แล้วบันทึกเป็น DRAFT */
export async function generateDraftForEquipment(client, { equipmentId, adminId }) {
  const equipment = await client.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      units: { where: { isActive: true }, select: { status: true } },
    },
  });

  if (!equipment) throw new MarketingError("ไม่พบรุ่นอุปกรณ์นี้", "NOT_FOUND");

  const idle = await findIdleEquipment(client, { minIdleDays: 0, limit: 100 });
  const stat = idle.find((row) => row.equipment.id === equipmentId);
  const availableUnits = equipment.units.filter((u) => u.status === "AVAILABLE").length;

  const prompt = `เขียนโพสโปรโมชั่นสำหรับอุปกรณ์ให้เช่าชิ้นนี้

ชื่อรุ่น: ${equipment.name}
ยี่ห้อ: ${equipment.brand.name}
ประเภท: ${equipment.category.name}
ค่าเช่า: ${Number(equipment.dailyRate).toLocaleString("th-TH")} บาทต่อวัน
รายละเอียดจากร้าน: ${equipment.description || "ไม่มี"}
จำนวนที่ว่างให้เช่าตอนนี้: ${availableUnits} ชิ้น

[ข้อมูลภายใน ห้ามนำไปเขียนในโพส] ร้านเลือกอุปกรณ์นี้มาโปรโมตเพราะ: ${stat?.triggerReason ?? "ต้องการกระตุ้นยอดเช่า"}

ใช้เฉพาะข้อมูลข้างต้นเท่านั้น ห้ามเพิ่มสเปกหรือราคาที่ไม่ได้ระบุ
และห้ามอ้างอิงข้อมูลภายในหรือตัวเลขวันที่ว่างในเนื้อหาที่ลูกค้าอ่าน`;

  const result = await generateJson({
    prompt,
    schema: POST_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const highlights = Array.isArray(result.highlights)
    ? result.highlights.slice(0, 3).map(String)
    : [];

  const post = await client.aiMarketingPost.create({
    data: {
      equipmentId,
      status: "DRAFT",
      headline: String(result.headline ?? "").slice(0, 200),
      caption: String(result.caption ?? ""),
      highlights,
      triggerReason: stat?.triggerReason?.slice(0, 255) ?? null,
      idleDays: stat?.idleDays ?? null,
    },
  });

  await client.activityLog.create({
    data: {
      type: "AI_POST_GENERATED",
      message: `AI ร่างโพสโปรโมชั่นให้ ${equipment.name} — ${stat?.triggerReason ?? "กระตุ้นยอดเช่า"}`,
      actorId: adminId ?? null,
      refType: "AiMarketingPost",
      refId: post.id,
    },
  });

  return post;
}

// ------------------------------------------------------------
//  จัดการโพส
// ------------------------------------------------------------

/** แก้ไขเนื้อหาโพส (แอดมินตรวจแล้วปรับคำ) */
export async function updatePostTx(client, { postId, headline, caption }) {
  const post = await client.aiMarketingPost.findUnique({ where: { id: postId } });
  if (!post) throw new MarketingError("ไม่พบโพสนี้", "NOT_FOUND");
  if (post.status === "BROADCAST") {
    throw new MarketingError("โพสนี้เผยแพร่ไปแล้ว แก้ไขไม่ได้", "ALREADY_BROADCAST");
  }

  const cleanHeadline = (headline ?? "").trim();
  const cleanCaption = (caption ?? "").trim();

  if (cleanHeadline.length < 5) {
    throw new MarketingError("พาดหัวสั้นเกินไป", "INVALID_HEADLINE");
  }
  if (cleanCaption.length < 20) {
    throw new MarketingError("แคปชั่นสั้นเกินไป (อย่างน้อย 20 ตัวอักษร)", "INVALID_CAPTION");
  }

  await client.aiMarketingPost.update({
    where: { id: postId },
    data: { headline: cleanHeadline.slice(0, 200), caption: cleanCaption },
  });

  return { message: "บันทึกการแก้ไขแล้ว" };
}

/** อนุมัติและเผยแพร่ — REQ-AI-002 "Approve & Broadcast" */
export async function broadcastPostTx(tx, { postId, adminId }) {
  const post = await tx.aiMarketingPost.findUnique({
    where: { id: postId },
    include: { equipment: { select: { name: true } } },
  });

  if (!post) throw new MarketingError("ไม่พบโพสนี้", "NOT_FOUND");
  if (post.status === "BROADCAST") {
    throw new MarketingError("โพสนี้เผยแพร่ไปแล้ว", "ALREADY_BROADCAST");
  }
  if (post.status === "REJECTED") {
    throw new MarketingError("โพสนี้ถูกปฏิเสธไปแล้ว", "ALREADY_REJECTED");
  }

  await tx.aiMarketingPost.update({
    where: { id: postId },
    data: {
      status: "BROADCAST",
      approvedById: adminId ?? null,
      broadcastAt: new Date(),
    },
  });

  await tx.activityLog.create({
    data: {
      type: "AI_POST_BROADCAST",
      message: `เผยแพร่โพสโปรโมชั่น "${post.headline}"${post.equipment ? ` (${post.equipment.name})` : ""}`,
      actorId: adminId ?? null,
      refType: "AiMarketingPost",
      refId: postId,
    },
  });

  return { message: "เผยแพร่โพสเรียบร้อยแล้ว" };
}

/** ไม่อนุมัติโพส */
export async function rejectPostTx(client, { postId, adminId }) {
  const post = await client.aiMarketingPost.findUnique({ where: { id: postId } });
  if (!post) throw new MarketingError("ไม่พบโพสนี้", "NOT_FOUND");
  if (post.status === "BROADCAST") {
    throw new MarketingError("โพสนี้เผยแพร่ไปแล้ว ยกเลิกไม่ได้", "ALREADY_BROADCAST");
  }

  await client.aiMarketingPost.update({
    where: { id: postId },
    data: { status: "REJECTED", approvedById: adminId ?? null },
  });

  return { message: "ยกเลิกร่างโพสแล้ว" };
}
