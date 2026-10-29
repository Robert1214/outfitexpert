import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "试穿助手 · 下单前先试试",
  description: "上传人像照和衣服图，生成试穿效果图与合身判断",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <div className="mx-auto w-full max-w-md px-4 pb-12">{children}</div>
      </body>
    </html>
  );
}
