/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  // pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/)?((jest-)?react-native|@react-native(-community)?|@react-native-firebase|expo(nent)?|@expo(nent)?[/+].*|expo-.*|react-navigation|@react-navigation/.*|@shopify/flash-list|standard-navigation|@formatjs))',
  ],
  // The workspace packages use NodeNext-style `.js` specifiers that point at TypeScript sources.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
