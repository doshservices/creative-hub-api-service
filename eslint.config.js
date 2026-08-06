// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // creativehub-main is the frontend reference checkout — its own project, own tooling.
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'creativehub-main/**'] },
  js.configs.recommended,
  // Type-aware linting only for the app source, which is the tsconfig's `include`. Root-level
  // config files (this one, vitest.config.ts) aren't part of that program.
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Read config from src/config only — do not access process.env directly elsewhere.',
        },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // vi.fn() mock objects aren't real class instances (no `this` binding to protect), and
    // response.json() from fastify's inject is untyped by design — both are standard, safe
    // patterns in test files that these type-aware rules can't distinguish from real bugs.
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['*.config.ts', '*.config.js'],
    extends: [...tseslint.configs.recommended],
  },
  eslintConfigPrettier,
);
