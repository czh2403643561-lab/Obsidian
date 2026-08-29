import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronDown, CloudUpload, Database, Filter, Languages, Plus, Radar, Search, X } from "lucide-react";
import { usePersistedState } from "./persistence";
import type { OpportunityCategoryWorkspace, OpportunityFilters, OpportunityLevel, OpportunityRadarState, OpportunityRecord, OpportunitySnapshot, OpportunitySortField, OpportunityTab, OpportunityTag, OpportunityTranslationCache, OpportunityTranslationEntry, OpportunityTrendStatus } from "./types";
import { formatCompact, formatCount, percentile } from "./utils";

const initialFilters = (): OpportunityFilters => ({ search: "", leadSource: "all", category: "all", tag: "all", level: "strong", trendStatus: "growing" });
const initialState = (): OpportunityRadarState => ({ categories: [], activeCategoryId: null });
const initialTranslationCache = (): OpportunityTranslationCache => ({ entries: [] });
const tagLabels: Record<OpportunityTag, string> = { "demand-gap": "需求缺口", accelerating: "正在加速", "video-led": "视频带热", "competition-warning": "竞争预警" };
const levelLabels: Record<OpportunityLevel, string> = { strong: "强机会", watch: "观察", warning: "竞争预警" };
const trendLabels: Record<OpportunityTrendStatus, string> = { growing: "连续增强", new: "新出现", crowded: "竞争涌入", cooling: "机会降温", stable: "平稳" };
const tabLabels: Record<OpportunityTab, string> = { today: "今日机会", trends: "趋势追踪", all: "全部数据" };
const sortLabels: Record<OpportunitySortField, string> = { searchVolume: "搜索次数", searchChange: "搜索变化", productsOnSale: "在售商品数", productsOnSaleChange: "在售商品变化" };

const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-（）()]/g, "");
const aliases: Record<string, string[]> = {
  keyword: ["keyword", "关键词"], category: ["category", "类目", "细分类目"], leadSource: ["leadsource", "来源", "线索来源"],
  searchVolume: ["searchvolume", "搜索次数", "搜索量"], searchChange: ["searchvolumechange", "搜索变化", "搜索次数变化"],
  productsOnSale: ["productsonsale", "在售商品数", "商品数"], productsOnSaleChange: ["productsonsalechange", "在售商品变化", "商品数变化"],
  capturedAt: ["capturedat", "采集时间"], sessionId: ["sessionid", "会话id"],
};

type TranslatorAvailability = "available" | "downloadable" | "unavailable";
interface NativeTranslator {
  translate: (text: string) => Promise<string>;
}
interface NativeTranslatorConstructor {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslatorAvailability> | TranslatorAvailability;
  create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<NativeTranslator>;
}

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const parseNumber = (value: string): number | null => {
  const normalized = value.trim().replace(/,/g, "").replace(/%/g, "");
  if (!normalized || /^(unknown|n\/a|—|-|null)$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const parseOpportunityFile = async (file: File): Promise<OpportunityRecord[]> => {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("请导入 TikTok 商品机会 CSV 文件。");
  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new Error("CSV 没有可导入的数据行。");
  const headers = rows[0].map(normalizeHeader);
  const column = (name: keyof typeof aliases) => headers.findIndex((header) => aliases[name].includes(header));
  const required = ["keyword", "category", "leadSource", "searchVolume", "productsOnSale"] as const;
  const indexes = Object.fromEntries(Object.keys(aliases).map((name) => [name, column(name as keyof typeof aliases)])) as Record<keyof typeof aliases, number>;
  const missing = required.filter((name) => indexes[name] < 0);
  if (missing.length) throw new Error(`CSV 字段不匹配，缺少：${missing.map((name) => ({ keyword: "keyword", category: "category", leadSource: "lead_source", searchVolume: "search_volume", productsOnSale: "products_on_sale" })[name]).join("、")}。`);
  return rows.slice(1).flatMap((row, originalIndex) => {
    const value = (name: keyof typeof aliases) => indexes[name] >= 0 ? (row[indexes[name]] ?? "").trim() : "";
    const keyword = value("keyword"); const searchVolume = parseNumber(value("searchVolume")); const productsOnSale = parseNumber(value("productsOnSale"));
    if (!keyword || searchVolume === null || productsOnSale === null) return [];
    return [{ originalIndex, keyword, category: value("category") || "未填写", leadSource: value("leadSource") || "未填写", searchVolume, searchChange: parseNumber(value("searchChange")), productsOnSale, productsOnSaleChange: parseNumber(value("productsOnSaleChange")), capturedAt: value("capturedAt"), sessionId: value("sessionId") }];
  });
};

interface Analysis { tags: OpportunityTag[]; explanation: string; level: OpportunityLevel | null; rank: number; }
const analyzeRecords = (records: OpportunityRecord[]): Map<number, Analysis> => {
  const searchVolumes = records.map((record) => record.searchVolume); const supplies = records.map((record) => record.productsOnSale);
  const searchChanges = records.flatMap((record) => record.searchChange === null ? [] : [record.searchChange]); const supplyChanges = records.flatMap((record) => record.productsOnSaleChange === null ? [] : [record.productsOnSaleChange]);
  const thresholds = { searchMedian: percentile(searchVolumes, 50), supplyLow: percentile(supplies, 25), supplyMedian: percentile(supplies, 50), supplyHigh: percentile(supplies, 75), searchChangeHigh: percentile(searchChanges, 80), supplyChangeHigh: percentile(supplyChanges, 80), supplyChangeExtreme: percentile(supplyChanges, 90) };
  return new Map(records.map((record) => {
    const demandGap = record.searchVolume >= thresholds.searchMedian && record.productsOnSale <= thresholds.supplyLow;
    const accelerating = record.searchChange !== null && record.searchChange > 0 && record.searchChange >= thresholds.searchChangeHigh;
    const videoLed = record.leadSource.includes("热门视频") && record.searchVolume >= thresholds.searchMedian && record.productsOnSale <= thresholds.supplyMedian;
    const warning = record.productsOnSaleChange !== null && record.productsOnSaleChange > 0 && ((record.searchChange !== null && record.productsOnSaleChange >= thresholds.supplyChangeHigh && record.productsOnSaleChange > record.searchChange) || record.productsOnSaleChange >= thresholds.supplyChangeExtreme);
    const tags: OpportunityTag[] = []; if (demandGap) tags.push("demand-gap"); if (accelerating) tags.push("accelerating"); if (videoLed) tags.push("video-led"); if (warning) tags.push("competition-warning");
    const positiveCount = Number(demandGap) + Number(accelerating) + Number(videoLed);
    const level: OpportunityLevel | null = warning ? "warning" : positiveCount >= 2 ? "strong" : positiveCount === 1 ? "watch" : null;
    const rank = level === "strong" ? (positiveCount === 3 ? 30 : 20) : level === "watch" ? 10 : level === "warning" ? 0 : -1;
    const explanation = warning ? "在售商品增长明显快于需求或处于高位，需留意竞争加剧。" : positiveCount === 3 ? "需求不弱且正在加速，同时热门视频带动、当前供给偏低。" : demandGap && accelerating ? "搜索增长明显，同时当前供给处于较低水平。" : demandGap && videoLed ? "搜索需求不弱，热门视频带动且当前供给处于较低水平。" : accelerating && videoLed ? "搜索正在加速，由热门视频带动且供给尚未拥挤。" : demandGap ? "搜索需求不弱，而当前供给处于本类较低水平。" : accelerating ? "搜索变化处于本类靠前水平，需求正在加速。" : videoLed ? "热门视频带动，但综合信号暂列观察。" : "当前数据未触发重点机会或预警规则。";
    return [record.originalIndex, { tags, explanation, level, rank }];
  }));
};

const normalizeKeyword = (value: string) => value.trim().toLowerCase().replace(/^#+\s*/, "");
const safePercentChange = (delta: number, previous: number): number | null => previous === 0 ? null : (delta / previous) * 100;
const translationKey = (value: string) => normalizeKeyword(value);
const getNativeTranslator = (): NativeTranslatorConstructor | undefined => (globalThis as typeof globalThis & { Translator?: NativeTranslatorConstructor }).Translator;
interface TrendRecord {
  current: OpportunityRecord;
  previous: OpportunityRecord | null;
  status: OpportunityTrendStatus;
  searchDelta: number | null;
  searchPercentChange: number | null;
  supplyDelta: number | null;
  supplyPercentChange: number | null;
  staticTags: OpportunityTag[];
  explanation: string;
}

const buildTrendRecords = (current: OpportunityRecord[], previous: OpportunityRecord[]): TrendRecord[] => {
  const currentAnalysis = analyzeRecords(current);
  const previousAnalysis = analyzeRecords(previous);
  const previousByKeyword = new Map<string, OpportunityRecord[]>();
  previous.forEach((record) => {
    const key = normalizeKeyword(record.keyword);
    previousByKeyword.set(key, [...(previousByKeyword.get(key) ?? []), record]);
  });
  const usedPrevious = new Set<number>();
  const matches = current.map((record) => {
    const candidates = previousByKeyword.get(normalizeKeyword(record.keyword)) ?? [];
    const previousRecord = candidates.find((candidate) => !usedPrevious.has(candidate.originalIndex) && candidate.category === record.category && candidate.leadSource === record.leadSource)
      ?? candidates.find((candidate) => !usedPrevious.has(candidate.originalIndex))
      ?? null;
    if (previousRecord) usedPrevious.add(previousRecord.originalIndex);
    return { record, previous: previousRecord };
  });
  const matchedChanges = matches.flatMap(({ record, previous: previousRecord }) => {
    if (!previousRecord) return [];
    const searchDelta = record.searchVolume - previousRecord.searchVolume;
    const supplyDelta = record.productsOnSale - previousRecord.productsOnSale;
    return [{ searchDelta, supplyDelta, searchPercentChange: safePercentChange(searchDelta, previousRecord.searchVolume), supplyPercentChange: safePercentChange(supplyDelta, previousRecord.productsOnSale) }];
  });
  const supplyPercentValues = matchedChanges.flatMap((change) => change.supplyPercentChange === null ? [] : [change.supplyPercentChange]);
  const supplyDeltaValues = matchedChanges.map((change) => change.supplyDelta);
  const supplyPercentMedian = percentile(supplyPercentValues, 50);
  const supplyDeltaHigh = percentile(supplyDeltaValues, 75);
  return matches.map(({ record, previous: previousRecord }) => {
    const currentItem = currentAnalysis.get(record.originalIndex)!;
    if (!previousRecord) return { current: record, previous: null, status: "new", searchDelta: null, searchPercentChange: null, supplyDelta: null, supplyPercentChange: null, staticTags: currentItem.tags, explanation: "本次快照首次出现该关键词，可作为新增机会观察。" };
    const searchDelta = record.searchVolume - previousRecord.searchVolume;
    const supplyDelta = record.productsOnSale - previousRecord.productsOnSale;
    const searchPercentChange = safePercentChange(searchDelta, previousRecord.searchVolume);
    const supplyPercentChange = safePercentChange(supplyDelta, previousRecord.productsOnSale);
    const previousItem = previousAnalysis.get(previousRecord.originalIndex);
    const crowded = supplyDelta > 0 && (
      (supplyPercentChange !== null && searchPercentChange !== null && supplyPercentChange > searchPercentChange && supplyPercentChange >= supplyPercentMedian)
      || (supplyPercentChange === null && supplyDelta >= supplyDeltaHigh)
    );
    const cooling = !crowded && (searchDelta < 0 || (previousItem ? currentItem.tags.filter((tag) => tag !== "competition-warning").length < previousItem.tags.filter((tag) => tag !== "competition-warning").length : false));
    const status: OpportunityTrendStatus = crowded ? "crowded" : cooling ? "cooling" : searchDelta > 0 ? "growing" : "stable";
    const explanation = status === "growing"
      ? "搜索需求较上次采集继续增长，当前供给增长较慢，机会仍在增强。"
      : status === "crowded"
        ? "需求增长有限，但在售商品增长更快，竞争正在涌入。"
        : status === "cooling"
          ? "搜索需求较上次下降或正面机会信号减弱，机会热度正在回落。"
          : "搜索需求与供给相对平稳，暂未观察到明显方向变化。";
    return { current: record, previous: previousRecord, status, searchDelta, searchPercentChange, supplyDelta, supplyPercentChange, staticTags: currentItem.tags, explanation };
  });
};
const formatTrendChange = (delta: number | null, percentChange: number | null) => {
  if (delta === null) return "新出现";
  const absolute = `${delta > 0 ? "+" : ""}${formatCompact(delta)}`;
  return percentChange === null ? `${absolute}（基数为 0）` : `${absolute}（${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%）`;
};

const updateCategory = (state: OpportunityRadarState, id: string, update: (category: OpportunityCategoryWorkspace) => OpportunityCategoryWorkspace): OpportunityRadarState => ({ ...state, categories: state.categories.map((category) => category.id === id ? update(category) : category) });

function SortButton({ field, sort, onSort }: { field: OpportunitySortField; sort: OpportunityCategoryWorkspace["allSort"]; onSort: (field: OpportunitySortField) => void }) {
  const active = sort.field === field;
  return <button className={`sort-button${active ? " active" : ""}`} onClick={() => onSort(field)}><span>{sortLabels[field]}</span>{active ? sort.direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : <ArrowUpDown size={14} />}</button>;
}

export default function OpportunityRadar({ hidden = false }: { hidden?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null); const [state, setState, restored] = usePersistedState<OpportunityRadarState>("opportunity-radar", initialState); const [translationCache, setTranslationCache] = usePersistedState<OpportunityTranslationCache>("opportunity-translations", initialTranslationCache); const [categoryName, setCategoryName] = useState(""); const [error, setError] = useState(""); const [isLoading, setIsLoading] = useState(false); const [translationState, setTranslationState] = useState<"idle" | "checking" | "downloading" | "translating" | "unavailable" | "error">("idle"); const [translationProgress, setTranslationProgress] = useState({ done: 0, total: 0 }); const translationTaskRef = useRef<Promise<void> | null>(null);
  const activeCategory = state.categories.find((category) => category.id === state.activeCategoryId) ?? null; const latest = activeCategory && activeCategory.snapshots.length ? activeCategory.snapshots[activeCategory.snapshots.length - 1] : undefined; const records: OpportunityRecord[] = latest?.records ?? [];
  const analysis = useMemo(() => analyzeRecords(records), [records]); const filters = activeCategory?.filters ?? initialFilters(); const selectedLevel = filters.level ?? "strong"; const selectedTrendStatus = filters.trendStatus ?? "growing"; const tab = activeCategory?.activeTab ?? "today";
  const translationMap = useMemo(() => new Map((translationCache?.entries ?? []).map((entry) => [translationKey(entry.original), entry.translated])), [translationCache]);
  const translatedText = (value: string) => translationMap.get(translationKey(value)) ?? "";
  const sources = useMemo(() => [...new Set(records.map((record) => record.leadSource))].sort(), [records]); const categories = useMemo(() => [...new Set(records.map((record) => record.category))].sort(), [records]);
  const matchesBaseFilters = (record: OpportunityRecord) => { const query = filters.search.trim().toLowerCase(); const translatedKeyword = translatedText(record.keyword).toLowerCase(); return (!query || record.keyword.toLowerCase().includes(query) || translatedKeyword.includes(query)) && (filters.leadSource === "all" || record.leadSource === filters.leadSource) && (filters.category === "all" || record.category === filters.category); };
  const matchesFilters = (record: OpportunityRecord) => { const item = analysis.get(record.originalIndex)!; return matchesBaseFilters(record) && (filters.tag === "all" || item.tags.includes(filters.tag)) && (selectedLevel === "all" || item.level === selectedLevel); };
  const todayRecords = records.filter((record) => analysis.get(record.originalIndex)!.level !== null).filter(matchesFilters).sort((left, right) => { const a = analysis.get(left.originalIndex)!; const b = analysis.get(right.originalIndex)!; return b.rank - a.rank || (right.searchChange ?? -Infinity) - (left.searchChange ?? -Infinity) || left.productsOnSale - right.productsOnSale; });
  const allRecords = [...records].filter(matchesBaseFilters).sort((left, right) => { const sort = activeCategory?.allSort; if (!sort?.field || !sort.direction) return left.originalIndex - right.originalIndex; const a = left[sort.field] ?? Number.NEGATIVE_INFINITY; const b = right[sort.field] ?? Number.NEGATIVE_INFINITY; return sort.direction === "desc" ? b - a : a - b; });
  const previousSnapshot = activeCategory && activeCategory.snapshots.length > 1 ? activeCategory.snapshots[activeCategory.snapshots.length - 2] : undefined;
  const trendRecords = useMemo(() => previousSnapshot ? buildTrendRecords(records, previousSnapshot.records) : [], [records, previousSnapshot]);
  const filteredTrendRecords = trendRecords.filter((item) => matchesBaseFilters(item.current) && (selectedTrendStatus === "all" || item.status === selectedTrendStatus));
  const counts = (tag?: OpportunityTag) => records.filter((record) => { const item = analysis.get(record.originalIndex)!; return tag ? item.tags.includes(tag) : item.level === "strong"; }).length;
  const updateActive = (update: (category: OpportunityCategoryWorkspace) => OpportunityCategoryWorkspace) => { if (activeCategory) setState((current) => updateCategory(current, activeCategory.id, update)); };
  const createCategory = () => { const name = categoryName.trim(); if (!name) return; const id = `category-${Date.now()}`; setState((current) => ({ categories: [...current.categories, { id, name, snapshots: [], activeTab: "today", filters: initialFilters(), allSort: { field: null, direction: null } }], activeCategoryId: id })); setCategoryName(""); };
  const loadFile = async (file?: File) => { if (!file || !activeCategory) return; setError(""); setIsLoading(true); try { const parsed = await parseOpportunityFile(file); if (!parsed.length) throw new Error("没有找到同时包含关键词、搜索次数和在售商品数的有效数据。"); const snapshot: OpportunitySnapshot = { id: `snapshot-${Date.now()}`, importedAt: new Date().toISOString(), fileName: file.name, records: parsed }; updateActive((category) => ({ ...category, snapshots: [...category.snapshots, snapshot] })); } catch (caught) { setError(caught instanceof Error ? caught.message : "CSV 解析失败，请检查文件格式。"); } finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; } };
  const translateCurrentResults = () => {
    if (translationTaskRef.current) return;
    const targetRecords = tab === "today" ? todayRecords : tab === "trends" ? filteredTrendRecords.map((item) => item.current) : allRecords;
    const known = new Set((translationCache?.entries ?? []).map((entry) => translationKey(entry.original)));
    const pending = new Map<string, string>();
    targetRecords.flatMap((record) => [record.keyword, record.category]).map((text) => text.trim()).forEach((text) => {
      const key = translationKey(text);
      if (text && !known.has(key) && !pending.has(key)) pending.set(key, text);
    });
    const texts = [...pending.values()];
    if (!texts.length) { setTranslationState("idle"); setTranslationProgress({ done: 0, total: 0 }); return; }
    const task = (async () => {
      setTranslationState("checking"); setTranslationProgress({ done: 0, total: texts.length });
      const native = getNativeTranslator();
      if (!native || typeof native.availability !== "function" || typeof native.create !== "function") { setTranslationState("unavailable"); return; }
      const options = { sourceLanguage: "en", targetLanguage: "zh" };
      const availability = await native.availability(options);
      if (availability === "unavailable") { setTranslationState("unavailable"); return; }
      if (availability === "downloadable") setTranslationState("downloading");
      const translator = await native.create(options);
      setTranslationState("translating");
      const additions: OpportunityTranslationEntry[] = [];
      for (let index = 0; index < texts.length; index += 1) {
        const original = texts[index];
        try {
          const translated = (await translator.translate(original)).trim();
          if (translated) additions.push({ original, translated, translatedAt: new Date().toISOString() });
        } catch { /* 单条失败不影响其余结果 */ }
        setTranslationProgress({ done: index + 1, total: texts.length });
      }
      if (additions.length) setTranslationCache((current) => {
        const merged = new Map((current?.entries ?? []).map((entry) => [translationKey(entry.original), entry]));
        additions.forEach((entry) => merged.set(translationKey(entry.original), entry));
        return { entries: [...merged.values()] };
      });
      setTranslationState("idle");
    })().catch(() => setTranslationState("error")).finally(() => { translationTaskRef.current = null; });
    translationTaskRef.current = task;
  };
  const updateFilter = <K extends keyof OpportunityFilters>(key: K, value: OpportunityFilters[K]) => updateActive((category) => ({ ...category, filters: { ...category.filters, [key]: value } }));
  const selectTab = (activeTab: OpportunityTab) => updateActive((category) => ({ ...category, activeTab }));
  const sortAll = (field: OpportunitySortField) => updateActive((category) => ({ ...category, allSort: category.allSort.field !== field ? { field, direction: "desc" } : category.allSort.direction === "desc" ? { field, direction: "asc" } : { field: null, direction: null } }));
  const translationStatusText = translationState === "checking" ? "正在检查翻译能力…" : translationState === "downloading" ? "正在准备中文语言包…" : translationState === "translating" ? `正在翻译 ${translationProgress.done} / ${translationProgress.total}` : translationState === "unavailable" ? "当前浏览器不支持本地翻译" : translationState === "error" ? "翻译失败，已保留英文" : translationProgress.total > 0 && translationProgress.done === translationProgress.total ? "已完成当前结果翻译" : "";
  const translationAction = <div className="radar-translation-action"><button className="text-button radar-translate-button" type="button" onClick={translateCurrentResults} disabled={translationState === "checking" || translationState === "downloading" || translationState === "translating"}><Languages size={15} /> 翻译当前结果</button>{translationStatusText && <small>{translationStatusText}</small>}</div>;
  return <main className="workspace radar-workspace" hidden={hidden} aria-hidden={hidden}><section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> OPPORTUNITY RADAR</div><h1>机会雷达</h1><p>在当前大类的最新快照中，筛出值得优先研究的商品机会。</p></div><div className="privacy-note"><CheckCircle2 size={17} /> CSV 仅在浏览器本地解析</div></section>
    <section className="radar-category-bar"><div className="board-switcher">{state.categories.map((category) => <button key={category.id} className={category.id === activeCategory?.id ? "active" : ""} onClick={() => setState((current) => ({ ...current, activeCategoryId: category.id }))}>{category.name}</button>)}</div><div className="radar-add-category"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createCategory(); }} placeholder="输入大类名称" aria-label="大类名称" /><button className="compact-import-button" onClick={createCategory}><Plus size={15} /> 新增类目</button></div></section>
    {!activeCategory ? <div className="empty-state"><div className="empty-icon"><Radar size={30} /></div><h2>先创建一个大类区域</h2><p>例如“家居日用”或“手机与数码”，之后导入的 CSV 会归入该区域。</p></div> : <>
      <section className="radar-source-bar source-bar"><div className="source-bar-main"><div className="source-bar-icon"><Database size={18} /></div><div className="source-file"><span>当前大类 · {activeCategory.name}</span><strong title={latest?.fileName}>{latest ? latest.fileName : "尚未导入 CSV"}</strong></div>{latest && <><span className="source-divider" /><span className="source-product-count">最新快照 {formatCount(latest.records.length)} 条 · 历史 {activeCategory.snapshots.length} 份</span></>}</div><div className="source-bar-actions"><button className="compact-import-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={15} /> {isLoading ? "正在解析…" : latest ? "导入新快照" : "导入 CSV"}</button><input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} hidden /></div></section>
      {error && <div className="notice error-notice" role="alert"><AlertTriangle size={18} /><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X size={16} /></button></div>}
      {!latest ? <div className="empty-state"><div className="empty-icon"><CloudUpload size={30} /></div><h2>导入 TikTok 商品机会 CSV</h2><p>每次导入都会保存为当前大类的一个历史快照，今日机会只分析最新数据。</p><button className="primary-button" onClick={() => fileInputRef.current?.click()}><CloudUpload size={17} /> 选择 CSV 文件</button></div> : <>
        <section className="radar-tabs board-switcher" aria-label="机会雷达视图">{(Object.keys(tabLabels) as OpportunityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>{tabLabels[item]}</button>)}</section>
        {tab === "trends" ? previousSnapshot ? <>
          <section className="radar-trend-snapshots"><div><span>当前快照</span><strong>{new Date(latest.importedAt).toLocaleString("zh-CN")}</strong><small title={latest.fileName}>{latest.fileName}</small></div><div className="trend-snapshot-arrow">← 对比上一次采集</div><div><span>对比快照</span><strong>{new Date(previousSnapshot.importedAt).toLocaleString("zh-CN")}</strong><small title={previousSnapshot.fileName}>{previousSnapshot.fileName}</small></div></section>
          <section className="filter-card radar-filter-card"><div className="filter-card-header"><div className="filter-title"><Filter size={17} /><strong>趋势筛选</strong><span>{formatCount(filteredTrendRecords.length)} 条趋势记录</span></div>{translationAction}{(filters.search || filters.leadSource !== "all" || filters.category !== "all" || selectedTrendStatus !== "growing") && <button className="text-button" onClick={() => updateActive((category) => ({ ...category, filters: initialFilters() }))}>清除筛选</button>}</div><div className="filter-grid radar-filter-grid"><div className="filter-block search-filter"><label htmlFor="radar-search">搜索关键词</label><div className="search-input"><Search size={15} /><input id="radar-search" type="search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="输入原始 keyword" /></div></div><div className="filter-block"><label htmlFor="radar-source">线索来源</label><div className="select-wrap"><select id="radar-source" value={filters.leadSource} onChange={(event) => updateFilter("leadSource", event.target.value)}><option value="all">不限</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor="radar-category">官方细分类目</label><div className="select-wrap"><select id="radar-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="all">不限</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor="radar-trend-status">趋势状态</label><div className="select-wrap"><select id="radar-trend-status" value={selectedTrendStatus} onChange={(event) => updateFilter("trendStatus", event.target.value as OpportunityFilters["trendStatus"])}><option value="growing">连续增强</option><option value="new">新出现</option><option value="crowded">竞争涌入</option><option value="cooling">机会降温</option><option value="stable">平稳</option><option value="all">全部状态</option></select><ChevronDown size={15} /></div></div></div></section>
          <section className="radar-overview radar-trend-overview"><div><span>连续增强</span><strong>{formatCount(trendRecords.filter((item) => item.status === "growing").length)}</strong></div><div><span>新出现</span><strong>{formatCount(trendRecords.filter((item) => item.status === "new").length)}</strong></div><div><span>竞争涌入</span><strong>{formatCount(trendRecords.filter((item) => item.status === "crowded").length)}</strong></div><div><span>机会降温</span><strong>{formatCount(trendRecords.filter((item) => item.status === "cooling").length)}</strong></div></section>
          <section className="list-card radar-list"><div className="list-card-header"><div><div className="list-heading"><h2>趋势追踪 · {trendLabels[selectedTrendStatus === "all" ? "growing" : selectedTrendStatus]}</h2><span className="result-pill">{formatCount(filteredTrendRecords.length)} 条</span></div><p>比较“上一次采集 → 本次采集”，工作台变化与 CSV 原始变化分开展示。</p></div></div><div className="radar-trend-list">{filteredTrendRecords.map((item) => { const keywordZh = translatedText(item.current.keyword); const categoryZh = translatedText(item.current.category); return <article className="radar-trend-row" key={item.current.originalIndex}><div className="radar-keyword"><strong>{keywordZh || item.current.keyword}</strong>{keywordZh && <small className="radar-original-text">{item.current.keyword}</small>}<span>{categoryZh || item.current.category}</span>{categoryZh && <small className="radar-original-text">{item.current.category}</small>}</div><div className="radar-trend-main"><div className="radar-tags"><small>{item.current.leadSource}</small>{item.staticTags.map((tag) => <em key={tag} className={`radar-tag ${tag}`}>{tagLabels[tag]}</em>)}<em className={`radar-trend-status ${item.status}`}>{trendLabels[item.status]}</em></div><div className="radar-trend-metrics"><span>搜索 <b>{formatCompact(item.current.searchVolume)}</b></span><span>工作台搜索变化 <b>{formatTrendChange(item.searchDelta, item.searchPercentChange)}</b></span><span>在售 <b>{formatCompact(item.current.productsOnSale)}</b></span><span>工作台供给变化 <b>{formatTrendChange(item.supplyDelta, item.supplyPercentChange)}</b></span><span>CSV 搜索变化 <b>{item.current.searchChange === null ? "—" : `${item.current.searchChange}%`}</b></span><span>CSV 供给变化 <b>{item.current.productsOnSaleChange === null ? "—" : `${item.current.productsOnSaleChange}%`}</b></span></div><p>{item.explanation}</p></div></article>; })}{!filteredTrendRecords.length && <div className="no-results"><Radar size={20} /><strong>没有符合条件的趋势记录</strong><span>尝试切换趋势状态或放宽筛选条件。</span></div>}</div></section>
        </> : <div className="empty-state radar-trends-empty"><div className="empty-icon"><Radar size={30} /></div><h2>再导入一份快照即可开始趋势追踪</h2><p>当前只有1份快照，再导入一份同类目数据后即可开始趋势追踪。</p></div> : <>
          <section className="filter-card radar-filter-card"><div className="filter-card-header"><div className="filter-title"><Filter size={17} /><strong>{tab === "today" ? "机会筛选" : "数据筛选"}</strong><span>{tab === "today" ? `${formatCount(todayRecords.length)} 条当前层级` : `${formatCount(allRecords.length)} 条数据`}</span></div>{translationAction}{(filters.search || filters.leadSource !== "all" || filters.category !== "all" || filters.tag !== "all" || selectedLevel !== "strong" || selectedTrendStatus !== "growing") && <button className="text-button" onClick={() => updateActive((category) => ({ ...category, filters: initialFilters() }))}>清除筛选</button>}</div><div className="filter-grid radar-filter-grid"><div className="filter-block search-filter"><label htmlFor="radar-search">搜索关键词</label><div className="search-input"><Search size={15} /><input id="radar-search" type="search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="输入原始 keyword" /></div></div><div className="filter-block"><label htmlFor="radar-source">线索来源</label><div className="select-wrap"><select id="radar-source" value={filters.leadSource} onChange={(event) => updateFilter("leadSource", event.target.value)}><option value="all">不限</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor="radar-category">官方细分类目</label><div className="select-wrap"><select id="radar-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="all">不限</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={15} /></div></div>{tab === "today" && <><div className="filter-block"><label htmlFor="radar-level">机会层级</label><div className="select-wrap"><select id="radar-level" value={selectedLevel} onChange={(event) => updateFilter("level", event.target.value as OpportunityFilters["level"])}><option value="strong">强机会</option><option value="watch">观察</option><option value="warning">竞争预警</option><option value="all">全部层级</option></select><ChevronDown size={15} /></div></div><div className="filter-block"><label htmlFor="radar-tag">机会标签</label><div className="select-wrap"><select id="radar-tag" value={filters.tag} onChange={(event) => updateFilter("tag", event.target.value as OpportunityFilters["tag"])}><option value="all">不限</option>{(Object.keys(tagLabels) as OpportunityTag[]).map((item) => <option key={item} value={item}>{tagLabels[item]}</option>)}</select><ChevronDown size={15} /></div></div></>}</div></section>
          {tab === "today" ? <><section className="radar-overview"><div><span>强机会</span><strong>{formatCount(counts())}</strong></div>{(Object.keys(tagLabels) as OpportunityTag[]).map((item) => <div key={item}><span>{tagLabels[item]}</span><strong>{formatCount(counts(item))}</strong></div>)}</section><section className="list-card radar-list"><div className="list-card-header"><div><div className="list-heading"><h2>今日机会 · {levelLabels[selectedLevel === "all" ? "strong" : selectedLevel]}</h2><span className="result-pill">最新快照</span></div><p>标签是解释性信号，层级按组合数量和相对优先级单独计算。</p></div></div><div className="radar-opportunity-list">{todayRecords.map((record) => { const item = analysis.get(record.originalIndex)!; const keywordZh = translatedText(record.keyword); const categoryZh = translatedText(record.category); return <article className="radar-opportunity" key={record.originalIndex}><div className="radar-keyword"><strong>{keywordZh || record.keyword}</strong>{keywordZh && <small className="radar-original-text">{record.keyword}</small>}<span>{categoryZh || record.category}</span>{categoryZh && <small className="radar-original-text">{record.category}</small>}</div><div className="radar-metrics"><span>搜索 <b>{formatCompact(record.searchVolume)}</b></span><span>搜索变化 <b>{record.searchChange === null ? "—" : `${record.searchChange}%`}</b></span><span>在售 <b>{formatCompact(record.productsOnSale)}</b></span><span>在售变化 <b>{record.productsOnSaleChange === null ? "—" : `${record.productsOnSaleChange}%`}</b></span></div><div className="radar-tags"><small>{record.leadSource}</small>{item.tags.map((tag) => <em key={tag} className={`radar-tag ${tag}`}>{tagLabels[tag]}</em>)}</div><p>{item.explanation}</p></article>; })}{!todayRecords.length && <div className="no-results"><Radar size={20} /><strong>没有符合条件的机会</strong><span>尝试放宽筛选条件，或导入新的快照。</span></div>}</div></section></> : <section className="list-card radar-list"><div className="list-card-header"><div><div className="list-heading"><h2>全部数据</h2><span className="result-pill">{formatCount(allRecords.length)} 条</span></div><p>当前大类的最新快照原始数据。</p></div></div><div className="table-wrap"><table className="radar-table"><thead><tr><th>keyword</th><th>官方细分类目</th><th>线索来源</th><th><SortButton field="searchVolume" sort={activeCategory.allSort} onSort={sortAll} /></th><th><SortButton field="searchChange" sort={activeCategory.allSort} onSort={sortAll} /></th><th><SortButton field="productsOnSale" sort={activeCategory.allSort} onSort={sortAll} /></th><th><SortButton field="productsOnSaleChange" sort={activeCategory.allSort} onSort={sortAll} /></th></tr></thead><tbody>{allRecords.map((record) => { const keywordZh = translatedText(record.keyword); const categoryZh = translatedText(record.category); return <tr key={record.originalIndex}><td><strong>{keywordZh || record.keyword}</strong>{keywordZh && <small className="radar-original-text">{record.keyword}</small>}</td><td><span>{categoryZh || record.category}</span>{categoryZh && <small className="radar-original-text">{record.category}</small>}</td><td><span className="radar-source-pill">{record.leadSource}</span></td><td>{formatCompact(record.searchVolume)}</td><td>{record.searchChange === null ? "—" : `${record.searchChange}%`}</td><td>{formatCompact(record.productsOnSale)}</td><td>{record.productsOnSaleChange === null ? "—" : `${record.productsOnSaleChange}%`}</td></tr>; })}</tbody></table>{!allRecords.length && <div className="no-results"><Search size={20} /><strong>没有符合条件的数据</strong></div>}</div></section>}
        </>}
      </>}
    </>}
  </main>;
}
