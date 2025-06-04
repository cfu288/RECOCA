export interface PatientRecord {
  patientId: string;
  providerId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  race?: string;
  gender?: string;
}

export interface PatientWithInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  race?: string;
  gender?: string;
}

export interface ProviderWithInfo {
  id: string;
}

export interface ProviderPatientMappingResult {
  providerToPatients: Record<string, PatientWithInfo[]>;
  patientToProvider: Record<string, ProviderWithInfo>;
}

interface MappingPerformanceMetrics {
  totalRecords: number;
  validRecords: number;
  uniquePatients: number;
  uniqueProviders: number;
  processingTimeMs: number;
  patientsWithTies: number;
  avgProvidersPerPatient: number;
}

/**
 * Maps patients to their optimal providers using a continuity-based algorithm.
 *
 * We use this to assign each patient to a single provider based on who they've
 * seen most frequently, and balancing ties when there are multiple providers
 * with the same number of visits.
 *
 * 1. Each patient is assigned to the provider they've seen most frequently
 * 2. For ties (patient has seen multiple providers equally):
 *    a. Assign to the provider with the fewest patients in their panel (workload balancing)
 *    b. If workloads are equal, assign alphabetically by provider ID
 *
 * @param records - Array of patient visit records
 * @returns Object containing both provider->patients and patient->provider mappings
 */
export function mapProvidersToPatients(
  records: PatientRecord[]
): ProviderPatientMappingResult {
  const algorithmStartTime = performance.now();
  console.log(
    `Processing ${records.length} records for provider-patient mapping`
  );

  let validRecordsCount = 0;
  const uniquePatientIds = new Set<string>();
  const uniqueProviderIds = new Set<string>();
  let patientsWithTiedProviders = 0;

  const patientToProviderVisitCounts = new Map<string, Map<string, number>>();
  const patientIdToInfoMap = new Map<string, PatientWithInfo>();

  for (const record of records) {
    if (!record.patientId || !record.providerId) {
      continue;
    }

    validRecordsCount++;
    const currentPatientId = record.patientId;
    const currentProviderId = record.providerId;

    uniquePatientIds.add(currentPatientId);
    uniqueProviderIds.add(currentProviderId);

    if (!patientIdToInfoMap.has(currentPatientId)) {
      const patientInfoFromRecord: PatientWithInfo = {
        id: currentPatientId,
        firstName: record.firstName,
        lastName: record.lastName,
        middleName: record.middleName,
        dateOfBirth: record.dateOfBirth,
        race: record.race,
        gender: record.gender,
      };

      patientIdToInfoMap.set(currentPatientId, patientInfoFromRecord);
    }

    if (!patientToProviderVisitCounts.has(currentPatientId)) {
      patientToProviderVisitCounts.set(
        currentPatientId,
        new Map<string, number>()
      );
    }

    const providerVisitCounts =
      patientToProviderVisitCounts.get(currentPatientId)!;
    providerVisitCounts.set(
      currentProviderId,
      (providerVisitCounts.get(currentProviderId) || 0) + 1
    );
  }

  const alphabeticallySortedProviderIds = Array.from(uniqueProviderIds).sort();

  const patientToTopProviderIds = new Map<string, string[]>();

  for (const [
    patientId,
    providerVisitCounts,
  ] of patientToProviderVisitCounts.entries()) {
    const providerIdAndVisitCountPairs = Array.from(
      providerVisitCounts.entries()
    );

    if (providerIdAndVisitCountPairs.length === 0) continue;

    const maxVisitCount = Math.max(
      ...providerIdAndVisitCountPairs.map(([, count]) => count)
    );

    const providerIdsWithMaxVisits = providerIdAndVisitCountPairs
      .filter(([, count]) => count === maxVisitCount)
      .map(([providerId]) => providerId);

    const alphabeticallySortedTopProviders = providerIdsWithMaxVisits.sort(
      (a, b) => {
        const indexOfProviderA = alphabeticallySortedProviderIds.indexOf(a);
        const indexOfProviderB = alphabeticallySortedProviderIds.indexOf(b);
        return indexOfProviderA - indexOfProviderB;
      }
    );

    if (providerIdsWithMaxVisits.length > 1) {
      patientsWithTiedProviders++;
    }

    patientToTopProviderIds.set(patientId, alphabeticallySortedTopProviders);
  }

  const providerIdToPatientsMap: Record<string, PatientWithInfo[]> = {};

  for (const providerId of alphabeticallySortedProviderIds) {
    providerIdToPatientsMap[providerId] = [];
  }

  const patientIdToAssignedProvider: Record<string, ProviderWithInfo> = {};

  for (const [patientId, topProviderIds] of patientToTopProviderIds.entries()) {
    if (topProviderIds.length === 1) {
      const singleTopProviderId = topProviderIds[0];

      const patientInfo = patientIdToInfoMap.get(patientId)!;

      providerIdToPatientsMap[singleTopProviderId].push(patientInfo);
      patientIdToAssignedProvider[patientId] = { id: singleTopProviderId };
    }
  }

  for (const [
    patientId,
    tiedProviderIds,
  ] of patientToTopProviderIds.entries()) {
    if (tiedProviderIds.length > 1) {
      if (patientIdToAssignedProvider[patientId]) continue;

      let providerWithFewestPatients = tiedProviderIds[0];
      let minimumPatientCount =
        providerIdToPatientsMap[providerWithFewestPatients].length;

      for (let i = 1; i < tiedProviderIds.length; i++) {
        const currentProviderId = tiedProviderIds[i];
        const currentProviderPatientCount =
          providerIdToPatientsMap[currentProviderId].length;

        if (currentProviderPatientCount < minimumPatientCount) {
          providerWithFewestPatients = currentProviderId;
          minimumPatientCount = currentProviderPatientCount;
        }
      }

      const patientInfo = patientIdToInfoMap.get(patientId)!;

      providerIdToPatientsMap[providerWithFewestPatients].push(patientInfo);
      patientIdToAssignedProvider[patientId] = {
        id: providerWithFewestPatients,
      };
    }
  }

  const algorithmEndTime = performance.now();
  const totalProcessingTimeMs = algorithmEndTime - algorithmStartTime;
  const averageProvidersPerPatient = validRecordsCount / uniquePatientIds.size;

  const performanceMetrics: MappingPerformanceMetrics = {
    totalRecords: records.length,
    validRecords: validRecordsCount,
    uniquePatients: uniquePatientIds.size,
    uniqueProviders: uniqueProviderIds.size,
    processingTimeMs: Math.round(totalProcessingTimeMs * 100) / 100,
    patientsWithTies: patientsWithTiedProviders,
    avgProvidersPerPatient: Math.round(averageProvidersPerPatient * 100) / 100,
  };

  console.log(
    `Mapped ${Object.keys(patientIdToAssignedProvider).length} patients to ${performanceMetrics.uniqueProviders} providers (${performanceMetrics.processingTimeMs}ms)`
  );

  return {
    providerToPatients: providerIdToPatientsMap,
    patientToProvider: patientIdToAssignedProvider,
  };
}
