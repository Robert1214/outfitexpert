"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Field from "@/components/Field";
import SectionCard from "@/components/SectionCard";
import UploadBox from "@/components/UploadBox";
import { savePayload } from "@/lib/storage";
import type { FitStyle, GarmentSize, PersonBody, TryonPayload } from "@/lib/types";
import { validateBody, validateGarment, validateRequiredBody, type FieldError } from "@/lib/validation";

export default function HomePage() {
  const router = useRouter();
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [personConfirmed, setPersonConfirmed] = useState(false);
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

  const toNum = (v: string): number | undefined => {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const errorFor = (errors: FieldError[], field: string) =>
    errors.find((e) => e.field === field)?.message;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!personImage) {
      setSubmitError("请先上传你的全身照");
      return;
    }
    if (!garmentImage) {
      setSubmitError("请上传衣服图");
      return;
    }
    if (!personConfirmed) {
      setSubmitError("请勾选确认上传的是清晰全身照");
      return;
    }

    // 身高、体重必填：未填时红字提示并拦截（PRD v1.1）
    const requiredErrors = validateRequiredBody(body);
    if (requiredErrors.length > 0) {
      setBodyErrors(requiredErrors);
      setGarmentErrors([]);
      return;
    }

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
      garmentImage,
      body: bodyData,
      garment: garmentData,
    };
    savePayload(payload);
    router.push("/result");
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">试穿助手</h1>
        <p className="mt-1 text-sm text-muted">下单前，先看看自己穿上的美貌</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <SectionCard title="上传照片">
          <div className="flex flex-col gap-5">
            <UploadBox
              kind="person"
              value={personImage}
              onChange={setPersonImage}
              confirmed={personConfirmed}
              onConfirmed={setPersonConfirmed}
            />
            <UploadBox kind="garment" value={garmentImage} onChange={setGarmentImage} />
          </div>
        </SectionCard>

        <SectionCard title="身体数据" badge="身高体重必填">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <Field
              label="身高"
              unit="cm"
              required
              value={body.height}
              onChange={setBodyField("height")}
              placeholder="如 165"
              error={errorFor(bodyErrors, "height")}
            />
            <Field
              label="体重"
              unit="kg"
              required
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
          <p className="mt-3 text-xs text-muted">
            带 * 为必填，三围选填。填身体胸围 + 成衣胸围才能给出合身判断，填衣长还能看到长度提示。三围数据只用于本次计算，用完即删。
          </p>
        </SectionCard>

        <SectionCard title="衣服尺寸" badge="选填">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div>
              <label className="mb-1 block text-sm">版型</label>
              <select
                value={garment.fit}
                onChange={(e) => setGarmentField("fit")(e.target.value)}
                className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-accent/40"
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
              hint="填商品尺码表里的平铺胸围，不是你的身体胸围"
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
        </SectionCard>

        {submitError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-accent-deep active:scale-[0.99]"
        >
          开始试穿
        </button>

        <p className="text-center text-xs text-muted">
          提交即表示同意
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            隐私说明
          </Link>
          ，三围数据用完即删
        </p>
      </form>
    </div>
  );
}
