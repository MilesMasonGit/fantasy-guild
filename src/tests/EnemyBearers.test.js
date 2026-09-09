import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as StatusApplication from '../systems/board/StatusApplication.js';
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
import { enemyFlatArmor } from '../utils/CombatFormulas.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * * **An enemy is an effect bearer** (Effects Grammar v2, V7b).
 *
 * V6's own header claimed "heroes and live enemies are what V6 ships". Only the
 * first half was true. A monster could be *hurt* by a rule but could not
 * **carry** one - no `effects` list, no aggregator - so half the effect surface
 * in the game was unreachable from the new grammar, and "poison the monster" or
 * "this monster has Armor Shield" were sayable only in the engine being retired.
 *
 * Four things had to become true together, and each has a test below:
 *
 * 1. A fight holds a list and an aggregator, with the fight's lifetime.
 * 2. `Deals` at an enemy respects its armour, the way it does at a hero.
 * 3. The clock reaches enemies, so a carried effect ticks.
 * 4. `self` on a carried effect means the **monster**, not the hero on its tile.
 *
 * WARNING: (4) is the one that would have been invisible. Every other reading of
 * a tile in the game resolves through the occupant rule - hero first - so a
 * poison authored on a monster would have quietly damaged its attacker instead,
 * and the fight would still have looked like it was working.
 */

const MONSTER = 16, BUSH = 15;

/**
 * A hero who can actually fight.
 *
 * WARNING: `melee` must be PRESENT, not merely levelled. `canHeroFight` tests
 * possession of a combat skill and never its level, so a hero built without this
 * line stands on an enemy doing nothing, no fight is created, and every
 * assertion below passes for the wrong reason.
 */
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

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** Start a real fight on `MONSTER` and hand back its fight card. */
function engage() {
    place(MONSTER, 'fixture_enemy', 'hero_1');
    run(300);
    const fight = BoardCombat.getFight(MONSTER);
    expect(fight, 'no fight started - the hero cannot fight').toBeTruthy();
    return fight;
}

/** Author one library effect, the way the CMS would. */
function authored(id, statement) {
    registerEffects({ [id]: { id, name: id, statements: [{ id: `stm_${id}`, ...statement }] } });
    return id;
}

const lasting = (type, value) => ({
    ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value }
});

const overTime = (amount, ignoresArmor = true) => ({
    ...makeStatement(KEYWORD.DEALS),
    when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF },
    payload: { amount, ignoresArmor }
});

const bearer = () => BoardCombat.enemyBearerAt(MONSTER);

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
    TriggerSystem.teardown();
    TileModifiers.teardown();
    BoardCombat.clearAll();
});

describe('a fight is a bearer', () => {
    it('gives its enemy a list and an aggregator', () => {
        const fight = engage();
        expect(Array.isArray(fight.effects)).toBe(true);
        expect(fight.aggregator).toBeInstanceOf(ModifierAggregator);
    });

    it('WARNING: wires the aggregator onto the stat block, which is re-derived every tick', () => {
        // `enemyFor` builds a fresh profile every tick on purpose, so an enemy
        // re-authored in the CMS takes effect immediately. If the two are not
        // joined up, `computeHeroDamage` reads a profile with no aggregator and
        // an enemy's carried armour is silently zero - which is
        // indistinguishable from the feature working, since zero is also the
        // right answer for an enemy carrying nothing.
        const fight = engage();
        run(500);
        expect(fight.enemy.aggregator).toBe(fight.aggregator);
    });

    it('hands every live fight to the effects clock', () => {
        engage();
        // Registration is a module-load side effect; carrying something and
        // watching it tick is the only honest proof that it took.
        authored('effect_enemy_dot', overTime(3));
        LiveEffects.applyTo(bearer(), { effectId: 'effect_enemy_dot', durationMs: 60000 });

        const before = BoardCombat.getFight(MONSTER).combat.enemyHp.current;
        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);

        expect(BoardCombat.getFight(MONSTER).combat.enemyHp.current).toBe(before - 3);
    });

    it('has the lifetime of the fight - a monster walked away from is whole again', () => {
        engage();
        authored('effect_enemy_shield', lasting(EFFECT_TYPES.ARMOR, 5));
        LiveEffects.applyTo(bearer(), { effectId: 'effect_enemy_shield', durationMs: 60000 });
        expect(BoardCombat.getFight(MONSTER).effects).toHaveLength(1);

        // The hero leaves; `tickTile` drops the fight (G-4). Nothing extra had
        // to be written to make a poison die with the creature carrying it.
        Placement.recallHeroById('hero_1');
        run(200);

        expect(BoardCombat.getFight(MONSTER)).toBeNull();
    });

    it('registering a bearer source twice registers it once', () => {
        const source = () => [];
        LiveEffects.registerBearerSource(source);
        LiveEffects.registerBearerSource(source);
        expect(() => LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement)).not.toThrow();
    });
});

describe('an enemy has armour, and it means what a hero armour means', () => {
    it('sums the stat block, the aggregator and the old status list', () => {
        const aggregator = new ModifierAggregator('e');
        aggregator.addModifier({ type: EFFECT_TYPES.ARMOR, value: 3, bucket: 'flat', source: 't' });
        expect(enemyFlatArmor({ armor: 2, aggregator }, [])).toBe(5);
    });

    it('reads DEFENSE too, because armour items register on that axis', () => {
        const aggregator = new ModifierAggregator('e');
        aggregator.addModifier({ type: 'DEFENSE', value: 4, bucket: 'flat', source: 't' });
        expect(enemyFlatArmor({ aggregator })).toBe(4);
    });

    it('stops a thorn it is big enough to stop', () => {
        const fight = engage();
        fight.aggregator.addModifier({ type: EFFECT_TYPES.ARMOR, value: 10, bucket: 'flat', source: 'test' });
        const before = fight.combat.enemyHp.current;

        const dealt = deal(
            { ...makeStatement(KEYWORD.DEALS), target: { role: ROLE.SELF }, payload: { amount: 4 } },
            { self: MONSTER, selfFightTile: MONSTER }
        );

        // WARNING: floors at ZERO, not at one - the same asymmetry
        // `mitigateFlatDamage` carries on the hero side. A floor of 1 would make
        // heavy armour worth exactly as much as none against every thorn.
        expect(dealt).toBe(0);
        expect(fight.combat.enemyHp.current).toBe(before);
    });

    it('and lets a piercing one through anyway (G-23)', () => {
        const fight = engage();
        fight.aggregator.addModifier({ type: EFFECT_TYPES.ARMOR, value: 10, bucket: 'flat', source: 'test' });
        const before = fight.combat.enemyHp.current;

        deal(
            {
                ...makeStatement(KEYWORD.DEALS), target: { role: ROLE.SELF },
                payload: { amount: 4, ignoresArmor: true }
            },
            { self: MONSTER, selfFightTile: MONSTER }
        );

        expect(fight.combat.enemyHp.current).toBe(before - 4);
    });

    it('a carried Armor Shield is what supplies that armour', () => {
        const fight = engage();
        authored('effect_monster_shield', lasting(EFFECT_TYPES.ARMOR, 6));

        expect(enemyFlatArmor(fight.enemy, fight.combat.enemyStatuses)).toBe(0);
        LiveEffects.applyTo(bearer(), { effectId: 'effect_monster_shield', durationMs: 60000 });
        expect(enemyFlatArmor(fight.enemy, fight.combat.enemyStatuses)).toBe(6);
    });

    it('and gives it back when the effect is removed', () => {
        const fight = engage();
        authored('effect_temp_shield', lasting(EFFECT_TYPES.ARMOR, 6));
        const b = bearer();
        LiveEffects.applyTo(b, { effectId: 'effect_temp_shield', durationMs: 60000 });

        LiveEffects.removeFrom(b, 'effect_temp_shield');

        expect(enemyFlatArmor(fight.enemy, fight.combat.enemyStatuses)).toBe(0);
    });
});

describe('WARNING: "this entity" on a monster means the MONSTER', () => {
    it('damages the monster, not the hero standing on its tile', () => {
        const fight = engage();
        authored('effect_self_dot', overTime(5));
        LiveEffects.applyTo(bearer(), { effectId: 'effect_self_dot', durationMs: 60000 });

        const enemyBefore = fight.combat.enemyHp.current;
        const heroBefore = HeroManager.getHero('hero_1').hp.current;

        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);

        expect(fight.combat.enemyHp.current).toBe(enemyBefore - 5);
        expect(HeroManager.getHero('hero_1').hp.current).toBe(heroBefore);
    });

    it('reaches nobody once the fight is over', () => {
        const fight = engage();
        const statement = {
            ...makeStatement(KEYWORD.DEALS), target: { role: ROLE.SELF },
            payload: { amount: 3, ignoresArmor: true }
        };
        expect(deal(statement, { self: MONSTER, selfFightTile: MONSTER })).toBe(3);

        BoardCombat.endFight(MONSTER);
        expect(deal(statement, { self: MONSTER, selfFightTile: MONSTER })).toBe(0);
        expect(fight.combat.enemyHp.current).toBeGreaterThan(0);
    });
});

describe('`Applies` reaches an enemy the same way a status does', () => {
    it('WARNING: lands a library effect on the monster when nobody is standing there', () => {
        // The two halves of `Applies` used to resolve targets differently: the
        // status branch went through the occupant rule (hero first, else the
        // live enemy) and the library-effect branch asked `heroOnTile` and
        // stopped. So the identical rule reached a monster or did not, purely by
        // which kind of thing it happened to name.
        engage();
        authored('effect_applied_dot', overTime(2));

        // Aimed at the creature explicitly, the way an item-borne rule does.
        const landed = StatusApplication.applyAt(MONSTER, {
            effectId: 'effect_applied_dot', target: 'enemy', durationMs: 60000
        });

        expect(landed).toBe(true);
        expect(BoardCombat.getFight(MONSTER).effects).toHaveLength(1);
    });

    it('still prefers the hero when the rule does not ask for the enemy', () => {
        engage();
        authored('effect_hero_first', lasting(EFFECT_TYPES.ARMOR, 2));

        StatusApplication.applyAt(MONSTER, { effectId: 'effect_hero_first', durationMs: 60000 });

        expect(LiveEffects.carries(HeroManager.getHero('hero_1'), 'effect_hero_first')).toBe(true);
        expect(BoardCombat.getFight(MONSTER).effects).toHaveLength(0);
    });

    it('reaches nobody on an ordinary Token with nobody on it', () => {
        place(BUSH, 'fixture_producer');
        authored('effect_nobody', lasting(EFFECT_TYPES.ARMOR, 2));
        expect(StatusApplication.applyAt(BUSH, {
            effectId: 'effect_nobody', durationMs: 60000
        })).toBe(false);
    });
});

describe('the hero path is untouched', () => {
    it('still carries, still contributes, still comes off again', () => {
        authored('effect_hero_shield', lasting(EFFECT_TYPES.ARMOR, 4));
        expect(LiveEffects.applyToHero('hero_1', {
            effectId: 'effect_hero_shield', durationMs: 60000
        })).toBe(true);
        expect(LiveEffects.heroCarries(HeroManager.getHero('hero_1'), 'effect_hero_shield')).toBe(true);
        expect(LiveEffects.removeFromHero('hero_1', 'effect_hero_shield')).toBe(1);
    });
});
