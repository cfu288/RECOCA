import React from "react";
import { Button } from "../../../shared/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../shared/components/ui/card";
import { ScrollArea } from "../../../shared/components/ui/scroll-area";
import { X, Clock, FileText } from "lucide-react";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";

interface RecentFile {
  name: string;
  path: string;
  size: number;
  lastOpened: number;
  columnMapping?: any;
}

interface RecentFilesProps {
  onFileSelect: (file: File) => void;
}

export const RecentFiles: React.FC<RecentFilesProps> = ({ onFileSelect }) => {
  const [recentFiles, setRecentFiles] = React.useState<RecentFile[]>([]);
  const { setActiveFile } = useActiveFile();

  const loadRecentFiles = async () => {
    try {
      const files = await window.electron.getRecentFiles();
      setRecentFiles(files);
    } catch (error) {
      console.error("Error loading recent files:", error);
    }
  };

  React.useEffect(() => {
    loadRecentFiles();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRemoveFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      console.log("Removing file from recent files:", filePath);
      const updatedFiles = await window.electron.removeRecentFile(filePath);
      setRecentFiles(updatedFiles);
    } catch (error) {
      console.error("Error removing file:", error);
    }
  };

  const handleFileSelect = async (recentFile: RecentFile) => {
    try {
      console.log("Attempting to load file:", recentFile);
      console.log(
        "File size from recent file:",
        recentFile.size,
        formatFileSize(recentFile.size)
      );

      if (!recentFile.path) {
        console.error("No file path provided");
        await window.electron.removeRecentFile(recentFile.path);
        setRecentFiles((prev) =>
          prev.filter((f) => f.path !== recentFile.path)
        );
        return;
      }

      const fileExists = await window.electron.checkFileExists(recentFile.path);
      if (!fileExists) {
        console.error("File no longer exists:", recentFile.path);
        await window.electron.removeRecentFile(recentFile.path);
        setRecentFiles((prev) =>
          prev.filter((f) => f.path !== recentFile.path)
        );
        return;
      }

      const fileContents = await window.electron.readLocalFile(recentFile.path);
      console.log("File contents size:", fileContents.length, "bytes");

      const file = new File([fileContents], recentFile.name, {
        type: "text/csv",
      });

      console.log(
        "Created File object size:",
        file.size,
        formatFileSize(file.size)
      );

      await window.electron.addRecentFile({
        name: recentFile.name,
        path: recentFile.path,
        size: file.size, // Use the actual file size from the File object
      });

      // Get column mapping if it exists
      const columnMapping = recentFile.columnMapping;
      // Check if the electron API has the getColumnMapping method
      if (!recentFile.columnMapping && "getColumnMapping" in window.electron) {
        try {
          const mapping = await (window.electron as any).getColumnMapping(
            recentFile.name
          );
          if (mapping) {
            console.log("Retrieved column mapping:", mapping);
            setRecentFiles((prev) =>
              prev.map((f) =>
                f.path === recentFile.path
                  ? { ...f, columnMapping: mapping }
                  : f
              )
            );
          }
        } catch (e) {
          console.error("Error getting column mapping:", e);
        }
      }

      setActiveFile({
        name: recentFile.name,
        file: file,
        size: file.size,
        columnMapping: columnMapping,
      });

      onFileSelect(file);
    } catch (error) {
      console.error("Error loading file:", error);
    }
  };

  if (recentFiles.length === 0) {
    return null;
  }

  return (
    <div className="pt-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {recentFiles.map((file) => (
              <div
                key={file.path}
                className="group flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleFileSelect(file)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.lastOpened)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={(e) => handleRemoveFile(file.path, e)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </div>
  );
};
