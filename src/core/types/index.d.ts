import {
  ColumnMapping,
  RecentFile,
} from "../../features/file-upload/services/fileManager";

declare global {
  interface ElectronAPI {
    handleNewFile: (fileContents: string, fileName: string) => Promise<any>;
    returnSelectedColumns: (
      filePath: string,
      columnMapping: ColumnMapping
    ) => Promise<any>;
    getColumnPreview: (filePath: string, columnName: string) => Promise<any>;
    validateColumn: (
      filePath: string,
      columnName: string,
      columnType: "identifier" | "date"
    ) => Promise<any>;
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
