import type { PercentilePreset, PercentileThresholds, Product } from "./types";

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatCount = (value: number): string => numberFormatter.format(Math.round(value));

export const formatCompact = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${decimalFormatter.format(value / 100_000_000)}亿`;
  if (absolute >= 10_000) return `${decimalFormatter.format(value / 10_000)}万`;
  return formatCount(value);
};

export const formatCurrency = (value: number): string =>
  `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatRate = (value: number): string => `${value.toFixed(value % 1 ? 1 : 0)}%`;

export const percentile = (values: number[], percentage: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * (percentage / 100);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

export const getPercentileThresholds = (products: Product[], field: "creators" | "videos"): PercentileThresholds => {
  const values = products.map((product) => product[field]);
  return {
    p15: percentile(values, 15),
    p20: percentile(values, 20),
    p50: percentile(values, 50),
  };
};

export const presetThreshold = (preset: PercentilePreset, thresholds: PercentileThresholds): number => {
  if (preset === "p15") return thresholds.p15;
  if (preset === "p20") return thresholds.p20;
  if (preset === "p50") return thresholds.p50;
  return Number.NEGATIVE_INFINITY;
};

export const hasActiveFilters = (filters: {
  totalMin: string;
  totalMax: string;
  recentMin: string;
  recentMax: string;
  creators: PercentilePreset;
  videos: PercentilePreset;
}): boolean => Boolean(
  filters.totalMin ||
    filters.totalMax ||
    filters.recentMin ||
    filters.recentMax ||
    filters.creators !== "all" ||
    filters.videos !== "all",
);
