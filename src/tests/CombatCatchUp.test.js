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
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Fights during time away end exactly where the same time played live ends: every swing's miss
 * and crit come from `Math.random` in a fixed order, so a catch-up that replays the same steps
 * replays the same fights. A Melee 30 hero wins a run of duels with two elixirs working; a
 * new hero eats, loses one and is carried home, wounded.
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

const forTheFight = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
});
const provides = (type, value) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value }, to: null });

registerEffects({
    catchup_fx_valor: { id: 'catchup_fx_valor', name: 'Valor', statements: [provides('DAMAGE', 1)] },
    catchup_fx_ironskin: { id: 'catchup_fx_ironskin', name: 'Ironskin', statements: [provides('ARMOR', 1)] },
    catchup_fx_elixir_valor: { id: 'catchup_fx_elixir_valor', name: 'Elixir of Valor', statements: [forTheFight('catchup_fx_valor')] },
    catchup_fx_elixir_ironskin: { id: 'catchup_fx_elixir_ironskin', name: 'Elixir of Ironskin', statements: [forTheFight('catchup_fx_ironskin')] }
});

registerItems({
    catchup_sword: { id: 'catchup_sword', name: 'Catch-up Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 6 },
    catchup_valor: { id: 'catchup_valor', name: 'Valor', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'catchup_fx_elixir_valor' }] },
    catchup_ironskin: { id: 'catchup_ironskin', name: 'Ironskin', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'catchup_fx_elixir_ironskin' }] },
    catchup_bread: { id: 'catchup_bread', name: 'Bread', equipSlot: 'food', stackable: true, restoreAmount: 2 },
    catchup_ale: { id: 'catchup_ale', name: 'Ale', equipSlot: 'drink', stackable: true, restoreAmount: 2 }
});

const SUPPLIES = ['catchup_valor', 'catchup_ironskin', 'catchup_bread', 'catchup_ale'];

registerTokenTypes({
    catchup_duel_enemy: {
        id: 'catchup_duel_enemy', name: 'Catch-up Duel Enemy', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 6, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
        }
    }
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

/**
 * A Melee 30 hero with a sword and both elixirs, and a new hero with bread, ale and a Valor, each
 * pinned to a level 5 enemy of their own (six of it), far apart.
 */
function buildBoard() {
    stream.state = 7;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [fighter, recruit] = fixtures.makeHeroes(2, {});
    fighter.skills.melee = { level: 30, xp: xpForLevel(30) };
    fighter.equipment[0] = 'catchup_sword';
    fighter.equipment[1] = 'catchup_valor';
    fighter.equipment[2] = 'catchup_ironskin';
    recruit.equipment[0] = 'catchup_bread';
    recruit.equipment[1] = 'catchup_ale';
    recruit.equipment[2] = 'catchup_valor';
    InventoryManager.addItem('catchup_valor', 2);
    InventoryManager.addItem('catchup_ironskin', 1);
    InventoryManager.addItem('catchup_bread', 2);
    InventoryManager.addItem('catchup_ale', 3);
    HeroManager.updateHeroFromSkills(fighter);
    fighter.hp.current = fighter.hp.max;
    const a = fixtures.placeAt('catchup_duel_enemy', 400, 400);
    const b = fixtures.placeAt('catchup_duel_enemy', 1300, 400);
    fixtures.orderAt(fighter.id, { x: a.x, y: a.y });
    fixtures.orderAt(recruit.id, { x: b.x, y: b.y });
    TileModifiers.rebuildAll();
    return { fighterId: fighter.id, recruitId: recruit.id };
}

function listen() {
    const seen = { kills: 0, defeats: 0, heroSwings: 0, enemySwings: 0, crits: 0, misses: 0, meals: [], elixirs: 0 };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => { if (p.elixir) seen.elixirs++; else seen.meals.push(p.itemId); }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { seen.heroSwings++; if (p.crit) seen.crits++; if (!p.hit) seen.misses++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => { seen.enemySwings++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

const heroState = ({ fighterId, recruitId }) => Object.fromEntries([fighterId, recruitId].map(id => {
    const h = GameState.state.heroes.find(x => x.id === id);
    return [id, {
        hp: { ...h.hp }, status: h.status, xp: h.skills.melee?.xp ?? null, woundedRemainingMs: h.woundedRemainingMs ?? null,
        elixirFights: { ...(h.elixirFights || {}) }, effects: (h.effects || []).map(e => e.effectId)
    }];
}));

const end = (ids, seen) => ({
    heroes: heroState(ids),
    uses: BoardState.tokens().filter(t => t.typeId === 'catchup_duel_enemy').map(t => t.usesRemaining),
    bank: Object.fromEntries(SUPPLIES.map(id => [id, InventoryManager.getItemCount(id)])),
    draws: stream.draws,
    seen
});

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

describe('fights during a catch-up', () => {
    it('end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let ids = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(ids, seen.stop());

        ids = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(ids, seen.stop());

        // The UI listeners are quiet in a catch-up, but these engine events are not.
        expect(caughtUp).toEqual(plain);

        // And the fights really happened: the fighter won several duels and earned XP; the
        // new hero lost and was carried home.
        expect(plain.seen.kills).toBeGreaterThanOrEqual(3);
        expect(plain.seen.defeats).toBeGreaterThanOrEqual(1);
        expect(plain.seen.misses).toBeGreaterThan(0);
        expect(plain.heroes[ids.fighterId].xp).toBeGreaterThan(xpForLevel(30));

        // And the supplies were used: both of the fighter's elixirs and the new hero's Valor were
        // drunk, and the new hero ate but never drank (drinks do not heal in a fight).
        expect(plain.seen.elixirs).toBeGreaterThanOrEqual(3);
        expect(plain.heroes[ids.fighterId].elixirFights.catchup_valor).toBeLessThan(10);
        expect(plain.heroes[ids.fighterId].elixirFights.catchup_ironskin).toBeLessThan(10);
        expect(plain.seen.meals.length).toBeGreaterThanOrEqual(1);
        expect(plain.seen.meals).not.toContain('catchup_ale');
    }, 60_000);
});
