/**
 * buildTryonPrompt 最小断言（不调用 MPS、不产生费用）。
 * 运行：npx tsx scripts/prompt-check.ts
 */
import assert from "node:assert/strict";
import { buildTryonPrompt } from "../src/lib/tryon/mps";
import type { GarmentRefType } from "../src/lib/types";

const FACE_CLAUSE =
  "严格保持[图片1]中人物的五官、脸型、肤色、发型完全不变，不要重新生成面部；保持姿态、背景、光照不变。";

const FULL_REPLACE =
  "每件都要完整替换所有部位（如肩部、袖子、袖口、领口、门襟、下摆等），不要保留原服装的任何部分，不要把两件衣服拼接在一起";

function check(
  name: string,
  types: GarmentRefType[],
  must: string[],
  mustNot: string[] = []
): string {
  const prompt = buildTryonPrompt(types);
  for (const s of must) {
    assert.ok(prompt.includes(s), `${name}：缺少「${s}」\n实际 Prompt：${prompt}`);
  }
  for (const s of mustNot) {
    assert.ok(!prompt.includes(s), `${name}：不应包含「${s}」\n实际 Prompt：${prompt}`);
  }
  assert.ok(prompt.endsWith(FACE_CLAUSE), `${name}：缺少面部保持约束\n实际 Prompt：${prompt}`);
  console.log(`✅ ${name}`);
  return prompt;
}

// 1 衣服：[图片2] 是衣服
check(
  "1 衣服",
  ["garment"],
  ["将[图片1]中模特的服装替换为[图片2]中的服装单品", FULL_REPLACE],
  ["佩戴", "鞋替换"]
);

// 1 配饰（眼镜）：必须用「佩戴」，且不能复制参考图里的人脸/手/背景
check(
  "1 配饰（眼镜）",
  ["accessories"],
  [
    "让模特佩戴[图片2]中的配饰",
    "只参考配饰的款式和颜色",
    "不要复制参考图中的人物、脸、手、背景",
  ],
  ["替换为"]
);

// 1 鞋
check("1 鞋", ["shoes"], ["将[图片1]中模特的鞋替换为[图片2]中的鞋"], ["佩戴"]);

// 3 衣服 + 1 眼镜：编号必须是 [图片2][图片3][图片4] 衣服、[图片5] 配饰
const mixed = check(
  "3 衣服 + 1 眼镜",
  ["garment", "garment", "garment", "accessories"],
  [
    "[图片2]、[图片3]、[图片4]中的服装单品",
    FULL_REPLACE,
    "让模特佩戴[图片5]中的配饰",
    "不要复制参考图中的人物、脸、手、背景",
  ]
);
assert.ok(
  mixed.indexOf("服装单品") < mixed.indexOf("佩戴"),
  "3 衣服 + 1 眼镜：衣服指令应排在配饰指令之前"
);

// 4 衣服：编号连续到 [图片5]，且不出现配饰措辞
check(
  "4 衣服",
  ["garment", "garment", "garment", "garment"],
  ["[图片2]、[图片3]、[图片4]、[图片5]中的服装单品", FULL_REPLACE],
  ["佩戴", "鞋替换"]
);

// 配饰与鞋混排：各自编号按上传顺序
check(
  "2 配饰 + 2 鞋",
  ["accessories", "shoes", "accessories", "shoes"],
  [
    "让模特佩戴[图片2]、[图片4]中的配饰",
    "将[图片1]中模特的鞋替换为[图片3]、[图片5]中的鞋",
  ]
);

console.log("全部断言通过");
