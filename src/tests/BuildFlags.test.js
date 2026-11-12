import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The QA panel ships in the owner's test builds and never in a release (owner, 2026-11-12): on in
 * dev and in a plain `vite build`, off in `vite build --mode ship`, and off in the perf build,
 * which keeps its own gates.
 */

async function qaToolsAs(mode) {
    vi.resetModules();
    vi.stubEnv('DEV', mode === 'development');
    vi.stubEnv('PROD', mode !== 'development');
    vi.stubEnv('MODE', mode);
    return (await import('../config/buildFlags.js')).QA_TOOLS;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('QA_TOOLS', () => {
    it.each([
        ['development', true],
        ['production', true],
        ['ship', false],
        ['perf', false]
    ])('is %s: %s', async (mode, expected) => {
        expect(await qaToolsAs(mode)).toBe(expected);
    });
});
