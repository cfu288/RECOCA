import * as React from "react";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";
import { RecentFiles } from "./RecentFiles";
import { SheetSelector } from "./SheetSelector";
import { FileUploadCard } from "./FileUploadCard";
import { FileUploadHeader } from "./FileUploadHeader";
import { SheetSelectorSkeleton } from "./SheetSelectorSkeleton";
import { ProcessingStatus } from "../../../app/app";
import { isExcelFile } from "../../../core/data/loaders/excel-loader";
import {
  fileUploadReducer,
  INITIAL_FILE_UPLOAD_STATE,
} from "../utils/file-upload-reducer";
import { isValidFileType } from "../utils/file-upload-helpers";
import { FileReaderService } from "../services/file-reader-service";
import { FileProcessor, FileProcessingError } from "../services/file-processor";
import { useFileUploadContext } from "../contexts/FileUploadContext";

export const UploadFileScreen: React.FC<{
  fileProcessingStatus?: ProcessingStatus;
}> = ({ fileProcessingStatus = { status: "pending" } }) => {
  const { onScreenChange, onProcessingComplete } = useFileUploadContext();
  const { activeFile, setActiveFile } = useActiveFile();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [state, dispatch] = React.useReducer(fileUploadReducer, {
    ...INITIAL_FILE_UPLOAD_STATE,
    processingStatus: fileProcessingStatus,
  });

  const {
    processingStatus,
    showSheetSelector,
    excelSheets,
    pendingFile,
    cachedFileContents,
  } = state;

  React.useEffect(() => {
    dispatch({ type: "SYNC_STATUS", payload: fileProcessingStatus });
  }, [fileProcessingStatus]);

  const processFile = async (file: File, selectedSheet?: string) => {
    dispatch({ type: "START" });

    try {
      const { result, fileContents } = await FileProcessor.processFile(
        file,
        selectedSheet,
        cachedFileContents || undefined
      );

      if (
        result.isExcel &&
        result.sheets &&
        FileReaderService.isArrayBuffer(fileContents)
      ) {
        dispatch({
          type: "EXCEL_DETECTED",
          payload: { sheets: result.sheets, file, buffer: fileContents },
        });
        return;
      }

      const status = FileProcessor.createProcessingStatus(result);
      dispatch({
        type: result.success ? "SUCCESS" : "ERROR",
        payload: status,
      });

      if (result.success && result.columns) {
        onProcessingComplete?.(status);
        onScreenChange?.("column-mapping");
      }
    } catch (error) {
      const processingError =
        error instanceof FileProcessingError
          ? error
          : new FileProcessingError(
              "An unexpected error occurred",
              "UNKNOWN_ERROR",
              error
            );

      const status = FileProcessor.createProcessingStatus(
        { success: false, message: processingError.message },
        processingError
      );

      dispatch({ type: "ERROR", payload: status });
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
      setActiveFile({
        name: file.name,
        file: file,
        size: file.size,
      });

      processFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    setActiveFile(null);
    dispatch({ type: "RESET" });
  };

  const handleSheetSelect = async (sheetName: string) => {
    dispatch({ type: "SHEET_SELECTED" });
    if (pendingFile) {
      await processFile(pendingFile, sheetName);
    }
  };

  const handleSheetSelectorCancel = () => {
    dispatch({ type: "RESET" });
    setActiveFile(null);
  };

  const handleRecentFileSelect = async (file: File) => {
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

      {processingStatus.status === "processing" &&
        activeFile &&
        isExcelFile(activeFile.name) &&
        !showSheetSelector && <SheetSelectorSkeleton />}

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
