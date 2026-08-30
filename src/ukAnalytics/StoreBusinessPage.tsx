import { useState } from "react";
import { Download, Info } from "lucide-react";
import { changeText, moneyText, metricValue, numberText, percentText } from "./format";
import type { UkDataSnapshot, UkStoreBusinessData } from "./types";

type Mode = "sales" | "traffic";
type Metric = { key: string; label: string; kind: "money" | "number" | "rate" };
const salesMetrics: Metric[] = [
  { key: "商品交易总额 (£)", label: "GMV", kind: "money" }, { key: "GMV（TikTok 合资）", label: "GMV（TikTok 合资）", kind: "money" }, { key: "商品成交件数", label: "商品成交件数", kind: "number" }, { key: "SKU 订单", label: "SKU订单", kind: "number" }, { key: "订单数", label: "订单数", kind: "number" }, { key: "退款金额 (£)", label: "退款金额", kind: "money" },
];
const trafficMetrics: Metric[] = [
  { key: "去重客户数", label: "去重客户数", kind: "number" }, { key: "页面浏览次数", label: "页面浏览次数", kind: "number" }, { key: "店铺页面访问量", label: "店铺页面访问量", kind: "number" }, { key: "转化率", label: "转化率", kind: "rate" },
];
const metricText = (value: number | null, kind: Metric["kind"]) => kind === "money" ? moneyText(value) : kind === "rate" ? percentText(value) : numberText(value);

function StoreTrend({ points, metrics }: { points: UkStoreBusinessData["daily"]; metrics: Metric[] }) {
  const width = 720; const height = 230; const pad = { top: 18, right: 20, bottom: 30, left: 26 };
  const available = metrics.map((metric) => ({ metric, values: points.map((point) => metricValue(point.metrics, metric.key)) }));
  const pathFor = (values: Array<number | null>) => {
    const real = values.filter((value): value is number => value !== null);
    if (!real.length) return [] as string[];
    const min = Math.min(...real); const max = Math.max(...real); const span = max - min || 1;
    const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(points.length - 1, 1));
    const y = (value: number) => height - pad.bottom - ((value - min) / span) * (height - pad.top - pad.bottom);
    const segments: string[] = []; let current: string[] = [];
    values.forEach((value, index) => { if (value === null) { if (current.length) segments.push(current.join(" ")); current = []; } else current.push(`${x(index)},${y(value)}`); });
    if (current.length) segments.push(current.join(" "));
    return segments;
  };
  return <div className="uk-store-trend"><div className="uk-trend-legend">{metrics.map((metric, index) => <span key={metric.key}><i className={`line-${index}`} />{metric.label}</span>)}</div>{metrics.length && points.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="店铺业务每日趋势">{[0, 1, 2, 3].map((index) => <line key={index} x1={pad.left} x2={width - pad.right} y1={pad.top + index * ((height - pad.top - pad.bottom) / 3)} y2={pad.top + index * ((height - pad.top - pad.bottom) / 3)} />)}{available.flatMap(({ values }, index) => pathFor(values).map((segment, segmentIndex) => <polyline key={`${index}-${segmentIndex}`} points={segment} className={`line-${index}`} />))}{points.map((point, index) => <text key={point.date} x={pad.left + index * ((width - pad.left - pad.right) / Math.max(points.length - 1, 1))} y={height - 8} textAnchor="middle">{point.date.slice(5).replace("-", "/")}</text>)}</svg> : <p>当前导出文件未提供可展示的每日趋势数据</p>}</div>;
}

export default function StoreBusinessPage({ snapshot, previous, onImport }: { snapshot: UkDataSnapshot<UkStoreBusinessData> | null; previous: UkDataSnapshot<UkStoreBusinessData> | null; onImport: () => void }) {
  const [mode, setMode] = useState<Mode>("sales");
  const [selected, setSelected] = useState<string[]>(["商品交易总额 (£)", "GMV（TikTok 合资）"]);
  if (!snapshot) return <section className="hf-panel uk-empty-data"><strong>请导入 店铺数据分析 → 业务数据</strong><button onClick={onImport}><Download size={14} /> 导入数据</button></section>;
  const metrics = mode === "sales" ? salesMetrics : trafficMetrics;
  const active = metrics.filter((metric) => selected.includes(metric.key));
  const toggleMetric = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : current.length >= 2 ? [current[1], key] : [...current, key]);
  const today = new Date(); const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayData = snapshot.endDate === localToday ? snapshot.data.daily.find((point) => point.date === localToday) ?? null : null;
  const todayCards = [
    { label: "GMV", value: todayData ? moneyText(metricValue(todayData.metrics, "商品交易总额 (£)")) : "--" }, { label: "商品成交件数", value: todayData ? numberText(metricValue(todayData.metrics, "商品成交件数")) : "--" }, { label: "商品访客数", value: todayData ? numberText(metricValue(todayData.metrics, "店铺页面访问量")) : "--" }, { label: "客户数", value: todayData ? numberText(metricValue(todayData.metrics, "去重客户数")) : "--" },
  ];
  return <div className="uk-store-page"><section className="hf-panel uk-business-panel"><header><div><h2>业务数据</h2><div className="uk-mode-tabs"><button className={mode === "sales" ? "active" : ""} onClick={() => { setMode("sales"); setSelected(["商品交易总额 (£)", "GMV（TikTok 合资）"]); }}>销量</button><button className={mode === "traffic" ? "active" : ""} onClick={() => { setMode("traffic"); setSelected(["去重客户数", "页面浏览次数"]); }}>流量</button></div></div><small>最多选择 2 个指标查看趋势</small></header><div className="uk-metric-picker">{metrics.map((metric) => <button key={metric.key} className={selected.includes(metric.key) ? "active" : ""} onClick={() => toggleMetric(metric.key)}>{metric.label}</button>)}</div><div className="uk-store-metrics">{metrics.map((metric) => { const value = metricValue(snapshot.data.summary, metric.key); const change = changeText(value, previous ? metricValue(previous.data.summary, metric.key) : null, metric.kind === "rate"); return <article key={metric.key}><span>{metric.label}</span><strong>{metricText(value, metric.kind)}</strong><small className={change.tone}>{change.text}</small></article>; })}</div><StoreTrend points={snapshot.data.daily} metrics={active} /></section><aside className="uk-store-side"><section className="hf-panel uk-today-panel"><header><h2>今日数据</h2><Info size={14} /></header><div>{todayCards.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div>{!todayData && <p>当前导出文件未提供今日实时数据</p>}</section><section className="hf-panel uk-empty-side"><h2>业务加速器</h2><p>当前导出文件未提供业务加速器建议</p></section></aside><section className="hf-panel uk-sales-source"><header><h2>销量来源</h2></header><div>当前店铺业务数据导出未提供销量来源拆分</div></section></div>;
}
