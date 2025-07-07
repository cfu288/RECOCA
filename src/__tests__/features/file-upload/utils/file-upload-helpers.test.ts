import {
  formatFileSize,
  isValidFileType,
  getStatusColor,
  getStatusText,
} from "../../../../features/file-upload/utils/file-upload-helpers";

describe("formatFileSize", () => {
  it("should format zero bytes correctly", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
  });

  it("should format bytes correctly", () => {
    expect(formatFileSize(100)).toBe("100 Bytes");
    expect(formatFileSize(1023)).toBe("1023 Bytes");
  });

  it("should format kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(5242880)).toBe("5 MB");
    expect(formatFileSize(11570779)).toBe("11.03 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
    expect(formatFileSize(2147483648)).toBe("2 GB");
  });
});

describe("isValidFileType", () => {
  // Mock File objects for Node.js environment
  const createMockFile = (name: string, type: string) => ({
    name,
    type,
  } as File);

  it("should accept CSV files", () => {
    const csvFile = createMockFile("test.csv", "text/csv");
    expect(isValidFileType(csvFile)).toBe(true);
  });

  it("should accept CSV files by extension even with wrong mime type", () => {
    const csvFile = createMockFile("test.csv", "application/octet-stream");
    expect(isValidFileType(csvFile)).toBe(true);
  });

  it("should accept Excel files (.xlsx)", () => {
    const xlsxFile = createMockFile(
      "test.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(isValidFileType(xlsxFile)).toBe(true);
  });

  it("should accept Excel files (.xls)", () => {
    const xlsFile = createMockFile("test.xls", "application/vnd.ms-excel");
    expect(isValidFileType(xlsFile)).toBe(true);
  });

  it("should accept files with uppercase extensions", () => {
    const upperFile = createMockFile("TEST.CSV", "text/csv");
    expect(isValidFileType(upperFile)).toBe(true);
  });

  it("should reject invalid file types", () => {
    const txtFile = createMockFile("test.txt", "text/plain");
    const pdfFile = createMockFile("test.pdf", "application/pdf");

    expect(isValidFileType(txtFile)).toBe(false);
    expect(isValidFileType(pdfFile)).toBe(false);
  });
});

describe("getStatusText", () => {
  it("should return correct text for each status", () => {
    expect(getStatusText("pending")).toBe("Pending");
    expect(getStatusText("processing")).toBe("Processing...");
    expect(getStatusText("uploaded")).toBe("Uploaded");
  });

  it("should use custom message for processed status", () => {
    expect(getStatusText("processed")).toBe("Processed");
    expect(getStatusText("processed", "Custom message")).toBe("Custom message");
  });

  it("should use custom message for error status", () => {
    expect(getStatusText("error")).toBe("Error");
    expect(getStatusText("error", "File too large")).toBe("File too large");
  });

  it("should return empty string for unknown status", () => {
    expect(getStatusText("unknown")).toBe("");
    expect(getStatusText("")).toBe("");
  });
});
