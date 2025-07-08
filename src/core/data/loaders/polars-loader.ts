import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { type pl } from "nodejs-polars";

interface LoadingStrategy {
  name: string;
  execute(): any;
}

interface LoadingResult {
  success: boolean;
  polars?: any;
  error?: Error;
  strategy?: string;
}

/**
 * Strategy 1: Standard require()
 */
class StandardLoadingStrategy implements LoadingStrategy {
  name = "standard";

  execute() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pl = require("nodejs-polars");
    pl.DataFrame({ test: [1, 2, 3] });
    console.log("Successfully loaded nodejs-polars via standard require");
    return pl;
  }
}

/**
 * Strategy 2: Electron packaging structures
 */
class PathManipulationStrategy implements LoadingStrategy {
  name = "path-manipulation";

  execute() {
    if (!app.isPackaged) {
      throw new Error("Path manipulation strategy only for packaged apps");
    }

    console.log("Attempting to load nodejs-polars in production environment");
    console.log("App path:", app.getAppPath());
    console.log("Resources path:", process.resourcesPath);

    const possiblePaths = this.getPossibleNativeModulePaths();
    console.log("Searching for nodejs-polars in these paths:", possiblePaths);

    this.updateModulePaths(possiblePaths);

    delete require.cache[require.resolve("nodejs-polars")];
    console.log("Module search paths:", module.paths);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pl = require("nodejs-polars");
    pl.DataFrame({ test: [1, 2, 3] });
    console.log(
      "Successfully loaded nodejs-polars after updating module paths"
    );
    return pl;
  }

  private getPossibleNativeModulePaths(): string[] {
    const platform = process.platform;
    const arch = process.arch;

    const paths = [
      path.join(process.cwd(), "node_modules"),
      path.join(process.resourcesPath, "node_modules"),
      path.join(app.getAppPath(), "node_modules"),
      path.join(path.dirname(app.getAppPath()), "node_modules"),
      path.join(app.getAppPath(), "..", "app.asar.unpacked", "node_modules"),
      process.resourcesPath,
    ];

    const modulePatterns = [
      `nodejs-polars`,
      `nodejs-polars-${platform}-${arch}`,
    ];

    const possiblePaths = [];
    for (const basePath of paths) {
      for (const pattern of modulePatterns) {
        possiblePaths.push(path.join(basePath, pattern));
      }
    }

    return possiblePaths;
  }

  private updateModulePaths(possiblePaths: string[]): void {
    const foundModules = new Map();

    for (const modulePath of possiblePaths) {
      if (fs.existsSync(modulePath)) {
        const stats = fs.statSync(modulePath);

        if (stats.isDirectory()) {
          console.log(`Found nodejs-polars directory: ${modulePath}`);

          module.paths.unshift(modulePath);
          foundModules.set(modulePath, true);

          const parentNodeModules = path.dirname(modulePath);
          if (path.basename(parentNodeModules) === "node_modules") {
            module.paths.unshift(parentNodeModules);
            foundModules.set(parentNodeModules, true);
          }
        }
      }
    }
  }
}

/**
 * Strategy 3: Platform-specific module loading
 */
class PlatformSpecificStrategy implements LoadingStrategy {
  name = "platform-specific";

  execute() {
    console.log("Attempting to load platform-specific module directly");

    const platform = process.platform;
    const arch = process.arch;
    const dynamicRequire = Function("return require")();

    let nativeModule;

    if (platform === "darwin" && arch === "arm64") {
      console.log("Loading darwin-arm64 module");
      nativeModule = dynamicRequire("nodejs-polars-darwin-arm64");
    } else if (platform === "win32" && arch === "x64") {
      console.log("Loading win32-x64-msvc module");
      nativeModule = dynamicRequire("nodejs-polars-win32-x64-msvc");
    } else if (platform === "linux" && arch === "x64") {
      console.log("Loading linux-x64-gnu module");
      nativeModule = dynamicRequire("nodejs-polars-linux-x64-gnu");
    } else {
      throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }

    if (!nativeModule) {
      throw new Error("Failed to load platform-specific module");
    }

    console.log("Successfully loaded platform-specific module");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("nodejs-polars");
  }
}

/**
 * I struggled to get nodejs-polars to load, so now we try multiple strategies.
 */
export function loadPolars(): typeof pl {
  const strategies: LoadingStrategy[] = [
    new StandardLoadingStrategy(),
    new PathManipulationStrategy(),
    new PlatformSpecificStrategy(),
  ];

  const errors: Array<{ strategy: string; error: Error }> = [];

  for (const strategy of strategies) {
    try {
      console.log(`Trying ${strategy.name} strategy...`);
      const result = strategy.execute();
      console.log(
        `✓ Successfully loaded nodejs-polars using ${strategy.name} strategy`
      );
      return result as typeof pl;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      errors.push({ strategy: strategy.name, error: errorObj });
      console.log(`✗ ${strategy.name} strategy failed: ${errorObj.message}`);
    }
  }

  // If all strategies fail, throw a comprehensive error
  const errorMessages = errors
    .map(({ strategy, error }) => `${strategy}: ${error.message}`)
    .join("; ");

  throw new Error(
    `Failed to load nodejs-polars using all strategies. Errors: ${errorMessages}`
  );
}
