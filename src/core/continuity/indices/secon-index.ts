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
 * @param dateColumn Column name containing visit dates for chronological sorting (required)
 * @returns Average SECON index across all patients, percentage with SECON >= 0.7, and individual patient scores
 */
export function calculateSeconIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[],
  dateColumn: string
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

    // Verify the date column exists (required for SECON)
    if (!df.columns.includes(dateColumn)) {
      console.error(
        `Date column '${dateColumn}' not found in DataFrame. SECON requires chronological ordering.`
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

    const validProviders = df.filter(
      pl
        .col(providerColumn)
        .isNotNull()
        .and(pl.col(providerColumn).neq(pl.lit("")))
    );

    if (validProviders.height === 0) {
      return {
        averageSecon: 0,
        patientSeconScores: {},
      };
    }

    let workingDf = validProviders;
    let patientIdCol = "patient_id";

    if (patientIdentifierColumns.length > 1) {
      // Concatenate patient identifier columns with | separator
      const concatExpr = patientIdentifierColumns
        .map((col) => pl.col(col).fillNull("").cast(pl.Utf8))
        .reduce((acc, col) => acc.add(pl.lit("|")).add(col));

      workingDf = workingDf.withColumn(concatExpr.alias(patientIdCol));
    } else {
      patientIdCol = patientIdentifierColumns[0];
    }

    // IMPORTANT: SECON requires visits to be in chronological order
    // Sort by patient and date to ensure chronological order within each patient
    workingDf = workingDf.sort([patientIdCol, dateColumn]);

    const withPrevProvider = workingDf.withColumn(
      pl.col(providerColumn).shift(1).over(patientIdCol).alias("prev_provider")
    );

    const withSameProvider = withPrevProvider.withColumn(
      pl
        .when(pl.col("prev_provider").isNotNull())
        .then(pl.col(providerColumn).eq(pl.col("prev_provider")).cast(pl.Int32))
        .otherwise(pl.lit(null))
        .alias("same_provider")
    );

    const seconByPatient = withSameProvider
      .groupBy(patientIdCol)
      .agg(
        pl.col("same_provider").sum().alias("same_provider_count"),
        pl.col("same_provider").count().alias("sequence_pairs")
      );

    const eligiblePatients = seconByPatient.filter(
      pl.col("sequence_pairs").gt(0)
    );

    if (eligiblePatients.height === 0) {
      return {
        averageSecon: undefined,
        patientSeconScores: {},
      };
    }

    const seconScores = eligiblePatients
      .withColumn(
        pl
          .col("same_provider_count")
          .cast(pl.Float64)
          .div(pl.col("sequence_pairs").cast(pl.Float64))
          .alias("secon_score")
      )
      .select([patientIdCol, "secon_score"]);

    const patientSeconScores: PatientContinuityScores = {};
    const scoresRecords = seconScores.toRecords();

    scoresRecords.forEach((row) => {
      const patientId = row[patientIdCol] as string;
      const seconScore = row.secon_score as number;
      if (patientId && typeof seconScore === "number") {
        patientSeconScores[patientId] = seconScore;
      }
    });

    const avgSeconDf = seconScores.select(pl.col("secon_score").mean());
    const averageSecon = avgSeconDf.getColumn("secon_score").get(0) as number;

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
