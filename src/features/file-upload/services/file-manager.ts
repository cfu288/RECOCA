import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

export interface ColumnMapping {
  residentIdentifier: string;
  patientIdentifier: string[];
  appointmentDate: string;
  appointmentStatus?: string;
  selectedResidents?: string[];
  selectedStatusValues?: string[];
  patientFirstName?: string;
  patientLastName?: string;
  patientMiddleName?: string;
  patientDateOfBirth?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface RecentFile {
  name: string;
  path: string;
  size: number;
  lastOpened: number;
  columnMapping?: ColumnMapping;
}

const RECENT_FILES_PATH = join(app.getPath("userData"), "recent-files.json");

export function loadRecentFiles(): RecentFile[] {
  try {
    if (existsSync(RECENT_FILES_PATH)) {
      const data = readFileSync(RECENT_FILES_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading recent files:", error);
  }
  return [];
}

export function saveRecentFiles(files: RecentFile[]) {
  try {
    writeFileSync(RECENT_FILES_PATH, JSON.stringify(files, null, 2));
  } catch (error) {
    console.error("Error saving recent files:", error);
  }
}

export function addRecentFile(
  filePath: string,
  fileName: string,
  fileSize: number
): RecentFile[] {
  const recentFiles = loadRecentFiles();

  const existingFile = recentFiles.find((f) => f.name === fileName);

  if (existingFile) {
    existingFile.lastOpened = Date.now();
    existingFile.path = filePath;

    const otherFiles = recentFiles.filter((f) => f.name !== fileName);
    const updatedFiles = [existingFile, ...otherFiles].slice(0, 10);
    saveRecentFiles(updatedFiles);
    return updatedFiles;
  }

  /**
   * Add new file at the beginning and keep only the 10 most recent files
   */
  const newFile = {
    name: fileName,
    path: filePath,
    size: fileSize,
    lastOpened: Date.now(),
  };
  const updatedFiles = [newFile, ...recentFiles].slice(0, 10);
  saveRecentFiles(updatedFiles);
  return updatedFiles;
}

export function saveColumnMapping(
  fileName: string,
  mapping: ColumnMapping
): RecentFile[] {
  const recentFiles = loadRecentFiles();

  // Find the file entry
  const fileIndex = recentFiles.findIndex((f) => f.name === fileName);

  if (fileIndex !== -1) {
    // Update the column mapping
    recentFiles[fileIndex].columnMapping = mapping;

    // Save the updated files
    saveRecentFiles(recentFiles);
  }

  return recentFiles;
}

export function getColumnMapping(fileName: string): ColumnMapping | undefined {
  const recentFiles = loadRecentFiles();

  // Find the file entry
  const file = recentFiles.find((f) => f.name === fileName);

  // Return the column mapping if it exists
  return file?.columnMapping;
}
