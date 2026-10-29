import type { FitStyle, GarmentSize, PersonBody, SizeAdvice } from "@/lib/types";

/**
 * 尺码规则引擎（护城河）。
 * 纯函数：同样的输入永远得出同样的输出，方便测试，前后端共用。
 */

/** 女装上装放量表（行业通用值，M2 前与需求方确认） */
export const EASE_TABLE: Record<FitStyle, { min: number; max: number }> = {
  紧身: { min: 4, max: 6 },
  合体: { min: 6, max: 10 },
  宽松: { min: 10, max: 16 },
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 衣长相对身高的位置提示（仅大致位置，不承诺精确） */
export function lengthPositionHint(garmentLength: number, height: number): string {
  const ratio = garmentLength / height;
  if (ratio < 0.33) return "短款：大致在腰线附近";
  if (ratio < 0.42) return "常规长度：大致盖住臀部上沿";
  if (ratio < 0.5) return "中长款：大致到大腿中部";
  return "长款：大致到膝盖附近";
}

/** 是否具备给出尺码建议的最低数据：身高 + 身体胸围 + 成衣胸围 + 尺码标签 */
export function canAdvise(body: PersonBody, garment: GarmentSize): boolean {
  return !!(body.height && body.bust && garment.bust && garment.size);
}

/** 核心：尺码建议 */
export function advise(body: PersonBody, garment: GarmentSize): SizeAdvice | null {
  if (!canAdvise(body, garment)) return null;

  const height = body.height!;
  const bodyBust = body.bust!;
  const garmentBust = garment.bust!;
  const enteredSize = garment.size!;
  const fit: FitStyle = garment.fit ?? "合体";
  const band = EASE_TABLE[fit];

  // 放量 = 成衣胸围 - 身体胸围（衣服胸围 ≠ 身体胸围，不能等值比较）
  const ease = round1(garmentBust - bodyBust);
  let verdict: "keep" | "up" | "down" = "keep";
  if (ease < band.min) verdict = "up";
  else if (ease > band.max) verdict = "down";

  // 按尺码顺序调整一档
  const idx = SIZE_ORDER.indexOf(enteredSize.toUpperCase());
  let recommendedSize = enteredSize.toUpperCase();
  if (verdict === "up" && idx >= 0 && idx < SIZE_ORDER.length - 1) {
    recommendedSize = SIZE_ORDER[idx + 1];
  } else if (verdict === "down" && idx > 0) {
    recommendedSize = SIZE_ORDER[idx - 1];
  }

  const tips: string[] = [];
  if (verdict === "up") {
    tips.push(
      `胸围放量约 ${ease}cm，对${fit}版型偏紧（理想 ${band.min}~${band.max}cm），建议选 ${recommendedSize} 码`
    );
  } else if (verdict === "down") {
    tips.push(
      `胸围放量约 ${ease}cm，对${fit}版型偏松（理想 ${band.min}~${band.max}cm），建议选 ${recommendedSize} 码`
    );
  } else {
    tips.push(
      `胸围放量约 ${ease}cm，落在${fit}版型理想区间（${band.min}~${band.max}cm）内，${recommendedSize} 码合身`
    );
  }
  tips.push("以上按你填写的成衣尺寸估算，最终以实物试穿为准");

  return {
    size: recommendedSize,
    verdict,
    bustEase: ease,
    fitBand: `${fit}版型 ${band.min}~${band.max}cm`,
    lengthHint: garment.length ? lengthPositionHint(garment.length, height) : null,
    tips,
  };
}
