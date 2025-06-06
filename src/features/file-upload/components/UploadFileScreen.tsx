import * as React from "react";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";
import { RecentFiles } from "./RecentFiles";
import { SheetSelector } from "./SheetSelector";
import { FileUploadCard } from "./FileUploadCard";
import { FileUploadHeader } from "./FileUploadHeader";
import { SheetSelectorSkeleton } from "./SheetSelectorSkeleton";
import { Screens, ProcessingStatus } from "../../../app/app";
import { isExcelFile } from "../../../core/data/loaders/excel-loader";
import { fileUploadReducer } from "../utils/file-upload-reducer";
import { formatFileSize, isValidFileType } from "../utils/file-upload-helpers";

/**
 * Main file upload screen component
 * Handles CSV and Excel file uploads with support for multi-sheet Excel files
 * @param onScreenChange - Callback to navigate to different screens
 * @param onProcessingComplete - Callback when file processing is complete
 * @param fileProcessingStatus - Initial processing status from parent
 */
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [state, dispatch] = React.useReducer(fileUploadReducer, {
    processingStatus: fileProcessingStatus,
    showSheetSelector: false,
    excelSheets: [],
    pendingFile: null,
    cachedFileContents: null,
  });

  const {
    processingStatus,
    showSheetSelector,
    excelSheets,
    pendingFile,
    cachedFileContents,
  } = state;
  
  console.debug('[UploadFileScreen] Current state:', {
    status: processingStatus.status,
    showSheetSelector,
    hasActiveFile: !!activeFile,
    activeFileName: activeFile?.name,
  });

  React.useEffect(() => {
    console.debug('[useEffect] activeFile changed:', {
      activeFile: activeFile?.name,
      currentStatus: processingStatus.status,
      isExcel: activeFile ? isExcelFile(activeFile.name) : false,
    });
  }, [activeFile]);

  React.useEffect(() => {
    dispatch({ type: "UPDATE_FROM_PROPS", payload: fileProcessingStatus });
  }, [fileProcessingStatus]);


  /**
   * Reads file contents based on file type (Excel or CSV)
   * Caches Excel file contents to avoid re-reading when selecting different sheets
   */
  const readFileContents = async (file: File, selectedSheet?: string): Promise<string | ArrayBuffer> => {
    if (isExcelFile(file.name)) {
      if (selectedSheet && cachedFileContents) {
        return cachedFileContents;
      }
      
      const contents = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
      
      if (!selectedSheet) {
        dispatch({ type: "SET_CACHED_CONTENTS", payload: contents });
      }
      return contents;
    }
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  /**
   * Saves processed file to recent files list for quick access
   */
  const saveFileToRecent = async (file: File, fileContents: string | ArrayBuffer, filePath: string) => {
    await window.electron.addRecentFile({
      name: file.name,
      path: filePath,
      size: typeof fileContents === "string" ? fileContents.length : fileContents.byteLength,
    });
  };

  /**
   * Processes the result from file handler and updates state accordingly
   * Handles both Excel files (with sheet selection) and regular CSV files
   */
  type FileProcessingResult = {
    success: boolean;
    message: string;
    columns?: string[];
    previews?: Record<string, string[]>;
    filePath?: string;
    isExcel?: boolean;
    sheets?: Array<{ name: string; rowCount: number; columnCount: number }>;
  };

  const handleProcessingResult = (result: FileProcessingResult, file: File) => {
    if (result.isExcel && result.sheets) {
      console.debug('[processFile] Excel file with sheets detected - keeping processing state');
      dispatch({
        type: "HANDLE_EXCEL_FILE",
        payload: { sheets: result.sheets, file },
      });
      return;
    }

    const newStatus: ProcessingStatus = {
      status: result.success ? "uploaded" : "error",
      message: result.message,
      columns: result.columns,
      previews: result.previews,
    };
    
    console.debug('[processFile] Setting completion status:', newStatus.status);
    dispatch({
      type: "COMPLETE_PROCESSING",
      payload: { status: newStatus, success: result.success },
    });

    if (result.success && result.columns) {
      if (onProcessingComplete) {
        onProcessingComplete(newStatus);
      }
      if (onScreenChange) {
        onScreenChange("column-mapping");
      }
    }
  };

  /**
   * Main file processing function that orchestrates file reading,
   * sending to backend, and handling the response
   */
  const processFile = async (file: File, selectedSheet?: string) => {
    console.debug('[processFile] Starting:', {
      fileName: file.name,
      selectedSheet,
      currentStatus: processingStatus.status,
      isExcel: isExcelFile(file.name),
    });
    
    try {
      console.debug('[processFile] Dispatching START_PROCESSING');
      dispatch({ type: "START_PROCESSING" });

      console.debug("Sending file for processing:", {
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        type: file.type,
        selectedSheet,
      });

      const fileContents = await readFileContents(file, selectedSheet);

      const result = await window.electron.handleNewFile(
        fileContents,
        file.name,
        selectedSheet
      );

      if (result.success && result.filePath) {
        await saveFileToRecent(file, fileContents, result.filePath);
      }

      console.debug('[processFile] Result received:', {
        success: result.success,
        isExcel: result.isExcel,
        hasSheets: !!result.sheets,
        columns: result.columns?.length,
      });

      handleProcessingResult(result, file);
    } catch (error) {
      console.error("Error in processFile:", error);
      dispatch({
        type: "COMPLETE_PROCESSING",
        payload: {
          status: {
            status: "error",
            message:
              error instanceof Error ? error.message : "Unknown error occurred",
          },
          success: false,
        },
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
    
    if (isValidFileType(file)) {
      console.debug('[handleFileInputChange] File selected:', {
        fileName: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        isExcel: isExcelFile(file.name),
        currentStatus: processingStatus.status,
      });
      
      setActiveFile({
        name: file.name,
        file: file,
        size: file.size,
      });

      processFile(file);
    } else {
      console.debug("Please select a CSV or Excel file");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    console.debug('[removeFile] Removing file');
    setActiveFile(null);
    dispatch({ type: "RESET_FILE_STATE" });
  };

  /**
   * Handles Excel sheet selection from the sheet selector dialog
   */
  const handleSheetSelect = async (sheetName: string) => {
    dispatch({ type: "SET_SHEET_SELECTOR", payload: { show: false } });
    if (pendingFile) {
      await processFile(pendingFile, sheetName);
    }
  };

  const handleSheetSelectorCancel = () => {
    dispatch({ type: "RESET_FILE_STATE" });
    setActiveFile(null);
  };

  /**
   * Handles file selection from the recent files list
   */
  const handleRecentFileSelect = async (file: File) => {
    console.debug('[RecentFiles] File selected:', {
      fileName: file.name,
      isExcel: isExcelFile(file.name),
      currentStatus: processingStatus.status,
    });
    
    setActiveFile({
      name: file.name,
      file: file,
      size: file.size,
    });
    
    await processFile(file);
  };


  return (
    <div className="space-y-8">
      <FileUploadHeader />
      
      <FileUploadCard
        activeFile={activeFile}
        processingStatus={processingStatus}
        onFileSelect={handleFileSelect}
        onFileRemove={removeFile}
        fileInputRef={fileInputRef}
        onFileInputChange={handleFileInputChange}
      />

      {processingStatus.status === "processing" && activeFile && isExcelFile(activeFile.name) && !showSheetSelector && (
        <SheetSelectorSkeleton />
      )}

      {showSheetSelector && (
        <SheetSelector
          sheets={excelSheets}
          onSheetSelect={handleSheetSelect}
          onCancel={handleSheetSelectorCancel}
        />
      )}

      {!activeFile && !showSheetSelector && (
        <RecentFiles onFileSelect={handleRecentFileSelect} />
      )}
    </div>
  );
};
