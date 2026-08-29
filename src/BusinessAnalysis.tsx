import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  LineChart,
  PackageSearch,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  deltaSortValue,
  getMetricDelta,
  getPeriodRelation,
  getProductMatchStats,
  indexProducts,
  rateFields,
  selectPreviousBatch,
  selectPreviousProductBatch,
  type BusinessProductDataBatch,
} from "./businessComparison";
import { diagnoseMaintenance, type MaintenanceDiagnostic } from "./businessMaintenance";
import { parseBusinessFiles, parseBusinessProductHistoryFile } from "./businessParser";
import { usePersistedState } from "./persistence";
import type {
  BusinessAnalysisState,
  BusinessBatch,
  BusinessCardMetrics,
  BusinessComparisonMode,
  BusinessMaintenanceFilters,
  BusinessMaintenancePriority,
  BusinessMallMetrics,
  BusinessMetricView,
  BusinessProductFilters,
  BusinessProductHistoryBatch,
  BusinessProductRecord,
  BusinessSortBasis,
  BusinessSortField,
} from "./types";
import { formatCompact, formatCount, formatCurrency } from "./utils";

const defaultFilters = (): BusinessProductFilters => ({
  search: "", publishStatus: "all", sales: "all", cardGmvMin: "", cardGmvMax: "",
  impressionsMin: "", impressionsMax: "", ctrMin: "", ctrMax: "", addToCartRateMin: "",
  addToCartRateMax: "", ctorMin: "", ctorMax: "", mallImpressionsMin: "",
  mallImpressionsMax: "", mallCtrMin: "", mallCtrMax: "",
});
const defaultMaintenanceFilters = (): BusinessMaintenanceFilters => ({ priority: "priority", diagnosis: "all", search: "" });
const defaultKpis: BusinessSortField[] = ["impressions", "customers", "cardGmv", "ctor"];
const defaultCardTrend: Array<keyof BusinessCardMetrics> = ["skuOrders", "impressions"];
const defaultMallTrend = ["gmv", "impressions"] as const;
const coreColumns: BusinessSortField[] = ["impressions", "clicks", "ctr", "customers", "skuOrders", "cardGmv"];

const views: Record<BusinessMetricView, { label: string; description: string; fields: BusinessSortField[] }> = {
  core: { label: "核心", description: "曝光、点击、转化和成交", fields: coreColumns },
  card: { label: "商品卡", description: "完整商品卡指标", fields: ["cardGmv", "skuOrders", "units", "customers", "aov", "impressions", "clicks", "ctr", "addToCarts", "addToCartRate", "ctor"] },
  dedup: { label: "去重", description: "去重流量与转化", fields: ["uniqueImpressions", "uniqueClicks", "uniqueCtr", "addToCartUsers", "uniqueAddToCartRate", "uniqueCtor"] },
  mall: { label: "商城", description: "商城页流量与成交", fields: ["mallImpressions", "mallClicks", "mallUniqueClicks", "mallCustomers", "mallCtr", "mallCtor", "mallGmv", "mallUnits"] },
};
const labels: Record<BusinessSortField, string> = {
  cardGmv: "商品卡 GMV", skuOrders: "SKU订单", units: "商品成交件数", customers: "预计客户数", aov: "AOV",
  impressions: "曝光", clicks: "点击", ctr: "CTR", addToCarts: "加购次数", addToCartRate: "加购率", ctor: "CTOR",
  uniqueImpressions: "去重曝光", uniqueClicks: "去重点击", uniqueCtr: "去重CTR", addToCartUsers: "已加购用户数", uniqueAddToCartRate: "去重加购率", uniqueCtor: "去重CTOR",
  mallImpressions: "商城曝光", mallClicks: "商城点击", mallUniqueClicks: "商城去重点击", mallCustomers: "商城预计客户数", mallCtr: "商城CTR", mallCtor: "商城CTOR", mallGmv: "商城GMV", mallUnits: "商城成交件数",
};
const cardMap: Partial<Record<BusinessSortField, keyof BusinessCardMetrics>> = {
  cardGmv: "gmv", skuOrders: "skuOrders", units: "units", customers: "customers", aov: "aov",
  impressions: "impressions", clicks: "clicks", ctr: "ctr", addToCarts: "addToCarts", addToCartRate: "addToCartRate", ctor: "ctor",
  uniqueImpressions: "uniqueImpressions", uniqueClicks: "uniqueClicks", uniqueCtr: "uniqueCtr", addToCartUsers: "addToCartUsers", uniqueAddToCartRate: "uniqueAddToCartRate", uniqueCtor: "uniqueCtor",
};
const mallMap: Partial<Record<BusinessSortField, keyof BusinessMallMetrics>> = {
  mallImpressions: "impressions", mallClicks: "clicks", mallUniqueClicks: "uniqueClicks", mallCustomers: "customers", mallCtr: "ctr", mallCtor: "ctor", mallGmv: "gmv", mallUnits: "units",
};
const cardTrendLabels: Record<string, string> = {
  gmv: "商品卡 GMV", skuOrders: "SKU订单", units: "商品成交件数", customers: "预计客户数", aov: "AOV",
  impressions: "曝光", clicks: "点击", ctr: "CTR", addToCarts: "加购次数", addToCartRate: "加购率", ctor: "CTOR",
  uniqueImpressions: "去重曝光", uniqueClicks: "去重点击", uniqueCtr: "去重CTR", addToCartUsers: "已加购用户数", uniqueAddToCartRate: "去重加购率", uniqueCtor: "去重CTOR",
};
const mallTrendLabels: Record<string, string> = { gmv: "商城GMV", impressions: "商城曝光", clicks: "商城点击", ctr: "商城CTR", ctor: "商城CTOR" };
const cardTrendOptions = ["gmv", "skuOrders", "impressions", "clicks", "ctr", "addToCartRate", "ctor", "aov"] as const;
const mallTrendOptions = ["gmv", "impressions", "clicks", "ctr", "ctor"] as const;
const maintenanceLabel: Record<BusinessMaintenancePriority, string> = { priority: "重点维护", watch: "值得观察", healthy: "表现健康", insufficient: "数据不足" };

const initialState = (): BusinessAnalysisState => ({
  batches: [], productHistoryBatches: [], activeBatchId: null, activeTab: "overview", filters: defaultFilters(),
  sort: { field: null, direction: null, basis: "current" }, metricView: "core", visibleColumns: [],
  performanceMetrics: defaultKpis, comparisonMode: "current", maintenanceFilters: defaultMaintenanceFilters(),
  cardTrendMetrics: defaultCardTrend, mallTrendMetrics: [...defaultMallTrend],
});
const period = (batch: BusinessProductDataBatch | null) => batch ? `${batch.startDate} 至 ${batch.endDate}` : "—";
const rate = (number: number | null) => number === null ? "—" : `${number.toFixed(number % 1 ? 2 : 0)}%`;
const formatValue = (field: BusinessSortField, number: number | null) => field === "cardGmv" || field === "mallGmv" || field === "aov"
  ? number === null ? "—" : formatCurrency(number)
  : rateFields.has(field) ? rate(number) : number === null ? "—" : formatCompact(number);
const valueFor = (product: BusinessProductRecord, field: BusinessSortField) => cardMap[field] ? product.card[cardMap[field]!] : mallMap[field] ? product.mall[mallMap[field]!] : null;
const inRange = (number: number | null, min: string, max: string) => {
  const lower = min.trim() ? Number(min) : null; const upper = max.trim() ? Number(max) : null;
  return (lower === null || (number !== null && number >= lower)) && (upper === null || (number !== null && number <= upper));
};
const hasFilters = (filters: BusinessProductFilters) => Object.values(filters).some((item) => item !== "" && item !== "all");
function delta(field: BusinessSortField, current: number | null, previous: number | null) {
  const result = getMetricDelta(current, previous, rateFields.has(field));
  if (result.kind === "new") return { text: "新增", tone: "positive" };
  if (result.kind === "percent" || result.kind === "points") return result.value === 0
    ? { text: "持平", tone: "neutral" }
    : { text: `${result.value > 0 ? "↑" : "↓"} ${Math.abs(result.value).toFixed(result.kind === "points" ? 2 : 1)}${result.kind === "points" ? "pp" : "%"}`, tone: result.value > 0 ? "positive" : "negative" };
  return { text: "—", tone: "neutral" };
}

function SortHeader({ field, sort, onSort }: { field: BusinessSortField; sort: BusinessAnalysisState["sort"]; onSort: (field: BusinessSortField) => void }) {
  const active = sort.field === field;
  return <button className={`sort-button${active ? " active" : ""}`} onClick={() => onSort(field)}><span>{labels[field]}</span>{active ? sort.direction === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : <ArrowUpDown size={13} />}</button>;
}

function Kpi({ field, number, previous, selected, onClick }: { field: BusinessSortField; number: number | null; previous?: number | null; selected?: boolean; onClick?: () => void }) {
  const change = previous === undefined ? null : delta(field, number, previous);
  const content = <><span>{labels[field]}</span><strong>{formatValue(field, number)}</strong>{change && <small className={`business-delta ${change.tone}`}>较上期 {change.text}</small>}</>;
  return onClick ? <button className={`business-kpi${selected ? " selected" : ""}`} onClick={onClick}>{content}<i>{selected ? "✓" : "+"}</i></button> : <div className="business-kpi">{content}</div>;
}

const trendUnit = (key: string): "currency" | "rate" | "count" => ["gmv", "aov"].includes(key) ? "currency" : ["ctr", "addToCartRate", "ctor"].includes(key) ? "rate" : "count";
const trendTick = (number: number, unit: ReturnType<typeof trendUnit>) => unit === "currency" ? formatCurrency(number) : unit === "rate" ? rate(number) : formatCompact(number);
function TrendChart({ points, selected, labels: trendLabels, value, history = false }: { points: Array<{ date: string; metrics: BusinessCardMetrics | BusinessMallMetrics }>; selected: readonly string[]; labels: Record<string, string>; value: (metrics: BusinessCardMetrics | BusinessMallMetrics, key: string) => number | null; history?: boolean }) {
  if (!points.length || !selected.length) return <div className="business-chart-empty">没有可展示的{history ? "历史周期" : "每日"}趋势数据。</div>;
  const colors = ["#6659ee", "#2c9d86"];
  const width = 760; const height = 218; const pad = { left: 58, right: 58, top: 14, bottom: 29 };
  const series = selected.map((key, index) => ({ key, color: colors[index], unit: trendUnit(key), values: points.map((point) => value(point.metrics, key)) }));
  const sharedAxis = series.length === 1 || series.every((item) => item.unit === series[0].unit);
  const axisGroups = sharedAxis ? [{ keys: series.map((item) => item.key), unit: series[0].unit, side: "left" as const }] : series.map((item, index) => ({ keys: [item.key], unit: item.unit, side: index ? "right" as const : "left" as const }));
  const axes = axisGroups.map((axis) => {
    const items = series.filter((item) => axis.keys.includes(item.key)).flatMap((item) => item.values.filter((value): value is number => value !== null));
    const low = items.length ? Math.min(...items) : 0; const high = items.length ? Math.max(...items) : 1; const distance = high - low || Math.max(Math.abs(high) * .2, 1);
    return { ...axis, min: low - distance * .08, max: high + distance * .08 };
  });
  const axisFor = (key: string) => axes.find((axis) => axis.keys.includes(key))!;
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(points.length - 1, 1));
  const y = (key: string, number: number) => { const axis = axisFor(key); return pad.top + ((axis.max - number) / (axis.max - axis.min)) * (height - pad.top - pad.bottom); };
  const chunks = (key: string, values: Array<number | null>) => {
    const result: string[] = []; let chunk: string[] = [];
    values.forEach((item, index) => { if (item === null) { if (chunk.length) result.push(chunk.join(" ")); chunk = []; } else chunk.push(`${x(index)},${y(key, item)}`); });
    if (chunk.length) result.push(chunk.join(" ")); return result;
  };
  return <div className="business-chart"><div className="business-chart-legend">{series.map((item, index) => <span key={item.key}><i style={{ background: item.color }} />{trendLabels[item.key]}{!sharedAxis && `（${index ? "右" : "左"}轴）`}</span>)}<small>{history ? "一个周期一个数据点" : "每日数据；空值不连线"}</small></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={history ? "历史周期趋势" : "每日趋势"}>{Array.from({ length: 5 }, (_, index) => { const ratio = index / 4; const left = axes[0]; const lineY = pad.top + ratio * (height - pad.top - pad.bottom); return <g key={index}><line className="business-chart-grid" x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} /><text x={pad.left - 7} y={lineY + 3} textAnchor="end">{trendTick(left.max - (left.max - left.min) * ratio, left.unit)}</text>{axes[1] && <text x={width - pad.right + 7} y={lineY + 3}>{trendTick(axes[1].max - (axes[1].max - axes[1].min) * ratio, axes[1].unit)}</text>}</g>; })}{series.flatMap((item) => chunks(item.key, item.values).map((pointsString, index) => <polyline key={`${item.key}-${index}`} points={pointsString} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />))}{points.map((point, index) => <text key={`${point.date}-${index}`} x={x(index)} y={height - 7} textAnchor="middle">{point.date.slice(5)}</text>)}</svg></div>;
}

function Funnel({ impressions, clicks, ctr, ctor, orders, carts, cartRate }: { impressions: number | null; clicks: number | null; ctr: number | null; ctor: number | null; orders: number | null; carts: number | null; cartRate: number | null }) {
  return <section className="business-funnel"><div className="business-panel-heading"><div><h2>商品卡流量分析</h2><p>商品曝光 → 点击 → SKU订单</p></div></div><div className="business-funnel-body"><div className="business-funnel-rates"><span>CTR<strong>{rate(ctr)}</strong></span><span>CTOR<strong>{rate(ctor)}</strong></span></div><div className="business-funnel-steps"><div><b>商品曝光</b><strong>{formatValue("impressions", impressions)}</strong></div><i>↓</i><div><b>商品点击</b><strong>{formatValue("clicks", clicks)}</strong></div><i>↓</i><div><b>SKU订单</b><strong>{formatValue("skuOrders", orders)}</strong></div></div><aside><span>加购次数</span><strong>{formatValue("addToCarts", carts)}</strong><span>加购率</span><strong>{rate(cartRate)}</strong></aside></div></section>;
}

function MallSummary({ batch, previous }: { batch: BusinessBatch; previous: BusinessBatch | null }) {
  const fields: BusinessSortField[] = ["mallImpressions", "mallClicks", "mallCtr", "mallCtor", "mallGmv", "mallUnits"];
  return <section className="business-mall-summary"><div className="business-panel-heading"><div><h2>商城表现</h2><p>仅使用商城页字段。</p></div></div><div className="business-mall-summary-grid">{fields.map((field) => <Kpi key={field} field={field} number={batch.shopMallSummary[mallMap[field]!]} previous={previous ? previous.shopMallSummary[mallMap[field]!] : undefined} />)}</div><div className="business-mall-funnel"><span>商城曝光<strong>{formatValue("mallImpressions", batch.shopMallSummary.impressions)}</strong></span><i>→</i><span>商城点击<strong>{formatValue("mallClicks", batch.shopMallSummary.clicks)}</strong></span><i>→</i><span>商城成交件数<strong>{formatValue("mallUnits", batch.shopMallSummary.units)}</strong></span></div></section>;
}

function ConfigPopover({ fields, selected, onToggle, onClose, title, text }: { fields: BusinessSortField[]; selected: BusinessSortField[]; onToggle: (field: BusinessSortField) => void; onClose: () => void; title: string; text: string }) {
  return <div className="business-popover"><div><strong>{title}</strong><button aria-label="关闭" onClick={onClose}><X size={14} /></button></div><p>{text}</p><section>{fields.map((field) => <label key={field}><input type="checkbox" checked={selected.includes(field)} onChange={() => onToggle(field)} />{labels[field]}</label>)}</section></div>;
}

function Performance({ batch, fullPrevious, productPrevious, kpis, trend, mallTrend, onKpi, onTrend, onMall, kpiMenu, setKpiMenu }: { batch: BusinessBatch; fullPrevious: BusinessBatch | null; productPrevious: BusinessProductDataBatch | null; kpis: BusinessSortField[]; trend: Array<keyof BusinessCardMetrics>; mallTrend: readonly string[]; onKpi: (field: BusinessSortField) => void; onTrend: (field: keyof BusinessCardMetrics) => void; onMall: (key: string) => void; kpiMenu: boolean; setKpiMenu: (next: boolean) => void }) {
  return <div className="business-page-flow"><section className="business-analysis-panel"><div className="business-panel-heading business-kpi-panel-heading"><div><span className="business-section-kicker">商品卡</span><h2>关键指标</h2><p>点击指标卡选择每日趋势，最多同时比较 2 项。</p></div><div className="business-config-wrap"><button className="business-tool-button" onClick={() => setKpiMenu(!kpiMenu)}><Settings2 size={15} /> 配置指标</button>{kpiMenu && <ConfigPopover title="配置关键指标" text="最多展示 4 项。" fields={Object.keys(cardMap) as BusinessSortField[]} selected={kpis} onToggle={onKpi} onClose={() => setKpiMenu(false)} />}</div></div><div className="business-kpi-grid business-performance-kpis">{kpis.map((field) => <Kpi key={field} field={field} number={batch.shopCardSummary[cardMap[field]!]} previous={fullPrevious ? fullPrevious.shopCardSummary[cardMap[field]!] : undefined} selected={trend.includes(cardMap[field]!)} onClick={() => onTrend(cardMap[field]!)} />)}</div><div className="business-inline-trend"><div className="business-panel-heading"><div><h3>商品卡每日趋势</h3><p>当前选择：{trend.map((key) => cardTrendLabels[key]).join("、")}</p></div></div><TrendChart points={batch.shopCardTrend} selected={trend} labels={cardTrendLabels} value={(data, key) => (data as BusinessCardMetrics)[key as keyof BusinessCardMetrics]} /></div></section>{productPrevious && !fullPrevious && <div className="notice info-notice business-comparison-notice"><AlertTriangle size={16} /><span>已导入商品级上期数据；店铺整体商品卡/商城上期数据尚未导入。</span></div>}<div className="business-analysis-split"><Funnel impressions={batch.shopCardSummary.impressions} clicks={batch.shopCardSummary.clicks} ctr={batch.shopCardSummary.ctr} ctor={batch.shopCardSummary.ctor} orders={batch.shopCardSummary.skuOrders} carts={batch.shopCardSummary.addToCarts} cartRate={batch.shopCardSummary.addToCartRate} /><MallSummary batch={batch} previous={fullPrevious} /></div><section className="business-chart-section"><div className="business-panel-heading"><div><h2>商城每日趋势</h2><p>最多同时选择 2 项。</p></div><div className="business-small-choices">{mallTrendOptions.map((key) => <button key={key} className={mallTrend.includes(key) ? "active" : ""} onClick={() => onMall(key)}>{mallTrendLabels[key]}</button>)}</div></div><TrendChart points={batch.shopMallTrend} selected={mallTrend} labels={mallTrendLabels} value={(data, key) => (data as BusinessMallMetrics)[key as keyof BusinessMallMetrics]} /></section></div>;
}

function ProductDetail({ product, previous, batches, onBack }: { product: BusinessProductRecord; previous?: BusinessProductRecord; batches: BusinessProductDataBatch[]; onBack: () => void }) {
  const [selected, setSelected] = useState<Array<keyof BusinessCardMetrics>>(defaultCardTrend);
  const history = useMemo(() => batches.filter((batch) => batch.products.some((item) => item.productId === product.productId)).sort((left, right) => left.endDate.localeCompare(right.endDate)).map((batch) => ({ date: batch.endDate, metrics: batch.products.find((item) => item.productId === product.productId)!.card })), [batches, product.productId]);
  const toggle = (field: keyof BusinessCardMetrics) => setSelected((current) => current.includes(field) ? current.length === 1 ? current : current.filter((item) => item !== field) : current.length >= 2 ? current : [...current, field]);
  const detailKpis = (fields: BusinessSortField[]) => <div className={`business-detail-metrics detail-${fields.length}`}>{fields.map((field) => <Kpi key={field} field={field} number={valueFor(product, field)} previous={previous ? valueFor(previous, field) : undefined} selected={Boolean(cardMap[field] && selected.includes(cardMap[field]!))} onClick={cardMap[field] ? () => toggle(cardMap[field]!) : undefined} />)}</div>;
  const historyContent = history.length >= 3 ? <TrendChart history points={history} selected={selected} labels={cardTrendLabels} value={(data, key) => (data as BusinessCardMetrics)[key as keyof BusinessCardMetrics]} /> : history.length === 2 ? <div className="business-two-period"><span><small>{history[0].date}</small><strong>{formatValue("skuOrders", history[0].metrics.skuOrders)} SKU订单</strong></span><i>→</i><span><small>{history[1].date}</small><strong>{formatValue("skuOrders", history[1].metrics.skuOrders)} SKU订单</strong></span><p>已匹配两个历史周期；继续导入后可展示周期趋势。</p></div> : <div className="business-history-insufficient"><LineChart size={17} /><span>历史数据不足：当前仅 1 个周期，已保留当前商品指标。</span></div>;
  return <section className="business-detail"><button className="business-back-button" onClick={onBack}><ArrowLeft size={16} /> 返回商品列表</button><header className="business-product-detail-head"><div><span>商品详情</span><h2>{product.name}</h2><p>Product ID：{product.productId}　·　{product.publishStatus || "发品状态未提供"}　·　{product.gmvRange || "GMV区间未提供"}</p></div><a className="compact-import-button" href={`https://shop.tiktok.com/view/product/${product.productId}?region=GB&locale=en-GB&source=seller_center`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 打开 TikTok 商品</a></header><section className="business-detail-analysis-panel"><div className="business-panel-heading"><div><h2>关键指标</h2><p>点击流量或销量指标卡选择历史周期趋势，最多 2 项。</p></div></div><div className="business-detail-group"><span>销量</span>{detailKpis(["cardGmv", "skuOrders", "units", "aov"])}</div><div className="business-detail-group"><span>流量</span>{detailKpis(["impressions", "clicks", "ctr", "customers", "addToCarts", "addToCartRate", "ctor"])}</div><div className="business-history-inline"><div className="business-panel-heading"><div><h3>历史周期趋势</h3><p>一个保存周期对应一个数据点。</p></div></div>{historyContent}</div></section><div className="business-detail-split"><Funnel impressions={product.card.impressions} clicks={product.card.clicks} ctr={product.card.ctr} ctor={product.card.ctor} orders={product.card.skuOrders} carts={product.card.addToCarts} cartRate={product.card.addToCartRate} /><section className="business-mall-summary"><div className="business-panel-heading"><div><h2>商城表现</h2><p>当前商品的商城页字段。</p></div></div><div className="business-mall-summary-grid">{(["mallImpressions", "mallClicks", "mallCtr", "mallCtor", "mallGmv", "mallUnits"] as BusinessSortField[]).map((field) => <Kpi key={field} field={field} number={valueFor(product, field)} previous={previous ? valueFor(previous, field) : undefined} />)}</div></section></div></section>;
}

function Products({ list, statuses, columns, view, viewMenu, setViewMenu, comparison, previousBatch, previousProducts, filters, advanced, setAdvanced, setFilter, setView, setComparison, sort, sortBasis, setBasis, onSort, clear, open }: { list: BusinessProductRecord[]; statuses: string[]; columns: BusinessSortField[]; view: BusinessMetricView; viewMenu: boolean; setViewMenu: (next: boolean) => void; comparison: BusinessComparisonMode; previousBatch: BusinessProductDataBatch | null; previousProducts: Map<string, BusinessProductRecord>; filters: BusinessProductFilters; advanced: boolean; setAdvanced: (next: boolean) => void; setFilter: <K extends keyof BusinessProductFilters>(key: K, value: BusinessProductFilters[K]) => void; setView: (view: BusinessMetricView) => void; setComparison: (mode: BusinessComparisonMode) => void; sort: BusinessAnalysisState["sort"]; sortBasis: BusinessSortBasis; setBasis: (basis: BusinessSortBasis) => void; onSort: (field: BusinessSortField) => void; clear: () => void; open: (id: string) => void }) {
  const ranges: Array<[string, keyof BusinessProductFilters, keyof BusinessProductFilters]> = [["商品卡 GMV", "cardGmvMin", "cardGmvMax"], ["曝光", "impressionsMin", "impressionsMax"], ["CTR（%）", "ctrMin", "ctrMax"], ["加购率（%）", "addToCartRateMin", "addToCartRateMax"], ["CTOR（%）", "ctorMin", "ctorMax"], ["商城曝光", "mallImpressionsMin", "mallImpressionsMax"], ["商城CTR（%）", "mallCtrMin", "mallCtrMax"]];
  return <div className="business-page-flow"><section className="business-list-heading"><div><span className="business-section-kicker">商品卡</span><h2>商品详情</h2><p>Product ID 是跨周期匹配主键。</p></div></section><section className="business-list-toolbar"><div className="search-input"><Search size={15} /><input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="搜索商品名 / Product ID" /></div><div className="select-wrap"><select value={filters.publishStatus} onChange={(event) => setFilter("publishStatus", event.target.value)}><option value="all">全部发品状态</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={15} /></div><div className="select-wrap"><select value={filters.sales} onChange={(event) => setFilter("sales", event.target.value as BusinessProductFilters["sales"])}><option value="all">全部成交情况</option><option value="with-sales">有成交</option><option value="without-sales">无成交</option></select><ChevronDown size={15} /></div><button className={`business-tool-button${advanced ? " active" : ""}`} onClick={() => setAdvanced(!advanced)}><Filter size={15} /> 筛选</button><div className="business-value-mode"><button className={comparison === "current" ? "active" : ""} onClick={() => setComparison("current")}>当前值</button><button disabled={!previousBatch} className={comparison === "comparison" ? "active" : ""} onClick={() => setComparison("comparison")}>对比上期</button></div><div className="business-config-wrap"><button className="business-tool-button" onClick={() => setViewMenu(!viewMenu)}><SlidersHorizontal size={15} /> 配置指标</button>{viewMenu && <div className="business-popover metric-view-popover"><div><strong>配置指标</strong><button aria-label="关闭" onClick={() => setViewMenu(false)}><X size={14} /></button></div><p>切换后会立即改变表格列。</p><section>{(Object.keys(views) as BusinessMetricView[]).map((item) => <button className={view === item ? "active" : ""} key={item} onClick={() => { setView(item); setViewMenu(false); }}><strong>{views[item].label}</strong><span>{views[item].description}</span></button>)}</section></div>}</div>{previousBatch && <div className="business-sort-basis"><button className={sortBasis === "current" ? "active" : ""} onClick={() => setBasis("current")}>按当前值</button><button className={sortBasis === "change" ? "active" : ""} onClick={() => setBasis("change")}>按变化</button></div>}</section>{advanced && <section className="business-advanced-filters"><div>{ranges.map(([label, min, max]) => <div className="business-range" key={label}><label>{label}</label><div><input value={filters[min] as string} onChange={(event) => setFilter(min, event.target.value)} placeholder="最小" /><span>至</span><input value={filters[max] as string} onChange={(event) => setFilter(max, event.target.value)} placeholder="最大" /></div></div>)}</div><button className="text-button" onClick={clear}><RefreshCw size={14} /> 清除筛选</button></section>}<section className="business-products-table-wrap"><table className={`business-product-table metric-view-${view}`} data-sort-field={sort.field ?? undefined}><thead><tr><th className="business-product-name">商品</th>{columns.map((field) => <th key={field} className={sort.field === field ? "business-active-sort" : ""}><SortHeader field={field} sort={sort} onSort={onSort} /></th>)}<th>详情</th></tr></thead><tbody>{list.map((product) => <tr key={product.productId}><td className="business-product-name"><strong>{product.name}</strong><span>Product ID：{product.productId}</span><em>{product.publishStatus || "未填写"}</em></td>{columns.map((field) => { const older = previousProducts.get(product.productId); const change = older ? delta(field, valueFor(product, field), valueFor(older, field)) : { text: "新增", tone: "positive" }; return <td key={field} className={sort.field === field ? "business-active-sort" : ""}>{comparison === "comparison" ? <div className="business-comparison-cell"><strong>{formatValue(field, valueFor(product, field))}</strong><small className={`business-delta ${change.tone}`}>{change.text}</small></div> : formatValue(field, valueFor(product, field))}</td>; })}<td><button className="business-detail-link" onClick={() => open(product.productId)}>详情</button></td></tr>)}</tbody></table>{!list.length && <div className="no-results"><PackageSearch size={20} /><strong>没有符合条件的商品</strong></div>}</section></div>;
}

function Maintenance({ batch, previous, diagnostics, filters, setFilters, open }: { batch: BusinessBatch; previous: BusinessProductDataBatch | null; diagnostics: MaintenanceDiagnostic[]; filters: BusinessMaintenanceFilters; setFilters: (patch: Partial<BusinessMaintenanceFilters>) => void; open: (id: string) => void }) {
  if (!previous) return <section className="business-empty-guide"><LineChart size={19} /><div><strong>导入历史商品数据后，可启用趋势维护建议。</strong><p>当前缺少历史商品数据，维护中心只能进行店内横向判断。</p></div></section>;
  const products = new Map(batch.products.map((product) => [product.productId, product]));
  const query = filters.search.trim().toLowerCase();
  const list = diagnostics.filter((item) => (filters.priority === "all" || item.priority === filters.priority) && (!query || products.get(item.productId)?.name.toLowerCase().includes(query) || item.productId.toLowerCase().includes(query)));
  return <div className="business-page-flow"><section className="business-list-heading"><div><span className="business-section-kicker">维护</span><h2>维护建议</h2><p>保留既有诊断规则，紧凑展示证据与检查方向。</p></div></section><section className="business-maintenance-tools"><div className="search-input"><Search size={15} /><input value={filters.search} onChange={(event) => setFilters({ search: event.target.value })} placeholder="搜索商品名 / Product ID" /></div><div className="select-wrap"><select value={filters.priority} onChange={(event) => setFilters({ priority: event.target.value as BusinessMaintenanceFilters["priority"] })}><option value="all">全部优先级</option>{(["priority", "watch", "healthy", "insufficient"] as BusinessMaintenancePriority[]).map((item) => <option key={item} value={item}>{maintenanceLabel[item]}</option>)}</select><ChevronDown size={15} /></div></section><section className="business-maintenance-list">{list.map((item) => { const product = products.get(item.productId); return product && <article key={item.productId}><div className="maintenance-product"><strong>{product.name}</strong><small>Product ID：{item.productId}</small></div><div><span className={`maintenance-priority ${item.priority}`}>{maintenanceLabel[item.priority]}</span><b>{item.primaryDiagnosis}</b></div><div className="maintenance-evidence">{item.evidence.slice(0, 2).map((evidence) => <span key={evidence}>{evidence}</span>)}</div><p>{item.explanation}</p><button onClick={() => open(item.productId)}>查看详情</button></article>; })}{!list.length && <div className="no-results"><PackageSearch size={20} /><strong>没有符合条件的维护项</strong></div>}</section></div>;
}

export default function BusinessAnalysis({ hidden = false }: { hidden?: boolean }) {
  const fullInput = useRef<HTMLInputElement>(null); const historyInput = useRef<HTMLInputElement>(null);
  const [state, setState, restored] = usePersistedState<BusinessAnalysisState>("business-analysis", initialState);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [pending, setPending] = useState<BusinessBatch | null>(null); const [pendingHistory, setPendingHistory] = useState<BusinessProductHistoryBatch | null>(null); const [detailId, setDetailId] = useState<string | null>(null); const [advanced, setAdvanced] = useState(false); const [kpiMenu, setKpiMenu] = useState(false); const [viewMenu, setViewMenu] = useState(false);
  const update = (action: (current: BusinessAnalysisState) => BusinessAnalysisState) => setState((current) => action(current));
  const batch = state.batches.find((item) => item.id === state.activeBatchId) ?? state.batches[0] ?? null;
  const fullPrevious = useMemo(() => selectPreviousBatch(state.batches, batch), [state.batches, batch]);
  const productPrevious = useMemo(() => selectPreviousProductBatch(state.batches, state.productHistoryBatches ?? [], batch), [state.batches, state.productHistoryBatches, batch]);
  const previousProducts = useMemo(() => indexProducts(productPrevious), [productPrevious]);
  const allProductBatches = useMemo(() => [...state.batches, ...(state.productHistoryBatches ?? [])] as BusinessProductDataBatch[], [state.batches, state.productHistoryBatches]);
  const selectedProduct = batch?.products.find((item) => item.productId === detailId) ?? null;
  const metricView = state.metricView ?? "core"; const kpis = state.performanceMetrics?.length ? state.performanceMetrics : defaultKpis; const cardTrend = state.cardTrendMetrics?.length ? state.cardTrendMetrics : defaultCardTrend; const mallTrend = state.mallTrendMetrics?.length ? state.mallTrendMetrics : defaultMallTrend;
  const comparison: BusinessComparisonMode = productPrevious && state.comparisonMode === "comparison" ? "comparison" : "current";
  const sortBasis: BusinessSortBasis = productPrevious && state.sort.basis === "change" ? "change" : "current";
  const statuses = useMemo(() => batch ? [...new Set(batch.products.map((item) => item.publishStatus).filter(Boolean))].sort() : [], [batch]);
  const list = useMemo(() => { if (!batch) return []; const filters = state.filters; const query = filters.search.trim().toLowerCase(); return [...batch.products].filter((product) => { const orders = product.card.skuOrders ?? 0; const salesMatch = filters.sales === "all" || (filters.sales === "with-sales" ? orders > 0 : orders <= 0); return (!query || product.name.toLowerCase().includes(query) || product.productId.toLowerCase().includes(query)) && (filters.publishStatus === "all" || product.publishStatus === filters.publishStatus) && salesMatch && inRange(product.card.gmv, filters.cardGmvMin, filters.cardGmvMax) && inRange(product.card.impressions, filters.impressionsMin, filters.impressionsMax) && inRange(product.card.ctr, filters.ctrMin, filters.ctrMax) && inRange(product.card.addToCartRate, filters.addToCartRateMin, filters.addToCartRateMax) && inRange(product.card.ctor, filters.ctorMin, filters.ctorMax) && inRange(product.mall.impressions, filters.mallImpressionsMin, filters.mallImpressionsMax) && inRange(product.mall.ctr, filters.mallCtrMin, filters.mallCtrMax); }).sort((left, right) => { if (!state.sort.field || !state.sort.direction) return left.originalIndex - right.originalIndex; const ranking = (item: BusinessProductRecord) => sortBasis === "current" ? valueFor(item, state.sort.field!) : previousProducts.has(item.productId) ? deltaSortValue(valueFor(item, state.sort.field!), valueFor(previousProducts.get(item.productId)!, state.sort.field!), rateFields.has(state.sort.field!)) : null; const a = ranking(left); const b = ranking(right); if (a === null && b === null) return left.originalIndex - right.originalIndex; if (a === null) return 1; if (b === null) return -1; return state.sort.direction === "desc" ? b - a : a - b; }); }, [batch, state.filters, state.sort, sortBasis, previousProducts]);
  const maintenance = useMemo(() => batch ? diagnoseMaintenance(batch, productPrevious) : null, [batch, productPrevious]);
  const maintenanceFilters = state.maintenanceFilters ?? defaultMaintenanceFilters();
  const match = batch ? getProductMatchStats(batch, productPrevious) : null; const relation = batch && productPrevious ? getPeriodRelation(batch, productPrevious) : null;
  useEffect(() => { if (!restored || !maintenance || maintenanceFilters.priority !== "priority") return; const priorityCount = maintenance.diagnostics.filter((item) => item.priority === "priority").length; const watchCount = maintenance.diagnostics.filter((item) => item.priority === "watch").length; const fallback = priorityCount ? "priority" : watchCount ? "watch" : "all"; if (fallback !== maintenanceFilters.priority) update((current) => ({ ...current, maintenanceFilters: { ...maintenanceFilters, priority: fallback } })); }, [restored, batch?.id, maintenance?.diagnostics, maintenanceFilters]);
  const setFilter = <K extends keyof BusinessProductFilters>(key: K, value: BusinessProductFilters[K]) => update((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
  const importFull = async (files: FileList | File[]) => { setError(""); setLoading(true); try { const next = await parseBusinessFiles(Array.from(files)); state.batches.some((item) => item.startDate === next.startDate && item.endDate === next.endDate) ? setPending(next) : update((current) => ({ ...current, batches: [...current.batches, next], activeBatchId: next.id })); } catch (caught) { setError(caught instanceof Error ? caught.message : "文件解析失败，请检查三份 Excel。"); } finally { setLoading(false); if (fullInput.current) fullInput.current.value = ""; } };
  const importHistory = async (files: FileList | File[]) => { setError(""); setLoading(true); try { const file = Array.from(files)[0]; if (!file) return; const next = await parseBusinessProductHistoryFile(file); (state.productHistoryBatches ?? []).some((item) => item.startDate === next.startDate && item.endDate === next.endDate) ? setPendingHistory(next) : update((current) => ({ ...current, productHistoryBatches: [...(current.productHistoryBatches ?? []), next] })); } catch (caught) { setError(caught instanceof Error ? caught.message : "文件解析失败，请选择商品数据 Excel。"); } finally { setLoading(false); if (historyInput.current) historyInput.current.value = ""; } };
  const replaceFull = () => pending && update((current) => ({ ...current, batches: current.batches.map((item) => item.startDate === pending.startDate && item.endDate === pending.endDate ? pending : item), activeBatchId: pending.id }));
  const replaceHistory = () => pendingHistory && update((current) => ({ ...current, productHistoryBatches: (current.productHistoryBatches ?? []).map((item) => item.startDate === pendingHistory.startDate && item.endDate === pendingHistory.endDate ? pendingHistory : item) }));
  const toggleCardTrend = (key: keyof BusinessCardMetrics) => update((current) => { const items = current.cardTrendMetrics?.length ? current.cardTrendMetrics : defaultCardTrend; return { ...current, cardTrendMetrics: items.includes(key) ? items.length === 1 ? items : items.filter((item) => item !== key) : items.length >= 2 ? items : [...items, key] }; });
  const toggleMallTrend = (key: string) => update((current) => { const items = current.mallTrendMetrics?.length ? current.mallTrendMetrics : [...defaultMallTrend]; return { ...current, mallTrendMetrics: items.includes(key as never) ? items.length === 1 ? items : items.filter((item) => item !== key) : items.length >= 2 ? items : [...items, key] as typeof current.mallTrendMetrics }; });
  const toggleKpi = (field: BusinessSortField) => update((current) => { const items = current.performanceMetrics?.length ? current.performanceMetrics : defaultKpis; return { ...current, performanceMetrics: items.includes(field) ? items.length === 1 ? items : items.filter((item) => item !== field) : items.length >= 4 ? items : [...items, field] }; });
  const importButtons = <div className="business-import-actions"><button className="compact-import-button" onClick={() => fullInput.current?.click()}><CloudUpload size={15} /> {loading ? "正在解析…" : "导入本期数据"}</button><button className="compact-import-button" onClick={() => historyInput.current?.click()}><FileSpreadsheet size={15} /> 导入历史商品数据</button></div>;
  return <main className="workspace business-workspace seller-business" hidden={hidden} aria-hidden={hidden}><header className="business-page-header"><div><div className="eyebrow"><span className="eyebrow-line" /> BUSINESS ANALYTICS</div><h1>经营分析</h1><p>商品卡与商城页经营数据，本地解析保存。</p></div><div className="privacy-note"><CheckCircle2 size={16} /> 数据仅在浏览器本地保存</div></header>{!batch ? <section className="business-import-empty"><div><FileSpreadsheet size={22} /><div><span>经营数据</span><h2>导入 TikTok Shop 官方 Excel</h2><p>本期需一次导入商品数据、商品卡专项和全部流量三份文件。</p></div></div>{importButtons}</section> : <div className="business-layout"><aside className="business-side-nav"><section><span>商品卡</span><button className={state.activeTab === "overview" ? "active" : ""} onClick={() => update((current) => ({ ...current, activeTab: "overview" }))}>表现</button><button className={state.activeTab === "products" ? "active" : ""} onClick={() => update((current) => ({ ...current, activeTab: "products" }))}>商品详情</button></section><section><span>维护</span><button className={state.activeTab === "maintenance" ? "active" : ""} onClick={() => update((current) => ({ ...current, activeTab: "maintenance" }))}>维护建议</button></section></aside><div className="business-main-content"><section className="business-context-bar"><div><span>当前周期</span><strong>{period(batch)}</strong>{productPrevious && <><i>对比周期</i><strong>{period(productPrevious)}</strong></>}<span className="business-complete-badge"><CheckCircle2 size={13} /> 三份官方数据源完整</span></div>{importButtons}</section>{state.batches.length > 1 && <div className="business-period-switcher">{state.batches.map((item) => <button key={item.id} className={item.id === batch.id ? "active" : ""} onClick={() => { update((current) => ({ ...current, activeBatchId: item.id })); setDetailId(null); }}>{period(item)}</button>)}</div>}{error && <div className="notice error-notice"><AlertTriangle size={16} /><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}{pending && <div className="notice info-notice"><AlertTriangle size={16} /><span>{period(pending)} 已有完整批次，是否替换？</span><button className="text-button" onClick={() => { replaceFull(); setPending(null); }}>替换</button><button className="text-button" onClick={() => setPending(null)}>取消</button></div>}{pendingHistory && <div className="notice info-notice"><AlertTriangle size={16} /><span>{period(pendingHistory)} 已有历史商品数据，是否替换？</span><button className="text-button" onClick={() => { replaceHistory(); setPendingHistory(null); }}>替换</button><button className="text-button" onClick={() => setPendingHistory(null)}>取消</button></div>}{relation?.kind === "overlap" && <div className="notice info-notice business-comparison-notice"><AlertTriangle size={16} /><span>当前周期与对比周期重叠 {relation.days} 天，本次变化仅供参考。</span></div>}{relation?.kind === "gap" && <div className="notice info-notice business-comparison-notice"><AlertTriangle size={16} /><span>当前周期与对比周期之间间隔 {relation.days} 天，本次变化仅供参考。</span></div>}{selectedProduct ? <ProductDetail product={selectedProduct} previous={previousProducts.get(selectedProduct.productId)} batches={allProductBatches} onBack={() => setDetailId(null)} /> : state.activeTab === "overview" ? <Performance batch={batch} fullPrevious={fullPrevious} productPrevious={productPrevious} kpis={kpis} trend={cardTrend} mallTrend={mallTrend} onKpi={toggleKpi} onTrend={toggleCardTrend} onMall={toggleMallTrend} kpiMenu={kpiMenu} setKpiMenu={setKpiMenu} /> : state.activeTab === "products" ? <Products list={list} statuses={statuses} columns={views[metricView].fields} view={metricView} viewMenu={viewMenu} setViewMenu={setViewMenu} comparison={comparison} previousBatch={productPrevious} previousProducts={previousProducts} filters={state.filters} advanced={advanced} setAdvanced={setAdvanced} setFilter={setFilter} setView={(metricView) => update((current) => ({ ...current, metricView }))} setComparison={(comparisonMode) => update((current) => ({ ...current, comparisonMode }))} sort={state.sort} sortBasis={sortBasis} setBasis={(basis) => update((current) => ({ ...current, sort: { ...current.sort, basis } }))} onSort={(field) => update((current) => ({ ...current, sort: current.sort.field !== field ? { field, direction: "desc", basis: sortBasis } : current.sort.direction === "desc" ? { field, direction: "asc", basis: sortBasis } : { field: null, direction: null, basis: sortBasis } }))} clear={() => update((current) => ({ ...current, filters: defaultFilters() }))} open={setDetailId} /> : <Maintenance batch={batch} previous={productPrevious} diagnostics={maintenance?.diagnostics ?? []} filters={maintenanceFilters} setFilters={(patch) => update((current) => ({ ...current, maintenanceFilters: { ...maintenanceFilters, ...patch } }))} open={setDetailId} />}{state.activeTab === "products" && match?.comparable && <p className="business-match-note">当前 {match.current} 个商品 · 已匹配 {match.matched} · 本期新增 {match.added} · 上期消失 {match.missing}</p>}</div></div>}<input ref={fullInput} type="file" multiple accept=".xlsx,.xls" hidden onChange={(event) => void importFull(event.target.files ?? [])} /><input ref={historyInput} type="file" accept=".xlsx,.xls" hidden onChange={(event) => void importHistory(event.target.files ?? [])} /></main>;
}
