import * as pl from "nodejs-polars";
import { filterDataFrameByStatus } from "../../core/continuity/utils/status-filter";

describe("DataFrame Status Filtering", () => {
  // Create a test DataFrame with status column
  let testDf: pl.DataFrame;

  beforeEach(() => {
    // Create a fresh test DataFrame before each test
    testDf = pl.DataFrame({
      appointmentStatus: [
        "Completed",
        "COMPLETED",
        "completed ",
        " Completed",
        "No Show",
        "NO SHOW",
        "Canceled",
        "CANCELED",
        "Rescheduled",
        "In Progress",
        null,
        "",
        "Unknown",
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
        "P013",
      ],
    });
  });

  test("should filter DataFrame to only selected status values", () => {
    // Filter to only "Completed" status values (in various forms)
    const filtered = filterDataFrameByStatus(testDf, "appointmentStatus", [
      "Completed",
    ]);

    // Should include all variations of "Completed" (case and whitespace insensitive)
    expect(filtered.height).toBe(4);

    const filteredStatuses = filtered.getColumn("appointmentStatus").toArray();
    expect(filteredStatuses).toContain("Completed");
    expect(filteredStatuses).toContain("COMPLETED");
    expect(filteredStatuses).toContain("completed ");
    expect(filteredStatuses).toContain(" Completed");

    // Check that it doesn't contain other statuses
    expect(filteredStatuses).not.toContain("No Show");
    expect(filteredStatuses).not.toContain("Canceled");
  });

  test("should filter using multiple status values", () => {
    // Filter to "Completed" and "No Show"
    const filtered = filterDataFrameByStatus(testDf, "appointmentStatus", [
      "Completed",
      "No Show",
    ]);

    // Should include all "Completed" and "No Show" variations
    expect(filtered.height).toBe(6);

    const filteredStatuses = filtered.getColumn("appointmentStatus").toArray();

    // Check for Completed variants
    expect(filteredStatuses).toContain("Completed");
    expect(filteredStatuses).toContain("COMPLETED");

    // Check for No Show variants
    expect(filteredStatuses).toContain("No Show");
    expect(filteredStatuses).toContain("NO SHOW");

    // Check that it doesn't contain other statuses
    expect(filteredStatuses).not.toContain("Canceled");
    expect(filteredStatuses).not.toContain("Rescheduled");
  });

  test("should return original DataFrame when all status values are selected", () => {
    // Get all unique status values (excluding null and empty)
    const originalStatuses = testDf
      .getColumn("appointmentStatus")
      .toArray()
      .filter((val: any) => val !== null && val !== "");

    const uniqueStatusValues = Array.from(
      new Set(
        originalStatuses.map((val: any) => String(val).toLowerCase().trim())
      )
    );

    // Filter with all status values
    const filtered = filterDataFrameByStatus(
      testDf,
      "appointmentStatus",
      uniqueStatusValues as string[]
    );

    // Should include all non-null/non-empty records - validate actual count
    const expectedCount = originalStatuses.length;
    expect(filtered.height).toBe(expectedCount);

    // Verify that all filtered statuses are from the original set
    const filteredStatuses = filtered.getColumn("appointmentStatus").toArray();
    filteredStatuses.forEach((status: any) => {
      expect(originalStatuses).toContain(status);
    });
  });

  test("should handle empty or null status values", () => {
    // Filter to include statuses that might be empty/null
    const filtered = filterDataFrameByStatus(testDf, "appointmentStatus", [""]);

    // Should match the empty string after normalization (trimming)
    expect(filtered.height).toBe(1);

    // Find the patient ID that corresponds to the empty string in test data
    const allStatuses = testDf.getColumn("appointmentStatus").toArray();
    const allPatientIds = testDf.getColumn("patientId").toArray();

    const emptyStringIndex = allStatuses.findIndex(
      (status: any) => status === ""
    );
    const expectedPatientId = allPatientIds[emptyStringIndex];

    // Check that the correct empty record is included
    const patientIds = filtered.getColumn("patientId").toArray();
    expect(patientIds).toContain(expectedPatientId);
    expect(patientIds).toHaveLength(1);
    expect(patientIds[0]).toBe(expectedPatientId);
  });

  test("should return original DataFrame when inputs are invalid", () => {
    // Empty column name
    let filtered = filterDataFrameByStatus(testDf, "", ["Completed"]);
    expect(filtered.height).toBe(testDf.height);

    // Empty status values array
    filtered = filterDataFrameByStatus(testDf, "appointmentStatus", []);
    expect(filtered.height).toBe(testDf.height);

    // Null status values
    filtered = filterDataFrameByStatus(
      testDf,
      "appointmentStatus",
      (null as unknown) as string[]
    );
    expect(filtered.height).toBe(testDf.height);
  });

  test("should be case-insensitive when filtering", () => {
    // Filter with mixed-case status
    const filtered = filterDataFrameByStatus(testDf, "appointmentStatus", [
      "cOmPlEtEd",
    ]);

    // Should find all "completed" variations regardless of case
    expect(filtered.height).toBe(4);

    const filteredStatuses = filtered.getColumn("appointmentStatus").toArray();
    expect(filteredStatuses).toContain("Completed");
    expect(filteredStatuses).toContain("COMPLETED");
  });
});
