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
          你上传的照片（全身照、衣服图），以及你自愿填写的身体数据（身高、体重、三围）和衣服成衣尺寸。
        </p>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">数据怎么用</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-muted">
          <li>仅用于生成试穿效果图和计算合身判断</li>
          <li>不用于广告、用户画像或任何其他目的</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-base font-semibold">数据存多久</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          用完即删。M1 阶段数据仅保存在你自己的浏览器本地，不上传任何服务器；再次试穿会被覆盖，也可随时清除浏览器数据。
          接入真实试穿服务（M2）后，图片会发送给第三方服务商用于生成效果图，处理完成后立即删除、不落盘存储，
          届时我们会在此页面补充服务商名称。
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
