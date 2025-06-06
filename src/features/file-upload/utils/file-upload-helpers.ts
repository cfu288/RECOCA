/**
 * Utility functions for file upload functionality
 */

/**
 * Formats file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Checks if a file is a valid upload type (CSV or Excel)
 */
export const isValidFileType = (file: File): boolean => {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
                  file.name.toLowerCase().endsWith('.xls');
  const isCsv = file.type === "text/csv" || 
                file.name.toLowerCase().endsWith(".csv");
  return isExcel || isCsv;
};

/**
 * Gets the appropriate status color class based on processing status
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "processing":
      return "text-blue-600";
    case "uploaded":
    case "processed":
      return "text-green-600";
    case "error":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

/**
 * Gets human-readable status text
 */
export const getStatusText = (status: string, message?: string): string => {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing...";
    case "uploaded":
      return "Uploaded";
    case "processed":
      return message || "Processed";
    case "error":
      return message || "Error";
    default:
      return "";
  }
};