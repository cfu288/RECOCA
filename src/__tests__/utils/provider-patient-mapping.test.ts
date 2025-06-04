import {
  mapProvidersToPatients,
  PatientRecord,
} from "../../core/data/processors/provider-patient-mapping";

describe("Provider-Patient Mapping", () => {
  test("should assign patients to providers they see most frequently", () => {
    const records: PatientRecord[] = [
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "B" },
      { patientId: "P2", providerId: "B" },
      { patientId: "P2", providerId: "B" },
      { patientId: "P2", providerId: "C" },
    ];

    const result = mapProvidersToPatients(records);

    // P1 sees A twice, B once -> assigned to A
    // P2 sees B twice, C once -> assigned to B
    expect(result.patientToProvider["P1"].id).toBe("A");
    expect(result.patientToProvider["P2"].id).toBe("B");

    expect(result.providerToPatients["A"]).toHaveLength(1);
    expect(result.providerToPatients["B"]).toHaveLength(1);
    expect(result.providerToPatients["C"]).toHaveLength(0);
  });

  test("should handle ties by assigning to provider with fewer patients", () => {
    const records: PatientRecord[] = [
      // P1 has a clear primary provider A
      { patientId: "P1", providerId: "A" },
      { patientId: "P1", providerId: "A" },

      // P2 has a tie between A and B, but A already has P1
      { patientId: "P2", providerId: "A" },
      { patientId: "P2", providerId: "B" },
    ];

    const result = mapProvidersToPatients(records);

    expect(result.patientToProvider["P1"].id).toBe("A");
    expect(result.patientToProvider["P2"].id).toBe("B"); // Assigned to B due to load balancing
  });

  test("should handle empty dataset", () => {
    const records: PatientRecord[] = [];
    const result = mapProvidersToPatients(records);

    expect(Object.keys(result.patientToProvider)).toHaveLength(0);
    expect(Object.keys(result.providerToPatients)).toHaveLength(0);
  });

  test("should handle null and undefined values", () => {
    const records: PatientRecord[] = [
      { patientId: "P1", providerId: "A" },
      { patientId: null as any, providerId: "A" },
      { patientId: "P1", providerId: null as any },
    ];

    const result = mapProvidersToPatients(records);

    expect(result.patientToProvider["P1"].id).toBe("A");
    expect(Object.keys(result.patientToProvider)).toHaveLength(1);
  });
});
