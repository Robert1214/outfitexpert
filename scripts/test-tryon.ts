/**
 * 后端联调脚本：用测试图跑一遍完整换装管线，打印输入/输出图像素尺寸并下载结果图。
 * 运行前：
 *   1. .env.local 已填好 TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_COS_BUCKET（地域默认广州）
 *   2. test-assets 目录下已有测试图（文档示例图，见 https://cloud.tencent.com/document/product/862/132594）
 * 运行：npx tsx --env-file=.env.local scripts/test-tryon.ts [人像图名] [衣服图名] [结果图保存名]
 *   默认：person.png garment.png result.jpg
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTryon } from "../src/lib/tryon/run";
import { TryonError } from "../src/lib/tryon/errors";

/** 读 PNG/JPEG 文件头的像素尺寸（PNG IHDR / JPEG SOF），失败返回 null */
function dimsOf(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      // PNG：宽高在 IHDR（16~23 字节）
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG：扫段标记找 SOF0~SOF15（排除 DHT/C0C4、JPG/C0C8、DAC/C0CC）
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const dir = join(process.cwd(), "test-assets");
  const personName = process.argv[2] ?? "person.png";
  const garmentName = process.argv[3] ?? "garment.png";
  const outName = process.argv[4] ?? null;
  const person = readFileSync(join(dir, personName));
  const garment = readFileSync(join(dir, garmentName));
  const pd = dimsOf(person);
  const gd = dimsOf(garment);
  console.log(
    `测试图就绪：person ${personName} ${pd ? `${pd.width}x${pd.height}` : "?"}，` +
      `garment ${garmentName} ${gd ? `${gd.width}x${gd.height}` : "?"}`
  );

  const t0 = Date.now();
  console.log("1) 上传中转图 → 2) 发起 MPS 换装任务 → 3) 轮询结果 …");
  const { imageUrl } = await runTryon(
    { buffer: person, contentType: personName.endsWith(".png") ? "image/png" : "image/jpeg" },
    { buffer: garment, contentType: garmentName.endsWith(".png") ? "image/png" : "image/jpeg" }
  );
  console.log(`完成，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  console.log("效果图 URL（1 小时内有效）：");
  console.log(imageUrl);

  // 下载结果图，报告像素尺寸
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`下载结果图失败：HTTP ${res.status}`);
  const outBuf = Buffer.from(await res.arrayBuffer());
  const rd = dimsOf(outBuf);
  if (outName) {
    const outPath = join(dir, outName);
    writeFileSync(outPath, outBuf);
    console.log(`结果图已保存：${outPath}（${outBuf.length / 1024}KB，${rd ? `${rd.width}x${rd.height}` : "?"}）`);
  } else {
    console.log(`结果图像素：${rd ? `${rd.width}x${rd.height}` : "?"}（${(outBuf.length / 1024).toFixed(0)}KB）`);
  }
}

main().catch((e) => {
  if (e instanceof TryonError) {
    console.error(`失败 [${e.kind}]:`, e.message);
  } else {
    console.error("失败:", e);
  }
  process.exit(1);
});
