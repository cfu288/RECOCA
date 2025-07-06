import * as XLSX from "xlsx";

export interface ExcelSheet {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ExcelFileInfo {
  sheetNames: string[];
  sheets: ExcelSheet[];
}

const EXCEL_EXTENSIONS = ["xlsx", "xls"] as const;
// Excel date serial number constants
// Sources:
// - Excel epoch offset (25569): https://exceljet.net/formulas/convert-unix-time-stamp-to-excel-date
// - Excel epoch offset (25569): https://knowledge.broadcom.com/external/article/57052/how-to-convert-unix-epoch-time-values-in.html
// - Excel date range (1 to 2958465): https://bettersolutions.com/excel/dates-times/dates.htm
// - Excel max date (2958465 = Dec 31, 9999): https://www.omnisecu.com/excel/worksheet/data-types-in-excel.php
const EXCEL_DATE_MIN = 1;
const EXCEL_DATE_MAX = 2958465;
const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 86400 * 1000;

/**
 * Extracts metadata from an Excel file including sheet names and dimensions.
 * @throws {Error} When the file cannot be parsed as Excel
 */
export function getExcelFileInfo(fileBuffer: Buffer): ExcelFileInfo {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const sheetNames = workbook.SheetNames;
  const sheets: ExcelSheet[] = [];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    sheets.push({
      name: sheetName,
      rowCount: range.e.r + 1,
      columnCount: range.e.c + 1,
    });
  }

  return {
    sheetNames,
    sheets,
  };
}

/**
 * Converts Excel serial date number to JavaScript Date.
 * Excel stores dates as the number of days since January 1, 1900. (Assuming the 1900 date system)
 *
 * @ref https://support.microsoft.com/en-us/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487
 */
export function excelDateToJSDate(excelDate: number): Date {
  return new Date((excelDate - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
}

/**
 * Determines if a value is likely an Excel date serial number.
 * Excel date serials are positive numbers within a specific range.
 */
export function isExcelDateSerial(value: unknown): boolean {
  return (
    typeof value === "number" &&
    value > EXCEL_DATE_MIN &&
    value < EXCEL_DATE_MAX
  );
}

/**
 * Converts a specific Excel sheet to JSON format for data processing.
 * Optimized for performance by avoiding upfront date conversion.
 * @throws {Error} When the sheet cannot be found or converted
 */
export function convertSheetToJSON(
  fileBuffer: Buffer,
  sheetName: string
): object[] {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  return XLSX.utils.sheet_to_json(worksheet);
}

/**
 * Converts Excel date serials to ISO date strings for a column of data.
 * Non-date values are converted to strings. Date conversion failures
 * fall back to string representation.
 */
export function convertColumnDates(columnData: unknown[]): string[] {
  return columnData.map((value) => {
    if (isExcelDateSerial(value)) {
      try {
        const jsDate = excelDateToJSDate(value as number);
        return jsDate.toISOString().split("T")[0];
      } catch {
        return String(value);
      }
    }
    return String(value);
  });
}

/**
 * Determines if a file is an Excel file based on its extension.
 */
export function isExcelFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split(".").pop();
  return EXCEL_EXTENSIONS.includes(
    extension as (typeof EXCEL_EXTENSIONS)[number]
  );
}
