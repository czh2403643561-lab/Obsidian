import * as XLSX from "xlsx";
import type { UkDataSnapshot, UkMetricMap } from "./types";

export const metricValue = (metrics: UkMetricMap, key: string): number | null => metrics[key] ?? null;
export const numberText = (value: number | null, digits = 0): string => value === null ? "--" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
export const moneyText = (value: number | null): string => value === null ? "--" : `£${numberText(value, 2)}`;
export const percentText = (value: number | null): string => value === null ? "--" : `${numberText(value, 2)}%`;
export const rateText = (value: number | null): string => value === null ? "--" : `${value > 0 ? "+" : ""}${numberText(value, 2)}%`;
export const periodFilePart = (snapshot: UkDataSnapshot): string => snapshot.startDate && snapshot.endDate ? `${snapshot.startDate}_${snapshot.endDate}` : snapshot.importedAt.slice(0, 10);

export const changeText = (current: number | null, previous: number | null, isRate = false): { text: string; tone: "up" | "down" | "neutral" } => {
  if (current === null || previous === null || (!isRate && previous === 0)) return { text: "--", tone: "neutral" };
  const delta = isRate ? current - previous : ((current - previous) / Math.abs(previous)) * 100;
  return { text: `${delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} ${numberText(Math.abs(delta), 2)}${isRate ? " pp" : "%"}`, tone: delta > 0 ? "up" : delta < 0 ? "down" : "neutral" };
};

export type ExportColumn = { key: string; label: string; kind?: "money" | "rate" | "number" };

export const downloadXlsx = (filename: string, columns: ExportColumn[], rows: Array<Record<string, string | number | null | undefined>>): void => {
  const sheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => {
    const value = row[column.key];
    return column.kind === "rate" && typeof value === "number" ? value / 100 : value;
  }))]);
  rows.forEach((row, rowIndex) => columns.forEach((column, columnIndex) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
    if (!cell || row[column.key] === null || row[column.key] === undefined || typeof row[column.key] !== "number") return;
    if (column.kind === "rate") cell.z = "0.00%";
    if (column.kind === "money") cell.z = "£#,##0.00";
    if (column.kind === "number") cell.z = "#,##0.##";
  }));
  sheet["!cols"] = columns.map((column) => ({ wch: Math.max(14, column.label.length * 2 + 3) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "数据");
  XLSX.writeFile(workbook, filename);
};
