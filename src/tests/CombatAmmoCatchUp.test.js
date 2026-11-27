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
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { enemyCampType } from './fixtures/enemyCamp.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Ammo spent while the player is away ends exactly where the same time played live ends: an archer
 * runs out of arrows part-way and leaves the fight, a mage burns its last Mote and casts on at half,
 * a Kunai thrower throws its last spare and fights on with the one in hand. The catch-up plays the
 * same 1000 ms steps through the same handlers, so the arrows, Motes and Kunai left, every hit, the
 * enemies' wounds and the draws match. A poisoner at an enemy camp takes a poison as each fight
 * starts when the last has run out, its attacks carried from fight to fight (brief 750 S3).
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 3 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    amc_bow: { id: 'amc_bow', name: 'Bow', type: 'weapon', equipSlot: 'hand', styles: ['ranged'], damage: 1, damageType: 'electric' },
    amc_arrow: { id: 'amc_arrow', name: 'Arrow', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    amc_mote: { id: 'amc_mote', name: 'Mote', equipSlot: 'consumable', stackable: true },
    amc_wand: { id: 'amc_wand', name: 'Wand', type: 'weapon', equipSlot: 'hand', styles: ['magic'], damage: 2, damageType: 'fire', mote: 'amc_mote' },
    amc_kunai: { id: 'amc_kunai', name: 'Kunai', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['stealth'], damage: 2, speed: 'fast', thrown: true },
    amc_dagger: { id: 'amc_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['stealth'], damage: 2, speed: 'fast' },
    amc_poison: { id: 'amc_poison', name: 'Poison', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'amc_poison_rule' }] }
});
registerEffects({
    amc_coat: { id: 'amc_coat', name: 'Coat', statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: 'DAMAGE', bucket: 'flat', value: 1 } }] },
    amc_poison_rule: {
        id: 'amc_poison_rule', name: 'Poison rule',
        statements: [{ ...makeStatement(KEYWORD.APPLIES), when: { event: 'COMBAT_ENGAGED', scope: 'self' }, payload: { effectId: 'amc_coat', scale: 1, durationMs: 0, forAttacks: 7, chance: 100 } }]
    }
});

const enemy = (id, style) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_crime', requiresHero: true,
    enemy: { level: 5, style, hp: 2000 },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});
registerTokenTypes({
    amc_target_a: enemy('amc_target_a', 'ranged'),
    amc_target_b: enemy('amc_target_b', 'melee'),
    amc_target_c: enemy('amc_target_c', 'ranged'),
    amc_small: { ...enemy('amc_small', 'ranged'), enemy: { level: 1, style: 'ranged', hp: 25 } }
});
const SMALL_CAMP = enemyCampType('amc_small', { intervalMs: 3000 });

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

function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    // The first run's fights are still going: a hero fighting cannot change gear.
    BoardCombat.clearAll();
    InventoryManager.init();
    const [archer, mage, thief, poisoner] = fixtures.makeHeroes(4, {});
    archer.skills.ranged = { level: 20, xp: xpForLevel(20) };
    mage.skills.magic = { level: 20, xp: xpForLevel(20) };
    thief.skills.stealth = { level: 20, xp: xpForLevel(20) };
    poisoner.skills.stealth = { level: 20, xp: xpForLevel(20) };
    for (const h of [archer, mage, thief, poisoner]) {
        HeroManager.updateHeroFromSkills(h);
        // Enough health that nobody is defeated: each fight runs the whole time away.
        h.hp = { current: 5000, max: 5000 };
    }
    const give = (hero, itemId, n) => {
        InventoryManager.addItem(itemId, n);
        expect(EquipmentManager.equipItem(hero.id, itemId).success).toBe(true);
    };
    give(archer, 'amc_bow', 1);
    give(archer, 'amc_arrow', 12);
    give(mage, 'amc_wand', 1);
    give(mage, 'amc_mote', 9);
    give(thief, 'amc_kunai', 8);
    give(poisoner, 'amc_dagger', 1);
    give(poisoner, 'amc_poison', 40);
    const a = fixtures.placeAt('amc_target_a', 400, 400);
    const b = fixtures.placeAt('amc_target_b', 1100, 400);
    const c = fixtures.placeAt('amc_target_c', 1800, 400);
    fixtures.orderAt(archer.id, { x: a.x, y: a.y });
    fixtures.orderAt(mage.id, { x: b.x, y: b.y });
    fixtures.orderAt(thief.id, { x: c.x, y: c.y });
    const camp = fixtures.placeAt(SMALL_CAMP, 1100, 1100);
    fixtures.orderAt(poisoner.id, { x: camp.x, y: camp.y });
    TileModifiers.rebuildAll();
    return { ids: [archer.id, mage.id, thief.id, poisoner.id] };
}

function listen() {
    const seen = { attacks: [] };
    const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
        seen.attacks.push(`${p.heroId}|${p.hit ? p.damage : 'miss'}${p.crit ? '!' : ''}|${p.ammoId || ''}|${p.short ? 'half' : ''}`);
    });
    return { seen, stop: () => { off(); return seen; } };
}

const end = ({ ids }, seen) => ({
    heroes: ids.map(id => {
        const h = GameState.state.heroes.find(x => x.id === id);
        return { id, hp: { ...h.hp }, status: h.status, fighting: !!BoardCombat.fightOfHero(id), poisonAttacks: h.poisonAttacks || null };
    }),
    enemies: BoardState.tokens().filter(t => t.typeId.startsWith('amc_')).map(t => `${t.typeId}:${t.fightHp?.current ?? 'whole'}`),
    left: ['amc_arrow', 'amc_mote', 'amc_kunai', 'amc_poison'].map(id => InventoryManager.getItemCount(id)),
    kills: GameState.state.collection?.cyclesByTokenType?.amc_small || 0,
    draws: stream.draws,
    seen
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('ammo spent during a catch-up', () => {
    it('ends exactly where the same 1000 ms steps through the plain loop end', async () => {
        let board = buildBoard();
        let watch = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(board, watch.stop());

        board = buildBoard();
        watch = listen();
        const result = await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(board, watch.stop());

        // The away summary counts what was spent beside food, elixirs and drops (brief 750 S4).
        expect(result.summary.combat.ammo).toEqual({ amc_arrow: 12, amc_mote: 9, amc_kunai: 7 });
        expect(result.summary.combat.poisons.amc_poison).toBe(40 - InventoryManager.getItemCount('amc_poison'));

        expect(caughtUp).toEqual(plain);

        // And it really happened: every arrow shot and the archer gone from the fight (its enemy,
        // left hurt, has healed back since); every Mote and spare Kunai spent, then attacks at half.
        const [archerId, mageId, thiefId] = board.ids;
        const of = (id) => plain.seen.attacks.filter(a => a.startsWith(`${id}|`));
        expect(of(archerId)).toHaveLength(12);
        expect(plain.left.slice(0, 3)).toEqual([0, 0, 0]);
        expect(plain.heroes[0].fighting).toBe(false);
        expect(of(mageId).filter(a => a.endsWith('|amc_mote|'))).toHaveLength(9);
        expect(of(mageId).filter(a => a.endsWith('|half')).length).toBeGreaterThan(5);
        expect(of(thiefId).filter(a => a.endsWith('|amc_kunai|'))).toHaveLength(7);
        expect(of(thiefId).filter(a => a.endsWith('|half')).length).toBeGreaterThan(5);
        expect(plain.heroes[1].fighting && plain.heroes[2].fighting).toBe(true);
        // Several fights at the camp: poisons taken as fights started, one a dose of seven attacks.
        expect(plain.kills).toBeGreaterThan(3);
        expect(plain.left[3]).toBeLessThan(39);
        expect(plain.left[3]).toBeGreaterThan(0);
    }, 60_000);
});
