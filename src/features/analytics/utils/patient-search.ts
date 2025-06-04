interface PatientAdditionalInfo {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
}

export const filterPatientsBySearchTerm = (
  patientIds: string[],
  searchTerm: string,
  patientAdditionalInfo?: Record<string, PatientAdditionalInfo>
): string[] => {
  if (searchTerm.trim() === "") {
    return patientIds;
  }

  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  return patientIds.filter((patientId) => {
    if (patientId.toLowerCase().includes(normalizedSearchTerm)) {
      return true;
    }

    const additionalInfo = patientAdditionalInfo?.[patientId];
    if (additionalInfo) {
      const firstName = additionalInfo.firstName?.toLowerCase() || "";
      const lastName = additionalInfo.lastName?.toLowerCase() || "";

      return (
        firstName.includes(normalizedSearchTerm) ||
        lastName.includes(normalizedSearchTerm)
      );
    }

    return false;
  });
};
