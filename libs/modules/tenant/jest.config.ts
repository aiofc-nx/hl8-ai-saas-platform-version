import type { Config } from "jest";

const config: Config = {
  displayName: "@hl8/tenant",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@hl8/domain-base$": "<rootDir>/../../core/domain-base/src/index.ts",
    "^@hl8/domain-base/(.*)\\.js$": "<rootDir>/../../core/domain-base/src/$1.ts",
    "^@hl8/domain-base/(.*)$": "<rootDir>/../../core/domain-base/src/$1.ts",
    "^@hl8/application-base$": "<rootDir>/../../core/application-base/src/index.ts",
    "^@hl8/application-base/(.*)\\.js$": "<rootDir>/../../core/application-base/src/$1.ts",
    "^@hl8/application-base/(.*)$": "<rootDir>/../../core/application-base/src/$1.ts",
    "^@hl8/infrastructure-base$": "<rootDir>/../../core/infrastructure-base/src/index.ts",
    "^@hl8/infrastructure-base/(.*)\\.js$": "<rootDir>/../../core/infrastructure-base/src/$1.ts",
    "^@hl8/infrastructure-base/(.*)$": "<rootDir>/../../core/infrastructure-base/src/$1.ts",
    "^@hl8/exceptions$": "<rootDir>/../../common/exceptions/src/index.ts",
    "^@hl8/logger$": "<rootDir>/../../common/logger/src/index.ts",
    "^@hl8/config$": "<rootDir>/../../common/config/src/index.ts",
    "^@hl8/cache$": "<rootDir>/../../cache/src/index.ts",
    "^@hl8/cache/(.*)\\.js$": "<rootDir>/../../cache/src/$1.ts",
    "^@hl8/cache/(.*)$": "<rootDir>/../../cache/src/$1.ts",
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
  coverageDirectory: "../../coverage/libs/tenant",
  coverageProvider: "v8",
  testMatch: ["**/*.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/integration/"],
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js"],
  passWithNoTests: true,
};

export default config;
