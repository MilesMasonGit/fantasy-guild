import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement, effectParts } from '../systems/effects/statementText.js';
import { BANNER_KINDS } from '../systems/notifications/bannerKinds.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { getEquippedEntries, isGearCategory } from '../config/registries/equipmentConstants.js';
import { effectTag } from '../config/registries/effectWords.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Valiant, the Shrine of the Valiant's blessing (owner 2026-11-25): a hero brought to 0 HP in a
 * fight a lit shrine's Valiant reaches is never Defeated. They flee: the fight ends with no defeat
 * costs (the food and drink share and the gear roll are not taken), and they still go home wounded
 * and heal. The log and the banner say Fled. A shrine reaches a hero through the enemy Token they
 * fight.
 */

const SWORD = 'fixture_fv_sword';
const BREAD = 'fixture_fv_bread';
const BRUTE = 'fv_brute';
const SHRINE = 'fv_shrine';
const HALF_SHRINE = 'fv_half_shrine';
const NONE_SHRINE = 'fv_none_shrine';
const BREAD_BANKED = 400;

const shrine = (id, value) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forest',
    requiresHero: true, shrine: { maxLitMs: 600_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [
        { id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } },
        { id: `stm_${id}_valiant`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.VALIANT, bucket: 'flat', value } }
    ]
});

function registerFixtures() {
    registerItems({
        [SWORD]: { id: SWORD, name: 'Valiant Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 1 },
        [BREAD]: { id: BREAD, name: 'Valiant Crumb', equipSlot: 'food', stackable: true, restoreAmount: 1 }
    });
    registerTokenTypes({
        // Far too strong for a beginner: every fight against it is lost.
        [BRUTE]: {
            id: BRUTE, name: 'Valiant Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1,
            sprite: 'e_goblin', requiresHero: true, enemy: { level: 60, style: 'melee' },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
        },
        [SHRINE]: shrine(SHRINE, 100),
        [HALF_SHRINE]: shrine(HALF_SHRINE, 50),
        [NONE_SHRINE]: shrine(NONE_SHRINE, 0)
    });
}

const ENEMY_AT = { x: 800, y: 500 };
const BESIDE = { x: 960, y: 500 };
const FAR = { x: 1700, y: 500 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

/** A shrine at `at`, lit for ten minutes. */
function litShrine(typeId = SHRINE, at = BESIDE) {
    const s = fixtures.placeAt(typeId, at.x, at.y);
    s.shrine = { litMs: 600_000 };
    TileModifiers.rebuildAll();
    return s;
}

/** A beginner with a sword and bread, sent at the Brute; `setUp` places the shrines. */
function build(setUp = () => litShrine()) {
    freshBoard();
    const [hero] = fixtures.makeHeroes(1, { melee: 1 });
    hero.equipment[0] = SWORD;
    hero.equipment[1] = BREAD;
    InventoryManager.addItem(SWORD, 1);
    InventoryManager.addItem(BREAD, BREAD_BANKED);
    HeroManager.updateHeroFromSkills(hero);
    hero.hp.current = hero.hp.max;
    const brute = fixtures.placeAt(BRUTE, ENEMY_AT.x, ENEMY_AT.y);
    setUp();
    TileModifiers.rebuildAll();
    expect(fixtures.orderAt(hero.id, ENEMY_AT).success).toBe(true);
    return { heroId: hero.id, brute };
}

/** What the fight's end said and left: the defeat events, the outcome, the bread eaten and banked. */
function watch(heroId) {
    const seen = { defeats: [], outcomes: [], eaten: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => { if (p.heroId === heroId) seen.defeats.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p.heroId === heroId) seen.outcomes.push(p.outcome); }),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => { if (p.heroId === heroId && p.itemId === BREAD) seen.eaten += 1; })
    ];
    seen.off = () => offs.forEach(off => off());
    return seen;
}

/** Fight until the hero is down (or a minute has passed). */
function fightOut(heroId) {
    const seen = watch(heroId);
    for (let t = 0; t < 60_000 && !seen.defeats.length; t += 100) step(100);
    seen.off();
    return seen;
}

const heroOf = (heroId) => GameState.state.heroes.find(h => h.id === heroId);

/** A mulberry32 stream from `state`, as the bench's prelude seeds `Math.random`. */
function seeded(state) {
    let s = state;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Save and load the game as a player's slot does. */
function reload() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => freshBoard());

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('without Valiant, a lost fight is a defeat as ever', () => {
    it('the hero is Defeated: a share of their food goes, and the log says so', () => {
        const { heroId } = build(() => {});
        const seen = fightOut(heroId);
        expect(seen.defeats).toHaveLength(1);
        expect(seen.defeats[0].fled).toBeFalsy();
        expect(seen.defeats[0].lost.some(l => l.includes('Valiant Crumb'))).toBe(true);
        expect(InventoryManager.getItemCount(BREAD)).toBeLessThan(BREAD_BANKED - seen.eaten);
        expect(seen.outcomes).toEqual(['defeat']);
    });
});

describe('Valiant: a hero brought down in its reach flees, keeping everything', () => {
    it('the hero flees: nothing is lost, their gear stays on, and they go home wounded to heal', () => {
        const { heroId } = build();
        const seen = fightOut(heroId);
        expect(seen.defeats).toHaveLength(1);
        expect(seen.defeats[0]).toMatchObject({ heroId, fled: true, lost: [] });
        expect(InventoryManager.getItemCount(BREAD)).toBe(BREAD_BANKED - seen.eaten);
        const hero = heroOf(heroId);
        expect(hero.equipment[0]).toBe(SWORD);
        expect(hero.equipment[1]).toBe(BREAD);
        expect(hero.status).toBe('wounded');
        expect(BoardState.flagOf(heroId)).toBeNull();
        step(1000);
        expect(hero.woundedRemainingMs).toBeGreaterThan(0);
        expect(seen.outcomes).toEqual(['fled']);
    });

    it('the gear roll is never drawn: a sure flee draws less than a defeat', () => {
        // Each fight on the same seeded stream from its first tick, counting its draws.
        const drawsWith = (setUp) => {
            const { heroId } = build(setUp);
            const stream = seeded(5);
            const draws = vi.spyOn(Math, 'random').mockImplementation(stream);
            let atDown = null;
            const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { atDown = draws.mock.calls.length; });
            for (let t = 0; t < 60_000 && atDown == null; t += 100) step(100);
            off();
            draws.mockRestore();
            expect(heroOf(heroId).status).toBe('wounded');
            return atDown;
        };
        // The same fight to the same blow either way (the same shrine stands beside it, lit or out):
        // only the end differs, by the defeat's gear roll, one draw a gear piece (bread is no gear).
        const { heroId } = build(() => {});
        const gear = getEquippedEntries(heroOf(heroId)).filter(e => isGearCategory(e.category)).length;
        expect(gear).toBeGreaterThan(0);
        expect(drawsWith(() => litShrine())).toBe(drawsWith(() => fixtures.placeAt(SHRINE, BESIDE.x, BESIDE.y)) - gear);
    });

    it('out of reach, out, or at 0: a defeat as ever, drawing what a defeat draws', () => {
        for (const setUp of [() => litShrine(SHRINE, FAR), () => fixtures.placeAt(SHRINE, BESIDE.x, BESIDE.y), () => litShrine(NONE_SHRINE)]) {
            const { heroId } = build(setUp);
            const seen = fightOut(heroId);
            expect(seen.defeats).toHaveLength(1);
            expect(seen.defeats[0].fled).toBeFalsy();
            expect(seen.outcomes).toEqual(['defeat']);
        }
    });

    it('below 100 it is a chance, one draw as the hero falls', () => {
        const { heroId } = build(() => litShrine(HALF_SHRINE));
        const seen = fightOut(heroId);
        expect(seen.defeats).toHaveLength(1);
        expect(typeof !!seen.defeats[0].fled).toBe('boolean');
    });

    it('the banner says Fled, and that nothing was lost', () => {
        const text = BANNER_KINDS.fled.text({ heroes: ['Ana'] });
        expect(text.title).toBe('Fled!');
        expect(text.line).toBe('Ana fled the fight and went home to heal. Nothing was lost.');
        expect(BANNER_KINDS.fled.text({ heroes: ['Ana', 'Bram'] }).line).toBe('Ana and Bram fled the fight and went home to heal. Nothing was lost.');
        expect(BANNER_KINDS.fled.merge({ heroes: ['Ana'] }, { heroes: ['Bram'] })).toEqual({ heroes: ['Ana', 'Bram'] });
    });
});

describe('Valiant through a save and time away', () => {
    it('loaded mid-fight, the shrine still reaches the fight: the hero flees', () => {
        const { heroId } = build();
        step(1000);
        reload();
        const seen = fightOut(heroId);
        expect(seen.defeats).toHaveLength(1);
        expect(seen.defeats[0]).toMatchObject({ fled: true, lost: [] });
    });

    it('time away: the catch-up flees as the plain loop in its 1 s steps does', async () => {
        const AWAY = 60_000;
        const end = (heroId, seen) => ({
            fled: seen.defeats.map(d => !!d.fled), lost: seen.defeats.map(d => d.lost),
            bread: InventoryManager.getItemCount(BREAD), status: heroOf(heroId).status, sword: heroOf(heroId).equipment[0]
        });
        const live = (() => {
            const { heroId } = build();
            const seen = watch(heroId);
            step(AWAY, 1000);
            seen.off();
            return end(heroId, seen);
        })();
        const { heroId } = build();
        const seen = watch(heroId);
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        seen.off();
        const caught = end(heroId, seen);
        expect(caught).toEqual(live);
        expect(caught.fled).toEqual([true]);
        expect(caught.sword).toBe(SWORD);
    });
});

describe('Valiant in the CMS', () => {
    it('is offered on a Token as a blessing and reads as what it does', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.VALIANT);
        expect(entry).toMatchObject({ label: 'Valiant', shape: MODIFIER_SHAPES.PROC, blessing: true });
        expect(entry.categories).toBeUndefined();
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).toContain(EFFECT_TYPES.VALIANT);
        const payload = { type: EFFECT_TYPES.VALIANT, bucket: 'flat', value: 100 };
        expect(effectTag(entry, payload).text).toBe('Valiant 100%');
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, reach: 'nearby', to: { mode: 'all', value: '' }, payload }))
            .toBe('Valiant 100% on every nearby Token.');
        expect(effectParts({ keyword: KEYWORD.PROVIDES, payload })).toEqual({
            before: 'have a', size: '100%', after: 'chance a hero brought down fighting here flees, losing nothing'
        });
    });
});
