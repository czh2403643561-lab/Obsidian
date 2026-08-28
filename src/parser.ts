import * as XLSX from "xlsx";
import type { ParseResult, Product } from "./types";

export const TRACKED_HEADERS = [
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
  "近7天销量",
  "近7天GMV(￡)",
  "总销量",
  "总销售额(￡)",
  "带货达人数",
  "视频数",
  "佣金率",
  "预估上架时间",
];

const REQUIRED_HEADERS = ["商品Id", "TikTok商品链接", "商品名称"];

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

const findHeaderRow = (rows: unknown[][]): number => {
  let bestRow = -1;
  let bestScore = 0;

  rows.slice(0, 12).forEach((row, index) => {
    const headers = new Set(row.map(textValue));
    const score = TRACKED_HEADERS.reduce((total, header) => total + (headers.has(header) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRow = index;
    }
  });

  if (bestRow < 0 || bestScore < REQUIRED_HEADERS.length) {
    throw new Error("无法识别 EchoTik 商品列表表头，请确认第 2 行是商品字段表头。");
  }
  return bestRow;
};

const normalizeUrl = (value: unknown): string => {
  const url = textValue(value);
  return /^https?:\/\//i.test(url) ? url : "";
};

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
  const headerRow = findHeaderRow(rows);
  const headers = rows[headerRow].map(textValue);
  const columns = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header && !columns.has(header)) columns.set(header, index);
  });

  const missingRequired = REQUIRED_HEADERS.filter((header) => !columns.has(header));
  if (missingRequired.length) {
    throw new Error(`缺少关键字段：${missingRequired.join("、")}`);
  }

  const missingHeaders = TRACKED_HEADERS.filter((header) => !columns.has(header));
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
      recentSales: parseMetric(columnValue(row, columns, "近7天销量")),
      recentGmv: parseMetric(columnValue(row, columns, "近7天GMV(￡)")),
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
    headerRow,
    foundHeaders: TRACKED_HEADERS.filter((header) => columns.has(header)),
    missingHeaders,
    skippedRows,
  };
};
