import { filterPatientsBySearchTerm } from "../../../../features/analytics/utils/patient-search";

describe("filterPatientsBySearchTerm", () => {
  const mockPatientIds = ["MRN001", "MRN002", "MRN003", "MRN004"];

  const mockPatientAdditionalInfo = {
    MRN001: { firstName: "John", lastName: "Smith", dateOfBirth: "1990-01-01" },
    MRN002: { firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-05-15" },
    MRN003: { firstName: "Bob", lastName: "Wilson", dateOfBirth: "1992-03-10" },
    MRN004: {
      firstName: "Alice",
      lastName: "Brown",
      dateOfBirth: "1988-08-20",
    },
  };

  describe("Empty search term", () => {
    test("returns all patients when search term is empty", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(mockPatientIds);
    });

    test("returns all patients when search term is whitespace only", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "   ",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(mockPatientIds);
    });
  });

  describe("Search by Patient ID/MRN", () => {
    test("filters by exact patient ID", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "MRN001",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by partial patient ID", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "MRN00",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001", "MRN002", "MRN003", "MRN004"]);
    });

    test("filters by patient ID case insensitive", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "mrn001",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });
  });

  describe("Search by first name", () => {
    test("filters by exact first name", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "John",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by partial first name", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "Jo",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by first name case insensitive", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "JANE",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN002"]);
    });

    test("filters by first name with multiple matches", () => {
      const patientInfoWithDuplicateNames = {
        ...mockPatientAdditionalInfo,
        MRN004: {
          firstName: "John",
          lastName: "Brown",
          dateOfBirth: "1988-08-20",
        },
      };
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "john",
        patientInfoWithDuplicateNames
      );
      expect(result).toEqual(["MRN001", "MRN004"]);
    });
  });

  describe("Search by last name", () => {
    test("filters by exact last name", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "Smith",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by partial last name", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "Sm",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by last name case insensitive", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "WILSON",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN003"]);
    });
  });

  describe("Search with missing additional info", () => {
    test("handles undefined additional info", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "MRN001",
        undefined
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("handles empty additional info object", () => {
      const result = filterPatientsBySearchTerm(mockPatientIds, "MRN001", {});
      expect(result).toEqual(["MRN001"]);
    });

    test("filters by ID when patient not in additional info", () => {
      const partialAdditionalInfo = {
        MRN001: {
          firstName: "John",
          lastName: "Smith",
          dateOfBirth: "1990-01-01",
        },
      };
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "MRN002",
        partialAdditionalInfo
      );
      expect(result).toEqual(["MRN002"]);
    });

    test("returns empty array when searching by name with no additional info", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "John",
        undefined
      );
      expect(result).toEqual([]);
    });
  });

  describe("Search with empty name fields", () => {
    test("handles empty first name", () => {
      const patientInfoWithEmptyFirstName = {
        MRN001: { firstName: "", lastName: "Smith", dateOfBirth: "1990-01-01" },
      };
      const result = filterPatientsBySearchTerm(
        ["MRN001"],
        "John",
        patientInfoWithEmptyFirstName
      );
      expect(result).toEqual([]);
    });

    test("handles undefined first name", () => {
      const patientInfoWithUndefinedFirstName = {
        MRN001: {
          firstName: undefined,
          lastName: "Smith",
          dateOfBirth: "1990-01-01",
        },
      };
      const result = filterPatientsBySearchTerm(
        ["MRN001"],
        "John",
        patientInfoWithUndefinedFirstName
      );
      expect(result).toEqual([]);
    });

    test("handles empty last name", () => {
      const patientInfoWithEmptyLastName = {
        MRN001: { firstName: "John", lastName: "", dateOfBirth: "1990-01-01" },
      };
      const result = filterPatientsBySearchTerm(
        ["MRN001"],
        "Smith",
        patientInfoWithEmptyLastName
      );
      expect(result).toEqual([]);
    });
  });

  describe("Search trimming", () => {
    test("trims leading and trailing whitespace from search term", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "  John  ",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });

    test("handles search term with internal spaces", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "Jo hn",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual([]);
    });
  });

  describe("No matches", () => {
    test("returns empty array when no patients match search", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "nonexistent",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual([]);
    });
  });

  describe("Edge cases", () => {
    test("handles empty patient IDs array", () => {
      const result = filterPatientsBySearchTerm(
        [],
        "John",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual([]);
    });

    test("handles special characters in search term", () => {
      const patientIdsWithSpecialChars = ["MRN-001", "MRN_002"];
      const result = filterPatientsBySearchTerm(
        patientIdsWithSpecialChars,
        "-",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN-001"]);
    });

    test("handles numeric search terms", () => {
      const result = filterPatientsBySearchTerm(
        mockPatientIds,
        "001",
        mockPatientAdditionalInfo
      );
      expect(result).toEqual(["MRN001"]);
    });
  });
});
