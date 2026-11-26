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
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * A poison's attacks left are saved on the hero (brief 750 S3): a game saved mid-fight and loaded
 * goes on with the same poison, takes no fresh one, and counts down from where it was.
 */

const ENEMY = 'fixture_poison_reload_enemy';
const HALL = 'fixture_poison_reload_hall';

registerTokenTypes({
    [HALL]: { ...fixtures.BENCH_TOKENS.bench_hall, id: HALL, name: 'Reload Hall' },
    [ENEMY]: { ...fixtures.BENCH_TOKENS.bench_goblin, id: ENEMY, name: 'Reload Ogre', uses: null, enemy: { level: 5, style: 'ranged', hp: 3000 } }
});
registerEffects({
    fx_pr_coat: { id: 'fx_pr_coat', name: 'Coat', statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'DAMAGE', bucket: 'flat', value: 1 }, to: null }] },
    fx_pr_poison: {
        id: 'fx_pr_poison', name: 'Poison',
        statements: [{ ...makeStatement(KEYWORD.APPLIES), when: { event: 'COMBAT_ENGAGED', scope: 'self' }, payload: { effectId: 'fx_pr_coat', scale: 1, durationMs: 0, forAttacks: 40, chance: 100 } }]
    }
});
registerItems({
    pr_dagger: { id: 'pr_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['stealth'], damage: 2, speed: 'fast' },
    pr_poison: { id: 'pr_poison', name: 'Poison', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'fx_pr_poison' }] }
});

const stepUntil = (done, max) => {
    for (let i = 0; i < max; i++) {
        if (done()) return true;
        GameLoop.runHandlers(100);
    }
    return done();
};
function reload() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}
const coated = (heroId) => (HeroManager.getHero(heroId)?.effects || []).some(e => e.effectId === 'fx_pr_coat');

let engagements;
let attacks;
let offs = [];
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
    engagements = [];
    attacks = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => attacks.push(p))
    ];
});
afterEach(() => {
    offs.forEach(off => off());
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a poison across a reload', () => {
    it('goes on from the attacks left, takes no fresh one, and its coat is back', () => {
        const c = { x: Math.round(matW() / 2), y: Math.round(matH() / 2) };
        fixtures.placeAt(HALL, c.x, c.y);
        const enemy = fixtures.placeAt(ENEMY, c.x + 400, c.y);
        const [hero] = fixtures.makeHeroes(1, { ...fixtures.HERO_SKILLS, stealth: 40 });
        hero.hp = { current: 5000, max: 5000 };
        InventoryManager.addItem('pr_dagger', 1);
        expect(EquipmentManager.equipItem(hero.id, 'pr_dagger').success).toBe(true);
        InventoryManager.addItem('pr_poison', 3);
        expect(EquipmentManager.equipItem(hero.id, 'pr_poison').success).toBe(true);
        expect(fixtures.orderAt(hero.id, { x: enemy.x, y: enemy.y }).success).toBe(true);
        TileModifiers.rebuildAll();
        Atlas.createStarterRegion();

        expect(stepUntil(() => attacks.length >= 5, 20000)).toBe(true);
        expect(InventoryManager.getItemCount('pr_poison')).toBe(2);
        const left = HeroManager.getHero(hero.id).poisonAttacks.pr_poison;
        expect(left).toBe(35);
        expect(coated(hero.id)).toBe(true);

        const saved = reload();
        expect(saved.state.heroes[0].poisonAttacks).toEqual({ pr_poison: 35 });
        expect(saved.state.heroes[0].fightPoisons).toEqual({ at: enemy.id, items: ['pr_poison'] });
        engagements.length = 0;
        attacks.length = 0;
        expect(stepUntil(() => engagements.length > 0, 50)).toBe(true);
        expect(engagements[0].resumed).toBe(true);
        expect(coated(hero.id)).toBe(true);
        expect(InventoryManager.getItemCount('pr_poison')).toBe(2);

        expect(stepUntil(() => attacks.length >= 3, 20000)).toBe(true);
        expect(HeroManager.getHero(hero.id).poisonAttacks.pr_poison).toBe(35 - attacks.length);
    });
});
