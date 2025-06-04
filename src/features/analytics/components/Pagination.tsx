import * as React from "react";

interface PaginationInfoProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  filteredTotal?: number;
  itemName: string;
}

export const PaginationInfo: React.FC<PaginationInfoProps> = ({
  currentPage,
  itemsPerPage,
  totalItems,
  filteredTotal,
  itemName,
}) => {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage + 1;
  const indexOfLastItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="mb-4">
      <p className="text-sm text-gray-500">
        Showing {Math.min(indexOfFirstItem, totalItems)} - {indexOfLastItem} of{" "}
        {totalItems} {itemName}
        {filteredTotal !== undefined &&
          filteredTotal !== totalItems &&
          ` (filtered from ${filteredTotal})`}
      </p>
    </div>
  );
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-between items-center mt-4">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded border ${
          currentPage === 1
            ? "bg-gray-100 text-gray-400"
            : "bg-white hover:bg-gray-50"
        }`}
      >
        Previous
      </button>
      <span className="text-sm">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className={`px-3 py-1 rounded border ${
          currentPage === totalPages
            ? "bg-gray-100 text-gray-400"
            : "bg-white hover:bg-gray-50"
        }`}
      >
        Next
      </button>
    </div>
  );
};
