import { ipcMain, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
  loadRecentFiles,
  saveRecentFiles,
  addRecentFile,
} from "../../features/file-upload/services/file-manager";
import { getPolars } from "./shared";
import {
  getExcelFileInfo,
  convertSheetToJSON,
  isExcelFile,
} from "../../core/data/loaders/excel-loader";

let currentDf: any = null;

export function setCurrentDataFrame(df: any) {
  currentDf = df;
}

export function getCurrentDataFrame() {
  return currentDf;
}

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

  ipcMain.handle("readLocalBinaryFile", (_, filePath: string) => {
    try {
      // Add path validation
      const safePath = path.normalize(filePath);
      const userDataPath = app.getPath("userData");
      
      if (!safePath.startsWith(userDataPath)) {
        throw new Error("Access denied: Path must be within application data directory");
      }
      
      return fs.readFileSync(safePath);
    } catch (error) {
      console.error("Error reading binary file:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "handleNewFile",
    async (_event, fileContents: string | ArrayBuffer, fileName: string, selectedSheet?: string) => {
      try {
        
        const tempDir = path.join(app.getPath("userData"), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        let df;
        let filePath: string;
        const timestamp = Date.now();

        if (isExcelFile(fileName)) {
          const fileBuffer = Buffer.from(fileContents as ArrayBuffer);
          
          if (!selectedSheet || selectedSheet.trim() === '') {
            const excelInfo = getExcelFileInfo(fileBuffer);
            return {
              success: false,
              isExcel: true,
              sheets: excelInfo.sheets,
              message: "Sheet selection required",
            };
          }

          const jsonData = convertSheetToJSON(fileBuffer, selectedSheet);
          df = getPolars().DataFrame(jsonData);
          
          filePath = path.join(tempDir, `file_${timestamp}.xlsx`);
          fs.writeFileSync(filePath, fileBuffer);
        } else {
          const csvContent = typeof fileContents === 'string' ? fileContents : fileContents.toString();
          df = getPolars().readCSV(csvContent, {
            hasHeader: true,
            quoteChar: '"',
          });
          
          filePath = path.join(tempDir, `file_${timestamp}.csv`);
          fs.writeFileSync(filePath, csvContent);
        }

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
