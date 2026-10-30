/**
 * 后端联调脚本：用固定测试图（test-assets/person.png + garment.png）跑一遍完整换装管线。
 * 运行前：
 *   1. .env.local 已填好 TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_COS_BUCKET（地域默认广州）
 *   2. test-assets 目录下已有两张测试图（文档示例图，见 https://cloud.tencent.com/document/product/862/132594）
 * 运行：npx tsx --env-file=.env.local scripts/test-tryon.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runTryon } from "../src/lib/tryon/run";
import { TryonError } from "../src/lib/tryon/errors";

async function main() {
  const dir = join(process.cwd(), "test-assets");
  const person = readFileSync(join(dir, "person.png"));
  const garment = readFileSync(join(dir, "garment.png"));
  console.log(`测试图就绪：person ${(person.length / 1024).toFixed(0)}KB，garment ${(garment.length / 1024).toFixed(0)}KB`);

  const t0 = Date.now();
  console.log("1) 上传中转图 → 2) 发起 MPS 换装任务 → 3) 轮询结果 …");
  const { imageUrl } = await runTryon(
    { buffer: person, contentType: "image/png" },
    { buffer: garment, contentType: "image/png" }
  );
  console.log(`完成，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  console.log("效果图 URL（1 小时内有效）：");
  console.log(imageUrl);
}

main().catch((e) => {
  if (e instanceof TryonError) {
    console.error(`失败 [${e.kind}]:`, e.message);
  } else {
    console.error("失败:", e);
  }
  process.exit(1);
});
