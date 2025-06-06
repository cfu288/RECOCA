import { ProcessingStatus } from "../../../app/app";
import { ExcelSheet } from "../../../core/data/loaders/excel-loader";

/**
 * State shape for the file upload component
 */
export interface FileUploadState {
  processingStatus: ProcessingStatus;
  showSheetSelector: boolean;
  excelSheets: ExcelSheet[];
  pendingFile: File | null;
  cachedFileContents: ArrayBuffer | null;
}

export type FileUploadAction =
  | { type: "SET_PROCESSING_STATUS"; payload: ProcessingStatus }
  | {
      type: "SET_SHEET_SELECTOR";
      payload: { show: boolean; sheets?: ExcelSheet[] };
    }
  | { type: "SET_PENDING_FILE"; payload: File | null }
  | { type: "SET_CACHED_CONTENTS"; payload: ArrayBuffer | null }
  | { type: "START_PROCESSING" }
  | {
      type: "COMPLETE_PROCESSING";
      payload: { status: ProcessingStatus; success: boolean };
    }
  | { type: "HANDLE_EXCEL_FILE"; payload: { sheets: ExcelSheet[]; file: File } }
  | { type: "RESET_FILE_STATE" }
  | { type: "UPDATE_FROM_PROPS"; payload: ProcessingStatus };

/**
 * Reducer function for managing file upload state transitions
 * Handles all state updates related to file processing, Excel sheet selection,
 * and upload status management
 */
export function fileUploadReducer(
  state: FileUploadState,
  action: FileUploadAction
): FileUploadState {
  console.debug('[Reducer]', action.type, {
    currentStatus: state.processingStatus.status,
    action,
  });
  
  switch (action.type) {
    case "SET_PROCESSING_STATUS":
      return { ...state, processingStatus: action.payload };

    case "SET_SHEET_SELECTOR":
      return {
        ...state,
        showSheetSelector: action.payload.show,
        excelSheets: action.payload.sheets || state.excelSheets,
      };

    case "SET_PENDING_FILE":
      return { ...state, pendingFile: action.payload };

    case "SET_CACHED_CONTENTS":
      return { ...state, cachedFileContents: action.payload };

    case "START_PROCESSING":
      return { ...state, processingStatus: { status: "processing" } };

    case "COMPLETE_PROCESSING":
      return {
        ...state,
        processingStatus: action.payload.status,
        showSheetSelector: false,
        pendingFile: null,
        cachedFileContents: action.payload.success
          ? null
          : state.cachedFileContents,
      };

    case "HANDLE_EXCEL_FILE":
      return {
        ...state,
        excelSheets: action.payload.sheets,
        showSheetSelector: true,
        pendingFile: action.payload.file,
        processingStatus: { status: "processing" },
      };

    case "RESET_FILE_STATE":
      return {
        processingStatus: { status: "pending" },
        showSheetSelector: false,
        excelSheets: [],
        pendingFile: null,
        cachedFileContents: null,
      };

    case "UPDATE_FROM_PROPS":
      if (state.processingStatus.status === "processing") {
        console.debug('[Reducer] Ignoring UPDATE_FROM_PROPS while processing');
        return state;
      }
      return { ...state, processingStatus: action.payload };

    default:
      return state;
  }
}