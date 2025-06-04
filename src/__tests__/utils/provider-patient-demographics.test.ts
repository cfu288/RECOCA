import {
  extractPatientDemographics,
  CHART_COLORS,
} from "../../core/data/processors/provider-patient-demographics";

describe("extractPatientDemographics", () => {
  test("should extract unique patient demographics correctly", () => {
    // Mock patient data with structure that matches the actual app data
    const providerToPatients = {
      provider1: [
        {
          id: "patient1",
          firstName: "John",
          lastName: "Doe",
          race: "White",
          gender: "Male",
        },
        {
          id: "patient2",
          firstName: "Jane",
          lastName: "Smith",
          race: "Black",
          gender: "Female",
        },
        {
          id: "patient3",
          firstName: "Michael",
          lastName: "Wong",
          race: "Asian",
          gender: "Male",
        },
      ],
      provider2: [
        {
          id: "patient4",
          firstName: "Maria",
          lastName: "Rodriguez",
          race: "Hispanic",
          gender: "Female",
        },
        {
          id: "patient5",
          firstName: "Robert",
          lastName: "Jones",
          race: "White",
          gender: "Male",
        },
        // patient1 appears under multiple providers - should only be counted once
        {
          id: "patient1",
          firstName: "John",
          lastName: "Doe",
          race: "White",
          gender: "Male",
        },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race).toEqual({
      White: 2, // patient1 and patient5
      Black: 1, // patient2
      Asian: 1, // patient3
      Hispanic: 1, // patient4
    });

    expect(demographics.gender).toEqual({
      MALE: 3, // patient1, patient3, patient5 (normalized to uppercase)
      FEMALE: 2, // patient2, patient4
    });
  });

  test("should handle missing demographic data", () => {
    // Mock patient data with missing demographics
    const providerToPatients = {
      provider1: [
        {
          id: "patient1",
          firstName: "John",
          lastName: "Doe",
          race: "White", // No gender
        },
        {
          id: "patient2",
          firstName: "Jane",
          lastName: "Smith",
          gender: "Female", // No race
        },
        {
          id: "patient3",
          firstName: "Unknown",
          lastName: "Patient",
          // No race or gender
        },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race).toEqual({
      White: 1,
    });

    expect(demographics.gender).toEqual({
      FEMALE: 1,
    });
  });

  test("should handle empty provider data", () => {
    const providerToPatients = {};
    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race).toEqual({});
    expect(demographics.gender).toEqual({});

    // Check that we have a color palette
    expect(CHART_COLORS.length).toBeGreaterThan(0);
  });

  test("should normalize demographic values by trimming whitespace", () => {
    const providerToPatients = {
      provider1: [
        {
          id: "patient1",
          race: "White ",
          gender: " Male",
        },
        {
          id: "patient2",
          race: " White",
          gender: "Male ",
        },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race).toEqual({
      White: 2,
    });

    expect(demographics.gender).toEqual({
      MALE: 2,
    });
  });

  test("should normalize demographic values by case (case-insensitive)", () => {
    const providerToPatients = {
      provider1: [
        { id: "patient1", race: "White", gender: "Male" },
        { id: "patient2", race: "white", gender: "male" },
        { id: "patient3", race: "WHITE", gender: "MALE" },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    // Race should remain case-sensitive - different capitalizations are different values
    expect(demographics.race).toEqual({
      White: 1,
      white: 1,
      WHITE: 1,
    });

    // Gender should normalize case - all variations should be counted as the same value
    expect(demographics.gender).toEqual({
      MALE: 3, // All "Male", "male", "MALE" normalized to "MALE"
    });
  });

  test("CHART_COLORS should provide a palette of colors for demographic charts", () => {
    // Test that we have enough colors in our palette
    expect(CHART_COLORS.length).toBeGreaterThanOrEqual(10);

    // Verify the colors are valid hex codes
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    CHART_COLORS.forEach((color) => {
      expect(color).toMatch(hexColorRegex);
    });

    // Verify that all colors are unique
    const uniqueColors = new Set(CHART_COLORS);
    expect(uniqueColors.size).toBe(CHART_COLORS.length);
  });

  test("should handle special characters in patient names", () => {
    const providerToPatients = {
      provider1: [
        {
          id: "patient1",
          firstName: "José",
          lastName: "García-López",
          race: "Hispanic",
          gender: "Male",
        },
        {
          id: "patient2",
          firstName: "李",
          lastName: "王",
          race: "Asian",
          gender: "Female",
        },
        {
          id: "patient3",
          firstName: "François",
          lastName: "Müller-Straße",
          race: "White",
          gender: "Male",
        },
        {
          id: "patient4",
          firstName: "عبد الله",
          lastName: "محمد",
          race: "Middle Eastern",
          gender: "Male",
        },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race).toEqual({
      Hispanic: 1,
      Asian: 1,
      White: 1,
      "Middle Eastern": 1,
    });

    expect(demographics.gender).toEqual({
      MALE: 3,
      FEMALE: 1,
    });
  });

  test("should handle very long demographic values", () => {
    const longRace = "A".repeat(1000);
    const longGender = "B".repeat(500);

    const providerToPatients = {
      provider1: [
        {
          id: "patient1",
          firstName: "Test",
          lastName: "Patient",
          race: longRace,
          gender: longGender,
        },
      ],
    };

    const demographics = extractPatientDemographics(providerToPatients);

    expect(demographics.race[longRace]).toBe(1);
    expect(demographics.gender[longGender.toUpperCase()]).toBe(1);
  });
});
