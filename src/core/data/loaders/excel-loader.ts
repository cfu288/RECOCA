import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ExcelFileInfo {
  sheetNames: string[];
  sheets: ExcelSheet[];
}

const EXCEL_EXTENSIONS = ['xlsx', 'xls'] as const;
const EXCEL_DATE_MIN = 1;
const EXCEL_DATE_MAX = 2958466;
const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 86400 * 1000;

/**
 * Extracts metadata from an Excel file including sheet names and dimensions.
 * 
 * @param fileBuffer - Binary data of the Excel file
 * @returns Object containing sheet names and metadata for each sheet
 * @throws {Error} When the file cannot be parsed as Excel
 */
export function getExcelFileInfo(fileBuffer: Buffer): ExcelFileInfo {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const sheetNames = workbook.SheetNames;
  const sheets: ExcelSheet[] = [];
  
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    sheets.push({
      name: sheetName,
      rowCount: range.e.r + 1,
      columnCount: range.e.c + 1
    });
  }
  
  return {
    sheetNames,
    sheets
  };
}

/**
 * Converts Excel serial date number to JavaScript Date.
 * Excel stores dates as the number of days since January 1, 1900.
 * 
 * @param excelDate - Excel serial date number
 * @returns JavaScript Date object
 * @throws {Error} When the date conversion fails
 */
export function excelDateToJSDate(excelDate: number): Date {
  return new Date((excelDate - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
}

/**
 * Determines if a value is likely an Excel date serial number.
 * Excel date serials are positive numbers within a specific range.
 * 
 * @param value - Value to check
 * @returns True if the value appears to be an Excel date serial
 */
export function isExcelDateSerial(value: unknown): boolean {
  return typeof value === 'number' && value > EXCEL_DATE_MIN && value < EXCEL_DATE_MAX;
}

/**
 * Converts a specific Excel sheet to JSON format for data processing.
 * Optimized for performance by avoiding upfront date conversion.
 * 
 * @param fileBuffer - Binary Excel file data
 * @param sheetName - Name of the sheet to convert
 * @returns Array of objects representing sheet rows
 * @throws {Error} When the sheet cannot be found or converted
 */
export function convertSheetToJSON(fileBuffer: Buffer, sheetName: string): object[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
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
 * 
 * @param columnData - Array of column values that may contain Excel dates
 * @returns Array of string values with dates converted to ISO format
 */
export function convertColumnDates(columnData: unknown[]): string[] {
  return columnData.map(value => {
    if (isExcelDateSerial(value)) {
      try {
        const jsDate = excelDateToJSDate(value as number);
        return jsDate.toISOString().split('T')[0];
      } catch {
        return String(value);
      }
    }
    return String(value);
  });
}

/**
 * Determines if a file is an Excel file based on its extension.
 * 
 * @param fileName - Name of the file including extension
 * @returns True if the file has an Excel extension (.xlsx or .xls)
 */
export function isExcelFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop();
  return EXCEL_EXTENSIONS.includes(extension as typeof EXCEL_EXTENSIONS[number]);
}