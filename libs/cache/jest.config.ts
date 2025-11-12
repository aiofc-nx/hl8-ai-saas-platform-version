import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve(process.cwd(), "package.json"));

export default {
  displayName: "@hl8/config",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@anchan828/nest-redlock$": "<rootDir>/src/testing/redlock.mock.ts",
    "^@anchan828/nest-redlock/dist/cjs/redlock.service.js$":
      "<rootDir>/src/testing/redlock.mock.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@anchan828/nest-redlock|redlock)/)",
  ],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/libs/config",
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js"],
  passWithNoTests: true,
};
