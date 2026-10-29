"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/storage";
import { isPortraitRatio, validatePhotoFile } from "@/lib/validation";

interface Props {
  kind: "person" | "garment";
  value: string | null;
  onChange: (v: string | null) => void;
  /** 全身照确认勾选（仅 person 需要） */
  confirmed?: boolean;
  onConfirmed?: (b: boolean) => void;
}

async function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function UploadBox({ kind, value, onChange, confirmed = false, onConfirmed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratioWarning, setRatioWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isPerson = kind === "person";

  async function handleFile(file?: File | null) {
    if (!file || busy) return;
    const err = validatePhotoFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setRatioWarning(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (isPerson) {
        const dim = await imageSize(dataUrl);
        if (dim && !isPortraitRatio(dim.width, dim.height)) {
          setRatioWarning("这张是横图，看起来不像全身照。请上传竖着拍的全身照。");
        }
      }
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片处理失败，请换一张");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    onChange(null);
    setError(null);
    setRatioWarning(null);
    onConfirmed?.(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium">{isPerson ? "你的全身照" : "衣服图"}</span>
        <span className="text-xs text-muted">
          {isPerson ? "竖拍、光线好、背景简单" : "商品图或平铺图均可"}
        </span>
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-xl bg-card ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={isPerson ? "全身照预览" : "衣服图预览"}
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

      {ratioWarning && <p className="mt-1.5 text-xs text-amber-600">{ratioWarning}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {isPerson && value && (
        <label className="mt-2 flex items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirmed?.(e.target.checked)}
            className="mt-0.5 accent-accent"
          />
          我确认这是一张清晰、完整的全身照（不是半身或大头照）
        </label>
      )}
    </div>
  );
}
