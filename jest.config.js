module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest", 
      {
        isolatedModules: true,
        diagnostics: false,
        transpileOnly: true
      }
    ]
  },
  modulePathIgnorePatterns: [
    // Ignore build output directories to prevent module resolution conflicts
    "<rootDir>/out/",
    "<rootDir>/.vite/",
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!nodejs-polars).+\\.js$"
  ],
};
