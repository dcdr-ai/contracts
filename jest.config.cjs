/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 15000,
  setupFiles: ["<rootDir>/jest.env.cjs"],
  moduleFileExtensions: ["ts", "js", "json"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageProvider: "v8",
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results/jest",
        outputName: "junit.xml",
      },
    ],
  ],
  coverageReporters: ["text-summary", "cobertura"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
        diagnostics: true,
      },
    ],
  },
};
