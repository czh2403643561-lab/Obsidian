import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { downloadXlsx, moneyText, numberText, percentText, periodFilePart, rateText } from "./format";
import { ukProductSourceKeys, ukProductSourceLabels, type UkDataSnapshot, type UkMetricMap, type UkProductSourceKey, type UkProductTrafficBreakdownData, type UkProductTrafficData } from "./types";

type Props = { snapshot: UkDataSnapshot<UkProductTrafficData> | null; breakdown: UkDataSnapshot<UkProductTrafficBreakdownData> | null; onImport: () => void };
type MetricKind = "money" | "number" | "rate";
type MetricDefinition = { key: string; label: string; kind: MetricKind };
type BreakdownRow = { source: string; sourceKey: UkProductSourceKey | null; metrics: UkMetricMap };

const salesMetrics: MetricDefinition[] = [{ key: "GMV", label: "GMV", kind: "money" }, { key: "商品成交件数", label: "商品成交件数", kind: "number" }];
const trafficMetrics: MetricDefinition[] = [{ key: "预计客户数", label: "预计客户数", kind: "number" }, { key: "商品曝光次数", label: "商品曝光次数", kind: "number" }, { key: "商品点击量", label: "商品点击量", kind: "number" }, { key: "商品点击率", label: "商品点击率", kind: "rate" }];
const allMetrics = [...salesMetrics, ...trafficMetrics];
const sourceOrder: UkProductSourceKey[] = ["merchant-card", "merchant-video", "merchant-live", "affiliate"];
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

function MetricCard({ definition, current, comparison, selected, onToggle }: { definition: MetricDefinition; current: UkMetricMap; comparison: UkMetricMap; selected: boolean; onToggle: () => void }) {
  const value = metric(current, definition.key);
  const change = metric(comparison, definition.key);
  return <button className={`uk-traffic-metric-card ${selected ? "selected" : ""}`} onClick={onToggle}><span className="uk-metric-checkbox">{selected ? "✓" : ""}</span><small>{definition.label}</small><strong>{definition.kind === "money" ? moneyText(value) : definition.kind === "rate" ? percentText(value) : numberText(value)}</strong><em className={growthTone(change)}>{rateText(change)}</em></button>;
}

export default function ProductTrafficPage({ snapshot, breakdown, onImport }: Props) {
  const [source, setSource] = useState<UkProductSourceKey>("all");
  const [mode, setMode] = useState<"page" | "unique">("page");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["GMV", "预计客户数"]);
  const current = snapshot ? sourceMetric(source, snapshot.data) : null;
  const rows = useMemo<BreakdownRow[]>(() => {
    if (!snapshot) return [];
    const primary = snapshot.data.breakdown;
    const fallback = breakdown?.data.rows ?? [];
    const input = (primary.length ? primary : fallback).filter((row) => row.source && Object.values(row.metrics).some((value) => value !== null));
    const channelRows = input.filter((row) => row.source !== "全部");
    const usable = channelRows.length ? channelRows : input;
    return sourceOrder.flatMap((sourceKey): BreakdownRow[] => { const label = ukProductSourceLabels[sourceKey]; const row = usable.find((item) => item.source === label); return row ? [{ ...row, sourceKey }] : []; });
  }, [snapshot, breakdown]);
  const summary = snapshot?.data.sources.all.summary ?? {};
  const total = (name: string): number | null => {
    const official = metric(summary, name);
    if (official !== null) return official;
    return rows.length ? rows.reduce((sum, row) => sum + (metric(row.metrics, name) ?? 0), 0) : null;
  };
  const totalGmv = total("GMV");
  const totalOrders = total("订单数");
  const totalSkuOrders = total("SKU 订单数");
  const exportRows = () => downloadXlsx(`商品流量表现明细_${snapshot ? periodFilePart(snapshot) : "数据"}.xlsx`, [{ key: "source", label: "信息" }, { key: "gmv", label: "GMV", kind: "money" }, { key: "orders", label: "订单数", kind: "number" }, { key: "skuOrders", label: "SKU 订单数", kind: "number" }], rows.map((row) => ({ source: row.source, gmv: metric(row.metrics, "GMV"), orders: metric(row.metrics, "订单数"), skuOrders: metric(row.metrics, "SKU 订单数") })));
  const toggleMetric = (key: string) => setSelectedMetrics((currentMetrics) => currentMetrics.includes(key) ? currentMetrics.filter((item) => item !== key) : currentMetrics.length >= 2 ? [currentMetrics[1], key] : [...currentMetrics, key]);
  if (!snapshot) return <section className="hf-panel uk-real-empty-panel"><h2>商品数据分析 · 商品流量</h2><p>请先导入英国 Seller Center 的“商品数据分析-商品流量.xlsx”。</p><button onClick={onImport}><Download size={14} /> 导入官方 Excel</button></section>;
  if (!current?.available) return <section className="hf-panel uk-real-empty-panel"><h2>商品数据分析 · 商品流量</h2><p>当前导出文件未提供“{ukProductSourceLabels[source]}”来源数据。</p><button onClick={onImport}>重新导入数据</button></section>;
  const funnel = mode === "page" ? { exposure: "商品曝光次数", click: "商品点击量", clickRate: "商品点击率", order: "SKU 订单数", conversion: "CTOR（SKU 订单）" } : { exposure: "去重商品曝光次数", click: "去重点击次数", clickRate: "去重点击率", order: "SKU 订单数", conversion: "去重点击成交转化率（SKU 订单）" };
  const maxFunnel = Math.max(1, metric(current.summary, funnel.exposure) ?? 0);
  const funnelItems = [["商品曝光次数", metric(current.summary, funnel.exposure)], ["商品点击量", metric(current.summary, funnel.click)], ["SKU 订单数", metric(current.summary, funnel.order)]] as Array<[string, number | null]>;
  const renderMetricGroup = (title: string, definitions: MetricDefinition[]) => <div className="uk-traffic-metric-group"><label>{title}</label><div>{definitions.map((definition) => <MetricCard key={definition.key} definition={definition} current={current.summary} comparison={current.comparison} selected={selectedMetrics.includes(definition.key)} onToggle={() => toggleMetric(definition.key)} />)}</div></div>;
  return <section className="hf-panel uk-traffic-page"><div className="uk-traffic-source-tabs">{ukProductSourceKeys.map((item) => <button key={item} className={source === item ? "active" : ""} onClick={() => setSource(item)}>{ukProductSourceLabels[item]}</button>)}</div><section className="uk-traffic-summary"><header><div><h2>关键指标</h2><p>当前周期 {snapshot.startDate} – {snapshot.endDate}{snapshot.data.comparisonStartDate && `　对比 ${snapshot.data.comparisonStartDate} – ${snapshot.data.comparisonEndDate}`}</p></div><Info size={15} /></header>{renderMetricGroup("销量", salesMetrics)}{renderMetricGroup("流量", trafficMetrics)}</section><section className="uk-traffic-trend"><header><div><h2>趋势</h2><p>按日展示当前来源的真实官方数据</p></div><div className="uk-trend-legend">{selectedMetrics.map((name, index) => <span key={name}><i className={index ? "secondary" : ""} />{allMetrics.find((item) => item.key === name)?.label ?? name}</span>)}</div></header><div className="uk-trend-chart"><svg viewBox="0 0 720 180" role="img" aria-label="商品流量趋势图"><line x1="0" y1="20" x2="720" y2="20" /><line x1="0" y1="90" x2="720" y2="90" /><line x1="0" y1="160" x2="720" y2="160" />{selectedMetrics.map((name, index) => <path key={name} className={index ? "secondary" : ""} d={trendPath(current.trend.map((point) => metric(point.metrics, name)), 720, 140)} />)}{current.trend.map((point, index) => <text key={point.date} x={(index / Math.max(1, current.trend.length - 1)) * 720} y="176" textAnchor={index === 0 ? "start" : index === current.trend.length - 1 ? "end" : "middle"}>{point.date.slice(5)}</text>)}</svg></div></section><section className="uk-traffic-funnel"><header><div><h2>流量分析</h2><p>官方漏斗指标</p></div><div className="uk-segmented"><button className={mode === "page" ? "active" : ""} onClick={() => setMode("page")}>页面浏览量</button><button className={mode === "unique" ? "active" : ""} onClick={() => setMode("unique")}>去重访客数</button></div></header><div className="uk-funnel-flow">{funnelItems.map(([label, value], index) => <div className="uk-funnel-step" key={label} style={{ width: `${Math.max(24, ((value ?? 0) / maxFunnel) * 100)}%` }}><span>{label}</span><strong>{numberText(value)}</strong>{index === 0 && <em>商品点击率 {percentText(metric(current.summary, funnel.clickRate))}</em>}</div>)}<div className="uk-funnel-foot"><span>CTOR（SKU 订单）</span><strong>{percentText(metric(current.summary, funnel.conversion))}</strong></div></div></section><section className="uk-traffic-breakdown"><header><div><h2>表现明细</h2><p>按来源拆解当前商品流量</p></div><button className="uk-export-button" onClick={exportRows}><Download size={13} /> 导出数据</button></header><table><thead><tr><th>信息</th><th>GMV</th><th>订单数</th><th>SKU 订单数</th><th>操作</th></tr></thead><tbody>{rows.map((row) => { const gmv = metric(row.metrics, "GMV"); const orders = metric(row.metrics, "订单数"); const skuOrders = metric(row.metrics, "SKU 订单数"); const sourceData = row.sourceKey ? snapshot.data.sources[row.sourceKey] : null; const share = (value: number | null, denominator: number | null) => denominator === null || denominator === 0 || value === null ? null : (value / denominator) * 100; return <tr key={row.source}><td>{row.source}</td><td><small>{percentText(share(gmv, totalGmv))}</small><strong>{moneyText(gmv)}</strong><em className={growthTone(sourceData ? metric(sourceData.comparison, "GMV") : null)}>{rateText(sourceData ? metric(sourceData.comparison, "GMV") : null)}</em></td><td><small>{percentText(share(orders, totalOrders))}</small><strong>{numberText(orders)}</strong><em className={growthTone(sourceData ? metric(sourceData.comparison, "订单数") : null)}>{rateText(sourceData ? metric(sourceData.comparison, "订单数") : null)}</em></td><td><small>{percentText(share(skuOrders, totalSkuOrders))}</small><strong>{numberText(skuOrders)}</strong><em className={growthTone(sourceData ? metric(sourceData.comparison, "SKU 订单数") : null)}>{rateText(sourceData ? metric(sourceData.comparison, "SKU 订单数") : null)}</em></td><td><button onClick={() => row.sourceKey && setSource(row.sourceKey)}>查看详情</button></td></tr>; })}</tbody></table>{!rows.length && <div className="hf-real-empty">当前周期暂无表现明细</div>}</section></section>;
}
