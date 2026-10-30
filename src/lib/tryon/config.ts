/**
 * 腾讯云配置（服务端专用）。
 * 密钥只存在于服务器环境变量（.env.local，已 gitignore），绝不进前端代码。
 */

export interface TryonConfig {
  secretId: string;
  secretKey: string;
  cosBucket: string;
  cosRegion: string;
  mpsRegion: string;
}

export function getTryonConfig(): TryonConfig | null {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();
  const cosBucket = process.env.TENCENT_COS_BUCKET?.trim();
  if (!secretId || !secretKey || !cosBucket) return null;
  return {
    secretId,
    secretKey,
    cosBucket,
    cosRegion: process.env.TENCENT_COS_REGION?.trim() || "ap-guangzhou",
    mpsRegion: process.env.TENCENT_MPS_REGION?.trim() || "ap-guangzhou",
  };
}
