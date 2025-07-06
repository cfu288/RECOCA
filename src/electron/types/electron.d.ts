declare interface File {
  /**
   * The file's path on the local filesystem.
   */
  readonly path: string;
}

import type { ElectronAPI } from "../../core/types/index";

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
