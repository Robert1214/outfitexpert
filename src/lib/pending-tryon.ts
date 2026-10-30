/**
 * 高清上传内存通道：上传给后端的两张高清图（最长边 2048、q0.92）
 * 只在内存里从首页传到结果页——客户端路由跳转不刷新页面，模块变量不丢。
 * 不落 localStorage：压缩版仍存 localStorage 供结果页回显（避免超 5MB 配额）。
 * 刷新结果页时内存丢失，结果页自动退回 localStorage 压缩版，功能不受影响。
 */
let pending: { personImage: string; garmentImage: string } | null = null;

export function setPendingTryon(images: { personImage: string; garmentImage: string } | null): void {
  pending = images;
}

export function getPendingTryon(): { personImage: string; garmentImage: string } | null {
  return pending;
}
