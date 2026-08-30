import * as XLSX from "xlsx";
import type { BusinessCardMetrics, BusinessMallMetrics, BusinessProductRecord } from "../types";
import type { UkDataPayload, UkDataSourceKey, UkMetricMap, UkMetricTrendPoint, UkParsedImport, UkProductDetailsData, UkProductTrafficData, UkStoreBusinessData, UkStoreKeywordsData } from "./types";

type Rows = unknown[][];
type Column = { group: string; field: string; index: number };

const nullTokens = /^(--|-|—|n\/?a|null)$/i;
const text = (value: unknown): string => String(value ?? "").replace(/\uFEFF/g, "").trim();
const key = (value: unknown): string => text(value).replace(/[\s（）()]/g, "").toLowerCase();
const rowsFor = (workbook: XLSX.WorkBook, sheet: string): Rows => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: "", raw: false }) as Rows;
const isRate = (label: string): boolean => /%|率|ctor|conversion/i.test(label);

const parseValue = (value: unknown, rate = false): number | null => {
  const source = text(value);
  if (!source || nullTokens.test(source)) return null;
  const numericText = source.replace(/[£,$,]/g, "").replace(/%/g, "");
  const match = numericText.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  const signed = /▼|↓/.test(source) ? -Math.abs(parsed) : parsed;
  return rate && !source.includes("%") && Math.abs(signed) > 0 && Math.abs(signed) <= 1 ? signed * 100 : signed;
};

const isoDate = (value: unknown): string | null => {
  const source = text(value);
  const yearFirst = source.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}`;
  const dayFirst = source.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  return dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}` : null;
};

const datesIn = (value: unknown): string[] => [...text(value).matchAll(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/g)].map((match) => isoDate(match[0])).filter((date): date is string => Boolean(date));
const rangeFrom = (rows: Rows, labels: RegExp): { startDate: string; endDate: string } | null => {
  const labelled = rows.flat().map(text).filter((value) => labels.test(value)).flatMap(datesIn);
  if (labelled.length >= 2) return { startDate: labelled[0], endDate: labelled[1] };
  const dates = rows.flat().flatMap(datesIn).sort();
  return dates.length >= 2 ? { startDate: dates[0], endDate: dates[dates.length - 1] } : null;
};
const mapRow = (headers: unknown[], row: unknown[]): UkMetricMap => Object.fromEntries(headers.map((header, index) => [text(header), parseValue(row[index], isRate(text(header)))]).filter(([label]) => Boolean(label)));
const findHeaderRow = (rows: Rows, required: string[]): number => rows.findIndex((row) => required.every((label) => row.some((value) => key(value) === key(label))));

const emptyCard = (): BusinessCardMetrics => ({ gmv: null, skuOrders: null, units: null, customers: null, aov: null, impressions: null, clicks: null, ctr: null, addToCarts: null, addToCartRate: null, ctor: null, uniqueImpressions: null, uniqueClicks: null, uniqueCtr: null, addToCartUsers: null, uniqueAddToCartRate: null, uniqueCtor: null });
const emptyMall = (): BusinessMallMetrics => ({ impressions: null, clicks: null, uniqueClicks: null, customers: null, ctr: null, ctor: null, gmv: null, units: null });
const aliases: Record<keyof BusinessCardMetrics, string[]> = {
  gmv: ["GMV"], skuOrders: ["SKU订单数"], units: ["商品成交件数"], customers: ["预计客户数"], aov: ["平均订单金额SKU订单"], impressions: ["商品曝光次数"], clicks: ["商品点击量"], ctr: ["商品点击率"], addToCarts: ["加购次数"], addToCartRate: ["加购率"], ctor: ["CTORSKU订单"], uniqueImpressions: ["去重商品曝光次数"], uniqueClicks: ["去重点击次数"], uniqueCtr: ["去重点击率"], addToCartUsers: ["已加购的用户数", "ATC用户数"], uniqueAddToCartRate: ["去重加购率"], uniqueCtor: ["去重点击成交转化率SKU订单"],
};
const mallAliases: Record<keyof BusinessMallMetrics, string[]> = { impressions: ["商城页商品曝光次数"], clicks: ["商城页商品点击量"], uniqueClicks: ["商城页去重商品点击量"], customers: ["预计商城页客户数"], ctr: ["商城页点击率"], ctor: ["商城页点击成交转化率SKU订单"], gmv: ["商城页GMV"], units: ["商城页商品成交件数"] };

const groupedColumns = (rows: Rows, headerRow: number): Column[] => {
  const groupRow = rows[headerRow - 1] ?? [];
  let currentGroup = "";
  return (rows[headerRow] ?? []).map((field, index) => { const group = text(groupRow[index]); if (group) currentGroup = group; return { group: currentGroup, field: key(field), index }; });
};
const groupedValue = (row: unknown[], columns: Column[], group: string, fields: string[]): number | null => {
  const column = fields.map(key).map((field) => columns.find((item) => item.group === group && item.field === field)).find((item): item is Column => Boolean(item));
  return column ? parseValue(row[column.index], isRate(column.field)) : null;
};
const metricSet = <T extends BusinessCardMetrics | BusinessMallMetrics>(target: T, row: unknown[], columns: Column[], group: string, dictionary: Record<keyof T, string[]>): T => {
  (Object.keys(dictionary) as Array<keyof T>).forEach((metric) => { (target as unknown as Record<string, number | null>)[String(metric)] = groupedValue(row, columns, group, dictionary[metric]); });
  return target;
};

const parseStoreBusiness = (workbook: XLSX.WorkBook): UkStoreBusinessData => {
  const rows = rowsFor(workbook, workbook.SheetNames[0]);
  const dailyHeader = findHeaderRow(rows, ["日期", "SKU 订单"]);
  if (dailyHeader < 0) throw new Error("业务数据文件缺少每日数据表头。");
  const summary = mapRow(rows[0] ?? [], rows[1] ?? []);
  const daily = rows.slice(dailyHeader + 1).flatMap((row) => { const date = isoDate(row[0]); return date ? [{ date, metrics: mapRow(rows[dailyHeader], row) }] : []; });
  return { summary, daily };
};

const parseMallOverview = (workbook: XLSX.WorkBook): UkDataPayload => {
  const rows = rowsFor(workbook, workbook.SheetNames[0]);
  if (!rows[0] || !rows[1]) throw new Error("商城页概览文件缺少 KPI 数据。");
  return { summary: mapRow(rows[0], rows[1]) };
};

const parseStoreKeywords = (workbook: XLSX.WorkBook): UkStoreKeywordsData => {
  const rows = rowsFor(workbook, workbook.SheetNames[0]);
  const headerRow = findHeaderRow(rows, ["关键词", "搜索结果访问用户数"]);
  if (headerRow < 0) throw new Error("店铺关键词文件缺少关键词表头。");
  const headers = rows[headerRow];
  const rowsData = rows.slice(headerRow + 1).flatMap((row) => { const keyword = text(row[0]); return keyword ? [{ keyword, metrics: mapRow(headers.slice(1), row.slice(1)) }] : []; });
  return { rows: rowsData };
};

const parseProductDetails = (workbook: XLSX.WorkBook): UkProductDetailsData => {
  const rows = rowsFor(workbook, workbook.SheetNames[0]);
  const headerRow = findHeaderRow(rows, ["商品名", "商品 ID"]);
  if (headerRow < 0) throw new Error("商品详细信息文件缺少商品名或商品 ID。");
  const headers = rows[headerRow];
  const columns = groupedColumns(rows, headerRow);
  const nameIndex = headers.findIndex((value) => key(value) === key("商品名"));
  const idIndex = headers.findIndex((value) => key(value) === key("商品 ID"));
  const rangeIndex = headers.findIndex((value) => key(value) === key("GMV 区间"));
  const statusIndex = headers.findIndex((value) => key(value) === key("发品状态"));
  const products: BusinessProductRecord[] = rows.slice(headerRow + 1).flatMap((row, originalIndex) => {
    const productId = text(row[idIndex]);
    if (!productId) return [];
    const card = metricSet(emptyCard(), row, columns, "全部", aliases);
    const mall = metricSet(emptyMall(), row, columns, "全部", mallAliases);
    return [{ originalIndex, productId, name: text(row[nameIndex]) || "未命名商品", gmvRange: rangeIndex >= 0 ? text(row[rangeIndex]) : "", publishStatus: statusIndex >= 0 ? text(row[statusIndex]) : "", orders: groupedValue(row, columns, "全部", ["订单数"]), card, mall }];
  });
  return { products };
};

const parseProductTraffic = (workbook: XLSX.WorkBook): UkProductTrafficData => {
  const summaryRows = rowsFor(workbook, "摘要");
  const summaryHeader = findHeaderRow(summaryRows, ["GMV", "SKU 订单数", "商品曝光次数"]);
  if (summaryHeader < 0) throw new Error("商品流量文件缺少摘要指标。");
  const valueRow = summaryRows.find((row) => text(row[0]) === "总计值") ?? [];
  const comparisonRow = summaryRows.find((row) => /成长分数|增长率|环比/.test(text(row[0]))) ?? [];
  const trendRows = rowsFor(workbook, "趋势");
  const trendHeader = findHeaderRow(trendRows, ["日期", "GMV", "SKU 订单数"]);
  const trend: UkMetricTrendPoint[] = trendHeader < 0 ? [] : trendRows.slice(trendHeader + 1).flatMap((row) => { const date = isoDate(row[0]); return date ? [{ date, metrics: mapRow(trendRows[trendHeader], row) }] : []; });
  const comparisonRange = rangeFrom(summaryRows, /比较|对比/);
  return { summary: mapRow(summaryRows[summaryHeader], valueRow), comparison: mapRow(summaryRows[summaryHeader], comparisonRow), trend, comparisonStartDate: comparisonRange?.startDate ?? null, comparisonEndDate: comparisonRange?.endDate ?? null };
};

const classify = (workbook: XLSX.WorkBook): UkDataSourceKey => {
  const allRows = workbook.SheetNames.flatMap((sheet) => rowsFor(workbook, sheet));
  const values = allRows.flat().map(text);
  if (values.includes("关键词") && values.includes("搜索结果访问用户数")) return "store-keywords";
  if (values.includes("商品名") && values.includes("商品 ID") && values.includes("商家商品卡")) return "product-details";
  if (workbook.SheetNames.includes("摘要") && workbook.SheetNames.includes("趋势") && values.includes("商品曝光次数")) return "product-traffic";
  if (values.some((value) => /Competitor Benchmark|竞争对手参考/i.test(value)) && values.some((value) => /Impressions|曝光次数/i.test(value))) return "mall-overview";
  if (values.includes("每日数据") && values.includes("商品交易总额 (£)")) return "store-business";
  throw new Error("无法从 Excel 字段识别 UK 数据来源。");
};

export const parseUkAnalyticsFile = async (file: File): Promise<UkParsedImport> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const source = classify(workbook);
  const firstRows = rowsFor(workbook, workbook.SheetNames[0]);
  const range = source === "store-business" ? rangeFrom(firstRows, /数据分析日期/) : rangeFrom(firstRows, /数据分析日期|日期范围/);
  const data = source === "store-business" ? parseStoreBusiness(workbook) : source === "mall-overview" ? parseMallOverview(workbook) : source === "store-keywords" ? parseStoreKeywords(workbook) : source === "product-details" ? parseProductDetails(workbook) : parseProductTraffic(workbook);
  return { source, fileName: file.name, startDate: range?.startDate ?? null, endDate: range?.endDate ?? null, data, requiresPeriodConfirmation: !range };
};
