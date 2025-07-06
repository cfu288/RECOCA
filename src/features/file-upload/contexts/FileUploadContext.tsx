import React, { createContext, useContext, ReactNode } from "react";
import { ProcessingStatus, Screens } from "../../../app/app";

interface FileUploadContextType {
  onScreenChange?: (screen: Screens) => void;
  onProcessingComplete?: (status: ProcessingStatus) => void;
}

const FileUploadContext = createContext<FileUploadContextType>({});

export const FileUploadProvider: React.FC<{
  children: ReactNode;
  onScreenChange?: (screen: Screens) => void;
  onProcessingComplete?: (status: ProcessingStatus) => void;
}> = ({ children, onScreenChange, onProcessingComplete }) => {
  return (
    <FileUploadContext.Provider
      value={{ onScreenChange, onProcessingComplete }}
    >
      {children}
    </FileUploadContext.Provider>
  );
};

export const useFileUploadContext = () => {
  const context = useContext(FileUploadContext);
  if (context === undefined) {
    throw new Error(
      "useFileUploadContext must be used within a FileUploadProvider"
    );
  }
  return context;
};
