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
