"use client";

import { useActionState, useState } from "react";
import { broadcastPost, rejectPost, savePost } from "./actions";
import { withToast } from "@/components/Toast";
import ConfirmButton from "@/components/ConfirmButton";

/**
 * การ์ดร่างโพสที่แก้ไขได้ในตัว — REQ-AI-002
 *
 * ปุ่ม "Approve & Broadcast" ส่งข้อความที่แก้แล้วไปด้วยเสมอ
 * เพราะพฤติกรรมจริงคือแอดมินแก้คำแล้วกดเผยแพร่เลย ไม่กดบันทึกก่อน
 */
export default function PostCard({ post }) {
  const [headline, setHeadline] = useState(post.headline);
  const [caption, setCaption] = useState(post.caption);

  const [, saveAction, saving] = useActionState(withToast(savePost), null);
  const [, castAction, casting] = useActionState(withToast(broadcastPost), null);
  const [, rejAction, rejecting] = useActionState(withToast(rejectPost), null);

  const busy = saving || casting || rejecting;
  const edited = headline !== post.headline || caption !== post.caption;

  return (
    <div className="border border-line bg-surface">
      {/* หัวการ์ด */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="tag" style={{ borderColor: "var(--color-cleaning)", color: "var(--color-cleaning)" }}>
          AI
        </span>
        <span className="font-head text-[12.5px] font-semibold">
          {post.equipmentName ?? "โพสทั่วไป"}
        </span>
        {post.triggerReason && (
          <span className="border border-line bg-canvas px-1.5 py-0.5 text-[11px] text-ink-muted">
            {post.triggerReason}
          </span>
        )}
        <span className="ml-auto font-head text-[11px] text-ink-muted">
          ร่างเมื่อ {post.generatedAtLabel}
        </span>
      </div>

      <div className="p-4">
        <label className="mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
          พาดหัว
        </label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          disabled={busy}
          className="mb-3 w-full border border-line bg-canvas px-2.5 py-1.5 font-head text-[14px] font-semibold outline-none focus:border-primary focus:bg-white disabled:opacity-60"
        />

        <label className="mb-1 block font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
          แคปชั่น
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
          rows={4}
          className="w-full resize-y border border-line bg-canvas px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-primary focus:bg-white disabled:opacity-60"
        />

        {post.highlights.length > 0 && (
          <>
            <div className="mt-3 mb-1 font-head text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
              จุดเด่นที่ AI สรุป
            </div>
            <ul className="space-y-0.5">
              {post.highlights.map((h, i) => (
                <li key={i} className="text-[12.5px] text-ink-muted">
                  • {h}
                </li>
              ))}
            </ul>
          </>
        )}

      </div>

      {/* ปุ่มจัดการ */}
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        <form action={castAction} className="flex-1">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="headline" value={headline} />
          <input type="hidden" name="caption" value={caption} />
          <ConfirmButton
            disabled={busy}
            pending={casting}
            confirmTitle="เผยแพร่โพสนี้?"
            confirmDescription="เมื่อเผยแพร่แล้วจะแก้ไขหรือยกเลิกไม่ได้ ตรวจข้อความให้เรียบร้อยก่อน"
            confirmLabel="เผยแพร่"
            tone="danger"
            className="inline-flex h-8 w-full items-center justify-center border border-primary bg-primary px-3.5 font-head text-[12.5px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {casting ? "กำลังเผยแพร่..." : "Approve & Broadcast"}
          </ConfirmButton>
        </form>

        <form action={saveAction}>
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="headline" value={headline} />
          <input type="hidden" name="caption" value={caption} />
          <button
            type="submit"
            disabled={busy || !edited}
            title={edited ? undefined : "ยังไม่มีการแก้ไข"}
            className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12.5px] hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกร่าง"}
          </button>
        </form>

        <form action={rejAction}>
          <input type="hidden" name="postId" value={post.id} />
          <ConfirmButton
            disabled={busy}
            pending={rejecting}
            confirmTitle="ยกเลิกร่างโพสนี้?"
            confirmDescription="ร่างจะถูกทิ้ง และต้องให้ AI เขียนใหม่ถ้าต้องการโปรโมตอุปกรณ์ชิ้นนี้อีก"
            confirmLabel="ยกเลิกร่าง"
            tone="danger"
            className="inline-flex h-8 items-center border border-line-strong px-3 font-head text-[12.5px] hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {rejecting ? "..." : "ไม่อนุมัติ"}
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
