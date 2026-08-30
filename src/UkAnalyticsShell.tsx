import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, FileUp, X } from "lucide-react";
import { usePersistedState } from "./persistence";
import { parseUkAnalyticsFile } from "./ukAnalytics/parser";
import StoreBusinessPage from "./ukAnalytics/StoreBusinessPage";
import MallOverviewPage from "./ukAnalytics/MallOverviewPage";
import StoreKeywordsPage from "./ukAnalytics/StoreKeywordsPage";
import { createUkAnalyticsState, type UkAnalyticsState, type UkDataSnapshot, type UkDataSourceKey, type UkMallOverviewData, type UkParsedImport, type UkStoreBusinessData, type UkStoreKeywordsData, ukSourceLabels } from "./ukAnalytics/types";

type UkTopSection = "store" | "content" | "mall" | "product" | "marketing" | "after-sales";
type MallPage = "overview" | "recommended" | "store-page" | "keywords";
type ProductPage = "details" | "hot" | "traffic" | "ranking";

const mallSources: Partial<Record<MallPage, UkDataSourceKey>> = { overview: "mall-overview", keywords: "store-keywords" };
const productSources: Partial<Record<ProductPage, UkDataSourceKey>> = { details: "product-details", traffic: "product-traffic" };
const formatDate = (value: string | null): string => value ? value.replace(/-/g, "/") : "未确认周期";
const snapshotSort = (items: UkDataSnapshot[]): UkDataSnapshot[] => [...items].sort((left, right) => (right.endDate ?? "").localeCompare(left.endDate ?? "") || right.importedAt.localeCompare(left.importedAt));
const periodText = (snapshot: UkDataSnapshot | null): string => snapshot ? snapshot.startDate && snapshot.endDate ? `${formatDate(snapshot.startDate)} – ${formatDate(snapshot.endDate)}` : "周期待确认" : "未导入周期";

const sourceGroups: Array<{ title: string; sources: UkDataSourceKey[] }> = [
  { title: "店铺数据分析", sources: ["store-business"] },
  { title: "商城页和搜索", sources: ["mall-overview", "store-keywords"] },
  { title: "商品数据分析", sources: ["product-details", "product-traffic"] },
];

function UKSidebar({ kind, page, onPage }: { kind: "mall" | "product"; page: MallPage | ProductPage; onPage: (next: MallPage | ProductPage) => void }) {
  const mall = kind === "mall";
  const items = mall ? [
    { key: "overview", label: "商城页概览", section: "商城页" }, { key: "recommended", label: "推荐", section: "" }, { key: "store-page", label: "店铺页面", section: "" }, { key: "keywords", label: "店铺关键词", section: "搜索" },
  ] : [
    { key: "details", label: "详细信息", section: "商品" }, { key: "hot", label: "热卖商品", section: "" }, { key: "traffic", label: "商品流量", section: "" }, { key: "ranking", label: "TikTok 热卖商品榜", section: "商品榜单" },
  ];
  return <aside className="hf-sidebar uk-secondary-sidebar" aria-label={mall ? "商城页和搜索导航" : "商品数据分析导航"}>{items.map((item, index) => <section key={item.key} className={item.section && index ? "uk-sidebar-section" : ""}>{item.section && <span>{item.section}</span>}<button className={page === item.key ? "active" : ""} onClick={() => onPage(item.key as MallPage | ProductPage)}>{item.label}</button></section>)}</aside>;
}

function UKDataManager({ state, activeSnapshot, pending, pendingPeriod, message, onImport, onSelect, onConfirm, onPendingPeriod, onClose }: {
  state: UkAnalyticsState;
  activeSnapshot: (source: UkDataSourceKey) => UkDataSnapshot | null;
  pending: UkParsedImport | null;
  pendingPeriod: { startDate: string; endDate: string };
  message: string;
  onImport: () => void;
  onSelect: (source: UkDataSourceKey, id: string) => void;
  onConfirm: () => void;
  onPendingPeriod: (patch: Partial<{ startDate: string; endDate: string }>) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<UkDataSourceKey | null>(null);
  return <aside className="hf-data-manager uk-data-manager" aria-label="数据管理"><header><div><strong>数据管理</strong><small>页面数据独立保存在当前浏览器</small></div><button onClick={onClose} aria-label="关闭数据管理"><X size={15} /></button></header>{pending && <section className="uk-import-confirm"><strong>识别为：{ukSourceLabels[pending.source]}</strong><small>{pending.requiresPeriodConfirmation ? "该文件未提供数据周期，请确认后保存。" : `数据周期：${formatDate(pending.startDate)} – ${formatDate(pending.endDate)}`}</small>{pending.requiresPeriodConfirmation && <div><input type="date" value={pendingPeriod.startDate} onChange={(event) => onPendingPeriod({ startDate: event.target.value })} aria-label="开始日期" /><span>–</span><input type="date" value={pendingPeriod.endDate} onChange={(event) => onPendingPeriod({ endDate: event.target.value })} aria-label="结束日期" /></div>}<footer><button onClick={onConfirm}>确认导入</button></footer></section>}{sourceGroups.map((group) => <section key={group.title} className="uk-manager-group"><h3>{group.title}</h3>{group.sources.map((source) => { const snapshots = snapshotSort(state.snapshots[source]); const current = activeSnapshot(source); const open = expanded === source; const sourceLabel = ukSourceLabels[source].split(" → "); return <article key={source} className="uk-manager-source"><div><strong>{sourceLabel[sourceLabel.length - 1]}</strong><small>当前：{periodText(current)}</small><small>历史：{snapshots.length} 个周期</small></div><footer><button onClick={onImport}>导入</button><button onClick={() => setExpanded(open ? null : source)}>{open ? "收起" : "历史"}</button></footer>{open && <div className="uk-history-list">{snapshots.length ? snapshots.map((snapshot) => <button key={snapshot.id} className={snapshot.id === current?.id ? "active" : ""} onClick={() => onSelect(source, snapshot.id)}>{periodText(snapshot)}<small>{snapshot.fileName}</small></button>) : <span>尚未导入数据</span>}</div>}</article>; })}</section>)}<section className="uk-manager-footer"><button onClick={onImport}><FileUp size={14} /> 选择 Excel 自动识别</button>{message && <p>{message}</p>}</section></aside>;
}

function UKPagePlaceholder({ source, label }: { source: UkDataSourceKey | null; label: string }) {
  return <section className="hf-panel uk-page-placeholder">{source ? <><strong>{ukSourceLabels[source]}{source ? "" : label}</strong><span>该页面数据将在下一阶段接入真实展示。</span></> : <span>{label}</span>}</section>;
}

export default function UkAnalyticsShell() {
  const [state, setState] = usePersistedState<UkAnalyticsState>("uk-analytics-workspace", createUkAnalyticsState);
  const [section, setSection] = useState<UkTopSection>("store");
  const [mallPage, setMallPage] = useState<MallPage>("overview");
  const [productPage, setProductPage] = useState<ProductPage>("details");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [pending, setPending] = useState<UkParsedImport | null>(null);
  const [pendingPeriod, setPendingPeriod] = useState({ startDate: "", endDate: "" });
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSource = section === "store" ? "store-business" : section === "mall" ? mallSources[mallPage] ?? null : section === "product" ? productSources[productPage] ?? null : null;
  const activeSnapshot = (source: UkDataSourceKey): UkDataSnapshot | null => {
    const snapshots = snapshotSort(state.snapshots[source]);
    return snapshots.find((snapshot) => snapshot.id === state.activeSnapshotIds[source]) ?? snapshots[0] ?? null;
  };
  const previousSnapshot = (source: UkDataSourceKey): UkDataSnapshot | null => {
    const snapshots = snapshotSort(state.snapshots[source]);
    const current = activeSnapshot(source);
    const currentIndex = snapshots.findIndex((snapshot) => snapshot.id === current?.id);
    return currentIndex >= 0 ? snapshots[currentIndex + 1] ?? null : null;
  };
  const currentSnapshot = currentSource ? activeSnapshot(currentSource) : null;
  const latestKnownPeriod = useMemo(() => Object.values(state.snapshots).flat().filter((snapshot) => snapshot.startDate && snapshot.endDate).sort((left, right) => right.importedAt.localeCompare(left.importedAt))[0] ?? null, [state.snapshots]);
  const title = section === "store" ? "店铺数据分析" : section === "content" ? "内容分析" : section === "mall" ? "商城页和搜索" : section === "product" ? "商品数据分析" : section === "marketing" ? "营销数据分析" : "售后数据分析";
  const selectSnapshot = (source: UkDataSourceKey, id: string) => { setState((current) => ({ ...current, activeSnapshotIds: { ...current.activeSnapshotIds, [source]: id } })); setPeriodOpen(false); };
  const openImport = () => { setMessage(""); inputRef.current?.click(); };
  const readImport = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    try {
      const next = await parseUkAnalyticsFile(file);
      const fallback = latestKnownPeriod;
      setPending(next);
      setPendingPeriod({ startDate: next.startDate ?? fallback?.startDate ?? "", endDate: next.endDate ?? fallback?.endDate ?? "" });
      setManagerOpen(true);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法读取该 Excel 文件。"); setManagerOpen(true); }
    finally { if (inputRef.current) inputRef.current.value = ""; }
  };
  const confirmImport = () => {
    if (!pending) return;
    const startDate = pending.startDate ?? (pendingPeriod.startDate || null);
    const endDate = pending.endDate ?? (pendingPeriod.endDate || null);
    if (pending.requiresPeriodConfirmation && (!startDate || !endDate)) { setMessage("请确认该文件所属的开始和结束日期。"); return; }
    const snapshot: UkDataSnapshot = { id: crypto.randomUUID(), source: pending.source, startDate, endDate, importedAt: new Date().toISOString(), fileName: pending.fileName, data: pending.data };
    setState((current) => ({ ...current, snapshots: { ...current.snapshots, [pending.source]: [snapshot, ...current.snapshots[pending.source].filter((item) => item.startDate !== startDate || item.endDate !== endDate)] }, activeSnapshotIds: { ...current.activeSnapshotIds, [pending.source]: snapshot.id } }));
    setPending(null);
    setMessage(`已导入：${ukSourceLabels[snapshot.source]}`);
  };
  const changeSection = (next: UkTopSection) => { setSection(next); setPeriodOpen(false); };
  const storeSnapshot = currentSnapshot?.source === "store-business" ? currentSnapshot as UkDataSnapshot<UkStoreBusinessData> : null;
  const storePrevious = previousSnapshot("store-business") as UkDataSnapshot<UkStoreBusinessData> | null;
  const mallSnapshot = currentSnapshot?.source === "mall-overview" ? currentSnapshot as UkDataSnapshot<UkMallOverviewData> : null;
  const keywordSnapshot = currentSnapshot?.source === "store-keywords" ? currentSnapshot as UkDataSnapshot<UkStoreKeywordsData> : null;
  const mainContent = section === "store" ? <StoreBusinessPage snapshot={storeSnapshot} previous={storePrevious} onImport={openImport} /> : section === "content" ? <UKPagePlaceholder source={null} label="当前工作台暂未接入内容分析数据" /> : section === "mall" && mallPage === "overview" ? <MallOverviewPage snapshot={mallSnapshot} onImport={openImport} /> : section === "mall" && mallPage === "keywords" ? <StoreKeywordsPage snapshot={keywordSnapshot} onImport={openImport} /> : section === "mall" && mallPage === "recommended" ? <UKPagePlaceholder source={null} label="当前工作台暂未接入推荐页数据" /> : section === "mall" && mallPage === "store-page" ? <UKPagePlaceholder source={null} label="当前工作台暂未接入店铺页面数据" /> : section === "marketing" ? <UKPagePlaceholder source={null} label="当前工作台暂未接入该页面数据" /> : section === "after-sales" ? <UKPagePlaceholder source={null} label="当前工作台暂未接入该页面数据" /> : <UKPagePlaceholder source={currentSource} label="当前工作台暂未接入该页面数据" />;
  return <main className="hf-analytics-shell uk-analytics-shell"><header className="hf-page-header"><div><h1>{title}</h1><nav aria-label="分析导航"><button className={section === "store" ? "active" : ""} onClick={() => changeSection("store")}>店铺数据分析</button><button className={section === "content" ? "active" : ""} onClick={() => changeSection("content")}>内容分析</button><button className={section === "mall" ? "active" : ""} onClick={() => changeSection("mall")}>商城页和搜索</button><button className={section === "product" ? "active" : ""} onClick={() => changeSection("product")}>商品数据分析</button><button className={section === "marketing" ? "active" : ""} onClick={() => changeSection("marketing")}>营销数据分析</button><button className={section === "after-sales" ? "active" : ""} onClick={() => changeSection("after-sales")}>售后数据分析</button></nav></div><div className="hf-date-control"><span>(GMT+00:00)</span>{currentSource && <div className="hf-period-picker"><button onClick={() => setPeriodOpen((open) => !open)}>当前页面：　{periodText(currentSnapshot)} <CalendarDays size={14} /></button>{periodOpen && <div className="hf-period-menu">{state.snapshots[currentSource].length ? <>{snapshotSort(state.snapshots[currentSource]).map((snapshot) => <button key={snapshot.id} className={snapshot.id === currentSnapshot?.id ? "active" : ""} onClick={() => selectSnapshot(currentSource, snapshot.id)}>{periodText(snapshot)}</button>)}<small>此日期仅影响当前页面数据源</small></> : <span>当前页面尚未导入数据</span>}</div>}</div>}<button className="hf-data-manager-trigger" onClick={() => setManagerOpen((open) => !open)}>数据管理</button><button className="hf-overview-import" onClick={openImport}><Download size={13} /> 导入数据</button>{managerOpen && <UKDataManager state={state} activeSnapshot={activeSnapshot} pending={pending} pendingPeriod={pendingPeriod} message={message} onImport={openImport} onSelect={selectSnapshot} onConfirm={confirmImport} onPendingPeriod={(patch) => setPendingPeriod((current) => ({ ...current, ...patch }))} onClose={() => setManagerOpen(false)} />}</div></header><div className="uk-delay-notice">当前页面使用本地导入的 TikTok Shop 官方导出数据。</div>{section === "mall" ? <div className="hf-analytics-layout"><UKSidebar kind="mall" page={mallPage} onPage={(next) => setMallPage(next as MallPage)} /><div className="hf-main-content">{mainContent}</div></div> : section === "product" ? <div className="hf-analytics-layout"><UKSidebar kind="product" page={productPage} onPage={(next) => setProductPage(next as ProductPage)} /><div className="hf-main-content">{mainContent}</div></div> : <div className="uk-main-content">{mainContent}</div>}<input ref={inputRef} className="uk-import-input" type="file" accept=".xlsx,.xls" tabIndex={-1} aria-hidden="true" onChange={(event) => void readImport(event.target.files ?? [])} /></main>;
}
