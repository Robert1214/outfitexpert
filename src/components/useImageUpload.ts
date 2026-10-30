"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/storage";
import { validatePhotoFile } from "@/lib/validation";

function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface Options {
  /** 校验通过、压缩完成后回调（回显 data URL + 原始文件，原图提交时用） */
  onAccept: (dataUrl: string, file: File) => void;
}

/** 上传框共用逻辑：格式/大小校验、压缩、小图拦截、拖拽状态 */
export function useImageUpload({ onAccept }: Options) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
      onAccept(dataUrl, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片处理失败，请换一张");
    } finally {
      setBusy(false);
    }
  }

  return { inputRef, error, setError, busy, dragOver, setDragOver, handleFile };
}
