import { Tag } from "./ui";

/** หน้าที่ยังไม่ได้สร้าง — ระบุ REQ ที่หน้านั้นต้องรองรับไว้ให้เห็นชัด */
export default function ComingSoon({ tag, title, description, reqs = [] }) {
  return (
    <div className="border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <div className="mb-3.5 flex justify-center">
        <Tag>{tag}</Tag>
      </div>
      <h3 className="font-head text-[15px] font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] text-ink-muted">
        {description}
      </p>
      {reqs.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {reqs.map((req) => (
            <span
              key={req}
              className="border border-line bg-canvas px-2 py-0.5 font-head text-[10.5px] text-ink-muted"
            >
              {req}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
