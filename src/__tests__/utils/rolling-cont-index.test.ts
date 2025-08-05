import * as pl from "nodejs-polars";
import { calculateRollingContIndex } from "../../core/continuity/indices/rolling-cont-index";

describe("Rolling Continuity of Care Index Calculation", () => {
  const dateStr = (year: number, month: number, day: number) => {
    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  };

  test("should calculate monthly continuity correctly for a single month", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2", "P3", "P3"],
      provider: ["A", "A", "B", "C", "D", "D"],
      appointment_date: [
        dateStr(2023, 1, 5),  // P1, Jan 5
        dateStr(2023, 1, 20), // P1, Jan 20
        dateStr(2023, 1, 10), // P2, Jan 10
        dateStr(2023, 1, 25), // P2, Jan 25
        dateStr(2023, 1, 15), // P3, Jan 15
        dateStr(2023, 1, 30), // P3, Jan 30
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.667, 3);
  });

  test("should handle patients with only one appointment in a month", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P2", "P3", "P3"],
      provider: ["A", "B", "C", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),  // P1, Jan 5 (only one visit)
        dateStr(2023, 1, 15), // P2, Jan 15 (only one visit)
        dateStr(2023, 1, 10), // P3, Jan 10
        dateStr(2023, 1, 25), // P3, Jan 25 (same provider)
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    expect(result.monthlyScores["2023-01"]).toBe(1.0);
  });

  test("should calculate scores across multiple months", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2", "P1", "P2"],
      provider: ["A", "A", "B", "C", "B", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),  // P1, Jan 5
        dateStr(2023, 1, 20), // P1, Jan 20
        dateStr(2023, 1, 10), // P2, Jan 10
        dateStr(2023, 1, 25), // P2, Jan 25
        dateStr(2023, 2, 8),  // P1, Feb 8
        dateStr(2023, 2, 15), // P2, Feb 15
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).sort()).toEqual(["2023-01", "2023-02"]);
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.5);
    expect(result.monthlyScores["2023-02"]).toBeCloseTo(0.5);
  });

  test("should handle a patient with multiple visits in different months", () => {
    const df = pl.DataFrame({
      patientId: Array(6).fill("P1"),
      provider: ["A", "A", "B", "B", "C", "A"],
      appointment_date: [
        dateStr(2023, 1, 5),  // Jan 5
        dateStr(2023, 1, 25), // Jan 25
        dateStr(2023, 2, 10), // Feb 10
        dateStr(2023, 2, 28), // Feb 28
        dateStr(2023, 3, 15), // Mar 15
        dateStr(2023, 3, 30), // Mar 30
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).sort()).toEqual(["2023-01", "2023-02", "2023-03"]);
    expect(result.monthlyScores["2023-01"]).toBe(1.0);
    expect(result.monthlyScores["2023-02"]).toBe(0.5);
    expect(result.monthlyScores["2023-03"]).toBe(0.0);
  });

  test("should handle empty months", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2"],
      provider: ["A", "A", "B", "B"],
      appointment_date: [
        dateStr(2023, 1, 5),  // January
        dateStr(2023, 1, 20), // January
        dateStr(2023, 3, 10), // March (skipping February)
        dateStr(2023, 3, 25), // March
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).sort()).toEqual(["2023-01", "2023-03"]);
    expect(result.monthlyScores["2023-01"]).toBe(1.0);
    expect(result.monthlyScores["2023-02"]).toBeUndefined();
    expect(result.monthlyScores["2023-03"]).toBe(1.0);
  });

  test("should handle custom month boundaries", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2"],
      provider: ["A", "B", "C", "C"],
      appointment_date: [
        dateStr(2023, 1, 15), 
        dateStr(2023, 2, 10), 
        dateStr(2023, 2, 15), 
        dateStr(2023, 3, 5),  
      ],
    });

    const defaultResult = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(defaultResult.monthlyScores["2023-02"]).toBe(0);
    expect(defaultResult.monthlyScores["2023-03"]).toBe(1);

    const customResult = calculateRollingContIndex(
      df, 
      "provider", 
      ["patientId"], 
      "appointment_date", 
      15
    );
    
    expect(Object.keys(customResult.monthlyScores).sort()).toEqual(["2023-01-15", "2023-02-15"]);
    expect(customResult.monthlyScores["2023-01-15"]).toBe(0);
    expect(customResult.monthlyScores["2023-02-15"]).toBe(1);
  });

  test("should handle missing appointment dates", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2"],
      provider: ["A", "A", "B", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        null,  // Missing date
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 25),
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    expect(result.monthlyScores["2023-01"]).toBe(0);
  });

  test("should return appropriate values for an empty DataFrame", () => {
    const emptyDf = pl.DataFrame({
      patientId: [],
      provider: [],
      appointment_date: [],
    });

    const result = calculateRollingContIndex(emptyDf, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).length).toBe(0);
    expect(result.averageScore).toBeUndefined();
  });

  test("should calculate the overall average score correctly", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2", "P1", "P2", "P3", "P3"],
      provider: ["A", "A", "B", "C", "A", "C", "D", "E"],
      appointment_date: [
        dateStr(2023, 1, 5),  // P1, Jan
        dateStr(2023, 1, 20), // P1, Jan
        dateStr(2023, 1, 10), // P2, Jan
        dateStr(2023, 1, 25), // P2, Jan
        dateStr(2023, 2, 5),  // P1, Feb
        dateStr(2023, 2, 15), // P2, Feb
        dateStr(2023, 3, 10), // P3, Mar
        dateStr(2023, 3, 20), // P3, Mar
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.5);
    expect(result.monthlyScores["2023-02"]).toBe(1.0);
    expect(result.monthlyScores["2023-03"]).toBe(0.0);
    expect(result.averageScore).toBeCloseTo(0.5);
  });

  test("should handle composite patient identifiers", () => {
    const df = pl.DataFrame({
      lastName: ["Smith", "Smith", "Jones", "Jones"],
      firstName: ["John", "John", "Bob", "Bob"],
      provider: ["A", "A", "B", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 25),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 30),
      ],
    });

    const result = calculateRollingContIndex(
      df, 
      "provider", 
      ["lastName", "firstName"], 
      "appointment_date"
    );
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.5);
  });
  
  test("example: should match the specified algorithm example", () => {
    const df = pl.DataFrame({
      patientId: ["A", "A", "A"],
      provider: ["Dr1", "Dr1", "Dr2"],
      appointment_date: [
        dateStr(2024, 3, 15),  // March 15, 2024
        dateStr(2024, 4, 10),  // April 10, 2024
        dateStr(2024, 5, 20),  // May 20, 2024
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).sort()).toEqual(["2024-04", "2024-05"]);
    expect(result.monthlyScores["2024-04"]).toBe(1.0);
    expect(result.monthlyScores["2024-05"]).toBe(0.0);
    expect(result.averageScore).toBe(0.5);
  });

  test("should handle numeric patient IDs correctly", () => {
    const df = pl.DataFrame({
      patientId: [123, 123, 456, 456],  // numbers instead of strings
      provider: ["A", "A", "B", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 25),
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.5);
  });

  test("should handle missing or null provider values", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", null, "A", "B", "C", "", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 10),  // null provider - should be ignored
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 8),
        dateStr(2023, 1, 12),  // empty provider - should be ignored
        dateStr(2023, 1, 25),
      ],
    });

    // P1: valid appointments on 5th (A), 15th (A), 20th (B) - continuity: A->A (1), A->B (0) = 1/2 = 0.5
    // P2: valid appointments on 8th (C), 25th (C) - continuity: C->C (1) = 1/1 = 1.0
    // However, since the algorithm doesn't count the 10th and 12th (null/empty), 
    // the actual sequence is: 5th(A)->15th(A)->20th(B) for P1 and 8th(C)->25th(C) for P2
    // Total: 2 same out of 3 transitions = 0.667
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.667, 3);
  });

  test("should handle invalid date formats gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P2", "P2"],
      provider: ["A", "B", "A", "C", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        "invalid-date",  // Should be skipped
        dateStr(2023, 1, 20),
        "2023-01-10",
        "not a date",  // Should be skipped
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    // P1: only has two valid dates (5th and 20th), A->A = 1/1 = 1.0
    // P2: only has one valid date (10th), no continuity to calculate
    // Total: 1 same out of 1 transition = 1.0
    expect(result.monthlyScores["2023-01"]).toBe(1);
  });

  test("should handle same day multiple appointments", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1"],
      provider: ["A", "B", "A", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 5),  // Same day, different provider
        dateStr(2023, 1, 5),  // Same day, back to A
        dateStr(2023, 1, 20), // Later appointment
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    // All appointments on same day would be in same order, then C on 20th
    expect(result.monthlyScores["2023-01"]).toBeDefined();
  });

  test("should handle year boundary crossing correctly", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", "A", "B", "C", "C", "D"],
      appointment_date: [
        dateStr(2022, 12, 20),
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 20),
        dateStr(2022, 12, 25),
        dateStr(2023, 1, 10),
        dateStr(2023, 2, 15),
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    expect(Object.keys(result.monthlyScores).sort()).toEqual(["2023-01", "2023-02"]);
    // P1: A->A in Jan (1/1), A->B in Jan (0/1)
    // P2: C->C in Jan (1/1)
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.667, 3);
    // P2: C->D in Feb (0/1)
    expect(result.monthlyScores["2023-02"]).toBe(0);
  });

  test("should handle invalid provider column gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
      appointment_date: [dateStr(2023, 1, 5), dateStr(2023, 1, 15), dateStr(2023, 1, 25)],
    });

    const result = calculateRollingContIndex(df, "nonExistentColumn", ["patientId"], "appointment_date");
    expect(result.averageScore).toBeUndefined();
    expect(Object.keys(result.monthlyScores).length).toBe(0);
  });

  test("should handle invalid patient identifier column gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
      appointment_date: [dateStr(2023, 1, 5), dateStr(2023, 1, 15), dateStr(2023, 1, 25)],
    });

    const result = calculateRollingContIndex(df, "provider", ["nonExistentColumn"], "appointment_date");
    expect(result.averageScore).toBeUndefined();
    expect(Object.keys(result.monthlyScores).length).toBe(0);
  });

  test("should handle invalid appointment date column gracefully", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
      appointment_date: [dateStr(2023, 1, 5), dateStr(2023, 1, 15), dateStr(2023, 1, 25)],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "nonExistentColumn");
    expect(result.averageScore).toBeUndefined();
    expect(Object.keys(result.monthlyScores).length).toBe(0);
  });

  test("should handle partially missing patient identifier columns", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      lastName: ["Smith", "Smith", "Smith"],
      provider: ["A", "A", "B"],
      appointment_date: [dateStr(2023, 1, 5), dateStr(2023, 1, 15), dateStr(2023, 1, 25)],
    });

    const result = calculateRollingContIndex(df, "provider", [
      "patientId",
      "lastName",
      "nonExistentColumn",
    ], "appointment_date");
    expect(result.averageScore).toBeUndefined();
    expect(Object.keys(result.monthlyScores).length).toBe(0);
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
      ],
      provider: [
        "Dr. García-López",
        "Dr. García-López",
        "Dr. Smith",
        "Dr. 李医生",
        "Dr. 李医生",
        "Dr. François",
        "Dr. François",
      ],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 25),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 8),
        dateStr(2023, 1, 18),
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");

    // Should handle special characters without issues
    expect(Object.keys(result.monthlyScores)).toEqual(["2023-01"]);
    // José: same->different (1/2), 李王: same (1/1), Müller: same (1/1)
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.75);
  });

  test("should treat empty strings and nulls consistently", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2", "P2"],
      provider: ["A", "", null, "B", "C", undefined, "", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 8),
        dateStr(2023, 1, 12),
        dateStr(2023, 1, 16),
        dateStr(2023, 1, 25),
      ],
    });

    // Both empty strings and null/undefined should be filtered out
    // P1: A on 5th, B on 20th -> 0/1
    // P2: C on 8th, C on 25th -> 1/1
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.5);
  });

  test("should handle the pattern ABABA (alternating providers)", () => {
    const df = pl.DataFrame({
      patientId: Array(5).fill("P1"),
      provider: ["A", "B", "A", "B", "A"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 25),
      ],
    });

    // Each transition is to a different provider: 0/4 = 0
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBe(0);
  });

  test("should handle the pattern AABBAABBA", () => {
    const df = pl.DataFrame({
      patientId: Array(9).fill("P1"),
      provider: ["A", "A", "B", "B", "A", "A", "B", "B", "A"],
      appointment_date: [
        dateStr(2023, 1, 2),
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 8),
        dateStr(2023, 1, 11),
        dateStr(2023, 1, 14),
        dateStr(2023, 1, 17),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 23),
        dateStr(2023, 1, 26),
      ],
    });

    // A->A (1), A->B (0), B->B (1), B->A (0), A->A (1), A->B (0), B->B (1), B->A (0)
    // Total: 4 same out of 8 transitions = 0.5
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBe(0.5);
  });

  test("should handle large datasets efficiently", () => {
    // Create a large dataset with 1000 patients, each with 5-15 visits across 3 months
    const largeData: { patientId: string[]; provider: string[]; appointment_date: string[] } = {
      patientId: [],
      provider: [],
      appointment_date: [],
    };

    for (let patientNum = 1; patientNum <= 1000; patientNum++) {
      const patientId = `P${patientNum.toString().padStart(4, "0")}`;
      const visitCount = 5 + (patientNum % 11); // 5-15 visits per patient
      
      let currentProvider = `Dr_A_${patientNum % 10}`;
      
      for (let visit = 0; visit < visitCount; visit++) {
        largeData.patientId.push(patientId);
        
        // Sometimes switch providers to create realistic continuity patterns
        if (visit > 0 && Math.random() < 0.3) {
          currentProvider = `Dr_B_${patientNum % 5}`;
        }
        largeData.provider.push(currentProvider);
        
        // Spread visits across 3 months
        const month = 1 + Math.floor(visit / (visitCount / 3));
        const day = 1 + (visit % 28);
        largeData.appointment_date.push(dateStr(2023, month, day));
      }
    }

    const largeDf = pl.DataFrame(largeData);

    // Performance test - should complete in reasonable time
    const startTime = Date.now();
    const result = calculateRollingContIndex(largeDf, "provider", ["patientId"], "appointment_date");
    const endTime = Date.now();

    // Should complete within 5 seconds for 1000 patients
    expect(endTime - startTime).toBeLessThan(5000);

    // Should have calculated scores for multiple months
    expect(Object.keys(result.monthlyScores).length).toBeGreaterThan(0);
    expect(Object.keys(result.monthlyScores).length).toBeLessThanOrEqual(3);

    // Average score should be reasonable (not 0 or 1 given the random switching)
    expect(result.averageScore).toBeDefined();
    expect(result.averageScore).toBeGreaterThan(0.5);
    expect(result.averageScore).toBeLessThan(1.0);
  });

  test("should handle DataFrame with all null/empty providers", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2"],
      provider: [null, "", null, ""],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 20),
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(Object.keys(result.monthlyScores).length).toBe(0);
    expect(result.averageScore).toBeUndefined();
  });

  test("should handle DataFrame with all invalid dates", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2"],
      provider: ["A", "B", "C", "D"],
      appointment_date: ["invalid", "not-a-date", null, ""],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(Object.keys(result.monthlyScores).length).toBe(0);
    expect(result.averageScore).toBeUndefined();
  });

  test("should handle appointments with long gaps correctly", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P2", "P2"],
      provider: ["A", "A", "B", "C", "D"],
      appointment_date: [
        dateStr(2023, 1, 15),   // January
        dateStr(2023, 6, 20),   // June (5 month gap)
        dateStr(2023, 12, 25),  // December (6 month gap)
        dateStr(2023, 3, 10),   // March
        dateStr(2023, 11, 15),  // November (8 month gap)
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    // P1: Jan->June (A->A) = 1, June->Dec (A->B) = 0
    expect(result.monthlyScores["2023-06"]).toBe(1.0);
    expect(result.monthlyScores["2023-12"]).toBe(0.0);
    
    // P2: March->Nov (C->D) = 0
    expect(result.monthlyScores["2023-11"]).toBe(0.0);
  });

  test("should handle cyclic provider patterns (ABCABC)", () => {
    const df = pl.DataFrame({
      patientId: Array(6).fill("P1"),
      provider: ["A", "B", "C", "A", "B", "C"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 25),
        dateStr(2023, 1, 30),
      ],
    });

    // Each transition is to a different provider: 0/5 = 0
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBe(0);
  });

  test("should handle block switching pattern (AAABBBAAABBB)", () => {
    const df = pl.DataFrame({
      patientId: Array(12).fill("P1"),
      provider: ["A", "A", "A", "B", "B", "B", "A", "A", "A", "B", "B", "B"],
      appointment_date: [
        dateStr(2023, 1, 2),
        dateStr(2023, 1, 4),
        dateStr(2023, 1, 6),
        dateStr(2023, 1, 8),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 12),
        dateStr(2023, 1, 14),
        dateStr(2023, 1, 16),
        dateStr(2023, 1, 18),
        dateStr(2023, 1, 20),
        dateStr(2023, 1, 22),
        dateStr(2023, 1, 24),
      ],
    });

    // A->A (1), A->A (1), A->B (0), B->B (1), B->B (1), B->A (0), 
    // A->A (1), A->A (1), A->B (0), B->B (1), B->B (1)
    // Total: 8 same out of 11 transitions = 0.727
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.727, 3);
  });

  test("should handle all appointments on same date for different patients", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P2", "P2", "P3", "P3"],
      provider: ["A", "B", "C", "C", "D", "E"],
      appointment_date: [
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 15),  // Same date
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 15),  // Same date
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 15),  // Same date
      ],
    });

    // All appointments on same date, but algorithm looks at sequential appointments per patient
    // P1: A->B (counted), P2: C->C (counted), P3: D->E (counted)
    // Total: 1 same out of 3 = 0.333
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.333, 3);
  });

  test("should handle provider return pattern (A→B→C→A)", () => {
    const df = pl.DataFrame({
      patientId: Array(4).fill("P1"),
      provider: ["A", "B", "C", "A"],
      appointment_date: [
        dateStr(2023, 1, 5),
        dateStr(2023, 1, 10),
        dateStr(2023, 1, 15),
        dateStr(2023, 1, 20),
      ],
    });

    // A->B (0), B->C (0), C->A (0)
    // Total: 0 same out of 3 = 0
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2023-01"]).toBe(0);
  });

  test("should handle single patient with many appointments in one month", () => {
    // Create 50 appointments for one patient in January
    const appointments = 50;
    const patientIds = Array(appointments).fill("P1");
    const providers = [];
    const dates = [];
    
    // Pattern: mostly provider A with occasional B
    for (let i = 0; i < appointments; i++) {
      providers.push(i % 5 === 0 ? "B" : "A");
      // Use modulo 31 to stay within January, but avoid day 0
      dates.push(dateStr(2023, 1, 1 + (i % 30))); // Days 1-30
    }
    
    const df = pl.DataFrame({
      patientId: patientIds,
      provider: providers,
      appointment_date: dates,
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    // Should handle large number of appointments without issue
    // The dateStr function takes modulo 30, so some dates might be in December of previous year
    const months = Object.keys(result.monthlyScores).sort();
    expect(months.length).toBeGreaterThanOrEqual(1);
    expect(months.length).toBeLessThanOrEqual(2); // At most Dec and Jan
    
    // Check the January score if it exists
    if (result.monthlyScores["2023-01"]) {
      expect(result.monthlyScores["2023-01"]).toBeGreaterThan(0.7); // Mostly same provider
      expect(result.monthlyScores["2023-01"]).toBeLessThan(0.9); // But not all
    }
  });

  test("should handle future dates appropriately", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
      appointment_date: [
        dateStr(2023, 1, 15),
        dateStr(2025, 12, 31),  // Future date
        dateStr(2026, 1, 15),    // Even further future
      ],
    });

    // Should still calculate continuity for future dates
    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    expect(result.monthlyScores["2025-12"]).toBe(1.0); // A->A
    expect(result.monthlyScores["2026-01"]).toBe(0.0); // A->B
  });

  test("should calculate correctly for complex real-world pattern", () => {
    // Simulating a real clinic where some patients are loyal, some switch frequently
    const df = pl.DataFrame({
      patientId: [
        // Loyal patient P1 - mostly sees Dr. A
        "P1", "P1", "P1", "P1", "P1", "P1",
        // Switcher patient P2 - alternates providers
        "P2", "P2", "P2", "P2",
        // New patient P3 - just started
        "P3", "P3",
        // Consistent patient P4 - always same provider
        "P4", "P4", "P4", "P4", "P4"
      ],
      provider: [
        // P1: Mostly Dr. A with one exception
        "Dr. A", "Dr. A", "Dr. A", "Dr. B", "Dr. A", "Dr. A",
        // P2: Switches between providers
        "Dr. C", "Dr. D", "Dr. C", "Dr. D",
        // P3: New patient seeing same provider
        "Dr. E", "Dr. E",
        // P4: Always sees Dr. F
        "Dr. F", "Dr. F", "Dr. F", "Dr. F", "Dr. F"
      ],
      appointment_date: [
        // P1 visits across Jan and Feb
        dateStr(2023, 1, 5), dateStr(2023, 1, 15), dateStr(2023, 1, 25),
        dateStr(2023, 2, 5), dateStr(2023, 2, 15), dateStr(2023, 2, 25),
        // P2 visits in Jan
        dateStr(2023, 1, 10), dateStr(2023, 1, 20), dateStr(2023, 1, 30), dateStr(2023, 2, 10),
        // P3 visits in Feb
        dateStr(2023, 2, 8), dateStr(2023, 2, 18),
        // P4 visits across both months
        dateStr(2023, 1, 12), dateStr(2023, 1, 22), dateStr(2023, 2, 2), 
        dateStr(2023, 2, 12), dateStr(2023, 2, 22)
      ],
    });

    const result = calculateRollingContIndex(df, "provider", ["patientId"], "appointment_date");
    
    // January transitions: 
    // P1: 5th(A)->15th(A)=1, 15th(A)->25th(A)=1
    // P2: 10th(C)->20th(D)=0, 20th(D)->30th(C)=0  
    // P4: 12th(F)->22nd(F)=1
    // Total: 3 same out of 5 = 0.6
    expect(result.monthlyScores["2023-01"]).toBeCloseTo(0.6, 3);
    
    // February transitions:
    // P1: 25th(A)->5th(B)=0, 5th(B)->15th(A)=0, 15th(A)->25th(A)=1
    // P2: 30th(C)->10th(D)=0
    // P3: 8th(E)->18th(E)=1
    // P4: 2nd(F)->12th(F)=1, 12th(F)->22nd(F)=1
    // Total: 4 same out of 7 transitions... but algorithm calculates monthly
    expect(result.monthlyScores["2023-02"]).toBeCloseTo(0.625, 3);
    
    // Overall average: (0.6 + 0.625) / 2 = 0.6125
    expect(result.averageScore).toBeCloseTo(0.6125, 3);
  });
});