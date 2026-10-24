import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as CF from '../utils/CombatFormulas.js';
import { enemyProfileOf, enemyFilledStats } from '../config/registries/enemyProfile.js';
import { ENEMY_KINDS, MAX_ENEMY_KINDS, enemyKindsOf, kindsClash } from '../config/registries/enemyKinds.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';

/**
 * The five enemy kinds (brief 220, C2): presets an author ticks on an enemy, none to two, that twist
 * what the level table fills. The table first (older content's budgetScale on HP, hit and XP), then
 * each kind in the order ticked, then any number the author typed, which wins outright.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const stats = (level, kinds, more = {}) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level, style: 'melee', kinds, ...more } });
const pick = (p) => ({ hp: p.hp, hit: p.hit, armor: p.armor, speed: p.speed, xp: p.xpAwarded, dodge: p.dodge });

describe('the five kinds, all from the start', () => {
    it('Armoured, Nimble, Swift, Brute, Venomous; at most two per enemy', () => {
        expect(ENEMY_KINDS.map(k => k.id)).toEqual(['armoured', 'nimble', 'swift', 'brute', 'venomous']);
        expect(MAX_ENEMY_KINDS).toBe(2);
    });
});

describe('how a kind combines with the level table', () => {
    it('no kind: exactly the level table (level 1: 21 HP, hit 1, armour 0, 3 s, 10 XP)', () => {
        expect(pick(stats(1, undefined))).toEqual({ hp: 21, hit: 1, armor: 0, speed: 'normal', xp: 10, dodge: 0 });
        expect(stats(1, []).kinds).toEqual([]);
        expect(stats(1, []).statusOnHit).toBeUndefined();
    });

    it('Armoured: +2 armour and a slow swing, its hit unchanged; HP and XP untouched', () => {
        expect(pick(stats(1, ['armoured']))).toEqual({ hp: 21, hit: 1, armor: 2, speed: 'slow', xp: 10, dodge: 0 });
        expect(pick(stats(30, ['armoured']))).toMatchObject({ armor: 3, hit: 2, speed: 'slow' });
        expect(stats(1, ['armoured']).attackSpeed).toBe(4000);
    });

    it('Nimble: +15 Dodge, so a hero misses it 15 points more', () => {
        expect(pick(stats(1, ['nimble']))).toEqual({ hp: 21, hit: 1, armor: 0, speed: 'normal', xp: 10, dodge: 15 });
        const hero = { skills: { melee: { level: 1 } } };
        expect(CF.heroMissChance(hero, stats(1, ['nimble']))).toBe(CF.heroMissChance(hero, stats(1, [])) + 15);
    });

    it('Swift: a swing every 2 s at 2/3 of the level\'s hit, never below 1', () => {
        // Level hits 1, 2, 3, 4, 5 → 1, 1, 2, 3, 3.
        expect([1, 20, 40, 60, 80].map(l => stats(l, ['swift']).hit)).toEqual([1, 1, 2, 3, 3]);
        expect(stats(1, ['swift']).attackSpeed).toBe(2000);
    });

    it('Brute: a swing every 4 s at 4/3 of the level\'s hit, and always at least 1 harder', () => {
        // Level hits 1, 2, 3, 4, 5 → 2, 3, 4, 5, 7.
        expect([1, 20, 40, 60, 80].map(l => stats(l, ['brute']).hit)).toEqual([2, 3, 4, 5, 7]);
        expect(stats(1, ['brute']).attackSpeed).toBe(4000);
    });

    it('Venomous: every landed hit poisons (the old status engine\'s Poison until statuses move to the Rules)', () => {
        expect(stats(1, ['venomous']).statusOnHit).toEqual([{ statusId: 'poison', chance: 1, stacks: 1 }]);
        expect(pick(stats(1, ['venomous']))).toEqual(pick(stats(1, [])));
    });

    it('two kinds apply in the order ticked: Armoured Brute at 20 is armour 2, hit 3, slow', () => {
        expect(pick(stats(20, ['armoured', 'brute']))).toMatchObject({ armor: 2, hit: 3, speed: 'slow' });
        expect(pick(stats(1, ['nimble', 'armoured']))).toMatchObject({ armor: 2, dodge: 15, speed: 'slow' });
        expect(stats(1, ['nimble', 'armoured']).kinds).toEqual(['nimble', 'armoured']);
    });

    it('a number the author typed wins outright over the level and the kinds', () => {
        expect(pick(stats(1, ['armoured'], { armor: 5 }))).toMatchObject({ armor: 5, speed: 'slow' });
        expect(pick(stats(1, ['armoured'], { speed: 'fast' }))).toMatchObject({ armor: 2, speed: 'fast' });
        expect(pick(stats(1, ['brute'], { hit: 9 }))).toMatchObject({ hit: 9 });
        expect(pick(stats(1, ['nimble'], { dodge: 0 }))).toMatchObject({ dodge: 0 });
    });

    it('older content\'s budgetScale scales the level first; a Brute is still at least 1 harder than that', () => {
        // The Goblin: level 1 × 0.3 → 6 HP, hit 1, 3 XP; as a Brute, hit 2.
        expect(pick(stats(1, ['brute'], { budgetScale: 0.3 }))).toEqual({ hp: 6, hit: 2, armor: 0, speed: 'slow', xp: 3, dodge: 0 });
    });

    it('an unknown kind, a repeat and a third kind are ignored; clashing speeds let the later win', () => {
        expect(enemyKindsOf({ kinds: ['nimble', 'nimble', 'giant', 'venomous', 'armoured'] }).map(k => k.id)).toEqual(['nimble', 'venomous']);
        expect(kindsClash('swift', 'armoured')).toBe(true);
        expect(kindsClash('swift', 'brute')).toBe(true);
        expect(kindsClash('armoured', 'brute')).toBe(false);
        expect(kindsClash('nimble', 'swift')).toBe(false);
        expect(stats(1, ['swift', 'armoured']).speed).toBe('slow');
    });

    it('the CMS reads the same defaults the fight starts from', () => {
        expect(enemyFilledStats({ level: 20, kinds: ['armoured'] })).toMatchObject({ hp: 40, hit: 2, armor: 2, speed: 'slow', xp: 33 });
    });
});

describe('a fight against each kind', () => {
    registerTokenTypes(Object.fromEntries(['none', ...ENEMY_KINDS.map(k => k.id)].map(kind => [`kind_${kind}`, {
        id: `kind_${kind}`, name: `Kind ${kind}`, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50,
        sprite: 's_occult',
        // Plenty of HP, so the fight lasts the whole window.
        enemy: { level: 1, style: 'magic', hp: 500, ...(kind === 'none' ? {} : { kinds: [kind] }) },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }])));

    function hero() {
        const h = generateHero({ name: 'Bram' });
        h.id = 'kind_hero';
        h.status = 'idle';
        h.skills.melee = { level: 99, xp: 0 };
        h.hp = { current: 109, max: 109 };
        GameState.state.heroes = [h];
        return h;
    }

    function reset() {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        LootSystem.init();
        BoardCombat.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
    }

    /** On a fresh board, plant a level-99 hero on one enemy for `ms` and record every swing. */
    function duel(typeId, ms = 24000) {
        reset();
        const h = hero();
        const at = { x: 400, y: 300 };
        const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(enemy, at);
        TileModifiers.rebuildAround([enemy]);
        Placement.plantFlagAt(h.id, at);
        const seen = { enemySwings: [], heroHits: [], statuses: [] };
        let t = 0;
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.enemySwings.push(t)),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { if (p.hit) seen.heroHits.push({ damage: p.damage, crit: p.crit }); }),
            EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => seen.statuses.push(p.statusId))
        ];
        for (; t < ms; t += 100) BoardRunner.tick(100);
        offs.forEach(off => off());
        return { ...seen, hero: h };
    }
    const gaps = (times) => times.slice(1).map((v, i) => v - times[i]);

    afterEach(() => vi.restoreAllMocks());

    it('no kind swings every 3 s; Swift every 2 s; Armoured and Brute every 4 s', () => {
        for (const [typeId, every] of [['kind_none', 3000], ['kind_swift', 2000], ['kind_armoured', 4000], ['kind_brute', 4000]]) {
            const { enemySwings } = duel(typeId);
            expect(enemySwings.length, typeId).toBeGreaterThan(3);
            for (const gap of gaps(enemySwings)) expect(gap, typeId).toBe(every);
        }
    });

    it('Armoured takes 2 off every hit the hero lands (unarmed level 99: 1 + 4 = 5, so 3)', () => {
        const plain = duel('kind_none').heroHits.filter(h => !h.crit).map(h => h.damage);
        const plated = duel('kind_armoured').heroHits.filter(h => !h.crit).map(h => h.damage);
        expect(new Set(plain)).toEqual(new Set([5]));
        expect(new Set(plated)).toEqual(new Set([3]));
    });

    it('Venomous poisons the hero on the hits it lands; the others never do', () => {
        const venom = duel('kind_venomous');
        expect(venom.statuses.filter(s => s === 'poison').length).toBeGreaterThan(0);
        expect(venom.hero.statuses.find(s => s.id === 'poison')?.stacks).toBeGreaterThan(0);
        expect(duel('kind_none').statuses).toEqual([]);
    });
});

describe('the audit names a kind the game does not have, a third kind, or a clash', () => {
    const token = (kinds) => ({ id: 't', name: 'T', enemy: { level: 1, style: 'melee', kinds } });
    const fields = (kinds) => findUnknownRefs({ tokens: { t: token(kinds) } }).map(f => f.message);

    it('reports each problem once, and nothing for a good pair', () => {
        expect(fields(['armoured', 'nimble'])).toEqual([]);
        expect(fields(['giant'])[0]).toContain('"giant"');
        expect(fields(['armoured', 'nimble', 'venomous'])[0]).toContain('at most 2');
        expect(fields(['swift', 'armoured'])[0]).toContain('different swing speeds');
    });
});
