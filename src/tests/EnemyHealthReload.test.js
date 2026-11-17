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
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Orders from '../systems/board/Orders.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { ELIXIR_FIGHTS } from '../config/loopConstants.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * A reload remembers the enemy's health, so closing the game cannot change a fight, and an elixir
 * is counted once per enemy across the reload. In live play nothing changes: a hero who walks away
 * still finds the enemy whole.
 */

const ENEMY = 'fixture_reload_enemy';
const HALL = 'fixture_reload_hall';

function registerFixtures() {
    registerTokenTypes({
        [HALL]: { ...fixtures.BENCH_TOKENS.bench_hall, id: HALL, name: 'Reload Hall' },
        // A sturdy enemy that never runs out, so a fight lasts long enough to be saved mid-way and
        // a second enemy steps up after a kill.
        [ENEMY]: {
            ...fixtures.BENCH_TOKENS.bench_goblin, id: ENEMY, name: 'Reload Ogre', uses: null,
            enemy: { level: 5, style: 'melee', budgetScale: 1, hostile: true }
        }
    });
    const forTheFight = (effectId) => ({
        ...makeStatement(KEYWORD.APPLIES),
        when: { event: 'COMBAT_ENGAGED', scope: 'self' },
        payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
    });
    registerEffects({
        fx_reload_valor: {
            id: 'fx_reload_valor', name: 'Valor',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'DAMAGE', bucket: 'flat', value: 1 }, to: null }]
        },
        fx_reload_elixir: { id: 'fx_reload_elixir', name: 'Elixir of Valor', statements: [forTheFight('fx_reload_valor')] }
    });
    registerItems({
        reload_elixir: { id: 'reload_elixir', name: 'Valor', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'fx_reload_elixir' }] }
    });
}

const centre = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });
const step = (n, ms = 100) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(ms); };
function stepUntil(done, max) {
    for (let i = 0; i < max; i++) {
        if (done()) return true;
        GameLoop.runHandlers(100);
    }
    return done();
}

const hpOf = (id) => BoardCombat.getFight(id)?.combat?.enemyHp ?? null;
const hurt = (id) => { const hp = hpOf(id); return !!hp && hp.current > 0 && hp.current < hp.max * 0.8; };

/** The Hall, one enemy and a hero ordered onto it, optionally carrying an elixir. */
function build({ elixir = false } = {}) {
    const c = centre();
    fixtures.placeAt(HALL, c.x, c.y);
    const enemy = fixtures.placeAt(ENEMY, c.x + 400, c.y);
    const [hero] = fixtures.makeHeroes(1, { ...fixtures.HERO_SKILLS, melee: 40 });
    if (elixir) {
        hero.equipment[0] = 'reload_elixir';
        InventoryManager.addItem('reload_elixir', 5);
    }
    expect(fixtures.orderAt(hero.id, { x: enemy.x, y: enemy.y }).success).toBe(true);
    TileModifiers.rebuildAll();
    Atlas.createStarterRegion();
    return { enemy, heroId: hero.id };
}

/** Save and load the game as a player's slot does. */
function reload() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}

const effectsOf = (heroId) => (HeroManager.getHero(heroId)?.effects || []).map(e => e.effectId);

let engagements;
let off;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
    BoardCombat.clearAll();
    engagements = [];
    off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p));
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

describe('a reload remembers the enemy health', () => {
    it('a fight saved mid-way goes on from the health the enemy had', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const before = hpOf(enemy.id).current;
        const max = hpOf(enemy.id).max;

        reload();
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 50)).toBe(true);
        expect(BoardCombat.fightOfHero(heroId)?.instanceId).toBe(enemy.id);
        const after = hpOf(enemy.id).current;
        expect(after).toBeLessThanOrEqual(before);
        expect(after).toBeLessThan(max);
        // At most a blow or two since the load, not a whole enemy.
        expect(before - after).toBeLessThan(max * 0.3);
    });

    it('an older save, with no health on the enemy, loads it whole as before', () => {
        const { enemy } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const data = JSON.parse(GameState.serializeJson());
        expect(data.state.board.tokens[enemy.id].fightHp).toBeTruthy();
        delete data.state.board.tokens[enemy.id].fightHp;
        loadSavedState(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 50)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBe(hp.max);
    });

    it('a save between enemies, in the rest after a kill, loads the next enemy whole', () => {
        const { enemy } = build();
        let killed = false;
        const offKill = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, ({ outcome }) => { if (outcome === 'victory') killed = true; });
        expect(stepUntil(() => killed, 20000)).toBe(true);
        offKill();
        reload();
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 50)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBe(hp.max);
    });
});

describe('live play is unchanged', () => {
    it('a hero who walks away and comes back finds the enemy whole', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        Orders.sendHome(heroId);
        step(5);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(fixtures.orderAt(heroId, { x: enemy.x, y: enemy.y }).success).toBe(true);
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 5000)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBe(hp.max);
        // Walking away leaves nothing on the Token for a later save to resume.
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        Orders.sendHome(heroId);
        step(5);
        expect(JSON.parse(GameState.serializeJson()).state.board.tokens[enemy.id].fightHp).toBeUndefined();
    });

    it('a hero sent home and straight back onto the enemy, between ticks, meets it whole', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        Orders.sendHome(heroId);
        expect(fixtures.orderAt(heroId, { x: enemy.x, y: enemy.y }).success).toBe(true);
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 5000)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBe(hp.max);
    });

    it('travel away and back mid-fight finds the enemy whole', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const home = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        step(5);
        Atlas.travel(home);
        expect(fixtures.orderAt(heroId, { x: enemy.x, y: enemy.y }).success).toBe(true);
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 5000)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBe(hp.max);
    });
});

describe('an elixir is counted once per enemy across a reload', () => {
    it('the fight going on after the load takes no fight off the dose, and its effect is back', () => {
        const { enemy, heroId } = build({ elixir: true });
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        expect(HeroManager.getHero(heroId).elixirFights).toEqual({ reload_elixir: ELIXIR_FIGHTS - 1 });
        expect(InventoryManager.getItemCount('reload_elixir')).toBe(4);
        expect(effectsOf(heroId)).toContain('fx_reload_valor');

        reload();
        engagements.length = 0;
        expect(stepUntil(() => engagements.length > 0, 50)).toBe(true);
        expect(HeroManager.getHero(heroId).elixirFights).toEqual({ reload_elixir: ELIXIR_FIGHTS - 1 });
        expect(InventoryManager.getItemCount('reload_elixir')).toBe(4);
        // The for-the-fight effect a load strips is put back.
        expect(effectsOf(heroId)).toContain('fx_reload_valor');

        // The next enemy after the kill is a new fight, and counts.
        const target = engagements.length + 1;
        expect(stepUntil(() => engagements.length >= target, 20000)).toBe(true);
        expect(HeroManager.getHero(heroId).elixirFights).toEqual({ reload_elixir: ELIXIR_FIGHTS - 2 });
    });

    it('the last fight of a dose, resumed, drinks no new elixir and still works', () => {
        const { enemy, heroId } = build({ elixir: true });
        HeroManager.getHero(heroId).elixirFights = { reload_elixir: 1 };
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        expect(HeroManager.getHero(heroId).elixirFights).toEqual({ reload_elixir: 0 });
        expect(InventoryManager.getItemCount('reload_elixir')).toBe(5);

        reload();
        engagements.length = 0;
        expect(stepUntil(() => engagements.length > 0, 50)).toBe(true);
        expect(InventoryManager.getItemCount('reload_elixir')).toBe(5);
        expect(HeroManager.getHero(heroId).elixirFights).toEqual({ reload_elixir: 0 });
        expect(effectsOf(heroId)).toContain('fx_reload_valor');
    });
});
