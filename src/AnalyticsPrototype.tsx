import { useMemo, useRef, useState } from "react";
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
  Info,
  MoreVertical,
  PackageOpen,
  PencilLine,
  Search,
  Settings2,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import "./analyticsPrototype.css";
import ProductAnalyticsList from "./ProductAnalyticsList";
import { parseBusinessFiles } from "./businessParser";
import type { BusinessBatch, BusinessProductRecord } from "./types";

type MetricKey = "gmv" | "units" | "skuOrders" | "orders";
type CardPage = "performance" | "details";

const metrics: Array<{ key: MetricKey; label: string; value: string; color: string }> = [
  { key: "gmv", label: "GMV", value: "RM5.99", color: "#6559e8" },
  { key: "units", label: "商品成交件数", value: "1", color: "#2e9f86" },
  { key: "skuOrders", label: "SKU 订单数", value: "1", color: "#4d83dc" },
  { key: "orders", label: "订单数", value: "1", color: "#df8f45" },
];

const overviewLabels: Record<MetricKey, string> = { gmv: "GMV", units: "商品成交件数", skuOrders: "SKU 订单数", orders: "订单数" };
const overviewColors: Record<MetricKey, string> = { gmv: "#6559e8", units: "#2e9f86", skuOrders: "#4d83dc", orders: "#df8f45" };
const formatOverviewCurrency = (value: number | null, symbol: string): string => value === null ? "—" : `${symbol}${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatOverviewValue = (key: MetricKey, value: number | null, symbol: string): string => key === "gmv" ? formatOverviewCurrency(value, symbol) : value === null ? "—" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const formatIsoDate = (value: string): string => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3");
const overviewMetricItems = (batch: BusinessBatch | null) => metrics.map((metric) => ({ ...metric, label: overviewLabels[metric.key], value: batch ? formatOverviewValue(metric.key, batch.overviewSummary[metric.key], batch.currencySymbol) : metric.value, delta: batch?.overviewComparison?.growth[metric.key] ?? null }));
const shareOf = (value: number | null, total: number | null): string => value === null || total === null || total === 0 ? "—" : `${Math.round((value / total) * 1000) / 10}%`;

const trendData: Record<MetricKey, number[]> = {
  gmv: [0, 5.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  units: [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  skuOrders: [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  orders: [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
};

const shops = [
  ["The Daily Edit MY", "▲ 78", "daily"],
  ["Switch Official Store", "0", "switch"],
  ["Machines Official Store", "0", "machines"],
  ["Xiaomi Malaysia", "0", "xiaomi"],
  ["GOOJODOQ.Store", "0", "goo"],
  ["UgreenOfficialShop", "0", "ugreen"],
];

const contentBreakdown = [
  { name: "直播", value: "RM0.00", share: "0%", color: "#18a899", children: ["联盟直播", "商家直播"], childValues: ["RM0.00", "RM0.00"] },
  { name: "视频", value: "RM0.00", share: "0%", color: "#f4bd45", children: ["联盟视频", "商家视频"], childValues: ["RM0.00", "RM0.00"] },
  { name: "商品卡", value: "RM5.99", share: "100%", color: "#6559e8", children: [], childValues: [] },
];

const sourceBreakdown = [
  { name: "商品卡订单", value: "RM5.99", share: "100%", color: "#6559e8", children: ["商城", "店铺页面"], childValues: ["RM0.00", "RM0.00"] },
  { name: "内容订单", value: "RM0.00", share: "0%", color: "#18a899", children: ["直播", "视频"], childValues: ["RM0.00", "RM0.00"] },
  { name: "其他", value: "RM0.00", share: "0%", color: "#b9c0cb", children: [], childValues: [] },
];

const cardKpis = [
  { label: "曝光用户数", value: "6.01K", delta: "▼ 14.3%", rank: "你已超过 85% 的同行商家" },
  { label: "日客户数", value: "16", delta: "▼ 42.86%", rank: "你已超过 85% 的同行商家" },
  { label: "GMV", value: "RM169.63", delta: "▼ 47.28%", rank: "你已超过 70% 的同行商家" },
  { label: "曝光到成交转化率", value: "0.27%", delta: "▼ 33.32%", rank: "你已超过 80% 的同行商家" },
];

const trafficSources = [
  ["搜索", "49.85% | 4.87K", "3.48K", "RM88.63", "0.31%"],
  ["推荐", "32.10% | 3.13K", "2.33K", "RM57.29", "0.24%"],
  ["店铺", "3.65% | 356", "57", "RM0.00", "0%"],
  ["活动", "1.00% | 98", "69", "RM0.00", "0%"],
  ["其他", "13.40% | 1.31K", "720", "RM23.71", "0.18%"],
];

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

function CardPerformancePage({ onConfigure }: { onConfigure: () => void }) {
  const [compare, setCompare] = useState(false);
  return (
    <div className="hf-card-page">
      <section className="hf-panel hf-card-kpi-panel">
        <header className="hf-card-section-header"><div><h2>关键指标</h2><button className="hf-help-link">什么是商品卡？ <ChevronRight size={13} /></button></div><div className="hf-card-tools"><label className="hf-check-label"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /> 对比趋势</label><button onClick={onConfigure}><Settings2 size={13} /> 配置指标</button><button><Download size={13} /> 导出数据</button><button className="icon-only" aria-label="其他操作"><MoreVertical size={14} /></button></div></header>
        <div className="hf-card-kpis">{cardKpis.map((item) => <article key={item.label}><span>{item.label} <HelpCircle size={12} /></span><strong>{item.value}</strong><small>较上一周期　<em>{item.delta}</em></small><p>{item.rank.replace(/\d+%/, "")}<b>{item.rank.match(/\d+%/)?.[0]}</b> 的同行商家</p></article>)}</div>
      </section>
      <section className="hf-panel hf-traffic-panel">
        <header className="hf-card-section-header"><h2>流量来源</h2><PanelTools onConfigure={onConfigure} exportLabel={false} /></header>
        <div className="hf-table-scroll"><table className="hf-traffic-table"><thead><tr><th>流量来源</th><th>页面浏览次数比率｜浏览次数 <ArrowDown size={12} /></th><th>曝光用户数 <ArrowDown size={12} /></th><th>GMV <ArrowDown size={12} /></th><th>曝光到成交转化率</th><th>操作</th></tr></thead><tbody>{trafficSources.map((row, index) => <tr key={row[0]}><td><span className={index < 2 || index === 3 ? "expandable" : ""}>{index < 2 || index === 3 ? <ChevronRight size={13} /> : null}{row[0]} <HelpCircle size={11} /></span></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td><td><button>查看趋势</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="hf-panel hf-potential-panel"><header className="hf-card-section-header"><div><h2>高潜力商品卡 <HelpCircle size={12} /></h2><button className="hf-diagnosis-link">了解更多诊断信息 <ChevronRight size={13} /></button></div><PanelTools onConfigure={onConfigure} /></header><table><thead><tr><th>商品卡名称</th><th>前 3 项建议操作</th><th>过去 7 天访问人数</th><th>GMV</th><th>操作</th></tr></thead></table><div className="hf-potential-empty"><PackageOpen size={28} /><span>暂无数据</span></div></section>
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
      <div className="hf-product-table-wrap"><table className="hf-product-table"><thead><tr><th>商品卡名称 <HelpCircle size={11} /></th><th className={sort.field === "uniqueImpressions" ? "sorted" : ""}><button onClick={() => setSortField("uniqueImpressions")}>曝光用户数 {sortMark("uniqueImpressions")}</button></th><th className={sort.field === "uniqueClicks" ? "sorted" : ""}><button onClick={() => setSortField("uniqueClicks")}>点击人数 {sortMark("uniqueClicks")}</button></th><th className={sort.field === "uniqueCtr" ? "sorted" : ""}><button onClick={() => setSortField("uniqueCtr")}>曝光到点击转化率 {sortMark("uniqueCtr")}</button></th><th className={sort.field === "customers" ? "sorted" : ""}><button onClick={() => setSortField("customers")}>日客户数 {sortMark("customers")}</button></th><th>SKU</th><th>操作</th></tr></thead><tbody>{visible.map((product) => <tr key={product.productId}><td><div className="hf-product-identity"><i className="hf-thumb lavender">{product.name.slice(0, 1)}</i><span><strong>{product.name}</strong><small>ID：{product.productId} <button aria-label="复制 Product ID"><Copy size={11} /></button></small><em className="hf-real-status">{product.publishStatus || "未填写"}</em></span></div></td><td className={sort.field === "uniqueImpressions" ? "sorted" : ""}>{detailCount(product.card.uniqueImpressions)}</td><td className={sort.field === "uniqueClicks" ? "sorted" : ""}>{detailCount(product.card.uniqueClicks)}</td><td className={sort.field === "uniqueCtr" ? "sorted" : ""}>{detailRate(product.card.uniqueCtr)}</td><td className={sort.field === "customers" ? "sorted" : ""}>{detailCount(product.card.customers)}</td><td>--</td><td><button className="hf-detail-action" onClick={() => onOpenProduct(product.name)}>详情</button></td></tr>)}</tbody></table>{!visible.length && <div className="hf-real-empty">{batch ? "没有符合条件的真实商品数据" : "请先在店铺数据分析首页导入三份官方 Excel"}</div>}</div>
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

function MetricSelector({ selected, onToggle, batch }: { selected: MetricKey[]; onToggle: (key: MetricKey) => void; batch: BusinessBatch | null }) {
  const items = overviewMetricItems(batch);
  return (
    <div className="hf-metric-row">
      {items.map((metric) => {
        const active = selected.includes(metric.key);
        return (
          <button key={metric.key} className={active ? "selected" : ""} onClick={() => onToggle(metric.key)}>
            {active && <i style={{ background: metric.color }} />}
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={metric.delta === null ? "neutral" : metric.delta > 0 ? "positive" : metric.delta < 0 ? "negative" : "neutral"}>{metric.delta === null ? "—" : `${metric.delta > 0 ? "▲" : metric.delta < 0 ? "▼" : "—"} ${Math.abs(metric.delta).toFixed(2)}%`}</em>
            <b>{active ? "✓" : ""}</b>
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({ selected, batch }: { selected: MetricKey[]; batch: BusinessBatch | null }) {
  const width = 720;
  const height = 205;
  const pad = { left: 48, right: 30, top: 16, bottom: 28 };
  const points = batch?.overviewTrend ?? [];
  const pointCount = batch ? points.length : trendData.gmv.length;
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(pointCount - 1, 1));
  const valuesFor = (key: MetricKey): Array<number | null> => batch ? points.map((point) => point.metrics[key]) : trendData[key];
  const maxFor = (key: MetricKey) => Math.max(...valuesFor(key).filter((value): value is number => value !== null), 1);
  const y = (key: MetricKey, value: number) => pad.top + (1 - value / maxFor(key)) * (height - pad.top - pad.bottom);
  const colors: Record<MetricKey, string> = { gmv: "#18a899", units: "#437fe2", skuOrders: "#6559e8", orders: "#df8f45" };
  const labels = batch ? points.map((point) => point.date.slice(5).replace("-", "/")) : ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  const items = overviewMetricItems(batch);
  const axisKey = selected[0] ?? "gmv";
  const axisMax = maxFor(axisKey);
  const axisLabel = (ratio: number) => axisKey === "gmv" ? formatOverviewCurrency(axisMax * ratio, batch?.currencySymbol ?? "RM") : Math.round(axisMax * ratio).toLocaleString("en-GB");
  return (
    <div className="hf-trend">
      <div className="hf-chart-legend">
        {selected.map((key) => <span key={key}><i style={{ background: colors[key] }} /> {batch ? "本期" : "今日"} {items.find((item) => item.key === key)?.label}</span>)}
        {selected.map((key) => <span className="previous" key={`previous-${key}`}><i /> {batch ? "对比周期" : "昨日"} {items.find((item) => item.key === key)?.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="关键指标趋势图">
        {[0, 1, 2, 3].map((index) => {
          const lineY = pad.top + index * ((height - pad.top - pad.bottom) / 3);
          return <g key={index}><line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} /><text x={pad.left - 8} y={lineY + 4} textAnchor="end">{axisLabel(1 - index / 3)}</text></g>;
        })}
        {selected.map((key) => <polyline key={key} points={valuesFor(key).flatMap((item, index) => item === null ? [] : [`${x(index)},${y(key, item)}`]).join(" ")} fill="none" stroke={colors[key]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
        {labels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={height - 6} textAnchor="middle">{label}</text>)}
      </svg>
    </div>
  );
}

function KeyMetricsPanel({ batch }: { batch: BusinessBatch | null }) {
  const [selected, setSelected] = useState<MetricKey[]>(["gmv", "units"]);
  const toggle = (key: MetricKey) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  return (
    <section className="hf-panel hf-key-panel">
      <header className="hf-panel-header">
        <div><h2>关键指标</h2><p>{batch ? `导入时间：${new Date(batch.importedAt).toLocaleString("zh-CN", { hour12: false })}` : "导入时间：—"}</p></div>
        <div className="hf-period"><strong>{batch ? formatIsoDate(batch.startDate) : "2026/08/29"}</strong><span>–</span><strong>{batch ? formatIsoDate(batch.endDate) : "2026/08/29"}</strong><i /> <small>对比</small><strong>{batch?.overviewComparison ? `${formatIsoDate(batch.overviewComparison.startDate)} - ${formatIsoDate(batch.overviewComparison.endDate)}` : "—"}</strong></div>
        <div className="hf-icon-tools"><button aria-label="编辑"><PencilLine size={14} /></button><button aria-label="下载"><Download size={14} /></button><button aria-label="更多"><MoreVertical size={14} /></button></div>
      </header>
      <MetricSelector selected={selected} onToggle={toggle} batch={batch} />
      <TrendChart selected={selected} batch={batch} />
    </section>
  );
}

function RankingPanel() {
  return (
    <section className="hf-panel hf-ranking-panel">
      <header><div><BarChart3 size={15} /><h2>GMV 排行榜</h2><HelpCircle size={13} /></div><p>你所在类目中 GMV 排名前的店铺</p></header>
      <ol>{shops.map(([name, score, avatar], index) => <li key={name}><span className={`rank rank-${index + 1}`}>{index + 1}</span><i className={`hf-shop-avatar ${avatar}`}>{name.slice(0, 1)}</i><strong>{name}</strong><b>{score}</b></li>)}</ol>
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
  const rows = mode === "content" ? (overviewRows ?? contentBreakdown) : sourceBreakdown;
  const toggle = (name: string) => setExpanded((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const legend = useMemo(() => rows.map((item) => ({ name: item.name, share: item.share, color: item.color })), [rows]);
  return (
    <section className="hf-panel hf-breakdown-panel">
      <header className="hf-breakdown-header"><div><h2>GMV 拆解</h2><p>数据基于用户下单前最后一次互动的内容类型。　{batch ? `导入时间：${new Date(batch.importedAt).toLocaleString("zh-CN", { hour12: false })}` : "导入时间：—"}</p></div><div className="hf-segmented"><button className={mode === "content" ? "active" : ""} onClick={() => setMode("content")}>按内容类型</button><button className={mode === "source" ? "active" : ""} onClick={() => setMode("source")}>按订单来源</button></div></header>
      <div className="hf-breakdown-body">
        <div className="hf-donut-wrap"><div className={`hf-donut ${mode}`} style={overviewRows && mode === "content" ? { background: `conic-gradient(#6559e8 0 ${shareOf(batch?.overviewBreakdown.productCard ?? null, batch?.overviewSummary.gmv ?? null)}, #18a899 ${shareOf(batch?.overviewBreakdown.productCard ?? null, batch?.overviewSummary.gmv ?? null)} ${shareOf((batch?.overviewBreakdown.productCard ?? 0) + (batch?.overviewBreakdown.video ?? 0), batch?.overviewSummary.gmv ?? null)}, #f4bd45 ${shareOf((batch?.overviewBreakdown.productCard ?? 0) + (batch?.overviewBreakdown.video ?? 0), batch?.overviewSummary.gmv ?? null)} 100%)` } : undefined}><span><strong>GMV</strong><small>{batch ? formatOverviewCurrency(batch.overviewSummary.gmv, batch.currencySymbol) : "RM5.99"}</small></span></div></div>
        <div className="hf-donut-legend">{legend.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.share}</strong></span>)}</div>
        <div className="hf-breakdown-list">{rows.map((row) => <div className="hf-breakdown-group" key={row.name}><button className="hf-breakdown-row" onClick={() => row.children.length && toggle(row.name)}><span>{row.children.length ? expanded.includes(row.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <i className="row-indent" />}<i className="row-dot" style={{ background: row.color }} /><strong>{row.name}</strong>{row.children.length > 0 && <small>查看数据分析</small>}</span><b>{row.value}</b><em>▼ {row.share}</em><TrendingUp size={13} /></button>{expanded.includes(row.name) && row.children.map((child, index) => <div className="hf-breakdown-child" key={child}><span><ChevronRight size={13} />{child} <small>（贡献度 {row.share}）</small></span><b>{row.childValues?.[index] ?? (batch ? formatOverviewCurrency(0, batch.currencySymbol) : "RM0.00")}</b><em>◆ --</em></div>)}</div>)}</div>
      </div>
    </section>
  );
}

function AnalyticsShell() {
  const [notice, setNotice] = useState(true);
  const [overviewBatch, setOverviewBatch] = useState<BusinessBatch | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const overviewInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"store" | "card" | "productData">("store");
  const [cardPage, setCardPage] = useState<CardPage>("performance");
  const [selectedMetrics, setSelectedMetrics] = useState(defaultSelectedMetrics);
  const [metricDraft, setMetricDraft] = useState(defaultSelectedMetrics);
  const [metricModal, setMetricModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<string | null>(null);
  const openMetricModal = () => { setMetricDraft(selectedMetrics); setMetricModal(true); };
  const toggleMetric = (name: string) => setMetricDraft((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const importOverview = async (files: FileList | File[]) => {
    setOverviewError("");
    try { const next = await parseBusinessFiles(Array.from(files)); setOverviewBatch(next); }
    catch (caught) { setOverviewError(caught instanceof Error ? caught.message : "文件解析失败，请选择同一周期的三份官方 Excel。"); }
    finally { if (overviewInput.current) overviewInput.current.value = ""; }
  };
  return (
    <main className="hf-analytics-shell">
      <header className="hf-page-header">
        <div><h1>数据分析</h1><nav aria-label="分析导航"><button className={section === "store" ? "active" : ""} onClick={() => { setSection("store"); setDetailProduct(null); }}>店铺数据分析</button><button>成长和数据分析</button><button>内容分析</button><button className={section === "card" ? "active" : ""} onClick={() => { setSection("card"); setDetailProduct(null); }}>商品卡</button><button className={section === "productData" ? "active" : ""} onClick={() => { setSection("productData"); setDetailProduct(null); }}>商品数据分析</button><button>营销数据分析</button><button>售后数据分析</button></nav></div>
        <div className="hf-date-control"><span>(GMT+08:00)</span><button>最近 7 天：　{overviewBatch ? `${formatIsoDate(overviewBatch.startDate)}　–　${formatIsoDate(overviewBatch.endDate)}` : "2026/08/23　–　2026/08/29"} <CalendarDays size={14} /></button><button className="compare-date">较前 7 日</button>{section === "store" && <button className="hf-overview-import" onClick={() => overviewInput.current?.click()}>导入本期数据</button>}</div>
      </header>
      {section === "productData" ? <><div className="hf-main-content"><>{notice && <div className="hf-delay-notice"><AlertTriangleIcon /><span>目前，部分数据更新存在延迟，因此展示的数据可能无法反映最新的业务状态。我们的团队正在努力解决此问题。请稍后再来查看。</span><button aria-label="关闭提示" onClick={() => setNotice(false)}><X size={14} /></button></div>}</></div><ProductAnalyticsList /></> : <div className="hf-analytics-layout">
        {section === "store" ? <AnalyticsSidebar /> : <ProductCardSidebar page={cardPage} onPage={(page) => { setCardPage(page); setDetailProduct(null); }} />}
        <div className="hf-main-content">
          {notice && <div className="hf-delay-notice"><AlertTriangleIcon /><span>目前，部分数据更新存在延迟，因此展示的数据可能无法反映最新的业务状态。我们的团队正在努力解决此问题。请稍后再来查看。</span><button aria-label="关闭提示" onClick={() => setNotice(false)}><X size={14} /></button></div>}
          {section === "store" ? <><div className="hf-dashboard-grid"><KeyMetricsPanel batch={overviewBatch} /><RankingPanel /></div><BreakdownPanel batch={overviewBatch} />{overviewError && <div className="hf-overview-error" role="alert"><X size={13} />{overviewError}</div>}</> : detailProduct ? <ProductDetailPlaceholder name={detailProduct} onBack={() => setDetailProduct(null)} /> : cardPage === "performance" ? <CardPerformancePage onConfigure={openMetricModal} /> : <CardDetailsPage batch={overviewBatch} onConfigure={openMetricModal} onOpenProduct={setDetailProduct} />}
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
