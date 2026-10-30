"use client";

import { useImageUpload } from "@/components/useImageUpload";
import {
  GARMENT_REF_TYPE_LABEL,
  GARMENT_REF_TYPES,
  type GarmentRefType,
} from "@/lib/types";

interface Props {
  index: number;
  value: string | null;
  type?: GarmentRefType;
  onChange: (v: string | null) => void;
  onTypeChange?: (t: GarmentRefType) => void;
  onFile?: (f: File | null) => void;
}

/** 单品格：一个上传位 = 1 张单品图（最多 4 格，PRD v1.4） */
export default function GarmentSlot({
  index,
  value,
  type = "garment",
  onChange,
  onTypeChange,
  onFile,
}: Props) {
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
    <div className="min-w-0">
      {value ? (
        <div className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-card">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="block h-full w-full"
            aria-label={`更换单品 ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={`单品 ${index + 1} 预览`}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white">
            单品 {index + 1}
          </span>
          <button
            type="button"
            onClick={remove}
            aria-label={`移除单品 ${index + 1}`}
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-xs text-white backdrop-blur transition hover:bg-foreground"
          >
            ×
          </button>
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
          className={`flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-muted transition-colors ${
            dragOver
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-background hover:border-accent/40 hover:text-accent"
          }`}
        >
          <span className="text-lg font-light leading-none">＋</span>
          <span className="text-[11px]">{busy ? "处理中…" : `单品 ${index + 1}`}</span>
        </button>
      )}

      <select
        aria-label={`单品 ${index + 1} 类型`}
        title="眼镜、帽子、项链请选「配饰」；配饰尽量用干净商品图，不要带模特脸/手。"
        value={type}
        onChange={(e) => onTypeChange?.(e.target.value as GarmentRefType)}
        className="mt-1.5 w-full rounded-lg border border-line bg-background/70 px-2 py-1.5 text-[11px] text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
      >
        {GARMENT_REF_TYPES.map((t) => (
          <option key={t} value={t}>
            {GARMENT_REF_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      {type === "accessories" && (
        <p className="mt-1 text-[10px] leading-4 text-muted">
          眼镜、帽子、项链请选「配饰」；配饰尽量用干净商品图，不要带模特脸/手。
        </p>
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

      {error && <p className="mt-1.5 text-[11px] leading-4 text-danger">{error}</p>}
    </div>
  );
}
