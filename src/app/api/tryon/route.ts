/**
 * POST /api/tryon：接收人像图 + 衣服图（data URL），调腾讯云 MPS AI 换装，返回效果图 URL。
 * 密钥只在本服务端代码中使用，绝不出现在前端。
 */
import { NextRequest, NextResponse } from "next/server";
import { runTryon } from "@/lib/tryon/run";
import { dataUrlToBuffer } from "@/lib/tryon/image";
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

  // 2. 解析请求体
  let body: { personImage?: unknown; garmentImage?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }
  if (typeof body.personImage !== "string" || typeof body.garmentImage !== "string") {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }
  const person = dataUrlToBuffer(body.personImage);
  const garment = dataUrlToBuffer(body.garmentImage);
  if (!person || !garment) {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }
  if (person.buffer.length > MAX_IMAGE_BYTES || garment.buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "图片太大，请换一张更小的图片" }, { status: 400 });
  }

  // 3. 执行换装（上传中转 → 发起任务 → 轮询 → 清理）
  try {
    const { imageUrl } = await runTryon(person, garment);
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
