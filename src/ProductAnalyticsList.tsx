import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Filter, MoreVertical, PencilLine, Search, SlidersHorizontal, X } from "lucide-react";
import { buildProductHistoryBatches, findPreviousProductPeriod, getMetricDelta, getProductHistory, indexProducts, type BusinessProductDataBatch } from "./businessComparison";
import ProductThumbnail from "./ProductThumbnail";
import type { BusinessBatch, BusinessProductHistoryBatch, BusinessProductRecord } from "./types";

type ProductMode = "product" | "sku";
type ProductFilters = { status: "all" | "on-sale" | "off-sale"; sales: "all" | "with-sales" | "without-sales"; gmvMin: string; gmvMax: string; impressionsMin: string; impressionsMax: string };
type ProductSortField = "gmv" | "orders" | "skuOrders" | "units";
type SortDirection = "asc" | "desc" | null;
type ProductInsight = "all" | "growth" | "decline" | "new" | "with-sales" | "without-sales" | "traffic-no-sales";
type DetailMetricKey = "gmv" | "orders" | "skuOrders" | "units" | "aov" | "customers" | "impressions" | "clicks" | "ctr" | "addToCarts" | "addToCartRate" | "ctor";
type DetailMetric = { key: DetailMetricKey; group: "销量" | "流量"; label: string; value: number | null; format: "money" | "count" | "rate" };
type Change = { text: string; tone: "positive" | "down" | "flat" };

const defaultProductFilters: ProductFilters = { status: "all", sales: "all", gmvMin: "", gmvMax: "", impressionsMin: "", impressionsMax: "" };
const insightLabels: Record<ProductInsight, string> = { all: "全部", growth: "增长明显", decline: "下降明显", new: "新增", "with-sales": "有成交", "without-sales": "无成交", "traffic-no-sales": "有流量无成交" };
const historyDependentInsights = new Set<ProductInsight>(["growth", "decline", "new"]);
const formatCount = (value: number | null): string => value === null ? "--" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const formatMoney = (value: number | null, currencySymbol: string): string => value === null ? "--" : `${currencySymbol || ""}${value.toFixed(2)}`;
const formatRate = (value: number | null): string => value === null ? "--" : `${value.toFixed(2)}%`;
const formatMetric = (metric: DetailMetric, currency: string): string => metric.format === "money" ? formatMoney(metric.value, currency) : metric.format === "rate" ? formatRate(metric.value) : formatCount(metric.value);
const numberFilter = (value: number | null, min: string, max: string): boolean => {
  if (value === null) return !min && !max;
  const lower = min.trim() ? Number(min) : null;
  const upper = max.trim() ? Number(max) : null;
  return (lower === null || (Number.isFinite(lower) && value >= lower)) && (upper === null || (Number.isFinite(upper) && value <= upper));
};
const hasSales = (product: BusinessProductRecord): boolean => [product.orders, product.card.skuOrders, product.card.units, product.card.gmv].some((value) => value !== null && value > 0);
const hasTrafficWithoutSales = (product: BusinessProductRecord): boolean => !hasSales(product) && (product.card.clicks ?? 0) > 0;
const productValue = (product: BusinessProductRecord, field: ProductSortField): number | null => field === "gmv" ? product.card.gmv : field === "orders" ? product.orders : product.card[field];
const comparisonText = (current: number | null, previous: number | null, rate = false): Change => {
  const delta = getMetricDelta(current, previous, rate);
  if (delta.kind === "new") return { text: "新增", tone: "positive" };
  if (delta.kind === "percent") return { text: `${delta.value >= 0 ? "▲" : "▼"} ${Math.abs(delta.value).toFixed(2)}%`, tone: delta.value > 0 ? "positive" : delta.value < 0 ? "down" : "flat" };
  if (delta.kind === "points") return { text: `${delta.value >= 0 ? "▲" : "▼"} ${Math.abs(delta.value).toFixed(2)}pp`, tone: delta.value > 0 ? "positive" : delta.value < 0 ? "down" : "flat" };
  return { text: "--", tone: "flat" };
};

function ProductAnalyticsSidebar() {
  return <aside className="hf-sidebar hf-product-analytics-sidebar" aria-label="商品数据分析导航"><section><span>商品</span><div className="active">详细信息</div><div>商品流量</div></section><section><span>商品榜单</span><div>TikTok 热卖商品榜</div></section></aside>;
}

function FilterDrawer({ filters, onChange, onClose }: { filters: ProductFilters; onChange: (next: ProductFilters) => void; onClose: () => void }) {
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });
  return <aside className="hf-product-filter-drawer" aria-label="筛选商品"><header><div><Filter size={15} /><strong>筛选</strong></div><button onClick={onClose} aria-label="关闭筛选"><X size={15} /></button></header><section><label>商品状态</label><div className="hf-filter-options"><button className={filters.status === "all" ? "active" : ""} onClick={() => set({ status: "all" })}>全部</button><button className={filters.status === "on-sale" ? "active" : ""} onClick={() => set({ status: "on-sale" })}>在售</button><button className={filters.status === "off-sale" ? "active" : ""} onClick={() => set({ status: "off-sale" })}>已下架</button></div></section><section><label>成交情况</label><div className="hf-filter-options"><button className={filters.sales === "all" ? "active" : ""} onClick={() => set({ sales: "all" })}>不限</button><button className={filters.sales === "with-sales" ? "active" : ""} onClick={() => set({ sales: "with-sales" })}>有成交</button><button className={filters.sales === "without-sales" ? "active" : ""} onClick={() => set({ sales: "without-sales" })}>无成交</button></div></section><section><label>GMV 范围</label><div className="hf-filter-range"><input value={filters.gmvMin} onChange={(event) => set({ gmvMin: event.target.value })} placeholder="最小值" inputMode="decimal" /><span>–</span><input value={filters.gmvMax} onChange={(event) => set({ gmvMax: event.target.value })} placeholder="最大值" inputMode="decimal" /></div></section><section><label>曝光范围</label><div className="hf-filter-range"><input value={filters.impressionsMin} onChange={(event) => set({ impressionsMin: event.target.value })} placeholder="最小值" inputMode="numeric" /><span>–</span><input value={filters.impressionsMax} onChange={(event) => set({ impressionsMax: event.target.value })} placeholder="最大值" inputMode="numeric" /></div></section><footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确定</button></footer></aside>;
}

const detailMetricsFor = (product: BusinessProductRecord, trafficMode: "页面浏览量" | "去重访客数"): DetailMetric[] => {
  const card = product.card;
  const unique = trafficMode === "去重访客数";
  return [
    { key: "gmv", group: "销量", label: "商品卡 GMV", value: card.gmv, format: "money" }, { key: "orders", group: "销量", label: "订单数", value: product.orders, format: "count" }, { key: "skuOrders", group: "销量", label: "SKU 订单数", value: card.skuOrders, format: "count" }, { key: "units", group: "销量", label: "商品成交件数", value: card.units, format: "count" }, { key: "aov", group: "销量", label: "AOV", value: card.aov, format: "money" }, { key: "customers", group: "销量", label: "预计客户数", value: card.customers, format: "count" },
    { key: "impressions", group: "流量", label: unique ? "去重商品曝光次数" : "商品曝光次数", value: unique ? card.uniqueImpressions : card.impressions, format: "count" }, { key: "clicks", group: "流量", label: unique ? "去重点击次数" : "商品点击量", value: unique ? card.uniqueClicks : card.clicks, format: "count" }, { key: "ctr", group: "流量", label: unique ? "去重点击率" : "商品点击率", value: unique ? card.uniqueCtr : card.ctr, format: "rate" }, { key: "addToCarts", group: "流量", label: unique ? "加购用户数" : "加购次数", value: unique ? card.addToCartUsers : card.addToCarts, format: "count" }, { key: "addToCartRate", group: "流量", label: unique ? "去重加购率" : "加购率", value: unique ? card.uniqueAddToCartRate : card.addToCartRate, format: "rate" }, { key: "ctor", group: "流量", label: unique ? "去重 CTOR" : "CTOR", value: unique ? card.uniqueCtor : card.ctor, format: "rate" },
  ];
};

const detailValueFor = (product: BusinessProductRecord, key: DetailMetricKey, trafficMode: "页面浏览量" | "去重访客数"): number | null => {
  const unique = trafficMode === "去重访客数";
  if (key === "orders") return product.orders;
  if (key === "gmv" || key === "skuOrders" || key === "units" || key === "aov" || key === "customers") return product.card[key];
  if (key === "impressions") return unique ? product.card.uniqueImpressions : product.card.impressions;
  if (key === "clicks") return unique ? product.card.uniqueClicks : product.card.clicks;
  if (key === "ctr") return unique ? product.card.uniqueCtr : product.card.ctr;
  if (key === "addToCarts") return unique ? product.card.addToCartUsers : product.card.addToCarts;
  if (key === "addToCartRate") return unique ? product.card.uniqueAddToCartRate : product.card.addToCartRate;
  return unique ? product.card.uniqueCtor : product.card.ctor;
};

function ProductHistoryTrend({ batches, productId, activeMetrics, trafficMode, currencySymbol }: { batches: BusinessProductDataBatch[]; productId: string; activeMetrics: DetailMetric[]; trafficMode: "页面浏览量" | "去重访客数"; currencySymbol: string }) {
  const points = useMemo(() => getProductHistory(productId, batches), [batches, productId]);
  const valueFor = (point: typeof points[number], metric: DetailMetric) => detailValueFor(point.product, metric.key, trafficMode);
  if (points.length < 2) return <div className="hf-real-empty hf-detail-trend-empty"><strong>历史数据不足</strong><small>后续导入更多完整周期或商品历史后可显示跨周期趋势。</small></div>;
  if (points.length === 2) return <div className="hf-product-history-compare">{activeMetrics.map((metric) => <div key={metric.key}><small>{metric.label}</small><strong>{formatMetric({ ...metric, value: valueFor(points[0], metric) }, currencySymbol)}</strong><span>{points[0].batch.endDate}　→　{points[1].batch.endDate}</span><strong>{formatMetric({ ...metric, value: valueFor(points[1], metric) }, currencySymbol)}</strong></div>)}</div>;
  const width = 720; const height = 150; const pad = { left: 28, right: 18, top: 12, bottom: 25 };
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(points.length - 1, 1));
  const values = (metric: DetailMetric) => points.map((point) => valueFor(point, metric));
  const maxFor = (metric: DetailMetric) => Math.max(...values(metric).filter((value): value is number => value !== null), 1);
  const y = (metric: DetailMetric, value: number) => pad.top + (1 - value / maxFor(metric)) * (height - pad.top - pad.bottom);
  const segments = (metric: DetailMetric) => { const result: string[] = []; let current: string[] = []; values(metric).forEach((value, index) => { if (value === null) { if (current.length) result.push(current.join(" ")); current = []; } else current.push(`${x(index)},${y(metric, value)}`); }); if (current.length) result.push(current.join(" ")); return result; };
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="商品历史周期趋势图">{[0, 1, 2, 3].map((index) => { const lineY = pad.top + index * ((height - pad.top - pad.bottom) / 3); return <line key={index} x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} />; })}{activeMetrics.flatMap((metric, metricIndex) => segments(metric).map((segment, index) => <polyline className={metricIndex ? "secondary" : ""} key={`${metric.key}-${index}`} points={segment} />))}{points.map((point, index) => <text key={point.batch.id} x={x(index)} y={height - 6} textAnchor="middle">{point.batch.endDate.slice(5).replace("-", "/")}</text>)}</svg>;
}

function ProductDetail({ product, batch, previousProduct, hasPreviousPeriod, productBatches, onBack }: { product: BusinessProductRecord; batch: BusinessBatch; previousProduct: BusinessProductRecord | null; hasPreviousPeriod: boolean; productBatches: BusinessProductDataBatch[]; onBack: () => void }) {
  const [channel, setChannel] = useState("全部");
  const [selected, setSelected] = useState<DetailMetricKey[]>(["skuOrders", "impressions"]);
  const [trafficMode, setTrafficMode] = useState<"页面浏览量" | "去重访客数">("页面浏览量");
  const channels = ["全部", "商家直播", "商家视频", "商家商品卡", "联盟"];
  const metrics = detailMetricsFor(product, trafficMode);
  const activeMetrics = metrics.filter((metric) => selected.includes(metric.key));
  const toggleMetric = (key: DetailMetricKey) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  const changeFor = (metric: DetailMetric): Change => previousProduct ? comparisonText(metric.value, detailValueFor(previousProduct, metric.key, trafficMode), metric.format === "rate") : hasPreviousPeriod ? { text: "新增", tone: "positive" } : { text: "--", tone: "flat" };
  const traffic = trafficMode === "页面浏览量" ? { impressions: product.card.impressions, clicks: product.card.clicks, ctr: product.card.ctr, addToCarts: product.card.addToCarts, addToCartRate: product.card.addToCartRate, ctor: product.card.ctor } : { impressions: product.card.uniqueImpressions, clicks: product.card.uniqueClicks, ctr: product.card.uniqueCtr, addToCarts: product.card.addToCartUsers, addToCartRate: product.card.uniqueAddToCartRate, ctor: product.card.uniqueCtor };
  const funnelMax = Math.max(traffic.impressions ?? 0, traffic.clicks ?? 0, product.card.skuOrders ?? 0, 1);
  const funnelWidth = (value: number | null, minimum: number) => `${Math.max(minimum, Math.min(100, ((value ?? 0) / funnelMax) * 100))}%`;
  const mallMetrics: Array<[string, number | null, "count" | "rate" | "money"]> = [["商城曝光", product.mall.impressions, "count"], ["商城点击", product.mall.clicks, "count"], ["商城 CTR", product.mall.ctr, "rate"], ["商城 CTOR", product.mall.ctor, "rate"], ["商城 GMV", product.mall.gmv, "money"], ["商城成交件数", product.mall.units, "count"]];
  return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-product-detail-header"><button onClick={onBack}><ChevronLeft size={14} /> 商品表现</button><div className="hf-product-detail-title"><ProductThumbnail productId={product.productId} fallbackText={product.name} size={42} /><div><h2>{product.name}</h2><p>ID {product.productId}　|　{product.publishStatus || "发品状态未提供"}　|　GMV区间 {product.gmvRange || "--"}</p></div><button className="hf-tiktok-link" disabled title="当前导入文件未提供商品链接"><span>打开 TikTok 商品</span><ExternalLink size={12} /></button></div><div className="hf-product-facts"><span><small>发品状态</small><strong><i /> {product.publishStatus || "--"}</strong></span><span><small>GMV 区间</small><strong>{product.gmvRange || "--"}</strong></span><span><small>价格</small><strong>--</strong></span><span><small>评价</small><strong>--</strong></span></div></section><div className="hf-product-detail-channel">{channels.map((item) => <button key={item} className={channel === item ? "active" : ""} onClick={() => setChannel(item)}>{item}</button>)}</div>{channel !== "全部" ? <div className="hf-panel hf-real-empty hf-product-channel-empty">当前导入文件暂无该来源的可靠商品明细</div> : <><section className="hf-panel hf-detail-metric-panel"><header><h2>关键指标</h2><div><button aria-label="编辑指标"><PencilLine size={14} /></button><button aria-label="下载数据"><Download size={14} /></button><button aria-label="更多操作"><MoreVertical size={14} /></button></div></header>{(["销量", "流量"] as const).map((group) => <div className="hf-detail-metric-group" key={group}><label>{group}</label><div>{metrics.filter((metric) => metric.group === group).map((metric) => { const change = changeFor(metric); return <button className={selected.includes(metric.key) ? "selected" : ""} onClick={() => toggleMetric(metric.key)} key={metric.key}><span>{metric.label}<i>{selected.includes(metric.key) ? <Check size={10} /> : null}</i></span><strong>{formatMetric(metric, batch.currencySymbol)}</strong><em className={change.tone}>{change.text}</em></button>; })}</div></div>)}<div className="hf-detail-trend"><div className="hf-chart-legend"><strong>历史周期趋势</strong><small>一个周期一个数据点</small>{activeMetrics.map((metric, index) => <span key={metric.key}><i className={index ? "secondary" : ""} />{metric.label}</span>)}</div><ProductHistoryTrend batches={productBatches} productId={product.productId} activeMetrics={activeMetrics} trafficMode={trafficMode} currencySymbol={batch.currencySymbol} /></div></section><section className="hf-panel hf-detail-traffic"><header><h2>流量分析</h2><div className="hf-segmented"><button className={trafficMode === "页面浏览量" ? "active" : ""} onClick={() => setTrafficMode("页面浏览量")}>页面浏览量</button><button className={trafficMode === "去重访客数" ? "active" : ""} onClick={() => setTrafficMode("去重访客数")}>去重访客数</button></div></header><div className="hf-detail-funnel"><div className="hf-funnel-label first"><small>CTR</small><strong>{formatRate(traffic.ctr)}</strong></div><div className="hf-funnel-bars"><div style={{ width: funnelWidth(traffic.impressions, 58) }}><span>商品曝光</span><b>{formatCount(traffic.impressions)}</b></div><div style={{ width: funnelWidth(traffic.clicks, 48) }}><span>商品点击</span><b>{formatCount(traffic.clicks)}</b></div><div style={{ width: funnelWidth(product.card.skuOrders, 38) }}><span>SKU 订单</span><b>{formatCount(product.card.skuOrders)}</b></div></div><div className="hf-funnel-label second"><small>CTOR</small><strong>{formatRate(traffic.ctor)}</strong></div><aside className="hf-funnel-side"><span>{trafficMode === "页面浏览量" ? "加购次数" : "加购用户数"} <strong>{formatCount(traffic.addToCarts)}</strong></span><span>加购率 <strong>{formatRate(traffic.addToCartRate)}</strong></span></aside></div></section><section className="hf-panel hf-product-mall-panel"><header><h2>商城表现</h2><span>当前商品商城页字段</span></header><div className="hf-product-mall-grid">{mallMetrics.map(([label, value, format]) => <div key={label}><small>{label}</small><strong>{format === "money" ? formatMoney(value, batch.currencySymbol) : format === "rate" ? formatRate(value) : formatCount(value)}</strong></div>)}</div></section><section className="hf-panel hf-detail-breakdown"><header><h2>表现明细</h2><div><button><Download size={13} /> 导出数据</button><button aria-label="更多操作"><MoreVertical size={14} /></button></div></header><table><thead><tr><th>信息</th><th>GMV</th><th>订单数</th><th>SKU 订单数</th><th>商品成交件数</th><th>平均订单金额</th><th>操作</th></tr></thead><tbody><tr><td>全部</td>{metrics.filter((metric) => ["gmv", "orders", "skuOrders", "units", "aov"].includes(metric.key)).map((metric) => { const change = changeFor(metric); return <td key={metric.key}><strong>{formatMetric(metric, batch.currencySymbol)}</strong><em className={change.tone}>{change.text}</em></td>; })}<td><button disabled>--</button></td></tr></tbody></table></section></>}</div></div>;
}

const matchesInsight = (product: BusinessProductRecord, insight: ProductInsight, previousProducts: Map<string, BusinessProductRecord>, hasPreviousPeriod: boolean): boolean => {
  const previous = previousProducts.get(product.productId);
  if (insight === "all") return true;
  if (insight === "with-sales") return hasSales(product);
  if (insight === "without-sales") return !hasSales(product);
  if (insight === "traffic-no-sales") return hasTrafficWithoutSales(product);
  if (!hasPreviousPeriod) return false;
  if (insight === "new") return !previous;
  if (!previous || product.card.gmv === null || previous.card.gmv === null || previous.card.gmv <= 0) return false;
  const delta = getMetricDelta(product.card.gmv, previous.card.gmv, false);
  return delta.kind === "percent" && (insight === "growth" ? delta.value >= 30 : delta.value <= -30);
};

export default function ProductAnalyticsList({ batch, batches = [], productHistoryBatches = [] }: { batch: BusinessBatch | null; batches?: BusinessBatch[]; productHistoryBatches?: BusinessProductHistoryBatch[] }) {
  const [mode, setMode] = useState<ProductMode>("product");
  const [source, setSource] = useState("全部");
  const [insight, setInsight] = useState<ProductInsight>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>(defaultProductFilters);
  const [sort, setSort] = useState<{ field: ProductSortField | null; direction: SortDirection }>({ field: null, direction: null });
  const [selectedProduct, setSelectedProduct] = useState<BusinessProductRecord | null>(null);
  useEffect(() => { setSelectedProduct(null); setPage(1); }, [batch?.id]);
  const productBatches = useMemo(() => buildProductHistoryBatches(batches, productHistoryBatches), [batches, productHistoryBatches]);
  const previousPeriod = useMemo(() => findPreviousProductPeriod(batch, productBatches), [batch, productBatches]);
  const previousProducts = useMemo(() => indexProducts(previousPeriod), [previousPeriod]);
  const hasPreviousPeriod = Boolean(previousPeriod);
  const displayed = useMemo(() => {
    if (!batch || mode === "sku" || source !== "全部") return [];
    const normalizedQuery = query.trim().toLowerCase();
    return batch.products.filter((product) => {
      const statusMatch = filters.status === "all" || (filters.status === "on-sale" ? /在售|可售/.test(product.publishStatus) : !/在售|可售/.test(product.publishStatus));
      const salesMatch = filters.sales === "all" || (filters.sales === "with-sales" ? hasSales(product) : !hasSales(product));
      return matchesInsight(product, insight, previousProducts, hasPreviousPeriod) && (!normalizedQuery || product.name.toLowerCase().includes(normalizedQuery) || product.productId.toLowerCase().includes(normalizedQuery)) && statusMatch && salesMatch && numberFilter(product.card.gmv, filters.gmvMin, filters.gmvMax) && numberFilter(product.card.impressions, filters.impressionsMin, filters.impressionsMax);
    }).sort((left, right) => {
      if (!sort.field || !sort.direction) return left.originalIndex - right.originalIndex;
      const a = productValue(left, sort.field); const b = productValue(right, sort.field);
      if (a === null && b === null) return left.originalIndex - right.originalIndex;
      if (a === null) return 1; if (b === null) return -1;
      return sort.direction === "desc" ? b - a : a - b;
    });
  }, [batch, filters, hasPreviousPeriod, insight, mode, previousProducts, query, sort, source]);
  const insightCounts = useMemo(() => Object.fromEntries((Object.keys(insightLabels) as ProductInsight[]).map((key) => [key, (batch?.products ?? []).filter((product) => matchesInsight(product, key, previousProducts, hasPreviousPeriod)).length])) as Record<ProductInsight, number>, [batch, hasPreviousPeriod, previousProducts]);
  const sourceTabs = ["全部", "商家直播", "商家视频", "商家商品卡", "联盟"];
  const pageCount = Math.max(1, Math.ceil(displayed.length / 10));
  const pageStart = pageCount <= 3 ? 1 : Math.min(Math.max(1, page - 1), pageCount - 2);
  const pages = Array.from({ length: Math.min(pageCount, 3) }, (_, index) => pageStart + index);
  const visible = displayed.slice((page - 1) * 10, page * 10);
  const sortMark = (field: ProductSortField) => sort.field === field ? sort.direction === "desc" ? "↓" : "↑" : "↕";
  const setSortField = (field: ProductSortField) => { setPage(1); setSort((current) => current.field !== field ? { field, direction: "desc" } : current.direction === "desc" ? { field, direction: "asc" } : { field: null, direction: null }); };
  const changeFor = (product: BusinessProductRecord, field: ProductSortField): Change => { const previous = previousProducts.get(product.productId); return previous ? comparisonText(productValue(product, field), productValue(previous, field)) : hasPreviousPeriod ? { text: "新增", tone: "positive" } : { text: "--", tone: "flat" }; };
  const emptyMessage = !batch ? "请先导入本期三份官方 Excel" : mode === "sku" ? "当前导入文件暂无 SKU 级明细数据" : source !== "全部" ? "当前导入文件暂无该来源的可靠商品明细" : "没有符合条件的真实商品数据";
  const setInsightView = (next: ProductInsight) => { if (historyDependentInsights.has(next) && !hasPreviousPeriod) return; setInsight(next); setPage(1); };
  if (selectedProduct && batch) return <ProductDetail product={selectedProduct} batch={batch} previousProduct={previousProducts.get(selectedProduct.productId) ?? null} hasPreviousPeriod={hasPreviousPeriod} productBatches={productBatches} onBack={() => setSelectedProduct(null)} />;
  if (!batch) return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-panel hf-real-empty">请先导入完整周期数据。</section></div></div>;
  return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-panel hf-product-analytics-list"><header className="hf-product-analytics-heading"><div className="hf-product-kind-tabs"><button className={mode === "product" ? "active" : ""} onClick={() => { setMode("product"); setPage(1); }}>按商品</button><button className={mode === "sku" ? "active" : ""} onClick={() => { setMode("sku"); setPage(1); }}>按 SKU</button></div></header><div className="hf-product-analytics-tools"><div className="hf-source-tabs">{sourceTabs.map((tab) => <button key={tab} className={source === tab ? "active" : ""} onClick={() => { setSource(tab); setPage(1); }}>{tab}</button>)}</div><div className="hf-product-insight-tabs">{(Object.keys(insightLabels) as ProductInsight[]).map((key) => <button key={key} className={insight === key ? "active" : ""} disabled={historyDependentInsights.has(key) && !hasPreviousPeriod} title={historyDependentInsights.has(key) && !hasPreviousPeriod ? "至少需要两个商品数据周期" : undefined} onClick={() => setInsightView(key)}>{insightLabels[key]}{key !== "all" && <small>{insightCounts[key]}</small>}</button>)}</div><div className="hf-data-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索商品名称或 ID" /></div><button className={filterOpen ? "active filter-button" : "filter-button"} onClick={() => setFilterOpen((open) => !open)}><SlidersHorizontal size={13} /> 筛选</button><button className="hf-tool-icon" aria-label="配置列"><PencilLine size={14} /></button><button className="hf-export-button"><Download size={13} /> 导出数据</button><button className="hf-tool-icon" aria-label="更多操作"><MoreVertical size={14} /></button></div>{!hasPreviousPeriod && <p className="hf-product-history-hint">导入至少两个商品数据周期后，可使用增长明显、下降明显和新增视角。</p>}<div className="hf-product-analytics-table-wrap"><table className="hf-product-analytics-table"><thead><tr><th>商品</th>{(["gmv", "orders", "skuOrders", "units"] as ProductSortField[]).map((field) => <th key={field} className={sort.field === field ? "sorted" : ""}><button onClick={() => setSortField(field)}>{field === "gmv" ? "GMV" : field === "orders" ? "订单数" : field === "skuOrders" ? "SKU 订单数" : "商品成交件数"} {sortMark(field)}</button></th>)}<th>操作</th></tr></thead><tbody>{visible.map((product) => <tr key={product.productId}><td><div className="hf-data-product"><ProductThumbnail productId={product.productId} fallbackText={product.name} /><span><strong>{product.name}</strong><small>ID {product.productId} <button aria-label="复制商品 ID"><Copy size={11} /></button></small><em><b className={/在售|可售/.test(product.publishStatus) ? "online" : "offline"} />{product.publishStatus || "发品状态未提供"}<i>{product.gmvRange}</i></em></span></div></td>{(["gmv", "orders", "skuOrders", "units"] as ProductSortField[]).map((field) => { const value = productValue(product, field); const change = changeFor(product, field); return <td key={field} className={sort.field === field ? "sorted" : ""}><strong>{field === "gmv" ? formatMoney(value, batch.currencySymbol) : formatCount(value)}</strong><small className={change.tone}>{change.text}</small></td>; })}<td><button className="hf-detail-action" onClick={() => setSelectedProduct(product)}>详细信息</button></td></tr>)}</tbody></table>{!visible.length && <div className="hf-real-empty">{emptyMessage}</div>}</div><footer className="hf-pagination"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button>{pages.map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={13} /></button><select defaultValue="10" aria-label="每页条数"><option value="10">10/Page</option><option value="20">20/Page</option></select></footer></section>{filterOpen && <FilterDrawer filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} onClose={() => setFilterOpen(false)} />}</div></div>;
}
