import {
  fileUploadReducer,
  FileUploadState,
  FileUploadAction,
  INITIAL_FILE_UPLOAD_STATE,
} from "../../../../features/file-upload/utils/file-upload-reducer";
import { TestFactories } from "../../../../features/file-upload/utils/test-factories";

describe("fileUploadReducer", () => {
  describe("START", () => {
    it("should set status to processing", () => {
      const action: FileUploadAction = { type: "START" };
      const newState = fileUploadReducer(INITIAL_FILE_UPLOAD_STATE, action);

      expect(newState.processingStatus.status).toBe("processing");
      expect(newState).not.toBe(INITIAL_FILE_UPLOAD_STATE); // Ensure immutability
    });
  });

  describe("SUCCESS", () => {
    it("should update state on successful processing", () => {
      const action: FileUploadAction = {
        type: "SUCCESS",
        payload: { status: "uploaded", columns: ["col1", "col2"] },
      };

      const stateWithPendingData: FileUploadState = {
        ...INITIAL_FILE_UPLOAD_STATE,
        processingStatus: { status: "processing" },
        cachedFileContents: TestFactories.mockArrayBuffer(),
        showSheetSelector: true,
        pendingFile: TestFactories.mockCsvFile(),
      };

      const newState = fileUploadReducer(stateWithPendingData, action);

      expect(newState.processingStatus).toEqual({
        status: "uploaded",
        columns: ["col1", "col2"],
      });
      expect(newState.showSheetSelector).toBe(false);
      expect(newState.pendingFile).toBe(null);
      expect(newState.cachedFileContents).toBe(null); // Cleared on success
    });
  });

  describe("ERROR", () => {
    it("should update state on error", () => {
      const action: FileUploadAction = {
        type: "ERROR",
        payload: { status: "error", message: "Failed to process file" },
      };

      const newState = fileUploadReducer(INITIAL_FILE_UPLOAD_STATE, action);

      expect(newState.processingStatus).toEqual({
        status: "error",
        message: "Failed to process file",
      });
      expect(newState.showSheetSelector).toBe(false);
    });

    it("should preserve cache on error for potential retry", () => {
      const cachedContents = TestFactories.mockArrayBuffer();
      const stateWithCache: FileUploadState = {
        ...INITIAL_FILE_UPLOAD_STATE,
        cachedFileContents: cachedContents,
      };

      const action: FileUploadAction = {
        type: "ERROR",
        payload: { status: "error", message: "Failed" },
      };

      const newState = fileUploadReducer(stateWithCache, action);

      expect(newState.cachedFileContents).toBe(cachedContents); // Preserved on error
    });
  });

  describe("EXCEL_DETECTED", () => {
    it("should update state for Excel file with sheets", () => {
      const mockFile = TestFactories.mockExcelFile();
      const mockBuffer = TestFactories.mockArrayBuffer();
      const mockSheets = TestFactories.mockSheets();

      const action: FileUploadAction = {
        type: "EXCEL_DETECTED",
        payload: { sheets: mockSheets, file: mockFile, buffer: mockBuffer },
      };

      const newState = fileUploadReducer(INITIAL_FILE_UPLOAD_STATE, action);

      expect(newState.excelSheets).toEqual(mockSheets);
      expect(newState.showSheetSelector).toBe(true);
      expect(newState.pendingFile).toBe(mockFile);
      expect(newState.cachedFileContents).toBe(mockBuffer);
      expect(newState.processingStatus.status).toBe("processing");
    });
  });

  describe("SHEET_SELECTED", () => {
    it("should hide sheet selector", () => {
      const stateWithSelector: FileUploadState = {
        ...INITIAL_FILE_UPLOAD_STATE,
        showSheetSelector: true,
        excelSheets: [{ name: "Sheet1", rowCount: 100, columnCount: 10 }],
      };

      const action: FileUploadAction = { type: "SHEET_SELECTED" };
      const newState = fileUploadReducer(stateWithSelector, action);

      expect(newState.showSheetSelector).toBe(false);
      // Should preserve other state
      expect(newState.excelSheets).toEqual(stateWithSelector.excelSheets);
    });
  });

  describe("RESET", () => {
    it("should reset all state to initial", () => {
      const modifiedState: FileUploadState = {
        processingStatus: { status: "uploaded" },
        showSheetSelector: true,
        excelSheets: [{ name: "Sheet1", rowCount: 100, columnCount: 10 }],
        pendingFile: TestFactories.mockCsvFile(),
        cachedFileContents: TestFactories.mockArrayBuffer(),
      };

      const action: FileUploadAction = { type: "RESET" };
      const newState = fileUploadReducer(modifiedState, action);

      expect(newState).toEqual(INITIAL_FILE_UPLOAD_STATE);
    });
  });

  describe("SYNC_STATUS", () => {
    it("should update status from props when not processing", () => {
      const action: FileUploadAction = {
        type: "SYNC_STATUS",
        payload: { status: "uploaded" },
      };

      const newState = fileUploadReducer(INITIAL_FILE_UPLOAD_STATE, action);

      expect(newState.processingStatus.status).toBe("uploaded");
    });

    it("should ignore props update when actively processing", () => {
      const processingState: FileUploadState = {
        ...INITIAL_FILE_UPLOAD_STATE,
        processingStatus: { status: "processing" },
      };

      const action: FileUploadAction = {
        type: "SYNC_STATUS",
        payload: { status: "uploaded" },
      };

      const newState = fileUploadReducer(processingState, action);

      expect(newState.processingStatus.status).toBe("processing"); // Unchanged
      expect(newState).toBe(processingState); // Same reference
    });
  });

  describe("State Transitions", () => {
    it("should handle CSV file upload flow", () => {
      let state = INITIAL_FILE_UPLOAD_STATE;

      // Start processing
      state = fileUploadReducer(state, { type: "START" });
      expect(state.processingStatus.status).toBe("processing");

      // Success
      state = fileUploadReducer(state, {
        type: "SUCCESS",
        payload: { status: "uploaded", columns: ["a", "b"] },
      });
      expect(state.processingStatus.status).toBe("uploaded");
    });

    it("should handle Excel file upload flow", () => {
      let state = INITIAL_FILE_UPLOAD_STATE;
      const mockFile = TestFactories.mockExcelFile();
      const mockBuffer = TestFactories.mockArrayBuffer();

      // Start processing
      state = fileUploadReducer(state, { type: "START" });

      // Excel detected
      state = fileUploadReducer(state, {
        type: "EXCEL_DETECTED",
        payload: {
          sheets: [{ name: "Sheet1", rowCount: 10, columnCount: 5 }],
          file: mockFile,
          buffer: mockBuffer,
        },
      });
      expect(state.showSheetSelector).toBe(true);
      expect(state.cachedFileContents).toBe(mockBuffer);

      // Sheet selected
      state = fileUploadReducer(state, { type: "SHEET_SELECTED" });
      expect(state.showSheetSelector).toBe(false);

      // Start processing again (for the selected sheet)
      state = fileUploadReducer(state, { type: "START" });

      // Success
      state = fileUploadReducer(state, {
        type: "SUCCESS",
        payload: { status: "uploaded", columns: ["x", "y", "z"] },
      });
      expect(state.processingStatus.status).toBe("uploaded");
      expect(state.cachedFileContents).toBe(null); // Cleared
    });
  });
});
