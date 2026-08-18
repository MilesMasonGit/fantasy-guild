import { defineConfig } from 'vitest/config'

export default defineConfig({
    // Compile JSX the same way the real build does (the app's Vite config uses
    // @vitejs/plugin-react, which defaults to the automatic runtime). Without
    // this, tests fell back to the classic transform and any component that did
    // not happen to import React by name threw "React is not defined" the
    // moment a test tried to render it.
    esbuild: { jsx: 'automatic' },
    test: {
        // Use jsdom for DOM testing
        environment: 'jsdom',

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
