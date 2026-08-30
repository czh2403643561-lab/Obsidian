import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Filter, HelpCircle, MoreVertical, PencilLine, Search, SlidersHorizontal, TrendingUp, X } from "lucide-react";
import type { BusinessBatch, BusinessProductRecord } from "./types";

type ProductMode = "product" | "sku";
type ProductRow = string[];

function ProductAnalyticsSidebar() {
  return <aside className="hf-sidebar hf-product-analytics-sidebar" aria-label="商品数据分析导航"><section><span>商品</span><div className="active">详细信息</div><div>商品流量</div></section><section><span>商品榜单</span><div>TikTok 热卖商品榜</div></section></aside>;
}

type ProductFilters = { status: "all" | "on-sale" | "off-sale"; sales: "all" | "with-sales" | "without-sales"; gmvMin: string; gmvMax: string; impressionsMin: string; impressionsMax: string };

const defaultProductFilters: ProductFilters = { status: "all", sales: "all", gmvMin: "", gmvMax: "", impressionsMin: "", impressionsMax: "" };

function FilterDrawer({ filters, onChange, onClose }: { filters: ProductFilters; onChange: (next: ProductFilters) => void; onClose: () => void }) {
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });
  return <aside className="hf-product-filter-drawer" aria-label="筛选商品"><header><div><Filter size={15} /><strong>筛选</strong></div><button onClick={onClose} aria-label="关闭筛选"><X size={15} /></button></header><section><label>商品状态</label><div className="hf-filter-options"><button className={filters.status === "all" ? "active" : ""} onClick={() => set({ status: "all" })}>全部</button><button className={filters.status === "on-sale" ? "active" : ""} onClick={() => set({ status: "on-sale" })}>在售</button><button className={filters.status === "off-sale" ? "active" : ""} onClick={() => set({ status: "off-sale" })}>已下架</button></div></section><section><label>成交情况</label><div className="hf-filter-options"><button className={filters.sales === "all" ? "active" : ""} onClick={() => set({ sales: "all" })}>不限</button><button className={filters.sales === "with-sales" ? "active" : ""} onClick={() => set({ sales: "with-sales" })}>有成交</button><button className={filters.sales === "without-sales" ? "active" : ""} onClick={() => set({ sales: "without-sales" })}>无成交</button></div></section><section><label>GMV 范围</label><div className="hf-filter-range"><input value={filters.gmvMin} onChange={(event) => set({ gmvMin: event.target.value })} placeholder="最小值" inputMode="decimal" /><span>–</span><input value={filters.gmvMax} onChange={(event) => set({ gmvMax: event.target.value })} placeholder="最大值" inputMode="decimal" /></div></section><section><label>曝光范围</label><div className="hf-filter-range"><input value={filters.impressionsMin} onChange={(event) => set({ impressionsMin: event.target.value })} placeholder="最小值" inputMode="numeric" /><span>–</span><input value={filters.impressionsMax} onChange={(event) => set({ impressionsMax: event.target.value })} placeholder="最大值" inputMode="numeric" /></div></section><footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确定</button></footer></aside>;
}

const detailMetrics = [
  { key: "gmv", group: "销量", label: "GMV", value: "RM56.11", change: "▲ 65.03%", tone: "up" },
  { key: "live", group: "销量", label: "商家直播归因 GMV", value: "RM0.00", change: "—", tone: "flat" },
  { key: "video", group: "销量", label: "商家视频归因 GMV", value: "RM0.00", change: "—", tone: "flat" },
  { key: "creator", group: "销量", label: "达人归因 GMV", value: "RM0.00", change: "—", tone: "flat" },
  { key: "customers", group: "流量", label: "预计客户数", value: "5", change: "▲ 66.67%", tone: "up" },
  { key: "impressions", group: "流量", label: "商品曝光次数", value: "1,985", change: "▼ 4.01%", tone: "down" },
  { key: "clicks", group: "流量", label: "商品点击量", value: "170", change: "▲ 8.97%", tone: "up" },
  { key: "ctr", group: "流量", label: "商品点击率", value: "8.56%", change: "▲ 13.53%", tone: "up" },
];

function ProductDetail({ product, onBack }: { product: ProductRow; onBack: () => void }) {
  const [channel, setChannel] = useState("全部");
  const [selected, setSelected] = useState(["gmv", "customers"]);
  const [trafficMode, setTrafficMode] = useState("页面浏览量");
  const toggleMetric = (key: string) => setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : current.length >= 2 ? current : [...current, key]);
  const activeMetrics = detailMetrics.filter((metric) => selected.includes(metric.key));
  const channels = ["全部", "商家直播", "商家视频", "商家商品卡", "联盟"];
  const detailRows = [["商家商品卡", "100%", "RM56.11", "6", "6", "6", "RM9.35"], ["联盟", "0%", "RM0.00", "0", "0", "0", "RM0.00"], ["商家直播", "0%", "RM0.00", "0", "0", "0", "RM0.00"], ["商家视频", "0%", "RM0.00", "0", "0", "0", "RM0.00"]];
  return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-product-detail-header"><button onClick={onBack}><ChevronLeft size={14} /> 商品表现</button><div className="hf-product-detail-title"><i className={`hf-thumb ${product[9]}`}>{product[0].slice(0, 1)}</i><div><h2>{product[0]}</h2><p>ID {product[1]}　|　类目 Telefon & Elektronik　|　商品销量 ≥ 1</p></div><button className="hf-tiktok-link">打开 TikTok 商品 <ExternalLink size={12} /></button></div><div className="hf-product-facts"><span><small>发品状态</small><strong><i /> 在售</strong></span><span><small>机会匹配</small><strong>{product[8]}</strong></span><span><small>价格</small><strong>RM2.60 – RM26.60</strong></span><span><small>评价</small><strong>4.94 ★（16）</strong></span></div></section><div className="hf-product-detail-channel">{channels.map((item) => <button key={item} className={channel === item ? "active" : ""} onClick={() => setChannel(item)}>{item}</button>)}</div><section className="hf-panel hf-detail-metric-panel"><header><h2>关键指标</h2><div><button aria-label="编辑指标"><PencilLine size={14} /></button><button aria-label="下载数据"><Download size={14} /></button><button aria-label="更多操作"><MoreVertical size={14} /></button></div></header>{["销量", "流量"].map((group) => <div className="hf-detail-metric-group" key={group}><label>{group}</label><div>{detailMetrics.filter((metric) => metric.group === group).map((metric) => <button className={selected.includes(metric.key) ? "selected" : ""} onClick={() => toggleMetric(metric.key)} key={metric.key}><span>{metric.label}<i>{selected.includes(metric.key) ? <Check size={10} /> : null}</i></span><strong>{metric.value}</strong><em className={metric.tone}>{metric.change}</em></button>)}</div></div>)}<div className="hf-detail-trend"><div className="hf-chart-legend">{activeMetrics.map((metric, index) => <span key={metric.key}><i className={index ? "secondary" : ""} />{metric.label}</span>)}</div><svg viewBox="0 0 760 160" role="img" aria-label="商品关键指标趋势"><g>{[24, 58, 92, 126].map((y) => <line key={y} x1="40" x2="735" y1={y} y2={y} />)}</g><polyline points="40,126 138,40 237,93 336,109 435,126 535,61 634,126 735,110" /><polyline className="secondary" points="40,126 138,112 237,121 336,124 435,126 535,116 634,126 735,124" />{["8月23", "8月24", "8月25", "8月26", "8月27", "8月28", "8月29"].map((label, index) => <text key={label} x={40 + index * 115} y="151" textAnchor="middle">{label}</text>)}</svg></div></section><section className="hf-panel hf-detail-traffic"><header><h2>流量分析</h2><div className="hf-segmented"><button className={trafficMode === "页面浏览量" ? "active" : ""} onClick={() => setTrafficMode("页面浏览量")}>页面浏览量</button><button className={trafficMode === "去重访客数" ? "active" : ""} onClick={() => setTrafficMode("去重访客数")}>去重访客数</button></div></header><div className="hf-detail-funnel"><div className="hf-funnel-label first"><small>商品点击率</small><strong>8.56%</strong></div><div className="hf-funnel-bars"><div><span>商品曝光次数</span><b>1,985</b></div><div><span>商品点击量</span><b>170</b></div><div><span>SKU 订单数</span><b>6</b></div></div><div className="hf-funnel-label second"><small>CTOR（SKU 订单）</small><strong>3.53%</strong></div></div></section><section className="hf-panel hf-detail-breakdown"><header><h2>表现明细</h2><div><button><Download size={13} /> 导出数据</button><button aria-label="更多操作"><MoreVertical size={14} /></button></div></header><table><thead><tr><th>信息</th><th>GMV</th><th>订单数</th><th>SKU 订单数</th><th>商品成交件数</th><th>平均订单金额</th><th>操作</th></tr></thead><tbody>{detailRows.map((row) => <tr key={row[0]}><td>{row[0]}</td><td><small>{row[1]}</small><strong>{row[2]}</strong><em className={row[2] === "RM56.11" ? "up" : "flat"}>{row[2] === "RM56.11" ? "▲ 65.03%" : "—"}</em></td><td><small>{row[1]}</small><strong>{row[3]}</strong><em className="flat">—</em></td><td><small>{row[1]}</small><strong>{row[4]}</strong><em className="flat">—</em></td><td><small>{row[1]}</small><strong>{row[5]}</strong><em className="flat">—</em></td><td><strong>{row[6]}</strong><em className="flat">—</em></td><td><button>查看详情</button></td></tr>)}</tbody></table><footer className="hf-pagination"><button disabled><ChevronLeft size={13} /></button><button className="active">1</button><button disabled><ChevronRight size={13} /></button><select defaultValue="10"><option value="10">10/Page</option></select></footer></section></div></div>;
}

type ProductSortField = "gmv" | "orders" | "skuOrders" | "units";
type SortDirection = "asc" | "desc" | null;

const productValue = (product: BusinessProductRecord, field: ProductSortField): number | null => field === "gmv" ? product.card.gmv : field === "orders" ? product.orders : product.card[field];
const formatCount = (value: number | null): string => value === null ? "--" : value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const formatMoney = (value: number | null, currencySymbol: string): string => value === null ? "--" : `${currencySymbol || ""}${value.toFixed(2)}`;
const numberFilter = (value: number | null, min: string, max: string): boolean => {
  if (value === null) return !min && !max;
  const lower = min.trim() ? Number(min) : null; const upper = max.trim() ? Number(max) : null;
  return (lower === null || (Number.isFinite(lower) && value >= lower)) && (upper === null || (Number.isFinite(upper) && value <= upper));
};
const hasSales = (product: BusinessProductRecord): boolean => [product.orders, product.card.skuOrders, product.card.units, product.card.gmv].some((value) => value !== null && value > 0);
const toDetailRow = (product: BusinessProductRecord, currencySymbol: string): ProductRow => [product.name, product.productId, formatMoney(product.card.gmv, currencySymbol), formatCount(product.orders), formatCount(product.card.skuOrders), formatCount(product.card.units), "—", product.publishStatus, product.gmvRange || "—", "lavender"];

export default function ProductAnalyticsList({ batch }: { batch: BusinessBatch | null }) {
  const [mode, setMode] = useState<ProductMode>("product");
  const [source, setSource] = useState("全部");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>(defaultProductFilters);
  const [sort, setSort] = useState<{ field: ProductSortField | null; direction: SortDirection }>({ field: null, direction: null });
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const displayed = useMemo(() => {
    if (!batch || mode === "sku" || source !== "全部") return [];
    const normalizedQuery = query.trim().toLowerCase();
    return batch.products.filter((product) => {
      const statusMatch = filters.status === "all" || (filters.status === "on-sale" ? /在售|可售/.test(product.publishStatus) : !/在售|可售/.test(product.publishStatus));
      const sales = hasSales(product);
      const salesMatch = filters.sales === "all" || (filters.sales === "with-sales" ? sales : !sales);
      return (!normalizedQuery || product.name.toLowerCase().includes(normalizedQuery) || product.productId.toLowerCase().includes(normalizedQuery)) && statusMatch && salesMatch && numberFilter(product.card.gmv, filters.gmvMin, filters.gmvMax) && numberFilter(product.card.impressions, filters.impressionsMin, filters.impressionsMax);
    }).sort((left, right) => {
      if (!sort.field || !sort.direction) return left.originalIndex - right.originalIndex;
      const a = productValue(left, sort.field); const b = productValue(right, sort.field);
      if (a === null && b === null) return left.originalIndex - right.originalIndex;
      if (a === null) return 1; if (b === null) return -1;
      return sort.direction === "desc" ? b - a : a - b;
    });
  }, [batch, filters, mode, query, sort, source]);
  const sourceTabs = ["全部", "商家直播", "商家视频", "商家商品卡", "联盟"];
  const pageCount = Math.max(1, Math.ceil(displayed.length / 10));
  const pageStart = pageCount <= 3 ? 1 : Math.min(Math.max(1, page - 1), pageCount - 2);
  const pages = Array.from({ length: Math.min(pageCount, 3) }, (_, index) => pageStart + index);
  const visible = displayed.slice((page - 1) * 10, page * 10);
  const sortMark = (field: ProductSortField) => sort.field === field ? sort.direction === "desc" ? "↓" : "↑" : "↕";
  const setSortField = (field: ProductSortField) => { setPage(1); setSort((current) => current.field !== field ? { field, direction: "desc" } : current.direction === "desc" ? { field, direction: "asc" } : { field: null, direction: null }); };
  const emptyMessage = !batch ? "请先导入本期三份官方 Excel" : mode === "sku" ? "当前导入文件暂无 SKU 级明细数据" : source !== "全部" ? "当前导入文件暂无该来源的可靠商品明细" : "没有符合条件的真实商品数据";
  if (selectedProduct) return <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
  return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-panel hf-product-analytics-list"><header className="hf-product-analytics-heading"><div className="hf-product-kind-tabs"><button className={mode === "product" ? "active" : ""} onClick={() => { setMode("product"); setPage(1); }}>按商品</button><button className={mode === "sku" ? "active" : ""} onClick={() => { setMode("sku"); setPage(1); }}>按 SKU</button></div></header><div className="hf-product-analytics-tools"><div className="hf-source-tabs">{sourceTabs.map((tab) => <button key={tab} className={source === tab ? "active" : ""} onClick={() => { setSource(tab); setPage(1); }}>{tab}</button>)}</div><div className="hf-data-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索商品名称或 ID" /></div><button className={filterOpen ? "active filter-button" : "filter-button"} onClick={() => setFilterOpen((open) => !open)}><SlidersHorizontal size={13} /> 筛选</button><button className="hf-tool-icon" aria-label="配置列"><PencilLine size={14} /></button><button className="hf-export-button"><Download size={13} /> 导出数据</button><button className="hf-tool-icon" aria-label="更多操作"><MoreVertical size={14} /></button></div><div className="hf-product-analytics-table-wrap"><table className="hf-product-analytics-table"><thead><tr><th>商品</th>{(["gmv", "orders", "skuOrders", "units"] as ProductSortField[]).map((field) => <th key={field} className={sort.field === field ? "sorted" : ""}><button onClick={() => setSortField(field)}>{field === "gmv" ? "GMV" : field === "orders" ? "订单数" : field === "skuOrders" ? "SKU 订单数" : "商品成交件数"} {sortMark(field)} </button></th>)}<th>操作</th></tr></thead><tbody>{visible.map((product) => <tr key={product.productId}><td><div className="hf-data-product"><i className="hf-thumb lavender">{product.name.slice(0, 1)}</i><span><strong>{product.name}</strong><small>ID {product.productId} <button aria-label="复制商品 ID"><Copy size={11} /></button></small><em><b className={/在售|可售/.test(product.publishStatus) ? "online" : "offline"} />{product.publishStatus || "发品状态未提供"}<i>{product.gmvRange}</i></em></span></div></td><td className={sort.field === "gmv" ? "sorted" : ""}><strong>{formatMoney(product.card.gmv, batch?.currencySymbol ?? "")}</strong><small className="flat">--</small></td><td className={sort.field === "orders" ? "sorted" : ""}><strong>{formatCount(product.orders)}</strong><small className="flat">--</small></td><td className={sort.field === "skuOrders" ? "sorted" : ""}><strong>{formatCount(product.card.skuOrders)}</strong><small className="flat">--</small></td><td className={sort.field === "units" ? "sorted" : ""}><strong>{formatCount(product.card.units)}</strong><small className="flat">--</small></td><td><button className="hf-detail-action" onClick={() => setSelectedProduct(toDetailRow(product, batch?.currencySymbol ?? ""))}>详细信息</button></td></tr>)}</tbody></table>{!visible.length && <div className="hf-real-empty">{emptyMessage}</div>}</div><footer className="hf-pagination"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button>{pages.map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={13} /></button><select defaultValue="10" aria-label="每页条数"><option value="10">10/Page</option><option value="20">20/Page</option></select></footer></section>{filterOpen && <FilterDrawer filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} onClose={() => setFilterOpen(false)} />}</div></div>;
}
