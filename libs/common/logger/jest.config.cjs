module.exports = {
  displayName: "@hl8/logger",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
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
  testMatch: [
    "<rootDir>/src/**/*.spec.ts",
    "<rootDir>/test/**/*.spec.ts",
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 23,
      lines: 25,
      statements: 24,
    },
  },
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
};
