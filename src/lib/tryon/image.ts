/** 图片数据转换（服务端专用） */

export interface ImagePayload {
  buffer: Buffer;
  contentType: string;
}

/** data URL（data:image/jpeg;base64,…）转 Buffer，格式不对返回 null */
export function dataUrlToBuffer(dataUrl: string): ImagePayload | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}
