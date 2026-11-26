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
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { resetMatTuning } from '../config/matTuning.js';
import {
    setUpArcherScene, setUpMageScene, setUpKunaiScene, setUpCritScene, setUpPoisonScene, QA_CS
} from '../ui/dev/combatStylesScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's combat styles scenes (brief 750's eye-check), played through the real loop: each
 * shows what the owner is asked to look at. ⚠️ Deleted with the scenes once the eye-check is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };
const heroNamed = (name) => (HeroManager.getAllHeroes() || []).find(h => h.name === name);

let attacks;
let needs;
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
    attacks = [];
    needs = [];
    offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => attacks.push(p)),
        EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => needs.push(p))
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

describe('the QA combat styles scenes', () => {
    it('Archer, 3 arrows: three shots, then the archer stops and says Needs Test Arrow', () => {
        const r = setUpArcherScene(3);
        expect(r.ok, r.error).toBe(true);
        const archer = heroNamed('QA Archer');
        expect(InventoryManager.getItemCount(QA_CS.ARROW)).toBe(3);
        step(30_000);
        expect(attacks.filter(a => a.heroId === archer.id)).toHaveLength(3);
        expect(BoardCombat.fightOfHero(archer.id)).toBeNull();
        expect(needs.some(n => n.heroId === archer.id && n.itemId === QA_CS.ARROW)).toBe(true);
    });

    it('Archer, no arrows: no fight, Needs Test Arrow', () => {
        expect(setUpArcherScene(0).ok).toBe(true);
        const archer = heroNamed('QA Archer, no arrows');
        step(8_000);
        expect(attacks).toHaveLength(0);
        expect(needs.some(n => n.heroId === archer.id && n.itemId === QA_CS.ARROW)).toBe(true);
    });

    it('Mage, 3 Motes: three casts, then half damage and Needs once', () => {
        expect(setUpMageScene().ok).toBe(true);
        const mage = heroNamed('QA Mage');
        step(40_000);
        const casts = attacks.filter(a => a.heroId === mage.id);
        expect(casts.slice(0, 3).every(a => a.ammoId === QA_CS.MOTE)).toBe(true);
        expect(casts.slice(3).length).toBeGreaterThan(3);
        expect(casts.slice(3).every(a => a.short)).toBe(true);
        expect(needs.filter(n => n.heroId === mage.id && n.itemId === QA_CS.MOTE)).toHaveLength(1);
    });

    it('Kunai, none spare: half damage, Needs Test Kunai', () => {
        expect(setUpKunaiScene().ok).toBe(true);
        const thrower = heroNamed('QA Kunai Thrower');
        expect(CombatFormulas.getHeroWeapon(thrower)?.id).toBe(QA_CS.KUNAI);
        step(10_000);
        const throws = attacks.filter(a => a.heroId === thrower.id);
        expect(throws.length).toBeGreaterThan(2);
        expect(throws.every(a => a.short)).toBe(true);
        expect(needs.filter(n => n.heroId === thrower.id && n.itemId === QA_CS.KUNAI)).toHaveLength(1);
    });

    it('Crit at the cap: 75 %, about three landed hits in four crit', () => {
        expect(setUpCritScene().ok).toBe(true);
        const fighter = heroNamed('QA Lucky Fighter');
        expect(CombatFormulas.heroCritChance(fighter)).toBe(75);
        step(120_000);
        const hits = attacks.filter(a => a.heroId === fighter.id && a.hit);
        expect(hits.length).toBeGreaterThan(15);
        const share = hits.filter(a => a.crit).length / hits.length;
        expect(share).toBeGreaterThan(0.5);
        expect(share).toBeLessThan(0.95);
    });

    it('Poison: the dagger hero takes one for five attacks; the sword hero takes none', () => {
        const taken = [];
        offs.push(EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => { if (p.poison) taken.push(p.heroId); }));
        expect(setUpPoisonScene().ok).toBe(true);
        const poisoner = heroNamed('QA Poisoner');
        const swordsman = heroNamed('QA Swordsman');
        step(6_000);
        expect(taken).toEqual([poisoner.id]);
        expect(InventoryManager.getItemCount(QA_CS.VENOM)).toBe(2);
        step(30_000);
        expect(poisoner.poisonAttacks[QA_CS.VENOM]).toBe(0);
        expect(swordsman.poisonAttacks).toBeUndefined();
    });
});
