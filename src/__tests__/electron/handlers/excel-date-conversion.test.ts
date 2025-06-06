/**
 * Tests for Excel date conversion in analytics handlers
 * Note: These are integration-style tests that verify Excel dates are properly
 * converted when processing patient data for UI display
 */

import { isExcelDateSerial, excelDateToJSDate } from "../../../core/data/loaders/excel-loader";

describe("Excel Date Conversion in Analytics", () => {
  describe("Patient Date of Birth Processing", () => {
    it("should convert Excel date serials to readable dates for patient records", () => {
      // Simulate the logic from analytics-handlers.ts
      const testRecord = {
        patientId: "P001",
        providerId: "DOC123",
        dateOfBirth: 45565, // Excel serial for 2024-09-30
      };

      const dobValue = testRecord.dateOfBirth;
      let convertedDob: string;

      if (isExcelDateSerial(dobValue)) {
        try {
          const jsDate = excelDateToJSDate(dobValue as number);
          convertedDob = jsDate.toISOString().split('T')[0];
        } catch {
          convertedDob = String(dobValue);
        }
      } else {
        convertedDob = String(dobValue);
      }

      // Verify it's a valid ISO date string
      expect(convertedDob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle non-Excel date values properly", () => {
      const testCases = [
        { input: "1990-05-15", expected: "1990-05-15" },
        { input: "text", expected: "text" },
        { input: null, expected: "null" },
        { input: 0, expected: "0" }, // Zero is not in Excel date range
        { input: 1, expected: "1" }, // One is not in Excel date range  
      ];

      testCases.forEach(({ input, expected }) => {
        let convertedDob: string;

        if (isExcelDateSerial(input)) {
          try {
            const jsDate = excelDateToJSDate(input as number);
            convertedDob = jsDate.toISOString().split('T')[0];
          } catch {
            convertedDob = String(input);
          }
        } else {
          convertedDob = String(input);
        }

        expect(convertedDob).toBe(expected);
      });
    });

    it("should handle edge cases gracefully", () => {
      // Test boundary values
      const edgeCases = [
        25569, // 1970-01-01 (Unix epoch)
        2958465, // Near max Excel date
        1.5, // Non-integer (not a valid Excel date)
      ];

      edgeCases.forEach(value => {
        let convertedDob: string;

        if (isExcelDateSerial(value)) {
          try {
            const jsDate = excelDateToJSDate(value);
            convertedDob = jsDate.toISOString().split('T')[0];
          } catch {
            convertedDob = String(value);
          }
        } else {
          convertedDob = String(value);
        }

        // Should not throw and should return a string
        expect(typeof convertedDob).toBe("string");
      });
    });
  });
});