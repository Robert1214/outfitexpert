"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Syne } from "next/font/google";
import Field from "@/components/Field";
import GarmentSlot from "@/components/GarmentSlot";
import HintTip from "@/components/HintTip";
import SectionCard from "@/components/SectionCard";
import UploadBox from "@/components/UploadBox";
import { setPendingTryon } from "@/lib/pending-tryon";
import { clearInflight, clearResultCache } from "@/lib/result-cache";
import { fileToRawDataUrl, savePayload } from "@/lib/storage";
import {
  MAX_GARMENTS,
  type FitStyle,
  type GarmentRefType,
  type GarmentSize,
  type PersonBody,
  type TryonPayload,
} from "@/lib/types";
import { validateBody, validateGarment, type FieldError } from "@/lib/validation";

/** 品牌字标：Syne 800，比系统无衬线更有设计感（构建时自托管，运行时不依赖外网） */
const brandFont = Syne({ subsets: ["latin"], weight: "800", display: "swap" });

const emptyImages = () => Array<string | null>(MAX_GARMENTS).fill(null);
const emptyFiles = () => Array<File | null>(MAX_GARMENTS).fill(null);
const emptyTypes = () => Array<GarmentRefType>(MAX_GARMENTS).fill("garment");

export default function HomePage() {
  const router = useRouter();
  const [personImage, setPersonImage] = useState<string | null>(null);
  // 原始文件：提交时原图直传后端（不压缩），localStorage 仍存压缩版
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentImages, setGarmentImages] = useState<(string | null)[]>(emptyImages);
  const [garmentFiles, setGarmentFiles] = useState<(File | null)[]>(emptyFiles);
  // 每格单品类型，与图片按索引同步（默认衣服）
  const [garmentTypes, setGarmentTypes] = useState<GarmentRefType[]>(emptyTypes);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState<Record<string, string>>({
    height: "",
    weight: "",
    bust: "",
    waist: "",
    hip: "",
  });
  const [garment, setGarment] = useState<Record<string, string>>({
    fit: "合身",
    length: "",
    bust: "",
    shoulder: "",
  });
  const [bodyErrors, setBodyErrors] = useState<FieldError[]>([]);
  const [garmentErrors, setGarmentErrors] = useState<FieldError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setBodyField = (key: string) => (v: string) => setBody((s) => ({ ...s, [key]: v }));
  const setGarmentField = (key: string) => (v: string) =>
    setGarment((s) => ({ ...s, [key]: v }));

  const setGarmentAt = (index: number) => (v: string | null) =>
    setGarmentImages((prev) => prev.map((item, i) => (i === index ? v : item)));
  const setGarmentFileAt = (index: number) => (f: File | null) =>
    setGarmentFiles((prev) => prev.map((item, i) => (i === index ? f : item)));
  const setGarmentTypeAt = (index: number) => (t: GarmentRefType) =>
    setGarmentTypes((prev) => prev.map((item, i) => (i === index ? t : item)));

  const toNum = (v: string): number | undefined => {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const errorFor = (errors: FieldError[], field: string) =>
    errors.find((e) => e.field === field)?.message;

  const filledGarments = garmentImages.filter((v): v is string => v !== null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (submitting) return;
    if (!personImage) {
      setSubmitError("请先上传你的模特图");
      return;
    }
    const picked = garmentImages
      .map((img, i) => ({
        img,
        file: garmentFiles[i] ?? null,
        type: garmentTypes[i] ?? "garment",
      }))
      .filter((x): x is { img: string; file: File | null; type: GarmentRefType } => x.img !== null);
    if (picked.length === 0) {
      setSubmitError("请至少上传 1 张单品图");
      return;
    }

    // 身材 / 衣服尺寸全部选填（PRD v1.4）；填了才做范围校验
    const bodyData: PersonBody = {
      height: toNum(body.height),
      weight: toNum(body.weight),
      bust: toNum(body.bust),
      waist: toNum(body.waist),
      hip: toNum(body.hip),
    };
    const garmentData: GarmentSize = {
      fit: garment.fit as FitStyle,
      length: toNum(garment.length),
      bust: toNum(garment.bust),
      shoulder: toNum(garment.shoulder),
    };

    const be = validateBody(bodyData);
    const ge = validateGarment(garmentData);
    setBodyErrors(be);
    setGarmentErrors(ge);
    if (be.length > 0 || ge.length > 0) {
      setSubmitError("有数据看起来不对，请按提示修改后再试");
      return;
    }

    const payload: TryonPayload = {
      personImage,
      garmentImages: picked.map((x) => x.img),
      garmentTypes: picked.map((x) => x.type),
      body: bodyData,
      garment: garmentData,
    };

    // 上传后端传原图（不压缩不重编码），只走内存；localStorage 仍存压缩版
    setSubmitting(true);
    try {
      const images = await Promise.all([
        personFile ? fileToRawDataUrl(personFile) : Promise.resolve(personImage),
        ...picked.map((x) => (x.file ? fileToRawDataUrl(x.file) : Promise.resolve(x.img))),
      ]);
      // 新提交：旧结果缓存与未完成标记都失效
      clearResultCache();
      clearInflight();
      setPendingTryon({
        personImage: images[0],
        garmentImages: images.slice(1),
        garmentTypes: picked.map((x) => x.type),
      });
      savePayload(payload);
      router.push("/result");
    } catch {
      setSubmitError("图片处理失败，请重新上传后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-4 pt-6 lg:pt-10">
      <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between lg:pb-8">
        <div>
          <p
            className={`${brandFont.className} text-3xl font-extrabold uppercase leading-none tracking-[0.12em] text-accent lg:text-4xl`}
          >
            Outfit Expert
          </p>
          <p className="mt-2 text-sm text-muted lg:text-base">下单前，先看看自己穿上的美貌</p>
        </div>
        <div className="flex flex-col gap-1 text-xs leading-5 text-muted lg:items-end lg:text-right">
          <p>人像 + 最多 4 件单品，约 60 秒出效果图</p>
          <p>尺寸全部选填：不填也能出图，填了才判断合身</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-stretch lg:gap-6">
          {/* 左：模特图 + 单品图 */}
          <div className="flex flex-col gap-4 lg:gap-6">
            <SectionCard title="模特图" badge="1 张">
              <UploadBox
                value={personImage}
                onChange={setPersonImage}
                onFile={setPersonFile}
              />
            </SectionCard>

            <SectionCard
              title="单品图"
              badge="最多 4 件"
              action={<HintTip text="如果是帽子、眼镜、项链等配饰，则半身效果会更好哦！" />}
              className="flex flex-1 flex-col"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {garmentImages.map((value, index) => (
                  <GarmentSlot
                    key={index}
                    index={index}
                    value={value}
                    type={garmentTypes[index]}
                    onChange={setGarmentAt(index)}
                    onTypeChange={setGarmentTypeAt(index)}
                    onFile={setGarmentFileAt(index)}
                  />
                ))}
              </div>
              <p className="mt-auto pt-3 text-[11px] leading-5 text-muted">
                已选 {filledGarments.length}/{MAX_GARMENTS} 件 · 可分别上传上衣、裤子、鞋子或配饰，模型会按单品组合换装
              </p>
            </SectionCard>
          </div>

          {/* 右：身材数据 + 衣服尺寸（桌面横向并排，高度与左栏对齐） */}
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            <SectionCard title="身材数据" badge="选填" className="flex h-full flex-col">
              <div className="flex flex-1 flex-col justify-between gap-4">
                <Field
                  label="身高"
                  unit="cm"
                  value={body.height}
                  onChange={setBodyField("height")}
                  placeholder="如 165"
                  error={errorFor(bodyErrors, "height")}
                />
                <Field
                  label="体重"
                  unit="kg"
                  value={body.weight}
                  onChange={setBodyField("weight")}
                  placeholder="如 50"
                  error={errorFor(bodyErrors, "weight")}
                />
                <Field
                  label="胸围"
                  unit="cm"
                  value={body.bust}
                  onChange={setBodyField("bust")}
                  placeholder="如 84"
                  error={errorFor(bodyErrors, "bust")}
                />
                <Field
                  label="腰围"
                  unit="cm"
                  value={body.waist}
                  onChange={setBodyField("waist")}
                  placeholder="如 66"
                  error={errorFor(bodyErrors, "waist")}
                />
                <Field
                  label="臀围"
                  unit="cm"
                  value={body.hip}
                  onChange={setBodyField("hip")}
                  placeholder="如 90"
                  error={errorFor(bodyErrors, "hip")}
                />
              </div>
              <p className="pt-5 text-[11px] leading-5 text-muted">
                尺寸不填也能出图；填身高 + 胸围，才会给出合身判断。三围仅用于本次计算，用完即删。
              </p>
            </SectionCard>

            <SectionCard title="衣服尺寸" badge="选填" className="flex h-full flex-col">
              <div className="flex flex-1 flex-col justify-between gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">版型</label>
                  <select
                    value={garment.fit}
                    onChange={(e) => setGarmentField("fit")(e.target.value)}
                    className="w-full rounded-xl border border-line bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/10"
                  >
                    <option value="合身">合身</option>
                    <option value="紧身">紧身</option>
                    <option value="宽松">宽松</option>
                  </select>
                </div>
                <Field
                  label="衣长"
                  unit="cm"
                  value={garment.length}
                  onChange={setGarmentField("length")}
                  placeholder="如 58"
                  error={errorFor(garmentErrors, "length")}
                />
                <Field
                  label="成衣胸围"
                  unit="cm"
                  value={garment.bust}
                  onChange={setGarmentField("bust")}
                  placeholder="如 96"
                  error={errorFor(garmentErrors, "bust")}
                  hint="商品尺码表里的平铺胸围，不是你的身体胸围"
                />
                <Field
                  label="肩宽"
                  unit="cm"
                  value={garment.shoulder}
                  onChange={setGarmentField("shoulder")}
                  placeholder="如 38"
                  error={errorFor(garmentErrors, "shoulder")}
                  hint="填商品尺码表里的肩宽"
                />
              </div>
              <p className="pt-5 text-[11px] leading-5 text-muted">
                填了成衣胸围 + 版型，才能和身体胸围一起判断松紧；不填只出效果图。
              </p>
            </SectionCard>
          </div>
        </div>

        {submitError && (
          <p
            role="alert"
            className="rounded-xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
          >
            {submitError}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            提交即表示同意{" "}
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              隐私说明
            </Link>
            ；三围仅用于本次计算，用完即删。
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-accent px-10 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "处理中…" : "开始试穿 →"}
          </button>
        </div>
      </form>
    </div>
  );
}
