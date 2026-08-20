import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Absolute, forward-slashed path to a package in the ROOT node_modules. */
const rootModule = (name) =>
    fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url)).split('\\').join('/');

export default defineConfig({
    // Compile JSX the same way the real build does (the app's Vite config uses
    // @vitejs/plugin-react, which defaults to the automatic runtime). Without
    // this, tests fell back to the classic transform and any component that did
    // not happen to import React by name threw "React is not defined" the
    // moment a test tried to render it.
    esbuild: { jsx: 'automatic' },

    // The CMS is a second Vite app with its own `node_modules`, so a component
    // under `cms/src` resolves `react` to `cms/node_modules/react` while the
    // test's `react-dom` comes from the root. Two React copies means two hook
    // dispatchers, and every CMS component threw "Cannot read properties of
    // null (reading 'useCallback')" on render. Deduping pins both apps to one
    // React for the duration of a test run.
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: [
            { find: /^react$/, replacement: rootModule('react') },
            { find: /^react\/(.*)$/, replacement: `${rootModule('react')}/$1` },
            { find: /^react-dom$/, replacement: rootModule('react-dom') },
            { find: /^react-dom\/(.*)$/, replacement: `${rootModule('react-dom')}/$1` },
            // Same problem, one level out: `cms/node_modules/lucide-react` is
            // pre-bundled and pulls React in itself, so it cannot be re-pointed
            // by the rules above. Both apps use lucide for icons, so tests run
            // the game's copy for both. Icons are presentational — nothing this
            // suite asserts depends on which version drew them.
            { find: /^lucide-react$/, replacement: rootModule('lucide-react') }
        ]
    },

    test: {
        // Use jsdom for DOM testing
        environment: 'jsdom',

        // `zustand` lives only in `cms/node_modules`, and an externalised
        // dependency is loaded by Node directly — which bypasses the alias
        // above and drags `cms/node_modules/react` in with it. Inlining it
        // routes it through Vite so it shares the one React.
        server: { deps: { inline: [/zustand/, /lucide-react/] } },

        // Test file patterns
        include: ['src/**/*.{test,spec}.{js,mjs}'],

        // Global test setup
        globals: true,

        // Coverage configuration (optional)
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/**',
                'src/tests/**',
                '*.config.js'
            ]
        }
    }
})
