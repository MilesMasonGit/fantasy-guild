import { describe, it, expect } from 'vitest';
import { sourceCode } from './fixtures/sourceScan.js';

/**
 * A rule that compares two moments (an effect's expiry, loot's age, a rate window) reads the game
 * clock (`GameClock.now()`), never `Date.now()`: during a catch-up the wall clock moves ~22 s while
 * 24 hours play. The wall clock stays for what is genuinely real time. Each allowed file says why;
 * a new `Date.now()` in the engine must be added here with its reason, or moved to the game clock.
 */
const ALLOWED = {
    'systems/core/GameClock.js': [1, 'the game clock itself: live, it is the wall clock'],
    'systems/core/CatchUp.js': [2, 'the real time now: how long the game was away, or when a gap began'],
    'systems/core/SaveManager.js': [1, 'an imported save without a stamp is stamped now'],
    'systems/core/TimeManager.js': [1, 'when the player paused'],
    'systems/core/EngineBootstrap.js': [1, 'the last tick\'s real time, written into the save'],
    'systems/core/EventBus.js': [1, 'the console event log'],
    'systems/core/NotificationSystem.js': [3, 'toasts are on screen in real time'],
    'systems/board/BoardState.js': [1, 'Token ids'],
    'systems/board/SpriteLayer.js': [1, 'loot ids'],
    'systems/board/Placement.js': [1, 'a placed Token\'s birth stamp, read by nothing that decides anything'],
    'systems/board/Shop.js': [1, 'a bought Token\'s birth stamp, read by nothing that decides anything'],
    'systems/board/TokenGlows.js': [1, 'glows are drawing, never saved'],
    'systems/effects/statements.js': [1, 'statement ids'],
    'systems/hero/HeroGenerator.js': [1, 'a hero\'s recruitment stamp'],
    'systems/quests/questBounties.js': [1, 'quest ids']
};

function wallClockReads() {
    const out = {};
    for (const { file, code } of sourceCode()) {
        if (!file.startsWith('systems/')) continue;
        const n = (code.match(/\bDate\.now\b/g) || []).length;
        if (n) out[file] = n;
    }
    return out;
}

describe('the engine\'s rules read the game clock', () => {
    it('src/systems reads Date.now() only in the allow-listed files', () => {
        const allowed = Object.fromEntries(Object.entries(ALLOWED).map(([file, [n]]) => [file, n]));
        expect(wallClockReads()).toEqual(allowed);
    });
});
