import * as pl from "nodejs-polars";

/**
 * Filters a DataFrame based on appointment status values
 *
 * Handles case-insensitive and whitespace-normalized comparison
 * for reliable filtering regardless of input formatting
 */
export function filterDataFrameByStatus(
  df: pl.DataFrame,
  statusColumn: string,
  selectedStatusValues: string[]
): pl.DataFrame {
  if (
    !df ||
    df.height === 0 ||
    !statusColumn ||
    !selectedStatusValues ||
    selectedStatusValues.length === 0
  ) {
    return df.clone();
  }

  try {
    const allStatusValues = Array.from(
      new Set(df.getColumn(statusColumn).toArray())
    ).filter((val: unknown) => val !== null);

    if (selectedStatusValues.length >= allStatusValues.length) {
      return df.clone();
    }

    const selectedValuesLower = selectedStatusValues.map((val) =>
      (val || "").toLowerCase().trim()
    );

    const withNormalizedCol = df.withColumn(
      pl
        .col(statusColumn)
        .cast(pl.Utf8)
        .str.toLowerCase()
        .str.strip()
        .alias("normalized_status")
    );

    return withNormalizedCol
      .filter(pl.col("normalized_status").isIn(selectedValuesLower))
      .drop("normalized_status");
  } catch (error) {
    console.error("Error filtering DataFrame by status:", error);
    return df.clone();
  }
}
