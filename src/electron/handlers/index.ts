import { registerFileHandlers } from "./file-handlers";
import { registerAnalyticsHandlers } from "./analytics-handlers";
import { registerDataHandlers } from "./data-handlers";
import { registerColumnMappingHandlers } from "./column-mapping-handlers";

/**
 * IPC handlers
 */
export function registerAllHandlers() {
  registerFileHandlers();
  registerDataHandlers();
  registerColumnMappingHandlers();
  registerAnalyticsHandlers();
}
