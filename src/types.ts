export type SortField =
  | "recentSales"
  | "totalSales"
  | "creators"
  | "videos"
  | "price"
  | "commissionRate";

export type SortDirection = "asc" | "desc";

export type PercentilePreset = "all" | "p15" | "p20" | "p50";

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
