import * as pl from "nodejs-polars";
import {
  PatientContinuityScores,
  MmciIndexResult,
} from "../types/continuity-types";

/**
 * Calculates the Modified Modified Continuity Index (MMCI)
 *
 * MMCI quantifies continuity of care with values from 0 (no continuity) to 1 (perfect continuity).
 * Less sensitive to provider count than other indices, making it suitable for residency training sites.
 *
 * Formula: MMCI = (1 - (Providers / (Visits + 0.1))) / (1 - (1 / (Visits + 0.1)))
 *
 * The 0.1 adjustment prevents division by zero and ensures smooth scaling.
 * Requires ≥2 visits per patient to avoid score inflation.
 *
 * Examples:
 * - 2 visits, 1 provider: MMCI = 1.00
 * - 2 visits, 2 providers (1,1): MMCI = 0.10
 * - 5 visits, 2 providers (3,2): MMCI = 0.76
 *
 * @ref https://cdn-uat.mdedge.com/files/s3fs-public/jfp-archived-issues/1987-volume_24-25/JFP_1987-02_v24_i2_a-new-method-for-measuring-continuity-of.pdf
 * @param df DataFrame containing patient and provider data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @returns Average MMCI index across all patients, and individual patient scores
 */
export function calculateMmciIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[]
): MmciIndexResult {
  try {
    if (df.height === 0) {
      return {
        averageMmci: 0,
        patientMmciScores: {},
      };
    }

    // Verify the provider column exists
    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        averageMmci: undefined,
        patientMmciScores: {},
      };
    }

    // Verify at least one patient identifier column exists
    const missingColumns = patientIdentifierColumns.filter(
      (col) => !df.columns.includes(col)
    );
    if (missingColumns.length > 0) {
      console.error(
        `Patient identifier column(s) not found: ${missingColumns.join(", ")}`
      );
      return {
        averageMmci: undefined,
        patientMmciScores: {},
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
        averageMmci: 0,
        patientMmciScores: {},
      };
    }

    let totalMmciSum = 0;
    let patientCount = 0;
    const patientMmciScores: PatientContinuityScores = {};

    for (const [patientId, providers] of patientMap.entries()) {
      // Skip patients with <2 visits
      if (providers.length < 2) {
        continue;
      }

      const totalVisits = providers.length;

      // Count unique providers
      const uniqueProviders = new Set(providers);
      const numProviders = uniqueProviders.size;

      // Calculate MMCI according to the formula
      // MMCI = (1 - (Number of Providers / (Number of Visits + 0.1))) /
      //        (1 - (1 / (Number of Visits + 0.1)))
      const adjustedVisits = totalVisits + 0.1;
      const numerator = 1 - numProviders / adjustedVisits;
      const denominator = 1 - 1 / adjustedVisits;

      const patientMmci = denominator !== 0 ? numerator / denominator : 0;

      // Ensure the score is between 0 and 1
      const boundedMmci = Math.max(0, Math.min(1, patientMmci));

      patientMmciScores[patientId] = boundedMmci;
      totalMmciSum += boundedMmci;
      patientCount++;
    }

    // Calculate average MMCI across all patients
    const averageMmci =
      patientCount > 0 ? totalMmciSum / patientCount : undefined;

    return {
      averageMmci,
      patientMmciScores,
    };
  } catch (error) {
    console.error("Error calculating MMCI index:", error);
    return {
      averageMmci: undefined,
      patientMmciScores: {},
    };
  }
}
