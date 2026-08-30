import type { BusinessProductRecord } from "../types";

export type UkDataSourceKey = "store-business" | "mall-overview" | "store-keywords" | "product-details" | "product-traffic";
export type UkMetricMap = Record<string, number | null>;

export interface UkMetricTrendPoint { date: string; metrics: UkMetricMap; }
export interface UkStoreBusinessData { summary: UkMetricMap; daily: UkMetricTrendPoint[]; }
export interface UkMallOverviewData { summary: UkMetricMap; }
export interface UkStoreKeywordRow { keyword: string; metrics: UkMetricMap; }
export interface UkStoreKeywordsData { rows: UkStoreKeywordRow[]; }
export interface UkProductDetailsData { products: BusinessProductRecord[]; }
export interface UkProductTrafficData { summary: UkMetricMap; comparison: UkMetricMap; trend: UkMetricTrendPoint[]; comparisonStartDate: string | null; comparisonEndDate: string | null; }

export type UkDataPayload = UkStoreBusinessData | UkMallOverviewData | UkStoreKeywordsData | UkProductDetailsData | UkProductTrafficData;

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
};

export const ukSources: UkDataSourceKey[] = ["store-business", "mall-overview", "store-keywords", "product-details", "product-traffic"];

export const createUkAnalyticsState = (): UkAnalyticsState => ({ snapshots: { "store-business": [], "mall-overview": [], "store-keywords": [], "product-details": [], "product-traffic": [] }, activeSnapshotIds: {} });
