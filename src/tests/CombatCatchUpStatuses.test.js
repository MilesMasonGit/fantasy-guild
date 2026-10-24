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
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { registerStatusFixtures, providesPct, providesFlat, POISON, BURN } from './fixtures/statusEffects.js';

/**
 * Statuses and boss moves during a catch-up (brief 220, C4): a Venomous enemy's Poison, a burning
 * attacker's Burn (with its half-healing food), and a boss using all four moves, against fed
 * heroes. Every random number comes from `Math.random` in a fixed order (a chance on a rule is the
 * only draw these add), and the 3 s Rules tick runs on the loop's own clock, so time away ends
 * exactly where the same time played live ends. The harness is `CombatCatchUpGear.test.js`'s.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 6 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerStatusFixtures();

registerItems({
    cus_sword: { id: 'cus_sword', name: 'Catch-up Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 4 }
});

const rule = (id, keyword, when, role, payload) => ({
    ...makeStatement(keyword), id, when: { scope: 'self', ...when }, target: { role }, payload, chargeDelta: 0
});

registerEffects({
    cus_heavy_strike: { id: 'cus_heavy_strike', name: 'Heavy Strike', statements: [providesPct('stm_cus_heavy', EFFECT_TYPES.DAMAGE, 1)] },
    cus_stone_skin: { id: 'cus_stone_skin', name: 'Stone Skin', statements: [providesFlat('stm_cus_skin', EFFECT_TYPES.ARMOR, 2)] },
    cus_enrage: { id: 'cus_enrage', name: 'Enrage', statements: [providesPct('stm_cus_enrage', EFFECT_TYPES.SWING_TIME, -0.5)] },
    // The boss's four moves, each a library effect so it announces itself by name.
    cus_move_heavy: { id: 'cus_move_heavy', name: 'Boss Heavy', statements: [
        rule('stm_cus_m_heavy', KEYWORD.APPLIES, { event: 'FIGHT_SWING', every: 4 }, ROLE.OPPONENT, { effectId: 'cus_heavy_strike', forSwing: true, chance: 100 })] },
    cus_move_burn: { id: 'cus_move_burn', name: 'Boss Burn', statements: [
        // A chance, so the moves draw random numbers too.
        rule('stm_cus_m_burn', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 3 }, ROLE.ACTOR, { effectId: BURN, chance: 60 })] },
    cus_move_mend: { id: 'cus_move_mend', name: 'Boss Mend', statements: [
        rule('stm_cus_m_heal', KEYWORD.HEALS, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, ROLE.SELF, { amount: 8 }),
        rule('stm_cus_m_skin', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, ROLE.OPPONENT, { effectId: 'cus_stone_skin', forFight: true, chance: 100 })] },
    cus_move_enrage: { id: 'cus_move_enrage', name: 'Boss Enrage', statements: [
        rule('stm_cus_m_enrage', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 30 }, ROLE.OPPONENT, { effectId: 'cus_enrage', forFight: true, chance: 100 })] },
    cus_burning_touch: { id: 'cus_burning_touch', name: 'Burning Touch', statements: [
        rule('stm_cus_touch', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 2 }, ROLE.ACTOR, { effectId: BURN, chance: 100 })] }
});

const enemy = (id, name, enemyBlock, effects = []) => ({
    id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 40, sprite: 's_crime', requiresHero: true,
    enemy: { style: 'melee', ...enemyBlock },
    effects,
    config: {
        skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
        outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
    }
});

registerTokenTypes({
    cus_venom: enemy('cus_venom', 'Catch-up Venomous', { level: 12, kinds: ['venomous'] }),
    cus_burner: enemy('cus_burner', 'Catch-up Burner', { level: 12 }, [{ effectId: 'cus_burning_touch' }]),
    cus_boss: enemy('cus_boss', 'Catch-up Boss', { level: 15, hp: 60 }, [
        { effectId: 'cus_move_heavy' }, { effectId: 'cus_move_burn' }, { effectId: 'cus_move_mend' }, { effectId: 'cus_move_enrage' }
    ])
});

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

/** Three fed Melee 30 heroes with a sword, each pinned to one enemy: Venomous, the burner, the boss. */
function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    LiveEffects.resetClock();
    const heroes = fixtures.makeHeroes(3, {});
    InventoryManager.addItem('item_shrimp', 60);
    InventoryManager.addItem('cus_sword', 3);
    const spots = [[300, 300], [700, 300], [1100, 300]];
    const types = ['cus_venom', 'cus_burner', 'cus_boss'];
    heroes.forEach((hero, i) => {
        hero.skills.melee = { level: 30, xp: xpForLevel(30) };
        expect(EquipmentManager.equipItem(hero.id, 'cus_sword').success).toBe(true);
        expect(EquipmentManager.equipItem(hero.id, 'item_shrimp').success).toBe(true);
        HeroManager.updateHeroFromSkills(hero);
        hero.hp.current = hero.hp.max;
        const at = fixtures.placeAt(types[i], spots[i][0], spots[i][1]);
        fixtures.plant(hero.id, { x: at.x, y: at.y }, { pin: true });
    });
    TileModifiers.rebuildAll();
    return heroes.map(h => h.id);
}

function listen() {
    const seen = { kills: 0, defeats: 0, applied: {}, ticks: 0, moves: {}, meals: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => { seen.applied[p.statusId] = (seen.applied[p.statusId] || 0) + 1; }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_DOT_TICK, () => { seen.ticks++; }),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { seen.moves[p.title] = (seen.moves[p.title] || 0) + 1; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATE, (p) => { seen.meals.push(p.healed); })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

function end(heroIds, seen) {
    return {
        heroes: heroIds.map((id) => {
            const h = GameState.state.heroes.find(x => x.id === id);
            return { hp: { ...h.hp }, status: h.status, xp: h.skills.melee?.xp ?? null, statuses: LiveEffects.statusesOf(h) };
        }),
        uses: BoardState.tokens().filter(t => t.typeId.startsWith('cus_')).map(t => [t.typeId, t.usesRemaining]),
        shrimp: InventoryManager.getItemCount('item_shrimp'),
        draws: stream.draws,
        seen
    };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('poison, burn and boss moves during a catch-up', () => {
    it('end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let heroIds = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(heroIds, seen.stop());

        heroIds = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(heroIds, seen.stop());

        expect(caughtUp).toEqual(plain);

        // It all really ran: poison and burn landed and ticked, every boss move fired, and a
        // burning hero's meal healed less than a whole Shrimp.
        expect(plain.seen.kills).toBeGreaterThanOrEqual(3);
        expect(plain.seen.applied[POISON]).toBeGreaterThan(0);
        expect(plain.seen.applied[BURN]).toBeGreaterThan(0);
        expect(plain.seen.ticks).toBeGreaterThan(0);
        for (const move of ['Boss Heavy', 'Boss Burn', 'Boss Mend', 'Boss Enrage', 'Burning Touch']) {
            expect(plain.seen.moves[move], move).toBeGreaterThan(0);
        }
        expect(plain.seen.meals).toContain(5);
        expect(plain.seen.meals).toContain(3);
    }, 120_000);
});
