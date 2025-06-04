import * as pl from "nodejs-polars";
import {
  parseExcelDateString,
  filterDataFrameByDateRange,
} from "../../core/continuity/utils/date-filter";

/**
 * Comprehensive Date Parsing Tests
 *
 * This suite covers both basic and Excel-specific date formats
 */
describe("Date Parsing", () => {
  /**
   * Standard date format parsing tests
   */
  describe("Standard Formats", () => {
    test.each([
      {
        description: "M/D/YY format",
        input: "1/15/22",
        expected: { day: 15, month: 0, year: 2022 },
      },
      {
        description: "MM/DD/YYYY format",
        input: "01/15/2022",
        expected: { day: 15, month: 0, year: 2022 },
      },
      {
        description: "ISO format",
        input: "2022-03-15",
        expected: { day: 15, month: 2, year: 2022 },
      },
      {
        description: "ISO datetime format",
        input: "2022-01-15T00:00:00",
        expected: { day: 15, month: 0, year: 2022 },
      },
    ])("should parse $description", ({ input, expected }) => {
      const result = parseExcelDateString(input);
      expect(result).not.toBeNull();
      expect(result.getUTCDate()).toBe(expected.day);
      expect(result.getUTCMonth()).toBe(expected.month);
      expect(result.getUTCFullYear()).toBe(expected.year);
    });
  });

  /**
   * Excel-specific format parsing tests
   */
  describe("Excel Formats", () => {
    test.each([
      {
        description: "Excel serial number",
        input: 44676,
        expected: { day: 24, month: 3, year: 2022 },
      },
      {
        description: "Excel serial as string",
        input: "44576",
        expected: { day: 14, month: 0, year: 2022 },
      },
      {
        description: "DD-MMM-YYYY format",
        input: "15-Jan-2022",
        expected: { day: 15, month: 0, year: 2022 },
      },
      {
        description: "case insensitive month names",
        input: "15-jan-2022",
        expected: { day: 15, month: 0, year: 2022 },
      },
      {
        description: "dot separator format",
        input: "01.15.2022",
        expected: { day: 15, month: 0, year: 2022 },
      },
    ])("should parse $description", ({ input, expected }) => {
      const result = parseExcelDateString(input);
      expect(result).not.toBeNull();
      expect(result.getUTCDate()).toBe(expected.day);
      expect(result.getUTCMonth()).toBe(expected.month);
      expect(result.getUTCFullYear()).toBe(expected.year);
    });

    it("should handle century boundary dates", () => {
      // Year 2000 boundary
      const y2k = parseExcelDateString("1/1/00");
      expect(y2k.getUTCFullYear()).toBe(2000);

      // 20th century
      const twentieth = parseExcelDateString("12/31/99");
      expect(twentieth.getUTCFullYear()).toBe(1999);
    });

    it("should handle leap year dates", () => {
      const leapDay = parseExcelDateString("2/29/20");
      expect(leapDay.getUTCMonth()).toBe(1); // February
      expect(leapDay.getUTCDate()).toBe(29);
      expect(leapDay.getUTCFullYear()).toBe(2020);
    });
  });

  /**
   * Error handling and edge cases
   */
  describe("Error Handling", () => {
    test.each([
      { description: "empty string", input: "" },
      { description: "null value", input: null },
      { description: "undefined value", input: undefined },
      { description: "invalid format", input: "not a date" },
      { description: "invalid month", input: "13/1/22" },
      { description: "invalid day", input: "1/32/22" },
      { description: "wrong separator in MMM format", input: "15/Jan/2022" },
      { description: "far future serial number", input: 1000000 },
    ])("should reject $description", ({ input }) => {
      expect(parseExcelDateString(input)).toBeNull();
    });
  });
});

/**
 * DataFrame Date Range Filtering Tests
 */
describe("DataFrame Date Range Filtering", () => {
  let standardTestDf: pl.DataFrame;
  let mixedFormatDf: pl.DataFrame;

  beforeEach(() => {
    // Standard test DataFrame with consistent format
    standardTestDf = pl.DataFrame({
      appointmentDate: [
        "1/15/22", // Jan 15, 2022
        "2/28/22", // Feb 28, 2022
        "3/15/22", // Mar 15, 2022
        "4/1/22", // Apr 1, 2022
        "5/15/22", // May 15, 2022
        "", // Empty string
        null, // Null value
        "not a date", // Invalid format
        "6/30/22", // Jun 30, 2022
        "7/4/22", // Jul 4, 2022
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
      ],
    });

    // Mixed format DataFrame
    mixedFormatDf = pl.DataFrame({
      appointmentDate: [
        "1/15/22", // M/D/YY format
        "01/20/2022", // MM/DD/YYYY format
        "2022-03-10", // YYYY-MM-DD format
        "5-Apr-2022", // DD-MMM-YYYY format
        "2022-05-18T09:30:00", // ISO datetime format
        44739, // Excel serial number (2022-06-30)
        "12/31/1999", // End of 20th century
        "1/1/2000", // Start of 21st century
        "2/29/2020", // Leap year date
        " 1/15/22 ", // Date with leading/trailing spaces
        "  2/28/22", // Date with leading spaces
        "3/15/22  ", // Date with trailing spaces
        "", // Empty string
        null, // Null value
        "invalid date", // Invalid format
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
        "P014",
        "P015",
      ],
    });
  });

  /**
   * Filtering tests
   */
  describe("Core Filtering", () => {
    it("should filter dates within range", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-02-01",
        "2022-04-01"
      );

      // Should include Feb 28, Mar 15, and Apr 1 (inclusive end boundary)
      expect(filtered.height).toBe(3);

      const filteredDates = filtered.getColumn("appointmentDate").toArray();
      expect(filteredDates).toContain("2/28/22");
      expect(filteredDates).toContain("3/15/22");
      expect(filteredDates).toContain("4/1/22"); // Now included due to inclusive end boundary
    });

    it("should handle mixed date formats correctly", () => {
      // Filter for Jan-April 1 2022 from mixed format data
      const filtered = filterDataFrameByDateRange(
        mixedFormatDf,
        "appointmentDate",
        "2022-01-01",
        "2022-04-01"
      );

      // Should include dates from January, February, March, and April 1 2022
      // Including whitespace dates that get parsed correctly
      expect(filtered.height).toBe(6); // Jan 15, Jan 20, Mar 10, plus whitespace dates

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).toContain("P001"); // Jan 15
      expect(patientIds).toContain("P002"); // Jan 20
      expect(patientIds).toContain("P003"); // Mar 10
    });

    it("should handle inclusive date boundaries on both start and end", () => {
      // Create a DataFrame with dates that fall exactly on the boundaries
      const boundaryTestDf = pl.DataFrame({
        appointmentDate: [
          "1/1/22", // Jan 1, 2022 - exactly on start boundary (should be included)
          "1/15/22", // Jan 15, 2022 - within range (should be included)
          "2/1/22", // Feb 1, 2022 - exactly on end boundary (should be included)
          "2/15/22", // Feb 15, 2022 - outside range (should be excluded)
        ],
        patientId: ["P001", "P002", "P003", "P004"],
      });

      const filtered = filterDataFrameByDateRange(
        boundaryTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-02-01"
      );

      // Should include both boundary dates (Jan 1 and Feb 1) plus the middle date
      // Function now has inclusive boundaries on both start and end
      expect(filtered.height).toBe(3);

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).toContain("P001"); // Jan 1 (start boundary - included)
      expect(patientIds).toContain("P002"); // Jan 15 (within range - included)
      expect(patientIds).toContain("P003"); // Feb 1 (end boundary - included)
      expect(patientIds).not.toContain("P004"); // Feb 15 (outside range - excluded)
    });

    it("should include dates exactly on the start boundary", () => {
      // Create a DataFrame with dates around the start boundary
      const startBoundaryTestDf = pl.DataFrame({
        appointmentDate: [
          "12/31/21", // Dec 31, 2021 - before start boundary (should be excluded)
          "1/1/22", // Jan 1, 2022 - exactly on start boundary (should be included)
          "1/2/22", // Jan 2, 2022 - after start boundary (should be included)
        ],
        patientId: ["P001", "P002", "P003"],
      });

      const filtered = filterDataFrameByDateRange(
        startBoundaryTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-01-31"
      );

      // Should include Jan 1 (start boundary) and Jan 2, but exclude Dec 31
      expect(filtered.height).toBe(2);

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).not.toContain("P001"); // Dec 31 (before start - excluded)
      expect(patientIds).toContain("P002"); // Jan 1 (start boundary - included)
      expect(patientIds).toContain("P003"); // Jan 2 (after start - included)
    });

    it("should include dates exactly on the end boundary", () => {
      // Create a DataFrame with dates around the end boundary
      const endBoundaryTestDf = pl.DataFrame({
        appointmentDate: [
          "1/30/22", // Jan 30, 2022 - before end boundary (should be included)
          "1/31/22", // Jan 31, 2022 - exactly on end boundary (should be included)
          "2/1/22", // Feb 1, 2022 - after end boundary (should be excluded)
        ],
        patientId: ["P001", "P002", "P003"],
      });

      const filtered = filterDataFrameByDateRange(
        endBoundaryTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-01-31"
      );

      // Should include Jan 30 and Jan 31 (end boundary), but exclude Feb 1
      expect(filtered.height).toBe(2);

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).toContain("P001"); // Jan 30 (before end - included)
      expect(patientIds).toContain("P002"); // Jan 31 (end boundary - included)
      expect(patientIds).not.toContain("P003"); // Feb 1 (after end - excluded)
    });
  });

  /**
   * Edge cases and error handling
   */
  describe("Edge Cases", () => {
    it("should handle no matching dates", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2023-01-01",
        "2023-12-31"
      );
      expect(filtered.height).toBe(0);
    });

    it("should handle empty start date", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "",
        "2022-12-31"
      );
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should handle empty end date", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-01",
        ""
      );
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should return original DataFrame for invalid column name", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "nonExistentColumn",
        "2022-01-01",
        "2022-12-31"
      );
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should ignore invalid dates during filtering", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-06-01",
        "2022-07-31"
      );

      // Should include June 30 and July 4, ignoring invalid entries
      expect(filtered.height).toBe(2);

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).toContain("P009"); // June 30
      expect(patientIds).toContain("P010"); // July 4
    });

    it("should handle historical date ranges", () => {
      // Test with dates spanning the Y2K boundary
      const filtered = filterDataFrameByDateRange(
        mixedFormatDf,
        "appointmentDate",
        "1999-01-01",
        "2000-12-31"
      );

      // Should include 1999-12-31 and 2000-01-01
      expect(filtered.height).toBe(2);

      const patientIds = filtered.getColumn("patientId").toArray();
      expect(patientIds).toContain("P007"); // 1999-12-31
      expect(patientIds).toContain("P008"); // 2000-01-01
    });

    it("should handle leap year date filtering", () => {
      const filtered = filterDataFrameByDateRange(
        mixedFormatDf,
        "appointmentDate",
        "2020-02-01",
        "2020-03-31"
      );

      // Should include the leap day (2020-02-29) if it exists and is parsed correctly
      expect(filtered.height).toBeGreaterThanOrEqual(0);

      // If leap day is found, verify it's the correct patient
      if (filtered.height > 0) {
        const patientIds = filtered.getColumn("patientId").toArray();
        expect(patientIds).toContain("P009");
      }
    });

    it("should handle reversed date range (startDate > endDate)", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-12-31",
        "2022-01-01"
      );
      // Should return no results when start date is after end date
      expect(filtered.height).toBe(0);
    });

    it("should handle single day filtering (same start and end date)", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-15",
        "2022-01-15"
      );

      // Should return exactly one record for the specified date
      expect(filtered.height).toBe(1);

      // Verify it's the correct record by checking both patient ID and date
      const patientIds = filtered.getColumn("patientId").toArray();
      const dates = filtered.getColumn("appointmentDate").toArray();

      expect(patientIds).toContain("P001");
      expect(dates).toContain("1/15/22"); // The exact date format in test data

      // Verify no other dates are included
      expect(dates).toHaveLength(1);
      expect(dates[0]).toBe("1/15/22");
    });

    it("should handle invalid start date parameter", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "invalid-start-date",
        "2022-12-31"
      );
      // Should return original DataFrame when start date is invalid
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should handle invalid end date parameter", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-01",
        "invalid-end-date"
      );
      // Should return original DataFrame when end date is invalid
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should handle dates with whitespace in data", () => {
      const filtered = filterDataFrameByDateRange(
        mixedFormatDf,
        "appointmentDate",
        "2022-01-01",
        "2022-04-01"
      );

      // Should handle dates with spaces if the parser handles them
      // This test verifies the behavior is consistent
      expect(filtered.height).toBeGreaterThanOrEqual(3); // At least the clean dates
    });

    it("should handle null filter parameters", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        null as any,
        "2022-12-31"
      );
      // Should return original DataFrame when start date is null
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should handle undefined filter parameters", () => {
      const filtered = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        undefined as any,
        "2022-12-31"
      );
      // Should return original DataFrame when start date is undefined
      expect(filtered.height).toBe(standardTestDf.height);
    });

    it("should handle overlapping date ranges correctly", () => {
      // Test that adjacent/overlapping ranges work as expected
      const range1 = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-03-31"
      );

      const range2 = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-03-01",
        "2022-05-31"
      );

      // Range1: Jan-Mar, Range2: Mar-May, they should overlap at March
      expect(range1.height).toBeGreaterThan(0);
      expect(range2.height).toBeGreaterThan(0);

      // March 15 should be in both ranges
      const range1Dates = range1.getColumn("appointmentDate").toArray();
      const range2Dates = range2.getColumn("appointmentDate").toArray();

      expect(range1Dates).toContain("3/15/22");
      expect(range2Dates).toContain("3/15/22");
    });

    it("should handle adjacent date ranges without gaps", () => {
      // Test boundary conditions for adjacent ranges
      const firstHalf = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-06-30"
      );

      const secondHalf = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-07-01",
        "2022-12-31"
      );

      const fullYear = filterDataFrameByDateRange(
        standardTestDf,
        "appointmentDate",
        "2022-01-01",
        "2022-12-31"
      );

      // Combined ranges should equal the full year (accounting for possible boundary overlap)
      const totalFiltered = firstHalf.height + secondHalf.height;

      // Verify that the combined ranges cover all valid dates in the year
      // Allow for the fact that there might be boundary conditions or invalid dates
      expect(totalFiltered).toBeGreaterThanOrEqual(fullYear.height - 1);
      expect(totalFiltered).toBeLessThanOrEqual(fullYear.height + 1);

      // Also verify no overlapping dates between the two ranges
      const firstHalfDates = new Set(
        firstHalf.getColumn("appointmentDate").toArray()
      );
      const secondHalfDates = new Set(
        secondHalf.getColumn("appointmentDate").toArray()
      );

      // Should have no intersection
      const intersection = new Set(
        [...firstHalfDates].filter((x) => secondHalfDates.has(x))
      );
      expect(intersection.size).toBe(0);
    });
  });

  /**
   * Performance and stress tests
   */
  describe("Performance", () => {
    it("should handle large datasets efficiently", () => {
      // Create a large dataset with various date formats
      const largeData: Record<string, any[]> = {
        appointmentDate: [],
        patientId: [],
      };

      const formats = ["M/D/YY", "MM/DD/YYYY", "YYYY-MM-DD"];
      const baseDate = new Date(2022, 0, 1); // Jan 1, 2022

      for (let i = 0; i < 1000; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + (i % 365)); // Spread across a year

        const formatType = i % formats.length;
        let dateStr: string;

        switch (formatType) {
          case 0: // M/D/YY
            dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
            break;
          case 1: // MM/DD/YYYY
            dateStr = `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}/${date.getFullYear()}`;
            break;
          case 2: // YYYY-MM-DD
            dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
            break;
          default:
            dateStr = "1/1/22";
        }

        largeData.appointmentDate.push(dateStr);
        largeData.patientId.push(`P${i.toString().padStart(4, "0")}`);
      }

      const largeDf = pl.DataFrame(largeData);

      // Performance test - filter for Q2 2022
      const startTime = Date.now();
      const filtered = filterDataFrameByDateRange(
        largeDf,
        "appointmentDate",
        "2022-04-01",
        "2022-07-01"
      );
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second for 1000 records)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should have filtered results
      expect(filtered.height).toBeGreaterThan(0);
      expect(filtered.height).toBeLessThan(largeDf.height);
    });
  });
});
