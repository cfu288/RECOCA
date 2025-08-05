import { ipcMain } from "electron";
import { getCurrentDataFrame } from "./file-handlers";
import { getPolars } from "./shared";
import { convertValueToDateString } from "./utils/date-converter";
import {
  calculateTopProviders,
  PatientVisitRecord,
} from "../../core/data/services/top-providers-core";
import {
  mapProvidersToPatients as mapProvidersToPatientsCore,
  PatientRecord,
} from "../../core/data/processors/provider-patient-mapping";
import { filterDataFrameByDateRange } from "../../core/continuity/utils/date-filter";
import { filterDataFrameByStatus } from "../../core/continuity/utils/status-filter";
import { calculateUpcIndex } from "../../core/continuity/indices/upc-index";
import { calculateCocIndex } from "../../core/continuity/indices/coc-index";
import { calculateSeconIndex } from "../../core/continuity/indices/secon-index";
import { calculateMmciIndex } from "../../core/continuity/indices/mmci-index";
import { calculateRollingContIndex } from "../../core/continuity/indices/rolling-cont-index";

/**
 * Apply filters to a DataFrame based on column mapping configuration.
 */
function applyFilters(df: any, columnMapping: any) {
  let dfToUse = df;

  if (columnMapping) {
    // Apply resident filter
    if (columnMapping.selectedResidents?.length) {
      dfToUse = dfToUse.filter(
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
      dfToUse = filterDataFrameByStatus(
        dfToUse,
        columnMapping.appointmentStatus,
        columnMapping.selectedStatusValues
      );
    }

    // Apply date range filter
    if (columnMapping.dateRange && columnMapping.appointmentDate) {
      dfToUse = filterDataFrameByDateRange(
        dfToUse,
        columnMapping.appointmentDate,
        columnMapping.dateRange.start,
        columnMapping.dateRange.end
      );
    }
  }

  return dfToUse;
}

/**
 * Register analytics handlers
 */
export function registerAnalyticsHandlers() {
  ipcMain.handle(
    "forPatientIdGetTopProviders",
    async (
      _event,
      filePath: string,
      patientIdCol: string,
      providerIdCol: string,
      columnMapping?: any
    ) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          if (!filePath || filePath.trim() === "") {
            console.warn("No DataFrame available and no filePath provided");
            return {};
          }
          try {
            currentDf = getPolars().readCSV(filePath);
          } catch (error) {
            console.error("Error reading CSV file:", error);
            return {};
          }
        }

        const dfToUse = applyFilters(currentDf, columnMapping);
        const records = dfToUse.toRecords();

        const patientVisitRecords: PatientVisitRecord[] = records
          .map((record: any) => {
            if (record[patientIdCol] == null || record[providerIdCol] == null) {
              return null;
            }
            return {
              patientId: String(record[patientIdCol]),
              providerId: String(record[providerIdCol]),
            };
          })
          .filter(
            (record: PatientVisitRecord | null): record is PatientVisitRecord =>
              record !== null
          );

        const result = calculateTopProviders(patientVisitRecords);

        return result;
      } catch (error) {
        console.error("Error in forPatientIdGetTopProviders:", error);
        return {};
      }
    }
  );

  ipcMain.handle(
    "mapProvidersToPatients",
    async (
      _event,
      filePath: string,
      providerIdCol: string,
      patientIdCol: string,
      patientFirstNameCol?: string,
      patientLastNameCol?: string,
      patientMiddleNameCol?: string,
      patientDateOfBirthCol?: string,
      patientRaceCol?: string,
      patientGenderCol?: string,
      columnMapping?: any
    ) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          if (!filePath || filePath.trim() === "") {
            console.warn("No DataFrame available and no filePath provided");
            return {
              providerToPatients: {},
              patientToProvider: {},
            };
          }
          try {
            currentDf = getPolars().readCSV(filePath);
          } catch (error) {
            console.error("Error reading CSV file:", error);
            return {
              providerToPatients: {},
              patientToProvider: {},
            };
          }
        }

        const dfToUse = applyFilters(currentDf, columnMapping);
        const records = dfToUse.toRecords();

        // Convert records to the format expected by the core algorithm
        const patientRecords: PatientRecord[] = records
          .map((record: any) => {
            if (record[patientIdCol] == null || record[providerIdCol] == null) {
              return null;
            }

            const patientRecord: PatientRecord = {
              patientId: String(record[patientIdCol]),
              providerId: String(record[providerIdCol]),
            };

            // Add optional patient information if columns are provided
            if (patientFirstNameCol && record[patientFirstNameCol]) {
              patientRecord.firstName = String(record[patientFirstNameCol]);
            }
            if (patientLastNameCol && record[patientLastNameCol]) {
              patientRecord.lastName = String(record[patientLastNameCol]);
            }
            if (patientMiddleNameCol && record[patientMiddleNameCol]) {
              patientRecord.middleName = String(record[patientMiddleNameCol]);
            }
            if (patientDateOfBirthCol && record[patientDateOfBirthCol]) {
              patientRecord.dateOfBirth = convertValueToDateString(
                record[patientDateOfBirthCol]
              );
            }
            if (patientRaceCol && record[patientRaceCol]) {
              patientRecord.race = String(record[patientRaceCol]);
            }
            if (patientGenderCol && record[patientGenderCol]) {
              patientRecord.gender = String(record[patientGenderCol]);
            }

            return patientRecord;
          })
          .filter(
            (record: PatientRecord | null): record is PatientRecord =>
              record !== null
          );

        const result = mapProvidersToPatientsCore(patientRecords);

        return result;
      } catch (error) {
        console.error("Error in mapProvidersToPatients:", error);
        return {
          providerToPatients: {},
          patientToProvider: {},
        };
      }
    }
  );

  // Continuity indices calculations
  ipcMain.handle(
    "calculateContinuityIndices",
    async (
      _event,
      filePath: string,
      providerColumn: string,
      patientColumns: string[],
      columnMapping?: any
    ) => {
      try {
        let currentDf = getCurrentDataFrame();

        if (!currentDf) {
          if (!filePath) {
            throw new Error("No data loaded");
          }
          currentDf = getPolars().readCSV(filePath);
        }

        const dfToUse = applyFilters(currentDf, columnMapping);

        // Calculate all continuity indices
        const upcResult = calculateUpcIndex(
          dfToUse,
          providerColumn,
          patientColumns
        );
        const cocResult = calculateCocIndex(
          dfToUse,
          providerColumn,
          patientColumns
        );
        // SECON requires a date column for chronological ordering
        const seconResult = columnMapping?.appointmentDate
          ? calculateSeconIndex(
              dfToUse,
              providerColumn,
              patientColumns,
              columnMapping.appointmentDate
            )
          : { averageSecon: undefined, patientSeconScores: {} };

        if (!columnMapping?.appointmentDate) {
          console.warn(
            "Date column not provided - SECON index calculation skipped"
          );
        }
        const mmciResult = calculateMmciIndex(
          dfToUse,
          providerColumn,
          patientColumns
        );

        return {
          upc: upcResult,
          coc: cocResult,
          secon: seconResult,
          mmci: mmciResult,
        };
      } catch (error) {
        console.error("Error calculating continuity indices:", error);
        throw error;
      }
    }
  );
}
