import { defineConfig } from 'vitest/config'

export default defineConfig({
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
