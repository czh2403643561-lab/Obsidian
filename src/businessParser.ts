import * as XLSX from "xlsx";
import type { BusinessBatch, BusinessCardMetrics, BusinessMallMetrics, BusinessProductRecord, BusinessQualityIssue, BusinessSourceStatus, BusinessTrendPoint } from "./types";

type Rows = unknown[][];
type DetectedFile = { file: File; source: BusinessSourceStatus; workbook: XLSX.WorkBook; dateRange: { startDate: string; endDate: string } };
type Column = { group: string; field: string; index: number };

const cardAliases: Record<keyof BusinessCardMetrics, string[]> = {
  gmv: ["归因GMV", "商家商品卡GMV", "GMV"], skuOrders: ["归因SKU订单数", "SKU订单数"], units: ["归因成交件数", "商品成交件数"], customers: ["预计客户数"], aov: ["AOV归因SKU订单", "平均订单金额SKU订单"], impressions: ["商品曝光次数"], clicks: ["商品点击量"], ctr: ["商品点击率"], addToCarts: ["加购次数"], addToCartRate: ["加购率"], ctor: ["CTORSKU订单"], uniqueImpressions: ["去重商品曝光次数"], uniqueClicks: ["去重点击次数"], uniqueCtr: ["去重点击率"], addToCartUsers: ["已加购的用户数", "ATC用户数"], uniqueAddToCartRate: ["去重加购率"], uniqueCtor: ["去重点击成交转化率SKU订单"],
};
const productCardAliases: Record<keyof BusinessCardMetrics, string[]> = { ...cardAliases, gmv: ["GMV", "归因GMV"], skuOrders: ["SKU订单数", "归因SKU订单数"], units: ["商品成交件数", "归因成交件数"] };

const mallAliases: Record<keyof BusinessMallMetrics, string[]> = {
  impressions: ["商城页商品曝光次数"], clicks: ["商城页商品点击量"], uniqueClicks: ["商城页去重商品点击量"], customers: ["预计商城页客户数"], ctr: ["商城页点击率"], ctor: ["商城页点击成交转化率SKU订单"], gmv: ["商城页GMV"], units: ["商城页商品成交件数"],
};

const emptyCard = (): BusinessCardMetrics => ({ gmv: null, skuOrders: null, units: null, customers: null, aov: null, impressions: null, clicks: null, ctr: null, addToCarts: null, addToCartRate: null, ctor: null, uniqueImpressions: null, uniqueClicks: null, uniqueCtr: null, addToCartUsers: null, uniqueAddToCartRate: null, uniqueCtor: null });
const emptyMall = (): BusinessMallMetrics => ({ impressions: null, clicks: null, uniqueClicks: null, customers: null, ctr: null, ctor: null, gmv: null, units: null });
const text = (value: unknown): string => String(value ?? "").replace(/\uFEFF/g, "").trim();
const header = (value: unknown): string => text(value).replace(/[\s（）()]/g, "").toLowerCase();

const parseNumber = (value: unknown): number | null => {
  const source = text(value).replace(/[£,$]/g, "").replace(/,/g, "").replace(/%/g, "");
  if (!source || /^(--|-|—|n\/a|null)$/i.test(source)) return null;
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : null;
};

const dateToIso = (value: string): string | null => {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

const extractDateRange = (rows: Rows): { startDate: string; endDate: string } | null => {
  const source = rows.slice(0, 5).flat().map(text).find((value) => value.includes("数据分析日期")) ?? "";
  const matches = [...source.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map((match) => dateToIso(match[1])).filter((value): value is string => Boolean(value));
  return matches.length >= 2 ? { startDate: matches[0], endDate: matches[1] } : null;
};

const rowsFor = (workbook: XLSX.WorkBook, sheet: string): Rows => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: "", raw: false }) as Rows;

const findGroupedColumns = (rows: Rows): { columns: Column[]; headerRow: number } => {
  const groupRow = rows.findIndex((row) => row.some((value) => text(value) === "商家商品卡") && row.some((value) => text(value) === "全部"));
  if (groupRow < 0 || !rows[groupRow + 1]) throw new Error("无法识别 Excel 的多级字段分组。");
  let currentGroup = "";
  return {
    headerRow: groupRow + 1,
    columns: rows[groupRow + 1].map((field, index) => {
      const group = text(rows[groupRow][index]);
      if (group) currentGroup = group;
      return { group: currentGroup, field: header(field), index };
    }),
  };
};

const valueByAliases = (row: unknown[], columns: Column[], group: string, aliases: string[]): number | null => {
  const column = aliases.map(header).map((alias) => columns.find((item) => item.group === group && item.field === alias)).find((item): item is Column => Boolean(item));
  return column ? parseNumber(row[column.index]) : null;
};

const cardMetrics = (row: unknown[], columns: Column[], group = "商家商品卡", useProductFields = false): BusinessCardMetrics => {
  const metrics = emptyCard();
  const aliases = useProductFields ? productCardAliases : cardAliases;
  (Object.keys(aliases) as Array<keyof BusinessCardMetrics>).forEach((key) => { metrics[key] = valueByAliases(row, columns, group, aliases[key]); });
  return metrics;
};

const mallMetrics = (row: unknown[], columns: Column[]): BusinessMallMetrics => {
  const metrics = emptyMall();
  (Object.keys(mallAliases) as Array<keyof BusinessMallMetrics>).forEach((key) => { metrics[key] = valueByAliases(row, columns, "全部", mallAliases[key]); });
  return metrics;
};

const parseSummary = <T>(workbook: XLSX.WorkBook, mapper: (row: unknown[], columns: Column[]) => T): T => {
  const rows = rowsFor(workbook, "摘要");
  const { columns, headerRow } = findGroupedColumns(rows);
  const valueRow = rows.slice(headerRow + 1).find((row) => text(row[0]) === "总计值") ?? rows[headerRow + 1];
  if (!valueRow) throw new Error("摘要页缺少总计值。");
  return mapper(valueRow, columns);
};

const parseTrend = <T>(workbook: XLSX.WorkBook, mapper: (row: unknown[], columns: Column[]) => T): BusinessTrendPoint<T>[] => {
  const rows = rowsFor(workbook, "趋势");
  const { columns, headerRow } = findGroupedColumns(rows);
  return rows.slice(headerRow + 1).flatMap((row) => {
    const date = dateToIso(text(row[0]));
    return date ? [{ date, metrics: mapper(row, columns) }] : [];
  });
};

const sourceFrom = async (file: File): Promise<DetectedFile> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const firstRows = workbook.SheetNames.flatMap((name) => rowsFor(workbook, name).slice(0, 5).flat()).map(text).join(" ");
  const dateRange = extractDateRange(workbook.SheetNames.length ? rowsFor(workbook, workbook.SheetNames[0]) : []);
  if (!dateRange) throw new Error(`无法从“${file.name}”读取数据分析日期。`);
  if (workbook.SheetNames.includes("摘要") && workbook.SheetNames.includes("趋势") && firstRows.includes("内容类型: 商家商品卡")) return { file, workbook, dateRange, source: { fileName: file.name, detectedAs: "card-traffic" } };
  if (workbook.SheetNames.includes("摘要") && workbook.SheetNames.includes("趋势") && firstRows.includes("内容类型: 全部")) return { file, workbook, dateRange, source: { fileName: file.name, detectedAs: "all-traffic" } };
  const dataRows = rowsFor(workbook, workbook.SheetNames[0] ?? "");
  const hasProductHeaders = dataRows.some((row) => row.includes("商品名") && row.includes("商品 ID"));
  const hasCardGroup = dataRows.some((row) => row.includes("商家商品卡"));
  if (hasProductHeaders && hasCardGroup) return { file, workbook, dateRange, source: { fileName: file.name, detectedAs: "product-data" } };
  throw new Error(`无法识别“${file.name}”。请选择商品数据、商品卡专项和全部流量三份官方 Excel。`);
};

const parseProducts = (workbook: XLSX.WorkBook): BusinessProductRecord[] => {
  const rows = rowsFor(workbook, workbook.SheetNames[0]);
  const { columns, headerRow } = findGroupedColumns(rows);
  const identityRow = rows[headerRow] ?? [];
  const findIdentity = (name: string) => identityRow.findIndex((field) => text(field) === name);
  const nameIndex = findIdentity("商品名"); const idIndex = findIdentity("商品 ID"); const statusIndex = findIdentity("发品状态"); const rangeIndex = findIdentity("GMV 区间");
  if (nameIndex < 0 || idIndex < 0) throw new Error("商品数据文件缺少商品名或商品 ID。");
  return rows.slice(headerRow + 1).flatMap((row, originalIndex) => {
    const productId = text(row[idIndex]);
    if (!productId) return [];
    return [{ originalIndex, productId, name: text(row[nameIndex]) || "未命名商品", publishStatus: statusIndex >= 0 ? text(row[statusIndex]) : "未填写", gmvRange: rangeIndex >= 0 ? text(row[rangeIndex]) : "", card: cardMetrics(row, columns, "商家商品卡", true), mall: mallMetrics(row, columns) }];
  });
};

const checkMetrics = (label: string, metrics: BusinessCardMetrics | BusinessMallMetrics, issues: BusinessQualityIssue[]) => {
  if ("uniqueClicks" in metrics && metrics.uniqueClicks !== null && metrics.clicks !== null && metrics.uniqueClicks > metrics.clicks) issues.push({ level: "warning", message: `${label}的去重点击高于总点击，请核对原始数据。` });
  if (metrics.clicks !== null && metrics.impressions === null) issues.push({ level: "warning", message: `${label}存在点击但曝光缺失。` });
};

const addLatestMissingWarning = (label: string, point: BusinessTrendPoint<BusinessCardMetrics> | BusinessTrendPoint<BusinessMallMetrics> | undefined, issues: BusinessQualityIssue[]) => {
  if (!point) return;
  const values = Object.values(point.metrics);
  if (values.filter((value) => value === null).length >= Math.ceil(values.length * 0.45)) issues.push({ level: "warning", message: `${label}最新日期 ${point.date} 的缺失字段较多。` });
};

export const parseBusinessFiles = async (files: File[]): Promise<BusinessBatch> => {
  if (files.length < 3) throw new Error("请一次选择商品数据、商品卡专项、全部流量三份 Excel。");
  const detected = await Promise.all(files.map(sourceFrom));
  const cardTraffic = detected.filter((item) => item.source.detectedAs === "card-traffic");
  const allTraffic = detected.filter((item) => item.source.detectedAs === "all-traffic");
  const productData = detected.filter((item) => item.source.detectedAs === "product-data");
  if (cardTraffic.length !== 1 || allTraffic.length !== 1 || productData.length !== 1 || detected.length !== 3) throw new Error("请只导入各一份商品数据、商品卡专项和全部流量 Excel。");
  const ranges = detected.map((item) => `${item.dateRange.startDate}/${item.dateRange.endDate}`);
  if (new Set(ranges).size !== 1) throw new Error(`三份文件的数据分析日期不一致：${ranges.join("、")}。请导入同一周期文件。`);
  const cardFile = cardTraffic[0]; const allFile = allTraffic[0]; const productsFile = productData[0];
  const shopCardSummary = parseSummary(cardFile.workbook, (row, columns) => cardMetrics(row, columns));
  const shopCardTrend = parseTrend(cardFile.workbook, (row, columns) => cardMetrics(row, columns));
  const shopMallSummary = parseSummary(allFile.workbook, mallMetrics);
  const shopMallTrend = parseTrend(allFile.workbook, mallMetrics);
  const products = parseProducts(productsFile.workbook);
  const qualityIssues: BusinessQualityIssue[] = [];
  checkMetrics("店铺商品卡", shopCardSummary, qualityIssues); checkMetrics("店铺商城页", shopMallSummary, qualityIssues);
  products.forEach((product) => { checkMetrics(`商品 ${product.productId} 的商品卡`, product.card, qualityIssues); checkMetrics(`商品 ${product.productId} 的商城页`, product.mall, qualityIssues); });
  addLatestMissingWarning("商品卡趋势", shopCardTrend[shopCardTrend.length - 1], qualityIssues); addLatestMissingWarning("商城页趋势", shopMallTrend[shopMallTrend.length - 1], qualityIssues);
  return { id: `business-${Date.now()}`, startDate: cardFile.dateRange.startDate, endDate: cardFile.dateRange.endDate, importedAt: new Date().toISOString(), sources: { productData: productsFile.source, cardTraffic: cardFile.source, allTraffic: allFile.source }, shopCardSummary, shopCardTrend, shopMallSummary, shopMallTrend, products, qualityIssues };
};
