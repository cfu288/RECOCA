/**
 * Color palette for demographic visualizations
 * This array of colors will be cycled through for any demographic categories found in the data
 */
export const CHART_COLORS = [
  "#8884d8", // Purple
  "#82ca9d", // Green
  "#ffc658", // Yellow/Gold
  "#ff8042", // Orange
  "#0088fe", // Blue
  "#00C49F", // Teal
  "#FFBB28", // Amber
  "#ba68c8", // Violet
  "#4DB6AC", // Teal Light
  "#FFB74D", // Orange Light
  "#7986CB", // Indigo
  "#e57373", // Red Light
  "#9575CD", // Deep Purple
  "#4FC3F7", // Light Blue
  "#81C784", // Light Green
  "#a1887f", // Brown
  "#90a4ae", // Blue Grey
  "#f06292", // Pink
  "#aed581", // Light Green Alt
  "#64b5f6", // Blue Light
];

interface PatientWithDemographics {
  id: string;
  race?: string;
  gender?: string;
  [key: string]: any;
}

interface DemographicResult {
  race: Record<string, number>;
  gender: Record<string, number>;
}

/**
 * Extract unique patient demographics from provider-patient mapping data
 *
 * This function ensures that each patient is only counted once, even if they
 * appear under multiple providers. It extracts counts of race and gender
 * to be used in demographic pie charts.
 *
 * @param providerToPatients - Object mapping providers to their assigned patients
 * @returns Demographic data with counts by race and gender, plus quality metrics
 */
export function extractPatientDemographics(
  providerToPatients: Record<string, Array<PatientWithDemographics>>
): DemographicResult {
  if (!providerToPatients || typeof providerToPatients !== "object") {
    console.warn(
      "extractPatientDemographics: Invalid input - providerToPatients is not an object"
    );
    return {
      race: {},
      gender: {},
    };
  }

  const raceCount: Record<string, number> = {};
  const genderCount: Record<string, number> = {};

  let totalPatients = 0;
  let patientsWithRace = 0;
  let patientsWithGender = 0;

  const patientsProcessed = new Set<string>();

  Object.values(providerToPatients).forEach((patients) => {
    if (!Array.isArray(patients)) {
      console.warn(
        "extractPatientDemographics: Provider has non-array patient list"
      );
      return;
    }

    patients.forEach((patient) => {
      if (!patient || typeof patient !== "object" || !patient.id) {
        console.warn(
          "extractPatientDemographics: Invalid patient object found"
        );
        return;
      }

      if (patientsProcessed.has(patient.id)) return;
      patientsProcessed.add(patient.id);

      totalPatients++;

      if (patient.race && typeof patient.race === "string") {
        const race = patient.race.trim();
        if (race.length > 0) {
          raceCount[race] = (raceCount[race] || 0) + 1;
          patientsWithRace++;
        }
      }

      if (patient.gender && typeof patient.gender === "string") {
        const gender = patient.gender.trim().toUpperCase();
        if (gender.length > 0) {
          genderCount[gender] = (genderCount[gender] || 0) + 1;
          patientsWithGender++;
        }
      }
    });
  });

  return {
    race: raceCount,
    gender: genderCount,
  };
}
