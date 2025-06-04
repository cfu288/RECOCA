import { loadPolars } from "../../core/data/loaders/polars-loader";
import { BrowserWindow, app, dialog } from "electron";

let pl: any = null;

export function getPolars() {
  if (pl === null) {
    try {
      pl = loadPolars();
      console.log("Successfully loaded polars");
    } catch (error) {
      console.error("Failed to load polars:", error);
      if (app.isPackaged) {
        if (BrowserWindow.getAllWindows().length > 0) {
          dialog.showErrorBox(
            "Critical Error",
            "Failed to load the data processing library (nodejs-polars). The application cannot continue.\n\n" +
              "Error details: " +
              (error instanceof Error ? error.message : String(error))
          );
        }
        app.exit(1);
      }
      throw error;
    }
  }
  return pl;
}

/**
 * Calculate appointment distribution for a given DataFrame and patient ID column
 */
export function calculateAppointmentDistribution(
  df: any,
  patientIdCol: string
): Record<string, number> {
  try {
    if (!df || !df.columns.includes(patientIdCol)) {
      console.error(
        `Column "${patientIdCol}" not found in DataFrame or DataFrame is invalid`
      );
      return {};
    }

    const patientIds = df.getColumn(patientIdCol).toArray();

    // Count occurrences of each patient ID (# appointments per patient)
    const appointmentCounts: Record<string, number> = {};
    patientIds.forEach((patientId: any) => {
      if (patientId != null) {
        const patientIdStr = String(patientId);
        appointmentCounts[patientIdStr] =
          (appointmentCounts[patientIdStr] || 0) + 1;
      }
    });

    // Create distribution: number of appointments -> count of patients
    const distribution: Record<string, number> = {};
    Object.values(appointmentCounts).forEach((appointmentCount) => {
      const key = String(appointmentCount);
      distribution[key] = (distribution[key] || 0) + 1;
    });

    return distribution;
  } catch (error) {
    console.error("Error calculating appointment distribution:", error);
    return {};
  }
}
