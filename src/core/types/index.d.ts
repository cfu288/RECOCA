import {
  ColumnMapping,
  RecentFile,
} from "../../features/file-upload/services/file-manager";

declare global {
  interface ElectronAPI {
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
      [key: string]: unknown;
    }>;
    getColumnPreview: (filePath: string, columnName: string) => Promise<{
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
    getRecentFiles: () => Promise<RecentFile[]>;
    addRecentFile: (fileInfo: {
      path: string;
      name: string;
      size: number;
    }) => Promise<RecentFile[]>;
    removeRecentFile: (filePath: string) => Promise<RecentFile[]>;
    checkFileExists: (filePath: string) => Promise<boolean>;
    readLocalFile: (filePath: string) => Promise<string>;
    readLocalBinaryFile: (filePath: string) => Promise<Buffer>;
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
      providerIdCol: string,
      patientIdCol: string,
      patientFirstNameCol?: string,
      patientLastNameCol?: string,
      patientMiddleNameCol?: string,
      patientDateOfBirthCol?: string
    ) => Promise<{
      providerToPatients: Record<
        string,
        {
          id: string;
          firstName?: string;
          lastName?: string;
          middleName?: string;
          dateOfBirth?: string;
        }[]
      >;
      patientToProvider: Record<string, { id: string }>;
    }>;
  }

  interface Window {
    electron: ElectronAPI;
  }
}
