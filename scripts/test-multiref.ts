/**
 * 多参考图能力边界测试（研究用，每次调用消耗 MPS 计费额度：flash 1K 约 2.12 元/张）。
 * 需要 test-assets 下准备以下图片（png / jpg / webp 均可）：
 *   top.*        只有上衣的服饰图
 *   pants.*      只有裤子的服饰图
 *   accessory.*  配饰图（帽子或包）
 *   set.*        上衣 + 裤子的套装图
 * 运行：npx tsx --env-file=.env.local scripts/test-multiref.ts [1|2|3|all] [人像图]
 *   默认：全部场景、人像 new.jpg。结果图保存为 test-assets/multi-<场景号>.jpg
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { runTryon, type TryonRefInput } from "../src/lib/tryon/run";
import { TryonError } from "../src/lib/tryon/errors";
import { dimsOf, type ImagePayload } from "../src/lib/tryon/image";

const DIR = join(process.cwd(), "test-assets");

function contentTypeOf(p: string): string {
  const ext = extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function load(base: string): ImagePayload | null {
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const p = join(DIR, base + ext);
    if (existsSync(p)) return { buffer: readFileSync(p), contentType: contentTypeOf(p) };
  }
  return null;
}

interface Scenario {
  id: number;
  name: string;
  need: string[];
  build: (f: Record<string, ImagePayload>) => TryonRefInput[];
  prompt: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "两张独立图同时换：上衣 + 裤子（两条 Type=garment）",
    need: ["top", "pants"],
    build: (f) => [
      { type: "garment", image: f.top },
      { type: "garment", image: f.pants },
    ],
    prompt:
      "将[图片1]中模特的服装替换为[图片2]中的上衣和[图片3]中的裤子，保持人物形象与姿态自然",
  },
  {
    id: 2,
    name: "上衣 + 配饰（garment + accessories）",
    need: ["top", "accessory"],
    build: (f) => [
      { type: "garment", image: f.top },
      { type: "accessories", image: f.accessory },
    ],
    prompt:
      "将[图片1]中模特的服装替换为[图片2]中的上衣，并让模特佩戴[图片3]中的配饰，保持人物形象与姿态自然",
  },
  {
    id: 3,
    name: "套装图只换上衣（单条 garment + 局部换装 Prompt）",
    need: ["set"],
    build: (f) => [{ type: "garment", image: f.set }],
    prompt:
      "只将[图片1]中模特的上衣替换为[图片2]套装图中的上衣，保留[图片1]中模特原有的裤子不变，保持人物形象与姿态自然",
  },
];

async function main() {
  const selector = process.argv[2] ?? "all";
  const personName = process.argv[3] ?? "new.jpg";
  const personPath = join(DIR, personName);
  if (!existsSync(personPath)) {
    console.error(`缺少人像图：${personPath}`);
    process.exit(1);
  }
  const person: ImagePayload = {
    buffer: readFileSync(personPath),
    contentType: contentTypeOf(personPath),
  };
  const pd = dimsOf(person.buffer);
  console.log(`人像：${personName}${pd ? `（${pd.width}x${pd.height}）` : ""}`);

  const files: Record<string, ImagePayload> = {};
  for (const key of ["top", "pants", "accessory", "set"]) {
    const img = load(key);
    if (img) files[key] = img;
  }

  const scenarios =
    selector === "all" ? SCENARIOS : SCENARIOS.filter((s) => String(s.id) === selector);
  if (scenarios.length === 0) {
    console.error(`未知场景：${selector}（可选 1 / 2 / 3 / all）`);
    process.exit(1);
  }

  for (const s of scenarios) {
    console.log(`\n=== 场景 ${s.id}：${s.name} ===`);
    const missing = s.need.filter((k) => !files[k]);
    if (missing.length > 0) {
      console.log(`⏭ 跳过：缺少 test-assets/${missing.join(".*、")}.*`);
      continue;
    }
    console.log(`Prompt：${s.prompt}`);
    const t0 = Date.now();
    try {
      const { imageUrl } = await runTryon(person, s.build(files), {
        prompt: s.prompt,
        timeoutMs: 180_000,
      });
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`下载结果图失败：HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const out = join(DIR, `multi-${s.id}.jpg`);
      writeFileSync(out, buf);
      const d = dimsOf(buf);
      console.log(`✅ 成功：${secs} 秒，结果 ${d ? `${d.width}x${d.height}` : "?"}，已保存 ${out}`);
      console.log(`URL：${imageUrl}`);
    } catch (e) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (e instanceof TryonError) {
        console.error(`❌ 失败（${e.kind}）：${secs} 秒，报错原文：${e.message}`);
      } else {
        console.error(`❌ 未预期错误：${secs} 秒`, e);
      }
    }
  }
}

main().catch((e) => {
  console.error("脚本异常:", e);
  process.exit(1);
});
