import { 
  fileUploadReducer, 
  FileUploadState, 
  FileUploadAction 
} from '../../../../features/file-upload/utils/file-upload-reducer';

describe('fileUploadReducer', () => {
  const initialState: FileUploadState = {
    processingStatus: { status: 'pending' },
    showSheetSelector: false,
    excelSheets: [],
    pendingFile: null,
    cachedFileContents: null,
  };

  describe('SET_PROCESSING_STATUS', () => {
    it('should update processing status', () => {
      const action: FileUploadAction = {
        type: 'SET_PROCESSING_STATUS',
        payload: { status: 'uploaded', message: 'Success' },
      };

      const newState = fileUploadReducer(initialState, action);
      
      expect(newState.processingStatus).toEqual({ status: 'uploaded', message: 'Success' });
      expect(newState).not.toBe(initialState); // Ensure immutability
    });
  });

  describe('START_PROCESSING', () => {
    it('should set status to processing', () => {
      const action: FileUploadAction = { type: 'START_PROCESSING' };
      const newState = fileUploadReducer(initialState, action);
      
      expect(newState.processingStatus.status).toBe('processing');
    });
  });

  describe('HANDLE_EXCEL_FILE', () => {
    it('should update state for Excel file with sheets', () => {
      const mockFile = new File([''], 'test.xlsx');
      const mockSheets = [
        { name: 'Sheet1', rowCount: 100, columnCount: 10 },
        { name: 'Sheet2', rowCount: 200, columnCount: 15 },
      ];

      const action: FileUploadAction = {
        type: 'HANDLE_EXCEL_FILE',
        payload: { sheets: mockSheets, file: mockFile },
      };

      const newState = fileUploadReducer(initialState, action);
      
      expect(newState.excelSheets).toEqual(mockSheets);
      expect(newState.showSheetSelector).toBe(true);
      expect(newState.pendingFile).toBe(mockFile);
      expect(newState.processingStatus.status).toBe('processing');
    });
  });

  describe('RESET_FILE_STATE', () => {
    it('should reset all file-related state', () => {
      const modifiedState: FileUploadState = {
        processingStatus: { status: 'uploaded' },
        showSheetSelector: true,
        excelSheets: [{ name: 'Sheet1', rowCount: 100, columnCount: 10 }],
        pendingFile: new File([''], 'test.csv'),
        cachedFileContents: new ArrayBuffer(100),
      };

      const action: FileUploadAction = { type: 'RESET_FILE_STATE' };
      const newState = fileUploadReducer(modifiedState, action);
      
      expect(newState).toEqual({
        processingStatus: { status: 'pending' },
        showSheetSelector: false,
        excelSheets: [],
        pendingFile: null,
        cachedFileContents: null,
      });
    });
  });

  describe('COMPLETE_PROCESSING', () => {
    it('should update state on successful processing', () => {
      const action: FileUploadAction = {
        type: 'COMPLETE_PROCESSING',
        payload: {
          status: { status: 'uploaded', columns: ['col1', 'col2'] },
          success: true,
        },
      };

      const stateWithCache: FileUploadState = {
        ...initialState,
        cachedFileContents: new ArrayBuffer(100),
        showSheetSelector: true,
        pendingFile: new File([''], 'test.csv'),
      };

      const newState = fileUploadReducer(stateWithCache, action);
      
      expect(newState.processingStatus).toEqual({ status: 'uploaded', columns: ['col1', 'col2'] });
      expect(newState.showSheetSelector).toBe(false);
      expect(newState.pendingFile).toBe(null);
      expect(newState.cachedFileContents).toBe(null); // Cleared on success
    });

    it('should preserve cache on failed processing', () => {
      const cachedContents = new ArrayBuffer(100);
      const action: FileUploadAction = {
        type: 'COMPLETE_PROCESSING',
        payload: {
          status: { status: 'error', message: 'Failed' },
          success: false,
        },
      };

      const stateWithCache: FileUploadState = {
        ...initialState,
        cachedFileContents: cachedContents,
      };

      const newState = fileUploadReducer(stateWithCache, action);
      
      expect(newState.cachedFileContents).toBe(cachedContents); // Preserved on failure
    });
  });

  describe('UPDATE_FROM_PROPS', () => {
    it('should update status from props when not processing', () => {
      const action: FileUploadAction = {
        type: 'UPDATE_FROM_PROPS',
        payload: { status: 'uploaded' },
      };

      const newState = fileUploadReducer(initialState, action);
      
      expect(newState.processingStatus.status).toBe('uploaded');
    });

    it('should ignore props update when actively processing', () => {
      const processingState: FileUploadState = {
        ...initialState,
        processingStatus: { status: 'processing' },
      };

      const action: FileUploadAction = {
        type: 'UPDATE_FROM_PROPS',
        payload: { status: 'uploaded' },
      };

      const newState = fileUploadReducer(processingState, action);
      
      expect(newState.processingStatus.status).toBe('processing'); // Unchanged
      expect(newState).toBe(processingState); // Same reference
    });
  });

  describe('SET_CACHED_CONTENTS', () => {
    it('should update cached file contents', () => {
      const contents = new ArrayBuffer(100);
      const action: FileUploadAction = {
        type: 'SET_CACHED_CONTENTS',
        payload: contents,
      };

      const newState = fileUploadReducer(initialState, action);
      
      expect(newState.cachedFileContents).toBe(contents);
    });
  });
});