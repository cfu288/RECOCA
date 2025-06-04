import * as pl from "nodejs-polars";
import { calculateUpcIndex } from "../../core/continuity/indices/upc-index";

describe("UPC Index Calculation", () => {
  test("should calculate UPC for a DataFrame with multiple patients and visits", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2", "P2", "P2"],
      provider: ["A", "A", "A", "B", "C", "C", "D", "D", "E"],
    });

    // P1: Visits = AAAB (3A, 1B) = 3/4 = 0.75
    // P2: Visits = CCDDE (2C, 2D, 1E) = 2/5 = 0.4
    // Average UPC = (0.75 + 0.4) / 2 = 0.575
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.575);
  });

  test("should handle the example pattern AAAABBBC", () => {
    const df = pl.DataFrame({
      patientId: [
        "P1",
        "P1",
        "P1",
        "P1", // Four visits to A
        "P1",
        "P1",
        "P1", // Three visits to B
        "P1", // One visit to C
      ],
      provider: [
        "A",
        "A",
        "A",
        "A", // Four visits to A
        "B",
        "B",
        "B", // Three visits to B
        "C", // One visit to C
      ],
    });

    // AAAABBBC - UPC should be 4/8 = 0.5
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.5);
  });

  test("should handle the example pattern AAAAABBCCD", () => {
    const df = pl.DataFrame({
      patientId: Array(10).fill("P1"), // Ten visits for P1
      provider: [
        "A",
        "A",
        "A",
        "A",
        "A", // Five visits to A
        "B",
        "B", // Two visits to B
        "C",
        "C", // Two visits to C
        "D", // One visit to D
      ],
    });

    // AAAAABBCCD - UPC should be 5/10 = 0.5
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.5);
  });

  test("should handle the example pattern AABBAACAAB", () => {
    const df = pl.DataFrame({
      patientId: Array(10).fill("P1"), // Ten visits for P1
      provider: [
        "A",
        "A", // Two visits to A
        "B",
        "B", // Two visits to B
        "A",
        "A", // Two more visits to A
        "C", // One visit to C
        "A",
        "A", // Two more visits to A
        "B", // One more visit to B
      ],
    });

    // AABBAACAAB - Total: 6A, 3B, 1C - UPC should be 6/10 = 0.6
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.6);
  });

  test("should handle the example pattern AABCAABA", () => {
    const df = pl.DataFrame({
      patientId: Array(8).fill("P1"), // Eight visits for P1
      provider: [
        "A",
        "A", // Two visits to A
        "B", // One visit to B
        "C", // One visit to C
        "A",
        "A", // Two more visits to A
        "B", // One more visit to B
        "A", // One more visit to A
      ],
    });

    // AABCAABA - Total: 5A, 2B, 1C - UPC should be 5/8 = 0.625
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.625);
  });

  test("should handle multiple patients with different patterns", () => {
    const df = pl.DataFrame({
      patientId: [
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1", // 8 visits for P1 (AAAABBBC)
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2", // 10 visits for P2 (AABBAACAAB)
      ],
      provider: [
        // P1: AAAABBBC
        "A",
        "A",
        "A",
        "A",
        "B",
        "B",
        "B",
        "C",
        // P2: AABBAACAAB
        "A",
        "A",
        "B",
        "B",
        "A",
        "A",
        "C",
        "A",
        "A",
        "B",
      ],
    });

    // P1: UPC = 4/8 = 0.5
    // P2: UPC = 6/10 = 0.6
    // Average UPC = (0.5 + 0.6) / 2 = 0.55
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.55);
  });

  test("should skip patients with only one visit", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P2", "P3", "P3"],
      provider: ["A", "B", "A", "C", "D", "E"],
    });

    // P1: 2A, 1B - UPC = 2/3 = 0.667
    // P2: Only 1 visit, should be excluded
    // P3: 1D, 1E - UPC = 1/2 = 0.5
    // Average UPC = (0.667 + 0.5) / 2 = 0.583
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.583, 3);
  });

  test("should handle a DataFrame where all patients have only one visit", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P2", "P3", "P4"],
      provider: ["A", "B", "C", "D"],
    });

    // All patients have only one visit, so they should all be excluded
    // No UPC can be calculated
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeUndefined();
  });

  test("should handle composite patient identifiers", () => {
    const df = pl.DataFrame({
      lastName: ["Smith", "Smith", "Smith", "Jones", "Jones"],
      firstName: ["John", "John", "John", "Mary", "Mary"],
      provider: ["A", "A", "B", "C", "D"],
    });

    // Patient "Smith|John": 2A, 1B - UPC = 2/3 = 0.667
    // Patient "Jones|Mary": 1C, 1D - UPC = 1/2 = 0.5
    // Average UPC = (0.667 + 0.5) / 2 = 0.583
    const upcResult = calculateUpcIndex(df, "provider", [
      "lastName",
      "firstName",
    ]);
    expect(upcResult.averageUpc).toBeCloseTo(0.583, 3);
  });

  test("should return 0 for an empty DataFrame", () => {
    const emptyDf = pl.DataFrame({
      patientId: [],
      provider: [],
    });

    const upcResult = calculateUpcIndex(emptyDf, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBe(0);
  });

  test("should handle the case where a patient sees the same provider for all visits", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", "A", "A", "A", "B", "B", "B"],
    });

    // P1: 4A/4 visits = 1.0
    // P2: 3B/3 visits = 1.0
    // Average UPC = (1.0 + 1.0) / 2 = 1.0
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBe(1);
  });

  test("should handle the case where a patient sees different providers equally", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1", "P1"],
      provider: ["A", "A", "B", "B", "C", "C"],
    });

    // P1: 2A, 2B, 2C - UPC = 2/6 = 0.333
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.333, 3);
  });

  test("should handle missing or null provider values", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", null, "A", "B", "C", "", "C"],
    });

    // P1: 2A, 1B (null is ignored) - UPC = 2/3 = 0.667
    // P2: 2C (empty string is ignored) - UPC = 2/2 = 1.0
    // Average UPC = (0.667 + 1.0) / 2 = 0.833
    const upcResult = calculateUpcIndex(df, "provider", ["patientId"]);
    expect(upcResult.averageUpc).toBeCloseTo(0.833, 3);
  });

  test("should handle large datasets efficiently", () => {
    // Create a large dataset with 1000 patients, each with 5-15 visits
    const largeData: { patientId: string[]; provider: string[] } = {
      patientId: [],
      provider: [],
    };

    for (let patientNum = 1; patientNum <= 1000; patientNum++) {
      const patientId = `P${patientNum.toString().padStart(4, "0")}`;
      const visitCount = 5 + (patientNum % 11); // 5-15 visits per patient

      for (let visit = 0; visit < visitCount; visit++) {
        largeData.patientId.push(patientId);
        // Assign providers with some visiting one provider more frequently
        if (visit < Math.floor(visitCount * 0.6)) {
          largeData.provider.push(`Dr_A_${patientNum % 100}`); // Primary provider
        } else {
          largeData.provider.push(`Dr_B_${patientNum % 50}`); // Secondary providers
        }
      }
    }

    const largeDf = pl.DataFrame(largeData);

    // Performance test - should complete in reasonable time
    const startTime = Date.now();
    const result = calculateUpcIndex(largeDf, "provider", ["patientId"]);
    const endTime = Date.now();

    // Should complete within 5 seconds for 1000 patients
    expect(endTime - startTime).toBeLessThan(5000);

    // Should have calculated UPC for all 1000 patients
    expect(Object.keys(result.patientUpcScores)).toHaveLength(1000);

    // Average UPC should be reasonable (patients see primary provider ~60% of time)
    expect(result.averageUpc).toBeGreaterThan(0.5);
    expect(result.averageUpc).toBeLessThan(1.0);
  });

  test("should handle special characters in provider and patient IDs", () => {
    const df = pl.DataFrame({
      patientId: [
        "Patient-José",
        "Patient-José",
        "Patient-José",
        "Patient-李王",
        "Patient-李王",
        "Patient-Müller",
        "Patient-Müller",
        "Patient-Müller",
        "Patient-Müller",
      ],
      provider: [
        "Dr. García-López",
        "Dr. García-López",
        "Dr. Smith",
        "Dr. 李医生",
        "Dr. 李医生",
        "Dr. François",
        "Dr. François",
        "Dr. François",
        "Dr. Smith",
      ],
    });

    const result = calculateUpcIndex(df, "provider", ["patientId"]);

    // Should handle special characters without issues
    expect(result.patientUpcScores["Patient-José"]).toBeCloseTo(0.667, 3); // 2/3
    expect(result.patientUpcScores["Patient-李王"]).toBe(1.0); // 2/2
    expect(result.patientUpcScores["Patient-Müller"]).toBe(0.75); // 3/4
  });
});
