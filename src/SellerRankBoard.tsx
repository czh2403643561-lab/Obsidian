import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";
import { parseSellerRankWorkbook } from "./parser";
import { usePersistedState } from "./persistence";
import type { PercentilePreset, SellerRank, SellerRankFilters, SellerRankSortField, SortDirection } from "./types";
import { formatCompact, formatCount, getPercentileThresholds, presetThreshold } from "./utils";

type SellerBoardKind = "crossborder" | "local";

const initialFilters: SellerRankFilters = {
  salesAmountMin: "",
  salesAmountMax: "",
  salesMin: "",
  salesMax: "",
  productsMin: "",
  productsMax: "",
  category: "all",
  creators: "all",
  videos: "all",
};

interface SellerRankWorkspaceState {
  sellers: SellerRank[];
  fileName: string;
  importedAt: string;
  draftFilters: SellerRankFilters;
  appliedFilters: SellerRankFilters;
  sort: { field: SellerRankSortField; direction: SortDirection };
  parseNotice: string;
  foundHeaderCount: number;
}

const initialWorkspaceState = (): SellerRankWorkspaceState => ({
  sellers: [],
  fileName: "",
  importedAt: "",
  draftFilters: { ...initialFilters },
  appliedFilters: { ...initialFilters },
  sort: { field: "salesAmount", direction: "desc" },
  parseNotice: "",
  foundHeaderCount: 0,
});

const sortLabels: Record<SellerRankSortField, string> = {
  salesAmount: "销售额",
  sales: "销量",
  promotedProductCount: "带货商品数",
  creators: "达人",
  videos: "视频数",
  lives: "直播数",
};

const boardName = (kind: SellerBoardKind): string => kind === "crossborder" ? "跨境卖家榜" : "本土卖家榜";

const presetName = (preset: PercentilePreset): string => {
  if (preset === "p15") return "最低 15%";
  if (preset === "p20") return "最低 20%";
  if (preset === "p50") return "最低 50%";
  return "不限";
};

const parseInputNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const filtersEqual = (left: SellerRankFilters, right: SellerRankFilters): boolean =>
  Object.keys(initialFilters).every((key) => left[key as keyof SellerRankFilters] === right[key as keyof SellerRankFilters]);

const hasActiveFilters = (filters: SellerRankFilters): boolean => Boolean(
  filters.salesAmountMin || filters.salesAmountMax || filters.salesMin || filters.salesMax ||
  filters.productsMin || filters.productsMax || filters.category !== "all" ||
  filters.creators !== "all" || filters.videos !== "all",
);

function RangeInput({ label, minValue, maxValue, onMinChange, onMaxChange }: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return <div className="filter-block"><label>{label}</label><div className="range-inputs"><input type="number" min="0" value={minValue} onChange={(event) => onMinChange(event.target.value)} placeholder="最小值" aria-label={`${label}最小值`} /><span>至</span><input type="number" min="0" value={maxValue} onChange={(event) => onMaxChange(event.target.value)} placeholder="最大值" aria-label={`${label}最大值`} /></div></div>;
}

function SellerSortButton({ field, sort, onSort }: {
  field: SellerRankSortField;
  sort: { field: SellerRankSortField; direction: SortDirection };
  onSort: (field: SellerRankSortField) => void;
}) {
  const active = sort.field === field;
  return <button className={`sort-button${active ? " active" : ""}`} onClick={() => onSort(field)}><span>{sortLabels[field]}</span>{active ? (sort.direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} />) : <ArrowUpDown size={14} />}</button>;
}

export default function SellerRankBoard({ kind, hidden }: { kind: SellerBoardKind; hidden: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = usePersistedState<SellerRankWorkspaceState>(`seller-${kind}`, initialWorkspaceState);
  const { sellers, fileName, draftFilters, appliedFilters, sort, parseNotice, foundHeaderCount } = workspace;
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const name = boardName(kind);

  const thresholds = useMemo(() => ({ creators: getPercentileThresholds(sellers, "creators"), videos: getPercentileThresholds(sellers, "videos") }), [sellers]);
  const categories = useMemo(() => [...new Set(sellers.map((seller) => seller.deliveryCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")), [sellers]);
  const regionLabel = useMemo(() => {
    const regions = [...new Set(sellers.map((seller) => seller.region).filter((region) => region && region !== "未填写"))];
    return regions.length === 1 ? regions[0] : regions.length > 1 ? "多地区" : "";
  }, [sellers]);
  const filteredSellers = useMemo(() => {
    const salesAmountMin = parseInputNumber(appliedFilters.salesAmountMin);
    const salesAmountMax = parseInputNumber(appliedFilters.salesAmountMax);
    const salesMin = parseInputNumber(appliedFilters.salesMin);
    const salesMax = parseInputNumber(appliedFilters.salesMax);
    const productsMin = parseInputNumber(appliedFilters.productsMin);
    const productsMax = parseInputNumber(appliedFilters.productsMax);
    const creatorsThreshold = presetThreshold(appliedFilters.creators, thresholds.creators);
    const videosThreshold = presetThreshold(appliedFilters.videos, thresholds.videos);
    return sellers.filter((seller) => {
      if (salesAmountMin !== null && seller.salesAmount < salesAmountMin) return false;
      if (salesAmountMax !== null && seller.salesAmount > salesAmountMax) return false;
      if (salesMin !== null && seller.sales < salesMin) return false;
      if (salesMax !== null && seller.sales > salesMax) return false;
      if (productsMin !== null && seller.promotedProductCount < productsMin) return false;
      if (productsMax !== null && seller.promotedProductCount > productsMax) return false;
      if (appliedFilters.category !== "all" && seller.deliveryCategory !== appliedFilters.category) return false;
      return seller.creators <= creatorsThreshold && seller.videos <= videosThreshold;
    }).sort((a, b) => {
      const difference = a[sort.field] - b[sort.field];
      if (difference !== 0) return sort.direction === "desc" ? -difference : difference;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, [appliedFilters, sellers, sort, thresholds]);

  const updateFilter = <K extends keyof SellerRankFilters>(key: K, value: SellerRankFilters[K]) => setWorkspace((current) => ({ ...current, draftFilters: { ...current.draftFilters, [key]: value } }));
  const clearFilters = () => setWorkspace((current) => ({ ...current, draftFilters: { ...initialFilters }, appliedFilters: { ...initialFilters } }));
  const setSort = (update: (current: { field: SellerRankSortField; direction: SortDirection }) => { field: SellerRankSortField; direction: SortDirection }) => setWorkspace((current) => ({ ...current, sort: update(current.sort) }));
  const hasDraftChanges = !filtersEqual(draftFilters, appliedFilters);
  const hasAnyFilterValues = hasActiveFilters(draftFilters) || hasActiveFilters(appliedFilters);

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError(""); setIsLoading(true);
    try {
      const result = await parseSellerRankWorkbook(file);
      const notices: string[] = [];
      if (result.missingHeaders.length) notices.push(`未找到字段：${result.missingHeaders.join("、")}，对应数据将显示为 —`);
      if (result.skippedRows) notices.push(`已跳过 ${result.skippedRows} 行缺少店铺名称或有效链接的数据`);
      setWorkspace({ sellers: result.sellers, fileName: file.name, importedAt: new Date().toISOString(), draftFilters: { ...initialFilters }, appliedFilters: { ...initialFilters }, sort: { field: "salesAmount", direction: "desc" }, parseNotice: notices.join("；"), foundHeaderCount: result.foundHeaders.length });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "文件解析失败，请检查文件后重试。"); }
    finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return <section className="board-view" hidden={hidden} aria-hidden={hidden}>
    {sellers.length > 0 ? <section className="source-bar"><div className="source-bar-main"><div className="source-bar-icon"><FileSpreadsheet size={18} /></div><div className="source-file"><span>当前数据源 · {name}</span><strong title={fileName}>{fileName}</strong></div><span className="source-divider" /><span className="source-product-count">{formatCount(sellers.length)} 家店铺</span></div><div className="source-bar-actions"><span className="source-local-note"><CheckCircle2 size={14} /> 本地解析</span><button className="compact-import-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={15} /> {isLoading ? "正在解析…" : "更换 Excel"}</button><input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(event) => void loadFile(event.target.files?.[0])} hidden /></div></section> : <section className="import-card"><div className="import-copy"><div className="section-icon"><FileSpreadsheet size={20} /></div><div><div className="section-kicker">数据源</div><h2>导入 EchoTik {name}</h2><p>支持 .xlsx / .xls，自动识别第 2 行字段表头。</p></div></div><div className={`dropzone${isDragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void loadFile(event.dataTransfer.files[0]); }} onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }} role="button" tabIndex={0} aria-label={`选择或拖入${name} Excel 文件`}><CloudUpload size={19} /><span>{isLoading ? "正在解析文件…" : "拖入文件，或点击选择"}</span><input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(event) => void loadFile(event.target.files?.[0])} hidden /></div></section>}
    {error && <div className="notice error-notice" role="alert"><AlertTriangle size={18} /><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X size={16} /></button></div>}
    {sellers.length > 0 && <><section className="overview-grid"><div className="overview-main"><span>导入数量</span><strong>{formatCount(sellers.length)}</strong><small>家店铺</small></div><div className="overview-stat"><span>当前结果</span><strong>{formatCount(filteredSellers.length)}</strong><small>符合筛选条件</small></div><div className="overview-stat"><span>带货分类</span><strong>{categories.length}</strong><small>已识别分类</small></div><div className="overview-stat accent-stat"><span>当前排序</span><strong>{sortLabels[sort.field]}</strong><small>{sort.direction === "desc" ? "从高到低" : "从低到高"}</small></div></section>
      {parseNotice && <div className="notice info-notice"><CircleHelp size={17} /><span>{parseNotice}</span></div>}
      <section className="filter-card"><div className="filter-card-header"><div className="filter-title"><Filter size={17} /><strong>筛选条件</strong><span>{hasActiveFilters(appliedFilters) ? "已启用组合筛选" : "全部店铺"}</span></div><div className="filter-card-actions">{hasDraftChanges && <span className="pending-filter-note">条件已修改，点击应用筛选生效</span>}<button className="apply-button" onClick={() => setWorkspace((current) => ({ ...current, appliedFilters: { ...current.draftFilters } }))} disabled={!hasDraftChanges}><Check size={15} /> 应用筛选</button>{hasAnyFilterValues && <button className="text-button" onClick={clearFilters}><RefreshCw size={14} /> 清除筛选</button>}</div></div><div className="filter-grid seller-filter-grid"><RangeInput label="销售额 (£)" minValue={draftFilters.salesAmountMin} maxValue={draftFilters.salesAmountMax} onMinChange={(value) => updateFilter("salesAmountMin", value)} onMaxChange={(value) => updateFilter("salesAmountMax", value)} /><RangeInput label="销量" minValue={draftFilters.salesMin} maxValue={draftFilters.salesMax} onMinChange={(value) => updateFilter("salesMin", value)} onMaxChange={(value) => updateFilter("salesMax", value)} /><RangeInput label="带货商品数" minValue={draftFilters.productsMin} maxValue={draftFilters.productsMax} onMinChange={(value) => updateFilter("productsMin", value)} onMaxChange={(value) => updateFilter("productsMax", value)} /><div className="filter-block"><label htmlFor={`${kind}-category-filter`}>带货分类</label><div className="select-wrap"><select id={`${kind}-category-filter`} value={draftFilters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="all">不限</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor={`${kind}-creators-filter`}>达人 <span className="label-help" title="百分位基于当前导入的完整卖家榜数据计算"><CircleHelp size={13} /></span></label><div className="select-wrap"><select id={`${kind}-creators-filter`} value={draftFilters.creators} onChange={(event) => updateFilter("creators", event.target.value as PercentilePreset)}><option value="all">不限</option><option value="p15">最低 15% · ≤ {formatCompact(thresholds.creators.p15)}</option><option value="p20">最低 20% · ≤ {formatCompact(thresholds.creators.p20)}</option><option value="p50">最低 50% · ≤ {formatCompact(thresholds.creators.p50)}</option></select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor={`${kind}-videos-filter`}>视频数 <span className="label-help" title="百分位基于当前导入的完整卖家榜数据计算"><CircleHelp size={13} /></span></label><div className="select-wrap"><select id={`${kind}-videos-filter`} value={draftFilters.videos} onChange={(event) => updateFilter("videos", event.target.value as PercentilePreset)}><option value="all">不限</option><option value="p15">最低 15% · ≤ {formatCompact(thresholds.videos.p15)}</option><option value="p20">最低 20% · ≤ {formatCompact(thresholds.videos.p20)}</option><option value="p50">最低 50% · ≤ {formatCompact(thresholds.videos.p50)}</option></select><ChevronDown size={15} /></div></div></div><div className="filter-footnote"><Search size={13} /> 百分位档位根据本次导入的完整卖家榜数据动态计算，支持多个条件同时生效。</div></section>
      <section className="list-card"><div className="list-card-header"><div><div className="list-heading"><h2>{name}</h2><span className="result-pill">{formatCount(filteredSellers.length)} 个结果</span>{regionLabel && <span className="region-pill">{regionLabel}</span>}</div><p>点击店铺名称打开 EchoTik 原店铺页</p></div><div className="list-actions"><Store size={15} /> {presetName(appliedFilters.creators)} 达人 · {presetName(appliedFilters.videos)} 视频</div></div><div className="table-wrap"><table className="seller-table"><thead><tr><th className="seller-name-column">店铺</th><th>带货分类</th><th><SellerSortButton field="salesAmount" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th><th><SellerSortButton field="sales" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th><th><SellerSortButton field="promotedProductCount" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th><th><SellerSortButton field="creators" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th><th><SellerSortButton field="videos" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th><th><SellerSortButton field="lives" sort={sort} onSort={(field) => setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : "desc" }))} /></th></tr></thead><tbody>{filteredSellers.map((seller) => <tr key={`${seller.id}-${seller.url}`}><td className="seller-name-column"><a className="shop-name-link" href={seller.url} target="_blank" rel="noreferrer"><span className="shop-avatar"><Store size={17} /></span><span><strong title={seller.name}>{seller.name}</strong><small>{seller.collectedAt || "—"}</small></span></a></td><td><span className="seller-category">{seller.deliveryCategory}</span></td><td><span className="metric-value highlight">£{formatCompact(seller.salesAmount)}</span></td><td><span className="metric-value">{formatCompact(seller.sales)}</span></td><td><span className="metric-value">{formatCompact(seller.promotedProductCount)}</span></td><td><span className="metric-value">{formatCount(seller.creators)}</span></td><td><span className="metric-value">{formatCount(seller.videos)}</span></td><td><span className="metric-value">{formatCount(seller.lives)}</span></td></tr>)}</tbody></table>{!filteredSellers.length && <div className="no-results"><div className="empty-icon small"><Search size={20} /></div><strong>没有符合条件的店铺</strong><span>尝试放宽筛选范围，或清除筛选重新查看。</span><button className="text-button" onClick={clearFilters}>清除筛选</button></div>}</div></section>
    </>}
    {!sellers.length && !error && <div className="empty-state"><div className="empty-icon"><Store size={30} /></div><h2>导入{name}数据，开始筛选</h2><p>支持 EchoTik 导出的卖家榜 Excel，文件只在当前浏览器本地解析。</p><button className="primary-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={17} /> 选择 Excel 文件</button></div>}
  </section>;
}
