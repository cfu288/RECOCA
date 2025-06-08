import { isExcelFile } from "../../../core/data/loaders/excel-loader";
import { FileReaderService } from "./file-reader-service";
import { FileProcessingResult } from "../types";
import { ProcessingStatus } from "../../../app/app";

export class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "FileProcessingError";
  }
}

export class FileProcessor {
  static async processFile(
    file: File,
    selectedSheet?: string,
    cachedBuffer?: ArrayBuffer
  ): Promise<{
    result: FileProcessingResult;
    fileContents: string | ArrayBuffer;
  }> {
    try {
      const fileContents = await this.readFileContents(
        file,
        selectedSheet,
        cachedBuffer
      );

      const result = await window.electron.handleNewFile(
        fileContents,
        file.name,
        selectedSheet
      );

      if (result.success && result.filePath) {
        await this.saveToRecentFiles(file, fileContents, result.filePath);
      }

      return { result, fileContents };
    } catch (error) {
      if (error instanceof FileProcessingError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new FileProcessingError(error.message, "PROCESSING_ERROR", error);
      }

      throw new FileProcessingError(
        "An unexpected error occurred",
        "UNKNOWN_ERROR",
        error
      );
    }
  }

  private static async readFileContents(
    file: File,
    selectedSheet?: string,
    cachedBuffer?: ArrayBuffer
  ): Promise<string | ArrayBuffer> {
    if (isExcelFile(file.name)) {
      if (selectedSheet && cachedBuffer) {
        return cachedBuffer;
      }
      return FileReaderService.readAsArrayBuffer(file);
    }

    return FileReaderService.readAsText(file);
  }

  private static async saveToRecentFiles(
    file: File,
    fileContents: string | ArrayBuffer,
    filePath: string
  ): Promise<void> {
    try {
      await window.electron.addRecentFile({
        name: file.name,
        path: filePath,
        size: FileReaderService.isArrayBuffer(fileContents)
          ? fileContents.byteLength
          : fileContents.length,
      });
    } catch (error) {
      console.error("Failed to save to recent files:", error);
    }
  }

  static createProcessingStatus(
    result: FileProcessingResult,
    error?: FileProcessingError
  ): ProcessingStatus {
    if (error) {
      return {
        status: "error",
        message: this.getErrorMessage(error),
      };
    }

    return {
      status: result.success ? "uploaded" : "error",
      message: result.message,
      columns: result.columns,
      previews: result.previews,
    };
  }

  private static getErrorMessage(error: FileProcessingError): string {
    switch (error.code) {
      case "INVALID_FORMAT":
        return "Invalid file format. Please select a CSV or Excel file.";
      case "EMPTY_FILE":
        return "The selected file is empty.";
      default:
        return error.message || "An error occurred while processing the file.";
    }
  }
}
