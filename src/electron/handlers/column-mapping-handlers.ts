import { ipcMain } from "electron";
import {
  saveColumnMapping,
  getColumnMapping,
} from "../../features/file-upload/services/file-manager";

/**
 * Register column mapping related IPC handlers
 */
export function registerColumnMappingHandlers() {
  ipcMain.handle("saveColumnMapping", (_, { fileName, mapping }) => {
    return saveColumnMapping(fileName, mapping);
  });

  ipcMain.handle("getColumnMapping", (_, fileName) => {
    return getColumnMapping(fileName);
  });
}
