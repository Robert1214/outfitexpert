/**
 * 原图上传内存通道：上传给后端的两张原图（不压缩，fileToRawDataUrl 直读）
 * 只在内存里从首页传到结果页——客户端路由跳转不刷新页面，模块变量不丢。
 * 不落 localStorage：压缩版仍存 localStorage 供结果页回显（避免超 5MB 配额）。
 * 刷新结果页时内存丢失，结果页自动退回 localStorage 压缩版，功能不受影响。
 */
import type { GarmentRefType } from "@/lib/types";

export interface PendingTryon {
  personImage: string;
  garmentImages: string[];
  /** 与 garmentImages 一一对应 */
  garmentTypes: GarmentRefType[];
}

let pending: PendingTryon | null = null;

export function setPendingTryon(images: PendingTryon | null): void {
  pending = images;
}

export function getPendingTryon(): PendingTryon | null {
  return pending;
}
