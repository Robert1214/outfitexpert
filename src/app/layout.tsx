import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "试穿助手 · 下单前先试试",
  description: "上传模特图和最多 4 件单品，生成 AI 试穿效果图与合身判断",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">{children}</div>
      </body>
    </html>
  );
}
