"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { judgeFit, lengthPositionHint } from "@/lib/size-engine";
import { getPendingTryon, setPendingTryon } from "@/lib/pending-tryon";
import {
  clearInflight,
  clearResultCache,
  isResultCacheFresh,
  loadInflight,
  loadResultCache,
  payloadSignature,
  saveInflight,
  saveResultCache,
} from "@/lib/result-cache";
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

type Stage = "loading" | "missing" | "error" | "done" | "confirm";

export default function ResultPage() {
  const router = useRouter();
  // 首屏统一渲染「生成中」，服务器/浏览器一致，避免水合不一致
  const [stage, setStage] = useState<Stage>("loading");
  const [payload, setPayload] = useState<TryonPayload | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // 悬停看原图（桌面）/ 点按切换（手机）
  const [showOriginal, setShowOriginal] = useState(false);
  // 并发保护：同一时间只允许一个请求写 state；新请求会先中止旧请求
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const startTryon = useCallback(async (p: TryonPayload) => {
    // 让旧请求的 setState 失效，再中止它，避免两个请求同时写状态
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 统一重置：先回到 loading 并清空旧结果，避免旧图闪现
    setStage("loading");
    setResultImage(null);
    setErrorMsg(null);
    setElapsed(0);
    setShowOriginal(false);

    // 记录进行中的请求：刷新页面时据此提示，不自动重复扣费
    const signature = payloadSignature(p);
    saveInflight({ signature, startedAt: Date.now() });

    const t0 = Date.now();
    const timer = setInterval(() => {
      if (requestId === requestIdRef.current) {
        setElapsed(Math.floor((Date.now() - t0) / 1000));
      }
    }, 1000);
    const abortTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      // 上传给后端优先用内存里的高清图；刷新页面内存丢失时
      // 退回 localStorage 的压缩版，功能不受影响
      const pending = getPendingTryon();
      const personImage = pending?.personImage ?? p.personImage;
      const garmentImages = pending?.garmentImages ?? p.garmentImages;
      const garmentTypes = pending?.garmentTypes ?? p.garmentTypes;
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personImage, garmentImages, garmentTypes }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "生成失败，请重试");
      }
      if (!data?.imageUrl) {
        throw new Error("生成失败，请重试");
      }
      if (requestId !== requestIdRef.current) return; // 已被新请求取代
      // 写结果缓存：刷新页面直接复用，避免重复扣费
      saveResultCache({ imageUrl: data.imageUrl, createdAt: Date.now(), signature });
      setResultImage(data.imageUrl);
      setStage("done");
    } catch (e) {
      if (requestId !== requestIdRef.current) return; // 旧请求的失败不覆盖新状态
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setErrorMsg(aborted ? "生成超时，请重试" : e instanceof Error ? e.message : "生成失败，请重试");
      setStage("error");
    } finally {
      clearTimeout(abortTimer);
      clearInterval(timer);
      if (requestId === requestIdRef.current) {
        abortRef.current = null;
        clearInflight();
      }
    }
  }, []);

  // 客户端才读 localStorage（SSR 没有 localStorage），读完后立即发起试穿
  useEffect(() => {
    const t = setTimeout(() => {
      const stored = loadPayload();
      const pending = getPendingTryon();
      // 4 张压缩图可能撑爆 localStorage（savePayload 会静默失败）；
      // 同一标签页里 pending 内存通道还在，用它兜底，至少能出图
      const p: TryonPayload | null =
        stored ??
        (pending
          ? {
              personImage: pending.personImage,
              garmentImages: pending.garmentImages,
              garmentTypes: pending.garmentTypes,
              body: {},
              garment: {},
            }
          : null);
      setPayload(p);
      if (!p) {
        setStage("missing");
        return;
      }

      const signature = payloadSignature(p);
      const cache = loadResultCache();
      if (isResultCacheFresh(cache, signature)) {
        // 55 分钟内刷新：直接用缓存图，不再调用 MPS
        setResultImage(cache.imageUrl);
        setStage("done");
        return;
      }

      // 没有可用缓存，但上次生成可能还在服务端跑：先让用户确认，不自动扣费
      const inflight = loadInflight();
      if (inflight && inflight.signature === signature) {
        setStage("confirm");
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

  /** 重新上传：清空本次数据、结果缓存与未完成标记，回首页 */
  function reset() {
    clearPayload();
    setPendingTryon(null);
    clearResultCache();
    clearInflight();
    router.push("/");
  }

  /** 原地重生成：复用当前 payload / pending（含 garmentTypes），不重新读表单或上传 */
  function regenerate() {
    if (!payload || stage === "loading") return;
    if (!window.confirm("重新生成会再消耗 1 次额度，继续？")) return;
    clearResultCache();
    clearInflight();
    void startTryon(payload);
  }

  /** 确认页点「重新生成」：确认页本身就是确认，不再弹窗 */
  function regenerateFromConfirm() {
    if (!payload) return;
    clearResultCache();
    clearInflight();
    void startTryon(payload);
  }

  function retry() {
    if (!payload || stage === "loading") return;
    void startTryon(payload); // startTryon 内部会重置 loading / 旧结果
  }

  /** 结果图加载失败（多见于缓存链接过期）：清缓存并提示，不自动扣费 */
  function handleResultImageError() {
    clearResultCache();
    clearInflight();
    setResultImage(null);
    setErrorMsg("结果已过期，请重新生成");
    setStage("error");
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center gap-3 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-accent" />
        <p className="mt-2 font-serif text-xl text-accent">AI 正在为你试穿</p>
        <p className="text-sm text-muted">
          通常需要 20~60 秒{elapsed > 5 ? `，已等待 ${elapsed} 秒` : ""}
        </p>
        <p className="text-xs text-muted">期间请不要关闭或刷新页面</p>
        <div className="mt-3 h-1 w-48 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/60" />
        </div>
      </div>
    );
  }

  if (stage === "missing") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🤷</p>
        <p className="text-sm text-muted">没有找到试穿数据，可能已过期或未提交</p>
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
        >
          去上传
        </Link>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">😢</p>
        <p className="text-sm font-medium">生成失败，请重试</p>
        <p className="text-xs text-muted">{errorMsg}</p>
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            重试
          </button>
          <button
            onClick={reset}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-muted ring-1 ring-line transition hover:text-foreground"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">⏳</p>
        <p className="text-sm font-medium">上次生成可能未完成</p>
        <p className="max-w-sm text-xs leading-5 text-muted">
          上次生成可能已经消耗 1 次额度；重新生成会再消耗 1 次额度。
        </p>
        <div className="flex gap-3">
          <button
            onClick={regenerateFromConfirm}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            重新生成
          </button>
          <button
            onClick={reset}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-muted ring-1 ring-line transition hover:text-foreground"
          >
            回首页
          </button>
        </div>
      </div>
    );
  }

  if (!payload) return null; // 理论不可达，防御

  // 悬停对比优先用内存里的高清原图；刷新后内存丢失则退回 localStorage 压缩版
  const originalImage = getPendingTryon()?.personImage ?? payload.personImage;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 lg:py-8">
      <header className="flex items-end justify-between border-b border-line pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">Result</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-accent">试穿结果</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={regenerate}
            className="text-sm font-medium text-accent underline-offset-2 transition hover:underline"
          >
            再来一次
          </button>
          <button
            onClick={reset}
            className="text-sm font-medium text-muted underline-offset-2 transition hover:text-foreground hover:underline"
          >
            重新上传
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section className="overflow-hidden rounded-2xl border border-line bg-card">
          <button
            type="button"
            aria-label="查看原图对比"
            aria-pressed={showOriginal}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setShowOriginal(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setShowOriginal(false);
            }}
            onClick={(e) => {
              // 鼠标点击不做切换（悬停已经展示原图）；触摸/键盘点击切换
              const pointerType = (e.nativeEvent as PointerEvent).pointerType;
              if (pointerType === "mouse") return;
              setShowOriginal((v) => !v);
            }}
            className="group relative block w-full cursor-pointer bg-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultImage ?? undefined}
              alt="AI 试穿效果图"
              onError={handleResultImageError}
              className={`block max-h-[70vh] w-full object-contain transition-opacity duration-200 lg:max-h-[78vh] ${
                showOriginal ? "opacity-0" : "opacity-100"
              }`}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalImage}
              alt="原始模特图"
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
                showOriginal ? "opacity-100" : "opacity-0"
              }`}
            />
            <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
              <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-xs text-white backdrop-blur">
                {showOriginal ? "原图" : "AI 试穿"}
              </span>
              {!fitAdvice && !showOriginal && (
                <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-xs text-white backdrop-blur">
                  无尺码数据，请以实物为准
                </span>
              )}
            </div>
            {!showOriginal && (
              <span className="absolute bottom-3 right-3 rounded-full bg-foreground/75 px-2.5 py-1 text-xs text-white backdrop-blur">
                AI 生成
              </span>
            )}
          </button>
          <div className="flex flex-col gap-1 border-t border-line px-4 py-3 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>悬停 / 点按图片，查看原图对比</p>
            <p>结果图链接约 1 小时内有效，请及时保存</p>
          </div>
          <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
            效果图仅示意颜色、版型、气质和大致长度（人像为半身 / 大头照时，效果图可能只呈现上半身）；精确合身度请以合身判断为准。
          </p>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          {fitAdvice || lengthHint ? (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-serif text-xl font-semibold text-accent">试穿建议</h2>

              {fitAdvice && (
                <div className="mt-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      fitAdvice.verdict === "keep"
                        ? "bg-accent-soft text-accent"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {VERDICT_LABEL[fitAdvice.verdict]}
                  </span>
                  <p className="mt-3 text-sm leading-6">{fitAdvice.detail}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {DIRECTION_TEXT[fitAdvice.verdict]}
                  </p>
                </div>
              )}

              {lengthHint && (
                <div
                  className={`text-sm leading-6 ${
                    fitAdvice ? "mt-4 border-t border-line pt-4" : "mt-3"
                  }`}
                >
                  <span className="text-muted">长度提示：</span>
                  <span className="font-medium text-foreground">{lengthHint}</span>
                </div>
              )}

              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">
                以上按你填写的成衣尺寸估算，最终以实物试穿为准
              </p>
            </section>
          ) : (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-serif text-xl font-semibold text-accent">无尺码数据</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                这次只生成了效果图。回到首页填写身高、胸围和成衣胸围，就能额外得到合身判断；再填衣长还能看到长度提示。
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                去补尺寸
              </Link>
            </section>
          )}

          <p className="px-1 text-[11px] leading-5 text-muted">
            本次数据仅保存在你的浏览器里，图片仅发送给腾讯云生成效果图，
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              查看隐私说明
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
