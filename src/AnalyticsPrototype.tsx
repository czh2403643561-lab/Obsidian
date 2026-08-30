import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  HelpCircle,
  Image,
  Info,
  MoreVertical,
  PackageOpen,
  PencilLine,
  Search,
  Settings2,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./analyticsPrototype.css";
import ProductAnalyticsList from "./ProductAnalyticsList";
import { getMetricDelta, selectPreviousBatch } from "./businessComparison";
import { parseBusinessFiles } from "./businessParser";
import { getProductImageCacheSummary, saveProductImage, usePersistedState } from "./persistence";
import { requestProductImages } from "./productImageBridge";
import ProductThumbnail from "./ProductThumbnail";
import type { BusinessBatch, BusinessProductRecord } from "./types";

type MetricKey = "gmv" | "units" | "skuOrders" | "orders";
type CardPage = "performance" | "details";

const metrics: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "gmv", label: "GMV", color: "#6559e8" },
  { key: "units", label: "商品成交件数", color: "#2e9f86" },
  { key: "skuOrders", label: "SKU 订单数", color: "#4d83dc" },
  { key: "orders", label: "订单数", color: "#df8f45" },
];

const overviewLabels: Record<MetricKey, string> = { gmv: "GMV", units: "商品成交件数", skuOrders: "SKU 订单数", orders: "订单数" };
const overviewColors: Record<MetricKey, string> = { gmv: "#6559e8", units: "#2e9f86", skuOrders: "#4d83dc", orders: "#df8f45" };
const formatOverviewCurrency = (value: number | null, symbol: string): string => value === null ? "—" : `${symbol}${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatOverviewValue = (key: MetricKey, value: number | null, symbol: string): string => key === "gmv" ? formatOverviewCurrency(value, symbol) : value === null ? "—" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const formatIsoDate = (value: string): string => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3");
const sortBatches = (batches: BusinessBatch[]) => [...batches].sort((left, right) => right.endDate.localeCompare(left.endDate) || right.startDate.localeCompare(left.startDate));
const deltaText = (current: number | null, previous: number | null, rate = false): { text: string; tone: "positive" | "negative" | "neutral" } => {
  const delta = getMetricDelta(current, previous, rate);
  if (delta.kind === "new") return { text: "新增", tone: "positive" };
  if (delta.kind === "percent") return { text: `${delta.value >= 0 ? "▲" : "▼"} ${Math.abs(delta.value).toFixed(2)}%`, tone: delta.value > 0 ? "positive" : delta.value < 0 ? "negative" : "neutral" };
  if (delta.kind === "points") return { text: `${delta.value >= 0 ? "▲" : "▼"} ${Math.abs(delta.value).toFixed(2)}pp`, tone: delta.value > 0 ? "positive" : delta.value < 0 ? "negative" : "neutral" };
  return { text: "--", tone: "neutral" };
};
const importedGrowthText = (growth: number | null): { text: string; tone: "positive" | "negative" | "neutral" } => growth === null ? { text: "--", tone: "neutral" } : { text: `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth).toFixed(2)}%`, tone: growth > 0 ? "positive" : growth < 0 ? "negative" : "neutral" };
const overviewMetricItems = (batch: BusinessBatch | null, previous: BusinessBatch | null) => metrics.map((metric) => ({ ...metric, label: overviewLabels[metric.key], value: batch ? formatOverviewValue(metric.key, batch.overviewSummary[metric.key], batch.currencySymbol) : "--", delta: batch && previous ? deltaText(batch.overviewSummary[metric.key], previous.overviewSummary[metric.key]) : batch ? importedGrowthText(batch.overviewComparison?.growth[metric.key] ?? null) : { text: "--", tone: "neutral" as const } }));
const shareOf = (value: number | null, total: number | null): string => value === null || total === null || total === 0 ? "—" : `${Math.round((value / total) * 1000) / 10}%`;

const metricGroups = [
  {
    title: "总体表现",
    items: ["GMV", "订单数", "SKU订单数", "商品成交件数", "预计客户数", "平均订单金额", "商品曝光次数", "商品点击量", "商品点击率", "加购次数", "加购率", "CTOR", "去重商品曝光次数", "去重点击次数", "去重点击率", "已加购用户数", "去重加购率", "去重CTOR"],
  },
];

const defaultSelectedMetrics = ["GMV", "订单数", "SKU订单数", "商品成交件数", "预计客户数", "商品曝光次数", "商品点击量", "商品点击率", "加购次数", "CTOR"];

function AnalyticsSidebar() {
  return (
    <aside className="hf-sidebar" aria-label="店铺数据分析导航">
      <section>
        <span>店铺</span>
        <div className="active">概览</div>
        <div>流量分析</div>
      </section>
      <section>
        <span>经营</span>
        <div>商品表现</div>
        <div>订单表现</div>
      </section>
      <section>
        <span>用户</span>
        <div>客户分析</div>
      </section>
    </aside>
  );
}

function ProductCardSidebar({ page, onPage }: { page: CardPage; onPage: (page: CardPage) => void }) {
  return (
    <aside className="hf-sidebar hf-card-sidebar" aria-label="商品卡导航">
      <section>
        <span>商品卡</span>
        <button className={page === "performance" ? "active" : ""} onClick={() => onPage("performance")}>表现</button>
        <button className={page === "details" ? "active" : ""} onClick={() => onPage("details")}>详情</button>
        <div>热门</div>
        <div>商品卡畅销商品</div>
      </section>
      <section>
        <span>搜索</span>
        <div>商品标题优化工具</div>
        <div>关键词榜单</div>
      </section>
      <section>
        <span>渠道</span>
        <div>商城</div>
        <div>推荐</div>
        <div>店铺页面</div>
      </section>
    </aside>
  );
}

function PanelTools({ onConfigure, exportLabel = true }: { onConfigure: () => void; exportLabel?: boolean }) {
  return (
    <div className="hf-card-tools">
      <button onClick={onConfigure}><Settings2 size={13} /> 配置指标</button>
      {exportLabel && <button><Download size={13} /> 导出数据</button>}
      <button className="icon-only" aria-label="其他操作"><MoreVertical size={14} /></button>
    </div>
  );
}

type CardPerformanceMetricKey = "uniqueImpressions" | "customers" | "gmv" | "ctor";
type CardTrendKey = "impressions" | "skuOrders";

const cardPerformanceMetrics: Array<{ key: CardPerformanceMetricKey; label: string; format: "count" | "money" | "rate" }> = [
  { key: "uniqueImpressions", label: "曝光用户数", format: "count" },
  { key: "customers", label: "预计客户数", format: "count" },
  { key: "gmv", label: "商品卡 GMV", format: "money" },
  { key: "ctor", label: "CTOR", format: "rate" },
];
const cardTrendLabels: Record<CardTrendKey, string> = { impressions: "曝光", skuOrders: "SKU订单" };
const formatCardCount = (value: number | null): string => value === null ? "--" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const formatCardMoney = (value: number | null, symbol: string): string => value === null ? "--" : `${symbol}${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCardRate = (value: number | null): string => value === null ? "--" : `${value.toFixed(2)}%`;

function CardTrendPanel({ batch, previous, compare }: { batch: BusinessBatch | null; previous: BusinessBatch | null; compare: boolean }) {
  const [selected, setSelected] = useState<CardTrendKey[]>(["impressions", "skuOrders"]);
  const toggle = (key: CardTrendKey) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  const points = batch?.shopCardTrend ?? [];
  const previousPoints = compare ? previous?.shopCardTrend ?? [] : [];
  const width = 720;
  const height = 150;
  const pad = { left: 42, right: 18, top: 12, bottom: 25 };
  const pointCount = Math.max(points.length, previousPoints.length, 1);
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(pointCount - 1, 1));
  const valuesFor = (series: typeof points, key: CardTrendKey) => series.map((point) => point.metrics[key]);
  const maxFor = (key: CardTrendKey) => Math.max(...[...valuesFor(points, key), ...valuesFor(previousPoints, key)].filter((value): value is number => value !== null), 1);
  const y = (key: CardTrendKey, value: number) => pad.top + (1 - value / maxFor(key)) * (height - pad.top - pad.bottom);
  const colors: Record<CardTrendKey, string> = { impressions: "#18a899", skuOrders: "#6559e8" };
  const previousColors: Record<CardTrendKey, string> = { impressions: "#a9dfd7", skuOrders: "#bbb5f0" };
  const segmentsFor = (series: typeof points, key: CardTrendKey) => {
    const segments: string[] = [];
    let current: string[] = [];
    valuesFor(series, key).forEach((value, index) => {
      if (value === null) {
        if (current.length) segments.push(current.join(" "));
        current = [];
      } else current.push(`${x(index)},${y(key, value)}`);
    });
    if (current.length) segments.push(current.join(" "));
    return segments;
  };
  return <div className="hf-card-trend">
    <header><div><h3>商品卡每日趋势</h3><span>{batch ? `${batch.startDate} – ${batch.endDate}` : "未导入周期"}</span></div><div className="hf-card-trend-options">{(Object.keys(cardTrendLabels) as CardTrendKey[]).map((key) => <button key={key} className={selected.includes(key) ? "active" : ""} onClick={() => toggle(key)}>{cardTrendLabels[key]}</button>)}</div></header>
    {!batch || !points.length ? <div className="hf-card-trend-empty">当前未导入商品卡每日趋势数据</div> : <>
      <div className="hf-chart-legend">{selected.map((key) => <span key={key}><i style={{ background: colors[key] }} />本期 {cardTrendLabels[key]}</span>)}{previous && compare && selected.map((key) => <span className="previous" key={`previous-${key}`}><i style={{ background: previousColors[key] }} />对比周期 {cardTrendLabels[key]}</span>)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="商品卡每日趋势图">
        {[0, 1, 2, 3].map((index) => { const lineY = pad.top + index * ((height - pad.top - pad.bottom) / 3); return <line key={index} x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} />; })}
        {previous && compare && selected.flatMap((key) => segmentsFor(previousPoints, key).map((segment, index) => <polyline className="previous" key={`previous-${key}-${index}`} points={segment} stroke={previousColors[key]} />))}
        {selected.flatMap((key) => segmentsFor(points, key).map((segment, index) => <polyline key={`${key}-${index}`} points={segment} stroke={colors[key]} />))}
        {points.map((point, index) => <text key={`${point.date}-${index}`} x={x(index)} y={height - 6} textAnchor="middle">{point.date.slice(5).replace("-", "/")}</text>)}
      </svg>
    </>}
  </div>;
}

function CardPerformancePage({ batch, previous, onConfigure }: { batch: BusinessBatch | null; previous: BusinessBatch | null; onConfigure: () => void }) {
  const [compare, setCompare] = useState(false);
  const summary = batch?.shopCardSummary;
  return (
    <div className="hf-card-page">
      <section className="hf-panel hf-card-kpi-panel">
        <header className="hf-card-section-header"><div><h2>关键指标</h2><button className="hf-help-link">什么是商品卡？ <ChevronRight size={13} /></button></div><div className="hf-card-tools"><label className="hf-check-label"><input type="checkbox" checked={compare} disabled={!previous} title={previous ? "显示对比周期趋势" : "请先导入可比较的历史周期"} onChange={(event) => setCompare(event.target.checked)} /> 对比趋势</label><button onClick={onConfigure}><Settings2 size={13} /> 配置指标</button><button><Download size={13} /> 导出数据</button><button className="icon-only" aria-label="其他操作"><MoreVertical size={14} /></button></div></header>
        <div className="hf-card-kpis">{cardPerformanceMetrics.map((item) => { const value = summary?.[item.key] ?? null; const change = batch && previous ? deltaText(value, previous.shopCardSummary[item.key], item.key === "ctor") : { text: "--", tone: "neutral" as const }; return <article key={item.key}><span>{item.label} <HelpCircle size={12} /></span><strong>{item.format === "money" ? formatCardMoney(value, batch?.currencySymbol ?? "") : item.format === "rate" ? formatCardRate(value) : formatCardCount(value)}</strong><small>较上一周期　<em className={change.tone}>{change.text}</em></small><p>当前导出文件暂无同行基准</p></article>; })}</div>
        <CardTrendPanel batch={batch} previous={previous} compare={compare} />
      </section>
      <section className="hf-panel hf-traffic-panel">
        <header className="hf-card-section-header"><h2>流量来源</h2><PanelTools onConfigure={onConfigure} exportLabel={false} /></header>
        <div className="hf-table-scroll"><table className="hf-traffic-table"><thead><tr><th>流量来源</th><th>页面浏览次数比率｜浏览次数 <ArrowDown size={12} /></th><th>曝光用户数 <ArrowDown size={12} /></th><th>GMV <ArrowDown size={12} /></th><th>曝光到成交转化率</th><th>操作</th></tr></thead><tbody><tr><td colSpan={6}><div className="hf-traffic-empty"><strong>当前导出文件未提供商品卡流量来源拆分</strong><span>搜索、推荐、店铺、活动等来源数据暂无法从本期 Excel 还原。</span></div></td></tr></tbody></table></div>
      </section>
      <section className="hf-panel hf-potential-panel"><header className="hf-card-section-header"><div><h2>高潜力商品卡 <HelpCircle size={12} /></h2><button className="hf-diagnosis-link">了解更多诊断信息 <ChevronRight size={13} /></button></div><PanelTools onConfigure={onConfigure} /></header><table><thead><tr><th>商品卡名称</th><th>前 3 项建议操作</th><th>过去 7 天访问人数</th><th>GMV</th><th>操作</th></tr></thead></table><div className="hf-potential-empty"><PackageOpen size={28} /><span>当前导出文件暂无官方高潜力诊断数据</span></div></section>
    </div>
  );
}

type DetailSortField = "uniqueImpressions" | "uniqueClicks" | "uniqueCtr" | "customers";

const detailMetricValue = (product: BusinessProductRecord, field: DetailSortField): number | null => product.card[field];
const detailCount = (value: number | null): string => value === null ? "--" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const detailRate = (value: number | null): string => value === null ? "--" : `${value.toFixed(2)}%`;

function CardDetailsPage({ batch, onConfigure, onOpenProduct }: { batch: BusinessBatch | null; onConfigure: () => void; onOpenProduct: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [diagnosis, setDiagnosis] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: DetailSortField | null; direction: "asc" | "desc" | null }>({ field: null, direction: null });
  const list = (batch?.products ?? []).filter((product) => !query || product.name.toLowerCase().includes(query.toLowerCase()) || product.productId.includes(query)).sort((left, right) => {
    if (!sort.field || !sort.direction) return left.originalIndex - right.originalIndex;
    const a = detailMetricValue(left, sort.field); const b = detailMetricValue(right, sort.field);
    if (a === null && b === null) return left.originalIndex - right.originalIndex;
    if (a === null) return 1; if (b === null) return -1;
    return sort.direction === "desc" ? b - a : a - b;
  });
  const visible = list.slice((page - 1) * 10, page * 10);
  const pageCount = Math.max(1, Math.ceil(list.length / 10));
  const setSortField = (field: DetailSortField) => { setPage(1); setSort((current) => current.field !== field ? { field, direction: "desc" } : current.direction === "desc" ? { field, direction: "asc" } : { field: null, direction: null }); };
  const sortMark = (field: DetailSortField) => sort.field === field ? sort.direction === "desc" ? "↓" : "↑" : "↕";
  return (
    <section className="hf-panel hf-product-list-panel">
      <header><h2>商品卡列表</h2></header>
      <div className="hf-product-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="输入商品 ID 或商品名称" /></div>
      <div className="hf-product-toolbar"><div className="hf-product-tabs"><button className={!favorite ? "active" : ""} onClick={() => setFavorite(false)}>全部</button><button className={favorite ? "active" : ""} onClick={() => setFavorite(true)}><Star size={12} /> 已收藏</button></div><span>类目</span><div className="hf-category-select"><strong>全部类目</strong><X size={12} /><ChevronDown size={13} /></div><div className="hf-product-actions"><label className="hf-switch-label"><button className={diagnosis ? "on" : ""} onClick={() => setDiagnosis(!diagnosis)}><i /></button>诊断模式 <HelpCircle size={12} /></label><button onClick={onConfigure}><Settings2 size={13} /> 配置指标</button><button><Download size={13} /> 导出数据</button><button className="icon-only"><MoreVertical size={14} /></button></div></div>
      <div className="hf-product-table-wrap"><table className="hf-product-table"><thead><tr><th>商品卡名称 <HelpCircle size={11} /></th><th className={sort.field === "uniqueImpressions" ? "sorted" : ""}><button onClick={() => setSortField("uniqueImpressions")}>曝光用户数 {sortMark("uniqueImpressions")}</button></th><th className={sort.field === "uniqueClicks" ? "sorted" : ""}><button onClick={() => setSortField("uniqueClicks")}>点击人数 {sortMark("uniqueClicks")}</button></th><th className={sort.field === "uniqueCtr" ? "sorted" : ""}><button onClick={() => setSortField("uniqueCtr")}>曝光到点击转化率 {sortMark("uniqueCtr")}</button></th><th className={sort.field === "customers" ? "sorted" : ""}><button onClick={() => setSortField("customers")}>日客户数 {sortMark("customers")}</button></th><th>SKU</th><th>操作</th></tr></thead><tbody>{visible.map((product) => <tr key={product.productId}><td><div className="hf-product-identity"><ProductThumbnail productId={product.productId} fallbackText={product.name} /><span><strong>{product.name}</strong><small>ID：{product.productId} <button aria-label="复制 Product ID"><Copy size={11} /></button></small><em className="hf-real-status">{product.publishStatus || "未填写"}</em></span></div></td><td className={sort.field === "uniqueImpressions" ? "sorted" : ""}>{detailCount(product.card.uniqueImpressions)}</td><td className={sort.field === "uniqueClicks" ? "sorted" : ""}>{detailCount(product.card.uniqueClicks)}</td><td className={sort.field === "uniqueCtr" ? "sorted" : ""}>{detailRate(product.card.uniqueCtr)}</td><td className={sort.field === "customers" ? "sorted" : ""}>{detailCount(product.card.customers)}</td><td>--</td><td><button className="hf-detail-action" onClick={() => onOpenProduct(product.name)}>详情</button></td></tr>)}</tbody></table>{!visible.length && <div className="hf-real-empty">{batch ? "没有符合条件的真实商品数据" : "请先在店铺数据分析首页导入三份官方 Excel"}</div>}</div>
      <footer className="hf-pagination"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button>{Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={13} /></button><select aria-label="每页条数" defaultValue="10"><option value="10">10/Page</option><option value="20">20/Page</option></select></footer>
    </section>
  );
}

function ProductDetailPlaceholder({ name, onBack }: { name: string; onBack: () => void }) {
  return <section className="hf-panel hf-product-placeholder"><button onClick={onBack}><ChevronLeft size={14} /> 返回商品卡列表</button><div><PackageOpen size={28} /><h2>{name}</h2><p>单商品详情将在下一阶段实现。</p></div></section>;
}

function MetricModal({ draft, onToggle, onRemove, onCancel, onConfirm }: { draft: string[]; onToggle: (name: string) => void; onRemove: (name: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="hf-modal-backdrop" role="presentation"><section className="hf-metric-modal" role="dialog" aria-modal="true" aria-labelledby="hf-metric-title"><header><h2 id="hf-metric-title">自定义指标</h2></header><div className="hf-modal-body"><div className="hf-metric-picker"><div className="hf-modal-column-title"><strong>选择指标</strong><button>↻ 恢复默认</button></div>{metricGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map((name) => <label key={name}><input type="checkbox" checked={draft.includes(name)} onChange={() => onToggle(name)} /><span>{name}</span></label>)}</div></section>)}<div className="hf-placeholder-groups">{["商家直播表现", "商家视频表现", "商家商品卡表现", "联盟表现"].map((name) => <section key={name}><h3>{name}</h3><p>当前阶段仅保留分类位置</p></section>)}</div></div><aside className="hf-selected-metrics"><div className="hf-modal-column-title"><strong>已选择 {draft.length} 个指标</strong></div><div>{draft.map((name) => <span key={name}><strong>{name}</strong><button aria-label={`移除${name}`} onClick={() => onRemove(name)}><X size={12} /></button></span>)}</div></aside></div><footer><button onClick={onCancel}>取消</button><button className="primary" onClick={onConfirm}>确定</button></footer></section></div>;
}

function MetricSelector({ selected, onToggle, batch, previous }: { selected: MetricKey[]; onToggle: (key: MetricKey) => void; batch: BusinessBatch | null; previous: BusinessBatch | null }) {
  const items = overviewMetricItems(batch, previous);
  return (
    <div className="hf-metric-row">
      {items.map((metric) => {
        const active = selected.includes(metric.key);
        return (
          <button key={metric.key} className={active ? "selected" : ""} onClick={() => onToggle(metric.key)}>
            {active && <i style={{ background: metric.color }} />}
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={metric.delta.tone}>{metric.delta.text}</em>
            <b>{active ? "✓" : ""}</b>
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({ selected, batch, previous }: { selected: MetricKey[]; batch: BusinessBatch | null; previous: BusinessBatch | null }) {
  const width = 720;
  const height = 205;
  const pad = { left: 48, right: 30, top: 16, bottom: 28 };
  const points = batch?.overviewTrend ?? [];
  const previousPoints = previous?.overviewTrend ?? [];
  const pointCount = Math.max(points.length, previousPoints.length, 1);
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(pointCount - 1, 1));
  const valuesFor = (series: typeof points, key: MetricKey): Array<number | null> => series.map((point) => point.metrics[key]);
  const maxFor = (key: MetricKey) => Math.max(...[...valuesFor(points, key), ...valuesFor(previousPoints, key)].filter((value): value is number => value !== null), 1);
  const y = (key: MetricKey, value: number) => pad.top + (1 - value / maxFor(key)) * (height - pad.top - pad.bottom);
  const colors: Record<MetricKey, string> = { gmv: "#18a899", units: "#437fe2", skuOrders: "#6559e8", orders: "#df8f45" };
  const previousColors: Record<MetricKey, string> = { gmv: "#a9dfd7", units: "#a9c8f3", skuOrders: "#bbb5f0", orders: "#efc9a8" };
  const labels = points.map((point) => point.date.slice(5).replace("-", "/"));
  const items = overviewMetricItems(batch, previous);
  const axisKey = selected[0] ?? "gmv";
  const axisMax = maxFor(axisKey);
  const axisLabel = (ratio: number) => axisKey === "gmv" ? formatOverviewCurrency(axisMax * ratio, batch?.currencySymbol ?? "") : Math.round(axisMax * ratio).toLocaleString("en-GB");
  const segmentsFor = (series: typeof points, key: MetricKey) => {
    const segments: string[] = [];
    let current: string[] = [];
    valuesFor(series, key).forEach((value, index) => {
      if (value === null) { if (current.length) segments.push(current.join(" ")); current = []; }
      else current.push(`${x(index)},${y(key, value)}`);
    });
    if (current.length) segments.push(current.join(" "));
    return segments;
  };
  if (!batch || !points.length) return <div className="hf-trend hf-trend-empty">当前导出文件未提供店铺每日趋势数据</div>;
  return (
    <div className="hf-trend">
      <div className="hf-chart-legend">
        {selected.map((key) => <span key={key}><i style={{ background: colors[key] }} />本期 {items.find((item) => item.key === key)?.label}</span>)}
        {previous && selected.map((key) => <span className="previous" key={`previous-${key}`}><i style={{ background: previousColors[key] }} />对比周期 {items.find((item) => item.key === key)?.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="关键指标趋势图">
        {[0, 1, 2, 3].map((index) => {
          const lineY = pad.top + index * ((height - pad.top - pad.bottom) / 3);
          return <g key={index}><line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} /><text x={pad.left - 8} y={lineY + 4} textAnchor="end">{axisLabel(1 - index / 3)}</text></g>;
        })}
        {previous && selected.flatMap((key) => segmentsFor(previousPoints, key).map((segment, index) => <polyline className="previous" key={`previous-${key}-${index}`} points={segment} fill="none" stroke={previousColors[key]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />))}
        {selected.flatMap((key) => segmentsFor(points, key).map((segment, index) => <polyline key={`${key}-${index}`} points={segment} fill="none" stroke={colors[key]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />))}
        {labels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={height - 6} textAnchor="middle">{label}</text>)}
      </svg>
    </div>
  );
}

function KeyMetricsPanel({ batch, previous }: { batch: BusinessBatch | null; previous: BusinessBatch | null }) {
  const [selected, setSelected] = useState<MetricKey[]>(["gmv", "units"]);
  const toggle = (key: MetricKey) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  return (
    <section className="hf-panel hf-key-panel">
      <header className="hf-panel-header">
        <div><h2>关键指标</h2><p>{batch ? `导入时间：${new Date(batch.importedAt).toLocaleString("zh-CN", { hour12: false })}` : "导入时间：—"}</p></div>
        <div className="hf-period"><strong>{batch ? formatIsoDate(batch.startDate) : "--"}</strong><span>–</span><strong>{batch ? formatIsoDate(batch.endDate) : "--"}</strong><i /> <small>对比</small><strong>{previous ? `${formatIsoDate(previous.startDate)} - ${formatIsoDate(previous.endDate)}` : "暂无可比较周期"}</strong></div>
        <div className="hf-icon-tools"><button aria-label="编辑"><PencilLine size={14} /></button><button aria-label="下载"><Download size={14} /></button><button aria-label="更多"><MoreVertical size={14} /></button></div>
      </header>
      <MetricSelector selected={selected} onToggle={toggle} batch={batch} previous={previous} />
      <TrendChart selected={selected} batch={batch} previous={previous} />
    </section>
  );
}

function RankingPanel() {
  return (
    <section className="hf-panel hf-ranking-panel">
      <header><div><BarChart3 size={15} /><h2>GMV 排行榜</h2><HelpCircle size={13} /></div><p>你所在类目中 GMV 排名前的店铺</p></header>
      <div className="hf-ranking-empty"><PackageOpen size={24} /><span>当前数据源暂无类目店铺排名</span></div>
    </section>
  );
}

function BreakdownPanel({ batch }: { batch: BusinessBatch | null }) {
  const [mode, setMode] = useState<"content" | "source">("content");
  const [expanded, setExpanded] = useState<string[]>(["直播", "视频"]);
  const overviewRows = useMemo(() => {
    if (!batch) return null;
    const breakdown = batch.overviewBreakdown;
    const currency = batch.currencySymbol;
    const total = batch.overviewSummary.gmv;
    return [
      { name: "直播", value: formatOverviewCurrency(breakdown.live, currency), share: shareOf(breakdown.live, total), color: "#18a899", children: ["联盟直播", "商家直播"], childValues: [formatOverviewCurrency(breakdown.liveAffiliate, currency), formatOverviewCurrency(breakdown.liveMerchant, currency)] },
      { name: "视频", value: formatOverviewCurrency(breakdown.video, currency), share: shareOf(breakdown.video, total), color: "#f4bd45", children: ["联盟视频", "商家视频"], childValues: [formatOverviewCurrency(breakdown.videoAffiliate, currency), formatOverviewCurrency(breakdown.videoMerchant, currency)] },
      { name: "商品卡", value: formatOverviewCurrency(breakdown.productCard, currency), share: shareOf(breakdown.productCard, total), color: "#6559e8", children: [], childValues: [] },
    ];
  }, [batch]);
  const rows = overviewRows ?? [];
  const toggle = (name: string) => setExpanded((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const legend = useMemo(() => rows.map((item) => ({ name: item.name, share: item.share, color: item.color })), [rows]);
  const total = batch?.overviewSummary.gmv ?? null;
  const donutStyle = batch && total !== null && total > 0 ? { background: `conic-gradient(#6559e8 0 ${shareOf(batch.overviewBreakdown.productCard, total)}, #18a899 ${shareOf(batch.overviewBreakdown.productCard, total)} ${shareOf((batch.overviewBreakdown.productCard ?? 0) + (batch.overviewBreakdown.video ?? 0), total)}, #f4bd45 ${shareOf((batch.overviewBreakdown.productCard ?? 0) + (batch.overviewBreakdown.video ?? 0), total)} 100%)` } : undefined;
  return (
    <section className="hf-panel hf-breakdown-panel">
      <header className="hf-breakdown-header"><div><h2>GMV 拆解</h2><p>数据基于用户下单前最后一次互动的内容类型。　{batch ? `导入时间：${new Date(batch.importedAt).toLocaleString("zh-CN", { hour12: false })}` : "导入时间：—"}</p></div><div className="hf-segmented"><button className={mode === "content" ? "active" : ""} onClick={() => setMode("content")}>按内容类型</button><button className={mode === "source" ? "active" : ""} onClick={() => setMode("source")}>按订单来源</button></div></header>
      {mode === "source" ? <div className="hf-breakdown-source-empty">当前导出文件未提供订单来源拆分</div> : !batch ? <div className="hf-breakdown-source-empty">请先导入本期三份官方 Excel</div> : <div className="hf-breakdown-body">
        <div className="hf-donut-wrap"><div className={`hf-donut ${mode}`} style={donutStyle}><span><strong>GMV</strong><small>{formatOverviewCurrency(batch.overviewSummary.gmv, batch.currencySymbol)}</small></span></div></div>
        <div className="hf-donut-legend">{legend.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.share}</strong></span>)}</div>
        <div className="hf-breakdown-list">{rows.map((row) => <div className="hf-breakdown-group" key={row.name}><button className="hf-breakdown-row" onClick={() => row.children.length && toggle(row.name)}><span>{row.children.length ? expanded.includes(row.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <i className="row-indent" />}<i className="row-dot" style={{ background: row.color }} /><strong>{row.name}</strong>{row.children.length > 0 && <small>查看数据分析</small>}</span><b>{row.value}</b><em>{row.share}</em></button>{expanded.includes(row.name) && row.children.map((child, index) => <div className="hf-breakdown-child" key={child}><span><ChevronRight size={13} />{child} <small>（贡献度 {row.share}）</small></span><b>{row.childValues[index]}</b><em>--</em></div>)}</div>)}</div>
      </div>}
    </section>
  );
}

interface HighFidelityAnalyticsState {
  batches: BusinessBatch[];
  activeBatchId: string | null;
}

const initialHighFidelityState = (): HighFidelityAnalyticsState => ({ batches: [], activeBatchId: null });

function AnalyticsDataNotice({ batch, visible, onClose }: { batch: BusinessBatch | null; visible: boolean; onClose: () => void }) {
  if (!batch || !visible) return null;
  if (!batch.qualityIssues.length) return <div className="hf-parse-status">当前数据已完成本地解析</div>;
  return <div className="hf-delay-notice"><AlertTriangleIcon /><span>数据质量提示：{batch.qualityIssues.map((issue) => issue.message).join("；")}</span><button aria-label="关闭提示" onClick={onClose}><X size={14} /></button></div>;
}

type ImageSyncScope = "20" | "30" | "sold";

function AnalyticsDataManager({ batches, activeBatch, onSelectBatch, onDeleteBatch, onImport, onClose }: {
  batches: BusinessBatch[];
  activeBatch: BusinessBatch | null;
  onSelectBatch: (id: string) => void;
  onDeleteBatch: (id: string) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ImageSyncScope>("30");
  const [cacheSummary, setCacheSummary] = useState({ cached: 0, latestFetchedAt: null as string | null });
  const [syncMessage, setSyncMessage] = useState("");
  const productIds = useMemo(() => [...new Set((activeBatch?.products ?? []).map((product) => product.productId))], [activeBatch]);
  const reloadCacheSummary = () => void getProductImageCacheSummary(productIds).then(setCacheSummary);
  useEffect(reloadCacheSummary, [productIds]);
  const syncImages = async () => {
    if (!activeBatch) { setSyncMessage("请先导入一个完整周期。"); return; }
    const sorted = activeBatch.products.filter((product) => (product.card.gmv ?? 0) > 0).sort((left, right) => (right.card.gmv ?? 0) - (left.card.gmv ?? 0));
    const products = scope === "sold" ? sorted : sorted.slice(0, Number(scope));
    if (!products.length) { setSyncMessage("当前周期没有可同步的成交商品。"); return; }
    const response = await requestProductImages(products.map((product) => ({ productId: product.productId, name: product.name })));
    if (response.status === "unavailable") { setSyncMessage("未检测到图片采集插件，当前仅建立图片缓存任务。"); return; }
    await Promise.all(response.results.map((result) => saveProductImage({ ...result, fetchedAt: new Date().toISOString() })));
    reloadCacheSummary();
    setSyncMessage(response.results.length ? `已保存 ${response.results.length} 张主图。` : "图片采集插件未返回可保存的主图。");
  };
  return <aside className="hf-data-manager" aria-label="数据管理">
    <header><div><strong>数据管理</strong><small>本地保存于当前浏览器</small></div><button onClick={onClose} aria-label="关闭数据管理"><X size={15} /></button></header>
    <section><div className="hf-manager-section-heading"><div><h3>周期数据</h3><small>已保存 {batches.length} 个周期</small></div><button onClick={onImport}>导入一个周期</button></div><p className="hf-manager-import-note">一次选择同一周期的商品数据、商品卡专项、全部流量三份 Excel。</p><div className="hf-manager-batches">{batches.length ? batches.map((batch) => <article key={batch.id} className={batch.id === activeBatch?.id ? "active" : ""}><div><strong>{formatIsoDate(batch.startDate)} – {formatIsoDate(batch.endDate)}</strong>{batch.id === activeBatch?.id && <em>当前</em>}<small>文件：✓ 商品数据　✓ 商品卡专项　✓ 全部流量</small><small>导入时间：{new Date(batch.importedAt).toLocaleString("zh-CN", { hour12: false })}</small></div><footer><button disabled={batch.id === activeBatch?.id} onClick={() => onSelectBatch(batch.id)}>切换</button><button className="danger" onClick={() => onDeleteBatch(batch.id)} aria-label={`删除 ${batch.startDate} 至 ${batch.endDate}`}><Trash2 size={13} /> 删除</button></footer></article>) : <div className="hf-manager-empty">尚未导入完整周期</div>}</div></section>
    <section><div className="hf-manager-section-heading"><div><h3>商品资料缓存</h3><small>按 Product ID 跨周期复用</small></div><Image size={15} /></div><div className="hf-image-cache-status"><strong>已缓存主图：{cacheSummary.cached} / {productIds.length}</strong><span>待同步：{Math.max(0, productIds.length - cacheSummary.cached)}　失败：0</span><span>建议同步：GMV 前 30 商品</span><span>最近同步：{cacheSummary.latestFetchedAt ? new Date(cacheSummary.latestFetchedAt).toLocaleString("zh-CN", { hour12: false }) : "从未同步"}</span></div><div className="hf-image-cache-actions"><select aria-label="同步范围" value={scope} onChange={(event) => setScope(event.target.value as ImageSyncScope)}><option value="20">GMV 前 20</option><option value="30">GMV 前 30</option><option value="sold">所有有成交商品</option></select><button onClick={() => void syncImages()}>同步重点商品主图</button></div>{syncMessage && <p className="hf-image-sync-message">{syncMessage}</p>}</section>
  </aside>;
}

function AnalyticsShell() {
  const [notice, setNotice] = useState(true);
  const [state, setState, restored] = usePersistedState<HighFidelityAnalyticsState>("high-fidelity-analytics", initialHighFidelityState);
  const [overviewError, setOverviewError] = useState("");
  const overviewInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"store" | "card" | "productData">("store");
  const [cardPage, setCardPage] = useState<CardPage>("performance");
  const [selectedMetrics, setSelectedMetrics] = useState(defaultSelectedMetrics);
  const [metricDraft, setMetricDraft] = useState(defaultSelectedMetrics);
  const [metricModal, setMetricModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dataManagerOpen, setDataManagerOpen] = useState(false);
  const batches = useMemo(() => sortBatches(state.batches), [state.batches]);
  const overviewBatch = batches.find((batch) => batch.id === state.activeBatchId) ?? batches[0] ?? null;
  const previousBatch = useMemo(() => selectPreviousBatch(batches, overviewBatch), [batches, overviewBatch]);
  useEffect(() => {
    if (!restored || !batches.length || (state.activeBatchId && batches.some((batch) => batch.id === state.activeBatchId))) return;
    setState((current) => ({ ...current, activeBatchId: batches[0].id }));
  }, [batches, restored, setState, state.activeBatchId]);
  const openMetricModal = () => { setMetricDraft(selectedMetrics); setMetricModal(true); };
  const toggleMetric = (name: string) => setMetricDraft((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const importOverview = async (files: FileList | File[]) => {
    setOverviewError("");
    try {
      const next = await parseBusinessFiles(Array.from(files));
      setState((current) => {
        const saved = sortBatches([...current.batches.filter((batch) => batch.startDate !== next.startDate || batch.endDate !== next.endDate), next]);
        return { ...current, batches: saved, activeBatchId: saved[0]?.id ?? null };
      });
      setNotice(true);
    }
    catch (caught) { setOverviewError(caught instanceof Error ? caught.message : "文件解析失败，请选择同一周期的三份官方 Excel。"); }
    finally { if (overviewInput.current) overviewInput.current.value = ""; }
  };
  const selectBatch = (id: string) => { setState((current) => ({ ...current, activeBatchId: id })); setDetailProduct(null); setPeriodOpen(false); };
  const deleteBatch = (id: string) => {
    const batch = batches.find((item) => item.id === id);
    if (!batch || !window.confirm(`确定删除 ${formatIsoDate(batch.startDate)} – ${formatIsoDate(batch.endDate)} 的周期数据吗？商品图片缓存将保留。`)) return;
    setState((current) => {
      const remaining = sortBatches(current.batches.filter((item) => item.id !== id));
      return { batches: remaining, activeBatchId: current.activeBatchId === id ? remaining[0]?.id ?? null : current.activeBatchId };
    });
  };
  return (
    <main className="hf-analytics-shell">
      <header className="hf-page-header">
        <div><h1>数据分析</h1><nav aria-label="分析导航"><button className={section === "store" ? "active" : ""} onClick={() => { setSection("store"); setDetailProduct(null); }}>店铺数据分析</button><button>成长和数据分析</button><button>内容分析</button><button className={section === "card" ? "active" : ""} onClick={() => { setSection("card"); setDetailProduct(null); }}>商品卡</button><button className={section === "productData" ? "active" : ""} onClick={() => { setSection("productData"); setDetailProduct(null); }}>商品数据分析</button><button>营销数据分析</button><button>售后数据分析</button></nav></div>
        <div className="hf-date-control"><span>(GMT+08:00)</span><div className="hf-period-picker"><button onClick={() => setPeriodOpen((open) => !open)}>最近 7 天：　{overviewBatch ? `${formatIsoDate(overviewBatch.startDate)}　–　${formatIsoDate(overviewBatch.endDate)}` : "未导入周期"} <CalendarDays size={14} /></button>{periodOpen && <div className="hf-period-menu">{batches.length ? <>{batches.map((batch) => <button key={batch.id} className={batch.id === overviewBatch?.id ? "active" : ""} onClick={() => selectBatch(batch.id)}>{formatIsoDate(batch.startDate)} – {formatIsoDate(batch.endDate)}</button>)}<small>当前 {overviewBatch ? `${formatIsoDate(overviewBatch.startDate)} – ${formatIsoDate(overviewBatch.endDate)}` : "--"} · 已保存 {batches.length} 个周期</small></> : <span>尚未导入完整周期</span>}</div>}</div><small className="hf-history-count">已保存 {batches.length} 个周期</small><button className="compare-date">{previousBatch ? `对比 ${formatIsoDate(previousBatch.startDate)} – ${formatIsoDate(previousBatch.endDate)}` : "暂无可比较周期"}</button><button className="hf-data-manager-trigger" onClick={() => setDataManagerOpen((open) => !open)}>数据管理</button>{section === "store" && <button className="hf-overview-import" onClick={() => overviewInput.current?.click()}>导入一个周期</button>}{dataManagerOpen && <AnalyticsDataManager batches={batches} activeBatch={overviewBatch} onSelectBatch={selectBatch} onDeleteBatch={deleteBatch} onImport={() => { setDataManagerOpen(false); overviewInput.current?.click(); }} onClose={() => setDataManagerOpen(false)} />}</div>
      </header>
      {section === "productData" ? <><div className="hf-main-content"><AnalyticsDataNotice batch={overviewBatch} visible={notice} onClose={() => setNotice(false)} /></div><ProductAnalyticsList batch={overviewBatch} previousBatch={previousBatch} batches={batches} /></> : <div className="hf-analytics-layout">
        {section === "store" ? <AnalyticsSidebar /> : <ProductCardSidebar page={cardPage} onPage={(page) => { setCardPage(page); setDetailProduct(null); }} />}
        <div className="hf-main-content">
          <AnalyticsDataNotice batch={overviewBatch} visible={notice} onClose={() => setNotice(false)} />
          {section === "store" ? <><div className="hf-dashboard-grid"><KeyMetricsPanel batch={overviewBatch} previous={previousBatch} /><RankingPanel /></div><BreakdownPanel batch={overviewBatch} />{overviewError && <div className="hf-overview-error" role="alert"><X size={13} />{overviewError}</div>}</> : detailProduct ? <ProductDetailPlaceholder name={detailProduct} onBack={() => setDetailProduct(null)} /> : cardPage === "performance" ? <CardPerformancePage batch={overviewBatch} previous={previousBatch} onConfigure={openMetricModal} /> : <CardDetailsPage batch={overviewBatch} onConfigure={openMetricModal} onOpenProduct={setDetailProduct} />}
        </div>
      </div>}
      <input ref={overviewInput} type="file" multiple accept=".xlsx,.xls" hidden onChange={(event) => void importOverview(event.target.files ?? [])} />
      {metricModal && <MetricModal draft={metricDraft} onToggle={toggleMetric} onRemove={(name) => setMetricDraft((current) => current.filter((item) => item !== name))} onCancel={() => { setMetricDraft(selectedMetrics); setMetricModal(false); }} onConfirm={() => { setSelectedMetrics(metricDraft); setMetricModal(false); }} />}
    </main>
  );
}

function AlertTriangleIcon() {
  return <span className="hf-alert-icon">!</span>;
}

export default function AnalyticsPrototype({ hidden = false }: { hidden?: boolean }) {
  return <section className="hf-page" hidden={hidden} aria-hidden={hidden}><div className="hf-utility-rail" aria-hidden="true"><Store size={15} /><ShoppingBag size={15} /><Users size={15} /><Bell size={15} /><Info size={15} /></div><AnalyticsShell /></section>;
}
