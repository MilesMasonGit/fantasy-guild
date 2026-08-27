import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * CR2-193 — the roster cap must be computed in exactly ONE place.
 *
 * Two places used to work it out independently: `GuildUpgradeManager.recompute`,
 * which writes `progress.rosterLimit`, and `HeroLifecycle.getRosterLimit`'s
 * fallback for a save that has no `rosterLimit` yet. The fallback read the bare
 * `roster_size` rank and left `ROSTER_BASE` out, so the two answers differed by
 * the whole base — and `isRosterFull()` then refused a recruit the player had
 * already paid for.
 *
 * ROSTER_BASE is 0 today, which hides the divergence behind arithmetic that
 * happens to agree. Comparing the two numbers would therefore pass whether or
 * not the bug is present, and prove nothing. So this replaces the shared
 * definition with a sentinel instead: if either path ever goes back to doing its
 * own arithmetic, that path stops returning the sentinel and this fails.
 */
const SENTINEL = 4242;

vi.mock('../config/guildUpgrades.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, rosterLimitForRank: vi.fn(() => SENTINEL) };
});

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const { GameState } = await import('../state/GameState.js');
const { GuildUpgradeManager } = await import('../systems/progression/GuildUpgradeManager.js');
const { getRosterLimit, isRosterFull } =
    await import('../systems/hero/logic/HeroLifecycle.js');
const { ROSTER_BASE, rosterLimitForRank, getUpgradeDef } =
    await import('../config/guildUpgrades.js');

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = { roster_size: 3 };
});

describe('Roster cap has one definition', () => {
    it('GuildUpgradeManager derives progress.rosterLimit from the shared function', () => {
        GuildUpgradeManager.recompute();
        expect(GameState.state.progress.rosterLimit).toBe(SENTINEL);
    });

    it('HeroLifecycle falls back through the same shared function', () => {
        delete GameState.state.progress.rosterLimit;
        expect(getRosterLimit()).toBe(SENTINEL);
    });

    it('the written cap and the fallback agree, so recruiting is not refused', () => {
        GuildUpgradeManager.recompute();
        const written = GameState.state.progress.rosterLimit;
        delete GameState.state.progress.rosterLimit;
        expect(getRosterLimit()).toBe(written);

        // One hero on a roster of SENTINEL is not full, by either route.
        GameState.state.heroes = [{ id: 'h1', name: 'Existing' }];
        expect(isRosterFull()).toBe(false);
    });
});

describe('Roster cap arithmetic (D-251: the cap is 12)', () => {
    it('ROSTER_BASE plus the roster_size track maxRank is 12', () => {
        expect(ROSTER_BASE + getUpgradeDef('roster_size').maxRank).toBe(12);
    });

    it('the real shared function is base + rank', async () => {
        const real = await vi.importActual('../config/guildUpgrades.js');
        expect(real.rosterLimitForRank(0)).toBe(real.ROSTER_BASE);
        expect(real.rosterLimitForRank(7)).toBe(real.ROSTER_BASE + 7);
        expect(real.rosterLimitForRank(undefined)).toBe(real.ROSTER_BASE);
        // The mock above must actually be a mock, or the sentinel tests are vacuous.
        expect(rosterLimitForRank(1)).toBe(SENTINEL);
    });
});
