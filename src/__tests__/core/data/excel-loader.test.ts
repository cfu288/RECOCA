import {
  isExcelFile,
  excelDateToJSDate,
  isExcelDateSerial,
  convertColumnDates,
  getExcelFileInfo,
  convertSheetToJSON,
} from "../../../core/data/loaders/excel-loader";
import * as XLSX from 'xlsx';

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

  describe("getExcelFileInfo", () => {
    // Mock XLSX.read to avoid actual file operations
    const mockWorkbook = {
      SheetNames: ['Sheet1', 'Sheet2', 'Data'],
      Sheets: {
        'Sheet1': {
          '!ref': 'A1:C10',
          'A1': { v: 'Header1' },
          'B1': { v: 'Header2' },
          'C1': { v: 'Header3' },
        },
        'Sheet2': {
          '!ref': 'A1:E5',
          'A1': { v: 'Col1' },
        },
        'Data': {
          '!ref': 'A1:B100',
          'A1': { v: 'ID' },
          'B1': { v: 'Value' },
        }
      }
    };

    beforeEach(() => {
      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should extract sheet information from Excel file", () => {
      const mockBuffer = Buffer.from('mock');
      const result = getExcelFileInfo(mockBuffer);

      expect(result.sheetNames).toEqual(['Sheet1', 'Sheet2', 'Data']);
      expect(result.sheets).toHaveLength(3);
      
      expect(result.sheets[0]).toEqual({
        name: 'Sheet1',
        rowCount: 10,
        columnCount: 3
      });
      
      expect(result.sheets[1]).toEqual({
        name: 'Sheet2',
        rowCount: 5,
        columnCount: 5
      });
      
      expect(result.sheets[2]).toEqual({
        name: 'Data',
        rowCount: 100,
        columnCount: 2
      });
    });

    it("should handle Excel files with empty sheets", () => {
      const emptyWorkbook = {
        SheetNames: ['Empty'],
        Sheets: {
          'Empty': {
            '!ref': undefined
          }
        }
      };
      
      jest.spyOn(XLSX, 'read').mockReturnValue(emptyWorkbook as any);
      
      const mockBuffer = Buffer.from('mock');
      const result = getExcelFileInfo(mockBuffer);

      expect(result.sheets[0]).toEqual({
        name: 'Empty',
        rowCount: 1,
        columnCount: 1
      });
    });

    it("should handle Excel files with single cell", () => {
      const singleCellWorkbook = {
        SheetNames: ['SingleCell'],
        Sheets: {
          'SingleCell': {
            '!ref': 'A1:A1'
          }
        }
      };
      
      jest.spyOn(XLSX, 'read').mockReturnValue(singleCellWorkbook as any);
      
      const mockBuffer = Buffer.from('mock');
      const result = getExcelFileInfo(mockBuffer);

      expect(result.sheets[0]).toEqual({
        name: 'SingleCell',
        rowCount: 1,
        columnCount: 1
      });
    });
  });

  describe("convertSheetToJSON", () => {
    const mockWorkbook = {
      SheetNames: ['TestSheet', 'DataSheet'],
      Sheets: {
        'TestSheet': {
          'A1': { v: 'Name' },
          'B1': { v: 'Age' },
          'C1': { v: 'Date' },
          'A2': { v: 'John' },
          'B2': { v: 30 },
          'C2': { v: 45565 }, // Excel date serial
          'A3': { v: 'Jane' },
          'B3': { v: 25 },
          'C3': { v: 45566 },
        },
        'DataSheet': {
          'A1': { v: 'ID' },
          'B1': { v: 'Value' },
          'A2': { v: 1 },
          'B2': { v: 100 },
        }
      }
    };

    const mockSheetToJson = jest.fn();

    beforeEach(() => {
      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockImplementation(mockSheetToJson);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should convert a specific sheet to JSON", () => {
      const expectedData = [
        { Name: 'John', Age: 30, Date: 45565 },
        { Name: 'Jane', Age: 25, Date: 45566 }
      ];
      
      mockSheetToJson.mockReturnValue(expectedData);
      
      const mockBuffer = Buffer.from('mock');
      const result = convertSheetToJSON(mockBuffer, 'TestSheet');

      expect(XLSX.read).toHaveBeenCalledWith(mockBuffer, { type: 'buffer', cellDates: false });
      expect(mockSheetToJson).toHaveBeenCalledWith(mockWorkbook.Sheets['TestSheet']);
      expect(result).toEqual(expectedData);
    });

    it("should throw error for non-existent sheet", () => {
      const mockBuffer = Buffer.from('mock');
      
      expect(() => {
        convertSheetToJSON(mockBuffer, 'NonExistentSheet');
      }).toThrow('Sheet "NonExistentSheet" not found in workbook');
    });

    it("should handle empty sheet conversion", () => {
      const emptyWorkbook = {
        SheetNames: ['EmptySheet'],
        Sheets: {
          'EmptySheet': {}
        }
      };
      
      jest.spyOn(XLSX, 'read').mockReturnValue(emptyWorkbook as any);
      mockSheetToJson.mockReturnValue([]);
      
      const mockBuffer = Buffer.from('mock');
      const result = convertSheetToJSON(mockBuffer, 'EmptySheet');

      expect(result).toEqual([]);
    });

    it("should preserve data types during conversion", () => {
      const mixedData = [
        { Text: 'Hello', Number: 123, Boolean: true, Date: 45565, Null: null }
      ];
      
      mockSheetToJson.mockReturnValue(mixedData);
      
      const mockBuffer = Buffer.from('mock');
      const result = convertSheetToJSON(mockBuffer, 'TestSheet');

      expect(result).toEqual(mixedData);
      expect(typeof result[0].Number).toBe('number');
      expect(typeof result[0].Boolean).toBe('boolean');
    });
  });
});