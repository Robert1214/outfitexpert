/**
 * GET /api/download?url=<MPS 结果图签名 URL>
 * 服务端代理下载结果图：浏览器直接 fetch COS 链接会被跨域拦截，
 * 由服务端取回后以附件形式返回，前端即可用 blob 触发保存。
 * 只允许腾讯云 COS 域名，防止 SSRF。
 */
import { NextRequest, NextResponse } from "next/server";

/** 单图上限 20MB（MPS 2K 图约 1MB，留足余量） */
const MAX_BYTES = 20 * 1024 * 1024;
/** 例：beauty-1378942524.cos.ap-shanghai.myqcloud.com */
const COS_HOST_RE = /\.cos\.[a-z0-9-]+\.myqcloud\.com$/i;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "缺少 url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "url 不合法" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !COS_HOST_RE.test(target.hostname)) {
    return NextResponse.json({ error: "只允许下载腾讯云 COS 图片" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "图片下载失败" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "图片下载失败或链接已过期" }, { status: 502 });
  }

  const declared = Number(upstream.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }

  const type = upstream.headers.get("content-type") ?? "image/jpeg";
  const ext = type.includes("png") ? "png" : "jpg";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="outfitexpert-${Date.now()}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
