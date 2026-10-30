export type FitStyle = "紧身" | "合身" | "宽松";

/** 单次试穿最多接收的单品图数量（PRD v1.4） */
export const MAX_GARMENTS = 4;

/** 单品类型（与 MPS ImageSet 的 Type 对应；客户端可安全引用，勿从 mps.ts 导入） */
export const GARMENT_REF_TYPES = ["garment", "accessories", "shoes"] as const;
export type GarmentRefType = (typeof GARMENT_REF_TYPES)[number];

/** 单品类型中文名（前端下拉用） */
export const GARMENT_REF_TYPE_LABEL: Record<GarmentRefType, string> = {
  garment: "衣服",
  accessories: "配饰",
  shoes: "鞋",
};

/** 用户身体数据（全部选填，单位 cm / kg；PRD v1.4 起身高体重不再必填） */
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

/** 一次试穿的完整数据（图片压缩版存 localStorage，高清版走内存通道） */
export interface TryonPayload {
  personImage: string;
  /** 单品图，1~4 张，按上传顺序对应 [图片2]…[图片5] */
  garmentImages: string[];
  /** 每张单品图的类型，与 garmentImages 一一对应（旧缓存缺省 garment） */
  garmentTypes: GarmentRefType[];
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
