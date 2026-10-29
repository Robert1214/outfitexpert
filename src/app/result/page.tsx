"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { advise } from "@/lib/size-engine";
import { clearPayload, loadPayload } from "@/lib/storage";
import type { TryonPayload } from "@/lib/types";

const VERDICT_LABEL: Record<string, string> = {
  keep: "合身",
  up: "偏紧 · 建议大一码",
  down: "偏松 · 建议小一码",
};

export default function ResultPage() {
  const router = useRouter();
  // 首屏统一渲染「生成中」，服务器/浏览器一致，避免水合不一致
  const [stage, setStage] = useState<"loading" | "done">("loading");
  const [payload, setPayload] = useState<TryonPayload | null>(null);

  useEffect(() => {
    // M1 演示：模拟出图等待；M2 换成真实接口（20~60 秒）
    const t = setTimeout(() => {
      setPayload(loadPayload());
      setStage("done");
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  const advice = useMemo(
    () => (payload ? advise(payload.body, payload.garment) : null),
    [payload]
  );

  function restart() {
    clearPayload();
    router.push("/");
  }

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-28 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
        <p className="text-sm font-medium">AI 正在为你试穿…</p>
        <p className="text-xs text-muted">演示模式约 2 秒；接入真实服务后约 20~60 秒</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-4xl">🤷</p>
        <p className="text-sm text-muted">没有找到试穿数据，可能已过期或未提交</p>
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep"
        >
          去上传
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">试穿结果</h1>
        <button
          onClick={restart}
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          再来一次
        </button>
      </header>

      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-line">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fake-result.svg" alt="试穿效果图（占位演示）" className="w-full" />
          {!advice && (
            <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2.5 py-1 text-xs text-white">
              无尺码数据，请以实物为准
            </span>
          )}
          <span className="absolute bottom-2 right-2 rounded-lg bg-black/65 px-2.5 py-1 text-xs text-white">
            AI 生成
          </span>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
          效果图仅示意颜色、版型、气质和大致长度；精确合身度请以尺码建议为准。M1
          演示图，尚未接入真实试穿服务。
        </p>
      </section>

      {advice ? (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
              <span className="text-2xl font-bold text-accent">{advice.size}</span>
              <span className="text-xs text-accent">建议尺码</span>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">尺码建议</h2>
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  advice.verdict === "keep"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {VERDICT_LABEL[advice.verdict]}
              </span>
              {advice.lengthHint && <p className="text-xs text-muted">{advice.lengthHint}</p>}
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {advice.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm leading-5">
                <span className="mt-0.5 text-accent">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
          <h2 className="text-base font-semibold">想拿到尺码建议？</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            回到上一步，填写身高、胸围，以及衣服的成衣胸围和尺码，即可得到建议码和合身提示。
          </p>
        </section>
      )}

      <p className="text-center text-xs text-muted">
        本次数据仅保存在你的浏览器里（未上传服务器），
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          查看隐私说明
        </Link>
      </p>
    </div>
  );
}
