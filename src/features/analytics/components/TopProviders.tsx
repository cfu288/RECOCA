import * as React from "react";
import { SearchInput } from "./SearchInput";
import { PaginationInfo, PaginationControls } from "./Pagination";
import { filterPatientsBySearchTerm } from "../utils/patient-search";

interface PatientInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
}

interface PatientAdditionalInfoType {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
}

interface TopProvidersProps {
  topProviders?: Record<string, Record<string, number>>;
  patientsInfo?: Record<string, PatientInfo>;
  patientAdditionalInfo?: Record<string, PatientAdditionalInfoType>;
  patientSearchTerm: string;
  onPatientSearchChange: (value: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalFilteredPatients?: number;
}

export const TopProviders: React.FC<TopProvidersProps> = ({
  topProviders,
  patientAdditionalInfo,
  patientSearchTerm,
  onPatientSearchChange,
  currentPage,
  setCurrentPage,
  totalFilteredPatients,
}) => {
  const patientsPerPage = 10;

  if (!topProviders || Object.keys(topProviders).length === 0) {
    return <p className="text-gray-500">No provider data available</p>;
  }

  let sortedPatients = Object.keys(topProviders).sort();
  const totalPatients = totalFilteredPatients || sortedPatients.length;

  sortedPatients = filterPatientsBySearchTerm(
    sortedPatients,
    patientSearchTerm,
    patientAdditionalInfo
  );

  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = sortedPatients.slice(
    indexOfFirstPatient,
    indexOfLastPatient
  );
  const totalPages = Math.ceil(sortedPatients.length / patientsPerPage);

  return (
    <>
      <div className="mb-4">
        <SearchInput
          placeholder="Search by ID, first name, or last name..."
          value={patientSearchTerm}
          onChange={onPatientSearchChange}
        />
      </div>

      <PaginationInfo
        currentPage={currentPage}
        itemsPerPage={patientsPerPage}
        totalItems={sortedPatients.length}
        filteredTotal={totalPatients}
        itemName="patients"
      />

      {sortedPatients.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-md shadow-sm">
          <p className="text-gray-500">No patients match your search</p>
          <p className="text-sm text-gray-400 mt-2">
            Try adjusting your search terms
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-4 overflow-y-auto px-2 inset-shadow-sm rounded-md p-4">
          {currentPatients.map((patientId) => {
            const providers = topProviders[patientId];
            const sortedProviders = Object.entries(providers)
              .sort(([, a], [, b]) => b - a)
              .map(([providerId, count]) => ({ providerId, count }));

            return (
              <div key={patientId} className="border rounded-md p-4 shadow-sm">
                <h4 className="font-medium text-lg mb-2">
                  {patientAdditionalInfo && patientAdditionalInfo[patientId] ? (
                    <>
                      {patientAdditionalInfo[patientId].lastName
                        ? patientAdditionalInfo[patientId].lastName + ", "
                        : ""}
                      {patientAdditionalInfo[patientId].firstName || ""}
                      {patientAdditionalInfo[patientId].dateOfBirth
                        ? ` • ${patientAdditionalInfo[patientId].dateOfBirth}`
                        : ""}
                      <span className="font-normal text-sm ml-2 text-gray-500">
                        ID: {patientId}
                      </span>
                    </>
                  ) : (
                    <>Patient ID: {patientId}</>
                  )}
                </h4>
                {sortedProviders.length > 0 && (
                  <div className="pl-4 space-y-1 mt-3">
                    <h5 className="font-medium text-sm mb-1">Top Providers:</h5>
                    <div className="space-y-1">
                      {sortedProviders.map(({ providerId, count }) => (
                        <div key={providerId} className="flex justify-between">
                          <span className="text-sm">{providerId}</span>
                          <span className="text-sm font-medium">
                            {count} visits
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sortedPatients.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </>
  );
};
