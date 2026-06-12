/** Standalone Jest config for Content Cop / compliance unit tests (avoids broken root @nx/jest config). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  /** Single worker: lowers peak RSS when Prisma + ts-jest compile the graph. */
  maxWorkers: 1,
  rootDir: __dirname,
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/compliance/**/*.spec.ts',
  ],
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.base.json',
      },
    ],
  },
  collectCoverageFrom: [
    'libraries/nestjs-libraries/src/compliance/**/*.ts',
    '!**/*.spec.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
