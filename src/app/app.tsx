import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  ActiveFileProvider,
  useActiveFile,
} from "../shared/providers/ActiveFileProvider";
import { ColumnMappingScreen } from "../features/column-mapping/components/ColumnMappingScreen";
import { UploadFileScreen } from "../features/file-upload/components/UploadFileScreen";
import { ResultsScreen } from "../features/analytics/components/ResultsScreen";
import { BreadcrumbNav } from "../features/navigation/components/BreadcrumbNav";
import { ExcelSheet } from "../core/data/loaders/excel-loader";
import { FileUploadProvider } from "../features/file-upload/contexts/FileUploadContext";

export interface ColumnMapping {
  residentIdentifier: string;
  patientIdentifier: string[];
  appointmentDate: string;
  appointmentStatus?: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientMiddleName?: string;
  patientDateOfBirth?: string;
  patientRace?: string;
  patientGender?: string;
  selectedResidents?: string[];
  selectedStatusValues?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export type Screens = "upload" | "file-drop" | "column-mapping" | "results";

export interface ProcessingStatus {
  status: "pending" | "processing" | "uploaded" | "processed" | "error";
  message?: string;
  columns?: string[];
  previews?: Record<string, string[]>;
  isExcel?: boolean;
  sheets?: ExcelSheet[];
  statistics?: {
    filtered: {
      uniqueResidents: number;
      uniquePatients: number;
      upcIndex?: number;
      cocIndex?: number;
      seconIndex?: number; // Sequential Continuity of Care Index
      topProviders?: Record<string, Record<string, number>>;
      appointmentCountDistribution?: Record<string, number>; // Number of appointments → count of patients
    };
    total: {
      uniqueResidents: number;
      uniquePatients: number;
      upcIndex?: number;
      cocIndex?: number;
      seconIndex?: number; // Sequential Continuity of Care Index
      topProviders?: Record<string, Record<string, number>>;
      appointmentCountDistribution?: Record<string, number>; // Number of appointments → count of patients
    };
    appliedFilters: {
      field: string;
      values: string[];
    }[];
  };
}

export interface ValidationState {
  isValid: boolean;
  status: "valid" | "warning" | "error";
  message?: string;
}

export interface ValidationStatusState {
  residentIdentifier: ValidationState | null;
  patientIdentifier: ValidationState | null;
  appointmentDate: ValidationState | null;
}

const App: React.FC = () => {
  const [screen, setScreen] = React.useState<Screens>("upload");
  const [
    processingStatus,
    setProcessingStatus,
  ] = React.useState<ProcessingStatus>({ status: "pending" });
  const [columnMapping, setColumnMapping] = React.useState<ColumnMapping>({
    residentIdentifier: "",
    patientIdentifier: [],
    appointmentDate: "",
  });
  const { activeFile } = useActiveFile();

  React.useEffect(() => {
    if (activeFile?.columnMapping) {
      setColumnMapping(activeFile.columnMapping);
    }
  }, [activeFile]);

  React.useEffect(() => {
    if (activeFile && processingStatus.status === "pending") {
      setProcessingStatus((prev) => ({
        ...prev,
        status: activeFile.file ? "uploaded" : "pending",
      }));
    } else if (!activeFile) {
      setProcessingStatus({ status: "pending" });
    }
  }, [activeFile]);

  const handleScreenChange = (newScreen: Screens) => {
    setScreen(newScreen);
  };

  const renderScreen = () => {
    switch (screen) {
      case "upload":
        return (
          <FileUploadProvider
            onScreenChange={handleScreenChange}
            onProcessingComplete={setProcessingStatus}
          >
            <UploadFileScreen fileProcessingStatus={processingStatus} />
          </FileUploadProvider>
        );
      case "column-mapping":
        return (
          <ColumnMappingScreen
            onScreenChange={handleScreenChange}
            onProcessingComplete={setProcessingStatus}
            fileProcessingStatus={processingStatus}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
          />
        );
      case "results":
        return (
          <ResultsScreen
            processingStatus={processingStatus}
            onScreenChange={handleScreenChange}
          />
        );
      default:
        return (
          <FileUploadProvider
            onScreenChange={handleScreenChange}
            onProcessingComplete={setProcessingStatus}
          >
            <UploadFileScreen fileProcessingStatus={processingStatus} />
          </FileUploadProvider>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <BreadcrumbNav
          currentScreen={screen}
          onScreenChange={handleScreenChange}
        />
        <div className="mt-8">{renderScreen()}</div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <ActiveFileProvider>
      <App />
    </ActiveFileProvider>
  </React.StrictMode>
);
