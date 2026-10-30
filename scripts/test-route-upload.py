# 真实上传链路验证：模拟浏览器提交——原图 base64 成 data URL → POST /api/tryon → 下载结果图。
# 服务端日志（test-assets/dev.log）里 [tryon] 行会打印实际传给 MPS 的像素尺寸。
# 用法：python scripts/test-route-upload.py [人像图] [单品图] [结果保存名] [服务地址]
import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "test-assets"
person_name = sys.argv[1] if len(sys.argv) > 1 else "new.jpg"
garment_name = sys.argv[2] if len(sys.argv) > 2 else "garment.png"
out_name = sys.argv[3] if len(sys.argv) > 3 else "result-route.jpg"
base = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:3000"


def mime_of(name: str) -> str:
    n = name.lower()
    if n.endswith(".png"):
        return "image/png"
    if n.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


person = (ASSETS / person_name).read_bytes()
garment = (ASSETS / garment_name).read_bytes()
print(f"提交：人像 {person_name}（{len(person) / 1024:.0f}KB），单品 {garment_name}（{len(garment) / 1024:.0f}KB）")
body = json.dumps(
    {
        "personImage": f"data:{mime_of(person_name)};base64,{base64.b64encode(person).decode()}",
        "garmentImages": [
            f"data:{mime_of(garment_name)};base64,{base64.b64encode(garment).decode()}"
        ],
    }
).encode()

req = urllib.request.Request(
    f"{base}/api/tryon", data=body, headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req, timeout=150) as res:
        data = json.loads(res.read().decode())
        print("HTTP", res.status)
        url = data.get("imageUrl")
        if not url:
            print("响应:", data)
            sys.exit(1)
        print("效果图 URL:", url)
        out = ASSETS / out_name
        with urllib.request.urlopen(url, timeout=60) as r2:
            out.write_bytes(r2.read())
        print(f"结果图已保存: {out}（{out.stat().st_size / 1024:.0f}KB）")
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode())
    sys.exit(1)
