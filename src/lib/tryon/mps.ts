/**
 * 腾讯云 MPS：AI 换装（服务端专用）。
 * 发起 ProcessImage 任务 → 用 TaskId 轮询 DescribeImageTaskDetail → 拿效果图链接。
 */
import { mps } from "tencentcloud-sdk-nodejs";
import { TryonError } from "./errors";
import type { TryonConfig } from "./config";

const MpsClient = mps.v20190612.Client;

/** 换装模型：tryon-1.0-lite（2026-10-30 用户定档：lite 效果已够用，单价 1.00 元/张） */
const TRYON_MODEL = "tryon-1.0-lite";
/** 输出分辨率：1K（1K+flash 为当前选定配置，实测约 50 秒） */
const OUTPUT_RESOLUTION = "1K";
/** 换装指令：把模特原服装替换为参考服饰 */
export const TRYON_PROMPT = "将[图片1]中模特的服装替换为[图片2]中的服装，保持人物形象与姿态自然";

/** ImageSet 参考图类型（官方支持值） */
export type RefImageType =
  | "garment"
  | "accessories"
  | "shoes"
  | "identity"
  | "pose"
  | "background";

export interface RefImageUrl {
  type: RefImageType;
  url: string;
}

export interface StartTryonInput {
  personUrl: string;
  refs: RefImageUrl[];
  /** 自定义换装指令，缺省用 TRYON_PROMPT */
  prompt?: string;
}

export interface TryonTaskOpts {
  /** 轮询总时长上限（MPS 换装通常 20~60 秒） */
  timeoutMs?: number;
  /** 轮询间隔 */
  intervalMs?: number;
}

function newClient(cfg: TryonConfig) {
  return new MpsClient({
    credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
    region: cfg.mpsRegion,
    profile: { httpProfile: { endpoint: "mps.tencentcloudapi.com", reqTimeout: 30 } },
  });
}

/** 发起 AI 换装任务，返回 TaskId */
export async function startTryonTask(
  cfg: TryonConfig,
  input: StartTryonInput
): Promise<string> {
  let taskId: string | undefined;
  try {
    const res = await newClient(cfg).ProcessImage({
      InputInfo: { Type: "URL", UrlInputInfo: { Url: input.personUrl } },
      // RMS：结果不落我们自己的存储，直接返回 1 小时有效的链接
      OutputStorage: { Type: "RMS" },
      OutputDir: "/outfitexpert/",
      ImageTask: {
        AiTryOnConfig: {
          Model: TRYON_MODEL,
          Resolution: OUTPUT_RESOLUTION,
          Prompt: input.prompt ?? TRYON_PROMPT,
        },
      },
      AddOnParameter: {
        // 支持多张参考图（官方上限 13 张）：Type 可为 garment/accessories/shoes/…
        ImageSet: input.refs.map((r) => ({
          Type: r.type,
          Image: { Type: "URL", UrlInputInfo: { Url: r.url } },
        })),
      },
    });
    taskId = res.TaskId;
  } catch (e) {
    throw toMpsError(e, "发起换装任务");
  }
  if (!taskId) throw new TryonError("task-failed", "MPS 未返回任务 ID");
  return taskId;
}

/** 轮询任务结果，拿到效果图 URL 后返回 */
export async function waitForTryonTask(
  cfg: TryonConfig,
  taskId: string,
  opts: TryonTaskOpts = {}
): Promise<{ imageUrl: string }> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    let res;
    try {
      res = await newClient(cfg).DescribeImageTaskDetail({ TaskId: taskId });
    } catch (e) {
      throw toMpsError(e, "查询换装任务");
    }

    if (res.Status === "FINISH") {
      // 注意：FINISH 不等于成功，ErrMsg 非空说明任务实际失败
      const errMsg = res.ErrMsg?.trim();
      if (errMsg) throw new TryonError("task-failed", `MPS 任务失败：${errMsg}`);
      const imageUrl = res.ImageProcessTaskResultSet?.[0]?.Output?.SignedUrl;
      if (!imageUrl) throw new TryonError("task-failed", "任务完成但未返回效果图");
      return { imageUrl };
    }

    if (Date.now() >= deadline) {
      throw new TryonError("timeout", `等待 MPS 结果超时（${timeoutMs / 1000} 秒）`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function toMpsError(e: unknown, action: string): TryonError {
  const code = (e as { code?: string })?.code ?? "";
  const message = e instanceof Error ? e.message : String(e);
  console.error(`MPS ${action} 失败 [${code}]:`, message);
  if (/AuthFailure|InvalidCredential|SignatureFailure|UnauthorizedOperation/i.test(code)) {
    return new TryonError("config", `腾讯云密钥或 MPS 权限配置有误（${action}）`);
  }
  return new TryonError("task-failed", `MPS ${action} 失败：${message}`);
}
