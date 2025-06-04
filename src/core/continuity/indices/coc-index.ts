import * as pl from "nodejs-polars";
import {
  CocIndexResult,
  PatientContinuityScores,
} from "../types/continuity-types";

/**
 * Calculates the Bice-Boxerman Continuity of Care (CoC) index
 *
 * Formula: CoC = (∑(n_i^2) - N) / (N(N-1))
 * where:
 * - n_i is the number of visits to provider i
 * - N is the total number of visits
 * - k is the number of providers
 *
 * CoC should not be calculated for patients with only one visit total
 *
 * @param df DataFrame containing patient and provider data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @returns Average CoC index across all patients, percentage with CoC >= 0.7, or undefined if no valid patients
 */
export function calculateCocIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[]
): CocIndexResult {
  try {
    if (df.height === 0) {
      return {
        averageCoc: 0,
        patientCocScores: {},
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
        averageCoc: 0,
        patientCocScores: {},
      };
    }

    let totalCocSum = 0;
    let patientCount = 0;
    const patientCocScores: PatientContinuityScores = {};

    for (const [patientId, providers] of patientMap.entries()) {
      if (providers.length === 0 || providers.length === 1) {
        continue;
      }

      const totalVisits = providers.length;
      const providerCounts = new Map<string, number>();

      for (const provider of providers) {
        providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
      }

      const sumOfSquares = Array.from(providerCounts.values()).reduce(
        (sum, count) => sum + Math.pow(count, 2),
        0
      );

      const patientCoc =
        (sumOfSquares - totalVisits) / (totalVisits * (totalVisits - 1));

      patientCocScores[patientId] = patientCoc;
      totalCocSum += patientCoc;
      patientCount++;
    }

    // Calculate average CoC across all patients (excluding those with only one visit)
    const averageCoc =
      patientCount > 0 ? totalCocSum / patientCount : undefined;

    return {
      averageCoc,
      patientCocScores,
    };
  } catch (error) {
    console.error("Error calculating CoC index:", error);
    return {
      averageCoc: undefined,
      patientCocScores: {},
    };
  }
}
