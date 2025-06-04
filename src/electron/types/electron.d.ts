declare interface File {
  /**
   * The file's path on the local filesystem.
   */
  readonly path: string;
}

interface RecentFile {
  name: string;
  path: string;
  size: number;
  lastOpened: number;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export interface ElectronAPI {
  handleNewFile: (
    fileContents: string,
    fileName: string
  ) => Promise<{
    success: boolean;
    message: string;
    columns?: string[];
    previews?: Record<string, string[]>;
    filePath?: string;
  }>;
  returnSelectedColumns: (
    filePath: string,
    columnMapping: {
      residentIdentifier: string;
      patientIdentifier: string[];
      appointmentDate: string;
      appointmentStatus?: string;
      selectedStatusValues?: string[];
      selectedResidents?: string[];
      dateRange?: {
        start: string;
        end: string;
      };
    }
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
    status: "valid" | "warning" | "error";
    message?: string;
  }>;
  // File history methods
  getRecentFiles: () => Promise<RecentFile[]>;
  addRecentFile: (fileInfo: {
    path: string;
    name: string;
    size: number;
  }) => Promise<RecentFile[]>;
  removeRecentFile: (filePath: string) => Promise<RecentFile[]>;
  // File operations
  checkFileExists: (filePath: string) => Promise<boolean>;
  readLocalFile: (filePath: string) => Promise<string>;
  forPatientIdGetTopProviders: (
    filePath: string,
    patientIdCol: string,
    providerIdCol: string
  ) => Promise<Record<string, Record<string, number>>>;

  mapProvidersToPatients: (
    filePath: string,
    providerIdCol: string, // Provider column (e.g., residentIdentifier)
    patientIdCol: string, // Patient column (e.g., patientIdentifier)
    patientFirstNameCol?: string,
    patientLastNameCol?: string,
    patientMiddleNameCol?: string,
    patientDateOfBirthCol?: string,
    patientRaceCol?: string,
    patientGenderCol?: string,
    columnMapping: {
      residentIdentifier: string;
      patientIdentifier: string[];
      appointmentDate: string;
      appointmentStatus?: string;
    }
  ) => Promise<{
    providerToPatients: Record<
      string,
      {
        id: string;
        firstName?: string;
        lastName?: string;
        middleName?: string;
        dateOfBirth?: string;
        race?: string;
        gender?: string;
      }[]
    >;
    patientToProvider: Record<string, { id: string }>;
  }>;
}
