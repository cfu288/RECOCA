import * as pl from "nodejs-polars";
import { calculateSeconIndex } from "../../core/continuity/indices/secon-index";

describe("calculateSeconIndex", () => {
  it("calculates SECON correctly for a simple case", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      providerId: ["Dr1", "Dr1", "Dr2", "Dr1", "Dr2", "Dr2"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // For patient P1: ["Dr1", "Dr1", "Dr2"] -> 2 sequential pairs, 1 match -> SECON = 0.5
    // For patient P2: ["Dr1", "Dr2", "Dr2"] -> 2 sequential pairs, 1 match -> SECON = 0.5
    // Average SECON = (0.5 + 0.5) / 2 = 0.5
    expect(result.averageSecon).toBeCloseTo(0.5);
    expect(Object.keys(result.patientSeconScores).length).toBe(2);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.5);
    expect(result.patientSeconScores["P2"]).toBeCloseTo(0.5);
  });

  // Test case with perfect sequential continuity
  it("calculates SECON correctly for perfect sequential continuity", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2", "P2"],
      providerId: ["Dr1", "Dr1", "Dr1", "Dr2", "Dr2", "Dr2", "Dr2"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // For patient P1: ["Dr1", "Dr1", "Dr1"] -> 2 sequential pairs, 2 matches -> SECON = 1.0
    // For patient P2: ["Dr2", "Dr2", "Dr2", "Dr2"] -> 3 sequential pairs, 3 matches -> SECON = 1.0
    // Average SECON = (1.0 + 1.0) / 2 = 1.0
    expect(result.averageSecon).toBeCloseTo(1.0);
    expect(Object.keys(result.patientSeconScores).length).toBe(2);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(1.0);
    expect(result.patientSeconScores["P2"]).toBeCloseTo(1.0);
  });

  // Test case with no sequential continuity
  it("calculates SECON correctly for no sequential continuity", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      providerId: ["Dr1", "Dr2", "Dr3", "Dr1", "Dr2", "Dr3"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // For patient P1: ["Dr1", "Dr2", "Dr3"] -> 2 sequential pairs, 0 matches -> SECON = 0.0
    // For patient P2: ["Dr1", "Dr2", "Dr3"] -> 2 sequential pairs, 0 matches -> SECON = 0.0
    // Average SECON = (0.0 + 0.0) / 2 = 0.0
    expect(result.averageSecon).toBeCloseTo(0.0);
    expect(Object.keys(result.patientSeconScores).length).toBe(2);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.0);
    expect(result.patientSeconScores["P2"]).toBeCloseTo(0.0);
  });

  // Test with patients having different SECON values
  it("calculates SECON correctly for mixed continuity patterns", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2", "P3", "P3", "P3", "P3"],
      providerId: [
        "Dr1",
        "Dr1",
        "Dr2",
        "Dr1",
        "Dr2",
        "Dr3",
        "Dr1",
        "Dr1",
        "Dr1",
        "Dr1",
      ],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // For patient P1: ["Dr1", "Dr1", "Dr2"] -> 2 sequential pairs, 1 match -> SECON = 0.5
    // For patient P2: ["Dr1", "Dr2", "Dr3"] -> 2 sequential pairs, 0 matches -> SECON = 0.0
    // For patient P3: ["Dr1", "Dr1", "Dr1", "Dr1"] -> 3 sequential pairs, 3 matches -> SECON = 1.0
    // Average SECON = (0.5 + 0.0 + 1.0) / 3 = 0.5
    expect(result.averageSecon).toBeCloseTo(0.5);
    expect(Object.keys(result.patientSeconScores).length).toBe(3);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.5);
    expect(result.patientSeconScores["P2"]).toBeCloseTo(0.0);
    expect(result.patientSeconScores["P3"]).toBeCloseTo(1.0);
  });

  // Test with patients having only one visit (should be excluded)
  it("excludes patients with only one visit", () => {
    const data = {
      patientId: ["P1", "P2", "P2", "P2", "P3"],
      providerId: ["Dr1", "Dr1", "Dr1", "Dr1", "Dr3"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // Patient P1 should be excluded (only one visit)
    // For patient P2: ["Dr1", "Dr1", "Dr1"] -> 2 sequential pairs, 2 matches -> SECON = 1.0
    // Patient P3 should be excluded (only one visit)
    // Average SECON = 1.0 (only P2 is included)
    expect(result.averageSecon).toBeCloseTo(1.0);
    expect(Object.keys(result.patientSeconScores).length).toBe(1);
    expect(result.patientSeconScores["P1"]).toBeUndefined();
    expect(result.patientSeconScores["P2"]).toBeCloseTo(1.0);
    expect(result.patientSeconScores["P3"]).toBeUndefined();
  });

  // Test with empty DataFrame
  it("handles empty DataFrames correctly", () => {
    const df = pl.DataFrame({ patientId: [], providerId: [] });

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    expect(result.averageSecon).toBe(0);
    expect(Object.keys(result.patientSeconScores).length).toBe(0);
  });

  // Test with missing provider values
  it("handles missing provider values correctly", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      providerId: ["Dr1", null, "Dr2", "Dr1", undefined, "Dr3"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // The function should skip null/undefined values in the calculation
    expect(result.averageSecon).not.toBeNaN();
  });

  // Test with composite patient ID
  it("supports composite patient identifiers", () => {
    const data = {
      lastName: ["Smith", "Smith", "Smith", "Jones", "Jones", "Jones"],
      firstName: ["John", "John", "John", "Bob", "Bob", "Bob"],
      providerId: ["Dr1", "Dr1", "Dr2", "Dr3", "Dr3", "Dr3"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", [
      "lastName",
      "firstName",
    ]);

    // For patient "Smith|John": ["Dr1", "Dr1", "Dr2"] -> 2 sequential pairs, 1 match -> SECON = 0.5
    // For patient "Jones|Bob": ["Dr3", "Dr3", "Dr3"] -> 2 sequential pairs, 2 matches -> SECON = 1.0
    // Average SECON = (0.5 + 1.0) / 2 = 0.75
    expect(result.averageSecon).toBeCloseTo(0.75);
    expect(Object.keys(result.patientSeconScores).length).toBe(2);
    expect(result.patientSeconScores["Smith|John"]).toBeCloseTo(0.5);
    expect(result.patientSeconScores["Jones|Bob"]).toBeCloseTo(1.0);
  });

  // Edge case: a very large number of visits for a single patient
  it("handles a large number of sequential visits correctly", () => {
    // Create a patient with 100 visits, alternating between Dr1 and Dr2
    const patientId = Array(100).fill("P1");
    const providerId = Array(100)
      .fill("")
      .map((_, i) => (i % 2 === 0 ? "Dr1" : "Dr2"));

    const df = pl.DataFrame({ patientId, providerId });

    const result = calculateSeconIndex(df, "providerId", ["patientId"]);

    // For 100 visits alternating Dr1, Dr2, Dr1, Dr2... -> 0 matches out of 99 pairs
    // SECON = 0.0
    expect(result.averageSecon).toBeCloseTo(0.0);
    expect(Object.keys(result.patientSeconScores).length).toBe(1);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.0);
  });

  // Test handling invalid column names
  it("handles invalid column names gracefully", () => {
    const data = {
      patientId: ["P1", "P1", "P1"],
      providerId: ["Dr1", "Dr1", "Dr2"],
    };
    const df = pl.DataFrame(data);

    // Pass non-existent column names
    const result = calculateSeconIndex(df, "nonExistentColumn", ["patientId"]);

    // Should handle this gracefully
    expect(result.averageSecon).toBeUndefined();
    expect(Object.keys(result.patientSeconScores).length).toBe(0);
  });
});
