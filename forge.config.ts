import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Unpack native modules which can't run from inside asar
      unpack:
        "**/node_modules/{nodejs-polars,nodejs-polars-*}/**/*.{node,so,dll}",
    },
    icon: "src/assets/icon",
    extraResource: [
      // Include only the nodejs-polars modules that actually exist
      "node_modules/nodejs-polars",
      "node_modules/nodejs-polars-darwin-arm64",
    ],
    // Define specific patterns to exclude from the package
    ignore: [
      // Exclude source files (they are compiled into .vite)
      /^\/src\//,

      // Exclude development and config files
      /\.(eslintrc|gitignore|prettierrc)/,
      /^\/tsconfig/,
      /^\/tailwind/,
      /^\/vite\..*\.config\.ts/,
      /^\/postcss/,
      /^\/scripts/,
      /^\/\.git/,
      /^\/\.vscode/,
      /^\/components\.json/,
      /^\/example_data\.csv/,

      // Exclude test files
      /^\/src\/__tests__/,
      /\.test\./,
      /jest\.config\.js/,

      // Standard node_modules patterns
      /node_modules\/\.bin/,

      // Exclude unnecessary node_modules (dev dependencies)
      /node_modules\/@types/,
      /node_modules\/@typescript-eslint/,
      /node_modules\/eslint/,
      /node_modules\/eslint-plugin-.*/,
      /node_modules\/jest/,
      /node_modules\/ts-jest/,
      /node_modules\/jest-.*\//,
      /node_modules\/@jest/,
      /node_modules\/@faker-js/,

      // Exclude documentation files in all node_modules
      /node_modules\/.*\/docs\//,
      /node_modules\/.*\/documentation\//,
      /node_modules\/.*\/example\//,
      /node_modules\/.*\/examples\//,
      /node_modules\/.*\/test\//,
      /node_modules\/.*\/tests\//,

      // Note: we avoid excluding nodejs-polars and electron
      // We also need to keep all @radix-ui components since they're used in the UI
    ],
  },
  rebuildConfig: {
    // Force rebuild of nodejs-polars for the Electron runtime
    onlyModules: ["nodejs-polars"],
    // Ensure our target electron version is used
    force: true,
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({
      // Configure for nodejs-polars - only include modules that exist
      modules: ["nodejs-polars", "nodejs-polars-darwin-arm64"],
    }),
    new VitePlugin({
      build: [
        {
          entry: "src/electron/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/electron/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window", // This must match the path in main.ts
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
