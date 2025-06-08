import { isExcelFile } from "../../../core/data/loaders/excel-loader";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const isValidFileType = (file: File): boolean => {
  return (
    isExcelFile(file.name) ||
    file.type === "text/csv" ||
    file.name.toLowerCase().endsWith(".csv")
  );
};

const STATUS_CONFIG = {
  pending: { color: "text-yellow-600", text: "Pending" },
  processing: { color: "text-blue-600", text: "Processing..." },
  uploaded: { color: "text-green-600", text: "Uploaded" },
  processed: { color: "text-green-600", text: "Processed" },
  error: { color: "text-red-600", text: "Error" },
} as const;

export const getStatusColor = (status: string): string => {
  return (
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color ||
    "text-gray-600"
  );
};

export const getStatusText = (status: string, message?: string): string => {
  if (status === "processed" || status === "error") {
    return (
      message || STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.text || ""
    );
  }
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.text || "";
};
