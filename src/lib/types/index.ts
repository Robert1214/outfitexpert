export type FitStyle = "紧身" | "合体" | "宽松";

/** 用户身体数据（全部选填，单位 cm / kg） */
export interface PersonBody {
  height?: number;
  weight?: number;
  bust?: number;
  waist?: number;
  hip?: number;
}

/** 衣服成衣数据（全部选填） */
export interface GarmentSize {
  size?: string; // S/M/L/XL/XXL
  fit?: FitStyle; // 版型，默认合体
  length?: number; // 衣长 cm
  bust?: number; // 成衣胸围 cm
}

/** 一次试穿的完整数据（M1 存 localStorage，不接后端） */
export interface TryonPayload {
  personImage: string;
  garmentImage: string;
  body: PersonBody;
  garment: GarmentSize;
}

/** 尺码建议结果 */
export interface SizeAdvice {
  size: string; // 建议码
  verdict: "keep" | "up" | "down"; // 合身 / 建议大一码 / 建议小一码
  bustEase: number; // 胸围放量 cm
  fitBand: string; // 版型理想放量区间描述
  lengthHint: string | null; // 衣长位置提示
  tips: string[]; // 合身提示
}
