"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { judgeFit, lengthPositionHint } from "@/lib/size-engine";
import { clearPayload, loadPayload } from "@/lib/storage";
import type { TryonPayload } from "@/lib/types";

// PRD v1.1：不输出具体尺码，只给方向和判断
const VERDICT_LABEL: Record<string, string> = {
  keep: "合身",
  up: "偏紧 · 建议看大一档",
  down: "偏松 · 建议看小一档",
};

const DIRECTION_TEXT: Record<string, string> = {
  keep: "放量在理想区间内，无需调整",
  up: "建议看大一档",
  down: "建议看小一档",
};

/** 前端兜底超时：略大于后端轮询上限（90 秒）+ 上传耗时 */
const CLIENT_TIMEOUT_MS = 150_000;

type Stage = "loading" | "missing" | "error" | "done";

export default function ResultPage() {
  const router = useRouter();
  // 首屏统一渲染「生成中」，服务器/浏览器一致，避免水合不一致
  const [stage, setStage] = useState<Stage>("loading");
  const [payload, setPayload] = useState<TryonPayload | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const startTryon = useCallback(async (p: TryonPayload) => {
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personImage: p.personImage, garmentImage: p.garmentImage }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "生成失败，请重试");
      }
      if (!data?.imageUrl) {
        throw new Error("生成失败，请重试");
      }
      setResultImage(data.imageUrl);
      setStage("done");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setErrorMsg(aborted ? "生成超时，请重试" : e instanceof Error ? e.message : "生成失败，请重试");
      setStage("error");
    } finally {
      clearTimeout(abortTimer);
      clearInterval(timer);
    }
  }, []);

  // 客户端才读 localStorage（SSR 没有 localStorage），读完后立即发起试穿
  useEffect(() => {
    const t = setTimeout(() => {
      const p = loadPayload();
      setPayload(p);
      if (!p) {
        setStage("missing");
        return;
      }
      void startTryon(p);
    }, 0);
    return () => clearTimeout(t);
  }, [startTryon]);

  // 合身判断与长度提示相互独立（PRD v1.1 数据依赖表）
  const fitAdvice = useMemo(
    () => (payload ? judgeFit(payload.body, payload.garment) : null),
    [payload]
  );
  const lengthHint = useMemo(() => {
    if (!payload || !payload.body.height || !payload.garment.length) return null;
    return lengthPositionHint(payload.garment.length, payload.body.height);
  }, [payload]);

  function restart() {
    clearPayload();
    router.push("/");
  }

  function retry() {
    if (!payload) return;
    setStage("loading");
    setErrorMsg(null);
    setElapsed(0);
    void startTryon(payload);
  }

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-28 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
        <p className="text-sm font-medium">AI 正在为你试穿…</p>
        <p className="text-xs text-muted">
          通常需要 20~60 秒{elapsed > 5 ? `，已等待 ${elapsed} 秒` : ""}
        </p>
        <p className="text-xs text-muted">期间请不要关闭页面</p>
      </div>
    );
  }

  if (stage === "missing") {
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

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-4xl">😢</p>
        <p className="text-sm font-medium">生成失败，请重试</p>
        <p className="text-xs text-muted">{errorMsg}</p>
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            重试
          </button>
          <button
            onClick={restart}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-muted ring-1 ring-line hover:text-foreground"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!payload) return null; // 理论不可达，防御

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
          <img
            src={resultImage ?? undefined}
            alt="AI 试穿效果图"
            className="w-full"
          />
          {!fitAdvice && (
            <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2.5 py-1 text-xs text-white">
              无尺码数据，请以实物为准
            </span>
          )}
          <span className="absolute bottom-2 right-2 rounded-lg bg-black/65 px-2.5 py-1 text-xs text-white">
            AI 生成
          </span>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
          效果图仅示意颜色、版型、气质和大致长度（人像为半身 / 大头照时，效果图可能只呈现上半身）；精确合身度请以合身判断为准。
          结果图链接约 1 小时内有效，请及时保存。
        </p>
      </section>

      {fitAdvice || lengthHint ? (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
          <h2 className="text-base font-semibold">试穿建议</h2>

          {fitAdvice && (
            <div className="mt-3 flex flex-col gap-2">
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  fitAdvice.verdict === "keep"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {VERDICT_LABEL[fitAdvice.verdict]}
              </span>
              <ul className="flex flex-col gap-2">
                <li className="flex gap-2 text-sm leading-5">
                  <span className="mt-0.5 text-accent">·</span>
                  <span>{fitAdvice.detail}</span>
                </li>
                <li className="flex gap-2 text-sm leading-5">
                  <span className="mt-0.5 text-accent">·</span>
                  <span>{DIRECTION_TEXT[fitAdvice.verdict]}</span>
                </li>
              </ul>
            </div>
          )}

          {lengthHint && (
            <div
              className={`flex items-center gap-2 text-sm leading-5 ${
                fitAdvice ? "mt-3 border-t border-line pt-3" : "mt-2"
              }`}
            >
              <span className="text-accent">·</span>
              <span>
                长度提示：<span className="font-medium">{lengthHint}</span>
              </span>
            </div>
          )}

          <p className="mt-3 text-xs text-muted">
            以上按你填写的成衣尺寸估算，最终以实物试穿为准
          </p>
        </section>
      ) : (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
          <h2 className="text-base font-semibold">想拿到合身判断？</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            回到上一步，填写你的胸围和衣服的成衣胸围（在商品尺码表里），即可得到合身判断；再填衣长还能看到长度提示。
          </p>
        </section>
      )}

      <p className="text-center text-xs text-muted">
        本次数据仅保存在你的浏览器里，图片仅发送给腾讯云生成效果图，
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          查看隐私说明
        </Link>
      </p>
    </div>
  );
}
