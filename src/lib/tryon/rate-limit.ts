/**
 * 调用次数上限：每人每天 10 次（PRD M2，服务端专用）。
 * 目前无登录体系，按来源 IP 计数；进程内存存储，服务重启会清零（本地演示可接受，M3 换持久化）。
 *
 * 当前状态（2026-10-31）：用户要求先取消每日限制，/api/tryon 已不再调用本模块。
 * 如需恢复，在 src/app/api/tryon/route.ts 里重新调用 consumeDailyQuota。
 */

export const DAILY_LIMIT = 10;

const counts = new Map<string, { day: string; count: number }>();

function today(): string {
  return new Date().toDateString();
}

/** 消耗一次额度，返回是否放行和剩余次数 */
export function consumeDailyQuota(ip: string): { allowed: boolean; remaining: number } {
  const day = today();
  const cur = counts.get(ip);
  if (!cur || cur.day !== day) {
    counts.set(ip, { day, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }
  cur.count += 1;
  return { allowed: cur.count <= DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - cur.count) };
}
