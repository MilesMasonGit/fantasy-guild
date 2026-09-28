// Vitest config for the micro-benchmarks only: node environment (never jsdom),
// and nothing but bench/micro. The game's test suite (vitest.config.js) only
// includes src/**, so these are never run as tests.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
    root,
    test: {
        environment: 'node',
        include: [],
        benchmark: { include: ['bench/micro/**/*.bench.js'] }
    }
});
