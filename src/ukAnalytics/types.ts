import type { BusinessCardMetrics, BusinessProductRecord } from "../types";

export type UkDataSourceKey = "store-business" | "mall-overview" | "store-keywords" | "product-details" | "product-traffic" | "product-traffic-breakdown";
export type UkProductSourceKey = "all" | "merchant-live" | "merchant-video" | "merchant-card" | "affiliate";
export type UkMetricMap = Record<string, number | null>;

export interface UkMetricTrendPoint { date: string; metrics: UkMetricMap; }
export interface UkStoreBusinessData { summary: UkMetricMap; daily: UkMetricTrendPoint[]; }
export interface UkMallOverviewData { summary: UkMetricMap; }
export interface UkStoreKeywordRow { keyword: string; metrics: UkMetricMap; }
export interface UkStoreKeywordsData { rows: UkStoreKeywordRow[]; }
export interface UkProductSourceMetrics { orders: number | null; card: BusinessCardMetrics; }
export interface UkProductDetailsRecord { base: BusinessProductRecord; sources: Record<UkProductSourceKey, UkProductSourceMetrics>; }
export interface UkProductDetailsData { products: UkProductDetailsRecord[]; sourceAvailability: Record<UkProductSourceKey, boolean>; }
export interface UkProductTrafficSourceData { summary: UkMetricMap; comparison: UkMetricMap; trend: UkMetricTrendPoint[]; available: boolean; }
export interface UkProductTrafficBreakdownRow { source: string; metrics: UkMetricMap; }
export interface UkProductTrafficData { sources: Record<UkProductSourceKey, UkProductTrafficSourceData>; breakdown: UkProductTrafficBreakdownRow[]; comparisonStartDate: string | null; comparisonEndDate: string | null; }
export interface UkProductTrafficBreakdownData { rows: UkProductTrafficBreakdownRow[]; }

export type UkDataPayload = UkStoreBusinessData | UkMallOverviewData | UkStoreKeywordsData | UkProductDetailsData | UkProductTrafficData | UkProductTrafficBreakdownData;

export interface UkDataSnapshot<T extends UkDataPayload = UkDataPayload> {
  id: string;
  source: UkDataSourceKey;
  startDate: string | null;
  endDate: string | null;
  importedAt: string;
  fileName: string;
  data: T;
}

export type UkAnalyticsSnapshots = Record<UkDataSourceKey, UkDataSnapshot[]>;
export interface UkAnalyticsState { snapshots: UkAnalyticsSnapshots; activeSnapshotIds: Partial<Record<UkDataSourceKey, string>>; }

export interface UkParsedImport {
  source: UkDataSourceKey;
  fileName: string;
  startDate: string | null;
  endDate: string | null;
  data: UkDataPayload;
  requiresPeriodConfirmation: boolean;
}

export const ukSourceLabels: Record<UkDataSourceKey, string> = {
  "store-business": "店铺数据分析 → 业务数据",
  "mall-overview": "商城页和搜索 → 商城页概览",
  "store-keywords": "商城页和搜索 → 店铺关键词",
  "product-details": "商品数据分析 → 详细信息",
  "product-traffic": "商品数据分析 → 商品流量",
  "product-traffic-breakdown": "商品数据分析 → 商品流量 → 表现明细（辅助）",
};

export const ukProductSourceKeys: UkProductSourceKey[] = ["all", "merchant-live", "merchant-video", "merchant-card", "affiliate"];
export const ukProductSourceLabels: Record<UkProductSourceKey, string> = { all: "全部", "merchant-live": "商家直播", "merchant-video": "商家视频", "merchant-card": "商家商品卡", affiliate: "联盟" };
export const ukSources: UkDataSourceKey[] = ["store-business", "mall-overview", "store-keywords", "product-details", "product-traffic", "product-traffic-breakdown"];

export const createUkAnalyticsState = (): UkAnalyticsState => ({ snapshots: { "store-business": [], "mall-overview": [], "store-keywords": [], "product-details": [], "product-traffic": [], "product-traffic-breakdown": [] }, activeSnapshotIds: {} });
