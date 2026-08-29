import { useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  HelpCircle,
  Info,
  MoreVertical,
  PencilLine,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import "./analyticsPrototype.css";

type MetricKey = "gmv" | "units" | "skuOrders" | "orders";

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
  return (
    <main className="hf-analytics-shell">
      <header className="hf-page-header">
        <div><h1>数据分析</h1><nav aria-label="分析导航"><button className="active">店铺数据分析</button><button>成长和数据分析</button><button>内容分析</button><button>商品卡</button><button>商品数据分析</button><button>营销数据分析</button><button>售后数据分析</button></nav></div>
        <div className="hf-date-control"><span>(GMT+08:00)</span><button>最近 7 天：　2026/08/23　–　2026/08/29 <CalendarDays size={14} /></button><button className="compare-date">较前 7 日</button></div>
      </header>
      <div className="hf-analytics-layout">
        <AnalyticsSidebar />
        <div className="hf-main-content">
          {notice && <div className="hf-delay-notice"><AlertTriangleIcon /><span>目前，部分数据更新存在延迟，因此展示的数据可能无法反映最新的业务状态。我们的团队正在努力解决此问题。请稍后再来查看。</span><button aria-label="关闭提示" onClick={() => setNotice(false)}><X size={14} /></button></div>}
          <div className="hf-dashboard-grid"><KeyMetricsPanel /><RankingPanel /></div>
          <BreakdownPanel />
        </div>
      </div>
    </main>
  );
}

function AlertTriangleIcon() {
  return <span className="hf-alert-icon">!</span>;
}

export default function AnalyticsPrototype({ hidden = false }: { hidden?: boolean }) {
  return <section className="hf-page" hidden={hidden} aria-hidden={hidden}><div className="hf-utility-rail" aria-hidden="true"><Store size={15} /><ShoppingBag size={15} /><Users size={15} /><Bell size={15} /><Info size={15} /></div><AnalyticsShell /></section>;
}
