// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import S2 from '../../bench/scenarios/s2-realistic.mjs';
import S3 from '../../bench/scenarios/s3-torture.mjs';
import { cap128, camp128, cap240, cap256 } from '../../bench/scenarios/cap.mjs';

/**
 * The bench boards hold what their names and `bench/README.md` say, at the game's spacing: S2 about
 * 106 Tokens with every spawner at its own cap, S3 about 305, the cap boards at their caps, C256 a
 * full mat below its cap with spawners that find no room. Checked as built (the spawners filled),
 * before a tick.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

function build(scenario) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    scenario.build({ fixtures, setMatTuning });
    const tokens = BoardState.tokens();
    const spawners = tokens
        .filter(t => SpawnerSystem.isSpawner(getTokenType(t.typeId)))
        .map(t => SpawnerSystem.spawnerStatus(t.id));
    return { tokens, spawners, counted: MatCap.tokenCount() };
}

/** Pairs of Tokens standing closer than their minimum gap. */
function crowded(tokens) {
    let n = 0;
    for (let i = 0; i < tokens.length; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            const a = tokens[i];
            const b = tokens[j];
            if (Math.hypot(a.x - b.x, a.y - b.y) < MatPlacement.minGap(a.typeId, b.typeId) - 0.01) n++;
        }
    }
    return n;
}

describe('the bench boards at 128 u apart', () => {
    it('S2: about 106 Tokens, every spawner at its own cap', () => {
        const { tokens, spawners } = build(S2);
        expect(tokens.length).toBeGreaterThanOrEqual(104);
        expect(spawners).toHaveLength(8);
        expect(spawners.every(s => s.state === 'at_cap')).toBe(true);
        expect(crowded(tokens)).toBe(0);
    });

    it('S3: about 305 Tokens on the largest mat, one Quarry squeezed out of room', () => {
        const { tokens, spawners } = build(S3);
        expect(tokens.length).toBeGreaterThanOrEqual(300);
        expect(spawners.filter(s => s.count < s.cap).length).toBeLessThanOrEqual(2);
        expect(crowded(tokens)).toBe(0);
    });

    it.each([['cap128', cap128, 128], ['camp128', camp128, 153], ['C240', cap240, 240]])('%s reaches its cap', (_, scenario, cap) => {
        const { tokens, counted } = build(scenario);
        expect(counted).toBe(cap);
        expect(crowded(tokens)).toBe(0);
    });

    it('C256: the mat fills before the cap, and the spawners it has no clearing for find no room', () => {
        const { tokens, spawners, counted } = build(cap256);
        expect(counted).toBeGreaterThanOrEqual(240);
        expect(counted).toBeLessThan(256);
        expect(spawners.filter(s => s.state === 'no_room').length).toBeGreaterThanOrEqual(3);
        expect(crowded(tokens)).toBe(0);
    });
});
