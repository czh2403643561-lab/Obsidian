import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Settings2, X } from "lucide-react";
import { downloadXlsx, metricValue, numberText, percentText, periodFilePart } from "./format";
import type { UkDataSnapshot, UkStoreKeywordRow, UkStoreKeywordsData } from "./types";

type Column = { key: string; label: string; kind: "number" | "rate" | "money" };
type SortState = { key: string | null; direction: "desc" | "asc" | "original" };
const columns: Column[] = [
  { key: "搜索结果访问用户数", label: "搜索结果访问用户数", kind: "number" }, { key: "商品曝光用户数", label: "商品曝光用户数", kind: "number" }, { key: "曝光-点击转化率", label: "曝光-点击转化率", kind: "rate" }, { key: "客户数", label: "客户数", kind: "number" }, { key: "曝光-成交转化率", label: "曝光-成交转化率", kind: "rate" }, { key: "成交订单数", label: "成交订单数", kind: "number" }, { key: "成交金额 (£)", label: "成交金额", kind: "money" },
];
const initialColumns = columns.slice(0, 4).map((column) => column.key);
const display = (row: UkStoreKeywordRow, column: Column) => column.kind === "rate" ? percentText(metricValue(row.metrics, column.key)) : column.kind === "money" ? `£${numberText(metricValue(row.metrics, column.key), 2)}` : numberText(metricValue(row.metrics, column.key));

export default function StoreKeywordsPage({ snapshot, onImport }: { snapshot: UkDataSnapshot<UkStoreKeywordsData> | null; onImport: () => void }) {
  const [visibleColumns, setVisibleColumns] = useState(initialColumns);
  const [configOpen, setConfigOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: null, direction: "original" });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<UkStoreKeywordRow | null>(null);
  if (!snapshot) return <section className="hf-panel uk-empty-data"><strong>请导入 商城页和搜索 → 店铺关键词</strong><button onClick={onImport}><Download size={14} /> 导入数据</button></section>;
  const selectedColumns = columns.filter((column) => visibleColumns.includes(column.key));
  const sorted = snapshot.data.rows.map((row, index) => ({ row, index })).sort((left, right) => {
    if (!sort.key || sort.direction === "original") return left.index - right.index;
    const a = metricValue(left.row.metrics, sort.key); const b = metricValue(right.row.metrics, sort.key);
    if (a === null) return b === null ? left.index - right.index : 1;
    if (b === null) return -1;
    return sort.direction === "desc" ? b - a : a - b;
  });
  const shown = sorted.slice(0, 100); const pageCount = Math.max(1, Math.ceil(shown.length / 10)); const activePage = Math.min(page, pageCount); const rows = shown.slice((activePage - 1) * 10, activePage * 10);
  const changeSort = (key: string) => { setPage(1); setSort((current) => current.key !== key || current.direction === "original" ? { key, direction: "desc" } : current.direction === "desc" ? { key, direction: "asc" } : { key: null, direction: "original" }); };
  const exportRows = () => downloadXlsx(`店铺关键词_${periodFilePart(snapshot)}.xlsx`, [{ key: "排名", label: "排名", kind: "number" }, { key: "关键词", label: "关键词" }, ...selectedColumns], sorted.map(({ row }, index) => ({ 排名: index + 1, 关键词: row.keyword, ...row.metrics })));
  return <div className="uk-keywords-page"><section className="hf-panel uk-keywords-notice">当前页面使用本地导入的 TikTok Shop 官方导出数据；账号类型拆分未包含在本次导出中。</section><section className="hf-panel uk-keyword-table-panel"><header><div className="uk-account-tabs"><button className="active">全部</button>{["官方", "营销", "联盟"].map((label) => <button key={label} disabled title="当前导出文件未提供账号类型拆分">{label}</button>)}</div><div className="uk-keyword-tools"><button className={configOpen ? "active" : ""} onClick={() => setConfigOpen((open) => !open)}><Settings2 size={13} /> 配置指标</button><button onClick={exportRows}><Download size={13} /> 导出数据</button></div></header>{configOpen && <section className="uk-column-config"><strong>配置指标</strong><div>{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => setVisibleColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} />{column.label}</label>)}</div></section>}<div className="uk-keyword-table-wrap"><table className="uk-keyword-table"><thead><tr><th>排名</th><th>关键词</th>{selectedColumns.map((column) => <th key={column.key}><button onClick={() => changeSort(column.key)}>{column.label}<i>{sort.key === column.key && sort.direction !== "original" ? sort.direction === "desc" ? "↓" : "↑" : "↕"}</i></button></th>)}<th>操作</th></tr></thead><tbody>{rows.map(({ row }, index) => <tr key={row.keyword}><td>{(activePage - 1) * 10 + index + 1}</td><td>{row.keyword}</td>{selectedColumns.map((column) => <td key={column.key}>{display(row, column)}</td>)}<td><button onClick={() => setDetail(row)}>查看详情</button></td></tr>)}</tbody></table>{!rows.length && <div className="uk-table-empty">当前导出文件未提供关键词数据</div>}</div><footer className="uk-keyword-pagination"><small>最多显示 100 条</small><span><button disabled={activePage <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={14} /></button><b>{activePage}</b><button disabled={activePage >= pageCount} onClick={() => setPage((current) => current + 1)}><ChevronRight size={14} /></button></span></footer></section>{detail && <div className="uk-keyword-modal-backdrop" role="presentation" onMouseDown={() => setDetail(null)}><section className="uk-keyword-modal" role="dialog" aria-label="关键词详情" onMouseDown={(event) => event.stopPropagation()}><header><div><small>关键词</small><h2>{detail.keyword}</h2></div><button onClick={() => setDetail(null)} aria-label="关闭关键词详情"><X size={16} /></button></header><div>{columns.map((column) => <span key={column.key}><small>{column.label}</small><strong>{display(detail, column)}</strong></span>)}</div></section></div>}</div>;
}
