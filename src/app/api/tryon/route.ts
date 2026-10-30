/**
 * POST /api/tryon：接收人像图 + 1~4 张单品图（data URL），调腾讯云 MPS AI 换装，返回效果图 URL。
 * 密钥只在本服务端代码中使用，绝不出现在前端。
 */
import { NextRequest, NextResponse } from "next/server";
import { runTryon } from "@/lib/tryon/run";
import { dataUrlToBuffer, type ImagePayload } from "@/lib/tryon/image";
import { buildTryonPrompt } from "@/lib/tryon/mps";
import { MAX_GARMENTS } from "@/lib/types";
import { consumeDailyQuota } from "@/lib/tryon/rate-limit";
import { httpStatus, TryonError, USER_MESSAGES } from "@/lib/tryon/errors";

// 长任务：MPS 换装要轮询几十秒（Vercel Pro 上限 300 秒）
export const maxDuration = 120;

/** 解码后单图上限 8MB（上传路径传原图不压缩，与前端选图 8MB 上限一致） */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. 每日次数上限（按 IP，10 次/天）
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const quota = consumeDailyQuota(ip);
  if (!quota.allowed) {
    return NextResponse.json({ error: USER_MESSAGES["rate-limit"] }, { status: 429 });
  }

  // 2. 解析请求体：人像 1 张，单品 1~4 张
  let body: { personImage?: unknown; garmentImages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }
  if (
    typeof body.personImage !== "string" ||
    !Array.isArray(body.garmentImages) ||
    body.garmentImages.length < 1 ||
    body.garmentImages.length > MAX_GARMENTS ||
    body.garmentImages.some((v) => typeof v !== "string")
  ) {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }

  const person = dataUrlToBuffer(body.personImage);
  const garments = (body.garmentImages as string[]).map(dataUrlToBuffer);
  if (!person || garments.some((g) => !g)) {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }
  const garmentPayloads = garments as ImagePayload[];
  if (
    person.buffer.length > MAX_IMAGE_BYTES ||
    garmentPayloads.some((g) => g.buffer.length > MAX_IMAGE_BYTES)
  ) {
    return NextResponse.json({ error: "图片太大，请换一张更小的图片" }, { status: 400 });
  }

  // 3. 执行换装（上传中转 → 发起任务 → 轮询 → 清理）
  try {
    const { imageUrl } = await runTryon(person, garmentPayloads, {
      prompt: buildTryonPrompt(garmentPayloads.length),
    });
    // 追踪用：每次测试出了哪张结果图，与上传的单品图一一对应
    console.log(`[tryon] 单品 ${garmentPayloads.length} 件，结果图: ${imageUrl}`);
    return NextResponse.json({ imageUrl });
  } catch (e) {
    if (e instanceof TryonError) {
      // 内部细节（MPS 原始错误）只记服务端日志，用户只看友好文案
      console.error(`tryon 失败 [${e.kind}]:`, e.message);
      return NextResponse.json(
        { error: USER_MESSAGES[e.kind] },
        { status: httpStatus(e.kind) }
      );
    }
    console.error("tryon 未预期错误:", e);
    return NextResponse.json({ error: USER_MESSAGES.internal }, { status: 500 });
  }
}
