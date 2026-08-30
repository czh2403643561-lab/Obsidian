import { Download } from "lucide-react";
import { downloadXlsx, metricValue, moneyText, numberText, periodFilePart, rateText } from "./format";
import type { UkDataSnapshot, UkMallOverviewData } from "./types";

const cards = [
  { label: "GMV", value: "GMV", ratio: "GMV Comparison Ratio", benchmark: "GMV Competitor Benchmark", kind: "money" },
  { label: "商品成交件数", value: "Items Sold", ratio: "Items Sold Comparison Ratio", benchmark: "Items Sold Competitor Benchmark", kind: "number" },
  { label: "曝光次数", value: "Impressions", ratio: "Impressions Comparison Ratio", benchmark: "Impressions Competitor Benchmark", kind: "number" },
  { label: "日均客户数", value: "Customers", ratio: "Customers Comparison Ratio", benchmark: "Customers Competitor Benchmark", kind: "number" },
] as const;
const display = (value: number | null, kind: "money" | "number") => kind === "money" ? moneyText(value) : numberText(value, kind === "number" && value !== null && !Number.isInteger(value) ? 2 : 0);

export default function MallOverviewPage({ snapshot, onImport }: { snapshot: UkDataSnapshot<UkMallOverviewData> | null; onImport: () => void }) {
  if (!snapshot) return <section className="hf-panel uk-empty-data"><strong>请导入 商城页和搜索 → 商城页概览</strong><button onClick={onImport}><Download size={14} /> 导入数据</button></section>;
  const exportOverview = () => downloadXlsx(`商城页概览_${periodFilePart(snapshot)}.xlsx`, [
    { key: "指标", label: "指标" }, { key: "当前值", label: "当前值", kind: "number" }, { key: "较上期", label: "较上期", kind: "rate" }, { key: "竞争对手参考", label: "竞争对手参考", kind: "number" },
  ], cards.map((card) => ({
    指标: card.label,
    当前值: metricValue(snapshot.data.summary, card.value),
    较上期: metricValue(snapshot.data.summary, card.ratio),
    竞争对手参考: metricValue(snapshot.data.summary, card.benchmark),
  })));
  return <div className="uk-mall-page"><section className="hf-panel uk-mall-activity">当前导出文件未提供商城活动信息</section><section className="uk-mall-help"><article className="hf-panel"><h3>什么是商城页？</h3><p>商城页是 TikTok Shop 的商品发现入口。</p></article><article className="hf-panel"><h3>如何提升销量？</h3><p>通过商品曝光、推荐和活动获取更多商城流量。</p></article></section><section className="hf-panel uk-mall-kpis"><header><div><h2>商城关键指标</h2><small>以下较上期使用官方导出的 Comparison Ratio；竞争对手参考为独立基准。</small></div><button onClick={exportOverview}><Download size={14} /> 导出数据</button></header><div>{cards.map((card) => { const ratio = metricValue(snapshot.data.summary, card.ratio); return <article key={card.label}><span>{card.label}</span><strong>{display(metricValue(snapshot.data.summary, card.value), card.kind)}</strong><em className={ratio !== null && ratio < 0 ? "down" : ratio !== null && ratio > 0 ? "up" : "neutral"}>{rateText(ratio)}</em><small>竞争对手参考 {display(metricValue(snapshot.data.summary, card.benchmark), card.kind)}</small></article>; })}</div></section><section className="hf-panel uk-mall-trend"><header><h2>商城页趋势</h2><span>按日</span></header><div>当前商城页概览导出未提供每日趋势数据</div></section></div>;
}
