/**
 * 试穿流水线（服务端专用）：
 * 上传中转（COS 签名 URL）→ 发起 MPS 换装任务 → 轮询结果 → 清理中转图。
 */
import { getTryonConfig } from "./config";
import {
  startTryonTask,
  waitForTryonTask,
  type RefImageType,
  type RefImageUrl,
  type TryonTaskOpts,
} from "./mps";
import { deleteImageTemp, toTryonError, uploadImageTemp } from "./cos";
import { TryonError } from "./errors";
import { dimsOf, type ImagePayload } from "./image";

export interface RunTryonResult {
  imageUrl: string;
}

/** 参考图：单张 ImagePayload（默认 garment）或带类型的对象 */
export type TryonRefInput = ImagePayload | { type: RefImageType; image: ImagePayload };

export interface RunTryonOptions extends TryonTaskOpts {
  /** 自定义换装指令（不传用默认） */
  prompt?: string;
}

/** ImageSet 官方上限 */
const MAX_REFS = 13;

export async function runTryon(
  person: ImagePayload,
  refs: TryonRefInput | TryonRefInput[],
  opts: RunTryonOptions = {}
): Promise<RunTryonResult> {
  const cfg = getTryonConfig();
  if (!cfg) {
    throw new TryonError("config", "缺少腾讯云配置（TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_COS_BUCKET）");
  }

  const normalized = (Array.isArray(refs) ? refs : [refs]).map(
    (r): { type: RefImageType; image: ImagePayload } =>
      "buffer" in r ? { type: "garment", image: r } : r
  );
  if (normalized.length === 0) throw new TryonError("bad-input", "缺少参考图");
  if (normalized.length > MAX_REFS) {
    throw new TryonError("bad-input", `参考图最多 ${MAX_REFS} 张`);
  }

  // 中转图上传成功后必须清理（含失败路径）
  const keys: string[] = [];
  const cleanup = () =>
    Promise.allSettled(keys.map((k) => deleteImageTemp(cfg, k)));

  // 验证日志：实际传给 MPS 的图片像素尺寸（原图链路，后端不压缩）
  const describe = (p: ImagePayload) => {
    const d = dimsOf(p.buffer);
    return `${d ? `${d.width}x${d.height}` : "?"}（${p.contentType}，${(p.buffer.length / 1024).toFixed(0)}KB）`;
  };
  console.log(
    `[tryon] 传给 MPS：人像 ${describe(person)}，` +
      normalized.map((r, i) => `参考图${i + 1}[${r.type}] ${describe(r.image)}`).join("，")
  );

  let personUrl: string;
  const refUrls: RefImageUrl[] = [];
  try {
    const p = await uploadImageTemp(cfg, person.buffer, person.contentType);
    keys.push(p.key);
    personUrl = p.url;
    for (const ref of normalized) {
      const u = await uploadImageTemp(cfg, ref.image.buffer, ref.image.contentType);
      keys.push(u.key);
      refUrls.push({ type: ref.type, url: u.url });
    }
  } catch (e) {
    await cleanup();
    throw toTryonError(e, "上传中转图");
  }

  const { prompt, ...taskOpts } = opts;
  try {
    const taskId = await startTryonTask(cfg, { personUrl, refs: refUrls, prompt });
    return await waitForTryonTask(cfg, taskId, taskOpts);
  } finally {
    await cleanup();
  }
}
