import * as pl from "nodejs-polars";
import {
  PatientContinuityScores,
  SeconIndexResult,
} from "../types/continuity-types";

/**
 * Calculates the Sequential Continuity of Care (SECON) index
 *
 * The SECON index, introduced by Steinwachs (1979) and further refined by Roos et al. (1998),
 * measures continuity of care by focusing on the sequence of provider visits rather than just
 * the concentration of visits. It specifically captures the frequency of handoffs between providers.
 *
 * Key characteristics of SECON:
 * - Measures the sequential nature of provider continuity
 * - Is dependent on the sequential order of visits (unlike UPC and CoC)
 * - Ranges from 0 to 1, where:
 *   - 0 occurs when each sequential visit pair is to a different provider (maximum handoffs)
 *   - 1 occurs when all sequential visits are to the same provider (no handoffs)
 * - A patient who alternates between two providers will have a SECON score of 0,
 *   even though they may have a high UPC or CoC index
 *
 * Formula: SECON = ∑(si) / (N-1)
 * where:
 * - N is the total number of visits
 * - si is an indicator variable equal to 1 if visits i and i+1 are to the same provider, 0 otherwise
 *
 * SECON should not be calculated for patients with fewer than 2 visits (as it requires at least one sequential pair)
 *
 * References:
 * - Steinwachs D. (1979). Measuring provider continuity in ambulatory care. Medical Care, 17(6), 551-565.
 * - Roos L.L., Roos N.P., Gilbert P., Nicol J.P. (1980). Continuity of care: does it contribute to quality
 *   of care? Medical Care, 18(2), 174-184.
 * - Roos et al. (1998) compared SECON with other continuity measures and found it was easier to interpret
 *   and more sensitive to the sequence of visits.
 *
 * @param df DataFrame containing patient and provider data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @returns Average SECON index across all patients, percentage with SECON >= 0.7, and individual patient scores
 */
export function calculateSeconIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[]
): SeconIndexResult {
  try {
    // Verify the provider column exists
    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        averageSecon: undefined,
        patientSeconScores: {},
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
        averageSecon: undefined,
        patientSeconScores: {},
      };
    }

    if (df.height === 0) {
      return {
        averageSecon: 0,
        patientSeconScores: {},
      };
    }

    // Note: Records are assumed to be in chronological order within each patient
    // This is a critical assumption for SECON since it depends on visit sequence
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
        averageSecon: 0,
        patientSeconScores: {},
      };
    }

    let totalSeconSum = 0;
    let patientCount = 0;
    const patientSeconScores: PatientContinuityScores = {};

    for (const [patientId, providers] of patientMap.entries()) {
      if (providers.length < 2) {
        continue;
      }

      const totalVisits = providers.length;
      let sameProviderSequences = 0;

      for (let i = 0; i < totalVisits - 1; i++) {
        if (providers[i] === providers[i + 1]) {
          sameProviderSequences++;
        }
      }

      const patientSecon = sameProviderSequences / (totalVisits - 1);
      patientSeconScores[patientId] = patientSecon;
      totalSeconSum += patientSecon;
      patientCount++;
    }

    // Calculate average SECON across all patients (excluding those with only one visit)
    const averageSecon =
      patientCount > 0 ? totalSeconSum / patientCount : undefined;

    return {
      averageSecon,
      patientSeconScores,
    };
  } catch (error) {
    console.error("Error calculating SECON index:", error);
    return {
      averageSecon: undefined,
      patientSeconScores: {},
    };
  }
}
