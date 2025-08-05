import * as pl from "nodejs-polars";
import { RollingContIndexResult } from "../types/continuity-types";
import { calculateRollingContIndexMonthly } from "./rolling-cont-index-generic";

/**
 * Calculates the Rolling Continuity of Care index
 *
 * This metric measures clinic-level continuity on a month-by-month basis by tracking what percentage
 * of patients see the same provider as their previous appointment, even if that previous appointment
 * was in a different month.
 *
 * Algorithm:
 * 1. For each patient, sort all appointments chronologically
 * 2. For each appointment (except the first):
 *    - Compare the current provider with the provider of the patient's most recent previous appointment
 *    - If the provider is the same, count it as a continuity success
 *    - Attribute this score to the month of the current appointment
 * 3. For each month, calculate: (number of same-provider follow-ups) / (total follow-ups)
 *
 * Formula: RollingContInx = (number of same-provider sequential appointments) / (total sequential appointments in month)
 *
 * @param df DataFrame containing patient, provider, and appointment date data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @param appointmentDateColumn Column name containing the appointment dates
 * @param monthBoundaryDay Optional day of month to use as boundary (default: 1)
 * @returns Object containing monthly scores and the overall average
 */
export function calculateRollingContIndex(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[],
  appointmentDateColumn: string,
  monthBoundaryDay: number = 1
): RollingContIndexResult {
  // Use the generic implementation with 'month' period type
  return calculateRollingContIndexMonthly(
    df,
    providerColumn,
    patientIdentifierColumns,
    appointmentDateColumn,
    monthBoundaryDay
  );
}