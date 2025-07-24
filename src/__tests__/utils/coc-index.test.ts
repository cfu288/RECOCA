import * as pl from "nodejs-polars";
import { calculateCocIndex } from "../../core/continuity/indices/coc-index";

describe("CoC (Continuity of Care) Index Calculation", () => {
  test("should calculate CoC for the example pattern AAAABBBC", () => {
    /**
     * Test case for the pattern AAAABBBC
     *
     * AAAABBBC
     *
     * CoC = (Σ(n²ᵢ) - N) / (N(N-1))
     *
     * Calculation is: ((4² + 3² + 1²) - 8) / (8 * (8-1))
     * = ((16 + 9 + 1) - 8) / (8 * 7)
     * = (26 - 8) / 56
     * = 18 / 56
     * = 0.32142857142857145
     */
    const df = pl.DataFrame({
      patientId: Array(8).fill("P1"), // Eight visits for P1
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

    const result = calculateCocIndex(df, "provider", ["patientId"]);
    expect(result.averageCoc).toBeCloseTo(0.321, 3);
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.321, 3);
  });

  test("should calculate CoC for the example pattern AAAABBCC", () => {
    const df = pl.DataFrame({
      patientId: Array(8).fill("P1"), // Eight visits for P1
      provider: [
        "A",
        "A",
        "A",
        "A", // Four visits to A
        "B",
        "B", // Two visits to B
        "C",
        "C", // Two visits to C
      ],
    });

    // AAAABBCC
    // Calculation is: ((4² + 2² + 2²) - 8) / (8 * (8-1))
    // = ((16 + 4 + 4) - 8) / (8 * 7)
    // = (24 - 8) / 56
    // = 16 / 56
    // = 0.2857142857142857
    const result = calculateCocIndex(df, "provider", ["patientId"]);
    expect(result.averageCoc).toBeCloseTo(0.286, 3);
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.286, 3);
  });

  test("should calculate CoC for a pattern with high continuity", () => {
    const df = pl.DataFrame({
      patientId: Array(10).fill("P1"), // Ten visits for P1
      provider: [
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A", // Eight visits to A
        "B",
        "B", // Two visits to B
      ],
    });

    // Calculation is: ((8² + 2²) - 10) / (10 * (10-1))
    // = ((64 + 4) - 10) / (10 * 9)
    // = (68 - 10) / 90
    // = 58 / 90
    // = 0.644
    const result = calculateCocIndex(df, "provider", ["patientId"]);
    expect(result.averageCoc).toBeCloseTo(0.644, 3);
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.644, 3);
  });

  test("should calculate CoC for a pattern with very high continuity", () => {
    const df = pl.DataFrame({
      patientId: Array(10).fill("P1"), // Ten visits for P1
      provider: [
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A", // Nine visits to A
        "B", // One visit to B
      ],
    });

    // Calculation is: ((9² + 1²) - 10) / (10 * (10-1))
    // = ((81 + 1) - 10) / (10 * 9)
    // = (82 - 10) / 90
    // = 72 / 90
    // = 0.8
    const result = calculateCocIndex(df, "provider", ["patientId"]);
    expect(result.averageCoc).toBeCloseTo(0.8, 3);
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.8, 3);
  });

  test("should calculate CoC for multiple patients with different patterns", () => {
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
        "P2", // 8 visits for P2 (AAAABBCC)
        "P3",
        "P3",
        "P3",
        "P3",
        "P3",
        "P3",
        "P3",
        "P3",
        "P3",
        "P3", // 10 visits for P3 (AAAAAAAABB)
      ],
      provider: [
        // P1: AAAABBBC - CoC = 0.321
        "A",
        "A",
        "A",
        "A",
        "B",
        "B",
        "B",
        "C",
        // P2: AAAABBCC - CoC = 0.286
        "A",
        "A",
        "A",
        "A",
        "B",
        "B",
        "C",
        "C",
        // P3: AAAAAAAABB - CoC = 0.644
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "B",
        "B",
      ],
    });

    const result = calculateCocIndex(df, "provider", ["patientId"]);

    // Average of the three patients: (0.321 + 0.286 + 0.644) / 3 = 0.417
    expect(result.averageCoc).toBeCloseTo(0.417, 3);

    // Check individual patient scores
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.321, 3);
    expect(result.patientCocScores["P2"]).toBeCloseTo(0.286, 3);
    expect(result.patientCocScores["P3"]).toBeCloseTo(0.644, 3);
  });

  test("should skip patients with only one visit", () => {
    const df = pl.DataFrame({
      patientId: [
        "P1",
        "P1",
        "P1", // Three visits for P1
        "P2", // One visit for P2 (should be skipped)
        "P3",
        "P3",
        "P3",
        "P3", // Four visits for P3
      ],
      provider: [
        "A",
        "A",
        "B", // P1: 2A, 1B - CoC = 0.333
        "C", // P2: 1C (skipped)
        "D",
        "D",
        "D",
        "E", // P3: 3D, 1E - CoC = 0.5
      ],
    });

    const result = calculateCocIndex(df, "provider", ["patientId"]);

    // P1: ((2² + 1²) - 3) / (3 * 2) = (4 + 1 - 3) / 6 = 2/6 = 0.333
    // P3: ((3² + 1²) - 4) / (4 * 3) = (9 + 1 - 4) / 12 = 6/12 = 0.5
    // Average: (0.333 + 0.5) / 2 = 0.4165
    expect(result.averageCoc).toBeCloseTo(0.417, 3);

    // Check that P2 is not in the results
    expect(result.patientCocScores["P1"]).toBeCloseTo(0.333, 3);
    expect(result.patientCocScores["P2"]).toBeUndefined();
    expect(result.patientCocScores["P3"]).toBeCloseTo(0.5, 3);
  });

  test("should handle the case where a patient sees the same provider for all visits", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", "A", "A", "A", "B", "B", "B"],
    });

    // P1: 4 visits, all to provider A - CoC = 1.0
    // P2: 3 visits, all to provider B - CoC = 1.0
    const result = calculateCocIndex(df, "provider", ["patientId"]);

    // Perfect continuity = 1.0
    expect(result.averageCoc).toBe(1);
    expect(result.patientCocScores["P1"]).toBe(1);
    expect(result.patientCocScores["P2"]).toBe(1);
  });

  test("should handle the case where each visit is to a different provider", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1"],
      provider: ["A", "B", "C", "D", "E"],
    });

    // P1: 5 visits, each to a different provider
    // Calculation: ((1² + 1² + 1² + 1² + 1²) - 5) / (5 * 4) = (5 - 5) / 20 = 0
    const result = calculateCocIndex(df, "provider", ["patientId"]);

    // No continuity = 0.0
    expect(result.averageCoc).toBe(0);
    expect(result.patientCocScores["P1"]).toBe(0);
  });

  test("should handle composite patient identifiers", () => {
    const df = pl.DataFrame({
      lastName: [
        "Smith",
        "Smith",
        "Smith",
        "Smith", // 4 visits for Smith|John
        "Jones",
        "Jones",
        "Jones", // 3 visits for Jones|Mary
      ],
      firstName: [
        "John",
        "John",
        "John",
        "John", // 4 visits for Smith|John
        "Mary",
        "Mary",
        "Mary", // 3 visits for Jones|Mary
      ],
      provider: [
        "A",
        "A",
        "A",
        "B", // 3A, 1B for Smith|John
        "C",
        "C",
        "D", // 2C, 1D for Jones|Mary
      ],
    });

    // Smith|John: ((3² + 1²) - 4) / (4 * 3) = (9 + 1 - 4) / 12 = 6/12 = 0.5
    // Jones|Mary: ((2² + 1²) - 3) / (3 * 2) = (4 + 1 - 3) / 6 = 2/6 = 0.333
    const result = calculateCocIndex(df, "provider", ["lastName", "firstName"]);

    // Average: (0.5 + 0.333) / 2 = 0.4165
    expect(result.averageCoc).toBeCloseTo(0.417, 3);
    expect(result.patientCocScores["Smith|John"]).toBeCloseTo(0.5, 3);
    expect(result.patientCocScores["Jones|Mary"]).toBeCloseTo(0.333, 3);
  });

  test("should return an average of 0 for an empty DataFrame", () => {
    const emptyDf = pl.DataFrame({
      patientId: [],
      provider: [],
    });

    const result = calculateCocIndex(emptyDf, "provider", ["patientId"]);
    expect(result.averageCoc).toBe(0);
    expect(Object.keys(result.patientCocScores).length).toBe(0);
  });

  test("should handle missing or null provider values", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", null, "A", "B", "C", "", "C"],
    });

    // P1: 3 actual visits (null is ignored): 2A, 1B
    // Calculation: ((2² + 1²) - 3) / (3 * 2) = (4 + 1 - 3) / 6 = 2/6 = 0.333

    // P2: 2 actual visits (empty string is ignored): 2C
    // Calculation: (2² - 2) / (2 * 1) = (4 - 2) / 2 = 2/2 = 1.0

    const result = calculateCocIndex(df, "provider", ["patientId"]);

    // Average: (0.333 + 1.0) / 2 = 0.666
    expect(result.averageCoc).toBeCloseTo(0.666, 2);

    expect(result.patientCocScores["P1"]).toBeCloseTo(0.333, 3);
    expect(result.patientCocScores["P2"]).toBe(1);
  });

  test("should handle a DataFrame where all patients have only one visit", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P2", "P3", "P4"],
      provider: ["A", "B", "C", "D"],
    });

    // All patients have only one visit, they should all be excluded
    const result = calculateCocIndex(df, "provider", ["patientId"]);
    expect(result.averageCoc).toBeUndefined();
    expect(Object.keys(result.patientCocScores).length).toBe(0);
  });

  test("should handle invalid provider column gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
    });

    const result = calculateCocIndex(df, "nonExistentColumn", ["patientId"]);
    expect(result.averageCoc).toBeUndefined();
    expect(Object.keys(result.patientCocScores).length).toBe(0);
  });

  test("should handle invalid patient identifier column gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
    });

    const result = calculateCocIndex(df, "provider", ["nonExistentColumn"]);
    expect(result.averageCoc).toBeUndefined();
    expect(Object.keys(result.patientCocScores).length).toBe(0);
  });

  test("should handle partially missing patient identifier columns", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      lastName: ["Smith", "Smith", "Smith"],
      provider: ["A", "A", "B"],
    });

    // When one of multiple patient ID columns doesn't exist
    const result = calculateCocIndex(df, "provider", [
      "patientId",
      "lastName",
      "nonExistentColumn",
    ]);
    expect(result.averageCoc).toBeUndefined();
    expect(Object.keys(result.patientCocScores).length).toBe(0);
  });
});
