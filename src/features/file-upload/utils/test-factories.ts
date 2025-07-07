import { ExcelSheet } from "../../../core/data/loaders/excel-loader";

// Create a proper File-like object that works in Node.js
class MockFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  
  constructor(bits: any[], name: string, options?: { type?: string; lastModified?: number }) {
    this.name = name;
    this.type = options?.type || '';
    this.size = bits.reduce((acc, bit) => acc + (bit?.length || 0), 0);
    this.lastModified = options?.lastModified || Date.now();
  }
  
  // Add minimal File API methods that might be used
  slice(start?: number, end?: number, contentType?: string): Blob {
    return {} as Blob;
  }
  
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text(): Promise<string> {
    return Promise.resolve('');
  }
  
  stream(): ReadableStream {
    return {} as ReadableStream;
  }
}

// Polyfill File for Node.js if it doesn't exist
if (typeof global !== 'undefined' && !global.File) {
  (global as any).File = MockFile;
}

export const TestFactories = {
  mockExcelFile: (name = "test.xlsx") =>
    new MockFile([""], name, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),

  mockCsvFile: (name = "test.csv") =>
    new MockFile([""], name, {
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
