import React from "react";
import {
  ColumnMapping,
  ProcessingStatus,
  Screens,
  ValidationState,
} from "../../../app/app";
import { Button } from "../../../shared/components/ui/button";
import { Label } from "../../../shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import { ScrollArea } from "../../../shared/components/ui/scroll-area";
import { Checkbox } from "../../../shared/components/ui/checkbox";
import { PreviewSection } from "../../file-upload/components/PreviewSection";
import { useActiveFile } from "../../../shared/providers/ActiveFileProvider";

export const ColumnMappingScreen: React.FC<{
  onScreenChange?: (screen: Screens) => void;
  onProcessingComplete?: (status: ProcessingStatus) => void;
  fileProcessingStatus: ProcessingStatus;
  columnMapping: ColumnMapping;
  setColumnMapping: React.Dispatch<React.SetStateAction<ColumnMapping>>;
}> = ({
  onScreenChange,
  onProcessingComplete,
  fileProcessingStatus,
  columnMapping,
  setColumnMapping,
}) => {
  const { activeFile, setActiveFile } = useActiveFile();
  const [processingStatus, setProcessingStatus] =
    React.useState<ProcessingStatus>(fileProcessingStatus);
  const [uniqueStatusValues, setUniqueStatusValues] = React.useState<string[]>(
    []
  );
  const [selectedStatusValues, setSelectedStatusValues] = React.useState<
    string[]
  >(columnMapping.selectedStatusValues || []);
  const [selectedResidents, setSelectedResidents] = React.useState<string[]>(
    columnMapping.selectedResidents || []
  );
  const [uniqueResidents, setUniqueResidents] = React.useState<string[]>([]);
  const [validationStatus, setValidationStatus] =
    React.useState<ValidationState>({
      residentIdentifier: null,
      patientIdentifier: null,
      appointmentDate: null,
    });

  const [dateRange, setDateRange] = React.useState<{
    start: string;
    end: string;
  } | null>(columnMapping.dateRange || null);

  const [processingElapsedTime, setProcessingElapsedTime] = React.useState(0);

  /**
   * Restores and validates column mappings when component mounts or mappings change
   */
  React.useEffect(() => {
    if (
      columnMapping.dateRange &&
      (!dateRange ||
        dateRange.start !== columnMapping.dateRange.start ||
        dateRange.end !== columnMapping.dateRange.end)
    ) {
      setDateRange(columnMapping.dateRange);
    }

    // Initialize selectedStatusValues from columnMapping if it exists
    if (
      columnMapping.selectedStatusValues &&
      columnMapping.selectedStatusValues.length > 0
    ) {
      setSelectedStatusValues(columnMapping.selectedStatusValues);
    }

    const validateColumns = async () => {
      if (!activeFile) return;

      if (columnMapping.residentIdentifier) {
        const validationResult = await validateSelectedColumn(
          columnMapping.residentIdentifier,
          "identifier"
        );
        setValidationStatus((prev) => ({
          ...prev,
          residentIdentifier: validationResult || null,
        }));
        const preview = await window.electron.getColumnPreview(
          activeFile.file.path,
          columnMapping.residentIdentifier
        );
        if (preview.success && preview.uniqueValues) {
          const sortedResidents = [...preview.uniqueValues].sort();
          setUniqueResidents(sortedResidents);

          if (
            !columnMapping.selectedResidents ||
            !columnMapping.selectedResidents.length
          ) {
            setSelectedResidents(sortedResidents);
          }
        }
      }

      if (columnMapping.patientIdentifier.length > 0) {
        const validationResults = await Promise.all(
          columnMapping.patientIdentifier.map((col) =>
            validateSelectedColumn(col, "identifier")
          )
        );

        const hasErrors = validationResults.some(
          (result) => result?.status === "error"
        );
        const hasWarnings =
          !hasErrors &&
          validationResults.some((result) => result?.status === "warning");

        const status = hasErrors ? "error" : hasWarnings ? "warning" : "valid";
        const isValid = status !== "error";

        const messages = validationResults
          .filter((result) => result?.status === status)
          .map((result) => result?.message)
          .filter(Boolean);

        setValidationStatus((prev) => ({
          ...prev,
          patientIdentifier: {
            isValid,
            status,
            message: messages.join(", "),
          },
        }));
      }

      if (columnMapping.appointmentDate) {
        const validationResult = await validateSelectedColumn(
          columnMapping.appointmentDate,
          "date"
        );
        setValidationStatus((prev) => ({
          ...prev,
          appointmentDate: validationResult || null,
        }));
      }

      if (columnMapping.appointmentStatus) {
        await fetchUniqueStatusValues(columnMapping.appointmentStatus);
      }
    };

    validateColumns();
  }, [activeFile, columnMapping]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    if (processingStatus.status === "processing") {
      setProcessingElapsedTime(0);
      interval = setInterval(() => {
        setProcessingElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [processingStatus.status]);

  const validateSelectedColumn = async (
    columnName: string,
    type: "identifier" | "date"
  ): Promise<ValidationState | undefined> => {
    if (!activeFile || !columnName) return;

    try {
      const result = await window.electron.validateColumn(
        activeFile.file.path,
        columnName,
        type
      );

      if (result.success) {
        return {
          isValid: result.isValid,
          status: result.status,
          message: result.message,
        };
      }
      return {
        isValid: false,
        status: "error",
        message: result.message,
      };
    } catch (error) {
      console.error("Error validating column:", error);
      return {
        isValid: false,
        status: "error",
        message:
          error instanceof Error ? error.message : "Error validating column",
      };
    }
  };

  const fetchUniqueStatusValues = async (columnName: string) => {
    try {
      if (!activeFile) return;
      const preview = await window.electron.getColumnPreview(
        activeFile.file.path,
        columnName
      );
      if (preview.success && preview.uniqueValues) {
        const sortedValues = [...preview.uniqueValues].sort();
        setUniqueStatusValues(sortedValues);

        // Only reset selection if we don't have any selected values in the columnMapping
        if (
          !columnMapping.selectedStatusValues ||
          columnMapping.selectedStatusValues.length === 0
        ) {
          setSelectedStatusValues([]);
        }
      }
    } catch (error) {
      console.error("Error fetching unique status values:", error);
    }
  };

  const handleColumnSelection = async () => {
    if (!activeFile) return;

    try {
      setProcessingStatus({ status: "processing" });

      const finalColumnMapping = {
        ...columnMapping,
        selectedStatusValues: columnMapping.appointmentStatus
          ? selectedStatusValues
          : undefined,
        selectedResidents: selectedResidents,
        dateRange: dateRange,
      };

      setActiveFile({
        ...activeFile,
        columnMapping: finalColumnMapping,
      });

      console.log("Updated activeFile columnMapping with:", {
        residentIdentifier: finalColumnMapping.residentIdentifier,
        patientIdentifier: finalColumnMapping.patientIdentifier,
        hasPatientCols: finalColumnMapping.patientIdentifier.length > 0,
      });

      if ("saveColumnMapping" in window.electron) {
        try {
          await (window.electron as any).saveColumnMapping(
            activeFile.name,
            finalColumnMapping
          );
        } catch (e) {
          console.error("Error saving column mapping:", e);
        }
      }

      const result = await window.electron.returnSelectedColumns(
        activeFile.file.path,
        finalColumnMapping
      );

      let topProvidersData = {};
      if (result.success && "forPatientIdGetTopProviders" in window.electron) {
        try {
          topProvidersData = await window.electron.forPatientIdGetTopProviders(
            activeFile.file.path,
            finalColumnMapping.patientIdentifier[0], // Using first patient identifier as patient ID
            finalColumnMapping.residentIdentifier, // Provider ID column
            finalColumnMapping // Pass the entire column mapping for filtering
          );
          console.log("Top providers data:", topProvidersData);
        } catch (e) {
          console.error("Error getting top providers:", e);
        }
      }

      const newStatus: ProcessingStatus = {
        status: result.success ? "processed" : "error",
        message: result.message,
        statistics: result.success
          ? {
              ...result.statistics,
              filtered: {
                ...result.statistics.filtered,
                topProviders: topProvidersData,
              },
              total: {
                ...result.statistics.total,
                topProviders: topProvidersData,
              },
            }
          : result.statistics,
        columns: processingStatus.columns,
        previews: processingStatus.previews,
      };

      setProcessingStatus(newStatus);

      if (onProcessingComplete) {
        onProcessingComplete(newStatus);
      }

      if (result.success && onScreenChange) {
        onScreenChange("results");
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 100);
      }
    } catch (error) {
      console.error("Error in handleColumnSelection:", error);
      const errorStatus: ProcessingStatus = {
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        columns: processingStatus.columns,
        previews: processingStatus.previews,
      };
      setProcessingStatus(errorStatus);
      if (onProcessingComplete) {
        onProcessingComplete(errorStatus);
      }
    }
  };

  const hasValidSelections = () => {
    return (
      columnMapping.residentIdentifier &&
      columnMapping.patientIdentifier.length > 0 &&
      columnMapping.appointmentDate &&
      (!columnMapping.appointmentStatus || selectedStatusValues.length > 0)
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Column Mapping</h1>
      <div className="space-y-8">
        <p className="text-sm text-gray-500 mb-2">
          Select the columns from your file that can be used to identify
          residents or providers, patients, and appointment dates.
        </p>
        <div className="space-y-4 ">
          <h2 className="text-lg font-semibold">
            Step 1: Resident or Provider Data
          </h2>
          <Label htmlFor="resident-identifier">
            Resident or Provider Identifier
          </Label>
          <p className="text-sm text-gray-500 mb-2">
            Select the column that identifies the resident or provider -
            preferrably an ID but can be a name
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={columnMapping.residentIdentifier}
                onValueChange={async (value: string) => {
                  setColumnMapping((prev) => ({
                    ...prev,
                    residentIdentifier: value,
                  }));
                }}
              >
                <SelectTrigger
                  id="resident-identifier"
                  className="w-full bg-white"
                >
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-48 overflow-y-auto">
                  {processingStatus.columns?.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationStatus.residentIdentifier &&
                (validationStatus.residentIdentifier.isValid ? (
                  <div
                    className="text-green-500"
                    title={validationStatus.residentIdentifier.message}
                  >
                    ✓
                  </div>
                ) : (
                  <div className="text-red-500">✗</div>
                ))}
            </div>
            {validationStatus.residentIdentifier &&
              !validationStatus.residentIdentifier.isValid && (
                <div className="text-sm text-red-500 ml-2">
                  {validationStatus.residentIdentifier.message}
                </div>
              )}
          </div>
          {columnMapping.residentIdentifier && (
            <div className="">
              <Label className="mb-2 block">Provider List</Label>
              <p className="text-sm text-gray-500 mb-2">
                Select the providers found in the{" "}
                <span className="font-mono">
                  {columnMapping.residentIdentifier}
                </span>{" "}
                column you would like to include in analysis
              </p>
              <ScrollArea className="h-96 w-full mt-4 border rounded-md px-4 bg-white">
                <div className="space-y-4 p-2 my-2">
                  {(uniqueResidents.length > 0
                    ? uniqueResidents
                    : selectedResidents
                  ).map((resident) => (
                    <div key={resident} className="flex items-center space-x-2">
                      <Checkbox
                        id={`resident-${resident}`}
                        checked={selectedResidents.includes(resident)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedResidents((prev) => [...prev, resident]);
                          } else {
                            setSelectedResidents((prev) =>
                              prev.filter((r) => r !== resident)
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={`resident-${resident}`}
                        className="text-sm text-gray-700"
                      >
                        {resident}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="mt-2 flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedResidents([])}
                >
                  Deselect All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedResidents(
                      uniqueResidents.length > 0
                        ? [...uniqueResidents]
                        : [...selectedResidents]
                    )
                  }
                >
                  Select All
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="my-8 border-t border-gray-200"></div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 2: Patient Data</h2>
          <div className="md:grid md:grid-cols-6 md:gap-4">
            <div className="col-span-6 sm:col-span-6 md:col-span-4 flex flex-col gap-2">
              <Label htmlFor="patient-identifier">Patient Identifier</Label>
              <p className="text-sm text-gray-500 mb-2">
                Select the column that uniquely identifies the patient - usually
                a patient specific ID such as a MRN
              </p>
              <div>
                <div className="flex items-center gap-2">
                  <Select
                    value={columnMapping.patientIdentifier.join(",")}
                    onValueChange={async (value: string) => {
                      const selectedCols = value.split(",").filter(Boolean);
                      setColumnMapping((prev) => ({
                        ...prev,
                        patientIdentifier: selectedCols,
                      }));
                    }}
                  >
                    <SelectTrigger
                      id="patient-identifier"
                      className="w-full bg-white"
                    >
                      <SelectValue placeholder="Select columns" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-48 overflow-y-auto">
                      {processingStatus.columns?.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationStatus.patientIdentifier &&
                    validationStatus.patientIdentifier.status === "valid" && (
                      <div
                        className="text-green-500"
                        title={validationStatus.patientIdentifier.message}
                      >
                        ✓
                      </div>
                    )}
                  {validationStatus.patientIdentifier &&
                    validationStatus.patientIdentifier.status === "warning" && (
                      <div className="text-yellow-500">⚠</div>
                    )}
                  {validationStatus.patientIdentifier &&
                    validationStatus.patientIdentifier.status === "error" && (
                      <div className="text-red-500">✗</div>
                    )}
                </div>
                {validationStatus.patientIdentifier &&
                  validationStatus.patientIdentifier.status === "warning" && (
                    <div className="text-sm text-yellow-500 ml-2">
                      {validationStatus.patientIdentifier.message}
                    </div>
                  )}
                {validationStatus.patientIdentifier &&
                  validationStatus.patientIdentifier.status === "error" && (
                    <div className="text-sm text-red-500 ml-2">
                      {validationStatus.patientIdentifier.message}
                    </div>
                  )}
              </div>
              {columnMapping.patientIdentifier.length > 0 && (
                <div>
                  {/* Patient Additional Information Fields */}
                  <div>
                    <Label className="mb-2 block">
                      Additional Patient Information Columns
                    </Label>
                    <p className="text-sm text-gray-500 mb-4">
                      Select the fields in your file that represent the patient
                      identifiers. If selected, these mappings patient names and
                      DOB will be shown in provider-patient mappings in the
                      results screen.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      {/* First Name */}
                      <div>
                        <Label htmlFor="patient-first-name" className="text-sm">
                          Patient First Name
                        </Label>
                        <Select
                          value={columnMapping.patientFirstName || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientFirstName:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-first-name"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Last Name */}
                      <div>
                        <Label htmlFor="patient-last-name" className="text-sm">
                          Patient Last Name
                        </Label>
                        <Select
                          value={columnMapping.patientLastName || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientLastName:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-last-name"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Middle Name */}
                      <div>
                        <Label
                          htmlFor="patient-middle-name"
                          className="text-sm"
                        >
                          Patient Middle Name
                        </Label>
                        <Select
                          value={columnMapping.patientMiddleName || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientMiddleName:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-middle-name"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <Label htmlFor="patient-dob" className="text-sm">
                          Patient Date of Birth
                        </Label>
                        <Select
                          value={columnMapping.patientDateOfBirth || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientDateOfBirth:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-dob"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Race */}
                      <div>
                        <Label htmlFor="patient-race" className="text-sm">
                          Patient Race
                        </Label>
                        <Select
                          value={columnMapping.patientRace || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientRace:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-race"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Gender */}
                      <div>
                        <Label htmlFor="patient-gender" className="text-sm">
                          Patient Gender
                        </Label>
                        <Select
                          value={columnMapping.patientGender || "__none__"}
                          onValueChange={(value: string) => {
                            setColumnMapping((prev) => ({
                              ...prev,
                              patientGender:
                                value === "__none__" ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id="patient-gender"
                            className="w-full mt-1 bg-white"
                          >
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-48 overflow-y-auto">
                            <SelectItem value="__none__">None</SelectItem>
                            {processingStatus.columns?.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="col-span-6 sm:col-span-6 md:col-span-2 md:ml-8">
              <PreviewSection
                columns={columnMapping.patientIdentifier}
                previews={processingStatus.previews || {}}
                title={columnMapping.patientIdentifier.join(", ")}
              />
            </div>
          </div>
        </div>

        <div className="my-8 border-t border-gray-200"></div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 3: Appointment Data</h2>
          <Label htmlFor="appointment-date">Appointment Date</Label>
          <p className="text-sm text-gray-500 mb-2">
            Select the column that contains the date of the appointment
          </p>
          <div className="md:grid md:grid-cols-6 md:gap-4">
            <div className="col-span-6 sm:col-span-6 md:col-span-4 flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={columnMapping.appointmentDate}
                    onValueChange={async (value: string) => {
                      setColumnMapping((prev) => ({
                        ...prev,
                        appointmentDate: value,
                      }));

                      if (value && activeFile) {
                        const preview = await window.electron.getColumnPreview(
                          activeFile.file.path,
                          value
                        );

                        if (preview.success && preview.uniqueValues) {
                          const dates = preview.uniqueValues
                            .map((val) => new Date(val))
                            .filter((date) => !isNaN(date.getTime()));

                          if (dates.length > 0) {
                            const timestamps = dates.map((date) =>
                              date.getTime()
                            );
                            const minDate = new Date(Math.min(...timestamps));
                            const maxDate = new Date(Math.max(...timestamps));

                            // Format dates to YYYY-MM-DD for input type="date"
                            const formatDateForInput = (date: Date) => {
                              return date.toISOString().split("T")[0];
                            };

                            const isColumnChange =
                              value !== columnMapping.appointmentDate;
                            if (!columnMapping.dateRange || isColumnChange) {
                              const newDateRange = {
                                start: formatDateForInput(minDate),
                                end: formatDateForInput(maxDate),
                              };

                              setDateRange(newDateRange);
                              setColumnMapping((prev) => ({
                                ...prev,
                                dateRange: newDateRange,
                              }));
                            }
                          }
                        }
                      }
                    }}
                  >
                    <SelectTrigger
                      id="appointment-date"
                      className="w-full bg-white"
                    >
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-48 overflow-y-auto">
                      {processingStatus.columns?.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationStatus.appointmentDate &&
                    validationStatus.appointmentDate.isValid && (
                      <div
                        className="text-green-500"
                        title={validationStatus.appointmentDate.message}
                      >
                        ✓
                      </div>
                    )}
                  {validationStatus.appointmentDate &&
                    !validationStatus.appointmentDate.isValid && (
                      <div className="text-red-500">✗</div>
                    )}
                </div>
                {validationStatus.appointmentDate &&
                  !validationStatus.appointmentDate.isValid && (
                    <div className="text-sm text-red-500 ml-2">
                      {validationStatus.appointmentDate.message}
                    </div>
                  )}
              </div>
              {columnMapping.appointmentDate && (
                <>
                  {validationStatus.appointmentDate?.isValid && (
                    <div className="mt-4 space-y-4">
                      <Label>Filter by Date Range</Label>
                      <p className="text-sm text-gray-500 mb-2">
                        Select a date range to filter the appointments by for
                        the analysis.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="start-date"
                            className="text-sm text-gray-500"
                          >
                            Start Date
                          </Label>
                          <input
                            type="date"
                            id="start-date"
                            className="w-full mt-1 rounded-md border border-gray-300 shadow-sm p-2 focus:border-primary focus:ring-1 focus:ring-primary"
                            value={dateRange?.start || ""}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setDateRange((prev) => ({
                                start: newStart,
                                end: prev?.end || "",
                              }));
                              setColumnMapping((prev) => ({
                                ...prev,
                                dateRange: {
                                  start: newStart,
                                  end: dateRange?.end || "",
                                },
                              }));
                            }}
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="end-date"
                            className="text-sm text-gray-500"
                          >
                            End Date
                          </Label>
                          <input
                            type="date"
                            id="end-date"
                            className="w-full mt-1 rounded-md border border-gray-300 shadow-sm p-2 focus:border-primary focus:ring-1 focus:ring-primary"
                            value={dateRange?.end || ""}
                            min={dateRange?.start || ""}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setDateRange((prev) => ({
                                start: prev?.start || "",
                                end: newEnd,
                              }));
                              setColumnMapping((prev) => ({
                                ...prev,
                                dateRange: {
                                  start: dateRange?.start || "",
                                  end: newEnd,
                                },
                              }));
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDateRange(null);
                            setColumnMapping((prev) => ({
                              ...prev,
                              dateRange: undefined,
                            }));
                          }}
                        >
                          Clear Date Range
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="col-span-6 sm:col-span-6 md:col-span-2 md:ml-8">
              <PreviewSection
                columns={[columnMapping.appointmentDate]}
                previews={processingStatus.previews || {}}
                title={columnMapping.appointmentDate}
              />
            </div>
          </div>

          <div className="md:grid md:grid-cols-6 md:gap-4">
            <div className="col-span-6 sm:col-span-6 md:col-span-4 flex flex-col gap-2">
              <Label htmlFor="appointment-status">Appointment Status</Label>
              <p className="text-sm text-gray-500 mb-2">
                If your file contains a column that represents the status of the
                current appointment (e.g. contains values like "Scheduled",
                "Completed", "Cancelled", etc.), select it here.
              </p>
              <Select
                value={columnMapping.appointmentStatus || "__none__"}
                onValueChange={async (value: string) => {
                  const actualValue = value === "__none__" ? undefined : value;
                  setColumnMapping((prev) => ({
                    ...prev,
                    appointmentStatus: actualValue,
                    selectedStatusValues: actualValue
                      ? prev.selectedStatusValues
                      : undefined,
                  }));
                  if (actualValue) {
                    await fetchUniqueStatusValues(actualValue);
                  } else {
                    setUniqueStatusValues([]);
                    setSelectedStatusValues([]);
                  }
                }}
              >
                <SelectTrigger
                  id="appointment-status"
                  className="w-full bg-white"
                >
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-48 overflow-y-auto">
                  <SelectItem value="__none__">None</SelectItem>
                  {processingStatus.columns?.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {columnMapping.appointmentStatus && (
                <div className="mt-2">
                  <Label htmlFor="status-values">
                    Filter by Status Values (Optional)
                  </Label>
                  <p className="text-sm text-gray-500 mb-2">
                    Select the appointments with specific status values you
                    would like to include in the analysis.
                  </p>
                  <div className="w-full mt-1 rounded-md border border-gray-300 shadow-sm p-2 max-h-48 overflow-y-auto">
                    {uniqueStatusValues.map((value: string) => (
                      <div
                        key={value}
                        className="flex items-center space-x-2 py-1"
                      >
                        <Checkbox
                          id={`status-${value}`}
                          checked={selectedStatusValues.includes(value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const newValues = [
                                ...selectedStatusValues,
                                value,
                              ];
                              setSelectedStatusValues(newValues);
                              setColumnMapping((prev) => ({
                                ...prev,
                                selectedStatusValues: newValues,
                              }));
                            } else {
                              const newValues = selectedStatusValues.filter(
                                (v) => v !== value
                              );
                              setSelectedStatusValues(newValues);
                              setColumnMapping((prev) => ({
                                ...prev,
                                selectedStatusValues: newValues,
                              }));
                            }
                          }}
                        />
                        <label
                          htmlFor={`status-${value}`}
                          className="text-sm text-gray-700"
                        >
                          {value}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedStatusValues.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Please select at least one status value to filter data
                    </p>
                  )}
                  <div className="mt-2 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStatusValues([]);
                        setColumnMapping((prev) => ({
                          ...prev,
                          selectedStatusValues: [],
                        }));
                      }}
                    >
                      Deselect All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStatusValues([...uniqueStatusValues]);
                        setColumnMapping((prev) => ({
                          ...prev,
                          selectedStatusValues: [...uniqueStatusValues],
                        }));
                      }}
                    >
                      Select All
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="col-span-6 sm:col-span-6 md:col-span-2 md:ml-8">
              <PreviewSection
                columns={[columnMapping.appointmentStatus]}
                previews={processingStatus.previews || {}}
                title={columnMapping.appointmentStatus}
              />
            </div>
          </div>
        </div>

        <div className="my-8 border-t border-gray-200"></div>

        <div className="my-8 ">
          <Button
            variant="default"
            className="w-full"
            onClick={handleColumnSelection}
            disabled={
              processingStatus.status === "processing" || !hasValidSelections()
            }
          >
            {processingStatus.status === "processing"
              ? `Processing... (${processingElapsedTime}s)`
              : "Process Selected Columns"}
          </Button>

          <div className="mt-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setColumnMapping({
                  residentIdentifier: "",
                  patientIdentifier: [],
                  appointmentDate: "",
                  appointmentStatus: undefined,
                  patientFirstName: undefined,
                  patientLastName: undefined,
                  patientMiddleName: undefined,
                  patientDateOfBirth: undefined,
                  patientRace: undefined,
                  patientGender: undefined,
                  selectedResidents: [],
                  selectedStatusValues: [],
                  dateRange: undefined,
                });
                setSelectedResidents([]);
                setSelectedStatusValues([]);
                setDateRange(null);
                setValidationStatus({
                  residentIdentifier: null,
                  patientIdentifier: null,
                  appointmentDate: null,
                });
              }}
            >
              Reset All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
