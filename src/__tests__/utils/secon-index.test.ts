import * as pl from "nodejs-polars";
import { calculateSeconIndex } from "../../core/continuity/indices/secon-index";

describe("calculateSeconIndex", () => {
  it("calculates SECON correctly for a simple case", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      providerId: ["Dr1", "Dr1", "Dr2", "Dr1", "Dr2", "Dr2"],
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07", "2023-01-08", "2023-01-09", "2023-01-10"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
    const df = pl.DataFrame({ patientId: [], providerId: [], visitDate: [] });

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

    expect(result.averageSecon).toBe(0);
    expect(Object.keys(result.patientSeconScores).length).toBe(0);
  });

  // Test with missing provider values
  it("handles missing provider values correctly", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      providerId: ["Dr1", null, "Dr2", "Dr1", undefined, "Dr3"],
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

    // The function should skip null/undefined values in the calculation
    expect(result.averageSecon).not.toBeNaN();
  });

  // Test with composite patient ID
  it("supports composite patient identifiers", () => {
    const data = {
      lastName: ["Smith", "Smith", "Smith", "Jones", "Jones", "Jones"],
      firstName: ["John", "John", "John", "Bob", "Bob", "Bob"],
      providerId: ["Dr1", "Dr1", "Dr2", "Dr3", "Dr3", "Dr3"],
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06"]
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", [
      "lastName",
      "firstName",
    ], "visitDate");

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

    // Create dates for 100 visits
    const visitDate = Array(100).fill("").map((_, i) => {
      const date = new Date(2023, 0, i + 1);
      return date.toISOString().split('T')[0];
    });
    const df = pl.DataFrame({ patientId, providerId, visitDate });

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

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
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03"]
    };
    const df = pl.DataFrame(data);

    // Pass non-existent column names
    const result = calculateSeconIndex(df, "nonExistentColumn", ["patientId"], "visitDate");

    // Should handle this gracefully
    expect(result.averageSecon).toBeUndefined();
    expect(Object.keys(result.patientSeconScores).length).toBe(0);
  });

  // Test that SECON now sorts by date before calculating
  it("sorts visits by date before calculating SECON", () => {
    // Create data where the dates are not in order
    const data = {
      patientId: ["P1", "P1", "P1"],
      providerId: ["Dr1", "Dr2", "Dr1"],
      visitDate: ["2023-01-03", "2023-01-01", "2023-01-02"], // Dates are NOT in order
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

    // SECON now sorts by date first: 2023-01-01 (Dr2), 2023-01-02 (Dr1), 2023-01-03 (Dr1)
    // Sequential pairs: (Dr2,Dr1), (Dr1,Dr1)
    // Matches: 0 + 1 = 1 out of 2 pairs = 0.5
    expect(result.averageSecon).toBeCloseTo(0.5);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.5);
  });

  // Test with multiple patients to ensure order is preserved within each patient
  it("preserves visit order within each patient when multiple patients exist", () => {
    // Create data with two patients where order matters
    const data = {
      patientId: ["P1", "P2", "P1", "P2", "P1", "P2"],
      providerId: ["Dr1", "Dr3", "Dr2", "Dr3", "Dr1", "Dr4"],
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06"],
      // P1 visits in DataFrame order: Dr1, Dr2, Dr1 (positions 0, 2, 4)
      // P2 visits in DataFrame order: Dr3, Dr3, Dr4 (positions 1, 3, 5)
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

    // P1: Dr1 -> Dr2 -> Dr1 = 0 matches out of 2 pairs = 0.0
    // P2: Dr3 -> Dr3 -> Dr4 = 1 match out of 2 pairs = 0.5
    // Average = (0.0 + 0.5) / 2 = 0.25
    expect(result.averageSecon).toBeCloseTo(0.25);
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.0);
    expect(result.patientSeconScores["P2"]).toBeCloseTo(0.5);
  });

  // Test that SECON now automatically sorts by date
  it("SECON now automatically sorts visits chronologically", () => {
    // This test confirms that SECON now sorts by date before calculating
    const data = {
      patientId: ["P1", "P1", "P1", "P1"],
      providerId: ["Dr1", "Dr2", "Dr1", "Dr1"],
      visitDate: ["2023-01-04", "2023-01-01", "2023-01-03", "2023-01-02"],
    };
    const df = pl.DataFrame(data);

    const result = calculateSeconIndex(df, "providerId", ["patientId"], "visitDate");

    // After sorting by date: Dr2 (01-01), Dr1 (01-02), Dr1 (01-03), Dr1 (01-04)
    // Sequential pairs: (Dr2,Dr1), (Dr1,Dr1), (Dr1,Dr1)
    // Matches: 0 + 1 + 1 = 2 out of 3 pairs = 0.667
    expect(result.patientSeconScores["P1"]).toBeCloseTo(0.667, 3);
  });

  // Test showing SECON now produces consistent results regardless of input order
  it("produces consistent SECON values regardless of input order", () => {
    const data = {
      patientId: ["P1", "P1", "P1", "P1"],
      providerId: ["Dr1", "Dr2", "Dr1", "Dr1"],
      visitDate: ["2023-01-04", "2023-01-01", "2023-01-03", "2023-01-02"],
    };
    
    // Test 1: Unsorted input
    const dfUnsorted = pl.DataFrame(data);
    const resultUnsorted = calculateSeconIndex(dfUnsorted, "providerId", ["patientId"], "visitDate");
    
    // Test 2: Pre-sorted input
    const dataSorted = {
      patientId: ["P1", "P1", "P1", "P1"],
      providerId: ["Dr2", "Dr1", "Dr1", "Dr1"],
      visitDate: ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04"],
    };
    const dfSorted = pl.DataFrame(dataSorted);
    const resultSorted = calculateSeconIndex(dfSorted, "providerId", ["patientId"], "visitDate");

    // Both should produce the same result since SECON now sorts by date internally
    expect(resultUnsorted.patientSeconScores["P1"]).toBeCloseTo(0.667, 3);
    expect(resultSorted.patientSeconScores["P1"]).toBeCloseTo(0.667, 3);
    expect(resultUnsorted.patientSeconScores["P1"]).toBeCloseTo(
      resultSorted.patientSeconScores["P1"], 
      3
    );
  });
});
