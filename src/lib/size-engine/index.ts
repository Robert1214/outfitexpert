import type { FitAdvice, FitStyle, GarmentSize, PersonBody } from "@/lib/types";

/**
 * 合身判断规则引擎（护城河）。
 * 纯函数：同样的输入永远得出同样的输出，方便测试，前后端共用。
 * PRD v1.1：不输出具体尺码（S/M/L），只给「合身 / 偏紧 / 偏松」+ 放量 + 建议方向。
 */

/** 女装上装放量表（行业通用值，M2 前与需求方确认） */
export const EASE_TABLE: Record<FitStyle, { min: number; max: number }> = {
  紧身: { min: 4, max: 6 },
  合身: { min: 6, max: 10 },
  宽松: { min: 10, max: 16 },
};

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

/** 是否具备给出合身判断的最低数据：身高 + 身体胸围 + 成衣胸围（版型缺省按合身） */
export function canJudgeFit(body: PersonBody, garment: GarmentSize): boolean {
  return !!(body.height && body.bust && garment.bust);
}

/** 核心：合身判断（不含长度提示，长度提示由 lengthPositionHint 单独给） */
export function judgeFit(body: PersonBody, garment: GarmentSize): FitAdvice | null {
  if (!canJudgeFit(body, garment)) return null;

  const bodyBust = body.bust!;
  const garmentBust = garment.bust!;
  const fit: FitStyle = garment.fit ?? "合身";
  const band = EASE_TABLE[fit];

  // 放量 = 成衣胸围 - 身体胸围（衣服胸围 ≠ 身体胸围，不能等值比较）
  const ease = round1(garmentBust - bodyBust);
  let verdict: "keep" | "up" | "down" = "keep";
  if (ease < band.min) verdict = "up";
  else if (ease > band.max) verdict = "down";

  const state =
    verdict === "keep" ? "合适" : verdict === "up" ? "偏紧" : "偏松";

  return {
    verdict,
    bustEase: ease,
    fitBand: `${fit}版型 ${band.min}~${band.max}cm`,
    detail: `胸围放量约 ${ease}cm，对${fit}版型${state}（理想 ${band.min}~${band.max}cm）`,
  };
}
