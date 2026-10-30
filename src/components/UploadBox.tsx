"use client";

import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/storage";
import { validatePhotoFile } from "@/lib/validation";

interface Props {
  kind: "person" | "garment";
  value: string | null;
  onChange: (v: string | null) => void;
  /** 原始文件（未压缩）：首页提交时用它生成高清版（最长边 2048）传给后端 */
  onFile?: (f: File | null) => void;
}

async function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function UploadBox({ kind, value, onChange, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // 配饰提醒气泡：桌面悬停靠 CSS，手机点击靠这个开关
  const [showTip, setShowTip] = useState(false);

  const isPerson = kind === "person";

  // 点开气泡后，点页面其他位置自动收起（手机体验）
  useEffect(() => {
    if (!showTip) return;
    const close = () => setShowTip(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showTip]);

  async function handleFile(file?: File | null) {
    if (!file || busy) return;
    const err = validatePhotoFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      // 基本质量：尺寸太小的图多半看不清主体，拦下并提示换一张
      const dim = await imageSize(dataUrl);
      if (dim && (dim.width < 200 || dim.height < 200)) {
        setError("图片太小，可能看不清主体，请换一张清晰的照片");
        return;
      }
      onChange(dataUrl);
      onFile?.(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片处理失败，请换一张");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    onChange(null);
    onFile?.(null);
    setError(null);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium">{isPerson ? "你的人像照" : "衣服图"}</span>
        {!isPerson && (
          <div className="group relative inline-flex">
            <button
              type="button"
              aria-label="配饰提醒"
              aria-expanded={showTip}
              onClick={() => setShowTip((s) => !s)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] ring-1 ring-line transition-colors hover:bg-accent/10"
            >
              ❓
            </button>
            <span
              role="tooltip"
              className={`pointer-events-none absolute left-0 top-full z-10 mt-2 w-56 rounded-xl bg-card p-3 text-xs leading-5 text-foreground shadow-lg ring-1 ring-line transition-opacity ${
                showTip
                  ? "visible opacity-100"
                  : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
              }`}
            >
              如果是帽子、眼镜、项链等配饰，则半身效果会更好哦！
            </span>
          </div>
        )}
        <span className="text-xs text-muted">
          {isPerson ? "全身 / 半身 / 大头均可，光线好、主体清晰" : "商品图或平铺图均可"}
        </span>
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-xl bg-card ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={isPerson ? "人像照预览" : "衣服图预览"}
            className="max-h-64 w-full object-contain"
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/75"
            >
              更换
            </button>
            <button
              type="button"
              onClick={remove}
              className="rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/75"
            >
              移除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-muted transition-colors ${
            dragOver ? "border-accent bg-accent/5" : "border-line hover:border-accent/50"
          }`}
        >
          <span className="text-2xl">{isPerson ? "📷" : "👗"}</span>
          <span className="text-sm">{busy ? "处理中…" : "点击或拖入图片"}</span>
          <span className="text-xs">JPG / PNG / WebP，8MB 以内</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
