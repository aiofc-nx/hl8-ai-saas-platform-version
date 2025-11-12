import type { Config } from "jest";

const config: Config = {
  displayName: "@hl8/application-base",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@hl8/exceptions$": "<rootDir>/../../common/exceptions/src/index.ts",
    "^@hl8/logger$": "<rootDir>/../../common/logger/src/index.ts",
    "^@hl8/config$": "<rootDir>/../../common/config/src/index.ts",
    "^@hl8/cache$": "<rootDir>/../../cache/src/index.ts",
    "^@hl8/bootstrap$": "<rootDir>/../../bootstrap/src/index.ts",
    "^@hl8/mikro-orm-nestjs$": "<rootDir>/../../mikro-orm-nestjs/src/index.ts",
    "^@hl8/async-storage$": "<rootDir>/../../async-storage/src/index.ts",
    "^@hl8/swagger$": "<rootDir>/../../common/swagger/src/index.ts",
    "^@hl8/multi-tenancy$": "<rootDir>/../../multi-tenancy/src/index.ts",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.json",
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/libs/application-base",
  coverageProvider: "v8",
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js"],
  passWithNoTests: true,
};

export default config;
