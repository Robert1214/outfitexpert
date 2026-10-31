/**
 * 腾讯云 MPS：AI 换装（服务端专用）。
 * 发起 ProcessImage 任务 → 用 TaskId 轮询 DescribeImageTaskDetail → 拿效果图链接。
 */
import { mps } from "tencentcloud-sdk-nodejs";
import { TryonError } from "./errors";
import type { TryonConfig } from "./config";
import type { GarmentRefType } from "../types";

const MpsClient = mps.v20190612.Client;

/** 换装模型：tryon-1.0-lite（2026-10-30 用户定档：lite 效果已够用，单价 1.00 元/张） */
const TRYON_MODEL = "tryon-1.0-lite";
/** 输出分辨率：1K（1K+flash 为当前选定配置，实测约 50 秒） */
const OUTPUT_RESOLUTION = "1K";
/** 面部保持约束：所有换装指令统一追加，抑制面部被重绘 */
const FACE_PRESERVE_CLAUSE =
  "严格保持[图片1]中人物的五官、脸型、肤色、发型完全不变，不要重新生成面部；保持姿态、背景、光照不变。";

/** 把 [图片N] 按顺序拼成「[图片2]、[图片3]」 */
function refList(indices: number[]): string {
  return indices.map((n) => `[图片${n}]`).join("、");
}

/**
 * 按单品类型生成换装 Prompt。
 * 参考图在 ImageSet 里从 [图片2] 起、identity 固定最后，所以编号与上传顺序一致。
 * - 衣服：替换服装
 * - 配饰：佩戴（只参考款式/颜色，不复制参考图里的人物、脸、手、背景）
 * - 鞋：替换鞋
 */
export function buildTryonPrompt(types: GarmentRefType[]): string {
  const indices: Record<GarmentRefType, number[]> = {
    garment: [],
    accessories: [],
    shoes: [],
  };
  types.forEach((t, i) => indices[t].push(i + 2));

  const parts: string[] = [];
  if (indices.garment.length > 0) {
    parts.push(
      `将[图片1]中模特的服装替换为${refList(indices.garment)}中的服装单品，保持款式/颜色/版型一致`
    );
  }
  if (indices.accessories.length > 0) {
    parts.push(
      `让模特佩戴${refList(indices.accessories)}中的配饰，只参考配饰的款式和颜色，不要复制参考图中的人物、脸、手、背景`
    );
  }
  if (indices.shoes.length > 0) {
    parts.push(
      `将[图片1]中模特的鞋替换为${refList(indices.shoes)}中的鞋，保持款式/颜色一致`
    );
  }

  const body = parts.length > 0 ? `${parts.join("；")}。` : "";
  return body + FACE_PRESERVE_CLAUSE;
}

/** 默认 Prompt（单件衣服），startTryonTask 未传 prompt 时使用 */
export const TRYON_PROMPT = buildTryonPrompt(["garment"]);

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
        // 参考图（官方上限 13 张）：服饰等在先，identity 固定追加在最后，
        // 保证 Prompt 里 [图片2] 起的编号仍对应服饰参考图。
        ImageSet: [
          ...input.refs.map((r) => ({
            Type: r.type,
            Image: { Type: "URL", UrlInputInfo: { Url: r.url } },
          })),
          // 身份参考图：用同一张人像锚定五官，抑制换装时面部被重绘
          {
            Type: "identity",
            Image: { Type: "URL", UrlInputInfo: { Url: input.personUrl } },
          },
        ],
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
      const rawUrl = res.ImageProcessTaskResultSet?.[0]?.Output?.SignedUrl;
      if (!rawUrl) throw new TryonError("task-failed", "任务完成但未返回效果图");
      // MPS 下发的签名链接是 http；COS 支持 https，统一升级，
      // 避免 https 页面出现混合内容、下载代理也统一按 https 取图
      return { imageUrl: rawUrl.replace(/^http:\/\//i, "https://") };
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
