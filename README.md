# 试穿助手（outfitexpert）

帮年轻人在下单前决定「买不买、买什么码」：上传全身照 + 衣服图，生成试穿效果图和尺码建议。

- 需求文档：`memory-bank/prd.md`
- 实施计划：`memory-bank/plan.md`
- 开发规范：`CLAUDE.md`

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 <http://localhost:3000>（手机优先布局，建议用浏览器手机模拟视图查看）。

## 当前阶段

**M1 静态原型**（纯前端）：上传 → 校验 → 假效果图 + 尺码建议（浏览器本地计算）。尚未接入真实试穿 API。
