export interface PatientVisitRecord {
  patientId: string;
  providerId: string;
}

export interface TopProvidersResult {
  [patientId: string]: Record<string, number>;
}

interface PerformanceMetrics {
  totalRecords: number;
  validRecords: number;
  uniquePatients: number;
  uniqueProviders: number;
  processingTimeMs: number;
  recordsPerSecond: number;
}

/**
 * Calculates the top providers (up to 3) for each patient based on visit frequency.
 *
 * For each patient, this function counts how many times they've seen each provider
 * and returns the top 3 providers with their visit counts.
 *
 * Steps:
 * 1. Count patient-provider interactions from visit data
 * 2. For each patient, sort providers by visit count (descending)
 * 3. Take the top 3 providers per patient
 * 4. Return as a map of patient ID -> provider counts
 *
 * @param records - Array of patient visit records
 * @returns Object mapping patient IDs to their top providers with visit counts
 */
export function calculateTopProviders(
  records: PatientVisitRecord[]
): TopProvidersResult {
  const startTime = performance.now();
  console.log(
    `Processing ${records.length} appointment records for top providers calculation`
  );

  // Performance tracking variables
  let validRecords = 0;
  const uniquePatients = new Set<string>();
  const uniqueProviders = new Set<string>();

  // Step 1: Count patient-provider interactions
  const patientProviderMap = new Map<string, Map<string, number>>();

  // Process each record to count provider visits for each patient
  for (const record of records) {
    // Skip null/undefined values
    if (!record.patientId || !record.providerId) {
      continue;
    }

    validRecords++;
    const patientId = record.patientId;
    const providerId = record.providerId;

    // Track unique patients and providers for metrics
    uniquePatients.add(patientId);
    uniqueProviders.add(providerId);

    // Initialize maps if they don't exist
    if (!patientProviderMap.has(patientId)) {
      patientProviderMap.set(patientId, new Map<string, number>());
    }

    const providerMap = patientProviderMap.get(patientId)!;
    // Increment the count for this provider
    providerMap.set(providerId, (providerMap.get(providerId) || 0) + 1);
  }

  // Step 2: Convert to the expected output format - top 3 providers per patient
  const result: TopProvidersResult = {};

  for (const [patientId, providerMap] of patientProviderMap.entries()) {
    // Sort providers by visit count (descending)
    const sortedProviders = [...providerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Take top 3 providers

    // Create object with provider counts
    const providerCounts: Record<string, number> = {};
    for (const [providerId, count] of sortedProviders) {
      providerCounts[providerId] = count;
    }

    // Only add if there are providers
    if (Object.keys(providerCounts).length > 0) {
      result[patientId] = providerCounts;
    }
  }

  // Calculate and log performance metrics
  const endTime = performance.now();
  const processingTimeMs = endTime - startTime;
  const recordsPerSecond =
    validRecords > 0 ? (validRecords / processingTimeMs) * 1000 : 0;

  const metrics: PerformanceMetrics = {
    totalRecords: records.length,
    validRecords,
    uniquePatients: uniquePatients.size,
    uniqueProviders: uniqueProviders.size,
    processingTimeMs: Math.round(processingTimeMs * 100) / 100, // Round to 2 decimals
    recordsPerSecond: Math.round(recordsPerSecond),
  };

  // Log performance summary
  console.log(`Found ${validRecords} valid records after filtering nulls`);
  console.log(
    `Returning top providers data for ${Object.keys(result).length} patients`
  );
  console.log(
    `Performance: ${metrics.processingTimeMs}ms (${metrics.recordsPerSecond} records/sec)`
  );
  console.log(
    `Data summary: ${metrics.uniquePatients} patients, ${metrics.uniqueProviders} providers`
  );

  return result;
}
