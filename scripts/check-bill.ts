/**
 * 查询腾讯云账单汇总（只读，不产生费用）。
 * 运行：npx tsx --env-file=.env.local scripts/check-bill.ts [YYYY-MM]
 * 默认查当月。日结账单次日 12:00~18:00 才结算，当天费用可能查不到。
 */
import { billing } from "tencentcloud-sdk-nodejs";

const Client = billing.v20180709.Client;
const secretId = process.env.TENCENT_SECRET_ID;
const secretKey = process.env.TENCENT_SECRET_KEY;
if (!secretId || !secretKey) {
  console.error("缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY");
  process.exit(1);
}

const month =
  process.argv[2] ??
  new Date().toISOString().slice(0, 7);

const client = new Client({
  credential: { secretId, secretKey },
  region: "",
  profile: { httpProfile: { endpoint: "billing.tencentcloudapi.com" } },
});

// SDK 生成的响应类型与实际字段不一致，这里按实际返回结构做最小收窄
interface BillSummary {
  RealTotalCost?: number;
  CashPayAmount?: number;
  VoucherPayAmount?: number;
}
interface BillRow extends BillSummary {
  ProductName?: string;
  BusinessCode?: string;
}

client
  .DescribeBillSummaryByProduct({
    // 该接口按整月查询，BeginTime/EndTime 传 YYYY-MM
    BeginTime: month,
    EndTime: month,
  })
  .then((res) => {
    const data = res as unknown as {
      SummaryOverview?: BillSummary;
      SummaryDetail?: BillRow[];
    };
    const overview = data.SummaryOverview;
    console.log(`月份：${month}`);
    console.log(
      `总费用：${overview?.RealTotalCost ?? "?"} 元（现金 ${overview?.CashPayAmount ?? "?"}，赠送/代金券 ${overview?.VoucherPayAmount ?? "?"}）`
    );
    const rows = data.SummaryDetail ?? [];
    if (rows.length === 0) {
      console.log("该月暂无已结算账单（当天费用次日才结算）。");
      return;
    }
    console.log("按产品：");
    for (const r of rows) {
      console.log(
        `- ${r.ProductName ?? r.BusinessCode ?? "?"}：${r.RealTotalCost ?? "?"} 元（现金 ${r.CashPayAmount ?? "?"}，券 ${r.VoucherPayAmount ?? "?"}）`
      );
    }
  })
  .catch((e) => {
    console.error("查询失败：", e?.code ?? "", e?.message ?? e);
    process.exit(1);
  });
