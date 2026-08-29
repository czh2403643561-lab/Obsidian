import { useMemo, useState } from "react";
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

type MetricKey = "gmv" | "units" | "skuOrders" | "orders";
type CardPage = "performance" | "details";

const metrics: Array<{ key: MetricKey; label: string; value: string; color: string }> = [
  { key: "gmv", label: "GMV", value: "RM5.99", color: "#6559e8" },
  { key: "units", label: "商品成交件数", value: "1", color: "#2e9f86" },
  { key: "skuOrders", label: "SKU 订单数", value: "1", color: "#4d83dc" },
  { key: "orders", label: "订单数", value: "1", color: "#df8f45" },
];

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
  { name: "直播", value: "RM0.00", share: "0%", color: "#18a899", children: ["联盟直播", "商家直播"] },
  { name: "视频", value: "RM0.00", share: "0%", color: "#f4bd45", children: ["联盟视频", "商家视频"] },
  { name: "商品卡", value: "RM5.99", share: "100%", color: "#6559e8", children: [] },
];

const sourceBreakdown = [
  { name: "商品卡订单", value: "RM5.99", share: "100%", color: "#6559e8", children: ["商城", "店铺页面"] },
  { name: "内容订单", value: "RM0.00", share: "0%", color: "#18a899", children: ["直播", "视频"] },
  { name: "其他", value: "RM0.00", share: "0%", color: "#b9c0cb", children: [] },
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

const mockProducts = [
  ["Casing Silikon Cecair Premium Samsung S26 S25 S24 Ultra", "1735359360857703966", "1.2K", "110", "9.17%", "3", "6", "lavender"],
  ["Kes Magnetik Berlian Berkilau untuk Telefon", "1735176057008981534", "1.10K", "51", "4.63%", "3", "4", "amber"],
  ["Sarung telefon silikon lembut premium", "1735175264413320734", "1.01K", "46", "4.58%", "6", "4", "rose"],
  ["Sarung Telefon 16 Tukar 17 Pro Max", "1735359267280750110", "335", "19", "5.67%", "1", "1", "orange"],
  ["Sarung untuk Samsung, Serasi Pelbagai Model", "1735110064976332318", "290", "15", "5.17%", "0", "0", "slate"],
  ["Sarung lembut TPU ultra nipis Redmi", "1735198338034861598", "259", "21", "8.11%", "0", "0", "blue"],
  ["Sarung Telefon untuk Redmi kalis jatuh", "1735201886840194590", "257", "3", "1.17%", "1", "1", "teal"],
  ["Sarung Telefon Lutsinar Anti Calar", "1735359291165894174", "223", "8", "3.59%", "0", "0", "mint"],
  ["Minimal titik gelombang angin untuk iPhone", "1735176882664791343", "211", "10", "4.74%", "0", "0", "cream"],
  ["Cooling Master Sarung Magnetik Premium", "1735201605488510494", "196", "17", "8.67%", "0", "0", "navy"],
  ["Clear Space Casing Telefon Shockproof", "1735256370918720345", "185", "12", "6.49%", "0", "0", "violet"],
  ["Sarung Ring Stand untuk Android", "1735289076110369271", "172", "9", "5.23%", "0", "0", "coral"],
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

function CardDetailsPage({ onConfigure, onOpenProduct }: { onConfigure: () => void; onOpenProduct: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [diagnosis, setDiagnosis] = useState(false);
  const [page, setPage] = useState(1);
  const list = mockProducts.filter((item) => !query || item[0].toLowerCase().includes(query.toLowerCase()) || item[1].includes(query));
  const visible = list.slice((page - 1) * 10, page * 10);
  return (
    <section className="hf-panel hf-product-list-panel">
      <header><h2>商品卡列表</h2></header>
      <div className="hf-product-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="输入商品 ID 或商品名称" /></div>
      <div className="hf-product-toolbar"><div className="hf-product-tabs"><button className={!favorite ? "active" : ""} onClick={() => setFavorite(false)}>全部</button><button className={favorite ? "active" : ""} onClick={() => setFavorite(true)}><Star size={12} /> 已收藏</button></div><span>类目</span><div className="hf-category-select"><strong>全部类目</strong><X size={12} /><ChevronDown size={13} /></div><div className="hf-product-actions"><label className="hf-switch-label"><button className={diagnosis ? "on" : ""} onClick={() => setDiagnosis(!diagnosis)}><i /></button>诊断模式 <HelpCircle size={12} /></label><button onClick={onConfigure}><Settings2 size={13} /> 配置指标</button><button><Download size={13} /> 导出数据</button><button className="icon-only"><MoreVertical size={14} /></button></div></div>
      <div className="hf-product-table-wrap"><table className="hf-product-table"><thead><tr><th>商品卡名称 <HelpCircle size={11} /></th><th>曝光用户数 <ArrowDown size={12} /></th><th>点击人数</th><th>曝光到点击转化率</th><th>日客户数</th><th>SKU</th><th>操作</th></tr></thead><tbody>{visible.map((item) => <tr key={item[1]}><td><div className="hf-product-identity"><i className={`hf-thumb ${item[7]}`}>{item[0].slice(0, 1)}</i><span><strong>{item[0]}</strong><small>ID：{item[1]} <button aria-label="复制 Product ID"><Copy size={11} /></button></small></span></div></td><td>{item[2]}</td><td>{item[3]}</td><td>{item[4]}</td><td>{item[5]}</td><td>{item[6]}</td><td><button className="hf-detail-action" onClick={() => onOpenProduct(item[0])}>详情</button></td></tr>)}</tbody></table></div>
      <footer className="hf-pagination"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button>{[1, 2, 3].map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button onClick={() => setPage((current) => Math.min(3, current + 1))}><ChevronRight size={13} /></button><select aria-label="每页条数" defaultValue="10"><option value="10">10/Page</option><option value="20">20/Page</option></select></footer>
    </section>
  );
}

function ProductDetailPlaceholder({ name, onBack }: { name: string; onBack: () => void }) {
  return <section className="hf-panel hf-product-placeholder"><button onClick={onBack}><ChevronLeft size={14} /> 返回商品卡列表</button><div><PackageOpen size={28} /><h2>{name}</h2><p>单商品详情将在下一阶段实现。</p></div></section>;
}

function MetricModal({ draft, onToggle, onRemove, onCancel, onConfirm }: { draft: string[]; onToggle: (name: string) => void; onRemove: (name: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="hf-modal-backdrop" role="presentation"><section className="hf-metric-modal" role="dialog" aria-modal="true" aria-labelledby="hf-metric-title"><header><h2 id="hf-metric-title">自定义指标</h2></header><div className="hf-modal-body"><div className="hf-metric-picker"><div className="hf-modal-column-title"><strong>选择指标</strong><button>↻ 恢复默认</button></div>{metricGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map((name) => <label key={name}><input type="checkbox" checked={draft.includes(name)} onChange={() => onToggle(name)} /><span>{name}</span></label>)}</div></section>)}<div className="hf-placeholder-groups">{["商家直播表现", "商家视频表现", "商家商品卡表现", "联盟表现"].map((name) => <section key={name}><h3>{name}</h3><p>当前阶段仅保留分类位置</p></section>)}</div></div><aside className="hf-selected-metrics"><div className="hf-modal-column-title"><strong>已选择 {draft.length} 个指标</strong></div><div>{draft.map((name) => <span key={name}><strong>{name}</strong><button aria-label={`移除${name}`} onClick={() => onRemove(name)}><X size={12} /></button></span>)}</div></aside></div><footer><button onClick={onCancel}>取消</button><button className="primary" onClick={onConfirm}>确定</button></footer></section></div>;
}

function MetricSelector({ selected, onToggle }: { selected: MetricKey[]; onToggle: (key: MetricKey) => void }) {
  return (
    <div className="hf-metric-row">
      {metrics.map((metric) => {
        const active = selected.includes(metric.key);
        return (
          <button key={metric.key} className={active ? "selected" : ""} onClick={() => onToggle(metric.key)}>
            {active && <i style={{ background: metric.color }} />}
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={metric.key === "gmv" ? "positive" : "neutral"}>{metric.key === "gmv" ? "▲ 65.03%" : "▲ --"}</em>
            <b>{active ? "✓" : ""}</b>
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({ selected }: { selected: MetricKey[] }) {
  const width = 720;
  const height = 205;
  const pad = { left: 48, right: 30, top: 16, bottom: 28 };
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / 13);
  const maxFor = (key: MetricKey) => Math.max(...trendData[key], 1);
  const y = (key: MetricKey, value: number) => pad.top + (1 - value / maxFor(key)) * (height - pad.top - pad.bottom);
  const colors: Record<MetricKey, string> = { gmv: "#18a899", units: "#437fe2", skuOrders: "#6559e8", orders: "#df8f45" };
  const labels = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  return (
    <div className="hf-trend">
      <div className="hf-chart-legend">
        {selected.map((key) => <span key={key}><i style={{ background: colors[key] }} /> 今日 {metrics.find((item) => item.key === key)?.label}</span>)}
        {selected.map((key) => <span className="previous" key={`previous-${key}`}><i /> 昨日 {metrics.find((item) => item.key === key)?.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="关键指标趋势图">
        {[0, 1, 2, 3].map((index) => {
          const lineY = pad.top + index * ((height - pad.top - pad.bottom) / 3);
          return <g key={index}><line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} /><text x={pad.left - 8} y={lineY + 4} textAnchor="end">{index === 0 ? "RM21" : index === 1 ? "RM14" : index === 2 ? "RM7" : "RM0"}</text></g>;
        })}
        {selected.map((key) => <polyline key={key} points={trendData[key].map((item, index) => `${x(index)},${y(key, item)}`).join(" ")} fill="none" stroke={colors[key]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
        {labels.map((label, index) => <text key={label} x={pad.left + index * ((width - pad.left - pad.right) / 7)} y={height - 6} textAnchor="middle">{label}</text>)}
      </svg>
    </div>
  );
}

function KeyMetricsPanel() {
  const [selected, setSelected] = useState<MetricKey[]>(["gmv", "units"]);
  const toggle = (key: MetricKey) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  return (
    <section className="hf-panel hf-key-panel">
      <header className="hf-panel-header">
        <div><h2>关键指标</h2><p>更新时间：2026年8月29日 22:14</p></div>
        <div className="hf-period"><strong>2026/08/29</strong><span>–</span><strong>2026/08/29</strong><i /> <small>对比</small><strong>2026/08/28 - 2026/08/28</strong></div>
        <div className="hf-icon-tools"><button aria-label="编辑"><PencilLine size={14} /></button><button aria-label="下载"><Download size={14} /></button><button aria-label="更多"><MoreVertical size={14} /></button></div>
      </header>
      <MetricSelector selected={selected} onToggle={toggle} />
      <TrendChart selected={selected} />
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

function BreakdownPanel() {
  const [mode, setMode] = useState<"content" | "source">("content");
  const [expanded, setExpanded] = useState<string[]>(["直播", "视频"]);
  const rows = mode === "content" ? contentBreakdown : sourceBreakdown;
  const toggle = (name: string) => setExpanded((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const legend = useMemo(() => rows.map((item) => ({ name: item.name, share: item.share, color: item.color })), [rows]);
  return (
    <section className="hf-panel hf-breakdown-panel">
      <header className="hf-breakdown-header"><div><h2>GMV 拆解</h2><p>数据基于用户下单前最后一次互动的内容类型。　更新时间：2026年8月29日 22:14</p></div><div className="hf-segmented"><button className={mode === "content" ? "active" : ""} onClick={() => setMode("content")}>按内容类型</button><button className={mode === "source" ? "active" : ""} onClick={() => setMode("source")}>按订单来源</button></div></header>
      <div className="hf-breakdown-body">
        <div className="hf-donut-wrap"><div className={`hf-donut ${mode}`}><span><strong>GMV</strong><small>RM5.99</small></span></div></div>
        <div className="hf-donut-legend">{legend.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.share}</strong></span>)}</div>
        <div className="hf-breakdown-list">{rows.map((row) => <div className="hf-breakdown-group" key={row.name}><button className="hf-breakdown-row" onClick={() => row.children.length && toggle(row.name)}><span>{row.children.length ? expanded.includes(row.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <i className="row-indent" />}<i className="row-dot" style={{ background: row.color }} /><strong>{row.name}</strong>{row.children.length > 0 && <small>查看数据分析</small>}</span><b>{row.value}</b><em>▼ {row.share}</em><TrendingUp size={13} /></button>{expanded.includes(row.name) && row.children.map((child) => <div className="hf-breakdown-child" key={child}><span><ChevronRight size={13} />{child} <small>（贡献度 0%）</small></span><b>RM0.00</b><em>◆ --</em></div>)}</div>)}</div>
      </div>
    </section>
  );
}

function AnalyticsShell() {
  const [notice, setNotice] = useState(true);
  const [section, setSection] = useState<"store" | "card">("store");
  const [cardPage, setCardPage] = useState<CardPage>("performance");
  const [selectedMetrics, setSelectedMetrics] = useState(defaultSelectedMetrics);
  const [metricDraft, setMetricDraft] = useState(defaultSelectedMetrics);
  const [metricModal, setMetricModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<string | null>(null);
  const openMetricModal = () => { setMetricDraft(selectedMetrics); setMetricModal(true); };
  const toggleMetric = (name: string) => setMetricDraft((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  return (
    <main className="hf-analytics-shell">
      <header className="hf-page-header">
        <div><h1>数据分析</h1><nav aria-label="分析导航"><button className={section === "store" ? "active" : ""} onClick={() => { setSection("store"); setDetailProduct(null); }}>店铺数据分析</button><button>成长和数据分析</button><button>内容分析</button><button className={section === "card" ? "active" : ""} onClick={() => { setSection("card"); setDetailProduct(null); }}>商品卡</button><button>商品数据分析</button><button>营销数据分析</button><button>售后数据分析</button></nav></div>
        <div className="hf-date-control"><span>(GMT+08:00)</span><button>最近 7 天：　2026/08/23　–　2026/08/29 <CalendarDays size={14} /></button><button className="compare-date">较前 7 日</button></div>
      </header>
      <div className="hf-analytics-layout">
        {section === "store" ? <AnalyticsSidebar /> : <ProductCardSidebar page={cardPage} onPage={(page) => { setCardPage(page); setDetailProduct(null); }} />}
        <div className="hf-main-content">
          {notice && <div className="hf-delay-notice"><AlertTriangleIcon /><span>目前，部分数据更新存在延迟，因此展示的数据可能无法反映最新的业务状态。我们的团队正在努力解决此问题。请稍后再来查看。</span><button aria-label="关闭提示" onClick={() => setNotice(false)}><X size={14} /></button></div>}
          {section === "store" ? <><div className="hf-dashboard-grid"><KeyMetricsPanel /><RankingPanel /></div><BreakdownPanel /></> : detailProduct ? <ProductDetailPlaceholder name={detailProduct} onBack={() => setDetailProduct(null)} /> : cardPage === "performance" ? <CardPerformancePage onConfigure={openMetricModal} /> : <CardDetailsPage onConfigure={openMetricModal} onOpenProduct={setDetailProduct} />}
        </div>
      </div>
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
