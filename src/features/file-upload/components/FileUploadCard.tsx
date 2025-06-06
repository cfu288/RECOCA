import * as React from "react";
import { Card, CardContent } from "../../../shared/components/ui/card";
import { Button } from "../../../shared/components/ui/button";
import { X } from "lucide-react";
import { formatFileSize, getStatusColor, getStatusText } from "../utils/file-upload-helpers";
import { ProcessingStatus } from "../../../app/app";

interface FileUploadCardProps {
  activeFile: {
    name: string;
    size: number;
  } | null;
  processingStatus: ProcessingStatus;
  onFileSelect: () => void;
  onFileRemove: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Card component that displays file upload status and controls
 */
export const FileUploadCard: React.FC<FileUploadCardProps> = ({
  activeFile,
  processingStatus,
  onFileSelect,
  onFileRemove,
  fileInputRef,
  onFileInputChange,
}) => {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-8">
        {!activeFile ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <p className="text-lg text-gray-600 m-0 text-center">
              Upload a CSV or Excel file to get started
            </p>
            <Button onClick={onFileSelect} variant="default">
              Select File
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,text/csv,.xlsx,.xls"
              onChange={onFileInputChange}
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
                    {getStatusText(processingStatus.status, processingStatus.message)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onFileRemove}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};