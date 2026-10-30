import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "隐私说明 · 试穿助手" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <header>
        <Link href="/" className="text-sm text-accent">
          ← 返回
        </Link>
        <h1 className="mt-2 text-2xl font-bold">隐私说明</h1>
      </header>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">我们收集什么</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          你上传的照片（人像照、衣服图），以及你自愿填写的身体数据（身高、体重、三围）和衣服成衣尺寸。
        </p>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">数据怎么用</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-muted">
          <li>生成试穿效果图：人像照和衣服图会发送给腾讯云（媒体处理 MPS）处理</li>
          <li>计算合身判断：身高、体重、三围只在你自己的浏览器里计算，不上传服务器</li>
          <li>不用于广告、用户画像或任何其他目的</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">数据存多久</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          用完即删。生成效果图时，图片会发送给腾讯云（媒体处理 MPS）；中转图片存放在腾讯云 COS
          私有存储桶（仅签名链接可访问），效果图生成后立即删除、不落盘存储。生成的效果图链接约 1
          小时后自动过期。身体数据只留在你自己的浏览器里，再次试穿会被覆盖，也可随时清除浏览器数据。
        </p>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">你随时可以</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-muted">
          <li>不填三围和衣服尺寸，直接出图（此时不给合身判断）</li>
          <li>清除浏览器数据，删除全部本地记录</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">联系我们</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          对本说明有疑问，可通过 GitHub 仓库 Robert1214/outfitexpert 的 Issues 联系我们。
        </p>
      </section>
    </div>
  );
}
