import type { TryonPayload } from "@/lib/types";

/**
 * M1 数据传递：图片与表单数据压缩后存浏览器 localStorage，
 * 结果页从 localStorage 读取。不经过服务器（M2 接后端后替换）。
 */

const KEY = "outfitexpert:payload";

/** 把图片压缩成 data URL（降尺寸降画质，避免撑爆 localStorage） */
export function fileToDataUrl(file: File, maxDim = 900, quality = 0.85): Promise<string> {
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
    return raw ? (JSON.parse(raw) as TryonPayload) : null;
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
