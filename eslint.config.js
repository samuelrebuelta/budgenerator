import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const entityInternals = {
  group: ['@/entities/*/*'],
  message: 'Importa la entidad desde su API pública (@/entities/<nombre>).',
}
const otherPages = {
  group: ['@/pages/*'],
  message: 'Una página no importa otra: mueve el código compartido a entities, features o shared.',
}
const upperLayers = (layers) => ({
  group: layers.map((layer) => `@/${layer}/*`),
  message: 'Respeta las capas FSD: una capa solo importa capas inferiores (docs/architecture.md).',
})
const arbitraryColor = {
  selector: 'Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/], TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}\\]/]',
  message: 'Usa los tokens de color del @theme (bg-surface, text-ink-muted…) en lugar de hex.',
}

export default defineConfig([
  globalIgnores(['dist', 'functions/lib', 'test-artifacts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [entityInternals] }] },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [entityInternals, otherPages] }] },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [upperLayers(['entities', 'features', 'pages', 'app'])] },
      ],
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [upperLayers(['features', 'pages', 'app'])] }],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [entityInternals, upperLayers(['pages', 'app'])] }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', arbitraryColor] },
  },
  {
    // @bg/domain stays portable (web, React Native and Functions): no web alias, UI or SDKs.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*', 'react', 'react-*', 'firebase', 'firebase/*', 'zustand', 'zustand/*'],
              message: '@bg/domain es TypeScript puro: sin alias de la web, UI, Firebase ni stores.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'tests/**/*.ts',
      'packages/*/tests/**/*.ts',
      'packages/*/*.config.ts',
      'scripts/**/*.{js,mjs}',
      '*.config.{js,ts}',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
])
