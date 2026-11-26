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
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { TRICK } from '../systems/combat/CombatTricks.js';
import * as fightWatch from '../ui/components/combat/fightWatch.js';
import { t } from '../i18n/index.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { resetMatTuning } from '../config/matTuning.js';
import { enemyCampType } from './fixtures/enemyCamp.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * ⭐ The combat tricks (brief 800 P5, T-652 to T-654), each a CMS effect a fixture perk carries
 * (never `data/`), read off the hero for the style they fight in:
 *
 * - **Heal on Kill** (Second Wind, Melee 75): each kill heals the hero a few health, never past
 *   their most.
 * - **Last Stand** (Unbreakable, Melee 99): once a fight, an enemy's blow that would defeat the hero
 *   leaves them at 1 health; the next defeating blow defeats them. A new fight has it again; a
 *   game saved and loaded mid-fight does not (the mark is saved on the hero).
 * - **Twin Strike** (Twin Shot, Ranged 99; Double Cast, Magic 99): a chance an attack strikes again
 *   at once, its arrow or Mote spent once.
 * - **Crit After Dodge** (Shadowstep, Stealth 99): an enemy's attack missing the hero makes the
 *   hero's next landed hit a sure crit.
 *
 * Each is named in the fight log. Time away plays them exactly as the loop does.
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

const trick = (id, name, type, value, category) => ({
    id, name,
    statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type, bucket: 'flat', value, ...(category ? { category } : {}) } }]
});
registerEffects({
    ct_second_wind: trick('ct_second_wind', 'Second Wind', EFFECT_TYPES.KILL_HEAL, 3, 'melee'),
    ct_unbreakable: trick('ct_unbreakable', 'Unbreakable', EFFECT_TYPES.LAST_STAND, 100, 'melee'),
    ct_twin_shot: trick('ct_twin_shot', 'Twin Shot', EFFECT_TYPES.TWIN_STRIKE, 100, 'ranged'),
    ct_double_cast: trick('ct_double_cast', 'Double Cast', EFFECT_TYPES.TWIN_STRIKE, 100, 'magic'),
    ct_shadowstep: trick('ct_shadowstep', 'Shadowstep', EFFECT_TYPES.DODGE_CRIT, 100, 'stealth'),
    ct_poison_coat: trick('ct_poison_coat', 'Coat', EFFECT_TYPES.DAMAGE, 1),
    ct_poison_rule: {
        id: 'ct_poison_rule', name: 'Poison rule',
        statements: [{ ...makeStatement(KEYWORD.APPLIES), when: { event: 'COMBAT_ENGAGED', scope: 'self' }, payload: { effectId: 'ct_poison_coat', scale: 1, durationMs: 0, forAttacks: 6, chance: 100 } }]
    }
});
const PERKS = {
    melee: { perks: [{ level: 75, effectId: 'ct_second_wind' }, { level: 99, effectId: 'ct_unbreakable' }] },
    ranged: { perks: [{ level: 99, effectId: 'ct_twin_shot' }] },
    magic: { perks: [{ level: 99, effectId: 'ct_double_cast' }] },
    stealth: { perks: [{ level: 99, effectId: 'ct_shadowstep' }] }
};
const NO_PERKS = { melee: { perks: [] }, ranged: { perks: [] }, magic: { perks: [] }, stealth: { perks: [] } };

registerItems({
    ct_sword: { id: 'ct_sword', name: 'Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 3 },
    ct_bow: { id: 'ct_bow', name: 'Bow', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['ranged'], damage: 1 },
    ct_arrow: { id: 'ct_arrow', name: 'Arrow', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    ct_mote: { id: 'ct_mote', name: 'Mote', equipSlot: 'consumable', stackable: true },
    ct_wand: { id: 'ct_wand', name: 'Wand', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['magic'], damage: 2, damageType: 'fire', mote: 'ct_mote' },
    ct_dagger: { id: 'ct_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['stealth'], damage: 2, speed: 'fast' },
    ct_poison: { id: 'ct_poison', name: 'Poison', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'ct_poison_rule' }] }
});
const enemy = (id, stats) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_crime', requiresHero: true,
    enemy: { level: 1, style: 'ranged', ...stats },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});
registerTokenTypes({
    // Falls in two or three hits: a camp of them gives a kill every few seconds.
    ct_weak: enemy('ct_weak', { hp: 6, hit: 1 }),
    // Never falls in a test; every landed blow would defeat a hero of 10 health.
    ct_brute: enemy('ct_brute', { hp: 1000000, hit: 50, accuracy: 30 }),
    // Never falls; misses often and hits for 1.
    ct_clumsy: enemy('ct_clumsy', { hp: 1000000, hit: 1, accuracy: -40 }),
    ct_post: enemy('ct_post', { hp: 1000000, hit: 1 })
});
const WEAK_CAMP = enemyCampType('ct_weak', { intervalMs: 1500 });

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let x = stream.state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

function fresh(seed = 41) {
    stream.state = seed;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    BoardCombat.clearAll();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
}

let made = 0;
/** A hero at `level` in every combat style (so the perks at 75 and 99 are held), with `hp` health. */
function fighter(name, { level = 99, hp = 5000 } = {}) {
    const hero = generateHero({ name });
    hero.id = `hero_ct_${made++}`;
    for (const skill of ['melee', 'ranged', 'magic', 'stealth']) hero.skills[skill] = { level, xp: xpForLevel(level) };
    GameState.state.progress.rosterLimit = Math.max(GameState.state.progress.rosterLimit || 0, GameState.state.heroes.length + 1);
    expect(HeroManager.addHero(hero)).toBeTruthy();
    HeroManager.updateHeroFromSkills(hero);
    hero.hp = { current: hp, max: hp };
    return hero;
}
const equip = (hero, itemId, n = 1) => {
    InventoryManager.addItem(itemId, n);
    const res = EquipmentManager.equipItem(hero.id, itemId);
    expect(res.success, res.error).toBe(true);
};
let nextX = 300;
function sendAt(hero, typeId) {
    const target = fixtures.placeAt(typeId, nextX, 500);
    nextX += 600;
    expect(fixtures.orderAt(hero.id, { x: target.x, y: target.y }).success).toBe(true);
    TileModifiers.rebuildAll();
    return target;
}
const step = (n, ms = 100) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(ms); };

/** Every combat event, in order, for one hero. */
function record() {
    const seen = [];
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => seen.push({ kind: 'attack', ...p })),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.push({ kind: 'enemy', ...p })),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_TRICK, (p) => seen.push({ kind: 'trick', ...p, hpAfter: HeroManager.getHero(p.heroId)?.hp?.current })),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (p) => seen.push({ kind: 'kill', ...p })),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => seen.push({ kind: 'defeated', ...p }))
    ];
    return { seen, stop: () => offs.forEach(off => off()), of: (heroId, kind) => seen.filter(e => e.heroId === heroId && (!kind || e.kind === kind)) };
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
beforeEach(() => {
    registerSkillPerks(PERKS);
    fresh();
    nextX = 300;
});
afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});
afterAll(() => {
    registerSkillPerks(NO_PERKS);
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('Heal on Kill (Second Wind)', () => {
    it('each kill heals the Melee hero 3 health, never past their most', () => {
        const hero = fighter('Bram', { hp: 100 });
        hero.hp.current = 80;
        equip(hero, 'ct_sword');
        sendAt(hero, WEAK_CAMP);
        const log = record();
        step(1200);
        log.stop();
        const kills = log.of(hero.id, 'kill');
        const heals = log.of(hero.id, 'trick').filter(e => e.trick === TRICK.KILL_HEAL);
        expect(kills.length).toBeGreaterThan(3);
        // Each heal is 3, or what tops the hero up to 100; none takes them past it.
        expect(heals.length).toBeGreaterThan(0);
        expect(heals.every(e => e.amount === 3 || e.hpAfter === 100)).toBe(true);
        expect(heals.some(e => e.amount === 3)).toBe(true);
        expect(heals.every(e => e.hpAfter <= 100)).toBe(true);
        // Each heal lands before its kill's loot and end.
        const firstHeal = log.seen.indexOf(heals[0]);
        expect(log.seen[firstHeal + 1].kind).toBe('kill');
    });

    it('narrowed to Melee: the same hero fighting with a bow heals nothing', () => {
        const hero = fighter('Cara', { hp: 100 });
        hero.hp.current = 50;
        equip(hero, 'ct_bow');
        equip(hero, 'ct_arrow', 200);
        sendAt(hero, WEAK_CAMP);
        const log = record();
        step(1200);
        log.stop();
        expect(log.of(hero.id, 'kill').length).toBeGreaterThan(2);
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.KILL_HEAL)).toEqual([]);
    });
});

describe('Last Stand (Unbreakable)', () => {
    it('once a fight, a defeating blow leaves the hero at 1 health; the next defeats them', () => {
        const hero = fighter('Dain', { hp: 10 });
        equip(hero, 'ct_sword');
        const brute = sendAt(hero, 'ct_brute');
        const log = record();
        let held = null;
        for (let i = 0; i < 3000 && !log.of(hero.id, 'defeated').length; i++) {
            GameLoop.runHandlers(100);
            if (!held && log.of(hero.id, 'trick').some(e => e.trick === TRICK.LAST_STAND)) held = { ...HeroManager.getHero(hero.id).hp };
        }
        log.stop();
        expect(held).toEqual({ current: 1, max: 10 });
        const landed = log.of(hero.id, 'enemy').filter(e => e.hit);
        expect(landed.length).toBe(2);
        expect(landed[0]).toMatchObject({ damage: 9, heroHpRemaining: 1, lastStand: true });
        expect(landed[1].lastStand).toBeUndefined();
        expect(log.of(hero.id, 'defeated')).toHaveLength(1);
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.LAST_STAND)).toHaveLength(1);
        // The fight is over: nothing of it is left on the hero.
        expect(HeroManager.getHero(hero.id).fightTricks).toBeUndefined();
        expect(brute.id).toBeTruthy();
    });

    it('a new fight has it again', () => {
        const hero = fighter('Edda', { hp: 10 });
        equip(hero, 'ct_sword');
        sendAt(hero, 'ct_brute');
        const log = record();
        for (let i = 0; i < 3000 && !log.of(hero.id, 'trick').length; i++) GameLoop.runHandlers(100);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(1);
        // The fight ends and a new one starts against the same brute: a new Last Stand.
        const first = BoardCombat.fightOfHero(hero.id);
        BoardCombat.endFightOfHero(hero.id);
        expect(HeroManager.getHero(hero.id).fightTricks).toBeUndefined();
        GameLoop.runHandlers(100);
        expect(BoardCombat.fightOfHero(hero.id)).toBeTruthy();
        expect(BoardCombat.fightOfHero(hero.id)).not.toBe(first);
        for (let i = 0; i < 3000 && log.of(hero.id, 'trick').length < 2 && !log.of(hero.id, 'defeated').length; i++) GameLoop.runHandlers(100);
        log.stop();
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.LAST_STAND)).toHaveLength(2);
        expect(log.of(hero.id, 'defeated')).toEqual([]);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(1);
    });

    it('narrowed to Melee: with a bow the first defeating blow defeats', () => {
        const hero = fighter('Fenn', { hp: 10 });
        equip(hero, 'ct_bow');
        equip(hero, 'ct_arrow', 500);
        sendAt(hero, 'ct_brute');
        const log = record();
        for (let i = 0; i < 3000 && !log.of(hero.id, 'defeated').length; i++) GameLoop.runHandlers(100);
        log.stop();
        expect(log.of(hero.id, 'enemy').filter(e => e.hit)).toHaveLength(1);
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.LAST_STAND)).toEqual([]);
        expect(log.of(hero.id, 'defeated')).toHaveLength(1);
    });

    it('a game saved and loaded mid-fight remembers it was spent: the next defeating blow defeats', () => {
        const hero = fighter('Gale', { hp: 10 });
        equip(hero, 'ct_sword');
        const brute = sendAt(hero, 'ct_brute');
        const log = record();
        for (let i = 0; i < 3000 && !log.of(hero.id, 'trick').length; i++) GameLoop.runHandlers(100);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(1);

        const data = JSON.parse(GameState.serializeJson());
        expect(data.state.heroes.find(h => h.id === hero.id).fightTricks).toEqual({ at: brute.id, lastStand: true });
        loadSavedState(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        expect(HeroManager.getHero(hero.id).fightTricks).toEqual({ at: brute.id, lastStand: true });

        for (let i = 0; i < 3000 && !log.of(hero.id, 'defeated').length; i++) GameLoop.runHandlers(100);
        log.stop();
        expect(log.of(hero.id, 'trick')).toHaveLength(1);
        expect(log.of(hero.id, 'defeated')).toHaveLength(1);
    });
});

describe('Twin Strike (Twin Shot, Double Cast)', () => {
    it('at 100 every shot strikes twice, its arrow spent once; the second names the arrow but spends none', () => {
        const hero = fighter('Hale');
        equip(hero, 'ct_bow');
        equip(hero, 'ct_arrow', 5);
        sendAt(hero, 'ct_post');
        const log = record();
        step(400);
        log.stop();
        const attacks = log.of(hero.id, 'attack');
        expect(attacks).toHaveLength(10);
        expect(attacks.filter(a => a.twin)).toHaveLength(5);
        expect(attacks.filter(a => a.ammoId === 'ct_arrow')).toHaveLength(5);
        expect(attacks.every(a => a.arrowId === 'ct_arrow')).toBe(true);
        expect(attacks.filter(a => a.twin).every(a => !a.ammoId)).toBe(true);
        expect(InventoryManager.getItemCount('ct_arrow')).toBe(0);
        // The second follows its shot at once, after the trick is named.
        attacks.forEach((a, i) => expect(!!a.twin).toBe(i % 2 === 1));
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.TWIN_STRIKE)).toHaveLength(5);
    });

    it('a cast strikes twice for one Mote (Double Cast is the same rule for Magic); a poison counts one attack', () => {
        const hero = fighter('Ilse');
        equip(hero, 'ct_wand');
        equip(hero, 'ct_mote', 4);
        sendAt(hero, 'ct_post');
        const log = record();
        step(300);
        log.stop();
        const attacks = log.of(hero.id, 'attack');
        const spent = attacks.filter(a => a.ammoId === 'ct_mote');
        expect(spent).toHaveLength(4);
        expect(attacks.filter(a => a.twin).length).toBe(attacks.length / 2);
        expect(InventoryManager.getItemCount('ct_mote')).toBe(0);
    });

    it('a poison counts the attack once, not each strike', () => {
        registerSkillPerks({ stealth: { perks: [{ level: 99, effectId: 'ct_twin_shot' }, { level: 98, effectId: 'ct_twin_stealth' }] } });
        registerEffects({ ct_twin_stealth: trick('ct_twin_stealth', 'Twin Stab', EFFECT_TYPES.TWIN_STRIKE, 100, 'stealth') });
        const hero = fighter('Juno');
        equip(hero, 'ct_dagger');
        equip(hero, 'ct_poison', 1);
        sendAt(hero, 'ct_post');
        const log = record();
        step(60);
        log.stop();
        const attacks = log.of(hero.id, 'attack');
        const swings = attacks.filter(a => !a.twin).length;
        expect(swings).toBeGreaterThan(1);
        expect(attacks.filter(a => a.twin)).toHaveLength(swings);
        expect(HeroManager.getHero(hero.id).poisonAttacks.ct_poison).toBe(Math.max(0, 6 - swings));
    });

    it('without the rule, one strike an attack', () => {
        registerSkillPerks(NO_PERKS);
        const hero = fighter('Kell');
        equip(hero, 'ct_bow');
        equip(hero, 'ct_arrow', 5);
        sendAt(hero, 'ct_post');
        const log = record();
        step(400);
        log.stop();
        expect(log.of(hero.id, 'attack')).toHaveLength(5);
        expect(log.of(hero.id, 'trick')).toEqual([]);
    });
});

describe('Crit After Dodge (Shadowstep)', () => {
    /** Each of the hero's landed hits with whether an enemy miss came since their last landed hit. */
    function hitsAfterDodges(log, heroId) {
        let dodged = false;
        const out = [];
        for (const e of log.seen) {
            if (e.heroId !== heroId) continue;
            if (e.kind === 'enemy' && !e.hit) dodged = true;
            if (e.kind === 'attack' && e.hit) {
                out.push({ dodged, crit: e.crit, sure: !!e.sureCrit });
                dodged = false;
            }
        }
        return out;
    }

    it('after an enemy misses, the hero\'s next landed hit is a sure crit, named in the log', () => {
        const hero = fighter('Lark');
        equip(hero, 'ct_dagger');
        sendAt(hero, 'ct_clumsy');
        const log = record();
        step(1500);
        log.stop();
        const hits = hitsAfterDodges(log, hero.id);
        const afterDodge = hits.filter(h => h.dodged);
        expect(afterDodge.length).toBeGreaterThan(5);
        expect(afterDodge.every(h => h.crit)).toBe(true);
        // Each sure crit is named first, and only after a dodge.
        expect(log.of(hero.id, 'trick').filter(e => e.trick === TRICK.DODGE_CRIT)).toHaveLength(afterDodge.length);
        expect(hits.filter(h => h.sure).length).toBe(afterDodge.length);
        expect(hits.filter(h => !h.dodged).every(h => !h.sure)).toBe(true);
    });

    it('without the rule, hits after a dodge crit only by the hero\'s own chance', () => {
        registerSkillPerks(NO_PERKS);
        const hero = fighter('Mott');
        equip(hero, 'ct_dagger');
        sendAt(hero, 'ct_clumsy');
        const log = record();
        step(1500);
        log.stop();
        const afterDodge = hitsAfterDodges(log, hero.id).filter(h => h.dodged);
        expect(afterDodge.length).toBeGreaterThan(5);
        expect(afterDodge.some(h => !h.crit)).toBe(true);
        expect(log.of(hero.id, 'trick')).toEqual([]);
    });
});

describe('the fight log names each trick', () => {
    let stopWatch = null;
    beforeAll(() => { stopWatch = fightWatch.startFightWatch(); });
    afterAll(() => { stopWatch?.(); fightWatch.resetFightWatch(); });

    const lines = (heroId) => {
        const { current, last } = fightWatch.fightsOf(heroId);
        return [...(last?.log || []), ...(current?.log || [])].map(l => ({ text: t(`fight.log.${l.key}`, l.vars), amount: l.amount }));
    };

    it('by the perk\'s own name: Second Wind, Unbreakable, Twin Shot, Shadowstep', () => {
        const bram = fighter('Bram', { hp: 100 });
        bram.hp.current = 50;
        equip(bram, 'ct_sword');
        sendAt(bram, WEAK_CAMP);
        const dain = fighter('Dain', { hp: 10 });
        equip(dain, 'ct_sword');
        sendAt(dain, 'ct_brute');
        const hale = fighter('Hale');
        equip(hale, 'ct_bow');
        equip(hale, 'ct_arrow', 3);
        sendAt(hale, 'ct_post');
        const lark = fighter('Lark');
        equip(lark, 'ct_dagger');
        sendAt(lark, 'ct_clumsy');
        step(600);

        expect(lines(bram.id)).toContainEqual({ text: 'Second Wind: Bram heals', amount: '+3' });
        expect(lines(dain.id).map(l => l.text)).toContain('Unbreakable: Dain holds on at 1 health');
        expect(lines(hale.id).map(l => l.text)).toContain('Twin Shot: Hale attacks again');
        expect(lines(lark.id).map(l => l.text)).toContain('Shadowstep: Lark\'s hit is a sure crit');
    });
});

describe('time away', () => {
    function board() {
        fresh(53);
        nextX = 300;
        made = 0;
        const bram = fighter('Bram', { hp: 100 });
        bram.hp.current = 60;
        equip(bram, 'ct_sword');
        sendAt(bram, WEAK_CAMP);
        const dain = fighter('Dain', { hp: 10 });
        equip(dain, 'ct_sword');
        sendAt(dain, 'ct_brute');
        const hale = fighter('Hale');
        equip(hale, 'ct_bow');
        equip(hale, 'ct_arrow', 30);
        sendAt(hale, 'ct_post');
        const ilse = fighter('Ilse');
        equip(ilse, 'ct_wand');
        equip(ilse, 'ct_mote', 20);
        sendAt(ilse, 'ct_post');
        const lark = fighter('Lark');
        equip(lark, 'ct_dagger');
        sendAt(lark, 'ct_clumsy');
        return [bram, dain, hale, ilse, lark].map(h => h.id);
    }
    const end = (ids, log) => ({
        heroes: ids.map(id => {
            const h = GameState.state.heroes.find(x => x.id === id);
            return { id, hp: { ...h.hp }, status: h.status, fighting: !!BoardCombat.fightOfHero(id), tricks: h.fightTricks || null };
        }),
        enemies: BoardState.tokens().filter(tk => tk.typeId.startsWith('ct_')).map(tk => `${tk.typeId}:${tk.fightHp?.current ?? 'whole'}`),
        left: ['ct_arrow', 'ct_mote'].map(id => InventoryManager.getItemCount(id)),
        events: log.seen.map(e => `${e.kind}|${e.heroId}|${e.trick || ''}|${e.damage ?? ''}|${e.crit ? '!' : ''}|${e.twin ? 'twin' : ''}|${e.amount ?? ''}`),
        draws: stream.draws
    });

    it('a catch-up plays every trick exactly as the same 1000 ms steps through the loop', async () => {
        let ids = board();
        let log = record();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        log.stop();
        const plain = end(ids, log);

        ids = board();
        log = record();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        log.stop();
        const caughtUp = end(ids, log);

        expect(caughtUp.heroes).toEqual(plain.heroes);
        expect(caughtUp.enemies).toEqual(plain.enemies);
        expect(caughtUp.left).toEqual(plain.left);
        expect(caughtUp.events).toEqual(plain.events);
        expect(caughtUp.draws).toBe(plain.draws);
        // And every trick really played while away.
        const tricks = new Set(plain.events.filter(e => e.startsWith('trick|')).map(e => e.split('|')[2]));
        expect(tricks).toEqual(new Set([TRICK.KILL_HEAL, TRICK.LAST_STAND, TRICK.TWIN_STRIKE, TRICK.DODGE_CRIT]));
    }, 60_000);
});
