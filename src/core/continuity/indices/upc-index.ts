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

    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        averageUpc: undefined,
        patientUpcScores: {},
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
        averageUpc: undefined,
        patientUpcScores: {},
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
        averageUpc: 0,
        patientUpcScores: {},
      };
    }

    let workingDf = validProviders;
    let patientIdCol = "patient_id";
    
    if (patientIdentifierColumns.length > 1) {
      // Concatenate patient identifier columns with | separator
      const concatExpr = patientIdentifierColumns
        .map(col => pl.col(col).fillNull("").cast(pl.Utf8))
        .reduce((acc, col) => acc.add(pl.lit("|")).add(col));
      
      workingDf = workingDf.withColumn(concatExpr.alias(patientIdCol));
    } else {
      patientIdCol = patientIdentifierColumns[0];
    }

    const patientProviderCounts = workingDf
      .groupBy([patientIdCol, providerColumn])
      .agg(
        pl.len().alias("visit_count")
      );

    const countCol = "visit_count";
    
    const patientTotalVisits = patientProviderCounts
      .groupBy(patientIdCol)
      .agg(
        pl.col(countCol).sum().alias("total_visits"),
        pl.col(countCol).max().alias("max_provider_visits")
      );

    const eligiblePatients = patientTotalVisits
      .filter(pl.col("total_visits").gt(1));

    if (eligiblePatients.height === 0) {
      return {
        averageUpc: undefined,
        patientUpcScores: {},
      };
    }

    const upcScores = eligiblePatients
      .withColumn(
        pl.col("max_provider_visits")
          .cast(pl.Float64)
          .div(pl.col("total_visits").cast(pl.Float64))
          .alias("upc_score")
      )
      .select([patientIdCol, "upc_score"]);

    const patientUpcScores: PatientContinuityScores = {};
    const scoresRecords = upcScores.toRecords();
    
    scoresRecords.forEach((row) => {
      const patientId = row[patientIdCol] as string;
      const upcScore = row.upc_score as number;
      if (patientId && typeof upcScore === "number") {
        patientUpcScores[patientId] = upcScore;
      }
    });

    const avgUpcDf = upcScores.select(pl.col("upc_score").mean());
    const averageUpc = avgUpcDf.getColumn("upc_score").get(0) as number;

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
