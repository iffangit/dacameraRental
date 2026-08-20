"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm({ next, initialError }) {
  const [state, formAction, pending] = useActionState(login, null);
  const message = state?.message ?? initialError;

  return (
    <form action={formAction} className="border border-line bg-surface p-6">
      <input type="hidden" name="next" value={next ?? ""} />

      <label
        htmlFor="email"
        className="mb-1 block font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
      >
        อีเมล
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
        disabled={pending}
        placeholder="admin@dacamera.local"
        className="mb-4 h-9 w-full border border-line bg-canvas px-3 text-[13.5px] outline-none focus:border-primary focus:bg-white disabled:opacity-60"
      />

      <label
        htmlFor="password"
        className="mb-1 block font-head text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
      >
        รหัสผ่าน
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={pending}
        className="h-9 w-full border border-line bg-canvas px-3 text-[13.5px] outline-none focus:border-primary focus:bg-white disabled:opacity-60"
      />

      {message && (
        <p
          role="alert"
          className="mt-4 border-l-[3px] border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-9 w-full items-center justify-center border border-primary bg-primary font-head text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
