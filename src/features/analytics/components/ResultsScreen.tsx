import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../shared/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../shared/components/ui/tabs";
import { ProcessingStatus, Screens, ColumnMapping } from "../../../app/app";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";
import { StatisticsPanel } from "./StatisticsPanel";
import { TopProviders } from "./TopProviders";
import { ProviderPatientMapping } from "./ProviderPatientMapping";
import { extractPatientDemographics } from "../../../core/data/processors/provider-patient-demographics";

interface ResultsScreenProps {
  processingStatus: ProcessingStatus;
  onScreenChange?: (screen: Screens) => void;
  columnMapping?: ColumnMapping;
}

interface PatientInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  race?: string;
  gender?: string;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  processingStatus,
  columnMapping,
}) => {
  const { activeFile } = useActiveFile();
  const [patientSearchTerm, setPatientSearchTerm] = React.useState("");
  const [providerSearchTerm, setProviderSearchTerm] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [providerPage, setProviderPage] = React.useState(1);
  const [providerToPatients, setProviderToPatients] = React.useState<
    Record<string, PatientInfo[]>
  >({});
  const [patientToProvider, setPatientToProvider] = React.useState<
    Record<string, { id: string }>
  >({});
  const [isLoadingMapping, setIsLoadingMapping] = React.useState(false);
  const [mappingError, setMappingError] = React.useState<string | null>(null);

  const getFilePath = async (): Promise<string | null> => {
    if (!activeFile?.file?.name) {
      return null;
    }

    try {
      const recentFiles = await window.electron.getRecentFiles();
      const fileEntry = recentFiles.find(
        (f) => f.name === activeFile.file.name
      );
      if (fileEntry && fileEntry.path) {
        return fileEntry.path;
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  const fetchProviderPatientMapping = async () => {
    setIsLoadingMapping(true);

    setProviderToPatients({});
    setPatientToProvider({});
    setMappingError(null);

    if (!activeFile?.file) {
      setMappingError("No active file available. Please upload a file first.");
      setIsLoadingMapping(false);
      return;
    }

    if (!activeFile.columnMapping?.residentIdentifier) {
      setMappingError(
        "Missing provider column mapping. Please go back to column mapping screen."
      );
      setIsLoadingMapping(false);
      return;
    }

    if (!activeFile.columnMapping?.patientIdentifier?.length) {
      setMappingError(
        "Missing patient column mapping. Please go back to column mapping screen."
      );
      setIsLoadingMapping(false);
      return;
    }

    const filePath = await getFilePath();

    if (!filePath) {
      setMappingError(
        `Could not locate the file "${activeFile.file.name}" on disk. Try re-uploading the file.`
      );
      setIsLoadingMapping(false);
      return;
    }

    try {
      const fileExists = await window.electron.checkFileExists(filePath);

      if (!fileExists) {
        setMappingError(`File not found at path: ${filePath}`);
        setIsLoadingMapping(false);
        return;
      }

      const result = await window.electron.mapProvidersToPatients(
        filePath,
        activeFile.columnMapping.residentIdentifier,
        activeFile.columnMapping.patientIdentifier[0],
        activeFile.columnMapping.patientFirstName,
        activeFile.columnMapping.patientLastName,
        activeFile.columnMapping.patientMiddleName,
        activeFile.columnMapping.patientDateOfBirth,
        activeFile.columnMapping.patientRace,
        activeFile.columnMapping.patientGender,
        activeFile.columnMapping
      );

      setProviderToPatients(result.providerToPatients);
      setPatientToProvider(result.patientToProvider);
    } catch (error) {
      setMappingError(
        `Could not generate provider-patient assignments. ${
          error instanceof Error ? error.message : "An unknown error occurred"
        }. Please verify your column mappings are correct.`
      );
    } finally {
      setIsLoadingMapping(false);
    }
  };

  React.useEffect(() => {
    fetchProviderPatientMapping();
  }, [
    activeFile,
    processingStatus?.statistics,
    activeFile?.columnMapping?.residentIdentifier,
    activeFile?.columnMapping?.patientIdentifier?.[0],
  ]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [patientSearchTerm]);

  React.useEffect(() => {
    setProviderPage(1);
  }, [providerSearchTerm]);

  const patientAdditionalInfo = React.useMemo(() => {
    const patientMap = new Map();

    Object.values(providerToPatients).forEach((patients) => {
      patients.forEach((patient) => {
        if (
          patient.id &&
          (patient.firstName ||
            patient.lastName ||
            patient.middleName ||
            patient.dateOfBirth ||
            patient.race ||
            patient.gender)
        ) {
          patientMap.set(patient.id, {
            firstName: patient.firstName,
            lastName: patient.lastName,
            middleName: patient.middleName,
            dateOfBirth: patient.dateOfBirth,
            race: patient.race,
            gender: patient.gender,
          });
        }
      });
    });

    return Object.fromEntries(patientMap);
  }, [
    providerToPatients,
    processingStatus?.statistics?.filtered?.uniquePatients,
  ]);

  const demographicData = React.useMemo(() => {
    return extractPatientDemographics(providerToPatients);
  }, [providerToPatients]);

  return (
    <div>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <p className="text-sm text-gray-500 mb-4">
          View your processed results
        </p>
      </CardHeader>
      <CardContent>
        {processingStatus?.statistics ? (
          <Tabs defaultValue="statistics" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100">
              <TabsTrigger
                value="statistics"
                className="data-[state=active]:bg-white"
              >
                Statistics
              </TabsTrigger>
              <TabsTrigger
                value="patients"
                className="data-[state=active]:bg-white"
              >
                Patients' Providers
              </TabsTrigger>
              <TabsTrigger
                value="providers"
                className="data-[state=active]:bg-white"
              >
                Provider Panels
              </TabsTrigger>
            </TabsList>

            <TabsContent value="statistics">
              <StatisticsPanel
                statistics={processingStatus.statistics}
                demographicData={demographicData}
                columnMapping={columnMapping}
              />
            </TabsContent>

            <TabsContent value="patients">
              <div className="pt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Top Providers by Patient
                    </CardTitle>
                    <CardDescription>
                      Shows up to 3 providers that each patient visits most
                      frequently
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {processingStatus.statistics.filtered.topProviders && (
                      <TopProviders
                        topProviders={
                          processingStatus.statistics.filtered.topProviders
                        }
                        patientSearchTerm={patientSearchTerm}
                        onPatientSearchChange={setPatientSearchTerm}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        patientAdditionalInfo={patientAdditionalInfo}
                        totalFilteredPatients={
                          processingStatus.statistics.filtered.uniquePatients
                        }
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="providers">
              <div className="pt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Provider Patient Panels
                    </CardTitle>
                    <CardDescription>
                      Creates optimal provider patient panels that maximize
                      continuity of care
                    </CardDescription>
                    <div className="text-xs text-gray-500 mt-1 mb-2">
                      <p className="mb-2">
                        This algorithm assigns each patient to a single provider
                        (one to one exclusive match) using these rules:
                      </p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>
                          Patients are assigned to the provider they've seen
                          most frequently
                        </li>
                        <li>
                          If a patient has seen multiple providers equally:
                        </li>
                        <ul className="list-disc pl-5 mt-1">
                          <li>
                            First ties are broken by assigning to providers with
                            smaller panels
                          </li>
                          <li>
                            If panel sizes are equal, providers are chosen
                            alphabetically
                          </li>
                        </ul>
                      </ol>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ProviderPatientMapping
                      providerToPatients={providerToPatients}
                      patientToProvider={patientToProvider}
                      providerSearchTerm={providerSearchTerm}
                      onProviderSearchChange={setProviderSearchTerm}
                      providerPage={providerPage}
                      setProviderPage={setProviderPage}
                      isLoadingMapping={isLoadingMapping}
                      mappingError={mappingError}
                      activeFileResidentIdentifier={
                        activeFile?.columnMapping?.residentIdentifier
                      }
                      activeFilePatientIdentifier={
                        activeFile?.columnMapping?.patientIdentifier?.[0]
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No analysis data available</p>
          </div>
        )}
      </CardContent>
    </div>
  );
};
