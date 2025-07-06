import { ipcMain } from "electron";
import { getCurrentDataFrame, setCurrentDataFrame } from "./file-handlers";
import { getPolars, calculateAppointmentDistribution } from "./shared";
import {
  isExcelDateSerial,
  excelDateToJSDate,
} from "../../core/data/loaders/excel-loader";
import { filterDataFrameByDateRange } from "../../core/continuity/utils/date-filter";
import { filterDataFrameByStatus } from "../../core/continuity/utils/status-filter";
import { calculateUpcIndex } from "../../core/continuity/indices/upc-index";
import { calculateCocIndex } from "../../core/continuity/indices/coc-index";
import { calculateSeconIndex } from "../../core/continuity/indices/secon-index";
import { calculateMmciIndex } from "../../core/continuity/indices/mmci-index";

interface ValidationResult {
  isValid: boolean;
  status: "valid" | "warning" | "error";
  message?: string;
}

/**
 * Determines if a column contains primarily Excel date serial numbers.
 * Samples the first 100 values for performance on large datasets.
 *
 * @param values - Array of column values to analyze
 * @returns True if more than 50% of sampled values are Excel dates
 */
function containsExcelDates(values: unknown[]): boolean {
  const sampleSize = Math.min(100, values.length);
  const sample = values.slice(0, sampleSize);
  const excelDateCount = sample.filter((val) => isExcelDateSerial(val)).length;
  return excelDateCount > sampleSize * 0.5;
}

/**
 * Converts a value to a display-friendly string, handling Excel dates.
 *
 * @param value - Value to convert for display
 * @returns String representation with Excel dates converted to ISO format
 */
function convertValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (isExcelDateSerial(value)) {
    try {
      const jsDate = excelDateToJSDate(value as number);
      return jsDate.toISOString().split("T")[0];
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function validateColumn(
  columnName: string,
  columnType: "identifier" | "date"
): ValidationResult {
  const currentDf = getCurrentDataFrame();

  if (!currentDf || !currentDf.columns.includes(columnName)) {
    return { isValid: false, status: "error", message: "Column not found" };
  }

  const values = currentDf.getColumn(columnName).toArray();

  if (columnType === "identifier") {
    const emptyCount = values.filter(
      (val: unknown) => val === "" || val === null || val === undefined
    ).length;
    const invalidTypeCount = values.filter((val: unknown) => {
      if (val === null || val === undefined || val === "") return false;
      const valType = typeof val;
      return valType !== "string" && valType !== "number";
    }).length;

    // Invalid types prevent proper data processing, while nulls can be filtered
    const hasInvalidTypes = invalidTypeCount > 0;
    const hasNullsOrEmpties = emptyCount > 0;

    if (hasInvalidTypes) {
      return {
        isValid: false,
        status: "error",
        message: `Invalid data: ${invalidTypeCount} values that are not strings or numbers`,
      };
    } else if (hasNullsOrEmpties) {
      return {
        isValid: true,
        status: "warning",
        message: `Warning: ${emptyCount} empty/null values found`,
      };
    }

    return {
      isValid: true,
      status: "valid",
      message: "Valid identifier column",
    };
  } else if (columnType === "date") {
    interface DateValidationIssues {
      nullCount: number;
      invalidTypeCount: number;
      invalidDateCount: number;
      examples: string[];
    }

    const dateIssues = values.reduce(
      (acc: DateValidationIssues, val: unknown) => {
        if (!val) {
          acc.nullCount++;
        } else if (typeof val !== "string" && typeof val !== "number") {
          acc.invalidTypeCount++;
        } else {
          const date = new Date(val);
          if (!(date instanceof Date) || isNaN(date.getTime())) {
            acc.invalidDateCount++;
            if (acc.examples.length < 3) {
              acc.examples.push(String(val));
            }
          }
        }
        return acc;
      },
      { nullCount: 0, invalidTypeCount: 0, invalidDateCount: 0, examples: [] }
    );

    // Date filtering requires parseable dates, but can handle some nulls
    const hasInvalidData =
      dateIssues.invalidTypeCount > 0 || dateIssues.invalidDateCount > 0;
    const hasNulls = dateIssues.nullCount > 0;

    if (hasInvalidData) {
      const errorParts = [];
      if (dateIssues.invalidTypeCount > 0) {
        errorParts.push(
          `${dateIssues.invalidTypeCount} values of incorrect type`
        );
      }
      if (dateIssues.invalidDateCount > 0) {
        errorParts.push(`${dateIssues.invalidDateCount} invalid dates`);
        if (dateIssues.examples.length > 0) {
          errorParts.push(
            `Examples of invalid values: ${dateIssues.examples.join(", ")}`
          );
        }
      }
      return {
        isValid: false,
        status: "error",
        message: `Invalid data: ${errorParts.join(", ")}`,
      };
    } else if (hasNulls) {
      return {
        isValid: true,
        status: "warning",
        message: `Warning: ${dateIssues.nullCount} null/empty values found`,
      };
    }

    return {
      isValid: true,
      status: "valid",
      message: "Valid date column",
    };
  }

  return {
    isValid: false,
    status: "error",
    message: "Invalid column type specified",
  };
}

/**
 * Register data processing related IPC handlers
 */
export function registerDataHandlers() {
  ipcMain.handle(
    "getColumnPreview",
    async (_event, filePath: string, columnName: string) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          currentDf = getPolars().readCSV(filePath);
          setCurrentDataFrame(currentDf);
        }

        if (!currentDf.columns.includes(columnName)) {
          throw new Error(`Column "${columnName}" not found in CSV file`);
        }

        const allValues = currentDf
          .select(columnName)
          .getColumn(columnName)
          .toArray();

        // Check if column contains Excel dates and convert for display
        const hasExcelDates = containsExcelDates(allValues);

        const convertedValues = hasExcelDates
          ? allValues.map(convertValueForDisplay)
          : allValues.map((val: unknown) =>
              val === null ? "null" : String(val)
            );

        const uniqueValues = Array.from(new Set(convertedValues))
          .filter((val) => val !== "null")
          .sort();

        const preview = convertedValues.slice(0, 3);

        return {
          success: true,
          preview: preview,
          uniqueValues: uniqueValues,
        };
      } catch (error) {
        console.error("Error getting column preview:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Error getting preview",
        };
      }
    }
  );

  ipcMain.handle(
    "validateColumn",
    async (
      _event,
      filePath: string,
      columnName: string,
      columnType: "identifier" | "date"
    ) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          currentDf = getPolars().readCSV(filePath);
          setCurrentDataFrame(currentDf);
        }

        const result = validateColumn(columnName, columnType);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error("Error validating column:", error);
        return {
          success: false,
          isValid: false,
          message:
            error instanceof Error ? error.message : "Error validating column",
        };
      }
    }
  );

  ipcMain.handle(
    "returnSelectedColumns",
    async (
      _event,
      filePath: string,
      columnMapping: {
        residentIdentifier: string;
        patientIdentifier: string[];
        appointmentDate: string;
        appointmentStatus?: string;
        patientFirstName?: string;
        patientLastName?: string;
        patientMiddleName?: string;
        patientDateOfBirth?: string;
        selectedStatusValues?: string[];
        selectedResidents?: string[];
        dateRange?: {
          start: string;
          end: string;
        };
      }
    ) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          console.log("No DataFrame available, attempting to read from file");
          if (filePath) {
            try {
              currentDf = getPolars().readCSV(filePath);
              setCurrentDataFrame(currentDf);
              console.log(
                `Successfully read ${currentDf.height} rows from ${filePath}`
              );
            } catch (error) {
              console.error("Error reading CSV file:", error);
              throw new Error("Failed to read data file");
            }
          } else {
            throw new Error("No data loaded");
          }
        }

        // Baseline metrics calculated before filtering to show impact of filters
        const totalResidents = new Set(
          currentDf.getColumn(columnMapping.residentIdentifier).toArray()
        ).size;

        const totalPatientIds = new Set<string>();
        columnMapping.patientIdentifier.forEach((column: string) => {
          const columnValues = currentDf.getColumn(column).toArray();
          columnValues.forEach((value: string) => totalPatientIds.add(value));
        });
        const totalPatients = totalPatientIds.size;

        const totalUpcIndex = calculateUpcIndex(
          currentDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const totalCocResult = calculateCocIndex(
          currentDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const totalSeconResult = calculateSeconIndex(
          currentDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const totalMmciResult = calculateMmciIndex(
          currentDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const totalAppointmentDistribution = calculateAppointmentDistribution(
          currentDf,
          columnMapping.patientIdentifier[0]
        );

        let filteredDf = currentDf;

        // Apply resident filter
        if (columnMapping.selectedResidents?.length) {
          filteredDf = filteredDf.filter(
            getPolars()
              .col(columnMapping.residentIdentifier)
              .isIn(columnMapping.selectedResidents)
          );
        }

        // Apply status filter
        if (
          columnMapping.appointmentStatus &&
          columnMapping.selectedStatusValues?.length
        ) {
          filteredDf = filterDataFrameByStatus(
            filteredDf,
            columnMapping.appointmentStatus,
            columnMapping.selectedStatusValues
          );
        }

        // Apply date range filter
        if (columnMapping.dateRange && columnMapping.appointmentDate) {
          filteredDf = filterDataFrameByDateRange(
            filteredDf,
            columnMapping.appointmentDate,
            columnMapping.dateRange.start,
            columnMapping.dateRange.end
          );
        }

        // Calculate filtered statistics
        const filteredResidents = new Set(
          filteredDf.getColumn(columnMapping.residentIdentifier).toArray()
        ).size;

        const filteredPatientIds = new Set<string>();
        columnMapping.patientIdentifier.forEach((column: string) => {
          const columnValues = filteredDf.getColumn(column).toArray();
          columnValues.forEach((value: string) =>
            filteredPatientIds.add(value)
          );
        });
        const filteredPatients = filteredPatientIds.size;

        // Calculate filtered continuity indices
        const filteredUpcIndex = calculateUpcIndex(
          filteredDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const filteredCocResult = calculateCocIndex(
          filteredDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const filteredSeconResult = calculateSeconIndex(
          filteredDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        const filteredMmciResult = calculateMmciIndex(
          filteredDf,
          columnMapping.residentIdentifier,
          columnMapping.patientIdentifier
        );

        // Calculate filtered appointment distribution
        const filteredAppointmentDistribution = calculateAppointmentDistribution(
          filteredDf,
          columnMapping.patientIdentifier[0]
        );

        const appliedFilters = [];
        if (columnMapping.selectedResidents?.length) {
          appliedFilters.push({
            field: "selectedResidents",
            values: columnMapping.selectedResidents,
          });
        }
        if (columnMapping.selectedStatusValues?.length) {
          appliedFilters.push({
            field: "selectedStatusValues",
            values: columnMapping.selectedStatusValues,
          });
        }
        if (columnMapping.dateRange) {
          appliedFilters.push({
            field: "dateRange",
            values: [
              `${columnMapping.dateRange.start} to ${columnMapping.dateRange.end}`,
            ],
          });
        }

        return {
          success: true,
          message: "Data processed successfully",
          statistics: {
            filtered: {
              uniqueResidents: filteredResidents,
              uniquePatients: filteredPatients,
              totalAppointments: filteredDf.height,
              upcIndex: filteredUpcIndex.averageUpc,
              cocIndex: filteredCocResult.averageCoc,
              seconIndex: filteredSeconResult.averageSecon,
              mmciIndex: filteredMmciResult.averageMmci,
              appointmentCountDistribution: filteredAppointmentDistribution,
            },
            total: {
              uniqueResidents: totalResidents,
              uniquePatients: totalPatients,
              totalAppointments: currentDf.height,
              upcIndex: totalUpcIndex.averageUpc,
              cocIndex: totalCocResult.averageCoc,
              seconIndex: totalSeconResult.averageSecon,
              mmciIndex: totalMmciResult.averageMmci,
              appointmentCountDistribution: totalAppointmentDistribution,
            },
            appliedFilters: appliedFilters,
          },
          filePath: filePath,
        };
      } catch (error) {
        console.error("Error processing data:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Error processing data",
          statistics: {
            filtered: {
              uniqueResidents: 0,
              uniquePatients: 0,
              totalAppointments: 0,
            },
            total: {
              uniqueResidents: 0,
              uniquePatients: 0,
              totalAppointments: 0,
            },
            appliedFilters: [],
          },
        };
      }
    }
  );
}
