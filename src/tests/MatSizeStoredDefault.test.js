// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The Mat Tuner stores every row once it has been opened, touched or not, so a dev device that ever
 * opened it holds the old mat width (11 steps). That number is read as the old untouched default,
 * not a choice: the device gets the game's 12 × 6.5 mat, not 11 steps at the new shape. Any other
 * stored width is still a choice and is kept.
 */

const TUNING_KEY = 'fantasy_guild_mat_tuning';

async function loadWith(stored) {
    vi.resetModules();
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    localStorage.setItem(TUNING_KEY, JSON.stringify(stored));
    return {
        tuning: await import('../config/matTuning.js'),
        geometry: await import('../config/matGeometry.js')
    };
}

afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('a dev device that stored the old mat width', () => {
    it('a stored 11 steps loads as the game’s 12: 1920 × 1040', async () => {
        const { tuning, geometry } = await loadWith({ matSteps: 11, nearRadius: 164 });
        expect(geometry.matSteps()).toBe(12);
        expect([geometry.matW(), geometry.matH()]).toEqual([1920, 1040]);
        expect(tuning.isMatTuned()).toBe(false);
    });

    it('any other stored width is a choice, and stays', async () => {
        const { geometry } = await loadWith({ matSteps: 14 });
        expect(geometry.matSteps()).toBe(14);
        expect(geometry.matH()).toBe(Math.round(14 * 160 * 13 / 24));
    });
});
