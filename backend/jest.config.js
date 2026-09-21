/** Jest configuration for the SkillVerse backend. */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'controllers/**/*.js',
        'services/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'utils/**/*.js',
    ],
    // Surface open handles (unclosed Mongo/Redis connections) instead of hanging.
    detectOpenHandles: true,
    forceExit: true,
    testTimeout: 15000,
};
