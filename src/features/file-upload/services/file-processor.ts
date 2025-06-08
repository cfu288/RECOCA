import { isExcelFile } from '../../../core/data/loaders/excel-loader';
import { FileReaderService } from './file-reader-service';
import { FileProcessingResult } from '../types';
import { ProcessingStatus } from '../../../app/app';

export class FileProcessingError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

export class FileProcessor {
  /**
   * Process a file and return the result
   */
  static async processFile(
    file: File,
    selectedSheet?: string,
    cachedBuffer?: ArrayBuffer
  ): Promise<{
    result: FileProcessingResult;
    fileContents: string | ArrayBuffer;
  }> {
    try {
      // Read file contents
      const fileContents = await this.readFileContents(file, selectedSheet, cachedBuffer);
      
      // Validate file size
      const sizeInBytes = FileReaderService.isArrayBuffer(fileContents) 
        ? fileContents.byteLength 
        : fileContents.length;
      
      if (sizeInBytes > 100 * 1024 * 1024) { // 100MB limit
        throw new FileProcessingError(
          'File size exceeds 100MB limit',
          'FILE_TOO_LARGE',
          { size: sizeInBytes }
        );
      }

      // Send to backend
      const result = await window.electron.handleNewFile(
        fileContents,
        file.name,
        selectedSheet
      );

      // Save to recent files if successful
      if (result.success && result.filePath) {
        await this.saveToRecentFiles(file, fileContents, result.filePath);
      }

      return { result, fileContents };
    } catch (error) {
      // Transform errors into consistent format
      if (error instanceof FileProcessingError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new FileProcessingError(
          error.message,
          'PROCESSING_ERROR',
          error
        );
      }
      
      throw new FileProcessingError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Read file contents with caching support for Excel files
   */
  private static async readFileContents(
    file: File,
    selectedSheet?: string,
    cachedBuffer?: ArrayBuffer
  ): Promise<string | ArrayBuffer> {
    if (isExcelFile(file.name)) {
      // Use cached buffer if processing sheet selection
      if (selectedSheet && cachedBuffer) {
        return cachedBuffer;
      }
      return FileReaderService.readAsArrayBuffer(file);
    }
    
    return FileReaderService.readAsText(file);
  }

  /**
   * Save file to recent files list
   */
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
      // Non-critical error - log but don't throw
      console.error('Failed to save to recent files:', error);
    }
  }

  /**
   * Create a ProcessingStatus object from a FileProcessingResult
   */
  static createProcessingStatus(
    result: FileProcessingResult,
    error?: FileProcessingError
  ): ProcessingStatus {
    if (error) {
      return {
        status: 'error',
        message: this.getErrorMessage(error),
      };
    }

    return {
      status: result.success ? 'uploaded' : 'error',
      message: result.message,
      columns: result.columns,
      previews: result.previews,
    };
  }

  /**
   * Get user-friendly error message
   */
  private static getErrorMessage(error: FileProcessingError): string {
    switch (error.code) {
      case 'FILE_TOO_LARGE':
        return 'File is too large. Please select a file under 100MB.';
      case 'INVALID_FORMAT':
        return 'Invalid file format. Please select a CSV or Excel file.';
      case 'EMPTY_FILE':
        return 'The selected file is empty.';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection and try again.';
      case 'PERMISSION_DENIED':
        return 'Permission denied. Please check file permissions.';
      default:
        return error.message || 'An error occurred while processing the file.';
    }
  }
}