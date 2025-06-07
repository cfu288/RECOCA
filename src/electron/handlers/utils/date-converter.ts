import { isExcelDateSerial, excelDateToJSDate } from "../../../core/data/loaders/excel-loader";

/**
 * Converts a value that may be an Excel date serial number to an ISO date string
 * 
 * @param value - Value that may be an Excel date serial or string
 * @returns ISO date string or string representation of the value
 */
export function convertValueToDateString(value: unknown): string {
  if (isExcelDateSerial(value)) {
    try {
      const jsDate = excelDateToJSDate(value as number);
      return jsDate.toISOString().split('T')[0];
    } catch {
      return String(value);
    }
  }
  return String(value);
}