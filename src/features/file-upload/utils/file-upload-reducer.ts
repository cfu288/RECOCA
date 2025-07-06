import { ProcessingStatus } from "../../../app/app";
import { ExcelSheet } from "../../../core/data/loaders/excel-loader";

export interface FileUploadState {
  processingStatus: ProcessingStatus;
  showSheetSelector: boolean;
  excelSheets: ExcelSheet[];
  pendingFile: File | null;
  cachedFileContents: ArrayBuffer | null;
}

export type FileUploadAction =
  | { type: "START" }
  | { type: "SUCCESS"; payload: ProcessingStatus }
  | { type: "ERROR"; payload: ProcessingStatus }
  | {
      type: "EXCEL_DETECTED";
      payload: { sheets: ExcelSheet[]; file: File; buffer: ArrayBuffer };
    }
  | { type: "SHEET_SELECTED" }
  | { type: "RESET" }
  | { type: "SYNC_STATUS"; payload: ProcessingStatus };

export const INITIAL_FILE_UPLOAD_STATE: FileUploadState = {
  processingStatus: { status: "pending" },
  showSheetSelector: false,
  excelSheets: [],
  pendingFile: null,
  cachedFileContents: null,
};

export function fileUploadReducer(
  state: FileUploadState,
  action: FileUploadAction
): FileUploadState {
  switch (action.type) {
    case "START":
      return { ...state, processingStatus: { status: "processing" } };

    case "SUCCESS":
      return {
        ...state,
        processingStatus: action.payload,
        showSheetSelector: false,
        pendingFile: null,
        cachedFileContents: null,
      };

    case "ERROR":
      return {
        ...state,
        processingStatus: action.payload,
        showSheetSelector: false,
      };

    case "EXCEL_DETECTED":
      return {
        ...state,
        excelSheets: action.payload.sheets,
        showSheetSelector: true,
        pendingFile: action.payload.file,
        cachedFileContents: action.payload.buffer,
        processingStatus: { status: "processing" },
      };

    case "SHEET_SELECTED":
      return {
        ...state,
        showSheetSelector: false,
      };

    case "RESET":
      return INITIAL_FILE_UPLOAD_STATE;

    case "SYNC_STATUS":
      return state.processingStatus.status === "processing"
        ? state
        : { ...state, processingStatus: action.payload };

    default:
      return state;
  }
}
