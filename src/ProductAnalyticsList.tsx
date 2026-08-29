import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Filter, MoreVertical, PencilLine, Search, SlidersHorizontal, X } from "lucide-react";

type ProductMode = "product" | "sku";

const productRows = [
  ["Casing Silikon Cecair Premium Samsung S26 S25 S24 Ultra", "1735359360857703966", "RM56.11", "6", "6", "6", "▲ 65.03%", "active", "机会匹配", "lavender"],
  ["Sarung telefon silikon lembut premium untuk iPhone", "1735175264413320734", "RM30.26", "4", "4", "4", "▼ 47.50%", "active", "GMV ≥ 250", "amber"],
  ["Kes Magnetik Berlian Berkilau untuk Telefon", "1735176057008981534", "RM21.14", "2", "2", "2", "▼ 23.46%", "active", "商品销量 ≥ 1", "rose"],
  ["Sarung telefon dengan tingkap untuk Samsung", "1735359267280750110", "RM20.89", "1", "2", "2", "—", "active", "商品销量 ≥ 1", "orange"],
  ["Sarung Telefon Tahan Kejutan 16 Pro Max", "1735359267280750111", "RM13.80", "1", "1", "1", "—", "active", "商品销量 ≥ 1", "slate"],
  ["Sarung Telefon untuk Redmi kalis jatuh", "1735201886840194590", "RM12.55", "1", "1", "1", "▼ 71.08%", "active", "商品销量 ≥ 1", "blue"],
  ["HD Clear Space Casing Samsung", "1735201886840194591", "RM7.89", "1", "1", "1", "—", "active", "商品销量 ≥ 1", "teal"],
  ["Sarung iPhone 17 16 15 lembut anti calar", "1735358961165894174", "RM5.99", "1", "1", "1", "—", "active", "商品销量 ≥ 1", "mint"],
  ["Sarung Reka Bentuk Minimal untuk Android", "1735176882664791343", "RM0.00", "0", "0", "0", "—", "active", "新品", "cream"],
  ["Cooling Master Sarung Magnetik Premium", "1735201605488510494", "RM0.00", "0", "0", "0", "—", "paused", "待观察", "navy"],
];

function ProductAnalyticsSidebar() {
  return <aside className="hf-sidebar hf-product-analytics-sidebar" aria-label="商品数据分析导航"><section><span>商品</span><div className="active">详细信息</div><div>商品流量</div></section><section><span>商品榜单</span><div>TikTok 热卖商品榜</div></section></aside>;
}

function FilterDrawer({ onClose }: { onClose: () => void }) {
  return <aside className="hf-product-filter-drawer" aria-label="筛选商品"><header><div><Filter size={15} /><strong>筛选</strong></div><button onClick={onClose} aria-label="关闭筛选"><X size={15} /></button></header><section><label>商品状态</label><div className="hf-filter-options"><button className="active">全部</button><button>在售</button><button>已下架</button></div></section><section><label>成交情况</label><div className="hf-filter-options"><button className="active">不限</button><button>有成交</button><button>无成交</button></div></section><section><label>GMV 范围</label><div className="hf-filter-range"><input placeholder="最小值" /><span>–</span><input placeholder="最大值" /></div></section><section><label>曝光范围</label><div className="hf-filter-range"><input placeholder="最小值" /><span>–</span><input placeholder="最大值" /></div></section><footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确定</button></footer></aside>;
}

export default function ProductAnalyticsList() {
  const [mode, setMode] = useState<ProductMode>("product");
  const [source, setSource] = useState("全部");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortActive, setSortActive] = useState(false);
  const displayed = useMemo(() => productRows.filter((row) => row[0].toLowerCase().includes(query.toLowerCase()) || row[1].includes(query)), [query]);
  const sourceTabs = ["全部", "商家直播", "商家视频", "商家商品卡", "联盟"];
  return <div className="hf-analytics-layout hf-product-analytics-layout"><ProductAnalyticsSidebar /><div className="hf-main-content"><section className="hf-panel hf-product-analytics-list"><header className="hf-product-analytics-heading"><div className="hf-product-kind-tabs"><button className={mode === "product" ? "active" : ""} onClick={() => setMode("product")}>按商品</button><button className={mode === "sku" ? "active" : ""} onClick={() => setMode("sku")}>按 SKU</button></div></header><div className="hf-product-analytics-tools"><div className="hf-source-tabs">{sourceTabs.map((tab) => <button key={tab} className={source === tab ? "active" : ""} onClick={() => setSource(tab)}>{tab}</button>)}</div><div className="hf-data-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索商品名称或 ID" /></div><button className={filterOpen ? "active filter-button" : "filter-button"} onClick={() => setFilterOpen((open) => !open)}><SlidersHorizontal size={13} /> 筛选</button><button className="hf-tool-icon" aria-label="配置列"><PencilLine size={14} /></button><button className="hf-export-button"><Download size={13} /> 导出数据</button><button className="hf-tool-icon" aria-label="更多操作"><MoreVertical size={14} /></button></div><div className="hf-product-analytics-table-wrap"><table className="hf-product-analytics-table"><thead><tr><th>商品</th><th className={sortActive ? "sorted" : ""}><button onClick={() => setSortActive((active) => !active)}>GMV <ChevronDown size={12} /></button></th><th>订单数 <ChevronDown size={12} /></th><th>SKU 订单数 <ChevronDown size={12} /></th><th>商品成交件数 <ChevronDown size={12} /></th><th>操作</th></tr></thead><tbody>{displayed.slice((page - 1) * 10, page * 10).map((row) => <tr key={row[1]}><td><div className="hf-data-product"><i className={`hf-thumb ${row[9]}`}>{row[0].slice(0, 1)}</i><span><strong>{row[0]}</strong><small>ID {row[1]} <button aria-label="复制商品 ID"><Copy size={11} /></button></small><em><b className={row[7] === "active" ? "online" : "offline"} />{row[7] === "active" ? "在售" : "已暂停"}<i>{row[8]}</i></em></span></div></td><td><strong>{row[2]}</strong><small className={row[6].startsWith("▼") ? "down" : row[6].startsWith("▲") ? "up" : "flat"}>{row[6]}</small></td><td><strong>{row[3]}</strong><small>▲ 100%</small></td><td><strong>{row[4]}</strong><small>▲ 100%</small></td><td><strong>{row[5]}</strong><small>▲ 100%</small></td><td><button className="hf-detail-action">详细信息</button></td></tr>)}</tbody></table></div><footer className="hf-pagination"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button>{[1, 2, 3].map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}<button onClick={() => setPage((current) => Math.min(3, current + 1))}><ChevronRight size={13} /></button><select defaultValue="10" aria-label="每页条数"><option value="10">10/Page</option><option value="20">20/Page</option></select></footer></section>{filterOpen && <FilterDrawer onClose={() => setFilterOpen(false)} />}</div></div>;
}
