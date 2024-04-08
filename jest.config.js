import { readFileSync } from 'node:fs';

const swcrc = JSON.parse(readFileSync('.swcrc', 'utf-8'));

export default {
  verbose: true,
  collectCoverage: !!process.env.CI,
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: [
    '/coverage',
    '/node_modules/',
    '__tests__',
  ],
  coverageDirectory: './coverage',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['@swc/jest', swcrc],
  },
};
