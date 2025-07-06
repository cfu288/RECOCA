import { ExcelSheet } from "../../../core/data/loaders/excel-loader";

export const TestFactories = {
  mockExcelFile: (name = "test.xlsx") =>
    new File([""], name, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),

  mockCsvFile: (name = "test.csv") =>
    new File([""], name, {
      type: "text/csv",
    }),

  mockSheets: (count = 2): ExcelSheet[] =>
    Array.from({ length: count }, (_, i) => ({
      name: `Sheet${i + 1}`,
      rowCount: (i + 1) * 100,
      columnCount: (i + 1) * 10,
    })),

  mockArrayBuffer: (size = 100) => new ArrayBuffer(size),
};
