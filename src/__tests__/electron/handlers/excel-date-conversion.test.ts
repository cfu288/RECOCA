/**
 * Tests for Excel date conversion in analytics handlers
 */

import { convertValueToDateString } from "../../../electron/handlers/utils/date-converter";

describe("Excel Date Conversion in Analytics Handlers", () => {
  describe("convertValueToDateString", () => {
    it("should convert Excel date serials to ISO date strings", () => {
      // Test known Excel date serials
      const testCases = [
        { input: 45565, expected: /^\d{4}-\d{2}-\d{2}$/ }, // Excel serial
        { input: 44927, expected: /^\d{4}-\d{2}-\d{2}$/ }, // Excel serial
        { input: 25569, expected: /^\d{4}-\d{2}-\d{2}$/ }, // 1970-01-01
      ];

      testCases.forEach(({ input, expected }) => {
        const result = convertValueToDateString(input);
        expect(result).toMatch(expected);
        // Verify it's a valid date
        expect(new Date(result).toString()).not.toBe("Invalid Date");
      });
    });

    it("should return string representation for non-Excel date values", () => {
      const testCases = [
        { input: "1990-05-15", expected: "1990-05-15" },
        { input: "text", expected: "text" },
        { input: null, expected: "null" },
        { input: undefined, expected: "undefined" },
        { input: 0, expected: "0" }, // Not in Excel date range
        { input: 1, expected: "1" }, // Not in Excel date range
        { input: -100, expected: "-100" }, // Negative number
        { input: true, expected: "true" }, // Boolean
        { input: {}, expected: "[object Object]" }, // Object
      ];

      testCases.forEach(({ input, expected }) => {
        const result = convertValueToDateString(input);
        expect(result).toBe(expected);
      });
    });

    it("should handle edge cases without throwing", () => {
      const edgeCases: unknown[] = [
        NaN,
        Infinity,
        -Infinity,
        1.5, // Non-integer
        2958465, // Near max Excel date
        Number.MAX_SAFE_INTEGER,
        [],
        new Date(),
      ];

      edgeCases.forEach((value) => {
        expect(() => convertValueToDateString(value)).not.toThrow();
        const result = convertValueToDateString(value);
        expect(typeof result).toBe("string");
      });
    });

    it("should handle actual patient record scenarios", () => {
      // Simulate real-world data structures
      const patientRecords = [
        { dateOfBirth: 45565 }, // Excel serial
        { dateOfBirth: "1985-03-15" }, // Already formatted
        { dateOfBirth: null }, // Missing data
        { dateOfBirth: "" }, // Empty string
      ];

      const results = patientRecords.map((record) =>
        convertValueToDateString(record.dateOfBirth)
      );

      expect(results[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(results[1]).toBe("1985-03-15");
      expect(results[2]).toBe("null");
      expect(results[3]).toBe("");
    });
  });
});
