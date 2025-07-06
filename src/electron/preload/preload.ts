// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  handleNewFile: (
    fileContents: string | ArrayBuffer,
    fileName: string,
    selectedSheet?: string
  ) =>
    ipcRenderer.invoke("handleNewFile", fileContents, fileName, selectedSheet),
  returnSelectedColumns: (filePath: string, columnMapping: any) =>
    ipcRenderer.invoke("returnSelectedColumns", filePath, columnMapping),
  getColumnPreview: (filePath: string, columnName: string) =>
    ipcRenderer.invoke("getColumnPreview", filePath, columnName),
  validateColumn: (
    filePath: string,
    columnName: string,
    columnType: "identifier" | "date"
  ) => ipcRenderer.invoke("validateColumn", filePath, columnName, columnType),
  getRecentFiles: () => ipcRenderer.invoke("getRecentFiles"),
  addRecentFile: (fileInfo: { path: string; name: string; size: number }) =>
    ipcRenderer.invoke("addRecentFile", fileInfo),
  removeRecentFile: (filePath: string) =>
    ipcRenderer.invoke("removeRecentFile", filePath),
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke("checkFileExists", filePath),
  readLocalFile: (filePath: string) =>
    ipcRenderer.invoke("readLocalFile", filePath),
  readLocalBinaryFile: (filePath: string) =>
    ipcRenderer.invoke("readLocalBinaryFile", filePath),
  saveColumnMapping: (fileName: string, mapping: any) =>
    ipcRenderer.invoke("saveColumnMapping", { fileName, mapping }),
  getColumnMapping: (fileName: string) =>
    ipcRenderer.invoke("getColumnMapping", fileName),
  forPatientIdGetTopProviders: (
    filePath: string,
    patientIdCol: string,
    providerIdCol: string,
    columnMapping?: any
  ) =>
    ipcRenderer.invoke(
      "forPatientIdGetTopProviders",
      filePath,
      patientIdCol,
      providerIdCol,
      columnMapping
    ),
  mapProvidersToPatients: (
    filePath: string,
    providerIdCol: string,
    patientIdCol: string,
    patientFirstNameCol?: string,
    patientLastNameCol?: string,
    patientMiddleNameCol?: string,
    patientDateOfBirthCol?: string,
    patientRaceCol?: string,
    patientGenderCol?: string,
    columnMapping?: any
  ) =>
    ipcRenderer.invoke(
      "mapProvidersToPatients",
      filePath,
      providerIdCol,
      patientIdCol,
      patientFirstNameCol,
      patientLastNameCol,
      patientMiddleNameCol,
      patientDateOfBirthCol,
      patientRaceCol,
      patientGenderCol,
      columnMapping
    ),
});
