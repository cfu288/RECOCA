import { calculateTopProviders } from "../../../core/data/services/top-providers-core";

describe("calculateTopProviders", () => {
  test("should calculate top providers correctly", () => {
    const records = [
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "B" },
      { patientId: "P2", providerId: "B" },
      { patientId: "P2", providerId: "B" },
      { patientId: "P2", providerId: "C" },
    ];

    const result = calculateTopProviders(records);

    expect(result).toEqual({
      P1: { A: 2, B: 1 },
      P2: { B: 2, C: 1 },
    });
  });

  test("should handle performance with large datasets", () => {
    const records = [];
    const numPatients = 1000;
    const numProviders = 50;

    for (let i = 0; i < numPatients; i++) {
      for (let j = 0; j < 10; j++) {
        // 10 visits per patient
        records.push({
          patientId: `P${i}`,
          providerId: `Provider${i % numProviders}`,
        });
      }
    }

    const startTime = performance.now();
    const result = calculateTopProviders(records);
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(Object.keys(result)).toHaveLength(numPatients);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second

    // Verify correctness for first patient
    expect(result.P0).toEqual({ Provider0: 10 });
  });

  test("should limit to top 3 providers per patient", () => {
    // Arrange
    const records = [
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" }, // A: 4 visits
      { patientId: "P1", providerId: "B" },
      { patientId: "P1", providerId: "B" },
      { patientId: "P1", providerId: "B" }, // B: 3 visits
      { patientId: "P1", providerId: "C" },
      { patientId: "P1", providerId: "C" }, // C: 2 visits
      { patientId: "P1", providerId: "D" }, // D: 1 visit
      { patientId: "P1", providerId: "E" }, // E: 1 visit
    ];

    const result = calculateTopProviders(records);

    expect(Object.keys(result.P1)).toHaveLength(3);
    expect(result.P1).toEqual({ A: 4, B: 3, C: 2 });
    expect(result.P1.D).toBeUndefined();
    expect(result.P1.E).toBeUndefined();
  });

  test("should handle null and undefined values", () => {
    const records = [
      { patientId: "P1", providerId: "A" },
      { patientId: null, providerId: "A" },
      { patientId: "P1", providerId: null },
      { patientId: undefined, providerId: "B" },
      { patientId: "P2", providerId: undefined },
    ];

    const result = calculateTopProviders(records);

    expect(result).toEqual({
      P1: { A: 1 },
    });
  });
});
