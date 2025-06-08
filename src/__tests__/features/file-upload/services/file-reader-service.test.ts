import { FileReaderService } from '../../../../features/file-upload/services/file-reader-service';
import { TestFactories } from '../../../../features/file-upload/utils/test-factories';

describe('FileReaderService', () => {
  // Mock FileReader
  let mockFileReader: any;

  beforeEach(() => {
    mockFileReader = {
      readAsArrayBuffer: jest.fn(),
      readAsText: jest.fn(),
      result: null,
      error: null,
      onload: null,
      onerror: null,
    };

    (global as any).FileReader = jest.fn(() => mockFileReader);
  });

  describe('readAsArrayBuffer', () => {
    it('should read file as ArrayBuffer', async () => {
      const mockFile = TestFactories.mockExcelFile();
      const mockBuffer = TestFactories.mockArrayBuffer();

      mockFileReader.readAsArrayBuffer.mockImplementation(() => {
        mockFileReader.result = mockBuffer;
        mockFileReader.onload?.();
      });

      const result = await FileReaderService.readAsArrayBuffer(mockFile);

      expect(result).toBe(mockBuffer);
      expect(mockFileReader.readAsArrayBuffer).toHaveBeenCalledWith(mockFile);
    });

    it('should handle read errors', async () => {
      const mockFile = TestFactories.mockExcelFile();
      const mockError = new Error('Read failed');

      mockFileReader.readAsArrayBuffer.mockImplementation(() => {
        mockFileReader.error = mockError;
        mockFileReader.onerror?.();
      });

      await expect(FileReaderService.readAsArrayBuffer(mockFile))
        .rejects
        .toBe(mockError);
    });
  });

  describe('readAsText', () => {
    it('should read file as text', async () => {
      const mockFile = TestFactories.mockCsvFile();
      const mockText = 'col1,col2\nval1,val2';

      mockFileReader.readAsText.mockImplementation(() => {
        mockFileReader.result = mockText;
        mockFileReader.onload?.();
      });

      const result = await FileReaderService.readAsText(mockFile);

      expect(result).toBe(mockText);
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile);
    });

    it('should handle read errors', async () => {
      const mockFile = TestFactories.mockCsvFile();
      const mockError = new Error('Read failed');

      mockFileReader.readAsText.mockImplementation(() => {
        mockFileReader.error = mockError;
        mockFileReader.onerror?.();
      });

      await expect(FileReaderService.readAsText(mockFile))
        .rejects
        .toBe(mockError);
    });
  });

  describe('isArrayBuffer', () => {
    it('should correctly identify ArrayBuffer', () => {
      expect(FileReaderService.isArrayBuffer(new ArrayBuffer(10))).toBe(true);
      expect(FileReaderService.isArrayBuffer(TestFactories.mockArrayBuffer())).toBe(true);
    });

    it('should correctly identify non-ArrayBuffer values', () => {
      expect(FileReaderService.isArrayBuffer('string')).toBe(false);
      expect(FileReaderService.isArrayBuffer(123)).toBe(false);
      expect(FileReaderService.isArrayBuffer({})).toBe(false);
      expect(FileReaderService.isArrayBuffer([])).toBe(false);
      expect(FileReaderService.isArrayBuffer(null)).toBe(false);
      expect(FileReaderService.isArrayBuffer(undefined)).toBe(false);
      expect(FileReaderService.isArrayBuffer(new Uint8Array(10))).toBe(false);
    });
  });
});