import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Laboratories from '../systems/board/Laboratories.js';
import * as Summons from '../systems/board/Summons.js';
import * as Mastery from '../systems/progression/Mastery.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { LABORATORY_KIND } from '../config/registries/mastery.js';
import { resetMatTuning } from '../config/matTuning.js';
import { t } from '../i18n/index.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Science (brief 810 K6) beside Summoned workers (K5) and Faith's Echo (K3). Studying is work, not
 * fighting, so a Summoned worker may study, but only at its own skills (one with Science, at the
 * node's gathering level), and each study spends one of its charges as any cycle does. An Echo at
 * a Laboratory repeats the study: a second mastery point and no second wear on the node, and no
 * second charge from its Summoned worker.
 */

const ORE = 'fixture_sj6_ore';
const YIELD_FX = 'fixture_sj6_yield';
const LAB = 'fixture_sj6_lab';
const VEIN = 'fixture_sj6_vein';
const ECHO = 'fixture_sj6_echo';
const CIRCLE = 'fixture_sj6_circle';
const SCHOLAR = 'fixture_sj6_scholar';
const DULL_SCHOLAR = 'fixture_sj6_dull_scholar';
const MINER = 'fixture_sj6_miner';

const STUDY_MS = 2000;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerItems({
        [ORE]: { id: ORE, name: 'SJ6 Ore', type: 'material', sprite: 'i_wheat', stackable: true, value: 1 }
    });
    registerEffects({
        [YIELD_FX]: {
            id: YIELD_FX, name: YIELD_FX,
            statements: [{ id: `stm_${YIELD_FX}`, keyword: KEYWORD.PROVIDES, to: null, reach: 'self', payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.5 } }]
        }
    });
    const summon = (id, skills) => ({ id, name: id, rarity: 'common', theme: 'fixture', sprite: 's_occult', summon: { of: VEIN, skills } });
    registerTokenTypes({
        [LAB]: {
            id: LAB, name: 'SJ6 Laboratory', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
            requiresHero: true, laboratory: { maxLevel: 20 },
            config: { skill: 'science', skillRequired: 1, cycleTimeMs: STUDY_MS, xp: 3, inputs: [], outputs: [] },
            statements: [{ id: 'stm_sj6_lab_works', keyword: KEYWORD.STATION, payload: { skill: 'science', stationKind: LABORATORY_KIND } }]
        },
        // A node that runs out by count, not by chance: each wear is one charge, so wear can be counted.
        [VEIN]: {
            id: VEIN, name: 'SJ6 Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_ore_vein_copper',
            requiresHero: true, uses: 20,
            config: { skill: 'mining', skillRequired: 5, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
            mastery: { ranks: [{ points: 100, effectId: YIELD_FX, scale: 1 }] }
        },
        [ECHO]: {
            id: ECHO, name: 'SJ6 Echo', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
            statements: [{ id: 'stm_sj6_echo', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 100 } }]
        },
        [CIRCLE]: {
            id: CIRCLE, name: 'SJ6 Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
            summonCircle: { charges: 10, perLevel: 0 },
            config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
            statements: [{ id: 'stm_sj6_circle_station', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
        },
        [SCHOLAR]: summon(SCHOLAR, { science: 30 }),
        [DULL_SCHOLAR]: summon(DULL_SCHOLAR, { science: 2 }),
        [MINER]: summon(MINER, { mining: 30 })
    });
});

const LAB_AT = { x: 800, y: 500 };
const NODE_AT = { x: 960, y: 500 };
const ECHO_AT = { x: 800, y: 660 };
const CIRCLE_AT = { x: 300, y: 900 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
    Mastery.apply();
});

/** A Laboratory set to study a vein in its reach, an Echo beside it when asked. */
function laboratory({ echo = false } = {}) {
    const lab = fixtures.placeAt(LAB, LAB_AT.x, LAB_AT.y);
    const vein = fixtures.placeAt(VEIN, NODE_AT.x, NODE_AT.y);
    if (echo) fixtures.placeAt(ECHO, ECHO_AT.x, ECHO_AT.y);
    TileModifiers.rebuildAll();
    expect(Laboratories.setTarget(lab, vein.id)).toBe(true);
    return { lab, vein };
}

/** A Summoned worker of `kind`, called by a Circle (its summoner a hero) and holding `charges`. */
function summoned(kind, charges = 10) {
    const [summoner] = fixtures.makeHeroes(1, { summoning: 10 });
    const circle = fixtures.placeAt(CIRCLE, CIRCLE_AT.x, CIRCLE_AT.y);
    const record = Summons.chargeFromCircle(circle, kind, summoner.id);
    expect(record).toBeTruthy();
    record.summon.charges = charges;
    return record;
}

/** Run until `heroId` has finished `n` cycles at `instanceId`, a study's point heard each. */
function studiesBy(heroId, instanceId, n, limitMs = 20_000) {
    const done = [];
    const studied = [];
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.heroId === heroId && p.instanceId === instanceId) done.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.STUDIED, (p) => { if (p.instanceId === instanceId) studied.push(p); })
    ];
    for (let ms = 0; ms < limitMs && done.length < n; ms += 100) step(100);
    offs.forEach(off => off());
    return { done, studied };
}

describe('⭐ a Summoned worker with Science studies: it is work, never a fight', () => {
    it('⭐ each study gives a point and wears the node once, and spends one charge; it learns no Science', () => {
        const { lab, vein } = laboratory();
        const scholar = summoned(SCHOLAR);
        expect(fixtures.orderAt(scholar.id, LAB_AT).success).toBe(true);
        const xp = scholar.skills.science.xp;
        const { done, studied } = studiesBy(scholar.id, lab.id, 2);
        expect(done).toHaveLength(2);
        expect(studied.map(p => p.heroId)).toEqual([scholar.id, scholar.id]);
        expect(Mastery.pointsOf(VEIN)).toBe(2);
        expect(vein.usesRemaining).toBe(18);
        expect(scholar.summon.charges).toBe(8);
        expect(scholar.skills.science.xp).toBe(xp);
    });

    it('⭐ one without Science is refused the Laboratory: it works only at its own skills', () => {
        const { lab } = laboratory();
        const miner = summoned(MINER);
        const order = fixtures.orderAt(miner.id, LAB_AT);
        expect(order.success).toBe(false);
        expect(order.reason).toBe(t('orders.summonWorksOnly', { skills: 'Mining' }));
        step(STUDY_MS * 2);
        expect(BoardState.workerOf(lab.id)).toBeNull();
        expect(Mastery.pointsOf(VEIN)).toBe(0);
        expect(miner.summon.charges).toBe(10);
    });

    it('its fixed Science level must reach the node\'s gathering level, as a hero\'s does', () => {
        const { lab } = laboratory();
        const dull = summoned(DULL_SCHOLAR);
        expect(fixtures.orderAt(dull.id, LAB_AT).success).toBe(false);
        step(STUDY_MS * 2);
        expect(BoardState.workerOf(lab.id)).toBeNull();
        expect(Mastery.pointsOf(VEIN)).toBe(0);
        expect(dull.summon.charges).toBe(10);
    });
});

describe('⭐ an Echo at a Laboratory repeats the study, never its wear', () => {
    it('⭐ a hero\'s study with an Echo gives two points and Science twice, and wears the node once', () => {
        const { lab, vein } = laboratory({ echo: true });
        const [hero] = fixtures.makeHeroes(1, { science: 30 });
        expect(fixtures.orderAt(hero.id, LAB_AT).success).toBe(true);
        const xp = GameState.state.heroes.find(h => h.id === hero.id).skills.science.xp;
        const { done, studied } = studiesBy(hero.id, lab.id, 1);
        expect(done).toHaveLength(1);
        expect(studied).toHaveLength(2);
        expect(Mastery.pointsOf(VEIN)).toBe(2);
        expect(vein.usesRemaining).toBe(19);
        expect(GameState.state.heroes.find(h => h.id === hero.id).skills.science.xp).toBe(xp + 6);
    });

    it('⭐ a Summoned worker\'s study with an Echo: two points, one wear, one charge', () => {
        const { lab, vein } = laboratory({ echo: true });
        const scholar = summoned(SCHOLAR);
        expect(fixtures.orderAt(scholar.id, LAB_AT).success).toBe(true);
        const { done, studied } = studiesBy(scholar.id, lab.id, 1);
        expect(done).toHaveLength(1);
        expect(studied).toHaveLength(2);
        expect(Mastery.pointsOf(VEIN)).toBe(2);
        expect(vein.usesRemaining).toBe(19);
        expect(scholar.summon.charges).toBe(9);
    });
});
