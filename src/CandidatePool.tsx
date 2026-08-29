import { ExternalLink, Image as ImageIcon, PackageSearch, Store, Trash2 } from "lucide-react";
import type { CandidateProduct, CandidateShop, CandidateShopSnapshot, ProductPeriod } from "./types";
import { formatCompact, formatCurrency, formatCount } from "./utils";

const formatSavedAt = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return src ? <span className="candidate-product-image"><img src={src} alt={alt} /></span> : <span className="candidate-product-image candidate-image-fallback"><ImageIcon size={20} /></span>;
}

function ProductSnapshot({ period, snapshot }: { period: ProductPeriod; snapshot: CandidateProduct["snapshots"][ProductPeriod] }) {
  if (!snapshot) return <div className="candidate-snapshot empty"><strong>{period === "7d" ? "近7天" : "近30天"}</strong><span>暂无快照</span></div>;
  const { product } = snapshot;
  return <div className="candidate-snapshot"><strong>{period === "7d" ? "近7天" : "近30天"}</strong><span>销量 {formatCompact(product.recentSales)}</span><span>总销量 {formatCompact(product.totalSales)}</span><span>价格 {product.price ? formatCurrency(product.price) : "—"}</span></div>;
}

function ShopMetrics({ snapshot }: { snapshot: CandidateShopSnapshot }) {
  const { metrics } = snapshot;
  return <div className="candidate-metrics"><span>{snapshot.source}</span>{metrics.salesAmount !== undefined && <span>销售额 £{formatCompact(metrics.salesAmount)}</span>}{metrics.recentSales !== undefined && <span>近7天销量 {formatCompact(metrics.recentSales)}</span>}{metrics.totalSales !== undefined && <span>总销量 {formatCompact(metrics.totalSales)}</span>}{metrics.recentGmv !== undefined && <span>近7天 GMV £{formatCompact(metrics.recentGmv)}</span>}<span>商品 {formatCount(metrics.promotedProductCount)}</span><span>达人 {formatCount(metrics.creators)}</span></div>;
}

export default function CandidatePool({ products, shops, onRemoveProduct, onRemoveShop }: { products: CandidateProduct[]; shops: CandidateShop[]; onRemoveProduct: (key: string) => void; onRemoveShop: (key: string) => void }) {
  return <main className="workspace candidate-workspace"><section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> CANDIDATE POOL</div><h1>候选池</h1><p>保存值得继续研究的商品和店铺快照。</p></div></section><div className="candidate-switcher"><a href="#candidate-products">候选商品 <small>{products.length}</small></a><a href="#candidate-shops">候选店铺 <small>{shops.length}</small></a></div>
    <section id="candidate-products" className="candidate-section"><div className="list-card-header"><div><div className="list-heading"><h2>候选商品</h2><span className="result-pill">{products.length} 个</span></div><p>保留收藏时的近7天和近30天数据，不计算趋势。</p></div></div>{products.length ? <div className="candidate-list">{products.map((candidate) => <article className="candidate-card" key={candidate.key}><div className="candidate-card-main"><ProductImage src={candidate.coverUrl} alt={candidate.name} /><div><h3>{candidate.name}</h3><p>{candidate.shopName || "未填写店铺"}</p><small>收藏于 {formatSavedAt(candidate.addedAt)}</small></div></div><div className="candidate-snapshots"><ProductSnapshot period="7d" snapshot={candidate.snapshots["7d"]} /><ProductSnapshot period="30d" snapshot={candidate.snapshots["30d"]} /></div><div className="candidate-card-actions"><a className="view-link" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 查看商品</a><button className="candidate-remove-button" onClick={() => onRemoveProduct(candidate.key)}><Trash2 size={14} /> 移出候选池</button></div></article>)}</div> : <div className="candidate-empty"><PackageSearch size={25} /><strong>还没有候选商品</strong><span>可在商品列表右侧操作中收藏。</span></div>}</section>
    <section id="candidate-shops" className="candidate-section"><div className="list-card-header"><div><div className="list-heading"><h2>候选店铺</h2><span className="result-pill">{shops.length} 个</span></div><p>同一店铺会合并保存，并保留收藏来源榜单。</p></div></div>{shops.length ? <div className="candidate-list">{shops.map((candidate) => <article className="candidate-card shop-candidate-card" key={candidate.key}><div className="candidate-card-main"><span className="shop-avatar"><Store size={17} /></span><div><h3>{candidate.name}</h3><p>{candidate.sources.join(" · ")}</p><small>收藏于 {formatSavedAt(candidate.addedAt)}</small></div></div><div className="candidate-shop-snapshots">{candidate.sources.map((source) => candidate.snapshots[source] && <ShopMetrics key={source} snapshot={candidate.snapshots[source]!} />)}</div><div className="candidate-card-actions"><a className="view-link" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 查看店铺</a><button className="candidate-remove-button" onClick={() => onRemoveShop(candidate.key)}><Trash2 size={14} /> 移出候选池</button></div></article>)}</div> : <div className="candidate-empty"><Store size={25} /><strong>还没有候选店铺</strong><span>可在任一店铺榜单名称旁收藏。</span></div>}</section>
  </main>;
}
