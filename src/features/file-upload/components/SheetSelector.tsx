import * as React from "react";
import { Button } from "../../../shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/components/ui/card";
import { ExcelSheet } from "../../../core/data/loaders/excel-loader";

interface SheetSelectorProps {
  sheets: ExcelSheet[];
  onSheetSelect: (sheetName: string) => void;
  onCancel: () => void;
}

export const SheetSelector: React.FC<SheetSelectorProps> = ({
  sheets,
  onSheetSelect,
  onCancel,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Excel Sheet</CardTitle>
        <p className="text-sm text-gray-600">
          This Excel file contains multiple sheets. Please select which sheet to use:
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sheets.map((sheet) => (
          <div
            key={sheet.name}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{sheet.name}</p>
              <p className="text-sm text-gray-500">
                {sheet.rowCount.toLocaleString()} rows × {sheet.columnCount.toLocaleString()} columns
              </p>
            </div>
            <Button
              onClick={() => onSheetSelect(sheet.name)}
              variant="outline"
              size="sm"
              className="ml-3 flex-shrink-0"
            >
              Select
            </Button>
          </div>
        ))}
        <div className="flex justify-end pt-4">
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};