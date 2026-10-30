# 生成改前/改后对比测试输入：用同一张原图复现浏览器两条压缩路径
# 用法：python scripts/make-test-inputs.py
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "test-assets"


def make(src_name, out_name, max_dim, quality):
    src = Image.open(ASSETS / src_name).convert("RGB")
    scale = min(1.0, max_dim / max(src.size))
    if scale < 1.0:
        src = src.resize(
            (round(src.width * scale), round(src.height * scale)), Image.LANCZOS
        )
    out = ASSETS / out_name
    src.save(out, "JPEG", quality=quality)
    print(f"{out_name}: {out.stat().st_size // 1024}KB, {src.size[0]}x{src.size[1]}")


# 改前：浏览器旧路径 fileToDataUrl(file) —— 最长边 900、JPEG q0.85
make("person.png", "person-before.jpg", 900, 85)
make("garment.png", "garment-before.jpg", 900, 85)
# 改后：浏览器新路径 fileToDataUrl(file, { maxDim: 2048, quality: 0.92 })
# （原图 896x1200 < 2048，不缩小，只 JPEG 重编码）
make("person.png", "person-after.jpg", 2048, 92)
make("garment.png", "garment-after.jpg", 2048, 92)
