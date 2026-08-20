import { prisma } from "@/lib/prisma";
import { Card, CardHead, Tag } from "@/components/ui";
import { formatBaht, formatThaiDate, formatThaiTime } from "@/lib/domain";
import { findIdleEquipment } from "@/lib/marketing";
import { hasGeminiKey } from "@/lib/gemini";
import GenerateButton from "./GenerateButton";
import PostCard from "./PostCard";

export const dynamic = "force-dynamic";

async function loadMarketing() {
  const [idle, drafts, broadcast] = await Promise.all([
    findIdleEquipment(prisma),
    prisma.aiMarketingPost.findMany({
      where: { status: "DRAFT" },
      orderBy: { generatedAt: "desc" },
      include: { equipment: { select: { name: true } } },
    }),
    prisma.aiMarketingPost.findMany({
      where: { status: "BROADCAST" },
      orderBy: { broadcastAt: "desc" },
      take: 8,
      include: {
        equipment: { select: { name: true } },
        approvedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return { idle, drafts, broadcast };
}

export default async function MarketingPage() {
  const { idle, drafts, broadcast } = await loadMarketing();
  const keyReady = hasGeminiKey();

  // รุ่นที่มีร่างค้างอยู่แล้ว ไม่ควรให้กดสร้างซ้ำจนมีร่างซ้อนกัน
  const draftedEquipmentIds = new Set(drafts.map((d) => d.equipmentId));

  return (
    <div className="flex flex-col gap-4">
      {!keyReady && (
        <div className="flex items-start gap-3 border border-line border-l-[3px] border-l-maintenance bg-surface px-4 py-3">
          <Tag color="var(--color-maintenance)">!</Tag>
          <div>
            <b className="font-head text-[13px] font-semibold">ยังไม่ได้ตั้งค่า GEMINI_API_KEY</b>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              เพิ่มคีย์ลงในไฟล์ <code>.env</code> แล้วรีสตาร์ท dev server
              จึงจะสั่ง AI ร่างโพสได้ — ขอคีย์ได้ที่ aistudio.google.com/apikey
            </p>
          </div>
        </div>
      )}

      {/* ---------------- อุปกรณ์ที่ควรโปรโมต ---------------- */}
      <Card>
        <CardHead
          title="อุปกรณ์ที่ระบบเสนอให้โปรโมต"
          hint={`พบ ${idle.length} รุ่น · ตรวจจากคิวว่างและสถิติการเช่าจริง`}
        />

        {idle.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
            ตอนนี้ไม่มีอุปกรณ์ที่เข้าเกณฑ์ — อุปกรณ์ทุกรุ่นมีคิวจองหรือถูกเช่าอยู่
          </p>
        ) : (
          <div className="divide-y divide-line">
            {idle.map((row) => {
              const alreadyDrafted = draftedEquipmentIds.has(row.equipment.id);
              return (
                <div
                  key={row.equipment.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">
                      {row.equipment.name}
                    </div>
                    <div className="text-[12px] text-ink-muted">
                      {row.equipment.category.name} ·{" "}
                      {formatBaht(Number(row.equipment.dailyRate))}/วัน · ว่าง{" "}
                      {row.availableUnits} ชิ้น
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-head text-[12px] font-semibold text-maintenance">
                      {row.triggerReason}
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      เช่าใน 30 วันที่ผ่านมา: {row.rentalsLast30} ครั้ง
                    </div>
                  </div>

                  {alreadyDrafted ? (
                    <span className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12px] text-ink-muted">
                      มีร่างรออนุมัติแล้ว
                    </span>
                  ) : (
                    <GenerateButton
                      equipmentId={row.equipment.id}
                      disabled={!keyReady}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------------- ร่างโพสรออนุมัติ ---------------- */}
      <div>
        <h2 className="mb-2.5 font-head text-[13.5px] font-semibold">
          ร่างโพสรออนุมัติ{" "}
          <span className="text-ink-muted">({drafts.length})</span>
        </h2>

        {drafts.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <p className="text-[13px] text-ink-muted">
              ยังไม่มีร่างโพส — กด &quot;ให้ AI ร่างโพส&quot; จากรายการด้านบน
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {drafts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  id: post.id,
                  headline: post.headline,
                  caption: post.caption,
                  highlights: Array.isArray(post.highlights) ? post.highlights : [],
                  triggerReason: post.triggerReason,
                  equipmentName: post.equipment?.name ?? null,
                  generatedAtLabel: `${formatThaiDate(post.generatedAt)} ${formatThaiTime(post.generatedAt)}`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------------- เผยแพร่แล้ว ---------------- */}
      {broadcast.length > 0 && (
        <Card>
          <CardHead title="เผยแพร่แล้ว" hint={`${broadcast.length} รายการล่าสุด`} />
          <div className="divide-y divide-line">
            {broadcast.map((post) => (
              <div key={post.id} className="flex gap-3 px-4 py-3">
                <Tag color="var(--color-available)">ON</Tag>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{post.headline}</div>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-muted">
                    {post.caption}
                  </p>
                  <div className="mt-1 font-head text-[11px] text-ink-muted">
                    {post.equipment?.name ?? "ทั่วไป"} · เผยแพร่{" "}
                    {post.broadcastAt
                      ? `${formatThaiDate(post.broadcastAt)} ${formatThaiTime(post.broadcastAt)}`
                      : "-"}
                    {post.approvedBy ? ` · โดย ${post.approvedBy.fullName}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        ระบบตรวจจับอุปกรณ์ที่ <b>มีของว่างจริงและไม่มีคิวจองล่วงหน้า</b> โดยดูจากวันที่คืนล่าสุด
        และจำนวนครั้งที่ถูกเช่าใน 30 วัน (REQ-AI-002) · เหตุผลที่หยิบอุปกรณ์มาโปรโมตเป็น
        <b>ข้อมูลภายใน</b> ที่ส่งให้ AI เป็นบริบทเท่านั้น ไม่ถูกนำไปเขียนในโพสที่ลูกค้าเห็น ·
        ทุกโพสต้องผ่านการตรวจของแอดมินก่อนเผยแพร่เสมอ
      </p>
    </div>
  );
}
