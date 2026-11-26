import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { TRICK } from '../systems/combat/CombatTricks.js';
import { registerSkillPerks, perkRowsFor } from '../config/registries/perkRegistry.js';
import { getEffect } from '../config/registries/effectRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { resetMatTuning } from '../config/matTuning.js';
import {
    setUpSecondWindScene, setUpUnbreakableScene, setUpTwinShotScene, setUpDoubleCastScene, setUpShadowstepScene, QA_CT
} from '../ui/dev/combatTricksScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's combat tricks scenes (brief 800 P5's look), played through the real loop: each
 * shows what the owner is asked to look at. ⚠️ Deleted with the scenes once the look is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };
const heroNamed = (name) => (HeroManager.getAllHeroes() || []).find(h => h.name === name);

let seen;
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
    TileModifiers.clearAll();
    BoardCombat.clearAll();
    seen = [];
    offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => seen.push({ kind: 'attack', ...p })),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.push({ kind: 'enemy', ...p })),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_TRICK, (p) => seen.push({ kind: 'trick', ...p })),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => seen.push({ kind: 'defeated', ...p }))
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
    registerSkillPerks({ melee: { perks: [] }, ranged: { perks: [] }, magic: { perks: [] }, stealth: { perks: [] } });
    vi.restoreAllMocks();
    resetMatTuning();
});

const of = (heroId, kind, trick) => seen.filter(e => e.heroId === heroId && e.kind === kind && (!trick || e.trick === trick));

describe('the QA combat tricks scenes', () => {
    it('Second Wind: each kill at the QA Weak Camp heals the brawler', () => {
        const r = setUpSecondWindScene();
        expect(r.ok, r.error).toBe(true);
        const hero = heroNamed('QA Brawler');
        step(60_000);
        const heals = of(hero.id, 'trick', TRICK.KILL_HEAL);
        expect(heals.length).toBeGreaterThan(3);
        // The scene keeps the style's shipped perks beside its Test one, so a shipped kill heal
        // (Bloodrush) adds to the Test Second Wind's 3.
        const killHeal = (effectId) => (getEffect(effectId)?.statements || [])
            .filter(s => s.payload?.type === EFFECT_TYPES.KILL_HEAL).reduce((n, s) => n + s.payload.value, 0);
        const perKill = perkRowsFor('melee').reduce((n, r) => n + killHeal(r.effectId) * (r.scale ?? 1), 0);
        expect(perKill).toBeGreaterThanOrEqual(3);
        expect(heals.every(h => h.amount === perKill)).toBe(true);
    });

    it('Unbreakable: held at 1 by the first defeating blow, defeated by the next', () => {
        expect(setUpUnbreakableScene().ok).toBe(true);
        const hero = heroNamed('QA Last Stand');
        step(60_000);
        expect(of(hero.id, 'trick', TRICK.LAST_STAND)).toHaveLength(1);
        expect(of(hero.id, 'defeated')).toHaveLength(1);
        const landed = of(hero.id, 'enemy').filter(e => e.hit);
        expect(landed[0]).toMatchObject({ lastStand: true, heroHpRemaining: 1 });
    });

    it('Twin Shot: twelve attacks for six arrows', () => {
        expect(setUpTwinShotScene().ok).toBe(true);
        const hero = heroNamed('QA Twin Archer');
        step(40_000);
        const attacks = of(hero.id, 'attack');
        expect(attacks).toHaveLength(12);
        expect(attacks.filter(a => a.ammoId === QA_CT.ARROW)).toHaveLength(6);
        expect(InventoryManager.getItemCount(QA_CT.ARROW)).toBe(0);
    });

    it('Double Cast: each Mote casts twice', () => {
        expect(setUpDoubleCastScene().ok).toBe(true);
        const hero = heroNamed('QA Double Mage');
        step(30_000);
        const casts = of(hero.id, 'attack');
        expect(casts.filter(a => a.ammoId === QA_CT.MOTE)).toHaveLength(4);
        expect(casts.slice(0, 8).filter(a => a.twin)).toHaveLength(4);
    });

    it('Shadowstep: a sure crit after each miss on the hero', () => {
        expect(setUpShadowstepScene().ok).toBe(true);
        const hero = heroNamed('QA Shadow');
        step(60_000);
        const sure = of(hero.id, 'attack').filter(a => a.sureCrit);
        expect(sure.length).toBeGreaterThan(3);
        expect(sure.every(a => a.crit)).toBe(true);
        expect(of(hero.id, 'trick', TRICK.DODGE_CRIT)).toHaveLength(sure.length);
    });
});
