// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Growth from '../systems/board/Growth.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';
import { sameRolls } from './fixtures/rolls.js';

withoutShippedPerks();

/**
 * ⭐ A tree a Forest or an Orchard brings back, worked again and again, ends in the same place in
 * 100 ms steps and in the catch-up's 1000 ms steps, with the Grow Time a Hall star gives (Green
 * Thumb) and without. Each tree here falls (or is picked bare) on every cycle, its cycle is 2.3 s
 * and its growths odd lengths, so the moments things happen fall part-way through a tick: the Oak a
 * Sapling grows into, the Stump an Oak falls to, the fruit coming back. Each is worked only from the
 * moment it stands there, so every felling falls on its true moment, whatever the step.
 */

const CYCLE_MS = 2300;
const STUMP_MS = 20000;
const SAPLING_MS = 15000;
const REST_MS = 9000;
// Green Thumb's stand-in: a guild-wide Grow Time of −25 %, so a 15 s Sapling grows in 11.25 s.
const GREEN_THUMB = { source: 'guild:t693_green_thumb', type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.25 };

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const work = (skill, itemId) => ({
    skill, skillRequired: 1, cycleTimeMs: CYCLE_MS, xp: 1, inputs: [], outputs: [{ itemId, quantity: 1, chance: 100 }]
});
registerTokenTypes({
    rs_forest: plain('rs_forest', 'RS Oak Forest', { tokenType: 'buff' }),
    // One life: every cycle fells it.
    rs_oak: plain('rs_oak', 'RS Oak', {
        uses: 1, requiresHero: true, staysPut: true, respawn: { mode: 'regrow', into: 'rs_stump' }, config: work('forestry', 'fixture_oak_wood')
    }),
    rs_stump: plain('rs_stump', 'RS Oak Stump', { grows: { into: 'rs_sapling', afterMs: STUMP_MS, needsNearby: ['rs_forest'] } }),
    rs_sapling: plain('rs_sapling', 'RS Oak Sapling', { artSize: 'small', grows: { into: 'rs_oak', afterMs: SAPLING_MS } }),
    rs_orchard: plain('rs_orchard', 'RS Orchard', { tokenType: 'buff' }),
    // Picked bare on every cycle, fruiting again after its rest while its Orchard stands.
    rs_apple: plain('rs_apple', 'RS Apple Tree', {
        uses: 1, requiresHero: true, staysPut: true, respawn: { mode: 'refill', afterMs: REST_MS, needsNearby: ['rs_orchard'] },
        config: work('farming', 'fixture_oak_wood')
    })
});

registerEffects({
    rs_grove_feller: {
        id: 'rs_grove_feller', name: 'rs_grove_feller',
        statements: [{
            id: 'stm_rs_grove_feller', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.GROVE_FELLING, bucket: 'flat', value: 100, category: 'forestry' }
        }]
    }
});

const AT = { x: 700, y: 500 };
// A standard Token's art radius is 64: two trees 110 apart touch.
const KIN = { x: AT.x + 110, y: AT.y };
const OWNER = { x: AT.x, y: AT.y + 150 };

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/**
 * A board with a forester (or a farmer) ordered onto the tree at {@link AT}, its owner beside it.
 * `scene`: `oak` (one owned Oak), `grove` (two touching owned Oaks and a Grove Feller) or `apple`
 * (one owned apple tree).
 */
function buildBoard(scene, greenThumb) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    registerSkillPerks({ forestry: { perks: scene === 'grove' ? [{ level: 99, effectId: 'rs_grove_feller' }] : [] } });
    const [hero] = fixtures.makeHeroes(1, { forestry: 99, farming: 99 });
    const owner = fixtures.placeAt(scene === 'apple' ? 'rs_orchard' : 'rs_forest', OWNER.x, OWNER.y);
    const tree = scene === 'apple' ? 'rs_apple' : 'rs_oak';
    BoardState.setTether(fixtures.placeAt(tree, AT.x, AT.y), owner.id);
    if (scene === 'grove') BoardState.setTether(fixtures.placeAt(tree, KIN.x, KIN.y), owner.id);
    if (greenThumb) getGlobalAggregator().addModifier({ ...GREEN_THUMB });
    fixtures.orderAt(hero.id, AT);
    TileModifiers.rebuildAll();
}

const tokenAt = (point) => BoardState.tokens().find(t => t.x === point.x && t.y === point.y) ?? null;

/** What stands at `point` now: its type, clocks and cycle. */
function standing(point) {
    const t = tokenAt(point);
    return t ? { typeId: t.typeId, uses: t.usesRemaining ?? null, clocks: { ...(t.clocks || {}) }, cycleMs: t.cycleElapsedMs || 0 } : null;
}

/** `scene` played for `ms` in `step` steps: the moment of every cycle's end, and how it all stands at the end. */
function played(scene, { step, ms, greenThumb = false }) {
    const rolls = sameRolls();
    buildBoard(scene, greenThumb);
    let now = 0;
    const ends = [];
    const changes = [];
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => ends.push(now - (p.overMs || 0))),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_TRANSFORMED, (p) => changes.push(p.typeId))
    ];
    while (now < ms) {
        now += step;
        GameLoop.runHandlers(step);
    }
    offs.forEach(off => off());
    rolls.mockRestore();
    getGlobalAggregator().removeModifiersBySource(GREEN_THUMB.source);
    return {
        ends, changes, here: standing(AT), kin: scene === 'grove' ? standing(KIN) : null,
        wood: InventoryManager.getItemCount('fixture_oak_wood') + SpriteLayer.countOnBoard('fixture_oak_wood')
    };
}

/** A lap of an Oak: a cycle, its Stump's growth and its Sapling's, at `factor` of their time. */
const oakLap = (factor) => CYCLE_MS + STUMP_MS * factor + SAPLING_MS * factor;
const lapsWithin = (lap, ms) => Array.from({ length: Math.floor((ms - CYCLE_MS) / lap) + 1 }, (_, i) => CYCLE_MS + i * lap);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    getGlobalAggregator().removeModifiersBySource(GREEN_THUMB.source);
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    registerSkillPerks({ forestry: { perks: [] } });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe.each([
    ['without Green Thumb', false, 1],
    ['with Green Thumb', true, 0.75]
])('⭐ an owned Oak felled and regrown again and again, %s', (_label, greenThumb, factor) => {
    const MS = 160_000;

    it('falls at its true moments in 100 ms and in 1000 ms steps, and ends the same', () => {
        const small = played('oak', { step: 100, ms: MS, greenThumb });
        const big = played('oak', { step: 1000, ms: MS, greenThumb });
        const truth = lapsWithin(oakLap(factor), MS);
        expect(truth.length).toBeGreaterThanOrEqual(5);
        expect(small.ends).toEqual(truth);
        expect(big.ends).toEqual(truth);
        expect(big).toEqual(small);
        expect(small.changes.filter(c => c === 'rs_stump')).toHaveLength(truth.length);
    }, 60_000);

    // Never in the tick straight after a felling: a felled Oak rests until the next tick, which turns
    // it to its Stump with the time since it fell, so the two steps meet there.
    it('ends the same stopped part-way through a growth or a cycle', () => {
        for (const ms of [41_000, 76_000, 118_000]) {
            expect(played('oak', { step: 1000, ms, greenThumb })).toEqual(played('oak', { step: 100, ms, greenThumb }));
        }
    }, 60_000);
});

describe.each([
    ['without Green Thumb', false, 1],
    ['with Green Thumb', true, 0.75]
])('an owned apple tree picked bare and fruiting again, %s', (_label, greenThumb, factor) => {
    it('is picked at its true moments in 100 ms and in 1000 ms steps, and ends the same', () => {
        const MS = 70_000;
        const small = played('apple', { step: 100, ms: MS, greenThumb });
        const big = played('apple', { step: 1000, ms: MS, greenThumb });
        const truth = lapsWithin(CYCLE_MS + REST_MS * factor, MS);
        expect(small.ends).toEqual(truth);
        expect(big.ends).toEqual(truth);
        expect(big).toEqual(small);
    }, 60_000);
});

describe('Grove Felling: the touching Oak felled with the worked one', () => {
    it('regrows from the moment it fell, in 100 ms and in 1000 ms steps alike', () => {
        // Stopped while the touching Oak's Stump grows, again while its Sapling does, and once both
        // Oaks stand again.
        for (const ms of [12_000, 30_000, 39_000]) {
            const small = played('grove', { step: 100, ms });
            const big = played('grove', { step: 1000, ms });
            expect(big).toEqual(small);
        }
        const small = played('grove', { step: 100, ms: 30_000 });
        expect(small.kin.typeId).toBe('rs_sapling');
        // Fell at 2.3 s: a Stump for 20 s, then a Sapling 7.7 s grown.
        expect(small.kin.clocks.growMs).toBe(30_000 - CYCLE_MS - STUMP_MS);
    }, 60_000);
});
