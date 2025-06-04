import * as pl from "nodejs-polars";
import {
  PatientContinuityScores,
  UpcIndexResult,
} from "../types/continuity-types";

/**
 * Calculates the Usual Provider of Care (UPC) index
 *
 * UPC measures the proportion of a patient's visits with their most frequent provider
 * Formula: UPC = max(n1, n2, ..., nk) / N
 * where max(n1, n2, ..., nk) is the highest number of visits to a single provider
 * and N is the total number of visits
 *
 * UPC should not be calculated for patients with only one visit total
 *
 * @param df DataFrame containing patient and provider data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @returns Average UPC index across all patients, or undefined if no valid patients
 */
export function calculateUpcIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[]
): UpcIndexResult {
  try {
    if (df.height === 0) {
      return {
        averageUpc: 0,
        patientUpcScores: {},
      };
    }

    const patientMap = new Map<string, string[]>();
    const records = df.toRecords();

    records.forEach((row: Record<string, string>) => {
      const patientValues = patientIdentifierColumns.map(
        (col) => row[col] || ""
      );
      const compositePatientId = patientValues.join("|");

      const provider = row[providerColumn];
      if (provider) {
        if (!patientMap.has(compositePatientId)) {
          patientMap.set(compositePatientId, []);
        }
        patientMap.get(compositePatientId)!.push(provider);
      }
    });

    if (patientMap.size === 0) {
      return {
        averageUpc: 0,
        patientUpcScores: {},
      };
    }

    let totalUpcSum = 0;
    let patientCount = 0;
    const patientUpcScores: PatientContinuityScores = {};

    for (const [patientId, providers] of patientMap.entries()) {
      if (providers.length === 0) {
        continue;
      }

      if (providers.length === 1) {
        continue;
      }

      const totalVisits = providers.length;
      const providerCounts = new Map<string, number>();

      for (const provider of providers) {
        providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
      }

      const maxVisitsToSingleProvider = Math.max(
        ...Array.from(providerCounts.values())
      );

      const patientUpc = maxVisitsToSingleProvider / totalVisits;
      patientUpcScores[patientId] = patientUpc;
      totalUpcSum += patientUpc;
      patientCount++;
    }

    // Calculate average UPC across all patients (excluding those with only one visit)
    const averageUpc =
      patientCount > 0 ? totalUpcSum / patientCount : undefined;

    return {
      averageUpc,
      patientUpcScores,
    };
  } catch (error) {
    console.error("Error calculating UPC index:", error);
    return {
      averageUpc: undefined,
      patientUpcScores: {},
    };
  }
}
