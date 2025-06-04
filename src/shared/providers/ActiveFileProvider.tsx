import React from "react";
import { ColumnMapping } from "../../features/file-upload/services/file-manager";

export interface UploadedFile {
  name: string;
  file: File;
  size: number;
  message?: string;
  columnMapping?: ColumnMapping;
}

const ActiveFileContext = React.createContext<{
  activeFile: UploadedFile | null;
  setActiveFile: (file: UploadedFile | null) => void;
}>({ activeFile: null, setActiveFile: () => undefined });

export const ActiveFileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [activeFile, setActiveFile] = React.useState<UploadedFile | null>(null);

  return (
    <ActiveFileContext.Provider value={{ activeFile, setActiveFile }}>
      {children}
    </ActiveFileContext.Provider>
  );
};

export function useActiveFile() {
  const context = React.useContext(ActiveFileContext);
  if (context === undefined) {
    throw new Error("useActiveFile must be used within an ActiveFileProvider");
  }
  return context;
}
