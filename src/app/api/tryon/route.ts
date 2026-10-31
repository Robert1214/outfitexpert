/**
 * POST /api/tryon：接收人像图 + 1~4 张单品图（data URL），调腾讯云 MPS AI 换装，返回效果图 URL。
 * 密钥只在本服务端代码中使用，绝不出现在前端。
 */
import { NextRequest, NextResponse } from "next/server";
import { runTryon } from "@/lib/tryon/run";
import { dataUrlToBuffer, type ImagePayload } from "@/lib/tryon/image";
import { buildTryonPrompt } from "@/lib/tryon/mps";
import { GARMENT_REF_TYPES, MAX_GARMENTS, type GarmentRefType } from "@/lib/types";
import { httpStatus, TryonError, USER_MESSAGES } from "@/lib/tryon/errors";

// 长任务：MPS 换装要轮询几十秒（Vercel Pro 上限 300 秒）
export const maxDuration = 120;

/** 解码后单图上限 8MB（上传路径传原图不压缩，与前端选图 8MB 上限一致） */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. 解析请求体：人像 1 张，单品 1~4 张（可带每张的类型）
  let body: { personImage?: unknown; garmentImages?: unknown; garmentTypes?: unknown };
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

  // 单品类型：可选；缺省全部按衣服处理。传了就必须与图片数量一致且是合法枚举
  let garmentTypes: GarmentRefType[];
  if (body.garmentTypes === undefined) {
    garmentTypes = garmentPayloads.map(() => "garment");
  } else if (
    Array.isArray(body.garmentTypes) &&
    body.garmentTypes.length === garmentPayloads.length &&
    body.garmentTypes.every(
      (t) => typeof t === "string" && (GARMENT_REF_TYPES as readonly string[]).includes(t)
    )
  ) {
    garmentTypes = body.garmentTypes as GarmentRefType[];
  } else {
    return NextResponse.json({ error: USER_MESSAGES["bad-input"] }, { status: 400 });
  }

  // 2. 执行换装（上传中转 → 发起任务 → 轮询 → 清理）
  const refs = garmentPayloads.map((image, i) => ({ type: garmentTypes[i], image }));
  try {
    const { imageUrl } = await runTryon(person, refs, {
      prompt: buildTryonPrompt(garmentTypes),
    });
    // 追踪用：每次测试出了哪张结果图，与上传的单品图一一对应
    console.log(`[tryon] 单品 ${refs.length} 件（${garmentTypes.join("/")}），结果图: ${imageUrl}`);
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
