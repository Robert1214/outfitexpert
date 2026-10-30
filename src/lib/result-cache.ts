/**
 * 结果缓存（客户端专用）：sessionStorage 里保存最近一次生成结果，
 * 刷新结果页时直接复用，避免重复调用 MPS 扣费。
 * 只存图片 URL + 时间 + 签名，不存图片本身。
 */
import type { TryonPayload } from "@/lib/types";

const RESULT_KEY = "outfitexpert:result";
const INFLIGHT_KEY = "outfitexpert:inflight";
/** MPS 结果链接 1 小时有效，缓存留 5 分钟余量 */
const RESULT_TTL_MS = 55 * 60 * 1000;

export interface CachedResult {
  imageUrl: string;
  createdAt: number;
  signature: string;
}

export interface InflightMark {
  signature: string;
  startedAt: number;
}

/** FNV-1a 32 位哈希（轻量、同步、不依赖 Web Crypto） */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 对象键排序后序列化，保证同一份数据每次摘要一致 */
function stableJson(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return JSON.stringify(sorted);
}

/** payload 的稳定摘要：图片内容、类型、身体/衣服数据都参与，但不存储图片本身 */
export function payloadSignature(p: TryonPayload): string {
  const raw = [
    p.personImage,
    ...p.garmentImages,
    p.garmentTypes.join(","),
    stableJson(p.body as unknown as Record<string, unknown>),
    stableJson(p.garment as unknown as Record<string, unknown>),
  ].join("|");
  // 同时带上长度，降低 32 位哈希碰撞概率
  return `${fnv1a(raw)}-${raw.length.toString(16)}`;
}

export function loadResultCache(): CachedResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CachedResult>;
    if (
      typeof v.imageUrl === "string" &&
      typeof v.createdAt === "number" &&
      typeof v.signature === "string"
    ) {
      return { imageUrl: v.imageUrl, createdAt: v.createdAt, signature: v.signature };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveResultCache(result: CachedResult): void {
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    // 存储不可用时退化为无缓存，不阻塞生成
  }
}

export function clearResultCache(): void {
  try {
    sessionStorage.removeItem(RESULT_KEY);
  } catch {
    // 忽略
  }
}

/** 缓存是否可用于当前 payload（签名一致且在有效期内） */
export function isResultCacheFresh(
  cache: CachedResult | null,
  signature: string
): cache is CachedResult {
  if (!cache || cache.signature !== signature) return false;
  const age = Date.now() - cache.createdAt;
  return age >= 0 && age < RESULT_TTL_MS;
}

export function loadInflight(): InflightMark | null {
  try {
    const raw = sessionStorage.getItem(INFLIGHT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<InflightMark>;
    if (typeof v.signature === "string" && typeof v.startedAt === "number") {
      return { signature: v.signature, startedAt: v.startedAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveInflight(mark: InflightMark): void {
  try {
    sessionStorage.setItem(INFLIGHT_KEY, JSON.stringify(mark));
  } catch {
    // 忽略
  }
}

export function clearInflight(): void {
  try {
    sessionStorage.removeItem(INFLIGHT_KEY);
  } catch {
    // 忽略
  }
}
