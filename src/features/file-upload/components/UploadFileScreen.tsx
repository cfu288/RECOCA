import * as React from "react";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";
import { Button } from "../../../shared/components/ui/button";
import { Card, CardContent } from "../../../shared/components/ui/card";

import { X } from "lucide-react";
import { RecentFiles } from "./RecentFiles";
import { Screens, ProcessingStatus } from "../../../app/app";

export const UploadFileScreen: React.FC<{
  onScreenChange?: (screen: Screens) => void;
  onProcessingComplete?: (status: ProcessingStatus) => void;
  fileProcessingStatus?: ProcessingStatus;
}> = ({
  onScreenChange,
  onProcessingComplete,
  fileProcessingStatus = { status: "pending" },
}) => {
  const { activeFile, setActiveFile } = useActiveFile();
  const [processingStatus, setProcessingStatus] =
    React.useState<ProcessingStatus>(fileProcessingStatus);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (activeFile && processingStatus.status === "pending") {
      setProcessingStatus({
        status: "uploaded",
        columns: processingStatus.columns,
        previews: processingStatus.previews,
      });
    }
  }, [activeFile]);

  React.useEffect(() => {
    setProcessingStatus(fileProcessingStatus);
  }, [fileProcessingStatus]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const processFile = async (file: File) => {
    try {
      // Update status to processing
      setProcessingStatus({ status: "processing" });

      console.log("Sending file for processing:", {
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        type: file.type,
      });

      const fileContents = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

      console.log("File contents size:", fileContents.length, "bytes");

      const result = await window.electron.handleNewFile(
        fileContents,
        file.name
      );

      if (result.success) {
        await window.electron.addRecentFile({
          name: file.name,
          path: result.filePath,
          size: fileContents.length, // Use the actual content size in bytes
        });
      }

      console.log(result);

      // Update status based on result
      const newStatus: ProcessingStatus = {
        status: result.success ? "uploaded" : "error",
        message: result.message,
        columns: result.columns,
        previews: result.previews,
      };
      setProcessingStatus(newStatus);

      // If processing was successful and we have columns, move to column mapping screen
      if (result.success && result.columns) {
        if (onProcessingComplete) {
          onProcessingComplete(newStatus);
        }
        if (onScreenChange) {
          onScreenChange("column-mapping");
        }
      }
    } catch (error) {
      console.error("Error in processFile:", error);
      setProcessingStatus({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      console.log("Selected file:", {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
      });

      setActiveFile({
        name: file.name,
        file: file,
        size: file.size,
      });

      setProcessingStatus({ status: "pending" });

      processFile(file);
    } else {
      console.log("Please select a CSV file");
    }

    // Reset the file input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    setActiveFile(null);
    setProcessingStatus({ status: "pending" });
  };

  const getStatusColor = (status: typeof processingStatus.status) => {
    switch (status) {
      case "pending":
        return "text-yellow-600";
      case "processing":
        return "text-blue-600";
      case "uploaded":
        return "text-green-600";
      case "processed":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = () => {
    switch (processingStatus.status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing...";
      case "uploaded":
        return "Uploaded";
      case "processed":
        return processingStatus.message || "Processed";
      case "error":
        return processingStatus.message || "Error";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Recoca</h1>
      <div className="space-y-4">
        <p className="text-gray-600">
          Recoca (Resident Continuity of Care App) is an open-source toolkit for
          calculating continuity of care metrics for resident primary care or
          outpatient clinics.
        </p>
        <p className="text-gray-600">
          To get started, upload a CSV with your clinic's appointment data. The
          CSV should contain data related to an appointment including:
          <ul className="list-disc list-inside">
            <li>The date of the appointment</li>
            <li>The patient seen during this appointment</li>
            <li>The provider who saw the patient</li>
          </ul>
        </p>
      </div>
      <Card className="rounded-lg">
        <CardContent className="p-8">
          {!activeFile ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <p className="text-lg text-gray-600 m-0 text-center">
                Upload a CSV file to get started
              </p>
              <Button onClick={handleFileSelect} variant="default">
                Select File
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activeFile.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-gray-500">
                      {formatFileSize(activeFile.size)}
                    </p>
                    <span className="text-gray-300">•</span>
                    <p
                      className={`text-sm ${getStatusColor(
                        processingStatus.status
                      )}`}
                    >
                      {getStatusText()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  disabled={processingStatus.status === "processing"}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!activeFile && <RecentFiles onFileSelect={processFile} />}
    </div>
  );
};
