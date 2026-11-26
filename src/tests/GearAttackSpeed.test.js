// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getPaletteEntry, bucketsFor } from '../config/registries/modifierPalette.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { registerProvides } from '../systems/effects/providesModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { heroSide } from '../ui/components/combat/fightView.js';
import { heroCombatStats } from '../ui/components/dock/heroCombatStats.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';
import { resetMatTuning } from '../config/matTuning.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Gear can carry Attack Speed (brief 750 S6, T-657): a held weapon's always-on Swing Time, or any
 * worn piece's, counts in the fight's attack timing as a lingering one does, in the same bucket, and
 * narrowed to the style it names. The item's tooltip and the hero's stats say so; time away attacks
 * exactly as often as the loop; a reload keeps it. Fixture items only, never `data/`.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 2 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Attack Speed +10%: a Swing Time of −10 %, as the CMS stores a percentage. */
const quick = (id, category) => ({
    id, name: 'Quick Casts',
    statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.SWING_TIME, bucket: 'percentage', value: -0.1, ...(category ? { category } : {}) } }]
});
registerEffects({
    gas_quick: quick('gas_quick'),
    gas_quick_magic: quick('gas_quick_magic', 'magic'),
    gas_quick_melee: quick('gas_quick_melee', 'melee')
});
const wand = (id, extra = {}) => ({ id, name: id, type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['magic'], damage: 2, ...extra });
registerItems({
    gas_plain_wand: wand('gas_plain_wand', { name: 'Plain Wand' }),
    gas_wand: wand('gas_wand', { name: 'Quick Wand', effects: [{ effectId: 'gas_quick' }] }),
    gas_magic_wand: wand('gas_magic_wand', { name: 'Mage Wand', effects: [{ effectId: 'gas_quick_magic' }] }),
    gas_melee_wand: wand('gas_melee_wand', { name: 'Odd Wand', effects: [{ effectId: 'gas_quick_melee' }] }),
    gas_ring: { id: 'gas_ring', name: 'Quick Ring', type: 'armor', equipSlot: 'trinket', stackable: true, effects: [{ effectId: 'gas_quick' }] },
    gas_snack: { id: 'gas_snack', name: 'Quick Snack', type: 'food', equipSlot: 'food', stackable: true, restoreAmount: 1, effects: [{ effectId: 'gas_quick' }] }
});
registerTokenTypes({
    gas_target: {
        id: 'gas_target', name: 'Target', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'ranged', hp: 100000 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
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

function fresh() {
    stream.state = 31;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    BoardCombat.clearAll();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
}

const equip = (hero, itemId) => {
    if (!InventoryManager.hasItem(itemId, 1)) InventoryManager.addItem(itemId, 1);
    const res = EquipmentManager.equipItem(hero.id, itemId);
    expect(res.success, res.error).toBe(true);
};

let made = 0;
function mage(name = 'Mira') {
    const hero = generateHero({ name });
    hero.id = `hero_gas_${made++}`;
    for (const skill of ['magic', 'melee']) hero.skills[skill] = { level: 20, xp: xpForLevel(20) };
    GameState.state.progress.rosterLimit = Math.max(GameState.state.progress.rosterLimit || 0, GameState.state.heroes.length + 1);
    expect(HeroManager.addHero(hero)).toBeTruthy();
    HeroManager.updateHeroFromSkills(hero);
    hero.hp = { current: 5000, max: 5000 };
    return hero;
}

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
beforeEach(fresh);
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

describe('a held weapon\'s Attack Speed counts in the attack timing', () => {
    it('a normal wand attacks every 3 s; the same wand with Attack Speed +10% every 2.7 s', () => {
        const plain = mage('Plain');
        equip(plain, 'gas_plain_wand');
        expect(CombatFormulas.heroAttackSpeedMs(plain)).toBe(3000);
        const quickHero = mage('Quick');
        equip(quickHero, 'gas_wand');
        expect(CombatFormulas.heroAttackSpeedMs(quickHero)).toBe(2700);
    });

    it('narrowed to the style it names: a Magic rule counts on a wand, a Melee one does not', () => {
        const a = mage('A');
        equip(a, 'gas_magic_wand');
        expect(CombatFormulas.heroAttackSpeedMs(a)).toBe(2700);
        const b = mage('B');
        equip(b, 'gas_melee_wand');
        expect(CombatFormulas.heroAttackSpeedMs(b)).toBe(3000);
    });

    it('a worn ring\'s adds to the weapon\'s in the same bucket, and to a lingering one\'s', () => {
        const hero = mage();
        equip(hero, 'gas_wand');
        equip(hero, 'gas_ring');
        expect(CombatFormulas.heroAttackSpeedMs(hero)).toBe(2400);
        // An elixir's −25 % for the fight, through the lingering effects' own road: −45 % in all.
        registerProvides(hero.aggregator, 'live:effects', [
            { ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.SWING_TIME, bucket: 'percentage', value: -0.25 } }
        ]);
        expect(CombatFormulas.heroAttackSpeedMs(hero)).toBe(1650);
    });

    it('a meal carried lends nothing (a spent item\'s always-on rule never counts); taking the wand off ends it', () => {
        const hero = mage();
        equip(hero, 'gas_plain_wand');
        equip(hero, 'gas_snack');
        expect(CombatFormulas.heroAttackSpeedMs(hero)).toBe(3000);

        const other = mage('Other');
        equip(other, 'gas_wand');
        expect(CombatFormulas.heroAttackSpeedMs(other)).toBe(2700);
        const slot = other.equipment.indexOf('gas_wand');
        expect(EquipmentManager.unequipItem(other.id, slot).success).toBe(true);
        expect(CombatFormulas.heroAttackSpeedMs(other)).toBe(3000);
    });
});

/** A board with each hero sent at its own tough Target. */
function fightBoard(wands) {
    const heroes = wands.map((wandId, i) => {
        const hero = mage(`Mage ${i}`);
        equip(hero, wandId);
        const target = fixtures.placeAt('gas_target', 400 + i * 700, 500);
        expect(fixtures.orderAt(hero.id, { x: target.x, y: target.y }).success).toBe(true);
        return hero;
    });
    TileModifiers.rebuildAll();
    return heroes;
}

function attackTimes() {
    const at = {};
    const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
        (at[p.heroId] ||= []).push(GameState.state.time.gameTimeMs);
    });
    return { at, off };
}
const gaps = (times) => times.slice(1).map((t, i) => t - times[i]);

describe('in a fight', () => {
    it('the hero attacks at the faster pace, every 2.7 s against the plain wand\'s 3 s', () => {
        const [plain, quickHero] = fightBoard(['gas_plain_wand', 'gas_wand']);
        const watch = attackTimes();
        for (let i = 0; i < 600; i++) GameLoop.runHandlers(100);
        watch.off();
        const plainGaps = gaps(watch.at[plain.id]);
        const quickGaps = gaps(watch.at[quickHero.id]);
        expect(plainGaps.length).toBeGreaterThan(10);
        expect(new Set(plainGaps)).toEqual(new Set([3000]));
        expect(new Set(quickGaps)).toEqual(new Set([2700]));
    });
});

describe('time away', () => {
    function board() {
        fresh();
        return fightBoard(['gas_plain_wand', 'gas_wand', 'gas_magic_wand']);
    }
    const end = (heroes, watch) => ({
        attacks: heroes.map(h => (watch.at[h.id] || []).length),
        enemies: BoardState.tokens().filter(t => t.typeId === 'gas_target').map(t => t.fightHp?.current ?? 'whole'),
        xp: heroes.map(h => GameState.state.heroes.find(x => x.id === h.id).skills.magic.xp),
        draws: stream.draws
    });

    it('a catch-up attacks exactly as often as the same 1000 ms steps through the loop', async () => {
        let heroes = board();
        let watch = attackTimes();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        watch.off();
        const plain = end(heroes, watch);

        heroes = board();
        watch = attackTimes();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        watch.off();
        const caughtUp = end(heroes, watch);

        expect(caughtUp).toEqual(plain);
        // And it really was faster: both quick wands attacked more often than the plain one.
        const [p, q, m] = plain.attacks;
        expect(q).toBeGreaterThan(p);
        expect(m).toBe(q);
    }, 60_000);
});

describe('a reload', () => {
    it('keeps the wand\'s pace: the loadout is registered again as the save loads', () => {
        const hero = mage();
        equip(hero, 'gas_wand');
        const data = JSON.parse(GameState.serializeJson());
        loadSavedState(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        expect(CombatFormulas.heroAttackSpeedMs(HeroManager.getHero(hero.id))).toBe(2700);
    });
});

describe('where the player sees it', () => {
    it('the hero\'s stats: the fight panel and the hero drawer say every 2.7 s', () => {
        const hero = mage();
        equip(hero, 'gas_wand');
        expect(heroSide(hero).attackEveryMs).toBe(2700);
        expect(heroCombatStats(hero).attackEveryMs).toBe(2700);
    });

    it('the item\'s tooltip: Attacks every 2.7s, and the rule in words', () => {
        const stat = (id) => itemTipFacts(getItem(id)).stats.find(r => r.id === 'attackEvery').value;
        expect(stat('gas_plain_wand')).toBe('3s');
        expect(stat('gas_wand')).toBe('2.7s');
        expect(stat('gas_magic_wand')).toBe('2.7s');
        // A rule for another style does nothing on this wand, so its own figure stays.
        expect(stat('gas_melee_wand')).toBe('3s');
        const lines = itemTipFacts(getItem('gas_wand')).effects.rows.flatMap(r => r.lines.map(segs => segs.map(s => s.text ?? s).join('')));
        expect(lines.join(' | ')).toMatch(/Attack Speed \+10%/);
    });
});

describe('the CMS', () => {
    it('Attack Speed is offered for gear: a percentage, and its hint says gear and perks carry it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.SWING_TIME);
        expect(entry.carriedPercentage).toBe(true);
        expect(bucketsFor(entry)).toEqual(['percentage']);
        expect(entry.hint).toMatch(/gear/i);
        expect(entry.hint).toMatch(/perk/i);
        expect(entry.hint).not.toMatch(/swing/i);
    });
});
