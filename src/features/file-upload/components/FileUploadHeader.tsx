import * as React from "react";

/**
 * Header section with title and instructions for the file upload screen
 */
export const FileUploadHeader: React.FC = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Recoca</h1>
      <div className="space-y-4">
        <p className="text-gray-600">
          Recoca (Resident Continuity of Care App) is an open-source toolkit for
          calculating continuity of care metrics for resident primary care or
          outpatient clinics.
        </p>
        <p className="text-gray-600">
          To get started, upload a CSV or Excel file with your clinic's
          appointment data. The file should contain data related to an
          appointment including:
          <ul className="list-disc list-inside">
            <li>The date of the appointment</li>
            <li>The patient seen during this appointment</li>
            <li>The provider who saw the patient</li>
          </ul>
        </p>
      </div>
    </div>
  );
};
