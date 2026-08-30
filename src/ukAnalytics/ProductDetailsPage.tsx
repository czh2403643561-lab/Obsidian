import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, PencilLine, Search, SlidersHorizontal, X } from "lucide-react";
import ProductThumbnail from "../ProductThumbnail";
import type { BusinessCardMetrics } from "../types";
import { changeText, downloadXlsx, moneyText, numberText, periodFilePart, percentText } from "./format";
import { ukProductSourceKeys, ukProductSourceLabels, type UkDataSnapshot, type UkProductDetailsData, type UkProductDetailsRecord, type UkProductSourceKey } from "./types";

type MetricKey = "orders" | keyof BusinessCardMetrics;
type MetricKind = "money" | "number" | "rate";
type MetricDefinition = { key: MetricKey; label: string; kind: MetricKind; group: string };
type SortState = { key: MetricKey | null; direction: "asc" | "desc" };
type Props = { snapshot: UkDataSnapshot<UkProductDetailsData> | null; previous: UkDataSnapshot<UkProductDetailsData> | null; onImport: () => void };

const metricDefinitions: MetricDefinition[] = [
  { key: "gmv", label: "GMV", kind: "money", group: "成交指标" },
  { key: "orders", label: "订单数", kind: "number", group: "成交指标" },
  { key: "skuOrders", label: "SKU订单数", kind: "number", group: "成交指标" },
  { key: "units", label: "商品成交件数", kind: "number", group: "成交指标" },
  { key: "customers", label: "预计客户数", kind: "number", group: "成交指标" },
  { key: "aov", label: "平均订单金额", kind: "money", group: "成交指标" },
  { key: "impressions", label: "商品曝光次数", kind: "number", group: "流量指标" },
  { key: "clicks", label: "商品点击量", kind: "number", group: "流量指标" },
  { key: "ctr", label: "商品点击率", kind: "rate", group: "流量指标" },
  { key: "addToCarts", label: "加购次数", kind: "number", group: "流量指标" },
  { key: "addToCartRate", label: "加购率", kind: "rate", group: "流量指标" },
  { key: "ctor", label: "CTOR", kind: "rate", group: "流量指标" },
  { key: "uniqueImpressions", label: "去重商品曝光次数", kind: "number", group: "去重指标" },
  { key: "uniqueClicks", label: "去重点击次数", kind: "number", group: "去重指标" },
  { key: "uniqueCtr", label: "去重点击率", kind: "rate", group: "去重指标" },
  { key: "addToCartUsers", label: "已加购用户数", kind: "number", group: "去重指标" },
  { key: "uniqueAddToCartRate", label: "去重加购率", kind: "rate", group: "去重指标" },
  { key: "uniqueCtor", label: "去重CTOR", kind: "rate", group: "去重指标" },
];
const metricGroups = ["成交指标", "流量指标", "去重指标"];
const allMetricKeys = metricDefinitions.map((item) => item.key);

const sourceMetric = (record: UkProductDetailsRecord, source: UkProductSourceKey) => record.sources[source];
const metricValue = (record: UkProductDetailsRecord, source: UkProductSourceKey, key: MetricKey): number | null => key === "orders" ? sourceMetric(record, source).orders : sourceMetric(record, source).card[key];
const metricText = (value: number | null, kind: MetricKind): string => kind === "money" ? moneyText(value) : kind === "rate" ? percentText(value) : numberText(value);
const metricClass = (key: MetricKey): string => `uk-metric-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
const paginationItems = (pageCount: number, currentPage: number): Array<number | "ellipsis"> => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(pageCount - 1, currentPage + 2);
  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);
  return items;
};

function ProductDetailModal({ record, source, onClose }: { record: UkProductDetailsRecord; source: UkProductSourceKey; onClose: () => void }) {
  const metric = sourceMetric(record, source);
  return <div className="uk-product-modal-backdrop" role="presentation" onClick={onClose}><section className="uk-product-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><div><span>商品详情</span><h2>{record.base.name}</h2><small>Product ID {record.base.productId}</small></div><button onClick={onClose} aria-label="关闭"><X size={16} /></button></header><div className="uk-product-modal-source">当前来源：{ukProductSourceLabels[source]}</div><div className="uk-product-modal-grid"><div><small>GMV</small><strong>{moneyText(metric.card.gmv)}</strong></div><div><small>订单数</small><strong>{numberText(metric.orders)}</strong></div><div><small>SKU订单数</small><strong>{numberText(metric.card.skuOrders)}</strong></div><div><small>商品成交件数</small><strong>{numberText(metric.card.units)}</strong></div><div><small>商品曝光次数</small><strong>{numberText(metric.card.impressions)}</strong></div><div><small>商品点击量</small><strong>{numberText(metric.card.clicks)}</strong></div></div><footer><button onClick={onClose}>返回商品数据分析</button></footer></section></div>;
}

export default function ProductDetailsPage({ snapshot, previous, onImport }: Props) {
  const [source, setSource] = useState<UkProductSourceKey>("all");
  const [mode, setMode] = useState<"product" | "sku">("product");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [withSales, setWithSales] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: null, direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [horizontalScroll, setHorizontalScroll] = useState(0);
  const [selected, setSelected] = useState<UkProductDetailsRecord | null>(null);
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>(allMetricKeys);
  const filterRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const records = snapshot?.data.products ?? [];

  useEffect(() => {
    if (!filterOpen && !configOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (filterOpen && !filterRef.current?.contains(target)) setFilterOpen(false);
      if (configOpen && !configRef.current?.contains(target)) setConfigOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      setConfigOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen, configOpen]);

  const visible = useMemo(() => {
    const filtered = records.filter((record) => {
      const product = record.base;
      const metric = sourceMetric(record, source);
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery = !normalizedQuery || `${product.name} ${product.productId}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || (status === "online" ? /在售|可售/.test(product.publishStatus) : !/在售|可售/.test(product.publishStatus));
      const skuOrders = metric.card.skuOrders;
      const matchesSales = withSales === "all" || (withSales === "with-sales" ? skuOrders !== null && skuOrders > 0 : skuOrders === 0);
      return matchesQuery && matchesStatus && matchesSales;
    });
    return filtered.sort((left, right) => {
      if (!sort.key) return left.base.originalIndex - right.base.originalIndex;
      const leftValue = metricValue(left, source, sort.key);
      const rightValue = metricValue(right, source, sort.key);
      if (leftValue === null && rightValue === null) return left.base.originalIndex - right.base.originalIndex;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      const delta = leftValue - rightValue;
      return delta === 0 ? left.base.originalIndex - right.base.originalIndex : sort.direction === "asc" ? delta : -delta;
    });
  }, [records, query, source, status, withSales, sort]);
  const previousById = useMemo(() => new Map((previous?.data.products ?? []).map((record) => [record.base.productId, record])), [previous]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const shown = visible.slice((activePage - 1) * pageSize, activePage * pageSize);
  const enabledDefinitions = metricDefinitions.filter((definition) => enabledMetrics.includes(definition.key));
  const toggleSort = (key: MetricKey) => { setPage(1); setSort((current) => current.key === key ? { key, direction: current.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" }); };
  const toggleMetric = (key: MetricKey) => setEnabledMetrics((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const renderColumns = () => <colgroup><col className="uk-product-column" />{enabledDefinitions.map((definition) => <col key={definition.key} className="uk-metric-column" />)}<col className="uk-action-column" /></colgroup>;
  const renderHeader = (placeholder = false) => <thead className={placeholder ? "uk-product-table-placeholder-head" : ""}><tr><th className="uk-product-column">商品</th>{enabledDefinitions.map((definition) => <th key={definition.key} className={metricClass(definition.key)}><button className={sort.key === definition.key ? "sorted" : ""} onClick={() => toggleSort(definition.key)}>{definition.label} ↕</button></th>)}<th className="uk-action-column">操作</th></tr></thead>;
  const exportRows = () => {
    const columns = [{ key: "name", label: "商品" }, { key: "productId", label: "Product ID" }, ...enabledDefinitions.map((definition) => ({ key: definition.key, label: definition.label, kind: definition.kind }))];
    const rows = visible.map((record) => Object.fromEntries([...["name", "productId"].map((key) => [key, key === "name" ? record.base.name : record.base.productId]), ...enabledDefinitions.map((definition) => [definition.key, metricValue(record, source, definition.key)])]));
    downloadXlsx(`商品详细信息_${snapshot ? periodFilePart(snapshot) : "数据"}.xlsx`, columns, rows);
  };

  if (!snapshot) return <section className="hf-panel uk-real-empty-panel"><h2>商品数据分析 · 详细信息</h2><p>请先导入英国 Seller Center 的“商品数据分析-详细信息.xlsx”。</p><button onClick={onImport}><Download size={14} /> 导入官方 Excel</button></section>;
  const available = snapshot.data.sourceAvailability[source];
  return <section className="hf-panel uk-product-page"><div className="uk-product-kind-tabs"><button className={mode === "product" ? "active" : ""} onClick={() => setMode("product")}>按商品</button><button className={mode === "sku" ? "active" : ""} onClick={() => setMode("sku")}>按 SKU</button></div>{mode === "sku" ? <div className="hf-real-empty uk-product-empty">当前 UK 官方文件未提供 SKU 维度明细</div> : <><div className="uk-product-source-tabs">{ukProductSourceKeys.map((item) => <button key={item} className={source === item ? "active" : ""} onClick={() => { setSource(item); setPage(1); }}>{ukProductSourceLabels[item]}</button>)}</div><div className="uk-product-toolbar"><label className="uk-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索商品名称或 ID" /></label><div className="uk-popover-anchor" ref={filterRef}><button className={filterOpen ? "uk-toolbar-button active" : "uk-toolbar-button"} onClick={() => { setFilterOpen((open) => !open); setConfigOpen(false); }}><SlidersHorizontal size={14} /> 筛选</button>{filterOpen && <div className="uk-filter-popover"><label>商品状态<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">全部</option><option value="online">在售/可售</option><option value="offline">其他状态</option></select></label><label>销售情况<select value={withSales} onChange={(event) => { setWithSales(event.target.value); setPage(1); }}><option value="all">全部</option><option value="with-sales">有 SKU 订单</option><option value="without-sales">无 SKU 订单</option></select></label><button onClick={() => { setStatus("all"); setWithSales("all"); setPage(1); }}>重置</button></div>}</div><div className="uk-popover-anchor" ref={configRef}><button className={`uk-icon-button ${configOpen ? "active" : ""}`} onClick={() => { setConfigOpen((open) => !open); setFilterOpen(false); }} aria-label="配置指标"><PencilLine size={14} /> 配置指标</button>{configOpen && <div className="uk-column-popover uk-metric-config"><strong>配置指标</strong>{metricGroups.map((group) => <fieldset key={group}><legend>{group}</legend>{metricDefinitions.filter((definition) => definition.group === group).map((definition) => <label key={definition.key}><input type="checkbox" checked={enabledMetrics.includes(definition.key)} onChange={() => toggleMetric(definition.key)} />{definition.label}</label>)}</fieldset>)}</div>}</div><button className="uk-export-button" onClick={exportRows}><Download size={14} /> 导出数据</button></div>{!available ? <div className="hf-real-empty uk-product-empty">当前导出文件未提供“{ukProductSourceLabels[source]}”来源数据</div> : <div className="uk-product-table-wrap"><div className="uk-product-sticky-head" aria-hidden="true"><div className="uk-sticky-product-header">商品</div><table className="uk-product-table uk-product-sticky-table" style={{ transform: `translateX(-${horizontalScroll}px)` }}>{renderColumns()}{renderHeader()}</table></div><div className="uk-product-table-scroll" onScroll={(event) => setHorizontalScroll(event.currentTarget.scrollLeft)}><table className="uk-product-table">{renderColumns()}{renderHeader(true)}<tbody>{shown.map((record) => { const old = previousById.get(record.base.productId); return <tr key={record.base.productId}><td className="uk-product-column"><div className="uk-product-identity"><ProductThumbnail productId={record.base.productId} fallbackText={record.base.name} size={40} /><span><strong title={record.base.name}>{record.base.name}</strong><small>ID {record.base.productId}</small><em><i className={/在售|可售/.test(record.base.publishStatus) ? "online" : ""} />{record.base.publishStatus || "状态未提供"}<b>{record.base.gmvRange || "GMV 区间 --"}</b></em></span></div></td>{enabledDefinitions.map((definition) => { const value = metricValue(record, source, definition.key); const previousValue = old ? metricValue(old, source, definition.key) : null; const change = changeText(value, previousValue, definition.kind === "rate"); return <td key={definition.key} className={metricClass(definition.key)}><strong>{metricText(value, definition.kind)}</strong><small className={change.tone}>{change.text}</small></td>; })}<td className="uk-action-column"><button className="uk-detail-action" onClick={() => setSelected(record)}>详细信息</button></td></tr>; })}</tbody></table>{!visible.length && <div className="hf-real-empty">当前条件下暂无商品</div>}<footer className="uk-pagination"><span>共 {visible.length} 个商品</span><button disabled={activePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="上一页"><ChevronLeft size={14} /></button>{paginationItems(pageCount, activePage).map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="uk-pagination-ellipsis">…</span> : <button key={item} className={activePage === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button disabled={activePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="下一页"><ChevronRight size={14} /></button><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} aria-label="每页条数"><option value="20">20/Page</option><option value="50">50/Page</option><option value="100">100/Page</option></select></footer></div></div>}</>}{selected && <ProductDetailModal record={selected} source={source} onClose={() => setSelected(null)} />}</section>;
}
