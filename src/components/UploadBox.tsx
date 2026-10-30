"use client";

import { useImageUpload } from "@/components/useImageUpload";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  /** 原始文件（未压缩）：提交时原图直传后端（不压缩） */
  onFile?: (f: File | null) => void;
}

/** 模特图上传框：桌面占满左侧上半区，图片完整显示不裁切 */
export default function UploadBox({ value, onChange, onFile }: Props) {
  const { inputRef, error, setError, busy, dragOver, setDragOver, handleFile } = useImageUpload({
    onAccept: (dataUrl, file) => {
      onChange(dataUrl);
      onFile?.(file);
    },
  });

  function remove() {
    onChange(null);
    onFile?.(null);
    setError(null);
  }

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-xl border border-dashed transition-colors ${
          dragOver ? "border-accent bg-accent-soft" : "border-line bg-surface"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="模特图预览"
              className="h-[300px] w-full object-contain sm:h-[340px] lg:h-[280px]"
            />
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-white backdrop-blur transition hover:bg-foreground"
              >
                更换
              </button>
              <button
                type="button"
                onClick={remove}
                className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-white backdrop-blur transition hover:bg-foreground"
              >
                移除
              </button>
            </div>
          </>
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
            className="flex h-[300px] w-full flex-col items-center justify-center gap-3 px-6 text-center sm:h-[340px] lg:h-[280px]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-xl font-light text-muted">
              ＋
            </span>
            <span className="text-sm font-medium text-foreground">
              {busy ? "处理中…" : "点击或拖入人像照"}
            </span>
            <span className="text-xs leading-5 text-muted">
              全身 / 半身 / 大头均可
              <br />
              JPG / PNG / WebP，8MB 以内
            </span>
          </button>
        )}
      </div>

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

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
