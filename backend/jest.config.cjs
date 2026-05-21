/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // Long-running pool keeps tests fast but Jest needs forceExit so it
  // doesn't hang on the singleton pg pool.
  forceExit: true,
  testTimeout: 20000,
  // Quieter output — Express's morgan dev format is noisy
  verbose: true
};
