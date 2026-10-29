import type { GarmentSize, PersonBody } from "@/lib/types";

export interface FieldError {
  field: string;
  message: string;
}

/** 身高、体重必填（PRD v1.1）：未填时返回红字提示，禁止进入下一步 */
export function validateRequiredBody(raw: Record<string, string>): FieldError[] {
  const errors: FieldError[] = [];
  if (!raw.height.trim()) errors.push({ field: "height", message: "请填写身高" });
  if (!raw.weight.trim()) errors.push({ field: "weight", message: "请填写体重" });
  return errors;
}

/** 身体数据校验：明显不合理的数值拦下（如腰围 20cm） */
export function validateBody(b: PersonBody): FieldError[] {
  const errors: FieldError[] = [];

  const check = (key: keyof PersonBody, label: string, min: number, max: number) => {
    const v = b[key];
    if (v == null || Number.isNaN(v)) return;
    if (v < min || v > max) {
      errors.push({
        field: key,
        message: `${label}看起来不合理（正常范围 ${min}~${max}），请检查后重填`,
      });
    }
  };

  check("height", "身高", 130, 210);
  check("weight", "体重", 30, 200);
  check("bust", "胸围", 60, 160);
  check("waist", "腰围", 40, 140);
  check("hip", "臀围", 60, 160);

  if (b.bust != null && b.waist != null && b.waist > b.bust) {
    errors.push({ field: "waist", message: "腰围比胸围还大，是不是填反了？请检查" });
  }
  if (b.waist != null && b.hip != null && b.hip < b.waist) {
    errors.push({ field: "hip", message: "臀围比腰围还小，是不是填反了？请检查" });
  }

  return errors;
}

/** 衣服成衣尺寸校验 */
export function validateGarment(g: GarmentSize): FieldError[] {
  const errors: FieldError[] = [];

  const check = (key: "length" | "bust" | "shoulder", label: string, min: number, max: number) => {
    const v = g[key];
    if (v == null || Number.isNaN(v)) return;
    if (v < min || v > max) {
      errors.push({
        field: key,
        message: `${label}看起来不合理（正常范围 ${min}~${max}），请检查`,
      });
    }
  };

  check("length", "衣长", 30, 160);
  check("bust", "成衣胸围", 60, 220);
  check("shoulder", "肩宽", 20, 60);

  return errors;
}

/** 图片文件校验（格式 / 大小） */
export function validatePhotoFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "只支持 JPG / PNG / WebP 格式";
  }
  if (file.size > 8 * 1024 * 1024) {
    return "图片超过 8MB，请压缩后再传";
  }
  return null;
}

/** 全身照应是竖构图（M1 简易判断，M2 换成视觉模型） */
export function isPortraitRatio(width: number, height: number): boolean {
  return height / width >= 1.15;
}
