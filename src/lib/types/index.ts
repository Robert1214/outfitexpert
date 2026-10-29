export type FitStyle = "紧身" | "合身" | "宽松";

/** 用户身体数据（身高体重必填由表单层保证；其余选填，单位 cm / kg） */
export interface PersonBody {
  height?: number;
  weight?: number;
  bust?: number;
  waist?: number;
  hip?: number;
}

/** 衣服成衣数据（全部选填） */
export interface GarmentSize {
  fit?: FitStyle; // 版型，默认合身
  length?: number; // 衣长 cm
  bust?: number; // 成衣胸围 cm
  shoulder?: number; // 肩宽 cm
}

/** 一次试穿的完整数据（M1 存 localStorage，不接后端） */
export interface TryonPayload {
  personImage: string;
  garmentImage: string;
  body: PersonBody;
  garment: GarmentSize;
}

/** 合身判断结果（不输出具体尺码，只给方向和放量） */
export interface FitAdvice {
  verdict: "keep" | "up" | "down"; // 合身 / 偏紧(建议看大一档) / 偏松(建议看小一档)
  bustEase: number; // 胸围放量 cm
  fitBand: string; // 版型理想放量区间描述
  detail: string; // 放量说明
}
