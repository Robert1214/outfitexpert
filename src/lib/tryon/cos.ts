/**
 * 图片临时中转（服务端专用）：MPS 的 ProcessImage 需要公网可访问的图片 URL，
 * 所以先把两张图传到 COS 拿「30 分钟有效的签名链接」，处理完立即删除。
 */
import COS from "cos-nodejs-sdk-v5";
import { TryonError } from "./errors";
import type { TryonConfig } from "./config";

const KEY_PREFIX = "outfitexpert/tmp/";

function newCos(cfg: TryonConfig): COS {
  return new COS({ SecretId: cfg.secretId, SecretKey: cfg.secretKey });
}

function extFor(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return ".jpg";
}

/** 上传图片到 COS，返回对象 key 和签名 URL（30 分钟有效） */
export async function uploadImageTemp(
  cfg: TryonConfig,
  buf: Buffer,
  contentType: string
): Promise<{ key: string; url: string }> {
  const cos = newCos(cfg);
  const key = `${KEY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extFor(contentType)}`;

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      { Bucket: cfg.cosBucket, Region: cfg.cosRegion, Key: key, Body: buf, ContentType: contentType },
      (err) => (err ? reject(err) : resolve())
    );
  });

  const url: string = await new Promise((resolve, reject) => {
    cos.getObjectUrl(
      { Bucket: cfg.cosBucket, Region: cfg.cosRegion, Key: key, Sign: true, Expires: 1800 },
      (err, data) => (err ? reject(err) : resolve(data.Url))
    );
  });

  return { key, url };
}

/** 删除中转图片（尽力而为，失败不影响主流程） */
export async function deleteImageTemp(cfg: TryonConfig, key: string): Promise<void> {
  const cos = newCos(cfg);
  await new Promise<void>((resolve, reject) => {
    cos.deleteObject({ Bucket: cfg.cosBucket, Region: cfg.cosRegion, Key: key }, (err) =>
      err ? reject(err) : resolve()
    );
  });
}

/** 把 COS SDK 的回调错误包成 TryonError，避免内部细节外泄 */
export function wrapCosError(e: unknown, action: string): TryonError {
  console.error(`COS ${action} 失败:`, e);
  return new TryonError("internal", `COS ${action} 失败`);
}

/** 上传失败时检查是否密钥/权限问题（AuthError 类归为 config） */
export function isAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /AccessDenied|SignatureDoesNotMatch|InvalidAccessKeyId|AuthFailure/i.test(msg);
}

export function toTryonError(e: unknown, action: string): TryonError {
  if (isAuthError(e)) {
    return new TryonError("config", `腾讯云密钥或 COS 权限配置有误（${action}）`);
  }
  return wrapCosError(e, action);
}
