import * as React from "react";
import { Card } from "../../../shared/components/ui/card";
import { Skeleton } from "../../../shared/components/ui/skeleton";

/**
 * Loading skeleton that matches the SheetSelector component structure
 */
export const SheetSelectorSkeleton: React.FC = () => {
  return (
    <Card>
      <div className="animate-pulse">
        <div className="p-6 pb-3">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="px-6 pb-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1 min-w-0">
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-16 ml-3" />
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
};