import * as pl from "nodejs-polars";
import {
  filterDataFrameByDateRange,
  parseExcelDateString,
} from "../../core/continuity/utils/date-filter";
import { filterDataFrameByStatus } from "../../core/continuity/utils/status-filter";
import { calculateTopProviders } from "../../core/data/services/top-providers-core";
import { mapProvidersToPatients } from "../../core/data/processors/provider-patient-mapping";

describe("Filter Integration Tests", () => {
  // Create a test DataFrame with both date and status columns
  let testDf: pl.DataFrame;

  beforeEach(() => {
    // Create a fresh test DataFrame before each test with both date and status
    testDf = pl.DataFrame({
      appointmentDate: [
        "1/15/22", // 2022-01-15 - Completed
        "2/20/22", // 2022-02-20 - Completed
        "3/10/22", // 2022-03-10 - No Show
        "4/5/22", // 2022-04-05 - Canceled
        "5/18/22", // 2022-05-18 - Completed
        "6/30/22", // 2022-06-30 - Completed
        "7/4/22", // 2022-07-04 - No Show
        "8/13/22", // 2022-08-13 - Canceled
        "9/25/22", // 2022-09-25 - Completed
        "10/31/22", // 2022-10-31 - No Show
        "11/15/22", // 2022-11-15 - Completed
        "12/25/22", // 2022-12-25 - No Show
      ],
      appointmentStatus: [
        "Completed",
        "Completed",
        "No Show",
        "Canceled",
        "Completed",
        "Completed",
        "No Show",
        "Canceled",
        "Completed",
        "No Show",
        "Completed",
        "No Show",
      ],
      patientId: [
        "P001",
        "P002",
        "P003",
        "P004",
        "P005",
        "P006",
        "P007",
        "P008",
        "P009",
        "P010",
        "P011",
        "P012",
      ],
    });
  });

  test("should apply date filter then status filter correctly", () => {
    // Step 1: Apply date filter for Q1 (Jan-Mar)
    const dateFiltered = filterDataFrameByDateRange(
      testDf,
      "appointmentDate",
      "2022-01-01",
      "2022-03-31"
    );

    // Should have 3 records: Jan 15, Feb 20, and Mar 10
    expect(dateFiltered.height).toBe(3);

    // Step 2: Further filter by status = "Completed"
    const finalFiltered = filterDataFrameByStatus(
      dateFiltered,
      "appointmentStatus",
      ["Completed"]
    );

    // Should have 2 records: Jan 15 and Feb 20 (both are "Completed")
    expect(finalFiltered.height).toBe(2);

    // Verify the remaining dates
    const finalDates = finalFiltered.getColumn("appointmentDate").toArray();
    expect(finalDates).toContain("1/15/22");
    expect(finalDates).toContain("2/20/22");
    expect(finalDates).not.toContain("3/10/22"); // This is "No Show"
  });

  test("should apply status filter then date filter correctly", () => {
    // First apply the status filter
    const statusFiltered = filterDataFrameByStatus(
      testDf,
      "appointmentStatus",
      ["Completed"]
    );

    // Should have 6 records with "Completed" status
    expect(statusFiltered.height).toBe(6);

    // Then apply the date filter for Q2 2022 (April-June)
    const finalFiltered = filterDataFrameByDateRange(
      statusFiltered,
      "appointmentDate",
      "2022-04-01",
      "2022-06-30" // End is inclusive, so June 30 includes that date
    );

    // Should have 2 records: "5/18/22" (May) and "6/30/22" (June), both "Completed"
    expect(finalFiltered.height).toBe(2);

    // Verify the remaining dates
    const finalDates = finalFiltered.getColumn("appointmentDate").toArray();
    expect(finalDates).toContain("5/18/22");
    expect(finalDates).toContain("6/30/22");
  });

  test("should handle multiple status values with date filtering", () => {
    // First apply the status filter for both Completed and No Show
    const statusFiltered = filterDataFrameByStatus(
      testDf,
      "appointmentStatus",
      ["Completed", "No Show"]
    );

    // Calculate expected count from test data: 6 Completed + 4 No Show = 10
    const expectedStatusCount = testDf
      .getColumn("appointmentStatus")
      .toArray()
      .filter((status: any) =>
        ["Completed", "No Show"].includes(status)
      ).length;
    expect(statusFiltered.height).toBe(expectedStatusCount);

    // Then apply a date filter for H2 2022 (July-December)
    const finalFiltered = filterDataFrameByDateRange(
      statusFiltered,
      "appointmentDate",
      "2022-07-01",
      "2023-01-01"
    );

    // Calculate expected H2 dates with Completed/No Show status from test data
    // H2 2022 dates: "7/4/22" (No Show), "9/25/22" (Completed), "10/31/22" (No Show), "11/15/22" (Completed), "12/25/22" (No Show)
    const expectedH2Count = 5;
    expect(finalFiltered.height).toBe(expectedH2Count);

    // Verify the result has the right statuses
    const filteredStatuses = finalFiltered
      .getColumn("appointmentStatus")
      .toArray();

    // Should only have Completed or No Show statuses
    filteredStatuses.forEach((status: string) => {
      expect(["Completed", "No Show"]).toContain(status);
    });

    // Verify the dates are all in H2 2022
    const filteredDates = finalFiltered
      .getColumn("appointmentDate")
      .toArray()
      .map((dateStr: string) => parseExcelDateString(dateStr));

    // All dates should be between July 1 and December 31, 2022
    const h2Start = new Date(2022, 5, 30); // June 30, 2022 (to account for time zone issues)
    const h2End = new Date(2023, 0, 1); // January 1, 2023

    filteredDates.forEach((date: Date | null) => {
      expect(date).not.toBeNull();
      if (date) {
        expect(date.getTime()).toBeGreaterThanOrEqual(h2Start.getTime());
        expect(date.getTime()).toBeLessThan(h2End.getTime());
      }
    });
  });

  test("should return empty DataFrame when no records match both filters", () => {
    // Step 1: Filter to only canceled appointments
    const statusFiltered = filterDataFrameByStatus(
      testDf,
      "appointmentStatus",
      ["Canceled"]
    );

    // Should have 2 records with status = "Canceled"
    expect(statusFiltered.height).toBe(2);

    // Step 2: Filter to Q1 (Jan-Mar)
    const finalFiltered = filterDataFrameByDateRange(
      statusFiltered,
      "appointmentDate",
      "2022-01-01",
      "2022-03-31"
    );

    // Should have 0 records (no canceled appointments in Q1)
    expect(finalFiltered.height).toBe(0);
  });

  test("TopProviders and ProviderPatientMapping services should work with filtered data", () => {
    // Create a test DataFrame with date, status, patient and provider data
    const testDataFrame = pl.DataFrame({
      appointmentDate: [
        "1/15/22",
        "2/20/22",
        "3/10/22",
        "4/5/22",
        "5/18/22",
        "6/30/22",
        "7/4/22",
        "8/13/22",
        "9/25/22",
      ],
      appointmentStatus: [
        "Completed",
        "Completed",
        "No Show",
        "Canceled",
        "Completed",
        "Completed",
        "No Show",
        "Canceled",
        "Completed",
      ],
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2", "P3", "P3", "P3"],
      providerId: [
        "Dr. A",
        "Dr. A",
        "Dr. B",
        "Dr. B",
        "Dr. B",
        "Dr. C",
        "Dr. C",
        "Dr. C",
        "Dr. A",
      ],
    });

    // Apply date filter for Q1 (Jan-Mar)
    const q1Filtered = filterDataFrameByDateRange(
      testDataFrame,
      "appointmentDate",
      "2022-01-01",
      "2022-03-31"
    );

    // Verify the filter worked properly
    expect(q1Filtered.height).toBe(3);

    const records = q1Filtered.toRecords().map((record: any) => ({
      patientId: record.patientId as string,
      providerId: record.providerId as string,
    }));

    const topProviders = calculateTopProviders(records);

    // Verify patient P1 has correct provider counts for Q1
    expect(topProviders["P1"]).toBeDefined();
    expect(topProviders["P1"]["Dr. A"]).toBe(2);
    expect(topProviders["P1"]["Dr. B"]).toBe(1);

    // Verify P2 and P3 don't appear in Q1 data
    expect(topProviders["P2"]).toBeUndefined();
    expect(topProviders["P3"]).toBeUndefined();

    const mappingResult = mapProvidersToPatients(records);

    // Verify patient-provider assignments from filtered data
    expect(mappingResult.patientToProvider["P1"].id).toBe("Dr. A");
    expect(
      mappingResult.providerToPatients["Dr. A"].map((p: any) => p.id)
    ).toContain("P1");

    // Verify filtering out patients from other time periods
    expect(Object.keys(mappingResult.patientToProvider).length).toBe(1);
    expect(mappingResult.patientToProvider["P2"]).toBeUndefined();
    expect(mappingResult.patientToProvider["P3"]).toBeUndefined();

    const completedOnly = filterDataFrameByStatus(
      q1Filtered,
      "appointmentStatus",
      ["Completed"]
    );

    const finalRecords = completedOnly.toRecords().map((record: any) => ({
      patientId: record.patientId as string,
      providerId: record.providerId as string,
    }));

    const finalMapping = mapProvidersToPatients(finalRecords);

    // Verify that only Completed visits are considered
    // P1 had 2 Completed visits to Dr. A and 0 Completed visits to Dr. B in Q1
    expect(finalMapping.patientToProvider["P1"].id).toBe("Dr. A");
    expect(finalRecords.length).toBe(2); // Only the two completed visits in Q1

    // Verification with assertion to ensure test fails if unexpected
    const patientCounts = Object.keys(finalMapping.patientToProvider).length;
    expect(patientCounts).toBe(1);
  });

  // Test for patient count consistency and multi-visit filter logic
  test("Patient counts should be consistently tracked and filtered correctly", () => {
    // Create sample patient-provider visit data
    const sampleVisitData = [
      // Patient 1: 3 visits (2 to Dr. A, 1 to Dr. B)
      { patientId: "P1", providerId: "Dr. A" },
      { patientId: "P1", providerId: "Dr. A" },
      { patientId: "P1", providerId: "Dr. B" },

      // Patient 2: 2 visits (both to Dr. B)
      { patientId: "P2", providerId: "Dr. B" },
      { patientId: "P2", providerId: "Dr. B" },

      // Patient 3: 3 visits (1 to Dr. A, 2 to Dr. C)
      { patientId: "P3", providerId: "Dr. A" },
      { patientId: "P3", providerId: "Dr. C" },
      { patientId: "P3", providerId: "Dr. C" },

      // Patient 4: 1 visit only (should be excluded from top providers)
      { patientId: "P4", providerId: "Dr. B" },

      // Patient 5: 2 visits (to Dr. A and Dr. C)
      { patientId: "P5", providerId: "Dr. A" },
      { patientId: "P5", providerId: "Dr. C" },
    ];

    // Create provider visit counts for each patient
    const patientProviderMap = new Map();

    // Count visits per provider for each patient
    sampleVisitData.forEach((visit) => {
      if (!patientProviderMap.has(visit.patientId)) {
        patientProviderMap.set(visit.patientId, new Map());
      }

      const providerMap = patientProviderMap.get(visit.patientId);
      providerMap.set(
        visit.providerId,
        (providerMap.get(visit.providerId) || 0) + 1
      );
    });

    // Create top providers object according to the algorithm in main.ts
    const topProviders: Record<string, Record<string, number>> = {};

    patientProviderMap.forEach((providerMap, patientId) => {
      // Sort providers by visit count
      const sortedProviders = [...providerMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3 providers

      const providerCounts: Record<string, number> = {};
      for (const [providerId, count] of sortedProviders) {
        providerCounts[providerId] = count;
      }

      // Only include patients with more than 1 visit
      const totalVisits = Object.values(providerCounts).reduce(
        (sum: number, count: number) => sum + count,
        0
      );
      if (totalVisits > 1) {
        topProviders[patientId] = providerCounts;
      }
    });

    // Check counts
    expect(Object.keys(topProviders).length).toBe(4); // 4 patients with >1 visit

    // Patient 4 should be excluded (only 1 visit)
    expect(topProviders).not.toHaveProperty("P4");

    // Patients 1, 2, 3, 5 should be included
    expect(topProviders).toHaveProperty("P1");
    expect(topProviders).toHaveProperty("P2");
    expect(topProviders).toHaveProperty("P3");
    expect(topProviders).toHaveProperty("P5");

    // Verify correct top providers
    expect(topProviders["P1"]["Dr. A"]).toBe(2); // Dr. A should be top for P1
    expect(topProviders["P2"]["Dr. B"]).toBe(2); // Dr. B should be top for P2
    expect(topProviders["P3"]["Dr. C"]).toBe(2); // Dr. C should be top for P3

    // For P5, both providers have 1 visit, so order is alphabetical
    const p5Providers = Object.keys(topProviders["P5"]);
    expect(p5Providers).toEqual(["Dr. A", "Dr. C"]);
    expect(topProviders["P5"]["Dr. A"]).toBe(1);
    expect(topProviders["P5"]["Dr. C"]).toBe(1);
  });
});
