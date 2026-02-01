module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  collectCoverageFrom: [
    'src/services/compliance/**/*.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
};
