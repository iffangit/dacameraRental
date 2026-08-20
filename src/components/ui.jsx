import { UNIT_STATUS, CUSTOMER_GRADE } from "@/lib/domain";

/** กล่องเนื้อหามาตรฐาน — ขอบบาง มุมเหลี่ยม ตาม DESIGN.md */
export function Card({ children, className = "" }) {
  return (
    <div className={`border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function CardHead({ title, hint, action }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
      <h3 className="font-head text-[13.5px] font-semibold">{title}</h3>
      {hint && (
        <span className="ml-auto text-[11.5px] text-ink-muted">{hint}</span>
      )}
      {action && <div className={hint ? "" : "ml-auto"}>{action}</div>}
    </div>
  );
}

/** การ์ดตัวเลขสถิติหน้า Dashboard — แถบสีซ้ายบอกหมวดของตัวเลข */
export function StatCard({ label, value, detail, accent }) {
  return (
    <div className="relative overflow-hidden border border-line bg-surface px-4 py-4">
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent }}
      />
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className="tnum mt-1.5 font-head text-[27px] leading-tight font-semibold">
        {value}
      </div>
      <div className="mt-0.5 text-[11.5px] text-ink-muted">{detail}</div>
    </div>
  );
}

/** จุดสี + ข้อความสถานะอุปกรณ์ */
export function StatusBadge({ status }) {
  const meta = UNIT_STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
      style={{ color: meta.color }}
    >
      <i className="dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

/** ป้ายเกรดความเสี่ยงลูกค้า A/B/C — REQ-RISK-001 */
export function GradeBadge({ grade }) {
  const meta = CUSTOMER_GRADE[grade];
  return (
    <span
      className="border px-1.5 font-head text-[10.5px] font-bold"
      style={{ borderColor: meta.color, color: meta.color }}
      title={meta.description}
    >
      {grade}
    </span>
  );
}

/**
 * แถบความคืบหน้ารอบบำรุงรักษา — REQ-RISK-003
 * เขียว < 70%, ส้ม 70–99%, แดงเมื่อครบเกณฑ์
 */
export function CycleBar({ current, limit, suffix = "" }) {
  const ratio = Math.min(current / limit, 1);
  const color =
    ratio >= 1
      ? "var(--color-primary)"
      : ratio >= 0.7
        ? "var(--color-maintenance)"
        : "var(--color-available)";

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-[5px] w-14 shrink-0 bg-line">
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${ratio * 100}%`, background: color }}
        />
      </div>
      <span className="tnum font-head text-[11px] text-ink-muted">
        {current}/{limit}
        {suffix}
      </span>
    </div>
  );
}

/** ป้ายไอคอนตัวอักษร (EQ, RT, AI...) */
export function Tag({ children, color }) {
  return (
    <span
      className="tag shrink-0"
      style={color ? { borderColor: color, color } : undefined}
    >
      {children}
    </span>
  );
}

/** ปุ่ม */
export function Button({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center gap-1.5 border font-head font-medium transition-colors";
  const sizes = {
    md: "h-8 px-3.5 text-[12.5px]",
    sm: "h-[26px] px-2.5 text-[11.5px]",
  };
  const variants = {
    default:
      "border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
    primary:
      "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
