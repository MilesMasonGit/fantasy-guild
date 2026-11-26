import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { deal } from '../systems/board/DealDamage.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import { VENOM_EFFECT_ID } from '../config/registries/damageTypes.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

/**
 * The hit's maths: a part's type factor is (1 + Type Damage %) × (1 − resistance), never below 0;
 * Venom's ticks are Poison damage; every rule's damage and every tick rolls its fraction, as a
 * swing does.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const AT = { x: 400, y: 300 };

function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    hero.effects = [];
    return hero;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

function engage() {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, AT);
    TileModifiers.rebuildAround([instance]);
    Orders.orderAt('hero_1', AT);
    run(300);
    const fight = BoardCombat.getFight(instance.id);
    expect(fight, 'no fight started').toBeTruthy();
    return fight;
}

const tick = (amount) => ({
    ...makeStatement(KEYWORD.DEALS),
    when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF },
    payload: { amount, ignoresArmor: true }
});

// The content's Venom and Burn, as `data/effects.json` has them: 1 a tick, no type of their own.
registerEffects({
    [VENOM_EFFECT_ID]: { id: VENOM_EFFECT_ID, name: 'Venom', statements: [{ id: 'stm_venom_tick', ...tick(1) }] },
    effect_burn: { id: 'effect_burn', name: 'Burn', statements: [{ id: 'stm_burn_tick', ...tick(1) }] }
});

const resist = (entity, value, category) => entity.aggregator.addModifier({
    type: EFFECT_TYPES.TYPE_RESIST, value, bucket: 'flat', source: 'test', target: { category }
});

const fromEffect = (effectId, amount) => ({ ...tick(amount), sourceEffectId: effectId });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    BoardCombat.clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    LiveEffects.resetClock();
    GameState.state.heroes = [fighter('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    vi.restoreAllMocks();
    TriggerSystem.teardown();
    TileModifiers.teardown();
    BoardCombat.clearAll();
});

describe('resistance cuts what the boost left', () => {
    it('Poison +20 % on 50 % resistance does 60 %', () => {
        expect(CF.typeFactor(20, 50)).toBeCloseTo(0.6);
    });

    it('100 % resistance is always 0, whatever the boost', () => {
        expect(CF.typeFactor(20, 100)).toBe(0);
        expect(CF.typeFactor(300, 100)).toBe(0);
    });

    it('a −50 % weakness is ×1.5, and boosts on top of it', () => {
        expect(CF.typeFactor(0, -50)).toBe(1.5);
        expect(CF.typeFactor(20, -50)).toBeCloseTo(1.8);
    });

    it('never below 0, either half', () => {
        expect(CF.typeFactor(0, 150)).toBe(0);
        expect(CF.typeFactor(-150, -50)).toBe(0);
    });

    it('a blow: an enemy\'s Poison move of 10, +20 %, on a hero resisting 50 %, does 6', () => {
        const hero = fighter('h');
        resist(hero, 50, 'poison');
        const enemy = { level: 1, hit: 10, combatType: CF.getHeroCombatStyle(hero), aggregator: new ModifierAggregator('e') };
        enemy.aggregator.addModifier({ type: EFFECT_TYPES.TYPE_DAMAGE, value: 20, bucket: 'flat', source: 't', target: { category: 'poison' } });
        const blow = CF.enemyBlow(enemy, hero, { type: 'poison' });
        expect(blow.parts[0].pre).toBe(10);
        expect(blow.exact).toBeCloseTo(6);
    });
});

describe('the Weak!/Resisted label follows the same maths', () => {
    it('a boosted part counts for more than an unboosted one', () => {
        // Part A: 1, boosted +100 %, resisted 50 %: 2 → 1, the target took 1 off.
        // Part B: 1, no boost, weak −50 %: 1 → 1.5, the target gave 0.5.
        // The old sum ignored the boost and called it even (−0.5 + 0.5); the target cut more than it gave.
        const parts = [
            { type: 'fire', pre: 1, boost: 100, amount: 1 * CF.typeFactor(100, 50), resist: 50 },
            { type: 'ice', pre: 1, amount: 1 * CF.typeFactor(0, -50), resist: -50 }
        ];
        expect(CF.blowVerdict(parts)).toBe('resisted');
    });

    it('immunity on a boosted hit is Resisted; a plain weakness is Weak!', () => {
        expect(CF.blowVerdict([{ type: 'fire', pre: 2, boost: 20, amount: 0, resist: 100 }])).toBe('resisted');
        expect(CF.blowVerdict([{ type: 'ice', pre: 2, amount: 3, resist: -50 }])).toBe('weak');
        expect(CF.blowVerdict([{ type: 'ice', pre: 2, boost: 50, amount: 3, resist: 0 }])).toBe(null);
    });
});

describe('Venom\'s ticks are Poison damage', () => {
    it('a hero\'s Poison resistance cuts a Venom tick', () => {
        const hero = HeroManager.getHero('hero_1');
        resist(hero, 100, 'poison');
        expect(deal(fromEffect(VENOM_EFFECT_ID, 3), { selfHeroId: 'hero_1' })).toBe(0);
        expect(hero.hp.current).toBe(100);
    });

    it('50 % resistance halves it: 4 a tick does 2', () => {
        const hero = HeroManager.getHero('hero_1');
        resist(hero, 50, 'poison');
        expect(deal(fromEffect(VENOM_EFFECT_ID, 4), { selfHeroId: 'hero_1' })).toBe(2);
    });

    it('a weakness to Poison makes it worse', () => {
        const hero = HeroManager.getHero('hero_1');
        resist(hero, -50, 'poison');
        expect(deal(fromEffect(VENOM_EFFECT_ID, 2), { selfHeroId: 'hero_1' })).toBe(3);
    });

    it('Burn is untouched by Poison resistance', () => {
        const hero = HeroManager.getHero('hero_1');
        resist(hero, 100, 'poison');
        expect(deal(fromEffect('effect_burn', 2), { selfHeroId: 'hero_1' })).toBe(2);
    });

    it('an untyped rule\'s damage lands whole on a resistant hero', () => {
        const hero = HeroManager.getHero('hero_1');
        resist(hero, 100, 'poison');
        expect(deal(tick(2), { selfHeroId: 'hero_1' })).toBe(2);
    });

    it('an enemy immune to Poison takes nothing from Venom on the effects clock', () => {
        const fight = engage();
        fight.enemy.resistances = { poison: 100 };
        LiveEffects.applyTo(BoardCombat.enemyBearerOfToken(fight.instanceId), { effectId: VENOM_EFFECT_ID, forFight: true });
        const before = fight.combat.enemyHp.current;
        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
        expect(fight.combat.enemyHp.current).toBe(before);
    });
});

describe('rule damage and ticks roll their fraction', () => {
    // ⚠️ Statements are made before the spy: `makeStatement` draws for its id.
    it('1.5 is 2 on a low draw and 1 on a high one, one draw each', () => {
        const half = tick(1.5);
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.7);
        expect(deal(half, { selfHeroId: 'hero_1' })).toBe(1);
        spy.mockReturnValue(0.3);
        expect(deal(half, { selfHeroId: 'hero_1' })).toBe(2);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('2.4 is 3 one time in ten-ish: a low draw rounds up', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.1);
        expect(deal(tick(2.4), { selfHeroId: 'hero_1' })).toBe(3);
    });

    it('a whole amount draws nothing', () => {
        const three = tick(3);
        const spy = vi.spyOn(Math, 'random');
        expect(deal(three, { selfHeroId: 'hero_1' })).toBe(3);
        expect(spy).not.toHaveBeenCalled();
    });

    it('on an enemy too: a resisted Venom tick of 1.5 rolls', () => {
        const fight = engage();
        fight.enemy.resistances = { poison: 50 };
        const before = fight.combat.enemyHp.current;
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const dealt = deal(fromEffect(VENOM_EFFECT_ID, 3), { self: fight.instanceId, selfFightId: fight.instanceId });
        expect(dealt).toBe(1);
        expect(fight.combat.enemyHp.current).toBe(before - 1);
    });

    it('over many ticks 0.5 averages 0.5, where rounding to nearest gave 1 every time', () => {
        GameState.state.heroes[0].hp = { current: 1e9, max: 1e9 };
        let sum = 0;
        const half = tick(0.5);
        for (let i = 0; i < 4000; i++) sum += deal(half, { selfHeroId: 'hero_1' });
        expect(sum / 4000).toBeCloseTo(0.5, 1);
    });
});
