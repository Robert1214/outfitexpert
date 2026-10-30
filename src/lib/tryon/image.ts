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

/** 读 JPEG/PNG/WebP 文件头的像素尺寸（日志用），解析不了返回 null */
export function dimsOf(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      // PNG：宽高在 IHDR（第 16~23 字节）
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG：扫段标记找 SOF0~SOF15（排除 DHT/0xC4、JPG/0xC8、DAC/0xCC）
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8X" && buf.length > 29) {
        return {
          width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
          height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
        };
      }
      if (kind === "VP8 " && buf.length > 29) {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (kind === "VP8L" && buf.length > 24) {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    return null;
  } catch {
    return null;
  }
}
