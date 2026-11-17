import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { WoundedSystem } from '../systems/combat/WoundedSystem.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * A healing hero takes no work: not after travel back to a Region where they still hold an order,
 * not after a load, and a hero who comes to an enemy already healing is not knocked out again.
 */

const HALL = 'fixture_wounded_hall';
registerTokenTypes({
    [HALL]: { ...fixtures.BENCH_TOKENS.bench_hall, id: HALL, name: 'Wounded Hall' }
});

const centre = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });
const step = (n, ms = 100) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(ms); };
function stepUntil(done, max) {
    for (let i = 0; i < max; i++) {
        if (done()) return true;
        GameLoop.runHandlers(100);
    }
    return done();
}
const wounded = (heroId) => HeroManager.getHero(heroId)?.status === 'wounded';

/**
 * Region A: the Hall, a lone goblin and a lone tree. Hero 0 is ordered onto the goblin, hero 1 onto
 * the tree.
 */
function buildRegionA() {
    const c = centre();
    fixtures.placeAt(HALL, c.x, c.y);
    const goblin = fixtures.placeAt('bench_goblin', c.x + 400, c.y);
    const tree = fixtures.placeAt('bench_tree', c.x - 400, c.y);
    const heroes = fixtures.makeHeroes(2);
    expect(fixtures.orderAt(heroes[0].id, { x: goblin.x, y: goblin.y }).success).toBe(true);
    expect(fixtures.orderAt(heroes[1].id, { x: tree.x, y: tree.y }).success).toBe(true);
    TileModifiers.rebuildAll();
    Atlas.createStarterRegion();
    return { goblin, tree, heroes };
}

/** In the active Region, send every hero at a goblin with 1 HP left and let them lose. */
function loseHere(heroes) {
    const c = centre();
    heroes.forEach((h, i) => {
        const goblin = fixtures.placeAt('bench_goblin', c.x + 300, c.y - 200 + i * 400);
        expect(fixtures.orderAt(h.id, { x: goblin.x, y: goblin.y }).success).toBe(true);
    });
    for (const h of heroes) HeroManager.getHero(h.id).hp.current = 1;
    expect(stepUntil(() => heroes.every(h => wounded(h.id)), 3000)).toBe(true);
}

let defeats;
let off;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
    BoardCombat.clearAll();
    defeats = [];
    off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, ({ heroId }) => defeats.push(heroId));
});

afterEach(() => {
    off?.();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('travel back while healing', () => {
    it('a hero knocked out elsewhere is not knocked out again, nor put to work; their orders here are cleared', () => {
        const { heroes } = buildRegionA();
        expect(stepUntil(() => BoardCombat.fightOfHero(heroes[0].id), 3000)).toBeTruthy();
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);

        loseHere(heroes);
        expect(defeats.sort()).toEqual(heroes.map(h => h.id).sort());
        defeats.length = 0;

        expect(Atlas.travel(a).success).toBe(true);
        for (const h of heroes) {
            expect(wounded(h.id)).toBe(true);
            expect(BoardState.flagOf(h.id)).toBeNull();
        }
        // Thirty seconds, well inside the healing time.
        step(300);
        expect(defeats).toEqual([]);
        for (const h of heroes) {
            expect(wounded(h.id)).toBe(true);
            expect(BoardState.claimOfHero(h.id)).toBeNull();
            expect(BoardState.workTokenOf(h.id)).toBeFalsy();
            expect(BoardCombat.fightOfHero(h.id)).toBeNull();
        }
    });

    it('a hero who healed before the guild comes back keeps their orders and picks them up', () => {
        const { heroes, goblin, tree } = buildRegionA();
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        loseHere(heroes);
        for (const h of heroes) WoundedSystem.recoverHero(h.id);

        Atlas.travel(a);
        expect(Flags.pinnedIdOf(heroes[0].id)).toBe(goblin.id);
        expect(Flags.pinnedIdOf(heroes[1].id)).toBe(tree.id);
        step(1);
        expect(BoardState.claimOfHero(heroes[0].id)?.instanceId).toBe(goblin.id);
        expect(BoardState.claimOfHero(heroes[1].id)?.instanceId).toBe(tree.id);
    });
});

describe('one rule: a healing hero takes no claim', () => {
    it('a healing hero with an order (an old save) waits, and takes it up once healed', () => {
        const { heroes, goblin, tree } = buildRegionA();
        for (const h of heroes) HeroManager.setHeroStatus(h.id, 'wounded');
        step(50);
        expect(defeats).toEqual([]);
        for (const h of heroes) expect(BoardState.claimOfHero(h.id)).toBeNull();
        expect(goblin.alert ?? null).toBeNull();
        expect(tree.alert ?? null).toBeNull();

        for (const h of heroes) WoundedSystem.recoverHero(h.id);
        step(20);
        expect(BoardState.claimOfHero(heroes[0].id)?.instanceId).toBe(goblin.id);
        expect(BoardState.claimOfHero(heroes[1].id)?.instanceId).toBe(tree.id);
    });

    it('a hero who starts healing while holding work lets it go', () => {
        const { heroes, tree } = buildRegionA();
        expect(stepUntil(() => BoardState.workTokenOf(heroes[1].id) === tree.id, 3000)).toBe(true);
        HeroManager.setHeroStatus(heroes[1].id, 'wounded');
        step(1);
        expect(BoardState.claimOfHero(heroes[1].id)).toBeNull();
    });

    it('a hero already healing when brought to an enemy starts no fight: no second defeat, no penalties', () => {
        const { heroes, goblin } = buildRegionA();
        const hero = HeroManager.getHero(heroes[0].id);
        HeroManager.setHeroStatus(hero.id, 'wounded');
        const removed = vi.spyOn(InventoryManager, 'removeItem');
        try {
            BoardCombat.tickToken(goblin, 100, hero.id);
            expect(defeats).toEqual([]);
            expect(removed).not.toHaveBeenCalled();
            expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
        } finally {
            removed.mockRestore();
        }
    });

    it('a hero knocked out in a fight is still defeated once, with the event', () => {
        const { heroes } = buildRegionA();
        expect(stepUntil(() => BoardCombat.fightOfHero(heroes[0].id), 3000)).toBeTruthy();
        HeroManager.getHero(heroes[0].id).hp.current = 1;
        expect(stepUntil(() => wounded(heroes[0].id), 3000)).toBe(true);
        step(20);
        expect(defeats).toEqual([heroes[0].id]);
        expect(BoardState.flagOf(heroes[0].id)).toBeNull();
    });
});

describe('a load with a healing hero', () => {
    it('restores no work for them', () => {
        const { heroes, tree } = buildRegionA();
        expect(stepUntil(() => BoardState.workTokenOf(heroes[1].id) === tree.id, 3000)).toBe(true);
        HeroManager.setHeroStatus(heroes[1].id, 'wounded');
        const data = JSON.parse(GameState.serializeJson());
        // The save holds the note that would put them back at the tree.
        expect(data.state.board.workClaims?.[heroes[1].id]).toBeTruthy();
        loadSavedState(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        step(5);
        expect(BoardState.claimOfHero(heroes[1].id)).toBeNull();
        expect(BoardState.workTokenOf(heroes[1].id)).toBeFalsy();
    });
});
