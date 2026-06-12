/** Standalone Jest config for HarmonizeAdapter unit tests (avoids broken root @nx/jest config). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: 1,
  rootDir: __dirname,
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/templates/stages/harmonize.adapter.spec.ts',
  ],
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.base.json',
      },
    ],
  },
};
