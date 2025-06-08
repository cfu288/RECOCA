import * as React from "react";
import {
  isExcelDateSerial,
  excelDateToJSDate,
} from "../../../core/data/loaders/excel-loader";

export interface PreviewSectionProps {
  columns: string[];
  previews: Record<string, string[]>;
  title?: string;
  isDateColumn?: boolean;
}

const formatDisplayValue = (value: string, isDateColumn?: boolean): string => {
  if (!isDateColumn) return value;

  const numValue = Number(value);
  if (!isNaN(numValue) && isExcelDateSerial(numValue)) {
    try {
      const date = excelDateToJSDate(numValue);
      return new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }).format(date);
    } catch {
      return value;
    }
  }

  const dateObj = new Date(value);
  if (!isNaN(dateObj.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(dateObj);
  }

  return value;
};

export const PreviewSection: React.FC<PreviewSectionProps> = ({
  columns,
  previews,
  title,
  isDateColumn,
}) => (
  <div className="hidden md:block h-full">
    <div className="w-full border rounded-md px-4 bg-gray-50 pb-4 relative md:h-full md:flex md:flex-col md:justify-center">
      {title && (
        <span className="text-sm font-medium text-gray-700 mb-8 absolute top-0 left-0 rounded-br-sm bg-blue-100 bg-opacity-50 px-2 py-1">
          {title}
        </span>
      )}
      <div className="mt-4 h-full">
        {Object.keys(previews).length === 0 ||
        !columns ||
        columns.length === 0 ||
        columns[0] === "" ||
        columns.every((column) => !column) ? (
          <p className="text-sm text-gray-500 text-center h-full flex items-center justify-center">
            Select a column on the left to preview the data
          </p>
        ) : (
          columns.filter(Boolean).map((column) => (
            <div key={column} className="space-y-1 font-mono text-right">
              {previews[column]?.map((value, idx) => (
                <p key={idx} className="text-sm">
                  {formatDisplayValue(value, isDateColumn)}
                </p>
              ))}
              {previews[column]?.length > 0 && <p className="text-sm">...</p>}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);
