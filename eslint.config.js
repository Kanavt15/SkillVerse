/**
 * ESLint flat config for the whole monorepo.
 *
 * Besides style, several rules here are SECURITY rules:
 *   - `no-restricted-syntax` bans `sql.raw(...)`: raw SQL skips parameter
 *     binding and is the classic SQL-injection path. Use Drizzle's query
 *     builder or the tagged `sql\`...\`` template, which binds parameters.
 *   - `react/no-danger`-style ban on `dangerouslySetInnerHTML` outside the
 *     sanitised Markdown component, to prevent stored XSS.
 *   - `no-eval` / `no-implied-eval` / `no-new-func`.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.wrangler/**',
      '**/.react-router/**',
      '**/coverage/**',
      '**/worker-configuration.d.ts',
      'packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Allowed only for augmenting ambient types (e.g. `namespace Cloudflare { interface Env }`).
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message:
            'sql.raw() bypasses parameter binding (SQL injection risk). Use the sql`` template.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'Raw HTML is banned (XSS risk). Render user content with the <SafeMarkdown> component.',
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Node scripts may log freely; they are developer tools, not app code.
    files: ['**/scripts/**/*.mjs', '**/seed/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
