/**
 * Interface for storing patient-specific continuity scores
 * Maps patient IDs to their individual continuity index scores
 */
export interface PatientContinuityScores {
  [patientId: string]: number;
}

export interface CocIndexResult {
  averageCoc: number | undefined;
  patientCocScores: PatientContinuityScores;
}

export interface SeconIndexResult {
  averageSecon: number | undefined;
  patientSeconScores: PatientContinuityScores;
}

export interface MmciIndexResult {
  averageMmci: number | undefined;
  patientMmciScores: PatientContinuityScores;
}

export interface UpcIndexResult {
  averageUpc: number | undefined;
  patientUpcScores: PatientContinuityScores;
}

export interface RollingContIndexResult {
  monthlyScores: Record<string, number>;
  averageScore: number | undefined;
}

export type RollingContPeriodType = 'day' | 'week' | 'month' | 'custom';

export interface RollingContIndexResultGeneric {
  periodScores: Record<string, number>;
  averageScore: number | undefined;
  periodType: RollingContPeriodType;
}
