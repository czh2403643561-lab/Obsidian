import { useEffect, useMemo, useRef, useState } from "react";
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
  Globe2,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";
import { parseShopWorkbook } from "./parser";
import SellerRankBoard from "./SellerRankBoard";
import { usePersistedState } from "./persistence";
import type { PercentilePreset, Shop, ShopFilters, ShopSortField, SortDirection } from "./types";
import { formatCompact, formatCount, getPercentileThresholds, presetThreshold } from "./utils";

const initialFilters: ShopFilters = {
  search: "",
  recentMin: "",
  recentMax: "",
  totalMin: "",
  totalMax: "",
  recentGmvMin: "",
  recentGmvMax: "",
  ratingMin: "",
  ratingMax: "",
  shopType: "all",
  managed: "all",
  creators: "all",
  videos: "all",
};

interface SmallShopWorkspaceState {
  shops: Shop[];
  fileName: string;
  importedAt: string;
  draftFilters: ShopFilters;
  appliedFilters: ShopFilters;
  sort: { field: ShopSortField | null; direction: SortDirection | null };
  parseNotice: string;
  foundHeaderCount: number;
}

const initialWorkspaceState = (): SmallShopWorkspaceState => ({
  shops: [],
  fileName: "",
  importedAt: "",
  draftFilters: { ...initialFilters },
  appliedFilters: { ...initialFilters },
  sort: { field: null, direction: null },
  parseNotice: "",
  foundHeaderCount: 0,
});

const sortLabels: Record<ShopSortField, string> = {
  rating: "店铺评分",
  recentSales: "近7天销量",
  totalSales: "总销量",
  recentGmv: "近7天GMV",
  creators: "总达人数",
  videos: "视频数",
  lives: "直播数",
};

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

const filtersEqual = (left: ShopFilters, right: ShopFilters): boolean =>
  Object.keys(initialFilters).every((key) => left[key as keyof ShopFilters] === right[key as keyof ShopFilters]);

const hasActiveFilters = (filters: ShopFilters): boolean =>
  Boolean(
    filters.search || filters.recentMin || filters.recentMax || filters.totalMin || filters.totalMax ||
    filters.recentGmvMin || filters.recentGmvMax || filters.ratingMin || filters.ratingMax ||
    filters.shopType !== "all" || filters.managed !== "all" || filters.creators !== "all" || filters.videos !== "all",
  );

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  step,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div className="filter-block">
      <label>{label}</label>
      <div className="range-inputs">
        <input type="number" min="0" step={step} value={minValue} onChange={(event) => onMinChange(event.target.value)} placeholder="最小值" aria-label={`${label}最小值`} />
        <span>至</span>
        <input type="number" min="0" step={step} value={maxValue} onChange={(event) => onMaxChange(event.target.value)} placeholder="最大值" aria-label={`${label}最大值`} />
      </div>
    </div>
  );
}

function ShopSortButton({
  field,
  sort,
  onSort,
}: {
  field: ShopSortField;
  sort: { field: ShopSortField | null; direction: SortDirection | null };
  onSort: (field: ShopSortField) => void;
}) {
  const active = sort.field === field;
  return (
    <button className={`sort-button${active ? " active" : ""}`} onClick={() => onSort(field)}>
      <span>{sortLabels[field]}</span>
      {active ? (sort.direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} />) : <ArrowUpDown size={14} />}
    </button>
  );
}

function SmallShopList({ hidden }: { hidden: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = usePersistedState<SmallShopWorkspaceState>("small-shops", initialWorkspaceState);
  const { shops, fileName, sort, parseNotice, foundHeaderCount } = workspace;
  const draftFilters = { ...initialFilters, ...workspace.draftFilters };
  const appliedFilters = { ...initialFilters, ...workspace.appliedFilters };
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shops.some((shop) => !Number.isInteger(shop.originalIndex))) return;
    setWorkspace((current) => ({
      ...current,
      shops: current.shops.map((shop, index) => Number.isInteger(shop.originalIndex) ? shop : { ...shop, originalIndex: index }),
    }));
  }, [shops, setWorkspace]);

  const thresholds = useMemo(() => ({
    creators: getPercentileThresholds(shops, "creators"),
    videos: getPercentileThresholds(shops, "videos"),
  }), [shops]);

  const shopTypes = useMemo(
    () => [...new Set(shops.map((shop) => shop.shopType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [shops],
  );
  const regionLabel = useMemo(() => {
    const regions = [...new Set(shops.map((shop) => shop.region).filter((region) => region && region !== "未填写"))];
    return regions.length === 1 ? `${regions[0]}站` : regions.length > 1 ? "多地区" : "";
  }, [shops]);

  const filteredShops = useMemo(() => {
    const recentMin = parseInputNumber(appliedFilters.recentMin);
    const recentMax = parseInputNumber(appliedFilters.recentMax);
    const totalMin = parseInputNumber(appliedFilters.totalMin);
    const totalMax = parseInputNumber(appliedFilters.totalMax);
    const recentGmvMin = parseInputNumber(appliedFilters.recentGmvMin);
    const recentGmvMax = parseInputNumber(appliedFilters.recentGmvMax);
    const ratingMin = parseInputNumber(appliedFilters.ratingMin);
    const ratingMax = parseInputNumber(appliedFilters.ratingMax);
    const creatorsThreshold = presetThreshold(appliedFilters.creators, thresholds.creators);
    const videosThreshold = presetThreshold(appliedFilters.videos, thresholds.videos);
    const searchQuery = (appliedFilters.search ?? "").trim().toLowerCase();

    return shops
      .filter((shop) => {
        if (searchQuery && !shop.name.toLowerCase().includes(searchQuery)) return false;
        if (recentMin !== null && shop.recentSales < recentMin) return false;
        if (recentMax !== null && shop.recentSales > recentMax) return false;
        if (totalMin !== null && shop.totalSales < totalMin) return false;
        if (totalMax !== null && shop.totalSales > totalMax) return false;
        if (recentGmvMin !== null && shop.recentGmv < recentGmvMin) return false;
        if (recentGmvMax !== null && shop.recentGmv > recentGmvMax) return false;
        if (ratingMin !== null && shop.rating < ratingMin) return false;
        if (ratingMax !== null && shop.rating > ratingMax) return false;
        if (appliedFilters.shopType !== "all" && shop.shopType !== appliedFilters.shopType) return false;
        if (appliedFilters.managed !== "all" && shop.managed !== appliedFilters.managed) return false;
        if (shop.creators > creatorsThreshold || shop.videos > videosThreshold) return false;
        return true;
      })
      .sort((a, b) => {
        if (!sort.field || !sort.direction) return (a.originalIndex ?? shops.indexOf(a)) - (b.originalIndex ?? shops.indexOf(b));
        const difference = a[sort.field] - b[sort.field];
        if (difference !== 0) return sort.direction === "desc" ? -difference : difference;
        return (a.originalIndex ?? shops.indexOf(a)) - (b.originalIndex ?? shops.indexOf(b));
      });
  }, [appliedFilters, shops, sort, thresholds]);

  const updateFilter = <K extends keyof ShopFilters>(key: K, value: ShopFilters[K]) => {
    setWorkspace((current) => ({ ...current, draftFilters: { ...current.draftFilters, [key]: value } }));
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await parseShopWorkbook(file);
      const notices: string[] = [];
      if (result.missingHeaders.length) notices.push(`未找到字段：${result.missingHeaders.join("、")}，对应数据将显示为 —`);
      if (result.skippedRows) notices.push(`已跳过 ${result.skippedRows} 行缺少店铺名称或有效链接的数据`);
      setWorkspace({
        shops: result.shops,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        draftFilters: { ...initialFilters },
        appliedFilters: { ...initialFilters },
        sort: { field: null, direction: null },
        parseNotice: notices.join("；"),
        foundHeaderCount: result.foundHeaders.length,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "文件解析失败，请检查文件后重试。");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSort = (field: ShopSortField) => setWorkspace((current) => {
    if (current.sort.field !== field) return { ...current, sort: { field, direction: "desc" } };
    if (current.sort.direction === "desc") return { ...current, sort: { field, direction: "asc" } };
    return { ...current, sort: { field: null, direction: null } };
  });

  const hasDraftChanges = !filtersEqual(draftFilters, appliedFilters);
  const appliedFiltersActive = hasActiveFilters(appliedFilters);
  const hasAnyFilterValues = hasActiveFilters(draftFilters) || hasActiveFilters(appliedFilters);

  return (
    <section className="board-view" hidden={hidden} aria-hidden={hidden}>

      {shops.length > 0 ? (
        <section className="source-bar">
          <div className="source-bar-main">
            <div className="source-bar-icon"><FileSpreadsheet size={18} /></div>
            <div className="source-file"><span>当前数据源</span><strong title={fileName}>{fileName}</strong></div>
            <span className="source-divider" />
            <span className="source-product-count">{formatCount(shops.length)} 家店铺</span>
          </div>
          <div className="source-bar-actions">
            <span className="source-local-note"><CheckCircle2 size={14} /> 本地解析</span>
            <button className="compact-import-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={15} /> {isLoading ? "正在解析…" : "更换 Excel"}</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(event) => void loadFile(event.target.files?.[0])} hidden />
          </div>
        </section>
      ) : (
        <section className="import-card">
          <div className="import-copy">
            <div className="section-icon"><FileSpreadsheet size={20} /></div>
            <div><div className="section-kicker">数据源</div><h2>导入 EchoTik 小店列表</h2><p>支持 .xlsx / .xls，自动识别第 2 行字段表头。</p></div>
          </div>
          <div className={`dropzone${isDragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void loadFile(event.dataTransfer.files[0]); }} onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }} role="button" tabIndex={0} aria-label="选择或拖入店铺 Excel 文件">
            <CloudUpload size={19} /><span>{isLoading ? "正在解析文件…" : "拖入文件，或点击选择"}</span>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(event) => void loadFile(event.target.files?.[0])} hidden />
          </div>
        </section>
      )}

      {error && <div className="notice error-notice" role="alert"><AlertTriangle size={18} /><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X size={16} /></button></div>}

      {shops.length > 0 && <>
        <section className="overview-grid">
          <div className="overview-main"><span>导入数量</span><strong>{formatCount(shops.length)}</strong><small>家店铺</small></div>
          <div className="overview-stat"><span>当前结果</span><strong>{formatCount(filteredShops.length)}</strong><small>符合筛选条件</small></div>
          <div className="overview-stat"><span>店铺类型</span><strong>{shopTypes.length}</strong><small>已识别类型</small></div>
          <div className="overview-stat accent-stat"><span>当前排序</span><strong>{sort.field ? sortLabels[sort.field] : "原始榜单顺序"}</strong><small>{sort.direction === "desc" ? "从高到低" : sort.direction === "asc" ? "从低到高" : "未启用排序"}</small></div>
        </section>

        {parseNotice && <div className="notice info-notice"><CircleHelp size={17} /><span>{parseNotice}</span></div>}

        <section className="filter-card">
          <div className="filter-card-header">
            <div className="filter-title"><Filter size={17} /><strong>筛选条件</strong><span>{appliedFiltersActive ? "已启用组合筛选" : "全部店铺"}</span></div>
            <div className="filter-card-actions">
              {hasDraftChanges && <span className="pending-filter-note">条件已修改，点击应用筛选生效</span>}
              <button className="apply-button" onClick={() => setWorkspace((current) => ({ ...current, appliedFilters: { ...current.draftFilters } }))} disabled={!hasDraftChanges}><Check size={15} /> 应用筛选</button>
              {hasAnyFilterValues && <button className="text-button" onClick={() => setWorkspace((current) => ({ ...current, draftFilters: { ...initialFilters }, appliedFilters: { ...initialFilters } }))}><RefreshCw size={14} /> 清除筛选</button>}
            </div>
          </div>
          <div className="filter-grid shop-filter-grid">
            <div className="filter-block search-filter"><label htmlFor="shop-search">搜索店铺</label><div className="search-input"><Search size={15} /><input id="shop-search" type="search" value={draftFilters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="输入店铺名称" /></div></div>
            <RangeInput label="近 7 天销量" minValue={draftFilters.recentMin} maxValue={draftFilters.recentMax} onMinChange={(value) => updateFilter("recentMin", value)} onMaxChange={(value) => updateFilter("recentMax", value)} />
            <RangeInput label="总销量" minValue={draftFilters.totalMin} maxValue={draftFilters.totalMax} onMinChange={(value) => updateFilter("totalMin", value)} onMaxChange={(value) => updateFilter("totalMax", value)} />
            <RangeInput label="近 7 天 GMV (£)" minValue={draftFilters.recentGmvMin} maxValue={draftFilters.recentGmvMax} onMinChange={(value) => updateFilter("recentGmvMin", value)} onMaxChange={(value) => updateFilter("recentGmvMax", value)} />
            <RangeInput label="店铺评分" minValue={draftFilters.ratingMin} maxValue={draftFilters.ratingMax} onMinChange={(value) => updateFilter("ratingMin", value)} onMaxChange={(value) => updateFilter("ratingMax", value)} step="0.1" />
            <div className="filter-block"><label htmlFor="shop-type-filter">店铺类型</label><div className="select-wrap"><select id="shop-type-filter" value={draftFilters.shopType} onChange={(event) => updateFilter("shopType", event.target.value)}><option value="all">不限</option>{shopTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><ChevronDown size={15} /></div></div>
            <div className="filter-block"><label htmlFor="managed-filter">全托管</label><div className="select-wrap"><select id="managed-filter" value={draftFilters.managed} onChange={(event) => updateFilter("managed", event.target.value as ShopFilters["managed"])}><option value="all">不限</option><option value="是">是</option><option value="否">否</option></select><ChevronDown size={15} /></div></div>
            <div className="filter-block"><label htmlFor="shop-creators-filter">总达人数 <span className="label-help" title="百分位基于当前导入的全部店铺数据计算"><CircleHelp size={13} /></span></label><div className="select-wrap"><select id="shop-creators-filter" value={draftFilters.creators} onChange={(event) => updateFilter("creators", event.target.value as PercentilePreset)}><option value="all">不限</option><option value="p15">最低 15% · ≤ {formatCompact(thresholds.creators.p15)}</option><option value="p20">最低 20% · ≤ {formatCompact(thresholds.creators.p20)}</option><option value="p50">最低 50% · ≤ {formatCompact(thresholds.creators.p50)}</option></select><ChevronDown size={15} /></div></div>
            <div className="filter-block"><label htmlFor="shop-videos-filter">视频数 <span className="label-help" title="百分位基于当前导入的全部店铺数据计算"><CircleHelp size={13} /></span></label><div className="select-wrap"><select id="shop-videos-filter" value={draftFilters.videos} onChange={(event) => updateFilter("videos", event.target.value as PercentilePreset)}><option value="all">不限</option><option value="p15">最低 15% · ≤ {formatCompact(thresholds.videos.p15)}</option><option value="p20">最低 20% · ≤ {formatCompact(thresholds.videos.p20)}</option><option value="p50">最低 50% · ≤ {formatCompact(thresholds.videos.p50)}</option></select><ChevronDown size={15} /></div></div>
          </div>
          <div className="filter-footnote"><Search size={13} /> 百分位档位根据本次导入的完整店铺数据动态计算，支持多个条件同时生效。</div>
        </section>

        <section className="list-card shop-list-card">
          <div className="list-card-header shop-list-card-header"><div><div className="list-heading"><h2>店铺榜单</h2><span className="result-pill">{formatCount(filteredShops.length)} 个结果</span>{regionLabel && <span className="market-badge"><Globe2 size={17} /><span>{regionLabel}</span></span>}</div><p>点击店铺名称打开 EchoTik 原店铺页</p></div><div className="list-actions"><Store size={15} /> {presetName(appliedFilters.creators)} 达人 · {presetName(appliedFilters.videos)} 视频</div></div>
          <div className="table-wrap"><table className="shop-table" data-sort-field={sort.field ?? undefined}><colgroup><col className="shop-col-name" /><col className="shop-col-type" /><col className="shop-col-rating" /><col className="shop-col-recent-sales" /><col className="shop-col-total-sales" /><col className="shop-col-gmv" /><col className="shop-col-products" /><col className="shop-col-creators" /><col className="shop-col-videos" /><col className="shop-col-lives" /></colgroup><thead><tr><th className="shop-name-column">店铺</th><th>店铺类型</th><th className="shop-number-column"><ShopSortButton field="rating" sort={sort} onSort={handleSort} /></th><th className="shop-number-column"><ShopSortButton field="recentSales" sort={sort} onSort={handleSort} /></th><th className="shop-number-column"><ShopSortButton field="totalSales" sort={sort} onSort={handleSort} /></th><th className="shop-number-column"><ShopSortButton field="recentGmv" sort={sort} onSort={handleSort} /></th><th className="shop-number-column">带货 / 在店商品</th><th className="shop-number-column"><ShopSortButton field="creators" sort={sort} onSort={handleSort} /></th><th className="shop-number-column"><ShopSortButton field="videos" sort={sort} onSort={handleSort} /></th><th className="shop-number-column"><ShopSortButton field="lives" sort={sort} onSort={handleSort} /></th></tr></thead>
            <tbody>{filteredShops.map((shop) => <tr key={`${shop.id}-${shop.url}`}><td className="shop-name-column"><a className="shop-name-link" href={shop.url} target="_blank" rel="noreferrer"><span className="shop-avatar"><Store size={17} /></span><span><strong title={shop.name}>{shop.name}</strong><small>{shop.deliveryCategory || "未填写分类"}</small></span></a></td><td><div className="shop-cell"><span>{shop.shopType}</span><small>{shop.managed ? `全托管：${shop.managed}` : "全托管：—"}</small></div></td><td className="shop-number-column"><span className="rating-badge">{shop.rating ? shop.rating.toFixed(1) : "—"}</span></td><td className="shop-number-column"><span className="metric-value highlight">{formatCompact(shop.recentSales)}</span><small className="metric-label">近 7 天</small></td><td className="shop-number-column"><span className="metric-value">{formatCompact(shop.totalSales)}</span><small className="metric-label">累计销量</small></td><td className="shop-number-column"><span className="metric-value amount-value">£{formatCompact(shop.recentGmv)}</span><small className="metric-label">近 7 天</small></td><td className="shop-number-column"><span className="metric-value">{formatCompact(shop.promotedProductCount)}</span><small className="metric-label">在店 {formatCompact(shop.totalProducts)}</small></td><td className="shop-number-column"><span className="metric-value">{formatCount(shop.creators)}</span></td><td className="shop-number-column"><span className="metric-value">{formatCount(shop.videos)}</span></td><td className="shop-number-column"><span className="metric-value">{formatCount(shop.lives)}</span></td></tr>)}</tbody></table>
            {!filteredShops.length && <div className="no-results"><div className="empty-icon small"><Search size={20} /></div><strong>没有符合条件的店铺</strong><span>尝试放宽筛选范围，或清除筛选重新查看。</span><button className="text-button" onClick={() => setWorkspace((current) => ({ ...current, draftFilters: { ...initialFilters }, appliedFilters: { ...initialFilters } }))}>清除筛选</button></div>}
          </div>
        </section>
      </>}

      {!shops.length && !error && <div className="empty-state"><div className="empty-icon"><Store size={30} /></div><h2>导入店铺数据，开始筛选</h2><p>支持 EchoTik 导出的小店列表 Excel，文件只在当前浏览器本地解析。</p><button className="primary-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={17} /> 选择 Excel 文件</button></div>}
    </section>
  );
}

type ShopView = "shops" | "crossborder" | "local";

const shopViewLabels: Record<ShopView, string> = {
  shops: "小店列表",
  crossborder: "跨境卖家榜",
  local: "本土卖家榜",
};

export default function ShopBoard({ hidden = false }: { hidden?: boolean }) {
  const [shopNavigation, setShopNavigation] = usePersistedState<{ activeView: ShopView }>("shop-navigation", () => ({ activeView: "shops" }));
  const activeView = shopNavigation.activeView;
  return (
    <main id="shops-workspace" className="workspace" hidden={hidden} aria-hidden={hidden}>
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> SHOP RANKING</div>
          <h1>{shopViewLabels[activeView]}</h1>
          <p>{activeView === "shops" ? "从 EchoTik 小店数据中快速筛选值得进一步关注的店铺。" : "导入对应的 EchoTik 卖家榜数据，筛选值得进一步关注的店铺。"}</p>
        </div>
        <div className="privacy-note"><CheckCircle2 size={16} /> 文件仅在浏览器本地解析</div>
      </section>
      <section className="board-switcher" aria-label="店铺榜单数据类型">
        {(Object.keys(shopViewLabels) as ShopView[]).map((view) => <button key={view} type="button" className={activeView === view ? "active" : ""} onClick={() => setShopNavigation({ activeView: view })}>{shopViewLabels[view]}</button>)}
      </section>
      <SmallShopList hidden={activeView !== "shops"} />
      <SellerRankBoard kind="crossborder" hidden={activeView !== "crossborder"} />
      <SellerRankBoard kind="local" hidden={activeView !== "local"} />
    </main>
  );
}
