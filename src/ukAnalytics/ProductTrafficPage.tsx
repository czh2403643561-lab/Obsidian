import { useMemo, useState } from "react";
import { Download, Info, SlidersHorizontal } from "lucide-react";
import { downloadXlsx, moneyText, numberText, percentText, periodFilePart, rateText } from "./format";
import { ukProductSourceKeys, ukProductSourceLabels, type UkDataSnapshot, type UkMetricMap, type UkProductSourceKey, type UkProductTrafficBreakdownData, type UkProductTrafficData } from "./types";

type Props = { snapshot: UkDataSnapshot<UkProductTrafficData> | null; breakdown: UkDataSnapshot<UkProductTrafficBreakdownData> | null; onImport: () => void };
const metric = (metrics: UkMetricMap, name: string): number | null => {
  if (metrics[name] !== undefined) return metrics[name];
  const normalized = name.replace(/[\s（）()]/g, "").toLowerCase();
  const entry = Object.entries(metrics).find(([key]) => key.replace(/[\s（）()]/g, "").toLowerCase() === normalized);
  return entry ? entry[1] : null;
};
const growthTone = (value: number | null): string => value === null ? "neutral" : value > 0 ? "up" : value < 0 ? "down" : "neutral";
const trendPath = (values: Array<number | null>, width: number, height: number): string => {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return "";
  const min = Math.min(...present); const max = Math.max(...present); const span = max - min || 1;
  return values.map((value, index) => value === null ? null : `${index ? "L" : "M"}${(index / Math.max(1, values.length - 1)) * width},${height - ((value - min) / span) * height}`).filter(Boolean).join(" ");
};
const sourceMetric = (source: UkProductSourceKey, data: UkProductTrafficData) => data.sources[source];

export default function ProductTrafficPage({ snapshot, breakdown, onImport }: Props) {
  const [source, setSource] = useState<UkProductSourceKey>("all");
  const [mode, setMode] = useState<"page" | "unique">("page");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["GMV", "商品曝光次数"]);
  const current = snapshot ? sourceMetric(source, snapshot.data) : null;
  const cards = [
    ["GMV", "money"], ["预计客户数", "number"], ["商品曝光次数", "number"], ["商品点击量", "number"], ["商品点击率", "rate"], ["SKU 订单数", "number"], ["商品成交件数", "number"], ["CTOR（SKU 订单）", "rate"],
  ] as const;
  const funnel = mode === "page" ? { exposure: "商品曝光次数", click: "商品点击量", clickRate: "商品点击率", order: "SKU 订单数", conversion: "CTOR（SKU 订单）" } : { exposure: "去重商品曝光次数", click: "去重点击次数", clickRate: "去重点击率", order: "SKU 订单数", conversion: "去重点击成交转化率（SKU 订单）" };
  const toggleMetric = (name: string) => setSelectedMetrics((currentMetrics) => currentMetrics.includes(name) ? currentMetrics.filter((item) => item !== name) : currentMetrics.length >= 2 ? [currentMetrics[1], name] : [...currentMetrics, name]);
  const rows = useMemo(() => {
    if (!snapshot) return [];
    const primary = snapshot.data.breakdown;
    const fallback = breakdown?.data.rows ?? [];
    const filtered = (primary.length ? primary : fallback).filter((row) => row.source && Object.values(row.metrics).some((value) => value !== null));
    const channelRows = filtered.filter((row) => row.source !== "全部");
    return channelRows.length ? channelRows : filtered;
  }, [snapshot, breakdown]);
  const totalGmv = rows.reduce((total, row) => total + (metric(row.metrics, "GMV") ?? 0), 0);
  const exportRows = () => downloadXlsx(`商品流量表现明细_${snapshot ? periodFilePart(snapshot) : "数据"}.xlsx`, [{ key: "source", label: "来源" }, { key: "gmv", label: "GMV", kind: "money" }, { key: "orders", label: "SKU 订单数", kind: "number" }, { key: "impressions", label: "商品曝光次数", kind: "number" }, { key: "clicks", label: "商品点击量", kind: "number" }, { key: "ctr", label: "商品点击率", kind: "rate" }], rows.map((row) => ({ source: row.source, gmv: metric(row.metrics, "GMV"), orders: metric(row.metrics, "SKU 订单数"), impressions: metric(row.metrics, "商品曝光次数"), clicks: metric(row.metrics, "商品点击量"), ctr: metric(row.metrics, "商品点击率") })));
  if (!snapshot) return <section className="hf-panel uk-real-empty-panel"><h2>商品数据分析 · 商品流量</h2><p>请先导入英国 Seller Center 的“商品数据分析-商品流量.xlsx”。</p><button onClick={onImport}><Download size={14} /> 导入官方 Excel</button></section>;
  if (!current?.available) return <section className="hf-panel uk-real-empty-panel"><h2>商品数据分析 · 商品流量</h2><p>当前导出文件未提供“{ukProductSourceLabels[source]}”来源数据。</p><button onClick={onImport}>重新导入数据</button></section>;
  const maxFunnel = Math.max(1, metric(current.summary, funnel.exposure) ?? 0);
  const funnelItems = [["商品曝光", metric(current.summary, funnel.exposure)], ["商品点击", metric(current.summary, funnel.click)], ["SKU 订单", metric(current.summary, funnel.order)]] as Array<[string, number | null]>;
  return <section className="hf-panel uk-traffic-page"><div className="uk-traffic-kind-tabs"><button className="active">按商品</button><button disabled>按 SKU</button></div><div className="uk-traffic-source-tabs">{ukProductSourceKeys.map((item) => <button key={item} className={source === item ? "active" : ""} onClick={() => setSource(item)}>{ukProductSourceLabels[item]}</button>)}</div><div className="uk-traffic-toolbar"><div className="uk-traffic-insights"><button className="active">全部 <small>{rows.length}</small></button><button>增长明显 <small>--</small></button><button>下降明显 <small>--</small></button><button>新增 <small>--</small></button></div><button className="uk-toolbar-button"><SlidersHorizontal size={14} /> 筛选</button><button className="uk-export-button" onClick={exportRows}><Download size={14} /> 导出数据</button></div><section className="uk-traffic-summary"><header><div><h2>{ukProductSourceLabels[source]} · 来源表现</h2><p>当前周期 {snapshot.startDate} – {snapshot.endDate}{snapshot.data.comparisonStartDate && `　对比 ${snapshot.data.comparisonStartDate} – ${snapshot.data.comparisonEndDate}`}</p></div><Info size={15} /></header><div className="uk-traffic-card-grid">{cards.map(([name, kind]) => { const value = metric(current.summary, name); const change = metric(current.comparison, name); return <article key={name}><small>{name}</small><strong>{kind === "money" ? moneyText(value) : kind === "rate" ? percentText(value) : numberText(value)}</strong><em className={growthTone(change)}>{rateText(change)}</em></article>; })}</div></section><section className="uk-traffic-trend"><header><div><h2>趋势</h2><p>按日展示当前来源的真实官方数据</p></div><div className="uk-trend-metric-tabs">{["GMV", "商品曝光次数", "商品点击量", "SKU 订单数"].map((name) => <button key={name} className={selectedMetrics.includes(name) ? "active" : ""} onClick={() => toggleMetric(name)}>{name}</button>)}</div></header><div className="uk-trend-chart"><svg viewBox="0 0 720 180" role="img" aria-label="商品流量趋势图"><line x1="0" y1="20" x2="720" y2="20" /><line x1="0" y1="90" x2="720" y2="90" /><line x1="0" y1="160" x2="720" y2="160" />{selectedMetrics.map((name, index) => <path key={name} className={index ? "secondary" : ""} d={trendPath(current.trend.map((point) => metric(point.metrics, name)), 720, 140)} />)}{current.trend.map((point, index) => <text key={point.date} x={(index / Math.max(1, current.trend.length - 1)) * 720} y="176" textAnchor={index === 0 ? "start" : index === current.trend.length - 1 ? "end" : "middle"}>{point.date.slice(5)}</text>)}</svg><div className="uk-trend-legend">{selectedMetrics.map((name, index) => <span key={name}><i className={index ? "secondary" : ""} />{name}</span>)}</div></div></section><section className="uk-traffic-lower-grid"><section className="uk-traffic-funnel"><header><div><h2>流量分析</h2><p>官方漏斗指标</p></div><div className="uk-segmented"><button className={mode === "page" ? "active" : ""} onClick={() => setMode("page")}>页面浏览量</button><button className={mode === "unique" ? "active" : ""} onClick={() => setMode("unique")}>去重访客数</button></div></header><div className="uk-funnel-flow">{funnelItems.map(([label, value], index) => <div className="uk-funnel-step" key={label} style={{ width: `${Math.max(24, ((value ?? 0) / maxFunnel) * 100)}%` }}><span>{label}</span><strong>{numberText(value)}</strong>{index === 0 && <em>点击率 {percentText(metric(current.summary, funnel.clickRate))}</em>}</div>)}<div className="uk-funnel-foot"><span>点击成交转化率</span><strong>{percentText(metric(current.summary, funnel.conversion))}</strong></div></div></section><section className="uk-traffic-breakdown"><header><div><h2>表现明细</h2><p>按来源拆解当前商品流量</p></div><button className="uk-export-button" onClick={exportRows}><Download size={13} /> 导出数据</button></header><table><thead><tr><th>来源</th><th>GMV</th><th>订单数</th><th>商品曝光次数</th><th>商品点击量</th><th>GMV 占比</th><th>操作</th></tr></thead><tbody>{rows.map((row) => { const gmv = metric(row.metrics, "GMV") ?? 0; return <tr key={row.source}><td>{row.source}</td><td>{moneyText(metric(row.metrics, "GMV"))}</td><td>{numberText(metric(row.metrics, "SKU 订单数"))}</td><td>{numberText(metric(row.metrics, "商品曝光次数"))}</td><td>{numberText(metric(row.metrics, "商品点击量"))}</td><td>{percentText(totalGmv ? (gmv / totalGmv) * 100 : null)}</td><td><button onClick={() => setSource(ukProductSourceKeys.find((item) => ukProductSourceLabels[item] === row.source) ?? source)}>查看详情</button></td></tr>})}</tbody></table>{!rows.length && <div className="hf-real-empty">当前周期暂无表现明细</div>}</section></section></section>;
}
