import { getMetricDelta, indexProducts } from "./businessComparison";
import type { BusinessBatch, BusinessMaintenancePriority, BusinessProductRecord } from "./types";

export type MaintenanceDiagnosisCode = "distribution-down" | "click-efficiency-down" | "intent-down" | "conversion-down" | "high-exposure-low-click" | "high-click-low-conversion" | "high-potential-low-traffic" | "healthy-growth" | "data-insufficient";
type MetricKey = "impressions" | "mallImpressions" | "clicks" | "ctr" | "addToCarts" | "addToCartRate" | "ctor" | "skuOrders" | "gmv";

export interface MaintenanceDiagnostic {
  productId: string;
  priority: BusinessMaintenancePriority;
  primaryDiagnosis: MaintenanceDiagnosisCode;
  diagnoses: MaintenanceDiagnosisCode[];
  evidence: string[];
  explanation: string;
  checks: string[];
  historyAvailable: boolean;
  qualityConcern: boolean;
}

export interface MaintenanceResult {
  diagnostics: MaintenanceDiagnostic[];
  percentile: Record<MetricKey, { p25: number | null; p50: number | null; p75: number | null }>;
  sampleThresholds: { impressions: number; clicks: number };
}

const label: Record<MetricKey, string> = { impressions: "商品曝光", mallImpressions: "商城曝光", clicks: "点击", ctr: "CTR", addToCarts: "加购次数", addToCartRate: "加购率", ctor: "CTOR", skuOrders: "SKU订单", gmv: "商品卡 GMV" };
const priorityOrder: BusinessMaintenancePriority[] = ["priority", "watch", "healthy", "insufficient"];
const primaryOrder: MaintenanceDiagnosisCode[] = ["conversion-down", "high-click-low-conversion", "click-efficiency-down", "distribution-down", "high-exposure-low-click", "intent-down", "high-potential-low-traffic", "healthy-growth", "data-insufficient"];

const value = (product: BusinessProductRecord, key: MetricKey): number | null => key === "mallImpressions" ? product.mall.impressions ?? null : product.card[key] ?? null;
const percentile = (values: Array<number | null>, percent: number): number | null => {
  const sorted = values.filter((item): item is number => item !== null).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * percent;
  const lower = Math.floor(index); const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};
const change = (current: number | null, previous: number | null, rate = false): number | null => {
  const delta = getMetricDelta(current, previous, rate);
  return delta.kind === "percent" || delta.kind === "points" ? delta.value : null;
};
const formatChange = (key: MetricKey, current: number | null, previous: number | null) => {
  const delta = change(current, previous, key === "ctr" || key === "addToCartRate" || key === "ctor");
  if (delta === null) return null;
  if (delta === 0) return `${label[key]} 持平`;
  const unit = key === "ctr" || key === "addToCartRate" || key === "ctor" ? "pp" : "%";
  return `${label[key]} ${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(unit === "pp" ? 2 : 1)}${unit}`;
};
const sampleFloor = (values: Array<number | null>) => Math.max(5, percentile(values.filter((item): item is number => item !== null && item > 0), .1) ?? 0);
const staticEvidence = (key: MetricKey, direction: "high" | "low") => `${label[key]}处于店内${direction === "high" ? "较高" : "较低"}区间`;

const checksFor = (diagnosis: MaintenanceDiagnosisCode): string[] => {
  if (diagnosis === "distribution-down") return ["推荐资格", "搜索匹配", "标题/属性完整度", "库存"];
  if (diagnosis === "click-efficiency-down" || diagnosis === "high-exposure-low-click") return ["主图", "展示价格", "优惠", "标题展示"];
  if (diagnosis === "intent-down") return ["商品详情", "SKU结构", "图片/规格信息", "价格与优惠"];
  if (diagnosis === "conversion-down" || diagnosis === "high-click-low-conversion") return ["最终到手价", "运费", "配送时效", "SKU库存", "评论/信任因素"];
  if (diagnosis === "high-potential-low-traffic") return ["推荐资格", "搜索匹配", "标题/属性完整度", "库存"];
  return [];
};

const explanationFor = (diagnosis: MaintenanceDiagnosisCode, historyAvailable: boolean, qualityConcern: boolean) => {
  if (qualityConcern) return "部分 TikTok 指标可能仍在更新，本条仅作观察，建议等待数据完整后再判断。";
  if (diagnosis === "distribution-down") return "商品曝光较上期走弱，建议优先检查分发相关环节。";
  if (diagnosis === "click-efficiency-down") return "曝光未同步明显走弱，但点击效率较上期下降，建议检查商品展示环节。";
  if (diagnosis === "intent-down") return "点击效率未同步明显恶化，但购买意向较上期走弱，建议检查商品详情与规格信息。";
  if (diagnosis === "conversion-down") return "前段表现未见同步明显下降，但点击后的成交效率较上期走弱，建议优先检查商品页成交环节。";
  if (diagnosis === "high-exposure-low-click") return "当前曝光处于店内较高区间，但 CTR 偏低，建议优先关注点击环节。";
  if (diagnosis === "high-click-low-conversion") return "当前点击表现较好但成交效率偏低，建议优先关注成交环节。";
  if (diagnosis === "high-potential-low-traffic") return "当前流量较低，但点击和成交效率处于店内较好区间，建议关注分发机会。";
  if (diagnosis === "healthy-growth") return "商品订单或 GMV 较上期改善，漏斗关键指标未见明显恶化。";
  return historyAvailable ? "关键比例指标样本不足，暂不适合做强判断。" : "暂无历史对比，暂不判断趋势，建议结合当前店内相对表现持续观察。";
};

export const diagnoseMaintenance = (current: BusinessBatch, previous: BusinessBatch | null): MaintenanceResult => {
  const fields: MetricKey[] = ["impressions", "mallImpressions", "clicks", "ctr", "addToCarts", "addToCartRate", "ctor", "skuOrders", "gmv"];
  const sampleThresholds = { impressions: sampleFloor(current.products.map((product) => value(product, "impressions"))), clicks: sampleFloor(current.products.map((product) => value(product, "clicks"))) };
  const benchmarkValues = (field: MetricKey) => current.products.filter((product) => field === "ctr" ? (value(product, "impressions") ?? 0) >= sampleThresholds.impressions : ["addToCartRate", "ctor"].includes(field) ? (value(product, "clicks") ?? 0) >= sampleThresholds.clicks : true).map((product) => value(product, field));
  const benchmarks = Object.fromEntries(fields.map((field) => [field, { p25: percentile(benchmarkValues(field), .25), p50: percentile(benchmarkValues(field), .5), p75: percentile(benchmarkValues(field), .75) }])) as MaintenanceResult["percentile"];
  const previousProducts = indexProducts(previous); const matched = current.products.filter((product) => previousProducts.has(product.productId));
  const changeP25 = Object.fromEntries(fields.map((field) => [field, percentile(matched.map((product) => change(value(product, field), value(previousProducts.get(product.productId)!, field), field === "ctr" || field === "addToCartRate" || field === "ctor")), .25)])) as Record<MetricKey, number | null>;
  const qualityConcern = current.qualityIssues.length > 0 || (previous?.qualityIssues.length ?? 0) > 0;
  const isLow = (product: BusinessProductRecord, field: MetricKey) => benchmarks[field].p25 !== null && value(product, field) !== null && value(product, field)! <= benchmarks[field].p25!;
  const isHigh = (product: BusinessProductRecord, field: MetricKey) => benchmarks[field].p75 !== null && value(product, field) !== null && value(product, field)! >= benchmarks[field].p75!;
  const down = (product: BusinessProductRecord, prior: BusinessProductRecord | undefined, field: MetricKey) => { if (!prior) return false; const next = change(value(product, field), value(prior, field), field === "ctr" || field === "addToCartRate" || field === "ctor"); const threshold = changeP25[field]; return next !== null && next < 0 && (threshold === null || next <= threshold); };
  const evidenceFor = (product: BusinessProductRecord, prior: BusinessProductRecord | undefined, diagnosis: MaintenanceDiagnosisCode) => {
    const fieldsFor: Record<MaintenanceDiagnosisCode, MetricKey[]> = { "distribution-down": ["impressions", "mallImpressions", "ctr", "skuOrders"], "click-efficiency-down": ["impressions", "ctr", "clicks", "skuOrders"], "intent-down": ["ctr", "addToCartRate", "addToCarts", "ctor"], "conversion-down": ["clicks", "addToCartRate", "ctor", "skuOrders"], "high-exposure-low-click": ["impressions", "ctr", "clicks"], "high-click-low-conversion": ["clicks", "ctr", "ctor", "skuOrders"], "high-potential-low-traffic": ["impressions", "ctr", "ctor"], "healthy-growth": ["skuOrders", "gmv", "ctr", "ctor"], "data-insufficient": ["impressions", "clicks"] };
    return fieldsFor[diagnosis].map((field) => prior ? formatChange(field, value(product, field), value(prior, field)) : staticEvidence(field, isHigh(product, field) ? "high" : "low")).filter((item): item is string => Boolean(item)).slice(0, 4);
  };
  const diagnostics = current.products.map((product) => {
    const prior = previousProducts.get(product.productId); const historyAvailable = Boolean(prior);
    const ctrEnough = (value(product, "impressions") ?? 0) >= sampleThresholds.impressions;
    const clickEnough = (value(product, "clicks") ?? 0) >= sampleThresholds.clicks;
    const diagnoses: MaintenanceDiagnosisCode[] = [];
    if (prior && !qualityConcern) {
      if (down(product, prior, "impressions") || down(product, prior, "mallImpressions")) diagnoses.push("distribution-down");
      if (!down(product, prior, "impressions") && !down(product, prior, "mallImpressions") && ctrEnough && down(product, prior, "ctr")) diagnoses.push("click-efficiency-down");
      if (!down(product, prior, "ctr") && clickEnough && down(product, prior, "addToCartRate")) diagnoses.push("intent-down");
      if (!down(product, prior, "clicks") && !down(product, prior, "addToCartRate") && clickEnough && down(product, prior, "ctor")) diagnoses.push("conversion-down");
      const ordersGrowth = change(value(product, "skuOrders"), value(prior, "skuOrders")) ?? -Infinity; const gmvGrowth = change(value(product, "gmv"), value(prior, "gmv")) ?? -Infinity;
      if ((ordersGrowth > 0 || gmvGrowth > 0) && !down(product, prior, "impressions") && !down(product, prior, "mallImpressions") && !down(product, prior, "ctr") && !down(product, prior, "addToCartRate") && !down(product, prior, "ctor")) diagnoses.push("healthy-growth");
    }
    if (ctrEnough && isHigh(product, "impressions") && isLow(product, "ctr")) diagnoses.push("high-exposure-low-click");
    if (clickEnough && (isHigh(product, "clicks") || isHigh(product, "ctr")) && isLow(product, "ctor")) diagnoses.push("high-click-low-conversion");
    if (ctrEnough && clickEnough && isLow(product, "impressions") && isHigh(product, "ctr") && isHigh(product, "ctor")) diagnoses.push("high-potential-low-traffic");
    const needsSampleProtection = !ctrEnough || !clickEnough;
    if (!diagnoses.length && needsSampleProtection) diagnoses.push("data-insufficient");
    const primaryDiagnosis = primaryOrder.find((item) => diagnoses.includes(item)) ?? (needsSampleProtection || !historyAvailable ? "data-insufficient" : "healthy-growth");
    if (!diagnoses.length) diagnoses.push(primaryDiagnosis);
    const highImpact = diagnoses.some((item) => ["distribution-down", "click-efficiency-down", "conversion-down", "high-exposure-low-click", "high-click-low-conversion"].includes(item));
    const highImpactVolume = (field: MetricKey) => benchmarks[field].p75 !== null && value(product, field) !== null && value(product, field)! >= benchmarks[field].p75!;
    const priorityEligible = diagnoses.includes("high-exposure-low-click") || (diagnoses.includes("high-click-low-conversion") && highImpactVolume("clicks")) || ((diagnoses.includes("distribution-down") || diagnoses.includes("click-efficiency-down")) && highImpactVolume("impressions")) || (diagnoses.includes("conversion-down") && highImpactVolume("clicks"));
    const priority: BusinessMaintenancePriority = qualityConcern ? (needsSampleProtection ? "insufficient" : "watch") : needsSampleProtection && !highImpact ? "insufficient" : !historyAvailable && primaryDiagnosis === "data-insufficient" ? "watch" : highImpact && priorityEligible ? "priority" : highImpact || diagnoses.includes("intent-down") || diagnoses.includes("high-potential-low-traffic") ? "watch" : "healthy";
    return { productId: product.productId, priority, primaryDiagnosis, diagnoses, evidence: evidenceFor(product, prior, primaryDiagnosis), explanation: explanationFor(primaryDiagnosis, historyAvailable, qualityConcern), checks: checksFor(primaryDiagnosis), historyAvailable, qualityConcern };
  }).sort((left, right) => priorityOrder.indexOf(left.priority) - priorityOrder.indexOf(right.priority) || current.products.find((product) => product.productId === left.productId)!.originalIndex - current.products.find((product) => product.productId === right.productId)!.originalIndex);
  return { diagnostics, percentile: benchmarks, sampleThresholds };
};
