import type { TryonPayload } from "@/lib/types";

/**
 * 数据传递：图片压缩后存浏览器 localStorage，结果页从 localStorage 读取
 * （表单数据 + 压缩图回显兜底）。上传给后端的高清图不经过这里，
 * 走内存通道 src/lib/pending-tryon.ts。
 */

const KEY = "outfitexpert:payload";

export interface ImageEncodeOptions {
  /** 最长边上限（px），超出等比缩小。默认 900：存 localStorage 回显用，别改大（会超 5MB 配额） */
  maxDim?: number;
  /** JPEG 压缩质量 0~1，默认 0.85 */
  quality?: number;
}

/**
 * 把图片压缩成 data URL。
 * 两条路各取所需：localStorage 回显用默认 900px 压缩版；上传给后端
 * 不经过本函数，直接传原图（fileToRawDataUrl，见 pending-tryon.ts）。
 */
export function fileToDataUrl(file: File, opts: ImageEncodeOptions = {}): Promise<string> {
  const maxDim = opts.maxDim ?? 900;
  const quality = opts.quality ?? 0.85;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法读取图片");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，请换一张试试"));
    };
    img.src = url;
  });
}

/**
 * 原图转 data URL（不压缩、不重编码，只是 base64）：上传后端专用。
 * 走内存通道（见 pending-tryon.ts），不落 localStorage。
 */
export function fileToRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("图片读取失败，请换一张试试"));
    reader.readAsDataURL(file);
  });
}

export function savePayload(p: TryonPayload): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 空间不足时结果页走「无数据」兜底，不打断用户
  }
}

export function loadPayload(): TryonPayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TryonPayload & { garmentImage?: string };
    // 兼容 v1.3 及以前的单张衣服图缓存（用户浏览器里可能还留着旧 payload）
    if (!Array.isArray(parsed.garmentImages) && typeof parsed.garmentImage === "string") {
      parsed.garmentImages = [parsed.garmentImage];
    }
    if (!Array.isArray(parsed.garmentImages) || parsed.garmentImages.length === 0) return null;
    delete parsed.garmentImage;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPayload(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}
