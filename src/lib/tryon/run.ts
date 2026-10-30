/**
 * 试穿流水线（服务端专用）：
 * 上传中转（COS 签名 URL）→ 发起 MPS 换装任务 → 轮询结果 → 清理中转图。
 */
import { getTryonConfig } from "./config";
import { startTryonTask, waitForTryonTask, type TryonTaskOpts } from "./mps";
import { deleteImageTemp, toTryonError, uploadImageTemp } from "./cos";
import { TryonError } from "./errors";
import { dimsOf, type ImagePayload } from "./image";

export interface RunTryonResult {
  imageUrl: string;
}

export async function runTryon(
  person: ImagePayload,
  garment: ImagePayload,
  opts: TryonTaskOpts = {}
): Promise<RunTryonResult> {
  const cfg = getTryonConfig();
  if (!cfg) {
    throw new TryonError("config", "缺少腾讯云配置（TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_COS_BUCKET）");
  }

  // 中转图上传成功后必须清理（含失败路径）
  const keys: string[] = [];
  const cleanup = () =>
    Promise.allSettled(keys.map((k) => deleteImageTemp(cfg, k)));

  // 验证日志：实际传给 MPS 的图片像素尺寸（原图链路，后端不压缩）
  const pd = dimsOf(person.buffer);
  const gd = dimsOf(garment.buffer);
  const kb = (b: Buffer) => (b.length / 1024).toFixed(0);
  console.log(
    `[tryon] 传给 MPS：人像 ${pd ? `${pd.width}x${pd.height}` : "?"}（${person.contentType}，${kb(person.buffer)}KB），` +
      `衣服 ${gd ? `${gd.width}x${gd.height}` : "?"}（${garment.contentType}，${kb(garment.buffer)}KB）`
  );

  let personUrl: string;
  let garmentUrl: string;
  try {
    const p = await uploadImageTemp(cfg, person.buffer, person.contentType);
    keys.push(p.key);
    personUrl = p.url;
    const g = await uploadImageTemp(cfg, garment.buffer, garment.contentType);
    keys.push(g.key);
    garmentUrl = g.url;
  } catch (e) {
    await cleanup();
    throw toTryonError(e, "上传中转图");
  }

  try {
    const taskId = await startTryonTask(cfg, { personUrl, garmentUrl });
    return await waitForTryonTask(cfg, taskId, opts);
  } finally {
    await cleanup();
  }
}
