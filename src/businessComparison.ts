import type { BusinessBatch, BusinessProductHistoryBatch, BusinessProductRecord, BusinessSortField } from "./types";

export type BusinessProductDataBatch = Pick<BusinessBatch, "id" | "startDate" | "endDate" | "importedAt" | "products"> | BusinessProductHistoryBatch;

export type MetricDelta =
  | { kind: "unavailable"; value: null }
  | { kind: "new" | "same"; value: null }
  | { kind: "percent" | "points"; value: number };

export type PeriodRelation = { kind: "continuous" } | { kind: "overlap" | "gap"; days: number };

const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86_400_000;

export const selectPreviousBatch = (batches: BusinessBatch[], activeBatch: BusinessBatch | null): BusinessBatch | null => {
  if (!activeBatch) return null;
  return batches.filter((batch) => batch.id !== activeBatch.id && batch.endDate < activeBatch.endDate)
    .sort((left, right) => right.endDate.localeCompare(left.endDate) || right.startDate.localeCompare(left.startDate))[0] ?? null;
};

export const getPeriodRelation = (current: BusinessProductDataBatch, previous: BusinessProductDataBatch): PeriodRelation => {
  const difference = day(current.startDate) - day(previous.endDate);
  if (difference <= 0) return { kind: "overlap", days: Math.abs(difference) + 1 };
  if (difference === 1) return { kind: "continuous" };
  return { kind: "gap", days: difference - 1 };
};

export const getMetricDelta = (current: number | null, previous: number | null, rate: boolean): MetricDelta => {
  if (current === null || previous === null) return { kind: "unavailable", value: null };
  if (rate) return { kind: "points", value: current - previous };
  if (previous === 0) return current > 0 ? { kind: "new", value: null } : { kind: "same", value: null };
  return { kind: "percent", value: ((current - previous) / Math.abs(previous)) * 100 };
};

export const deltaSortValue = (current: number | null, previous: number | null, rate: boolean): number | null => {
  const delta = getMetricDelta(current, previous, rate);
  return delta.kind === "percent" || delta.kind === "points" ? delta.value : null;
};

export const indexProducts = (batch: BusinessProductDataBatch | null): Map<string, BusinessProductRecord> => new Map((batch?.products ?? []).map((product) => [product.productId, product]));

const samePeriod = (left: Pick<BusinessProductDataBatch, "startDate" | "endDate">, right: Pick<BusinessProductDataBatch, "startDate" | "endDate">) => left.startDate === right.startDate && left.endDate === right.endDate;

export const buildProductHistoryBatches = (batches: BusinessBatch[], historyBatches: BusinessProductHistoryBatch[]): BusinessProductDataBatch[] => {
  const fullPeriods = new Set(batches.map((batch) => `${batch.startDate}/${batch.endDate}`));
  return [...batches, ...historyBatches.filter((batch) => !fullPeriods.has(`${batch.startDate}/${batch.endDate}`))]
    .sort((left, right) => left.endDate.localeCompare(right.endDate) || left.startDate.localeCompare(right.startDate));
};

export const findPreviousProductPeriod = (current: BusinessProductDataBatch | null, productBatches: BusinessProductDataBatch[]): BusinessProductDataBatch | null => {
  if (!current) return null;
  return productBatches.filter((batch) => !samePeriod(batch, current) && batch.endDate < current.endDate)
    .sort((left, right) => right.endDate.localeCompare(left.endDate) || right.startDate.localeCompare(left.startDate))[0] ?? null;
};

export const findPreviousProduct = (productId: string, current: BusinessProductDataBatch | null, productBatches: BusinessProductDataBatch[]): BusinessProductRecord | null => {
  return indexProducts(findPreviousProductPeriod(current, productBatches)).get(productId) ?? null;
};

export const getProductHistory = (productId: string, productBatches: BusinessProductDataBatch[]): Array<{ batch: BusinessProductDataBatch; product: BusinessProductRecord }> => {
  return productBatches.flatMap((batch) => {
    const product = batch.products.find((item) => item.productId === productId);
    return product ? [{ batch, product }] : [];
  });
};

export const selectPreviousProductBatch = (batches: BusinessBatch[], historyBatches: BusinessProductHistoryBatch[], activeBatch: BusinessBatch | null): BusinessProductDataBatch | null => {
  return findPreviousProductPeriod(activeBatch, buildProductHistoryBatches(batches, historyBatches));
};

export const getProductMatchStats = (current: BusinessBatch, previous: BusinessProductDataBatch | null) => {
  if (!previous) return { current: current.products.length, matched: 0, added: 0, missing: 0, comparable: false };
  const previousIds = new Set(previous.products.map((product) => product.productId));
  const currentIds = new Set(current.products.map((product) => product.productId));
  const matched = current.products.filter((product) => previousIds.has(product.productId)).length;
  return { current: current.products.length, matched, added: current.products.length - matched, missing: previous.products.filter((product) => !currentIds.has(product.productId)).length, comparable: true };
};

export const rateFields = new Set<BusinessSortField>(["ctr", "addToCartRate", "ctor", "uniqueCtr", "uniqueAddToCartRate", "uniqueCtor", "mallCtr", "mallCtor"]);
