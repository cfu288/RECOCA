import { ipcMain, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
  loadRecentFiles,
  saveRecentFiles,
  addRecentFile,
} from "../../features/file-upload/services/file-manager";
import { getPolars } from "./shared";

let currentDf: any = null;

export function setCurrentDataFrame(df: any) {
  currentDf = df;
}

export function getCurrentDataFrame() {
  return currentDf;
}

/**
 * Register all file-related IPC handlers
 */
export function registerFileHandlers() {
  ipcMain.handle("getRecentFiles", () => {
    return loadRecentFiles();
  });

  ipcMain.handle("addRecentFile", (_, { path, name, size }) => {
    return addRecentFile(path, name, size);
  });

  ipcMain.handle("removeRecentFile", (_, filePath) => {
    const recentFiles = loadRecentFiles();
    const updatedFiles = recentFiles.filter((f) => f.path !== filePath);
    saveRecentFiles(updatedFiles);
    return updatedFiles;
  });

  ipcMain.handle("checkFileExists", (_, filePath) => {
    return fs.existsSync(filePath);
  });

  ipcMain.handle("readLocalFile", (_, filePath) => {
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      console.error("Error reading file:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "handleNewFile",
    async (_event, fileContents: string, fileName: string) => {
      try {
        const tempDir = path.join(app.getPath("userData"), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Reuse existing file path to avoid duplicate temp files for the same upload
        const recentFiles = loadRecentFiles();
        const existingFile = recentFiles.find((f) => f.name === fileName);
        let filePath: string;

        if (existingFile && fs.existsSync(existingFile.path)) {
          filePath = existingFile.path;
          fs.writeFileSync(filePath, fileContents);
        } else {
          const timestamp = Date.now();
          filePath = path.join(tempDir, `file_${timestamp}.csv`);
          fs.writeFileSync(filePath, fileContents);
        }

        const df = getPolars().readCSV(fileContents, {
          hasHeader: true,
          quoteChar: '"',
        });

        currentDf = df;

        const columns = df.columns;

        const previews: Record<string, string[]> = {};
        for (const column of columns) {
          const preview = df
            .select(column)
            .head(10)
            .getColumn(column)
            .toArray()
            .map((val: unknown) => (val === null ? "null" : String(val)));
          previews[column] = preview;
        }

        return {
          success: true,
          message: "File processed successfully",
          columns: columns,
          previews: previews,
          filePath: filePath,
        };
      } catch (error) {
        console.error("Error processing file:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Error processing file",
        };
      }
    }
  );
}
