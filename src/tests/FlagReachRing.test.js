// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { pixelRingCells, pixelRingPath } from '../ui/components/board/pixelRing.js';

/**
 * A reach ring is drawn in whole art pixels (`pixelRing.js`). A device whose Mat Tuner stored the
 * old untouched hitbox default (80%) gets the new one; any other stored number is still a choice
 * and is kept. The retired flag radius is no row at all.
 */

describe('the pixel ring', () => {
    it('is one pixel thick: every cell sits within half a pixel of the radius', () => {
        for (const r of [3, 17, 146]) {
            const cells = pixelRingCells(r);
            for (const [x, y] of cells) {
                expect(Math.abs(Math.hypot(x, y) - r)).toBeLessThanOrEqual(0.5 + 1e-9);
            }
        }
    });

    it('is closed: every cell touches another, a diagonal counting', () => {
        const cells = pixelRingCells(40);
        const has = new Set(cells.map(([x, y]) => `${x},${y}`));
        for (const [x, y] of cells) {
            let touching = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if ((dx || dy) && has.has(`${x + dx},${y + dy}`)) touching++;
                }
            }
            expect(touching).toBeGreaterThanOrEqual(2);
        }
    });

    it('is the same shape all round (eight-way symmetric)', () => {
        const has = new Set(pixelRingCells(25).map(([x, y]) => `${x},${y}`));
        for (const key of has) {
            const [x, y] = key.split(',').map(Number);
            for (const [a, b] of [[-x, y], [x, -y], [y, x], [-y, -x]]) expect(has.has(`${a},${b}`)).toBe(true);
        }
    });

    it('draws every cell, and nothing else, as whole-pixel rectangles', () => {
        const r = 30;
        const d = pixelRingPath(r);
        const drawn = new Set();
        for (const m of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g)) {
            const [x0, y, len] = [Number(m[1]), Number(m[2]), Number(m[3])];
            for (let x = x0; x < x0 + len; x++) drawn.add(`${x},${y}`);
        }
        const cells = new Set(pixelRingCells(r).map(([x, y]) => `${x},${y}`));
        expect(drawn).toEqual(cells);
        // Merged runs: far fewer rectangles than cells.
        expect((d.match(/M/g) || []).length).toBeLessThan(cells.size);
    });
});

describe('the hitbox ships at its new default', () => {
    const TUNING_KEY = 'fantasy_guild_mat_tuning';

    async function loadWith(stored) {
        vi.resetModules();
        vi.stubEnv('DEV', true);
        vi.stubEnv('MODE', 'development');
        localStorage.setItem(TUNING_KEY, JSON.stringify(stored));
        return import('../config/matTuning.js');
    }

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('90% hitbox by default', async () => {
        const tuning = await loadWith({});
        expect(tuning.matTuningDefault('hitboxPct')).toBe(90);
    });

    it('the retired flag radius is no longer a tuner row: a stored one is ignored', async () => {
        const tuning = await loadWith({ flagRadius: 300 });
        expect(tuning.MAT_TUNABLES.some(t => t.key === 'flagRadius')).toBe(false);
        expect(tuning.matTuning('flagRadius')).toBeUndefined();
        expect(tuning.isMatTuned()).toBe(false);
    });

    it('a stored old default (80%) gives way to the new one', async () => {
        const tuning = await loadWith({ hitboxPct: 80, nearRadius: 164 });
        expect(tuning.matTuning('hitboxPct')).toBe(90);
        expect(tuning.matTuning('nearRadius')).toBe(164);
        expect(tuning.isMatTuned()).toBe(false);
    });

    it('any other stored number is a choice, and stays', async () => {
        const tuning = await loadWith({ hitboxPct: 70 });
        expect(tuning.matTuning('hitboxPct')).toBe(70);
    });
});
