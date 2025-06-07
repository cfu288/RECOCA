declare interface File {
  /**
   * The file's path on the local filesystem.
   */
  readonly path: string;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

interface RecentFile {
  name: string;
  path: string;
  size: number;
  lastOpened: number;
  columnMapping?: ColumnMapping;
}

interface ColumnMapping {
  residentIdentifier: string;
  patientIdentifier: string[];
  appointmentDate: string;
  appointmentStatus?: string;
  selectedResidents?: string[];
  selectedStatusValues?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface IElectronAPI {
  handleNewFile: (
    fileContents: string | ArrayBuffer,
    fileName: string,
    selectedSheet?: string
  ) => Promise<{
    success: boolean;
    message: string;
    columns?: string[];
    previews?: Record<string, string[]>;
    filePath?: string;
    isExcel?: boolean;
    sheets?: Array<{ name: string; rowCount: number; columnCount: number }>;
  }>;
  returnSelectedColumns: (
    filePath: string,
    columnMapping: ColumnMapping
  ) => Promise<{
    success: boolean;
    message: string;
    statistics?: {
      filtered: {
        uniqueResidents: number;
        uniquePatients: number;
        upcIndex?: number;
        cocIndex?: number;
      };
      total: {
        uniqueResidents: number;
        uniquePatients: number;
        upcIndex?: number;
        cocIndex?: number;
      };
      appliedFilters: {
        field: string;
        values: string[];
      }[];
    };
  }>;
  getColumnPreview: (
    filePath: string,
    columnName: string
  ) => Promise<{
    success: boolean;
    message?: string;
    preview?: string[];
    uniqueValues?: string[];
  }>;
  validateColumn: (
    filePath: string,
    columnName: string,
    columnType: "identifier" | "date"
  ) => Promise<{
    success: boolean;
    isValid: boolean;
    status?: "valid" | "warning" | "error";
    message?: string;
  }>;
  getRecentFiles: () => Promise<RecentFile[]>;
  addRecentFile: (fileInfo: {
    path: string;
    name: string;
    size: number;
  }) => Promise<RecentFile[]>;
  removeRecentFile: (filePath: string) => Promise<RecentFile[]>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  readLocalFile: (filePath: string) => Promise<string>;
  saveColumnMapping: (
    fileName: string,
    mapping: ColumnMapping
  ) => Promise<RecentFile[]>;
  getColumnMapping: (fileName: string) => Promise<ColumnMapping | undefined>;
  forPatientIdGetTopProviders: (
    filePath: string,
    patientIdCol: string,
    providerIdCol: string
  ) => Promise<Record<string, Record<string, number>>>;

  mapProvidersToPatients: (
    filePath: string,
    providerIdCol: string, // Provider column (e.g., residentIdentifier)
    patientIdCol: string // Patient column (e.g., patientIdentifier)
  ) => Promise<{
    providerToPatients: Record<string, string[]>;
    patientToProvider: Record<string, string>;
  }>;
}
