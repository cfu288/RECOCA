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

    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        averageMmci: undefined,
        patientMmciScores: {},
      };
    }

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

    const validProviders = df.filter(
      pl
        .col(providerColumn)
        .isNotNull()
        .and(pl.col(providerColumn).neq(pl.lit("")))
    );

    if (validProviders.height === 0) {
      return {
        averageMmci: 0,
        patientMmciScores: {},
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

    const patientStats = workingDf
      .groupBy(patientIdCol)
      .agg(
        pl.len().alias("total_visits"),
        pl.col(providerColumn).nUnique().alias("unique_providers")
      );

    const eligiblePatients = patientStats.filter(
      pl.col("total_visits").gtEq(2)
    );

    if (eligiblePatients.height === 0) {
      return {
        averageMmci: undefined,
        patientMmciScores: {},
      };
    }

    // Calculate MMCI for each patient
    // MMCI = (1 - (Number of Providers / (Number of Visits + 0.1))) /
    //        (1 - (1 / (Number of Visits + 0.1)))
    const mmciScores = eligiblePatients
      .withColumn(pl.col("total_visits").add(0.1).alias("adjusted_visits"))
      .withColumn(
        pl
          .lit(1)
          .sub(
            pl
              .col("unique_providers")
              .cast(pl.Float64)
              .div(pl.col("adjusted_visits"))
          )
          .alias("numerator")
      )
      .withColumn(
        pl
          .lit(1)
          .sub(pl.lit(1).div(pl.col("adjusted_visits")))
          .alias("denominator")
      )
      .withColumn(
        pl
          .when(pl.col("denominator").neq(0))
          .then(pl.col("numerator").div(pl.col("denominator")))
          .otherwise(pl.lit(0))
          .alias("mmci_raw")
      )
      .withColumn(
        // Ensure the score is between 0 and 1
        pl
          .when(pl.col("mmci_raw").lt(0))
          .then(pl.lit(0))
          .when(pl.col("mmci_raw").gt(1))
          .then(pl.lit(1))
          .otherwise(pl.col("mmci_raw"))
          .alias("mmci_score")
      )
      .select([patientIdCol, "mmci_score"]);

    const patientMmciScores: PatientContinuityScores = {};
    const scoresRecords = mmciScores.toRecords();

    scoresRecords.forEach((row) => {
      const patientId = row[patientIdCol] as string;
      const mmciScore = row.mmci_score as number;
      if (patientId && typeof mmciScore === "number") {
        patientMmciScores[patientId] = mmciScore;
      }
    });

    const avgMmciDf = mmciScores.select(pl.col("mmci_score").mean());
    const averageMmci = avgMmciDf.getColumn("mmci_score").get(0) as number;

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
