"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  text: string;
  label?: string;
}

/**
 * 灰色 ❓ 提示：桌面悬停、手机点击；点页面其他位置收起。
 * PRD：移动端不能只做 hover。
 */
export default function HintTip({ text, label = "配饰提醒" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <span className="group relative ml-auto inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-[11px] font-medium text-muted transition-colors hover:border-muted hover:text-foreground"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-accent p-3 text-left text-xs font-normal leading-5 text-white shadow-xl transition-opacity ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
