import path from "node:path";
import type { Config } from "jest";

const workspaceRoot = path.resolve();
const libsRoot = path.join(workspaceRoot, "libs");

const config: Config = {
  displayName: "workspace",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: workspaceRoot,
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: path.resolve(workspaceRoot, "tsconfig.base.json"),
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@hl8/logger$": path.resolve(libsRoot, "infra/logger/src/index.ts"),
    "^@hl8/exceptions$": path.resolve(
      libsRoot,
      "infra/exceptions/src/index.ts",
    ),
    "^@hl8/config$": path.resolve(libsRoot, "infra/config/src/index.ts"),
    "^@hl8/cache$": path.resolve(libsRoot, "infra/cache/src/index.ts"),
    "^@hl8/bootstrap$": path.resolve(libsRoot, "infra/bootstrap/src/index.ts"),
    "^@hl8/async-storage$": path.resolve(
      libsRoot,
      "infra/async-storage/src/index.ts",
    ),
    "^@hl8/multi-tenancy$": path.resolve(
      libsRoot,
      "infra/multi-tenancy/src/index.ts",
    ),
    "^@hl8/persistence$": path.resolve(
      libsRoot,
      "infra/persistence/src/index.ts",
    ),
    "^@hl8/persistence-postgres$": path.resolve(
      libsRoot,
      "infra/persistence/postgres/src/index.ts",
    ),
    "^@hl8/persistence-mongo$": path.resolve(
      libsRoot,
      "infra/persistence/mongo/src/index.ts",
    ),
    "^@hl8/user$": path.resolve(libsRoot, "domains/user/src/index.ts"),
    "^@hl8/auth$": path.resolve(libsRoot, "domains/auth/src/index.ts"),
  },
  moduleFileExtensions: ["ts", "js"],
  setupFilesAfterEnv: [path.resolve(workspaceRoot, "jest.setup.js")],
  transformIgnorePatterns: [
    "node_modules/(?!(@hl8|ioredis|class-transformer|class-validator)/)",
  ],
};

export default config;
