import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as FightMoments from '../systems/board/FightMoments.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { enemyKindsOf, kindEffectIdOf } from '../config/registries/enemyKinds.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerEffects, EFFECTS } from '../config/registries/effectRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { enemyAtRest, enemyFightNumbers, isKindCandidate, kindResistances } from '../systems/effects/enemyKindEffects.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { tokenCardModel, liveCardSources } from '../ui/components/board/tokenCard.js';
import { enemyCardView, kindView } from '../ui/components/combat/fightView.js';
import { registerStatusFixtures, providesPct, providesFlat, VENOM } from './fixtures/statusEffects.js';

/**
 * Enemy kinds as library effects (brief 740 C5): Armoured, Nimble, Swift and Brute are ordinary
 * effects the owner edits, picked in the Token editor's kind boxes; a kind's numbers go on the
 * enemy's own aggregator for the fight and add to its written lines like any effect's (the Crab's own
 * Crush −100 and Armoured's 50 make weak 50 %); Swift and Brute are plain Attack Speed and Damage %,
 * rolled each hit. Until the library holds a preset's effect, the preset is read as before
 * (`EnemyKinds.test.js`).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const THIRD = 1 / 3;
const resist = (id, type, value) => ({
    ...providesFlat(id, EFFECT_TYPES.TYPE_RESIST, value),
    payload: { type: EFFECT_TYPES.TYPE_RESIST, bucket: 'flat', value, category: type }
});
const rule = (id, keyword, when, target, payload) => ({ ...makeStatement(keyword), id, when: { scope: 'self', ...when }, target, payload });

/** The four kinds as the content pack authors them, with today's numbers. */
const KIND_EFFECTS = {
    effect_armoured: { id: 'effect_armoured', name: 'Armoured', statements: [
        resist('stm_ek_arm_slash', 'slash', 50), resist('stm_ek_arm_crush', 'crush', 50), resist('stm_ek_arm_stab', 'stab', 50),
        providesPct('stm_ek_arm_speed', EFFECT_TYPES.SWING_TIME, THIRD)
    ] },
    effect_nimble: { id: 'effect_nimble', name: 'Nimble', statements: [providesFlat('stm_ek_nimble', EFFECT_TYPES.DODGE, 15)] },
    effect_swift: { id: 'effect_swift', name: 'Swift', statements: [
        providesPct('stm_ek_swift_speed', EFFECT_TYPES.SWING_TIME, -THIRD), providesPct('stm_ek_swift_dmg', EFFECT_TYPES.DAMAGE, -THIRD)
    ] },
    effect_brute: { id: 'effect_brute', name: 'Brute', statements: [
        providesPct('stm_ek_brute_speed', EFFECT_TYPES.SWING_TIME, THIRD), providesPct('stm_ek_brute_dmg', EFFECT_TYPES.DAMAGE, THIRD)
    ] }
};

/** A thorny kind: a rule on a fight moment, run as the enemy's passive. */
const THORNY = { id: 'ek_thorny', name: 'Thorny', statements: [
    rule('stm_ek_thorny', KEYWORD.DEALS, { event: 'FIGHT_STRUCK' }, { role: ROLE.ACTOR }, { amount: 1 })
] };

const ek = {
    ek_heavy: { id: 'ek_heavy', name: 'Heavy Strike', statements: [providesPct('stm_ek_heavy', EFFECT_TYPES.DAMAGE, 1)] },
    ek_enrage: { id: 'ek_enrage', name: 'Enrage', statements: [providesPct('stm_ek_enrage', EFFECT_TYPES.SWING_TIME, -0.5)] }
};

const profile = (enemy) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style: 'melee', ...enemy } });

function withKinds(fn) {
    const saved = Object.keys(KIND_EFFECTS).map(id => [id, EFFECTS[id]]);
    registerEffects(KIND_EFFECTS);
    try { return fn(); } finally {
        for (const [id, entry] of saved) { if (entry) EFFECTS[id] = entry; else delete EFFECTS[id]; }
    }
}

afterEach(() => vi.restoreAllMocks());

describe('a kind is the library effect it names', () => {
    it('a preset id reads as its effect once the library holds it, and as the preset until then', () => {
        expect(kindEffectIdOf('armoured', {})).toBeNull();
        expect(kindEffectIdOf('armoured', KIND_EFFECTS)).toBe('effect_armoured');
        expect(kindEffectIdOf('effect_brute', KIND_EFFECTS)).toBe('effect_brute');
        expect(kindEffectIdOf('ek_thorny', { ek_thorny: THORNY })).toBe('ek_thorny');
        expect(enemyKindsOf({ kinds: ['armoured'] }, {})).toEqual([expect.objectContaining({ id: 'armoured', effectId: null })]);
        expect(enemyKindsOf({ kinds: ['armoured', 'effect_armoured', 'brute'] }, KIND_EFFECTS).map(k => k.id)).toEqual(['effect_armoured', 'effect_brute']);
        // An effect the library lacks falls back to its preset.
        expect(enemyKindsOf({ kinds: ['effect_armoured'] }, {}).map(k => k.preset?.id)).toEqual(['armoured']);
    });

    it('an effect kind adds nothing to the stat block itself: its numbers wait for the fight', () => withKinds(() => {
        const p = profile({ kinds: ['armoured'], resistances: { crush: -100, electric: -25 } });
        expect(p.kindEffects).toEqual(['effect_armoured']);
        expect(p.kinds).toEqual(['effect_armoured']);
        expect(p.resistances).toEqual({ crush: -100, electric: -25 });
        expect(p.speed).toBe('normal');
        expect(p.attackSpeed).toBe(3000);
    }));
});

describe('a kind\'s numbers add to the enemy\'s own, as any effect\'s', () => {
    it('the Crab: Armoured\'s Crush 50 and its own −100 make weak 50; Slash and Stab 50; Electric its own; every 4 s', () => withKinds(() => {
        const crab = enemyAtRest(profile({ kinds: ['effect_armoured'], resistances: { crush: -100, electric: -25 } }));
        expect(CF.enemyNumbers(crab)).toMatchObject({
            resistances: { slash: 50, crush: -50, stab: 50, electric: -25 },
            attackSpeedMs: 4000, hit: 1
        });
    }));

    it('Nimble adds 15 Dodge to the written Dodge; Swift attacks every 2 s at 2/3 hit; Brute every 4 s at 4/3', () => withKinds(() => {
        expect(CF.enemyNumbers(enemyAtRest(profile({ kinds: ['effect_nimble'], dodge: 5 }))).dodge).toBe(20);
        const swift = CF.enemyNumbers(enemyAtRest(profile({ kinds: ['effect_swift'], hit: 3 })));
        expect(swift.attackSpeedMs).toBe(2000);
        expect(swift.hit).toBeCloseTo(2, 9);
        const brute = CF.enemyNumbers(enemyAtRest(profile({ kinds: ['effect_brute'], hit: 2.25 })));
        expect(brute.attackSpeedMs).toBe(4000);
        expect(brute.hit).toBeCloseTo(3, 9);
        // Brute's floor of 1 above the level retires: a level-1 Brute hits 4/3, rolled.
        expect(CF.enemyNumbers(enemyAtRest(profile({ kinds: ['effect_brute'] }))).hit).toBeCloseTo(4 / 3, 9);
    }));

    it('a kind\'s Damage % adds to a heavy strike\'s, and its Attack Speed to an enrage\'s, in one bucket', () => withKinds(() => {
        registerEffects(ek);
        const brute = enemyAtRest(profile({ kinds: ['effect_brute'], hit: 3 }));
        LiveEffects.applyTo({ target: brute, roles: {} }, { effectId: 'ek_heavy', forFight: true });
        LiveEffects.applyTo({ target: brute, roles: {} }, { effectId: 'ek_enrage', forFight: true });
        expect(CF.damageMultiplierOf(brute)).toBeCloseTo(1 + THIRD + 1, 9);
        expect(CF.enemyAttackSpeedMs(brute)).toBe(Math.round(3000 * (1 + THIRD - 0.5)));
        // Taking the lingering ones off leaves the kind's own.
        LiveEffects.removeFrom({ target: brute, roles: {} });
        expect(CF.damageMultiplierOf(brute)).toBeCloseTo(1 + THIRD, 9);
        expect(CF.enemyAttackSpeedMs(brute)).toBe(4000);
    }));

    it('what the kinds add to resistances, alone, for the CMS rows', () => withKinds(() => {
        expect(kindResistances(['effect_armoured'])).toEqual({ slash: 50, crush: 50, stab: 50 });
        expect(kindResistances([])).toEqual({});
    }));

    it('the CMS preview reads the totals the fight starts from, from the library it is handed', () => {
        const numbers = enemyFightNumbers({ id: 'c', enemy: { level: 3, kinds: ['effect_armoured'], resistances: { crush: -100 } } }, KIND_EFFECTS);
        expect(numbers).toMatchObject({ resistances: { slash: 50, crush: -50, stab: 50 }, attackSpeed: 4000, hp: 23 });
        // Without the effect in that library, the preset as before: a written line replaces the preset's for its type.
        expect(enemyFightNumbers({ id: 'c', enemy: { level: 3, kinds: ['armoured'], resistances: { crush: -50 } } }, {}))
            .toMatchObject({ resistances: { slash: 50, crush: -50, stab: 50 }, attackSpeed: 4000 });
    });
});

describe('a fight against an enemy whose kinds are effects', () => {
    registerTokenTypes({
        ek_crab: {
            id: 'ek_crab', name: 'Kind Crab', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
            enemy: { level: 1, style: 'magic', hp: 500, kinds: ['effect_armoured'], resistances: { crush: -100 } },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        },
        ek_plated: {
            id: 'ek_plated', name: 'Kind Plated', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
            enemy: { level: 1, style: 'magic', hp: 500, kinds: ['effect_armoured'] },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        },
        ek_brute: {
            id: 'ek_brute', name: 'Kind Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
            enemy: { level: 1, style: 'magic', hp: 500, hit: 3, kinds: ['effect_brute'] },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        },
        ek_thorn: {
            id: 'ek_thorn', name: 'Kind Thorn', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
            enemy: { level: 1, style: 'magic', hp: 500, kinds: ['ek_thorny'] },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        }
    });

    let saved;
    beforeEach(() => {
        saved = [...Object.keys(KIND_EFFECTS), 'ek_thorny'].map(id => [id, EFFECTS[id]]);
        registerEffects({ ...KIND_EFFECTS, ek_thorny: THORNY });
        // Every swing lands and none crits.
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });
    afterEach(() => {
        TriggerSystem.teardown();
        for (const [id, entry] of saved) { if (entry) EFFECTS[id] = entry; else delete EFFECTS[id]; }
    });

    /** A fresh board, as each duel starts on one. */
    function reset() {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        LootSystem.init();
        BoardCombat.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        TriggerSystem.init();
        registerStatusFixtures();
        FightMoments.init();
        LiveEffects.resetClock();
    }

    function duel(typeId, ms = 24000) {
        TriggerSystem.teardown();
        reset();
        const h = generateHero({ name: 'Bram' });
        h.id = 'ek_hero';
        h.status = 'idle';
        h.skills.melee = { level: 99, xp: 0 };
        h.hp = { current: 109, max: 109 };
        GameState.state.heroes = [h];
        const at = { x: 400, y: 300 };
        const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(enemy, at);
        TileModifiers.rebuildAround([enemy]);
        Orders.orderAt(h.id, at);
        const seen = { enemySwings: [], enemyHits: [], heroHits: [], heroHp: [] };
        let t = 0;
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => { seen.enemySwings.push(t); if (p.hit) seen.enemyHits.push(p.damage); }),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { if (p.hit) seen.heroHits.push(p.damage); })
        ];
        for (; t < ms; t += 100) {
            LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
            BoardRunner.tick(100);
            seen.heroHp.push(h.hp.current);
        }
        offs.forEach(off => off());
        return { ...seen, hero: h, enemy };
    }
    const gaps = (times) => times.slice(1).map((v, i) => v - times[i]);

    it('Armoured as an effect swings every 4 s and halves the hero\'s Crush fist (5 → 2.5, rolled to 2 at 0.5)', () => {
        const { enemySwings, heroHits } = duel('ek_plated');
        expect(enemySwings.length).toBeGreaterThan(3);
        for (const gap of gaps(enemySwings)) expect(gap).toBe(4000);
        expect(new Set(heroHits)).toEqual(new Set([2]));
    });

    it('the Crab as an effect: weak 50 % to the Crush fist (5 × 1.5 = 7.5)', () => {
        const { heroHits } = duel('ek_crab');
        expect(new Set(heroHits)).toEqual(new Set([7]));
    });

    it('Brute as an effect: a written hit of 3 lands 4 (3 × 4/3), every 4 s', () => {
        const { enemySwings, enemyHits } = duel('ek_brute');
        for (const gap of gaps(enemySwings)) expect(gap).toBe(4000);
        // The hero's style (Melee) against a Magic enemy is even: no matchup shift.
        expect(new Set(enemyHits)).toEqual(new Set([4]));
    });

    it('the kind moves the enemy, never the hero: nothing it provides reaches the hero\'s aggregator', () => {
        const { hero, enemy } = duel('ek_plated', 6000);
        expect(CF.heroTypeResistance(hero, 'crush')).toBe(0);
        const fight = BoardCombat.getFight(enemy.id);
        expect(CF.enemyTypeResistance(fight.enemy, 'slash')).toBe(50);
    });

    it('a kind\'s fight-moment rule runs as the enemy\'s passive: Thorny deals 1 back each time it is struck', () => {
        const thorny = duel('ek_thorn', 12000);
        const plated = duel('ek_plated', 12000);
        expect(thorny.heroHits.length).toBeGreaterThan(2);
        const lost = (run) => 109 - run.heroHp.at(-1);
        expect(lost(thorny)).toBeGreaterThan(lost(plated));
    });
});

describe('the card and the fight window read the kinds\' numbers', () => {
    it('an effect kind is named by its effect, its words the preset\'s until the effect has a description', () => withKinds(() => {
        expect(kindView('effect_armoured')).toMatchObject({ id: 'effect_armoured', name: 'Armoured', tip: expect.stringContaining('Slash, Crush and Stab 50%') });
        EFFECTS.effect_armoured = { ...EFFECTS.effect_armoured, description: 'Plated all over.' };
        expect(kindView('effect_armoured').tip).toBe('Plated all over.');
        expect(kindView('armoured')).toMatchObject({ id: 'armoured', name: 'Armoured' });
        expect(kindView('no_such_kind')).toBeNull();
    }));

    it('the enemy card and the Token card add the kinds\' resistances and speed before any fight', () => withKinds(() => {
        registerTokenTypes({
            ek_card_crab: {
                id: 'ek_card_crab', name: 'Card Crab', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
                enemy: { level: 3, style: 'melee', kinds: ['effect_armoured'], resistances: { crush: -100 } },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        GameState.initNew();
        const card = enemyCardView('ek_card_crab');
        expect(card.resists).toEqual([{ id: 'slash', value: 50 }, { id: 'crush', value: -50 }, { id: 'stab', value: 50 }]);
        expect(card.attackEveryMs).toBe(4000);
        const fight = tokenCardModel('ek_card_crab', null, liveCardSources()).blocks.find(b => b.id === 'fight');
        expect(fight).toMatchObject({ resists: card.resists, attackEveryMs: 4000, hit: 1 });
    }));
});

describe('the audits read kinds against the library', () => {
    const fields = (kinds, effects) => findUnknownRefs({ tokens: { t: { id: 't', name: 'T', enemy: { level: 1, kinds } } }, effects }).map(f => f.message);

    it('a kind naming an effect the library holds, or a preset, is fine; one naming neither is named', () => {
        expect(fields(['effect_armoured', 'brute'], KIND_EFFECTS)).toEqual([]);
        expect(fields(['ek_thorny'], { ek_thorny: THORNY })).toEqual([]);
        expect(fields(['armoured'], {})).toEqual([]);
        expect(fields(['effect_gone'], {})[0]).toContain('"effect_gone", which is no effect in the library');
        // Effect kinds never clash: their numbers add.
        expect(fields(['effect_swift', 'effect_armoured'], KIND_EFFECTS)).toEqual([]);
    });

    it('an effect used only as a kind is not "used by nothing"', () => withKinds(() => {
        registerTokenTypes({
            ek_audit_crab: {
                id: 'ek_audit_crab', name: 'Audit Crab', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
                enemy: { level: 3, style: 'melee', kinds: ['effect_armoured'] },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const unused = auditContent().filter(f => f.where === 'Effect "Armoured"' && f.what.includes('not used by anything'));
        expect(unused).toEqual([]);
    }));

    it('a kind effect\'s rule counting every Nth hit is named on the enemy carrying it', () => {
        const counted = { id: 'ek_counted', name: 'Counted', statements: [
            rule('stm_ek_counted', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 3 }, { role: ROLE.ACTOR }, { effectId: VENOM, chance: 100 })
        ] };
        registerEffects({ ek_counted: counted });
        registerTokenTypes({
            ek_counter: {
                id: 'ek_counter', name: 'Counter', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
                enemy: { level: 1, style: 'melee', kinds: ['ek_counted'] },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const named = auditContent().filter(f => f.where === 'Token "ek_counter"' && f.what.includes('once every 3 hits'));
        expect(named).toHaveLength(1);
    });
});

describe('what the CMS offers in the kind boxes', () => {
    it('an effect that can be a trait: combat numbers or fight moments, never a status or a work rule', () => {
        for (const entry of Object.values(KIND_EFFECTS)) expect(isKindCandidate(entry), entry.id).toBe(true);
        expect(isKindCandidate(THORNY)).toBe(true);
        expect(isKindCandidate({ id: 'v', name: 'Venom', status: { stacks: 3 }, statements: [providesFlat('s', EFFECT_TYPES.DODGE, 1)] })).toBe(false);
        expect(isKindCandidate({ id: 'y', name: 'Yield', statements: [providesPct('s', 'YIELD', 0.1)] })).toBe(false);
        expect(isKindCandidate({ id: 'n', name: 'Nothing', statements: [] })).toBe(false);
    });
});
