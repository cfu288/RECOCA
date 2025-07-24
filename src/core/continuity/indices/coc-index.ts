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

    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        averageCoc: undefined,
        patientCocScores: {},
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
        averageCoc: undefined,
        patientCocScores: {},
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
        averageCoc: 0,
        patientCocScores: {},
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

    const patientProviderCounts = workingDf
      .groupBy([patientIdCol, providerColumn])
      .agg(pl.len().alias("visit_count"));

    const countCol = "visit_count";

    const patientStats = patientProviderCounts.groupBy(patientIdCol).agg(
      pl.col(countCol).sum().alias("total_visits"),
      // Sum of squares: ∑(n_i^2)
      pl.col(countCol).pow(2).sum().alias("sum_of_squares")
    );

    const eligiblePatients = patientStats.filter(pl.col("total_visits").gt(1));

    if (eligiblePatients.height === 0) {
      return {
        averageCoc: undefined,
        patientCocScores: {},
      };
    }

    // Calculate CoC for each patient
    // Formula: CoC = (∑(n_i^2) - N) / (N(N-1))
    const cocScores = eligiblePatients
      .withColumn(
        pl
          .col("sum_of_squares")
          .cast(pl.Float64)
          .sub(pl.col("total_visits").cast(pl.Float64))
          .div(
            pl
              .col("total_visits")
              .cast(pl.Float64)
              .mul(pl.col("total_visits").cast(pl.Float64).sub(1))
          )
          .alias("coc_score")
      )
      .select([patientIdCol, "coc_score"]);

    const patientCocScores: PatientContinuityScores = {};
    const scoresRecords = cocScores.toRecords();

    scoresRecords.forEach((row) => {
      const patientId = row[patientIdCol] as string;
      const cocScore = row.coc_score as number;
      if (patientId && typeof cocScore === "number") {
        patientCocScores[patientId] = cocScore;
      }
    });

    const avgCocDf = cocScores.select(pl.col("coc_score").mean());
    const averageCoc = avgCocDf.getColumn("coc_score").get(0) as number;

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
