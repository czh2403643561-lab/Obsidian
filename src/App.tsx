import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  Check,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  LayoutDashboard,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { parseProductWorkbook } from "./parser";
import ShopBoard from "./ShopBoard";
import type {
  Filters,
  PercentilePreset,
  Product,
  ProductPeriod,
  SortDirection,
  SortField,
} from "./types";
import {
  formatCompact,
  formatCount,
  formatCurrency,
  formatRate,
  getPercentileThresholds,
  hasActiveFilters,
  presetThreshold,
} from "./utils";

const initialFilters: Filters = {
  totalMin: "",
  totalMax: "",
  recentMin: "",
  recentMax: "",
  creators: "all",
  videos: "all",
};

const sortLabels: Record<Exclude<SortField, "recentSales">, string> = {
  totalSales: "总销量",
  creators: "带货达人数",
  videos: "视频数",
  price: "价格",
  commissionRate: "佣金率",
};

const periodLabel = (period: ProductPeriod): string => period === "7d" ? "近7天" : "近30天";

const sortLabel = (field: SortField, period: ProductPeriod): string =>
  field === "recentSales" ? `${periodLabel(period)}销量` : sortLabels[field];

interface ProductDataset {
  products: Product[];
  fileName: string;
  foundHeaderCount: number;
  parseNotice: string;
  draftFilters: Filters;
  appliedFilters: Filters;
  sort: { field: SortField; direction: SortDirection };
}

type ProductDatasets = Partial<Record<ProductPeriod, ProductDataset>>;

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

const filtersEqual = (left: Filters, right: Filters): boolean =>
  left.totalMin === right.totalMin &&
  left.totalMax === right.totalMax &&
  left.recentMin === right.recentMin &&
  left.recentMax === right.recentMax &&
  left.creators === right.creators &&
  left.videos === right.videos;

const sortValue = (product: Product, field: SortField): number => product[field];

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="product-image product-image-fallback" aria-label="暂无商品图片">
        <ImageIcon size={21} strokeWidth={1.7} />
      </span>
    );
  }

  return (
    <span className="product-image">
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

function SortButton({
  field,
  sort,
  period,
  onSort,
}: {
  field: SortField;
  sort: { field: SortField; direction: SortDirection };
  period: ProductPeriod;
  onSort: (field: SortField) => void;
}) {
  const active = sort.field === field;
  return (
    <button className={`sort-button${active ? " active" : ""}`} onClick={() => onSort(field)}>
      <span>{sortLabel(field, period)}</span>
      {active ? (
        sort.direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} />
      ) : (
        <ArrowUpDown size={14} />
      )}
    </button>
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <div className="filter-block">
      <label>{label}</label>
      <div className="range-inputs">
        <input
          type="number"
          min="0"
          value={minValue}
          onChange={(event) => onMinChange(event.target.value)}
          placeholder="最小值"
          aria-label={`${label}最小值`}
        />
        <span>至</span>
        <input
          type="number"
          min="0"
          value={maxValue}
          onChange={(event) => onMaxChange(event.target.value)}
          placeholder="最大值"
          aria-label={`${label}最大值`}
        />
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><PackageSearch size={30} /></div>
      <h2>导入商品数据，开始筛选</h2>
      <p>支持 EchoTik 近7天和近30天商品列表 Excel，文件只在当前浏览器本地解析。</p>
      <button className="primary-button" onClick={onPick}>
        <CloudUpload size={17} /> 选择 Excel 文件
      </button>
    </div>
  );
}

function App() {
  const [activeModule, setActiveModule] = useState<"products" | "shops">("products");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productDatasets, setProductDatasets] = useState<ProductDatasets>({});
  const [activePeriod, setActivePeriod] = useState<ProductPeriod>("7d");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const activeDataset = productDatasets[activePeriod];
  const products = activeDataset?.products ?? [];
  const fileName = activeDataset?.fileName ?? "";
  const draftFilters = activeDataset?.draftFilters ?? initialFilters;
  const appliedFilters = activeDataset?.appliedFilters ?? initialFilters;
  const sort = activeDataset?.sort ?? { field: "recentSales", direction: "desc" as SortDirection };
  const parseNotice = activeDataset?.parseNotice ?? "";
  const foundHeaderCount = activeDataset?.foundHeaderCount ?? 0;
  const hasAnyProductData = Boolean(productDatasets["7d"] || productDatasets["30d"]);

  const thresholds = useMemo(() => ({
    creators: getPercentileThresholds(products, "creators"),
    videos: getPercentileThresholds(products, "videos"),
  }), [products]);

  const filteredProducts = useMemo(() => {
    const totalMin = parseInputNumber(appliedFilters.totalMin);
    const totalMax = parseInputNumber(appliedFilters.totalMax);
    const recentMin = parseInputNumber(appliedFilters.recentMin);
    const recentMax = parseInputNumber(appliedFilters.recentMax);
    const creatorsThreshold = presetThreshold(appliedFilters.creators, thresholds.creators);
    const videosThreshold = presetThreshold(appliedFilters.videos, thresholds.videos);

    return products
      .filter((product) => {
        if (totalMin !== null && product.totalSales < totalMin) return false;
        if (totalMax !== null && product.totalSales > totalMax) return false;
        if (recentMin !== null && product.recentSales < recentMin) return false;
        if (recentMax !== null && product.recentSales > recentMax) return false;
        if (product.creators > creatorsThreshold) return false;
        if (product.videos > videosThreshold) return false;
        return true;
      })
      .sort((a, b) => {
        const difference = sortValue(a, sort.field) - sortValue(b, sort.field);
        if (difference !== 0) return sort.direction === "desc" ? -difference : difference;
        return a.name.localeCompare(b.name, "zh-CN");
      });
  }, [appliedFilters, products, sort, thresholds]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setProductDatasets((current) => {
      const dataset = current[activePeriod];
      if (!dataset) return current;
      return { ...current, [activePeriod]: { ...dataset, draftFilters: { ...dataset.draftFilters, [key]: value } } };
    });
  };

  const handleSort = (field: SortField) => {
    setProductDatasets((current) => {
      const dataset = current[activePeriod];
      if (!dataset) return current;
      const nextSort = {
        field,
        direction: dataset.sort.field === field && dataset.sort.direction === "desc" ? "asc" : "desc",
      } as { field: SortField; direction: SortDirection };
      return { ...current, [activePeriod]: { ...dataset, sort: nextSort } };
    });
  };

  const applyFilters = () => setProductDatasets((current) => {
    const dataset = current[activePeriod];
    if (!dataset) return current;
    return { ...current, [activePeriod]: { ...dataset, appliedFilters: { ...dataset.draftFilters } } };
  });

  const clearFilters = () => setProductDatasets((current) => {
    const dataset = current[activePeriod];
    if (!dataset) return current;
    return { ...current, [activePeriod]: { ...dataset, draftFilters: { ...initialFilters }, appliedFilters: { ...initialFilters } } };
  });

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await parseProductWorkbook(file);
      const notices: string[] = [];
      if (result.missingHeaders.length) notices.push(`未找到字段：${result.missingHeaders.join("、")}，对应数据将显示为 —`);
      if (result.skippedRows) notices.push(`已跳过 ${result.skippedRows} 行缺少商品名称或有效链接的数据`);
      setProductDatasets((current) => ({
        ...current,
        [result.period]: {
          products: result.products,
          fileName: file.name,
          foundHeaderCount: result.foundHeaders.length,
          parseNotice: notices.join("；"),
          draftFilters: { ...initialFilters },
          appliedFilters: { ...initialFilters },
          sort: { field: "recentSales", direction: "desc" },
        },
      }));
      setActivePeriod(result.period);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "文件解析失败，请检查文件后重试。");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void loadFile(event.target.files?.[0]);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  };

  const hasDraftChanges = Boolean(activeDataset && !filtersEqual(draftFilters, appliedFilters));
  const appliedFiltersActive = hasActiveFilters(appliedFilters);
  const hasAnyFilterValues = hasActiveFilters(draftFilters) || hasActiveFilters(appliedFilters);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={18} fill="currentColor" /></div>
          <div>
            <strong>Obsidian</strong>
            <span>选品工作台</span>
          </div>
        </div>
        <nav className="topnav" aria-label="主导航">
          <button type="button" className={activeModule === "products" ? "active" : ""} onClick={() => setActiveModule("products")}><LayoutDashboard size={16} /> 商品列表</button>
          <button type="button" className={activeModule === "shops" ? "active" : ""} onClick={() => setActiveModule("shops")}><Store size={16} /> 店铺榜单</button>
        </nav>
        <div className="topbar-right">
          <div className="local-badge"><span className="status-dot" /> 本地工作区</div>
          <div className="avatar">O</div>
        </div>
      </header>

      <main id="workspace" className={`workspace${hasAnyProductData ? " work-mode" : ""}`} hidden={activeModule !== "products"} aria-hidden={activeModule !== "products"}>
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> PRODUCT DISCOVERY</div>
            <h1>商品列表</h1>
            <p>从 EchoTik 数据中快速识别值得进一步跟进的商品机会。</p>
          </div>
          <div className="privacy-note"><CheckCircle2 size={16} /> 文件仅在浏览器本地解析</div>
        </section>

        <section className="period-switcher" aria-label="商品数据周期">
          {(["7d", "30d"] as ProductPeriod[]).map((period) => {
            const dataset = productDatasets[period];
            return (
              <button key={period} type="button" className={`period-tab${activePeriod === period ? " active" : ""}${dataset ? " available" : ""}`} onClick={() => { setActivePeriod(period); setError(""); }}>
                <span>{periodLabel(period)}</span>
                <small>{dataset ? `${formatCount(dataset.products.length)} 件商品` : "未导入"}</small>
              </button>
            );
          })}
        </section>

        {activeDataset ? (
          <section className="source-bar">
            <div className="source-bar-main">
              <div className="source-bar-icon"><FileSpreadsheet size={18} /></div>
              <div className="source-file">
                <span>当前数据源 · {periodLabel(activePeriod)}数据</span>
                <strong title={fileName}>{fileName}</strong>
              </div>
              <span className="source-divider" />
              <span className="source-product-count">{formatCount(products.length)} 件商品</span>
            </div>
            <div className="source-bar-actions">
              <span className="source-local-note"><CheckCircle2 size={14} /> 本地解析</span>
              <button className="compact-import-button" onClick={() => fileInputRef.current?.click()}>
                <CloudUpload size={15} /> {isLoading ? "正在解析…" : "更换 Excel"}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} hidden />
            </div>
          </section>
        ) : hasAnyProductData ? (
          <section className="period-import-guide">
            <div className="period-import-copy">
              <div className="section-icon"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="section-kicker">{periodLabel(activePeriod)} 数据</div>
                <h2>{periodLabel(activePeriod)}商品列表尚未导入</h2>
                <p>选择对应周期的 EchoTik 商品列表 Excel，系统会自动识别字段。</p>
              </div>
            </div>
            <button className="primary-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={17} /> 导入 {periodLabel(activePeriod)} Excel</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} hidden />
          </section>
        ) : (
          <section className="import-card">
            <div className="import-copy">
              <div className="section-icon"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="section-kicker">数据源</div>
                <h2>导入 EchoTik 商品列表</h2>
                <p>支持 EchoTik 近7天和近30天商品列表，系统会根据 Excel 字段自动识别数据周期。</p>
              </div>
            </div>
            <div
              className={`dropzone${isDragging ? " dragging" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              aria-label="选择或拖入 Excel 文件"
            >
              <CloudUpload size={19} />
              <span>{isLoading ? "正在解析文件…" : "拖入文件，或点击选择"}</span>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} hidden />
            </div>
          </section>
        )}

        {error && (
          <div className="notice error-notice" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button aria-label="关闭错误提示" onClick={() => setError("")}><X size={16} /></button>
          </div>
        )}

        {activeDataset && (
          <>
            <section className="overview-grid">
              <div className="overview-main">
                <span>导入数量</span>
                <strong>{formatCount(products.length)}</strong>
                <small>件商品</small>
              </div>
              <div className="overview-stat">
                <span>当前结果</span>
                <strong>{formatCount(filteredProducts.length)}</strong>
                <small>符合筛选条件</small>
              </div>
              <div className="overview-stat">
                <span>数据字段</span>
                <strong>{foundHeaderCount}</strong>
                <small>已识别核心字段</small>
              </div>
              <div className="overview-stat accent-stat">
                <span>当前排序</span>
                <strong>{sortLabel(sort.field, activePeriod)}</strong>
                <small>{sort.direction === "desc" ? "从高到低" : "从低到高"}</small>
              </div>
            </section>

            {parseNotice && (
              <div className="notice info-notice">
                <CircleHelp size={17} /> <span>{parseNotice}</span>
              </div>
            )}

            <section className="filter-card">
              <div className="filter-card-header">
                <div className="filter-title"><Filter size={17} /><strong>筛选条件</strong><span>{appliedFiltersActive ? "已启用组合筛选" : "全部商品"}</span></div>
                <div className="filter-card-actions">
                  {hasDraftChanges && <span className="pending-filter-note">条件已修改，点击应用筛选生效</span>}
                  <button className="apply-button" onClick={applyFilters} disabled={!hasDraftChanges}><Check size={15} /> 应用筛选</button>
                  {hasAnyFilterValues && (
                    <button className="text-button" onClick={clearFilters}><RefreshCw size={14} /> 清除筛选</button>
                  )}
                </div>
              </div>
              <div className="filter-grid">
                <RangeInput
                  label="总销量"
                  minValue={draftFilters.totalMin}
                  maxValue={draftFilters.totalMax}
                  onMinChange={(value) => updateFilter("totalMin", value)}
                  onMaxChange={(value) => updateFilter("totalMax", value)}
                />
                <RangeInput
                  label={`${periodLabel(activePeriod)}销量`}
                  minValue={draftFilters.recentMin}
                  maxValue={draftFilters.recentMax}
                  onMinChange={(value) => updateFilter("recentMin", value)}
                  onMaxChange={(value) => updateFilter("recentMax", value)}
                />
                <div className="filter-block">
                  <label htmlFor="creators-filter">带货达人数 <span className="label-help" title="百分位基于当前导入的全部商品数据计算"><CircleHelp size={13} /></span></label>
                  <div className="select-wrap">
                    <select id="creators-filter" value={draftFilters.creators} onChange={(event) => updateFilter("creators", event.target.value as PercentilePreset)}>
                      <option value="all">不限</option>
                      <option value="p15">最低 15% · ≤ {formatCompact(thresholds.creators.p15)}</option>
                      <option value="p20">最低 20% · ≤ {formatCompact(thresholds.creators.p20)}</option>
                      <option value="p50">最低 50% · ≤ {formatCompact(thresholds.creators.p50)}</option>
                    </select>
                    <ChevronDown size={15} />
                  </div>
                </div>
                <div className="filter-block">
                  <label htmlFor="videos-filter">视频数 <span className="label-help" title="百分位基于当前导入的全部商品数据计算"><CircleHelp size={13} /></span></label>
                  <div className="select-wrap">
                    <select id="videos-filter" value={draftFilters.videos} onChange={(event) => updateFilter("videos", event.target.value as PercentilePreset)}>
                      <option value="all">不限</option>
                      <option value="p15">最低 15% · ≤ {formatCompact(thresholds.videos.p15)}</option>
                      <option value="p20">最低 20% · ≤ {formatCompact(thresholds.videos.p20)}</option>
                      <option value="p50">最低 50% · ≤ {formatCompact(thresholds.videos.p50)}</option>
                    </select>
                    <ChevronDown size={15} />
                  </div>
                </div>
              </div>
              <div className="filter-footnote"><Search size={13} /> 百分位档位根据本次导入的完整商品数据动态计算，支持多个条件同时生效。</div>
            </section>

            <section className="list-card">
              <div className="list-card-header">
                <div>
                  <div className="list-heading"><h2>商品列表</h2><span className="result-pill">{formatCount(filteredProducts.length)} 个结果</span></div>
                  <p>点击图片、名称或右侧入口打开 TikTok 原商品页</p>
                </div>
                <div className="list-actions"><Store size={15} /> {presetName(appliedFilters.creators)} 达人 · {presetName(appliedFilters.videos)} 视频</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="product-column">商品</th>
                      <th>所属店铺</th>
                      <th><SortButton field="price" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th><SortButton field="recentSales" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th><SortButton field="totalSales" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th><SortButton field="creators" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th><SortButton field="videos" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th><SortButton field="commissionRate" sort={sort} period={activePeriod} onSort={handleSort} /></th>
                      <th className="action-column">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={`${product.id}-${product.url}`}>
                        <td className="product-column">
                          <a className="product-cell" href={product.url} target="_blank" rel="noreferrer">
                            <ProductImage src={product.coverUrl} alt={product.name} />
                            <span className="product-copy">
                              <strong title={product.name}>{product.name}</strong>
                              <span className="product-meta">
                                {product.category || "未分类"}
                                {product.rating > 0 && <em>评分 {product.rating.toFixed(1)}</em>}
                                {product.reviews > 0 && <em>{formatCompact(product.reviews)} 条评论</em>}
                              </span>
                            </span>
                          </a>
                        </td>
                        <td>
                          <div className="shop-cell"><span>{product.shopName}</span><small>{product.estimatedTime || "—"}</small></div>
                        </td>
                        <td><span className="price-value">{product.price ? formatCurrency(product.price) : "—"}</span></td>
                        <td><span className="metric-value highlight">{formatCompact(product.recentSales)}</span><small className="metric-label">{periodLabel(activePeriod)}</small></td>
                        <td><span className="metric-value">{formatCompact(product.totalSales)}</span><small className="metric-label">累计销量</small></td>
                        <td><span className="metric-value">{formatCount(product.creators)}</span></td>
                        <td><span className="metric-value">{formatCount(product.videos)}</span></td>
                        <td><span className="commission-badge">{product.commissionRate ? formatRate(product.commissionRate) : "—"}</span></td>
                        <td className="action-column">
                          <a className="view-link" href={product.url} target="_blank" rel="noreferrer" title="查看商品">
                            <ExternalLink size={15} /> <span>查看商品</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredProducts.length && (
                  <div className="no-results"><div className="empty-icon small"><Search size={20} /></div><strong>没有符合条件的商品</strong><span>尝试放宽筛选范围，或清除筛选重新查看。</span><button className="text-button" onClick={clearFilters}>清除筛选</button></div>
                )}
              </div>
            </section>
          </>
        )}

        {!hasAnyProductData && !error && <EmptyState onPick={() => fileInputRef.current?.click()} />}
      </main>
      <ShopBoard hidden={activeModule !== "shops"} />
      <footer className="footer"><span>Obsidian 选品工作台</span><span>EchoTik 数据 · 本地解析</span></footer>
    </div>
  );
}

export default App;
