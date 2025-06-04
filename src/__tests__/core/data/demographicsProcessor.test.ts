import { extractPatientDemographics } from "../../../core/data/processors/provider-patient-demographics";

describe("extractPatientDemographics", () => {
  test("should extract unique patient demographics correctly", () => {
    const providerToPatients = {
      Provider1: [
        { id: "P1", race: "White", gender: "M" },
        { id: "P2", race: "Black", gender: "F" },
      ],
      Provider2: [
        { id: "P1", race: "White", gender: "M" }, // Duplicate patient
        { id: "P3", race: "Asian", gender: "F" },
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.race).toEqual({
      White: 1,
      Black: 1,
      Asian: 1,
    });
    expect(result.gender).toEqual({
      M: 1,
      F: 2,
    });
  });

  test("should handle empty input gracefully", () => {
    const result = extractPatientDemographics({});

    expect(result.race).toEqual({});
    expect(result.gender).toEqual({});
  });

  test("should handle patients without demographic data", () => {
    const providerToPatients = {
      Provider1: [
        { id: "P1" }, // No race/gender
        { id: "P2", race: "White" }, // Only race
        { id: "P3", gender: "F" }, // Only gender
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.race).toEqual({ White: 1 });
    expect(result.gender).toEqual({ F: 1 });
  });

  test("should normalize gender to uppercase", () => {
    const providerToPatients = {
      Provider1: [
        { id: "P1", gender: "male" },
        { id: "P2", gender: "Female" },
        { id: "P3", gender: "m" },
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.gender).toEqual({
      MALE: 1,
      FEMALE: 1,
      M: 1,
    });
  });

  test("should trim whitespace from race and gender", () => {
    const providerToPatients = {
      Provider1: [
        { id: "P1", race: "  White  ", gender: " M " },
        { id: "P2", race: "Black ", gender: "F" },
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.race).toEqual({
      White: 1,
      Black: 1,
    });
    expect(result.gender).toEqual({
      M: 1,
      F: 1,
    });
  });

  test("should deduplicate patients correctly across multiple providers", () => {
    // Should never really happen as pid should be unique
    const providerToPatients = {
      Provider1: [{ id: "P1", race: "White", gender: "M" }],
      Provider2: [
        { id: "P1", race: "Black", gender: "F" }, // Same patient, different data
      ],
      Provider3: [
        { id: "P1", race: "Asian", gender: "X" }, // Same patient again
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    // Should only count P1 once (first occurrence)
    expect(result.race).toEqual({ White: 1 });
    expect(result.gender).toEqual({ M: 1 });
  });

  test("should handle invalid input gracefully", () => {
    const result1 = extractPatientDemographics(null as any);
    const result2 = extractPatientDemographics(undefined as any);
    const result3 = extractPatientDemographics("invalid" as any);

    [result1, result2, result3].forEach((result) => {
      expect(result.race).toEqual({});
      expect(result.gender).toEqual({});
    });
  });

  test("should handle invalid patient objects gracefully", () => {
    // Should never happen, but ignore any invalid patients
    const providerToPatients = {
      Provider1: [
        null,
        undefined,
        "not an object",
        { /* no id */ race: "White" },
        { id: "P1", race: "White", gender: "M" }, // Valid patient
      ] as any,
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.race).toEqual({ White: 1 });
    expect(result.gender).toEqual({ M: 1 });
  });

  test("should ignore empty string race and gender values", () => {
    const providerToPatients = {
      Provider1: [
        { id: "P1", race: "", gender: "   " }, // Empty strings/whitespace
        { id: "P2", race: "White", gender: "M" }, // Valid data
      ],
    };

    const result = extractPatientDemographics(providerToPatients);

    expect(result.race).toEqual({ White: 1 });
    expect(result.gender).toEqual({ M: 1 });
  });
});
