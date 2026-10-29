// 尺码引擎逻辑检查（开发期手动跑：npx tsx scripts/engine-check.ts）
import { advise, canAdvise } from "../src/lib/size-engine";
import { validateBody, validateGarment } from "../src/lib/validation";

let failed = 0;

function check(name: string, got: unknown, expect: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(expect);
  if (!pass) failed++;
  console.log(pass ? "PASS" : "FAIL", name, "→", JSON.stringify(got));
}

// 合身：放量 92-84=8cm，落在合体 6~10 区间 → 保持 M
check("合身", advise({ height: 165, bust: 84 }, { size: "M", fit: "合体", bust: 92, length: 58 })?.verdict + "/" + advise({ height: 165, bust: 84 }, { size: "M", fit: "合体", bust: 92, length: 58 })?.size, "keep/M");

// 偏紧：放量 4cm < 6 → 建议大一码 L
check("偏紧建议大一码", (() => { const a = advise({ height: 165, bust: 84 }, { size: "M", fit: "合体", bust: 88 }); return a ? a.verdict + "/" + a.size : null; })(), "up/L");

// 偏松：放量 20cm > 16 → 建议小一码 M
check("偏松建议小一码", (() => { const a = advise({ height: 160, bust: 100 }, { size: "L", fit: "宽松", bust: 120 }); return a ? a.verdict + "/" + a.size : null; })(), "down/M");

// 数据不足 → 不给建议
check("数据不足不给建议", advise({ height: 165 }, { size: "M", bust: 92 }), null);

// canAdvise 最低要求
check("canAdvise 成立", canAdvise({ height: 165, bust: 84 }, { size: "M", bust: 92 }), true);

// 腰围 20cm 明显不合理 → 拦下
check("腰围20cm被拦下", validateBody({ waist: 20 }).some((e) => e.field === "waist"), true);

// 腰围 > 胸围 → 提示检查
check("腰围大于胸围被拦下", validateBody({ bust: 80, waist: 90 }).some((e) => e.field === "waist"), true);

// 成衣胸围 300 → 拦下
check("成衣胸围300被拦下", validateGarment({ bust: 300 }).some((e) => e.field === "bust"), true);

// 合理数据 → 无错误
check("合理数据无错误", validateBody({ height: 165, weight: 50, bust: 84, waist: 66, hip: 90 }).length === 0, true);

console.log(failed === 0 ? "全部通过" : `有 ${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
