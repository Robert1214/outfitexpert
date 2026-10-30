/** 试穿流程错误：route 层按 kind 转成 HTTP 状态码和用户文案（服务端专用） */

export type TryonErrorKind =
  | "config" // 密钥 / 配置缺失
  | "rate-limit" // 超出每日次数上限
  | "bad-input" // 请求数据不合法
  | "task-failed" // MPS 任务失败
  | "timeout" // 轮询超时
  | "internal"; // 未预期错误

export class TryonError extends Error {
  constructor(
    public kind: TryonErrorKind,
    message: string
  ) {
    super(message);
    this.name = "TryonError";
  }
}

/** 给用户看的文案（不含内部细节，MPS 原始错误只记服务端日志） */
export const USER_MESSAGES: Record<TryonErrorKind, string> = {
  config: "试穿服务还没配置好，请稍后再试",
  "rate-limit": "今天试用次数已达上限（10 次/天），明天再来",
  "bad-input": "图片数据不完整，请重新上传",
  "task-failed": "生成失败，请重试",
  timeout: "生成超时，请重试",
  internal: "生成失败，请重试",
};

export function httpStatus(kind: TryonErrorKind): number {
  switch (kind) {
    case "rate-limit":
      return 429;
    case "bad-input":
      return 400;
    case "config":
      return 503;
    case "task-failed":
      return 502;
    case "timeout":
      return 504;
    default:
      return 500;
  }
}
