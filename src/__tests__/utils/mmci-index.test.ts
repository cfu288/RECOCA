import * as pl from "nodejs-polars";
import { calculateMmciIndex } from "../../core/continuity/indices/mmci-index";

describe("MMCI Index Calculation", () => {
  test("should calculate MMCI for a DataFrame with multiple patients and visits", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1", "P2", "P2", "P2", "P2", "P2"],
      provider: ["A", "A", "A", "B", "B", "C", "C", "D", "D", "E"],
    });

    // P1: 5 visits with 2 providers
    // MMCI = (1 - (2 / (5 + 0.1))) / (1 - (1 / (5 + 0.1)))
    // = (1 - (2 / 5.1)) / (1 - (1 / 5.1))
    // = (1 - 0.392) / (1 - 0.196)
    // = 0.608 / 0.804
    // = 0.756

    // P2: 5 visits with 3 providers
    // MMCI = (1 - (3 / (5 + 0.1))) / (1 - (1 / (5 + 0.1)))
    // = (1 - (3 / 5.1)) / (1 - (1 / 5.1))
    // = (1 - 0.588) / (1 - 0.196)
    // = 0.412 / 0.804
    // = 0.512

    // Average MMCI = (0.756 + 0.512) / 2 = 0.634

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.634, 3);
    expect(Object.keys(result.patientMmciScores).length).toBe(2);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.756, 3);
    expect(result.patientMmciScores["P2"]).toBeCloseTo(0.512, 3);
  });

  test("should handle the example from the requirements (5 visits with 2 providers in 3,2 distribution)", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1"],
      provider: ["A", "A", "A", "B", "B"],
    });

    // Example calculation:
    // 5 visits with 2 providers (distribution 3,2)
    // MMCI = (1 - (2 / (5 + 0.1))) / (1 - (1 / (5 + 0.1)))
    // = (1 - 0.392) / (1 - 0.196)
    // = 0.608 / 0.804
    // = 0.756 (≈ 0.76 as per the reference table)

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.756, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.756, 3);
  });

  test("should handle multiple patients with different visit patterns", () => {
    const df = pl.DataFrame({
      patientId: [
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1",
        "P1", // 8 visits for P1
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2",
        "P2", // 10 visits for P2
      ],
      provider: [
        // P1: 8 visits with 3 providers (AAAABBBC)
        "A",
        "A",
        "A",
        "A",
        "B",
        "B",
        "B",
        "C",
        // P2: 10 visits with 3 providers (AABBAACAAB)
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

    // P1: 8 visits with 3 providers
    // MMCI = (1 - (3 / (8 + 0.1))) / (1 - (1 / (8 + 0.1)))
    // = (1 - (3 / 8.1)) / (1 - (1 / 8.1))
    // = (1 - 0.370) / (1 - 0.123)
    // = 0.630 / 0.877
    // = 0.718

    // P2: 10 visits with 3 providers
    // MMCI = (1 - (3 / (10 + 0.1))) / (1 - (1 / (10 + 0.1)))
    // = (1 - (3 / 10.1)) / (1 - (1 / 10.1))
    // = (1 - 0.297) / (1 - 0.099)
    // = 0.703 / 0.901
    // = 0.780

    // Average MMCI = (0.718 + 0.780) / 2 = 0.749

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.749, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.718, 3);
    expect(result.patientMmciScores["P2"]).toBeCloseTo(0.78, 3);
  });

  test("should handle the case where a patient sees the same provider for all visits (perfect continuity)", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", "A", "A", "A", "B", "B", "B"],
    });

    // P1: 4 visits with 1 provider
    // MMCI = (1 - (1 / (4 + 0.1))) / (1 - (1 / (4 + 0.1)))
    // = (1 - 0.244) / (1 - 0.244)
    // = 0.756 / 0.756
    // = 1.0

    // P2: 3 visits with 1 provider
    // MMCI = (1 - (1 / (3 + 0.1))) / (1 - (1 / (3 + 0.1)))
    // = (1 - 0.323) / (1 - 0.323)
    // = 0.677 / 0.677
    // = 1.0

    // Average MMCI = (1.0 + 1.0) / 2 = 1.0
    // This matches the reference table where perfect continuity = 1.0

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBe(1);
    expect(result.patientMmciScores["P1"]).toBe(1);
    expect(result.patientMmciScores["P2"]).toBe(1);
  });

  test("should handle the case where a patient sees different providers equally", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1", "P1"],
      provider: ["A", "A", "B", "B", "C", "C"],
    });

    // P1: 6 visits with 3 providers (all seen equally)
    // MMCI = (1 - (3 / (6 + 0.1))) / (1 - (1 / (6 + 0.1)))
    // = (1 - (3 / 6.1)) / (1 - (1 / 6.1))
    // = (1 - 0.492) / (1 - 0.164)
    // = 0.508 / 0.836
    // = 0.608

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.608, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.608, 3);
  });

  /** A New Method for Measuring Continuity of Care in Family Practice Residencies
   * Michael K. Magill, MD, and Janet Sent, PhD
   * @ref https://cdn-uat.mdedge.com/files/s3fs-public/jfp-archived-issues/1987-volume_24-25/JFP_1987-02_v24_i2_a-new-method-for-measuring-continuity-of.pdf
   *
   * TABLE 1. DISTRIBUTION OF CONTINUITY OF CARE (COC), MODIFIED CONTINUITY INDEX (MCI)
   * AND MODIFIED, MODIFIED CONTINUITY INDEX (MMCI) SCORES
   *
   * | Number of Physicians	| Number of Visits	| Distribution of Visits to Providers	| COC	| MCI	| MMCI	|
   * |----------------------|-------------------|---------------------------------------|-------|-------|-------|
   * | 1					| 2					| 2									| 1.00	| .52	| 1.00	|
   * | 2					| 2					| 1, 1								| 0.00	| .05	| .10	|
   * | 1					| 3					| 3									| 1.00	| .68	| 1.00	|
   * | 2					| 3					| 2, 1								| .33	| .35	| .51	|
   * | 3					| 3					| 1, 1, 1							| 0.00	| .03	| .04	|
   * | 1					| 4					| 4									| 1.00	| .76	| 1.00	|
   * | 2					| 4					| 3, 1								| .50	| .51	| .67	|
   * | 2					| 4					| 2, 2								| .33	| .51	| .67	|
   * | 3					| 4					| 2, 1, 1							| .17	| .27	| .36	|
   * | 4					| 4					| 1, 1, 1, 1						| 0.00	| .02	| .03	|
   * | 1					| 5					| 5									| 1.00	| .80	| 1.00	|
   * | 2					| 5					| 4, 1								| .60	| .61	| .76	|
   * | 2					| 5					| 3, 2								| .40	| .61	| .76	|
   * | 3					| 5					| 3, 1, 1							| .30	| .41	| .51	|
   * | 3					| 5					| 2, 2, 1							| .20	| .41	| .51	|
   * | 4					| 5					| 2, 1, 1, 1						| .10	| .22	| .28	|
   * | 5					| 5					| 1, 1, 1, 1, 1					| 0.00	| .02	| .03	|
   */

  test("should handle reference table examples - 2 visits with 2 providers (distribution 1,1)", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1"],
      provider: ["A", "B"],
    });

    // Example from reference table: 2 visits, 2 providers (1,1 distribution)
    // MMCI = (1 - (2 / (2 + 0.1))) / (1 - (1 / (2 + 0.1)))
    // = (1 - 0.952) / (1 - 0.476)
    // = 0.048 / 0.524
    // = 0.091 (≈ 0.10 as per reference table)

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.091, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.091, 3);
  });

  test("should handle reference table examples - 4 visits with 4 providers (distribution 1,1,1,1)", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1"],
      provider: ["A", "B", "C", "D"],
    });

    // Example from reference table: 4 visits, 4 providers (1,1,1,1 distribution)
    // MMCI = (1 - (4 / (4 + 0.1))) / (1 - (1 / (4 + 0.1)))
    // = (1 - 0.976) / (1 - 0.244)
    // = 0.024 / 0.756
    // = 0.032 (≈ 0.03 as per reference table)

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.032, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.032, 3);
  });

  test("should handle reference table examples - 5 visits with 3 providers (distribution 2,2,1)", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P1"],
      provider: ["A", "A", "B", "B", "C"],
    });

    // Example from reference table: 5 visits, 3 providers (2,2,1 distribution)
    // MMCI = (1 - (3 / (5 + 0.1))) / (1 - (1 / (5 + 0.1)))
    // = (1 - 0.588) / (1 - 0.196)
    // = 0.412 / 0.804
    // = 0.512 (≈ 0.51 as per reference table)

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.512, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.512, 3);
  });

  test("should exclude patients with only one visit from MMCI calculation", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P2", "P3", "P3", "P4", "P4", "P4"],
      provider: ["A", "B", "C", "D", "E", "E", "F"],
    });

    // P1: 1 visit - should be excluded from calculation
    // P2: 1 visit - should be excluded from calculation
    // P3: 2 visits with 2 providers - included
    // P4: 3 visits with 2 providers - included

    // P3: 2 visits with 2 providers (1,1 distribution)
    // MMCI = (1 - (2 / (2 + 0.1))) / (1 - (1 / (2 + 0.1)))
    // = (1 - 0.952) / (1 - 0.476)
    // = 0.048 / 0.524
    // = 0.091 (≈ 0.10 as per reference table)

    // P4: 3 visits with 2 providers (2,1 distribution)
    // MMCI = (1 - (2 / (3 + 0.1))) / (1 - (1 / (3 + 0.1)))
    // = (1 - (2 / 3.1)) / (1 - (1 / 3.1))
    // = (1 - 0.645) / (1 - 0.323)
    // = 0.355 / 0.677
    // = 0.524 (≈ 0.51 as per reference table)

    // Average MMCI = (0.091 + 0.524) / 2 = 0.3075

    const result = calculateMmciIndex(df, "provider", ["patientId"]);

    // Only patients with 2+ visits should be included
    expect(Object.keys(result.patientMmciScores).length).toBe(2);
    expect(result.patientMmciScores["P1"]).toBeUndefined();
    expect(result.patientMmciScores["P2"]).toBeUndefined();
    expect(result.patientMmciScores["P3"]).toBeCloseTo(0.091, 3);
    expect(result.patientMmciScores["P4"]).toBeCloseTo(0.524, 3);
    expect(result.averageMmci).toBeCloseTo(0.3075, 3);
  });

  test("should return 0 for an empty DataFrame", () => {
    const emptyDf = pl.DataFrame({
      patientId: [],
      provider: [],
    });

    const result = calculateMmciIndex(emptyDf, "provider", ["patientId"]);
    expect(result.averageMmci).toBe(0);
    expect(Object.keys(result.patientMmciScores).length).toBe(0);
  });

  test("should handle missing or null provider values", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1", "P1", "P2", "P2", "P2"],
      provider: ["A", null, "A", "B", "C", "", "C"],
    });

    // P1: 3 visits with 2 providers (null is ignored)
    // MMCI = (1 - (2 / (3 + 0.1))) / (1 - (1 / (3 + 0.1)))
    // = (1 - (2 / 3.1)) / (1 - (1 / 3.1))
    // = (1 - 0.645) / (1 - 0.323)
    // = 0.355 / 0.677
    // = 0.524

    // P2: 2 visits with 1 provider (empty string is ignored)
    // MMCI = (1 - (1 / (2 + 0.1))) / (1 - (1 / (2 + 0.1)))
    // = (1 - (1 / 2.1)) / (1 - (1 / 2.1))
    // = (1 - 0.476) / (1 - 0.476)
    // = 0.524 / 0.524
    // = 1.0

    // Average MMCI = (0.524 + 1.0) / 2 = 0.762

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.762, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.524, 3);
    expect(result.patientMmciScores["P2"]).toBe(1);
  });

  test("should handle very large visit counts to ensure numerical stability", () => {
    // Create a DataFrame with a patient having 1000 visits to 10 different providers
    const patientId = Array(1000).fill("P1");
    const providers = Array(1000)
      .fill(0)
      .map((_, i) => {
        // First 100 visits to provider A, next 100 to B, etc.
        return String.fromCharCode(65 + Math.floor(i / 100)); // A-J
      });

    const df = pl.DataFrame({
      patientId,
      provider: providers,
    });

    // P1: 1000 visits with 10 providers (100 visits to each)
    // MMCI = (1 - (10 / (1000 + 0.1))) / (1 - (1 / (1000 + 0.1)))
    // ≈ (1 - 0.01) / (1 - 0.001)
    // ≈ 0.99 / 0.999
    // ≈ 0.991

    const result = calculateMmciIndex(df, "provider", ["patientId"]);
    expect(result.averageMmci).toBeCloseTo(0.991, 3);
    expect(result.patientMmciScores["P1"]).toBeCloseTo(0.991, 3);
  });

  test("should handle nonexistent provider column", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
    });

    // When provider column doesn't exist, should return undefined averageMmci and empty scores
    const result = calculateMmciIndex(df, "nonExistentColumn", ["patientId"]);
    expect(result.averageMmci).toBeUndefined();
    expect(Object.keys(result.patientMmciScores).length).toBe(0);
  });

  test("should handle nonexistent patient identifier columns", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      provider: ["A", "A", "B"],
    });

    // When patient ID column doesn't exist, should return undefined averageMmci and empty scores
    const result = calculateMmciIndex(df, "provider", ["nonExistentColumn"]);
    expect(result.averageMmci).toBeUndefined();
    expect(Object.keys(result.patientMmciScores).length).toBe(0);
  });

  test("should handle when some of multiple patient identifier columns don't exist", () => {
    const df = pl.DataFrame({
      patientId: ["P1", "P1", "P1"],
      lastName: ["Smith", "Smith", "Smith"],
      provider: ["A", "A", "B"],
    });

    // When one of multiple patient ID columns doesn't exist, should return undefined averageMmci
    const result = calculateMmciIndex(df, "provider", [
      "patientId",
      "lastName",
      "nonExistentColumn",
    ]);
    expect(result.averageMmci).toBeUndefined();
    expect(Object.keys(result.patientMmciScores).length).toBe(0);
  });
});
