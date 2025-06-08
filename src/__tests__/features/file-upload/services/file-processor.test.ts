import {
  FileProcessor,
  FileProcessingError,
} from "../../../../features/file-upload/services/file-processor";
import { FileReaderService } from "../../../../features/file-upload/services/file-reader-service";
import { TestFactories } from "../../../../features/file-upload/utils/test-factories";

// Mock dependencies
jest.mock("../../../../features/file-upload/services/file-reader-service");
jest.mock("../../../../core/data/loaders/excel-loader", () => ({
  isExcelFile: jest.fn(
    (name: string) => name.endsWith(".xlsx") || name.endsWith(".xls")
  ),
}));

// Mock window.electron
const mockElectron = {
  handleNewFile: jest.fn(),
  addRecentFile: jest.fn(),
};

(global as any).window = { electron: mockElectron };

describe("FileProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn(); // Silence console errors in tests
  });

  describe("processFile", () => {
    it("should process CSV file successfully", async () => {
      const mockFile = TestFactories.mockCsvFile();
      const mockFileContents = "csv,data\n1,2";
      const mockResult = {
        success: true,
        message: "File processed",
        columns: ["csv", "data"],
        filePath: "/tmp/test.csv",
      };

      (FileReaderService.readAsText as jest.Mock).mockResolvedValue(
        mockFileContents
      );
      (FileReaderService.isArrayBuffer as jest.Mock).mockReturnValue(false);
      mockElectron.handleNewFile.mockResolvedValue(mockResult);
      mockElectron.addRecentFile.mockResolvedValue(undefined);

      const result = await FileProcessor.processFile(mockFile);

      expect(result.result).toEqual(mockResult);
      expect(result.fileContents).toBe(mockFileContents);
      expect(FileReaderService.readAsText).toHaveBeenCalledWith(mockFile);
      expect(mockElectron.handleNewFile).toHaveBeenCalledWith(
        mockFileContents,
        mockFile.name,
        undefined
      );
      expect(mockElectron.addRecentFile).toHaveBeenCalledWith({
        name: mockFile.name,
        path: mockResult.filePath,
        size: mockFileContents.length,
      });
    });

    it("should process Excel file successfully", async () => {
      const mockFile = TestFactories.mockExcelFile();
      const mockBuffer = TestFactories.mockArrayBuffer();
      const mockResult = {
        success: true,
        message: "Excel file processed",
        isExcel: true,
        sheets: TestFactories.mockSheets(),
      };

      (FileReaderService.readAsArrayBuffer as jest.Mock).mockResolvedValue(
        mockBuffer
      );
      (FileReaderService.isArrayBuffer as jest.Mock).mockReturnValue(true);
      mockElectron.handleNewFile.mockResolvedValue(mockResult);

      const result = await FileProcessor.processFile(mockFile);

      expect(result.result).toEqual(mockResult);
      expect(result.fileContents).toBe(mockBuffer);
      expect(FileReaderService.readAsArrayBuffer).toHaveBeenCalledWith(
        mockFile
      );
    });

    it("should use cached buffer for Excel sheet selection", async () => {
      const mockFile = TestFactories.mockExcelFile();
      const cachedBuffer = TestFactories.mockArrayBuffer();
      const mockResult = {
        success: true,
        message: "Sheet processed",
        columns: ["A", "B"],
        filePath: "/tmp/test.xlsx",
      };

      (FileReaderService.isArrayBuffer as jest.Mock).mockReturnValue(true);
      mockElectron.handleNewFile.mockResolvedValue(mockResult);

      const result = await FileProcessor.processFile(
        mockFile,
        "Sheet1",
        cachedBuffer
      );

      expect(result.fileContents).toBe(cachedBuffer);
      expect(FileReaderService.readAsArrayBuffer).not.toHaveBeenCalled();
      expect(mockElectron.handleNewFile).toHaveBeenCalledWith(
        cachedBuffer,
        mockFile.name,
        "Sheet1"
      );
    });

    it("should handle backend processing errors", async () => {
      const mockFile = TestFactories.mockCsvFile();
      const mockError = new Error("Backend error");

      (FileReaderService.readAsText as jest.Mock).mockResolvedValue("data");
      mockElectron.handleNewFile.mockRejectedValue(mockError);

      await expect(FileProcessor.processFile(mockFile)).rejects.toThrow(
        FileProcessingError
      );

      await expect(FileProcessor.processFile(mockFile)).rejects.toMatchObject({
        code: "PROCESSING_ERROR",
        message: "Backend error",
      });
    });

    it("should continue processing if saving to recent files fails", async () => {
      const mockFile = TestFactories.mockCsvFile();
      const mockResult = {
        success: true,
        message: "Processed",
        filePath: "/tmp/test.csv",
      };

      (FileReaderService.readAsText as jest.Mock).mockResolvedValue("data");
      (FileReaderService.isArrayBuffer as jest.Mock).mockReturnValue(false);
      mockElectron.handleNewFile.mockResolvedValue(mockResult);
      mockElectron.addRecentFile.mockRejectedValue(new Error("Storage error"));

      const result = await FileProcessor.processFile(mockFile);

      expect(result.result).toEqual(mockResult);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to save to recent files:",
        expect.any(Error)
      );
    });
  });

  describe("createProcessingStatus", () => {
    it("should create success status", () => {
      const result = {
        success: true,
        message: "File uploaded",
        columns: ["A", "B"],
        previews: { A: ["1", "2"], B: ["3", "4"] },
      };

      const status = FileProcessor.createProcessingStatus(result);

      expect(status).toEqual({
        status: "uploaded",
        message: "File uploaded",
        columns: ["A", "B"],
        previews: { A: ["1", "2"], B: ["3", "4"] },
      });
    });

    it("should create error status from result", () => {
      const result = {
        success: false,
        message: "Invalid format",
      };

      const status = FileProcessor.createProcessingStatus(result);

      expect(status).toEqual({
        status: "error",
        message: "Invalid format",
      });
    });

    it("should create error status from FileProcessingError", () => {
      const error = new FileProcessingError("Invalid format", "INVALID_FORMAT");

      const status = FileProcessor.createProcessingStatus(
        { success: false, message: "" },
        error
      );

      expect(status).toEqual({
        status: "error",
        message: "Invalid file format. Please select a CSV or Excel file.",
      });
    });

    it("should handle various error codes", () => {
      const testCases = [
        {
          error: new FileProcessingError("", "INVALID_FORMAT"),
          expected: "Invalid file format. Please select a CSV or Excel file.",
        },
        {
          error: new FileProcessingError("", "EMPTY_FILE"),
          expected: "The selected file is empty.",
        },
        {
          error: new FileProcessingError("Custom message", "UNKNOWN"),
          expected: "Custom message",
        },
      ];

      testCases.forEach(({ error, expected }) => {
        const status = FileProcessor.createProcessingStatus(
          { success: false, message: "" },
          error
        );
        expect(status.message).toBe(expected);
      });
    });
  });
});
