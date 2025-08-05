import * as pl from "nodejs-polars";
import { RollingContIndexResultGeneric, RollingContPeriodType } from "../types/continuity-types";

/**
 * Calculates the Rolling Continuity of Care index for any time period
 *
 * This metric measures continuity on a period-by-period basis by tracking what percentage
 * of patients see the same provider as their previous appointment.
 *
 * @param df DataFrame containing patient, provider, and appointment date data
 * @param providerColumn Column name containing provider identifiers
 * @param patientIdentifierColumns Array of column names that together uniquely identify a patient
 * @param appointmentDateColumn Column name containing the appointment dates
 * @param periodType Type of period to use: 'day', 'week', 'month', or 'custom'
 * @param customPeriodDays For 'custom' period type, the number of days in each period
 * @param monthBoundaryDay For 'month' period type, the day of month to use as boundary (default: 1)
 * @returns Object containing period scores and the overall average
 */
export function calculateRollingContIndexGeneric(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[],
  appointmentDateColumn: string,
  periodType: RollingContPeriodType = 'month',
  customPeriodDays?: number,
  monthBoundaryDay: number = 1
): RollingContIndexResultGeneric {
  try {
    if (df.height === 0) {
      return {
        periodScores: {},
        averageScore: undefined,
        periodType,
      };
    }

    // Validate columns exist
    if (!df.columns.includes(providerColumn)) {
      console.error(
        `Provider column '${providerColumn}' not found in DataFrame.`
      );
      return {
        periodScores: {},
        averageScore: undefined,
        periodType,
      };
    }

    if (!df.columns.includes(appointmentDateColumn)) {
      console.error(
        `Appointment date column '${appointmentDateColumn}' not found in DataFrame.`
      );
      return {
        periodScores: {},
        averageScore: undefined,
        periodType,
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
        periodScores: {},
        averageScore: undefined,
        periodType,
      };
    }

    if (periodType === 'custom' && !customPeriodDays) {
      console.error(
        `Custom period days must be specified when using 'custom' period type`
      );
      return {
        periodScores: {},
        averageScore: undefined,
        periodType,
      };
    }

    const validRecords = df.filter(
      pl
        .col(providerColumn)
        .isNotNull()
        .and(pl.col(providerColumn).neq(pl.lit("")))
        .and(pl.col(appointmentDateColumn).isNotNull())
    );

    if (validRecords.height === 0) {
      return {
        periodScores: {},
        averageScore: undefined,
        periodType,
      };
    }

    // Convert to records for processing
    const records = validRecords.toRecords();
    

    // Sort records by patient and date
    records.sort((a, b) => {
      // First sort by patient ID
      const patientIdA = patientIdentifierColumns.length > 1
        ? patientIdentifierColumns.map((col) => String(a[col] || "")).join("|")
        : String(a[patientIdentifierColumns[0]] || "");
      const patientIdB = patientIdentifierColumns.length > 1
        ? patientIdentifierColumns.map((col) => String(b[col] || "")).join("|")
        : String(b[patientIdentifierColumns[0]] || "");

      if (patientIdA !== patientIdB) {
        return patientIdA.localeCompare(patientIdB);
      }

      // Then sort by date
      const dateA = new Date(a[appointmentDateColumn] as string);
      const dateB = new Date(b[appointmentDateColumn] as string);
      return dateA.getTime() - dateB.getTime();
    });

    // Group records by patient
    const patientAppointments = new Map<string, Array<{
      provider: string;
      date: Date;
    }>>();

    // Find the earliest date in the dataset for week calculations
    let earliestDate: Date | null = null;

    records.forEach((row, index) => {
      const patientId = patientIdentifierColumns.length > 1
        ? patientIdentifierColumns.map((col) => String(row[col] || "")).join("|")
        : String(row[patientIdentifierColumns[0]] || "");

      const provider = String(row[providerColumn] || "");
      const dateValue = row[appointmentDateColumn];
      
      
      // Skip records with invalid dates
      if (!dateValue) {
        return;
      }
      
      let date: Date;
      
      // Handle different date formats
      if (typeof dateValue === 'number') {
        // Check if it's an Excel date serial number (days since 1900)
        if (dateValue > 0 && dateValue < 100000) {
          // Excel date serial number - convert it
          const EXCEL_EPOCH_OFFSET = 25569; // Days between 1900-01-01 and 1970-01-01
          const MS_PER_DAY = 86400 * 1000;
          date = new Date((dateValue - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
        } else {
          // Assume it's a Unix timestamp
          date = new Date(dateValue);
        }
      } else {
        // String date
        date = new Date(dateValue as string);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return;
      }

      // Track earliest date for week calculations
      if (!earliestDate || date < earliestDate) {
        earliestDate = date;
      }

      if (!patientAppointments.has(patientId)) {
        patientAppointments.set(patientId, []);
      }

      const appointments = patientAppointments.get(patientId);
      if (appointments) {
        appointments.push({
          provider,
          date,
        });
      }
    });

    // Calculate period buckets based on the period type
    const getPeriodBucket = (date: Date): string => {
      switch (periodType) {
        case 'day':
          // Format: YYYY-MM-DD
          return date.toISOString().split('T')[0];
        
        case 'week':
          // Calculate week number from the earliest date
          if (!earliestDate) return 'week-unknown';
          const daysDiff = Math.floor((date.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
          const weekNumber = Math.floor(daysDiff / 7) + 1;
          return `week-${weekNumber}`;
        
        case 'month':
          // Existing month logic
          const year = date.getFullYear();
          const month = date.getMonth(); // 0-11
          const day = date.getDate();

          if (monthBoundaryDay === 1) {
            // Standard calendar months
            return `${year}-${(month + 1).toString().padStart(2, "0")}`;
          } else {
            // Custom boundary
            if (day >= monthBoundaryDay) {
              return `${year}-${(month + 1).toString().padStart(2, "0")}-${monthBoundaryDay.toString().padStart(2, "0")}`;
            } else {
              if (month === 0) {
                return `${year - 1}-12-${monthBoundaryDay.toString().padStart(2, "0")}`;
              } else {
                return `${year}-${month.toString().padStart(2, "0")}-${monthBoundaryDay.toString().padStart(2, "0")}`;
              }
            }
          }
        
        case 'custom':
          // Calculate custom period from earliest date
          if (!earliestDate || !customPeriodDays) return 'period-unknown';
          const daysDiffCustom = Math.floor((date.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
          const periodNumber = Math.floor(daysDiffCustom / customPeriodDays) + 1;
          return `period-${periodNumber}`;
        
        default:
          return 'unknown';
      }
    };

    // Initialize results
    const periodScores: Record<string, { sameProvider: number; total: number }> = {};

    // Process each patient separately
    for (const [, allAppointments] of patientAppointments.entries()) {
      // Process all appointments chronologically for this patient
      const flatAppointments = allAppointments.slice().sort((a, b) =>
        a.date.getTime() - b.date.getTime()
      );

      // For each appointment (except the first), compare with previous appointment
      for (let i = 1; i < flatAppointments.length; i++) {
        const currentAppt = flatAppointments[i];
        const prevAppt = flatAppointments[i - 1];

        // Get the period bucket for the current appointment
        const periodBucket = getPeriodBucket(currentAppt.date);

        // Initialize period bucket if needed
        if (!periodScores[periodBucket]) {
          periodScores[periodBucket] = { sameProvider: 0, total: 0 };
        }

        // Count this comparison in the current appointment's period
        periodScores[periodBucket].total++;

        // Check if the provider is the same as the previous appointment
        if (currentAppt.provider === prevAppt.provider) {
          periodScores[periodBucket].sameProvider++;
        }
      }
    }

    // Calculate the final scores for each period
    const finalPeriodScores: Record<string, number> = {};
    let totalScore = 0;
    let periodCount = 0;

    for (const [period, counts] of Object.entries(periodScores)) {
      if (counts.total > 0) {
        const score = counts.sameProvider / counts.total;
        finalPeriodScores[period] = score;
        totalScore += score;
        periodCount++;
      }
    }

    // Calculate the average score across all periods
    const averageScore = periodCount > 0 ? totalScore / periodCount : undefined;

    return {
      periodScores: finalPeriodScores,
      averageScore,
      periodType,
    };
  } catch (error) {
    console.error("Error calculating Rolling Continuity index:", error);
    return {
      periodScores: {},
      averageScore: undefined,
      periodType,
    };
  }
}

/**
 * Wrapper function to maintain backward compatibility with the original monthly function
 */
export function calculateRollingContIndexMonthly(
  df: pl.DataFrame,
  providerColumn: string,
  patientIdentifierColumns: string[],
  appointmentDateColumn: string,
  monthBoundaryDay: number = 1
) {
  const result = calculateRollingContIndexGeneric(
    df,
    providerColumn,
    patientIdentifierColumns,
    appointmentDateColumn,
    'month',
    undefined,
    monthBoundaryDay
  );

  // Convert to the original format
  return {
    monthlyScores: result.periodScores,
    averageScore: result.averageScore,
  };
}