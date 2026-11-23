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
import * as CatchUp from '../systems/core/CatchUp.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * An enemy keeps its health on its Token: a reload goes on from it, so closing the game cannot
 * change a fight, and an elixir is counted once per enemy across the reload. A fight that ends
 * without a kill leaves the enemy hurt; out of a fight it heals 5% of its max health a second,
 * rounded up, played on through a load, time away and a Region's absence.
 */

const ENEMY = 'fixture_reload_enemy';
const HALL = 'fixture_reload_hall';

function registerFixtures() {
    registerTokenTypes({
        [HALL]: { ...fixtures.BENCH_TOKENS.bench_hall, id: HALL, name: 'Reload Hall' },
        // A sturdy enemy, so a fight lasts long enough to be saved mid-way.
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
const tokenOf = (id) => GameState.state.board.tokens[id];
const healthOf = (id) => BoardCombat.enemyHealthOf(tokenOf(id));
/** One second of rest's healing for an enemy of `max` health. */
const stepOf = (max) => Math.ceil(max * 0.05);
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

    it('a hurt enemy its hero left is saved hurt, loads hurt, and heals on after the load', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        Orders.sendHome(heroId);
        step(1);
        const { current, max } = healthOf(enemy.id);
        expect(current).toBeLessThan(max);
        const saved = reload().state.board.tokens[enemy.id].fightHp;
        expect(saved.current).toBe(current);
        expect(saved.heroId).toBeUndefined();

        expect(healthOf(enemy.id)).toEqual({ current, max });
        step(10);
        expect(healthOf(enemy.id).current).toBe(Math.min(max, current + stepOf(max)));
    });

    it('time away is caught up on load: a hurt enemy heals for every second of it', async () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        Orders.sendHome(heroId);
        step(1);
        const { current, max } = healthOf(enemy.id);
        reload();
        const now = Date.now();
        await CatchUp.run({ savedAt: now - 3000, now, save: false, reset: false, news: false, yieldFn: () => Promise.resolve() });
        expect(healthOf(enemy.id).current).toBe(Math.min(max, current + 3 * stepOf(max)));

        await CatchUp.run({ savedAt: now - 60000, now, save: false, reset: false, news: false, yieldFn: () => Promise.resolve() });
        expect(healthOf(enemy.id)).toEqual({ current: max, max });
        expect(tokenOf(enemy.id).fightHp).toBeUndefined();
    });
});

describe('a fight ended without a kill leaves the enemy hurt', () => {
    it('a hero who walks away and comes back finds it as hurt as they left it, less its rest', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const left = hpOf(enemy.id).current;
        Orders.sendHome(heroId);
        step(5);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        // On the Token, no longer any hero's fight.
        const kept = JSON.parse(GameState.serializeJson()).state.board.tokens[enemy.id].fightHp;
        expect(kept.current).toBe(left);
        expect(kept.heroId).toBeUndefined();

        expect(fixtures.orderAt(heroId, { x: enemy.x, y: enemy.y }).success).toBe(true);
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 5000)).toBe(true);
        const hp = hpOf(enemy.id);
        expect(hp.current).toBeLessThan(hp.max);
        expect(hp.current).toBeLessThanOrEqual(left + stepOf(hp.max) * 5);
    });

    it('a hero sent home and straight back onto the enemy, between ticks, meets it as hurt', () => {
        const { enemy, heroId } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const left = hpOf(enemy.id).current;
        Orders.sendHome(heroId);
        expect(fixtures.orderAt(heroId, { x: enemy.x, y: enemy.y }).success).toBe(true);
        expect(stepUntil(() => BoardCombat.getFight(enemy.id), 5000)).toBe(true);
        expect(hpOf(enemy.id).current).toBeLessThanOrEqual(left);
    });

    it('travel away and straight back mid-fight finds the enemy as hurt as it was', () => {
        const { enemy } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const left = hpOf(enemy.id).current;
        const home = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        expect(GameState.state.atlas.regions[home].board.tokens[enemy.id].fightHp.current).toBe(left);
        step(5);
        Atlas.travel(home);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(healthOf(enemy.id).current).toBe(left);
        expect(tokenOf(enemy.id).fightHp.heroId).toBeUndefined();
        expect(tokenOf(enemy.id).fightHp.leftAt).toBeUndefined();
    });

    it('a Region left for a while: back, its enemy has rested the time away', () => {
        const { enemy } = build();
        expect(stepUntil(() => hurt(enemy.id), 5000)).toBe(true);
        const { current, max } = hpOf(enemy.id);
        const home = Atlas.activeRegionId();
        const t0 = Date.now();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(t0);
        try {
            Atlas.travel(Atlas.devCreateEmptyRegion().id);
            clock.mockReturnValue(t0 + 2000);
            Atlas.travel(home);
            expect(healthOf(enemy.id).current).toBe(Math.min(max, current + 2 * stepOf(max)));

            Atlas.travel(Atlas.devCreateEmptyRegion().id);
            clock.mockReturnValue(t0 + 600000);
            Atlas.travel(home);
            expect(healthOf(enemy.id)).toEqual({ current: max, max });
        } finally {
            clock.mockRestore();
        }
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

        // The next enemy is a new fight, and counts.
        expect(stepUntil(() => !GameState.state.board.tokens[enemy.id], 20000)).toBe(true);
        const next = fixtures.placeAt(ENEMY, enemy.x, enemy.y);
        expect(fixtures.orderAt(heroId, { x: next.x, y: next.y }).success).toBe(true);
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
