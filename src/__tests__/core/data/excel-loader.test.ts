import {
  isExcelFile,
  excelDateToJSDate,
  isExcelDateSerial,
  convertColumnDates,
} from "../../../core/data/loaders/excel-loader";

describe("Excel Loader", () => {
  describe("isExcelFile", () => {
    it("should return true for Excel file extensions", () => {
      expect(isExcelFile("test.xlsx")).toBe(true);
      expect(isExcelFile("test.xls")).toBe(true);
      expect(isExcelFile("TEST.XLSX")).toBe(true);
      expect(isExcelFile("data/file.xlsx")).toBe(true);
    });

    it("should return false for non-Excel file extensions", () => {
      expect(isExcelFile("test.csv")).toBe(false);
      expect(isExcelFile("test.txt")).toBe(false);
      expect(isExcelFile("test.pdf")).toBe(false);
      expect(isExcelFile("test")).toBe(false);
    });
  });

  describe("isExcelDateSerial", () => {
    it("should return true for valid Excel date serial numbers", () => {
      expect(isExcelDateSerial(45565)).toBe(true); // 2024-09-30
      expect(isExcelDateSerial(44927)).toBe(true); // 2022-12-31
      expect(isExcelDateSerial(25569)).toBe(true); // 1970-01-01
    });

    it("should return false for invalid Excel date serial numbers", () => {
      expect(isExcelDateSerial(0)).toBe(false);
      expect(isExcelDateSerial(1)).toBe(false);
      expect(isExcelDateSerial(-1)).toBe(false);
      expect(isExcelDateSerial(2958467)).toBe(false); // Beyond Excel range
    });

    it("should return false for non-numeric values", () => {
      expect(isExcelDateSerial("45565")).toBe(false);
      expect(isExcelDateSerial(null)).toBe(false);
      expect(isExcelDateSerial(undefined)).toBe(false);
      expect(isExcelDateSerial("2024-09-30")).toBe(false);
    });
  });

  describe("excelDateToJSDate", () => {
    it("should convert Excel date serials to JavaScript dates", () => {
      // Test with a known Excel serial number
      const date1 = excelDateToJSDate(45565);
      expect(date1).toBeInstanceOf(Date);
      expect(date1.getFullYear()).toBeGreaterThan(2020);
      
      // Test another known Excel serial
      const date2 = excelDateToJSDate(44927);
      expect(date2).toBeInstanceOf(Date);
      expect(date2.getFullYear()).toBeGreaterThan(2020);
      
      // Test that different serials produce different dates
      expect(date1.getTime()).not.toBe(date2.getTime());
    });
  });

  describe("convertColumnDates", () => {
    it("should convert Excel date serials in a column to ISO date strings", () => {
      const columnData = [45565, 44927, "text", null, 45566];
      const result = convertColumnDates(columnData);
      
      // Test that Excel serials are converted to valid ISO date strings
      expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result[2]).toBe("text");
      expect(result[3]).toBe("null");
      expect(result[4]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Test that consecutive dates are different
      expect(result[0]).not.toBe(result[4]);
    });

    it("should handle empty arrays", () => {
      expect(convertColumnDates([])).toEqual([]);
    });

    it("should handle arrays with no date serials", () => {
      const columnData = ["text", null, 0, -1];
      const result = convertColumnDates(columnData);
      
      expect(result).toEqual(["text", "null", "0", "-1"]);
    });
  });
});