export type SortField =
  | "recentSales"
  | "totalSales"
  | "creators"
  | "videos"
  | "price"
  | "commissionRate";

export type SortDirection = "asc" | "desc";

export type PercentilePreset = "all" | "p15" | "p20" | "p50";

export type ProductPeriod = "7d" | "30d";

export interface Product {
  originalIndex: number;
  id: string;
  url: string;
  name: string;
  coverUrl: string;
  shopName: string;
  category: string;
  price: number;
  recentSales: number;
  recentGmv: number;
  totalSales: number;
  totalGmv: number;
  creators: number;
  videos: number;
  commissionRate: number;
  rating: number;
  reviews: number;
  estimatedTime: string;
}

export interface Filters {
  search: string;
  totalMin: string;
  totalMax: string;
  recentMin: string;
  recentMax: string;
  creators: PercentilePreset;
  videos: PercentilePreset;
}

export interface PercentileThresholds {
  p15: number;
  p20: number;
  p50: number;
}

export interface ParseResult {
  products: Product[];
  period: ProductPeriod;
  headerRow: number;
  foundHeaders: string[];
  missingHeaders: string[];
  skippedRows: number;
}

export type ShopSortField =
  | "rating"
  | "recentSales"
  | "totalSales"
  | "recentGmv"
  | "creators"
  | "videos"
  | "lives";

export interface Shop {
  originalIndex: number;
  id: string;
  url: string;
  name: string;
  deliveryCategory: string;
  managed: string;
  shopType: string;
  region: string;
  rating: number;
  promotedProductCount: number;
  totalProducts: number;
  averagePrice: number;
  recentSales: number;
  totalSales: number;
  recentGmv: number;
  totalGmv: number;
  creators: number;
  videos: number;
  lives: number;
  collectedAt: string;
}

export interface ShopFilters {
  search: string;
  recentMin: string;
  recentMax: string;
  totalMin: string;
  totalMax: string;
  recentGmvMin: string;
  recentGmvMax: string;
  ratingMin: string;
  ratingMax: string;
  shopType: string;
  managed: "all" | "是" | "否";
  creators: PercentilePreset;
  videos: PercentilePreset;
}

export interface ShopParseResult {
  shops: Shop[];
  headerRow: number;
  foundHeaders: string[];
  missingHeaders: string[];
  skippedRows: number;
}

export type SellerRankSortField = "salesAmount" | "sales" | "promotedProductCount" | "creators" | "videos" | "lives";

export interface SellerRank {
  originalIndex: number;
  id: string;
  url: string;
  name: string;
  deliveryCategory: string;
  region: string;
  salesAmount: number;
  sales: number;
  promotedProductCount: number;
  creators: number;
  videos: number;
  lives: number;
  collectedAt: string;
}

export interface SellerRankFilters {
  search: string;
  salesAmountMin: string;
  salesAmountMax: string;
  salesMin: string;
  salesMax: string;
  productsMin: string;
  productsMax: string;
  category: string;
  creators: PercentilePreset;
  videos: PercentilePreset;
}

export interface SellerRankParseResult {
  sellers: SellerRank[];
  headerRow: number;
  foundHeaders: string[];
  missingHeaders: string[];
  skippedRows: number;
}

export type CandidateShopSource = "小店列表" | "跨境卖家榜" | "本土卖家榜";

export interface CandidateProductSnapshot {
  period: ProductPeriod;
  capturedAt: string;
  product: Product;
}

export interface CandidateProduct {
  key: string;
  id: string;
  url: string;
  name: string;
  coverUrl: string;
  shopName: string;
  snapshots: Partial<Record<ProductPeriod, CandidateProductSnapshot>>;
  addedAt: string;
  updatedAt: string;
}

export interface CandidateShopSnapshot {
  source: CandidateShopSource;
  capturedAt: string;
  metrics: {
    salesAmount?: number;
    recentSales?: number;
    totalSales?: number;
    recentGmv?: number;
    promotedProductCount: number;
    creators: number;
    videos: number;
    lives: number;
  };
}

export interface CandidateShopInput {
  id: string;
  url: string;
  name: string;
  promotedProductCount: number;
  creators: number;
  videos: number;
  lives: number;
  salesAmount?: number;
  recentSales?: number;
  totalSales?: number;
  recentGmv?: number;
}

export interface CandidateShop {
  key: string;
  id: string;
  url: string;
  name: string;
  sources: CandidateShopSource[];
  snapshots: Partial<Record<CandidateShopSource, CandidateShopSnapshot>>;
  addedAt: string;
  updatedAt: string;
}

export interface CandidateWorkspaceState {
  products: CandidateProduct[];
  shops: CandidateShop[];
}

export type OpportunityTag = "demand-gap" | "accelerating" | "video-led" | "competition-warning";
export type OpportunityLevel = "strong" | "watch" | "warning";
export type OpportunityTrendStatus = "growing" | "new" | "crowded" | "cooling" | "stable";
export type OpportunityTab = "today" | "trends" | "all";
export type OpportunitySortField = "searchVolume" | "searchChange" | "productsOnSale" | "productsOnSaleChange";

export interface OpportunityRecord {
  originalIndex: number;
  keyword: string;
  category: string;
  leadSource: string;
  searchVolume: number;
  searchChange: number | null;
  productsOnSale: number;
  productsOnSaleChange: number | null;
  capturedAt: string;
  sessionId: string;
}

export interface OpportunitySnapshot {
  id: string;
  importedAt: string;
  fileName: string;
  records: OpportunityRecord[];
}

export interface OpportunityFilters {
  search: string;
  leadSource: string;
  category: string;
  tag: OpportunityTag | "all";
  level: OpportunityLevel | "all";
  trendStatus: OpportunityTrendStatus | "all";
}

export interface OpportunityCategoryWorkspace {
  id: string;
  name: string;
  snapshots: OpportunitySnapshot[];
  activeTab: OpportunityTab;
  filters: OpportunityFilters;
  allSort: { field: OpportunitySortField | null; direction: SortDirection | null };
}

export interface OpportunityRadarState {
  categories: OpportunityCategoryWorkspace[];
  activeCategoryId: string | null;
}

export interface OpportunityTranslationEntry {
  original: string;
  translated: string;
  translatedAt: string;
}

export interface OpportunityTranslationCache {
  entries: OpportunityTranslationEntry[];
}

export type BusinessAnalysisTab = "overview" | "products";
export type BusinessSortField = "cardGmv" | "skuOrders" | "impressions" | "clicks" | "ctr" | "addToCartRate" | "ctor" | "mallImpressions" | "mallCtr" | "units" | "customers" | "aov" | "addToCarts" | "uniqueImpressions" | "uniqueClicks" | "uniqueCtr" | "addToCartUsers" | "uniqueAddToCartRate" | "uniqueCtor" | "mallClicks" | "mallUniqueClicks" | "mallCustomers" | "mallCtor" | "mallGmv" | "mallUnits";

export interface BusinessCardMetrics {
  gmv: number | null;
  skuOrders: number | null;
  units: number | null;
  customers: number | null;
  aov: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  addToCarts: number | null;
  addToCartRate: number | null;
  ctor: number | null;
  uniqueImpressions: number | null;
  uniqueClicks: number | null;
  uniqueCtr: number | null;
  addToCartUsers: number | null;
  uniqueAddToCartRate: number | null;
  uniqueCtor: number | null;
}

export interface BusinessMallMetrics {
  impressions: number | null;
  clicks: number | null;
  uniqueClicks: number | null;
  customers: number | null;
  ctr: number | null;
  ctor: number | null;
  gmv: number | null;
  units: number | null;
}

export interface BusinessTrendPoint<T> {
  date: string;
  metrics: T;
}

export interface BusinessProductRecord {
  originalIndex: number;
  productId: string;
  name: string;
  publishStatus: string;
  gmvRange: string;
  card: BusinessCardMetrics;
  mall: BusinessMallMetrics;
}

export interface BusinessSourceStatus {
  fileName: string;
  detectedAs: "product-data" | "card-traffic" | "all-traffic";
}

export interface BusinessQualityIssue {
  level: "warning";
  message: string;
}

export interface BusinessBatch {
  id: string;
  startDate: string;
  endDate: string;
  importedAt: string;
  sources: {
    productData: BusinessSourceStatus;
    cardTraffic: BusinessSourceStatus;
    allTraffic: BusinessSourceStatus;
  };
  shopCardSummary: BusinessCardMetrics;
  shopCardTrend: BusinessTrendPoint<BusinessCardMetrics>[];
  shopMallSummary: BusinessMallMetrics;
  shopMallTrend: BusinessTrendPoint<BusinessMallMetrics>[];
  products: BusinessProductRecord[];
  qualityIssues: BusinessQualityIssue[];
}

export interface BusinessProductFilters {
  search: string;
  publishStatus: string;
  sales: "all" | "with-sales" | "without-sales";
  cardGmvMin: string;
  cardGmvMax: string;
  impressionsMin: string;
  impressionsMax: string;
  ctrMin: string;
  ctrMax: string;
  addToCartRateMin: string;
  addToCartRateMax: string;
  ctorMin: string;
  ctorMax: string;
  mallImpressionsMin: string;
  mallImpressionsMax: string;
  mallCtrMin: string;
  mallCtrMax: string;
}

export interface BusinessAnalysisState {
  batches: BusinessBatch[];
  activeBatchId: string | null;
  activeTab: BusinessAnalysisTab;
  filters: BusinessProductFilters;
  sort: { field: BusinessSortField | null; direction: SortDirection | null };
  visibleColumns: BusinessSortField[];
  cardTrendMetrics: Array<"gmv" | "skuOrders" | "impressions" | "clicks" | "ctr" | "addToCartRate" | "ctor" | "aov">;
  mallTrendMetrics: Array<"gmv" | "impressions" | "clicks" | "ctr" | "ctor">;
}
