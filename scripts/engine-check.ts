// 合身判断引擎逻辑检查（开发期手动跑：npx tsx scripts/engine-check.ts）
import { canJudgeFit, judgeFit, lengthPositionHint } from "../src/lib/size-engine";
import { validateBody, validateGarment } from "../src/lib/validation";

let failed = 0;

function check(name: string, got: unknown, expect: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(expect);
  if (!pass) failed++;
  console.log(pass ? "PASS" : "FAIL", name, "→", JSON.stringify(got));
}

// 合身：放量 92-84=8cm，落在合身 6~10 区间
check("合身", judgeFit({ height: 165, bust: 84 }, { fit: "合身", bust: 92, length: 58 })?.verdict, "keep");

// 偏紧：放量 4cm < 6 → 建议看大一档
check("偏紧建议看大一档", judgeFit({ height: 165, bust: 84 }, { fit: "合身", bust: 88 })?.verdict, "up");

// 偏松：放量 20cm > 16 → 建议看小一档
check("偏松建议看小一档", judgeFit({ height: 160, bust: 100 }, { fit: "宽松", bust: 120 })?.verdict, "down");

// 缺身体胸围 → 不做合身判断
check("缺身体胸围不给判断", judgeFit({ height: 165 }, { fit: "合身", bust: 92 }), null);

// 缺成衣胸围 → 不做合身判断
check("缺成衣胸围不给判断", judgeFit({ height: 165, bust: 84 }, { fit: "合身", length: 58 }), null);

// canJudgeFit 最低要求：身高 + 身体胸围 + 成衣胸围
check("canJudgeFit 成立", canJudgeFit({ height: 165, bust: 84 }, { fit: "合身", bust: 92 }), true);
check("canJudgeFit 缺身高不成立", canJudgeFit({ bust: 84 }, { fit: "合身", bust: 92 }), false);

// 放量数值：92 - 84 = 8
check("放量数值", judgeFit({ height: 165, bust: 84 }, { fit: "合身", bust: 92 })?.bustEase, 8);

// 长度提示独立于合身判断：只要有身高 + 衣长
check("长度提示-常规", lengthPositionHint(58, 165), "常规长度：大致盖住臀部上沿");
check("长度提示-短款", lengthPositionHint(50, 165), "短款：大致在腰线附近");
check("长度提示-长款", lengthPositionHint(85, 165), "长款：大致到膝盖附近");

// 尺寸全部选填（PRD v1.4）：什么都不填不报错，仍可出图
check("尺寸全空不报错", validateBody({}).length, 0);
check("衣服尺寸全空不报错", validateGarment({}).length, 0);

// 腰围 20cm 明显不合理 → 拦下
check("腰围20cm被拦下", validateBody({ waist: 20 }).some((e) => e.field === "waist"), true);

// 腰围 > 胸围 → 提示检查
check("腰围大于胸围被拦下", validateBody({ bust: 80, waist: 90 }).some((e) => e.field === "waist"), true);

// 成衣胸围 300 → 拦下
check("成衣胸围300被拦下", validateGarment({ bust: 300 }).some((e) => e.field === "bust"), true);

// 肩宽 300 → 拦下
check("肩宽300被拦下", validateGarment({ shoulder: 300 }).some((e) => e.field === "shoulder"), true);

// 合理数据 → 无错误
check("合理数据无错误", validateBody({ height: 165, weight: 50, bust: 84, waist: 66, hip: 90 }).length === 0, true);
check("合理衣服数据无错误", validateGarment({ fit: "合身", length: 58, bust: 92, shoulder: 38 }).length === 0, true);

console.log(failed === 0 ? "全部通过" : `有 ${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
