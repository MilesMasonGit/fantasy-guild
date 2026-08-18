// ESLint flat config for the GAME project (src/). The CMS app has its own
// config at cms/eslint.config.js and is deliberately excluded here.
//
// Philosophy: this linter exists to surface *real problems* — dead bindings,
// unreachable code, undefined references, React hook mistakes. It deliberately
// enables NO stylistic rules (quotes, semicolons, indentation, spacing).
// The codebase is ~233 files of pre-existing, internally consistent style;
// a report full of formatting complaints would bury the findings that matter.
//
// Run with:  npm run lint
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        // Build output, dependencies, the separate CMS app (own config),
        // and archived code that is kept for reference only.
        ignores: [
            'dist/**',
            'node_modules/**',
            'cms/**',
            'archive/**',
            'src-tauri/**',
            'public/**',
        ],
    },

    // ---- Game source: browser + ES modules + JSX ----
    {
        files: ['**/*.{js,jsx}'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            // --- Rules that catch real bugs (kept on, at error) ---
            // js.configs.recommended already gives us: no-undef, no-unreachable,
            // no-dupe-keys, no-dupe-args, no-const-assign, no-cond-assign,
            // no-fallthrough, no-self-assign, valid-typeof, use-isnan, etc.

            // Unused variables and imports: the single most useful signal for
            // dead code. Args are only reported after the last used one, and
            // a leading underscore marks a deliberate throwaway.
            'no-unused-vars': ['error', {
                args: 'after-used',
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'none', // `catch (e) {}` with unused e is idiomatic here
                ignoreRestSiblings: true,
            }],

            // React hooks correctness — wrong hook order / conditional hooks are
            // genuine runtime bugs.
            'react-hooks/rules-of-hooks': 'error',
            // Dependency arrays: warn, not error. Some omissions in this codebase
            // are deliberate (run-once effects); worth reading, not worth blocking.
            'react-hooks/exhaustive-deps': 'warn',

            // --- Deliberately OFF, with reasons ---

            // The engine layer logs to console on purpose (there is a logger
            // wrapper, but direct console use is widespread and intentional).
            'no-console': 'off',

            // `debugger` should never ship; keep it as an error.
            'no-debugger': 'error',

            // Empty blocks appear in defensive try/catch throughout; low signal.
            'no-empty': ['error', { allowEmptyCatch: true }],

            // NOTE: no stylistic rules on purpose — see header comment.
        },
    },

    // ---- Tests: vitest globals ----
    {
        files: ['src/tests/**/*.{js,jsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                vi: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                suite: 'readonly',
            },
        },
    },

    // ---- Node-side scripts and config files ----
    {
        files: ['tools/**/*.mjs', 'scripts/**/*.{js,mjs}', '*.config.js', '*.config.mjs'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
