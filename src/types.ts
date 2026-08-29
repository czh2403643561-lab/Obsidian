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
export type OpportunityTrendStatus = "growing" | "new" | "crowded" | "cooling";
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
