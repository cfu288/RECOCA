import * as React from "react";
import { SearchInput } from "./SearchInput";
import { PaginationInfo, PaginationControls } from "./Pagination";
import { ErrorMessage } from "./ErrorMessage";

interface PatientInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
}

interface ProviderPatientMappingProps {
  providerToPatients: Record<string, PatientInfo[]>;
  patientToProvider: Record<string, { id: string }>;
  providerSearchTerm: string;
  onProviderSearchChange: (value: string) => void;
  providerPage: number;
  setProviderPage: (page: number) => void;
  isLoadingMapping: boolean;
  mappingError: string | null;
  activeFileResidentIdentifier?: string;
  activeFilePatientIdentifier?: string;
}

export const ProviderPatientMapping: React.FC<ProviderPatientMappingProps> = ({
  providerToPatients,
  providerSearchTerm,
  onProviderSearchChange,
  providerPage,
  setProviderPage,
  isLoadingMapping,
  mappingError,
  activeFileResidentIdentifier,
  activeFilePatientIdentifier,
}) => {
  const providersPerPage = 10;

  if (isLoadingMapping) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 w-20 bg-gray-300 rounded"></div>
          <div className="h-4 w-20 bg-gray-300 rounded"></div>
          <div className="h-4 w-20 bg-gray-300 rounded"></div>
        </div>
        <p className="text-gray-500">Loading provider-patient assignments...</p>
        <p className="text-xs text-gray-400">
          This may take a moment for large datasets
        </p>
      </div>
    );
  }

  if (mappingError) {
    return (
      <ErrorMessage
        message={mappingError}
        type="error"
        tips={[
          { content: "Return to the Upload screen and re-upload your file" },
          { content: "Make sure your file is a valid CSV with headers" },
          {
            content:
              "Check if your file contains both provider and patient data",
          },
        ]}
      />
    );
  }

  if (Object.keys(providerToPatients).length === 0) {
    return (
      <ErrorMessage
        message="No provider-patient assignments available"
        type="warning"
        tips={[
          {
            content:
              "Verify your file contains patient visits to multiple providers",
          },
          {
            content: `Check that you've correctly mapped the provider column (${activeFileResidentIdentifier})`,
          },
          {
            content: `Ensure patient identifier column (${activeFilePatientIdentifier}) has unique values`,
          },
          {
            content:
              "Try navigating back to Column Mapping and re-selecting the columns",
          },
        ]}
      />
    );
  }

  let sortedProviders = Object.keys(providerToPatients).sort();
  const totalProviders = sortedProviders.length;

  if (providerSearchTerm.trim() !== "") {
    sortedProviders = sortedProviders.filter((providerId) =>
      providerId.toLowerCase().includes(providerSearchTerm.toLowerCase())
    );
  }

  const indexOfLastProvider = providerPage * providersPerPage;
  const indexOfFirstProvider = indexOfLastProvider - providersPerPage;
  const currentProviders =
    sortedProviders.length > 0
      ? sortedProviders.slice(indexOfFirstProvider, indexOfLastProvider)
      : [];
  const totalProviderPages = Math.ceil(
    sortedProviders.length / providersPerPage
  );

  return (
    <>
      <div className="mb-4">
        <SearchInput
          placeholder="Search providers..."
          value={providerSearchTerm}
          onChange={onProviderSearchChange}
        />
      </div>

      {sortedProviders.length > 0 ? (
        <>
          <PaginationInfo
            currentPage={providerPage}
            itemsPerPage={providersPerPage}
            totalItems={sortedProviders.length}
            filteredTotal={totalProviders}
            itemName="providers"
          />

          <div className="space-y-4 mb-4 overflow-y-auto pr-2">
            {currentProviders.map((providerId) => {
              const patients = providerToPatients[providerId] || [];
              return (
                <div
                  key={providerId}
                  className="border rounded-md p-4 shadow-sm"
                >
                  <h4 className="font-medium text-lg mb-2">
                    Provider: {providerId}
                  </h4>
                  <p className="text-sm text-gray-500 mb-2">
                    {patients.length} patient{patients.length !== 1 ? "s" : ""}{" "}
                    in panel
                  </p>
                  {patients.length > 0 && (
                    <div className="pl-4 space-y-1 mt-3">
                      <h5 className="font-medium text-sm mb-1">
                        Patient Panel:
                      </h5>
                      <div className="flex items-center px-5 py-1 text-xs font-semibold text-gray-500 border-b">
                        <span className="min-w-[80px] mr-2">MRN</span>
                        <span className="min-w-[180px] mr-2">Patient Name</span>
                        <span>DOB</span>
                      </div>
                      <ul className="list-none pl-0 text-sm max-h-60 overflow-y-auto">
                        {patients.map((patient) => (
                          <li
                            key={patient.id}
                            className="px-5 py-1 border-b border-gray-100 hover:bg-gray-50"
                          >
                            <div className="flex items-center text-sm">
                              <span className="font-medium min-w-[80px] mr-2">
                                {patient.id}
                              </span>
                              {(patient.lastName ||
                                patient.firstName ||
                                patient.middleName) && (
                                <span className="text-gray-700 min-w-[180px] mr-2">
                                  {patient.lastName
                                    ? patient.lastName +
                                      (patient.firstName ? ", " : "")
                                    : ""}
                                  {patient.firstName || ""}
                                </span>
                              )}
                              {patient.dateOfBirth && (
                                <span className="text-gray-600 text-xs">
                                  {patient.dateOfBirth}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <PaginationControls
            currentPage={providerPage}
            totalPages={totalProviderPages}
            onPageChange={setProviderPage}
          />
        </>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-md shadow-sm">
          <p className="text-gray-500">No providers match your search</p>
          <p className="text-sm text-gray-400 mt-2">
            Try adjusting your search terms
          </p>
        </div>
      )}
    </>
  );
};
