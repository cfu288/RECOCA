export interface FileProcessingResult {
  success: boolean;
  message: string;
  columns?: string[];
  previews?: Record<string, string[]>;
  filePath?: string;
  isExcel?: boolean;
  sheets?: Array<{ name: string; rowCount: number; columnCount: number }>;
}
