import * as XLSX from "xlsx";
import type { ParseResult, Product, ProductPeriod, Shop, ShopParseResult } from "./types";

const PRODUCT_COMMON_HEADERS = [
  "商品Id",
  "TikTok商品链接",
  "商品名称",
  "封面图片",
  "店铺名称",
  "分类",
  "全托管",
  "品牌店铺",
  "店铺类型",
  "商品评分",
  "评论数",
  "价格",
  "总销量",
  "总销售额(￡)",
  "带货达人数",
  "视频数",
  "佣金率",
  "预估上架时间",
];

const PRODUCT_PERIOD_HEADERS: Record<ProductPeriod, [string, string]> = {
  "7d": ["近7天销量", "近7天GMV(￡)"],
  "30d": ["近30天销量", "近30天GMV(￡)"],
};

export const TRACKED_HEADERS = [...PRODUCT_COMMON_HEADERS, ...PRODUCT_PERIOD_HEADERS["7d"], ...PRODUCT_PERIOD_HEADERS["30d"]];

const REQUIRED_HEADERS = ["商品Id", "TikTok商品链接", "商品名称"];

export const SHOP_TRACKED_HEADERS = [
  "店铺名称",
  "Unique Id",
  "带货分类",
  "全托管",
  "店铺类型",
  "地区",
  "店铺评分",
  "带货商品数",
  "在店商品总数",
  "商品均价",
  "近7天销量",
  "总销量",
  "近7天GMV(￡)",
  "总销售额(￡)",
  "总达人数",
  "视频数",
  "直播数",
  "采集时间",
  "查看更多",
];

const SHOP_REQUIRED_HEADERS = ["店铺名称", "近7天销量", "总销量", "查看更多"];
const SHOP_IDENTITY_HEADERS = ["Unique Id", "地区", "店铺评分", "带货商品数", "在店商品总数", "总达人数", "直播数", "采集时间"];

const textValue = (value: unknown): string =>
  String(value ?? "")
    .replace(/\uFEFF/g, "")
    .trim();

const columnValue = (row: unknown[], columns: Map<string, number>, name: string): unknown => {
  const index = columns.get(name);
  return index === undefined ? "" : row[index];
};

export const parseMetric = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const source = textValue(value).replace(/[£$￥¥\s]/g, "").replace(/,/g, "");
  if (!source) return 0;

  let multiplier = 1;
  let normalized = source;
  if (/万$/i.test(normalized)) {
    multiplier = 10_000;
    normalized = normalized.slice(0, -1);
  } else if (/亿$/i.test(normalized)) {
    multiplier = 100_000_000;
    normalized = normalized.slice(0, -1);
  } else if (/m$/i.test(normalized)) {
    multiplier = 1_000_000;
    normalized = normalized.slice(0, -1);
  } else if (/k$/i.test(normalized)) {
    multiplier = 1_000;
    normalized = normalized.slice(0, -1);
  }

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]) * multiplier;
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRate = (value: unknown): number => {
  const source = textValue(value);
  if (!source) return 0;
  const parsed = parseMetric(source);
  return source.includes("%") || parsed > 1 ? parsed : parsed * 100;
};

const findHeaderRow = (rows: unknown[][], trackedHeaders: string[], requiredHeaders: string[], description: string): number => {
  let bestRow = -1;
  let bestScore = 0;

  rows.slice(0, 12).forEach((row, index) => {
    const headers = new Set(row.map(textValue));
    const score = trackedHeaders.reduce((total, header) => total + (headers.has(header) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRow = index;
    }
  });

  if (bestRow < 0 || bestScore < requiredHeaders.length) {
    throw new Error(`无法识别 EchoTik ${description}表头，请确认第 2 行是字段表头。`);
  }
  return bestRow;
};

const normalizeUrl = (value: unknown): string => {
  const url = textValue(value).replace(/&amp;/gi, "&");
  return /^https?:\/\//i.test(url) ? url : "";
};

const cellHyperlink = (sheet: XLSX.WorkSheet, row: number, column: number | undefined): string => {
  if (column === undefined) return "";
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  return normalizeUrl(sheet[address]?.l?.Target);
};

const isShopUrl = (url: string): boolean => /^https:\/\/echotik\.live\/shops\//i.test(url);

export const parseProductWorkbook = async (file: File): Promise<ParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls"].includes(extension)) {
    throw new Error("请选择 .xlsx 或 .xls 格式的 EchoTik 商品列表文件。");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new Error("文件读取失败，请重新导出或选择有效的 Excel 文件。");
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel 中没有可读取的工作表。");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  const headerRow = findHeaderRow(rows, TRACKED_HEADERS, REQUIRED_HEADERS, "商品列表");
  const headers = rows[headerRow].map(textValue);
  const columns = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header && !columns.has(header)) columns.set(header, index);
  });

  const missingRequired = REQUIRED_HEADERS.filter((header) => !columns.has(header));
  if (missingRequired.length) {
    throw new Error(`缺少关键字段：${missingRequired.join("、")}`);
  }

  const has7d = columns.has(PRODUCT_PERIOD_HEADERS["7d"][0]);
  const has30d = columns.has(PRODUCT_PERIOD_HEADERS["30d"][0]);
  if (has7d && has30d) {
    throw new Error("同时识别到近7天和近30天销量字段，无法确定当前商品数据周期。");
  }
  if (!has7d && !has30d) {
    throw new Error("缺少近7天销量或近30天销量字段，无法识别商品数据周期。");
  }
  const period: ProductPeriod = has7d ? "7d" : "30d";
  const [recentSalesHeader, recentGmvHeader] = PRODUCT_PERIOD_HEADERS[period];
  const missingHeaders = [...PRODUCT_COMMON_HEADERS, ...PRODUCT_PERIOD_HEADERS[period]].filter((header) => !columns.has(header));
  let skippedRows = 0;
  const products: Product[] = [];

  rows.slice(headerRow + 1).forEach((row, index) => {
    const name = textValue(columnValue(row, columns, "商品名称"));
    const url = normalizeUrl(columnValue(row, columns, "TikTok商品链接"));
    if (!name && !url) return;
    if (!name || !url) {
      skippedRows += 1;
      return;
    }

    products.push({
      id: textValue(columnValue(row, columns, "商品Id")) || `row-${index + 1}`,
      url,
      name,
      coverUrl: normalizeUrl(columnValue(row, columns, "封面图片")),
      shopName: textValue(columnValue(row, columns, "店铺名称")) || "未填写店铺",
      category: textValue(columnValue(row, columns, "分类")),
      price: parseMetric(columnValue(row, columns, "价格")),
      recentSales: parseMetric(columnValue(row, columns, recentSalesHeader)),
      recentGmv: parseMetric(columnValue(row, columns, recentGmvHeader)),
      totalSales: parseMetric(columnValue(row, columns, "总销量")),
      totalGmv: parseMetric(columnValue(row, columns, "总销售额(￡)")),
      creators: parseMetric(columnValue(row, columns, "带货达人数")),
      videos: parseMetric(columnValue(row, columns, "视频数")),
      commissionRate: parseRate(columnValue(row, columns, "佣金率")),
      rating: parseMetric(columnValue(row, columns, "商品评分")),
      reviews: parseMetric(columnValue(row, columns, "评论数")),
      estimatedTime: textValue(columnValue(row, columns, "预估上架时间")),
    });
  });

  if (!products.length) {
    throw new Error("没有找到有效商品数据，请确认文件是 EchoTik 商品列表导出文件。");
  }

  return {
    products,
    period,
    headerRow,
    foundHeaders: TRACKED_HEADERS.filter((header) => columns.has(header)),
    missingHeaders,
    skippedRows,
  };
};

const normalizeManaged = (value: unknown): string => {
  const source = textValue(value);
  const normalized = source.toLowerCase();
  if (["是", "yes", "true", "1"].includes(normalized)) return "是";
  if (["否", "no", "false", "0"].includes(normalized)) return "否";
  return source;
};

export const parseShopWorkbook = async (file: File): Promise<ShopParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    throw new Error("请选择 .xlsx 或 .xls 格式的 EchoTik 小店列表文件。");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new Error("文件读取失败，请重新导出或选择有效的 Excel 文件。");
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel 中没有可读取的工作表。");

  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  const headerRow = findHeaderRow(rows, SHOP_TRACKED_HEADERS, SHOP_REQUIRED_HEADERS, "小店列表");
  const headers = rows[headerRow].map(textValue);
  const columns = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header && !columns.has(header)) columns.set(header, index);
  });

  const missingRequired = SHOP_REQUIRED_HEADERS.filter((header) => !columns.has(header));
  if (missingRequired.length) {
    throw new Error(`请选择 EchoTik 小店列表 Excel，缺少关键字段：${missingRequired.join("、")}`);
  }

  const matchedIdentityHeaders = SHOP_IDENTITY_HEADERS.filter((header) => columns.has(header));
  if (matchedIdentityHeaders.length < 4) {
    throw new Error("请选择 EchoTik 小店列表 Excel，未识别到足够的店铺专属字段。");
  }

  const missingHeaders = SHOP_TRACKED_HEADERS.filter((header) => !columns.has(header));
  let skippedRows = 0;
  const shops: Shop[] = [];

  rows.slice(headerRow + 1).forEach((row, index) => {
    const sheetRow = headerRow + index + 1;
    const name = textValue(columnValue(row, columns, "店铺名称"));
    const url =
      cellHyperlink(sheet, sheetRow, columns.get("店铺名称")) ||
      cellHyperlink(sheet, sheetRow, columns.get("查看更多")) ||
      normalizeUrl(columnValue(row, columns, "查看更多"));
    if (!name && !url) return;
    if (!name || !url || !isShopUrl(url)) {
      skippedRows += 1;
      return;
    }

    shops.push({
      id: textValue(columnValue(row, columns, "Unique Id")) || `shop-row-${index + 1}`,
      url,
      name,
      deliveryCategory: textValue(columnValue(row, columns, "带货分类")),
      managed: normalizeManaged(columnValue(row, columns, "全托管")),
      shopType: textValue(columnValue(row, columns, "店铺类型")) || "未填写",
      region: textValue(columnValue(row, columns, "地区")) || "未填写",
      rating: parseMetric(columnValue(row, columns, "店铺评分")),
      promotedProductCount: parseMetric(columnValue(row, columns, "带货商品数")),
      totalProducts: parseMetric(columnValue(row, columns, "在店商品总数")),
      averagePrice: parseMetric(columnValue(row, columns, "商品均价")),
      recentSales: parseMetric(columnValue(row, columns, "近7天销量")),
      totalSales: parseMetric(columnValue(row, columns, "总销量")),
      recentGmv: parseMetric(columnValue(row, columns, "近7天GMV(￡)")),
      totalGmv: parseMetric(columnValue(row, columns, "总销售额(￡)")),
      creators: parseMetric(columnValue(row, columns, "总达人数")),
      videos: parseMetric(columnValue(row, columns, "视频数")),
      lives: parseMetric(columnValue(row, columns, "直播数")),
      collectedAt: textValue(columnValue(row, columns, "采集时间")),
    });
  });

  if (!shops.length) {
    throw new Error("请选择 EchoTik 小店列表 Excel，未找到有效的 EchoTik 店铺链接。");
  }

  return {
    shops,
    headerRow,
    foundHeaders: SHOP_TRACKED_HEADERS.filter((header) => columns.has(header)),
    missingHeaders,
    skippedRows,
  };
};
