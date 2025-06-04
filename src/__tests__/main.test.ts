import * as pl from "nodejs-polars";
import { calculateAppointmentDistribution } from "../electron/handlers/shared";
import {
  calculateTopProviders,
  PatientVisitRecord,
} from "../core/data/services/top-providers-core";

// =============================================================================
// SETUP/MOCKING
// =============================================================================

// Mock Electron app for tests
jest.mock("electron", () => {
  return {
    app: {
      getPath: jest.fn().mockReturnValue("/tmp"),
      on: jest.fn(),
      quit: jest.fn(),
    },
    ipcMain: {
      handle: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadURL: jest.fn(),
      loadFile: jest.fn(),
      webContents: {
        openDevTools: jest.fn(),
      },
    })),
  };
});

/**
 * Helper function to convert simple test data to PatientVisitRecord format
 *
 * This function transforms test data objects into the PatientVisitRecord format
 * expected by the core algorithm
 */
function createPatientVisitRecords(data: {
  patientId: (string | number | null | undefined)[];
  providerId: (string | number | null | undefined)[];
}): PatientVisitRecord[] {
  const records: PatientVisitRecord[] = [];

  for (let i = 0; i < data.patientId.length; i++) {
    const patientId = data.patientId[i];
    const providerId = data.providerId[i];

    // Skip null/undefined values (simulating the filtering that happens in production)
    if (patientId == null || providerId == null) {
      continue;
    }

    records.push({
      patientId: String(patientId),
      providerId: String(providerId),
    });
  }

  return records;
}

// =============================================================================
// TESTS
// =============================================================================

describe("calculateTopProviders", () => {
  it("should return top 3 providers for each patient", async () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2", "P3", "P3"],
      providerId: [
        "DR1",
        "DR1",
        "DR2",
        "DR3",
        "DR1",
        "DR2",
        "DR3",
        "DR1",
        "DR2",
      ],
    };

    const patientVisitRecords = createPatientVisitRecords(data);
    const result = calculateTopProviders(patientVisitRecords);

    // Check P1's providers (should have 4 visits, top 3)
    expect(result["P1"]).toBeDefined();
    expect(Object.keys(result["P1"])).toHaveLength(3);
    expect(result["P1"]["DR1"]).toBe(2); // DR1 has 2 visits
    expect(result["P1"]["DR2"]).toBe(1);
    expect(result["P1"]["DR3"]).toBe(1);

    // Check P2's providers (should have 3 visits, all included)
    expect(result["P2"]).toBeDefined();
    expect(Object.keys(result["P2"])).toHaveLength(3);
    expect(result["P2"]["DR1"]).toBe(1);
    expect(result["P2"]["DR2"]).toBe(1);
    expect(result["P2"]["DR3"]).toBe(1);

    // Check P3's providers (should have 2 visits, both included)
    expect(result["P3"]).toBeDefined();
    expect(Object.keys(result["P3"])).toHaveLength(2);
    expect(result["P3"]["DR1"]).toBe(1);
    expect(result["P3"]["DR2"]).toBe(1);
  });

  describe("Edge Cases", () => {
    test.each([
      {
        description: "empty data",
        data: { patientId: [], providerId: [] },
        expected: {},
      },
      {
        description: "null/undefined provider values",
        data: {
          patientId: ["P1", "P1", "P2", "P2"],
          providerId: ["DR1", null, "DR2", undefined],
        },
        expected: {
          P1: { DR1: 1 },
          P2: { DR2: 1 },
        },
      },
      {
        description: "non-string values",
        data: {
          patientId: [1, 1, 2, 2],
          providerId: [101, 101, 102, 102],
        },
        expected: {
          "1": { "101": 2 },
          "2": { "102": 2 },
        },
      },
      {
        description: "single provider per patient",
        data: {
          patientId: ["P1", "P2", "P3"],
          providerId: ["DR1", "DR2", "DR3"],
        },
        expected: {
          P1: { DR1: 1 },
          P2: { DR2: 1 },
          P3: { DR3: 1 },
        },
      },
    ])("should handle $description", ({ data, expected }) => {
      const patientVisitRecords = createPatientVisitRecords(data);
      const result = calculateTopProviders(patientVisitRecords);
      expect(result).toEqual(expected);
    });

    it("should limit to top 3 providers when patient has more than 3", () => {
      const data = {
        patientId: ["P1", "P1", "P1", "P1", "P1", "P1"],
        providerId: ["DR1", "DR1", "DR2", "DR3", "DR4", "DR5"],
      };

      const patientVisitRecords = createPatientVisitRecords(data);
      const result = calculateTopProviders(patientVisitRecords);

      expect(result["P1"]).toBeDefined();
      expect(Object.keys(result["P1"])).toHaveLength(3); // Should only include top 3
      expect(result["P1"]["DR1"]).toBe(2); // DR1 has 2 visits
      expect(result["P1"]["DR2"]).toBe(1);
      expect(result["P1"]["DR3"]).toBe(1);
      // DR4 and DR5 should not be included
      expect(result["P1"]["DR4"]).toBeUndefined();
      expect(result["P1"]["DR5"]).toBeUndefined();
    });
  });
});

describe("calculateAppointmentDistribution", () => {
  /**
   * Tests for appointment distribution calculation
   */
  describe("Core Functionality", () => {
    test.each([
      {
        description: "basic distribution pattern",
        data: {
          patientId: [
            "P1",
            "P2",
            "P3",
            "P4",
            "P4",
            "P5",
            "P5",
            "P6",
            "P6",
            "P6",
          ],
          providerId: [
            "DR1",
            "DR2",
            "DR3",
            "DR1",
            "DR2",
            "DR1",
            "DR3",
            "DR1",
            "DR2",
            "DR3",
          ],
        },
        expected: {
          "1": 3, // 3 patients with 1 appointment
          "2": 2, // 2 patients with 2 appointments
          "3": 1, // 1 patient with 3 appointments
        },
      },
      {
        description: "empty data",
        data: { patientId: [], providerId: [] },
        expected: {},
      },
      {
        description: "single patient with multiple appointments",
        data: {
          patientId: Array(5).fill("P1"),
          providerId: ["DR1", "DR2", "DR3", "DR4", "DR5"],
        },
        expected: { "5": 1 },
      },
      {
        description: "mixed data types",
        data: {
          patientId: [1, 2, 2, 3, 3, 3],
          providerId: [101, 102, 103, 104, 105, 106],
        },
        expected: {
          "1": 1, // 1 patient with 1 appointment
          "2": 1, // 1 patient with 2 appointments
          "3": 1, // 1 patient with 3 appointments
        },
      },
    ])("should handle $description", ({ data, expected }) => {
      const df = (pl.DataFrame as any)(data);
      const distribution = calculateAppointmentDistribution(df, "patientId");
      expect(distribution).toEqual(expected);
    });
  });

  /**
   * Tests for error handling and data validation
   */
  describe("Error handling and validation", () => {
    it("should handle null/undefined patient IDs", () => {
      const data: Record<string, any[]> = {
        patientId: ["P1", null, "P2", undefined, "P3"],
        providerId: ["DR1", "DR2", "DR3", "DR4", "DR5"],
      };
      const df = (pl.DataFrame as any)(data);

      const distribution = calculateAppointmentDistribution(df, "patientId");

      // Should only count valid patient IDs
      expect(distribution).toEqual({
        "1": 3, // 3 patients with 1 appointment each
      });
    });

    it("should handle invalid column names", () => {
      const data: Record<string, string[]> = {
        patientId: ["P1", "P2", "P3"],
        providerId: ["DR1", "DR2", "DR3"],
      };
      const df = (pl.DataFrame as any)(data);

      const distribution = calculateAppointmentDistribution(
        df,
        "nonExistentColumn"
      );
      expect(distribution).toEqual({});
    });

    it("should handle complex distribution patterns", () => {
      /**
       * Test a realistic distribution:
       * - 10 patients with 1 appointment each
       * - 5 patients with 2 appointments each
       * - 3 patients with 3 appointments each
       * - 2 patients with 5 appointments each
       * - 1 patient with 10 appointments
       */
      const data: Record<string, any[]> = {
        patientId: [],
        providerId: [],
      };

      // Build test data programmatically
      const patterns = [
        { count: 10, appointments: 1 },
        { count: 5, appointments: 2 },
        { count: 3, appointments: 3 },
        { count: 2, appointments: 5 },
        { count: 1, appointments: 10 },
      ];

      let patientIndex = 1;
      patterns.forEach(({ count, appointments }) => {
        for (let i = 0; i < count; i++) {
          for (let j = 0; j < appointments; j++) {
            data.patientId.push(`P${patientIndex}`);
            data.providerId.push(`DR${j + 1}`);
          }
          patientIndex++;
        }
      });

      const df = (pl.DataFrame as any)(data);
      const distribution = calculateAppointmentDistribution(df, "patientId");

      expect(distribution).toEqual({
        "1": 10,
        "2": 5,
        "3": 3,
        "5": 2,
        "10": 1,
      });
    });
  });
});
