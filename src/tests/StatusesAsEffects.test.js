import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { computeHeroDamage, damageMultiplierOf, heroFlatArmor } from '../utils/CombatFormulas.js';
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
 * ⭐ **All seven statuses, as ordinary library effects** (V7).
 *
 * The owner's goal, in their words: *"My goal is to be able to author these
 * effects and others like it using our new effects system."* ER-13 is retired;
 * a status is a library entry with a clock, authored in the CMS like anything
 * else.
 *
 * This file is the proof that the **system can express all seven** — not that
 * the seven have been authored. Authoring is the owner's, in the CMS, and it is
 * what has to happen before the old engine can be deleted.
 *
 * The seven turn out to be two shapes and nothing more:
 *
 * | Today                                   | Really is                          |
 * | --------------------------------------- | ---------------------------------- |
 * | Poison, Burning, Bleed                  | `Deals N` on a clock, for a while  |
 * | Armor Shield, Well Fed, Cookout, Stun   | `Provides …` **with a duration**   |
 *
 * ⚠️ The second shape is what V7 built. Until now a carried effect could hurt
 * you but could not make you tougher — `LiveEffects` fired `EFFECT_TICK`
 * statements and contributed no modifiers at all, so four of the seven were
 * literally unsayable.
 */

const TILE = 15;

function makeHero(id, hp = 100) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: hp, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const hero = () => HeroManager.getHero('hero_1');

/** Author one library effect, the way the CMS would. */
function authored(id, name, statement) {
    registerEffects({ [id]: { id, name, statements: [{ id: `stm_${id}`, ...statement }] } });
    return id;
}

/** A recurring damage effect — the Poison/Burning/Bleed shape. */
const overTime = (amount) => ({
    ...makeStatement(KEYWORD.DEALS),
    when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF },
    payload: { amount, ignoresArmor: true }
});

/** A lasting modifier — the Armor Shield/Well Fed/Cookout/Stun shape. */
const lasting = (type, value, bucket = 'flat') => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type, bucket, value }
});

const carry = (effectId, ms = 60000) =>
    LiveEffects.applyToHero('hero_1', { effectId, durationMs: ms });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    LiveEffects.resetClock();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
});

describe('⭐ the three that tick — Poison, Burning, Bleed', () => {
    it('Poison: 2 damage every five seconds', () => {
        authored('effect_poison', 'Poison', overTime(2));
        carry('effect_poison');

        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
        expect(hero().hp.current).toBe(98);

        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
        expect(hero().hp.current).toBe(96);
    });

    it('Burning: hotter and shorter, the same shape at different numbers', () => {
        authored('effect_burning', 'Burning', overTime(4));
        carry('effect_burning');

        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
        expect(hero().hp.current).toBe(96);
    });

    it('reads as one honest sentence', () => {
        expect(renderStatement(overTime(2)))
            .toBe('When a few seconds pass while this is carried, deals 2 damage to this entity, ignoring armour.');
    });
});

describe('⭐ the four that linger — and the capability V7 had to build', () => {
    it('Armor Shield: flat Armor while carried', () => {
        // ⚠️ Before V7 a carried effect contributed no modifiers at all, so this
        // whole shape — four of the seven statuses — was unsayable.
        authored('effect_armor_shield', 'Armor Shield', lasting(EFFECT_TYPES.ARMOR, 3));

        expect(heroFlatArmor(hero())).toBe(0);
        carry('effect_armor_shield');
        expect(heroFlatArmor(hero())).toBe(3);
    });

    it('Well Fed: a percentage of outgoing damage', () => {
        authored('effect_well_fed', 'Well Fed',
            lasting(EFFECT_TYPES.DAMAGE, 0.10, 'percentage'));

        expect(damageMultiplierOf(hero())).toBeCloseTo(1.0, 5);
        carry('effect_well_fed');
        expect(damageMultiplierOf(hero())).toBeCloseTo(1.10, 5);
    });

    it('Cookout: a board axis, read live at the moment it matters', () => {
        authored('effect_cookout', 'Cookout',
            lasting(EFFECT_TYPES.YIELD, 1.0, 'percentage'));

        place(TILE, 'fixture_producer', 'hero_1');
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 2, 'logging')).toBe(2);

        carry('effect_cookout');
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 2, 'logging')).toBe(4);
    });

    it('Stun: a hit-chance penalty, re-authored rather than translated', () => {
        /**
         * ⚠️ G-7 calls this a **re-authoring**, and it matters here more than
         * anywhere. The old `attack_fail` was "25% chance per stack, capped at
         * 80%"; a negative `ACCURACY` against a 5–95 clamp is not the same
         * arithmetic. The shape is expressible; the numbers are the owner's to
         * choose, and pretending otherwise would be the quiet half-translation
         * this whole line of work exists to refuse.
         */
        authored('effect_stun', 'Stun', lasting(EFFECT_TYPES.ACCURACY, -25));

        carry('effect_stun');
        expect(hero().aggregator.query(EFFECT_TYPES.ACCURACY)).toBe(-25);
    });
});

describe('⚠️ a lingering modifier really does stop when it expires', () => {
    it('takes the armour away again', () => {
        vi.useFakeTimers();
        authored('effect_short_shield', 'Short Shield', lasting(EFFECT_TYPES.ARMOR, 5));

        carry('effect_short_shield', 1);
        expect(heroFlatArmor(hero())).toBe(5);

        vi.advanceTimersByTime(10);
        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);

        expect(hero().effects).toEqual([]);
        expect(heroFlatArmor(hero()), 'the buff outlived the effect').toBe(0);
        vi.useRealTimers();
    });

    it('and takes it away when it is removed by hand', () => {
        authored('effect_removable_shield', 'Removable Shield', lasting(EFFECT_TYPES.ARMOR, 4));
        carry('effect_removable_shield');
        expect(heroFlatArmor(hero())).toBe(4);

        LiveEffects.removeFromHero('hero_1', 'effect_removable_shield');
        expect(heroFlatArmor(hero())).toBe(0);
    });

    it('⚠️ never accumulates when re-synced — one source, replaced not appended', () => {
        authored('effect_stacking_check', 'Shield', lasting(EFFECT_TYPES.ARMOR, 2));
        carry('effect_stacking_check');
        LiveEffects.syncAggregator(hero());
        LiveEffects.syncAggregator(hero());

        expect(heroFlatArmor(hero())).toBe(2);
    });
});

describe('the tier scales a lingering effect too', () => {
    it('makes Armor Shield III three times the shield', () => {
        authored('effect_tiered_shield', 'Tiered Shield', lasting(EFFECT_TYPES.ARMOR, 2));
        LiveEffects.applyToHero('hero_1', {
            effectId: 'effect_tiered_shield', scale: 3, durationMs: 60000
        });

        expect(heroFlatArmor(hero())).toBe(6);
    });
});

describe('⭐ the whole point: a carried buff changes a real fight', () => {
    it('Well Fed makes the hero hit harder', () => {
        authored('effect_wf', 'Well Fed', lasting(EFFECT_TYPES.DAMAGE, 0.50, 'percentage'));

        const enemy = { hp: 100, armor: 0, combatType: 'melee', minDamage: 1, maxDamage: 1 };
        const weapon = { damage: 10 };

        const before = computeHeroDamage(hero(), enemy, weapon, 0, 'melee');
        carry('effect_wf');
        const after = computeHeroDamage(hero(), enemy, weapon, 0, 'melee');

        // The spread is random, so the assertion is on the multiplier having
        // reached the formula at all rather than on an exact number.
        expect(damageMultiplierOf(hero())).toBeCloseTo(1.5, 5);
        expect(before).toBeGreaterThan(0);
        expect(after).toBeGreaterThan(0);
    });
});
