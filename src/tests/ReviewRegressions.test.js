import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **Regressions from the code review of the effects rework.**
 *
 * Every test here pins a defect a reviewer found in shipped-looking work that
 * the existing suite passed clean. They are collected in one file deliberately:
 * each was invisible because a fixture dodged the exact condition that broke —
 * `uses: null` skipping the charge path, a hero standing on every bearer tile,
 * a fixture carrying no `to` key when the editor always writes one.
 *
 * That pattern is the lesson worth keeping: **a fixture that avoids the hard
 * case makes a green suite meaningless.**
 */

const A = 15, NEIGHBOUR = 16;

function makeHero(id, hp = 100) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: hp, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** A producer carrying one rule, fired by its own completed cycle. */
function ruleProducer(id, keyword, payload, extra = {}, uses = null) {
    registerEffects({
        [`effect_${id}`]: {
            id: `effect_${id}`, name: id,
            statements: [{ ...makeStatement(keyword), id: `stm_${id}`, payload, ...extra }]
        }
    });
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses, sprite: 'skill_nature',
            config: {
                skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            effects: [{ effectId: `effect_${id}` }]
        }
    });
    return id;
}

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

describe('⭐ a Token that replaced itself does not pay a charge', () => {
    it('does not destroy the Token it just transformed into', () => {
        /**
         * The severe one. `Transforms` swapped the tile's instance, then the
         * charge delta ran against the **discarded** object — and
         * `Charges.applyDelta` destroys at zero by calling
         * `destroyToken(tile, …)`, which empties **the tile**. So the stale
         * object hitting zero wiped the Oak that had just replaced the Sapling.
         *
         * ⚠️ `uses: 2` is the shape that shows it, and the arithmetic is worth
         * writing down: the cycle itself spends one (leaving the stale object at
         * 1), then the statement's own `chargeDelta: -1` takes that last one and
         * the tile is cleared.
         *
         * ⚠️ `uses: 1` does NOT show it, and that is a separate finding: a
         * one-charge Token is destroyed by `commitPlan` (D-118) BEFORE
         * `CYCLE_COMPLETE` is published, so it never transforms at all. "Leave a
         * Stump behind when this depletes" cannot be authored as a transform on
         * completion today — see the note in the roadmap.
         *
         * Every fixture in `SpawnTransform.test.js` used `uses: null`, the one
         * value that makes `applyDelta` a no-op, so the suite could not see any
         * of this.
         */
        ruleProducer('fixture_sapling_2use', KEYWORD.TRANSFORMS,
            { typeId: 'fixture_passive' }, { target: { role: ROLE.SELF } }, 2);

        place(A, 'fixture_sapling_2use', 'hero_1');
        run(13000);

        const after = BoardState.getToken(A);
        expect(after, 'the tile was emptied').not.toBeNull();
        expect(after.typeId).toBe('fixture_passive');
    });

    it('leaves the new Token its own full charges', () => {
        ruleProducer('fixture_sapling_3use', KEYWORD.TRANSFORMS,
            { typeId: 'fixture_enemy' }, { target: { role: ROLE.SELF } }, 3);

        place(A, 'fixture_sapling_3use', 'hero_1');
        run(13000);

        expect(BoardState.getToken(A).usesRemaining)
            .toBe(tokenStartingUses('fixture_enemy'));
    });
});

describe('⭐ a Token-borne Applies reaches somebody', () => {
    beforeEach(() => {
        registerEffects({
            fixture_lingering: {
                id: 'fixture_lingering', name: 'Lingering',
                statements: [{ ...makeStatement(KEYWORD.DEALS), id: 'stm_ling' }]
            }
        });
    });

    it('attaches a library effect from an AMBIENT rule', () => {
        /**
         * `applicableStatements` guarded on `statusId` alone, so an `Applies`
         * naming a library effect — which is what the editor produces by
         * default — was never yielded. The sentence rendered perfectly and
         * nothing happened, on every Token in the game.
         */
        registerTokenTypes({
            fixture_cursed_ground: {
                id: 'fixture_cursed_ground', name: 'Cursed Ground', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
                statements: [{
                    ...makeStatement(KEYWORD.APPLIES), id: 'stm_curse_ground',
                    when: null,
                    payload: { effectId: 'fixture_lingering', scale: 1, durationMs: 60000, chance: 100 }
                }]
            }
        });

        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_cursed_ground');
        run(13000);

        expect(HeroManager.getHero('hero_1').effects.map(e => e.effectId))
            .toContain('fixture_lingering');
    });

    it('attaches one from a TRIGGERED rule too', () => {
        registerTokenTypes({
            fixture_curse_trap: {
                id: 'fixture_curse_trap', name: 'Curse Trap', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
                statements: [{
                    ...makeStatement(KEYWORD.APPLIES), id: 'stm_curse_trap',
                    when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
                    payload: { effectId: 'fixture_lingering', scale: 1, durationMs: 60000, chance: 100 }
                }]
            }
        });

        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_curse_trap');
        run(13000);

        expect(HeroManager.getHero('hero_1').effects.map(e => e.effectId))
            .toContain('fixture_lingering');
    });
});

describe('⭐ a station can always be authored', () => {
    it('offers a real skill picker for Works as, and picking one sets the skill', () => {
        /**
         * The original defect: `Works as` had no slot, and the payload form was
         * rendered only when a `FORM`-kind slot existed — so it had no control
         * at all, and since `stationSkillOf` is the sole input to
         * `deriveTokenType`, **no new station Token could be authored**.
         *
         * Rules Line P4 retired the forms, so the guarantee moved to the model:
         * `Works as` now carries its own skill slot. This test pins THAT, rather
         * than the old "keyword slot only, the form does the rest" shape it used
         * to assert — a picker that exists is the thing that must never regress.
         */
        const station = makeStatement(KEYWORD.STATION);
        const skill = slotsOf(station).find(s => s.id === 'skill');
        expect(skill, 'Works as lost its skill picker').toBeTruthy();
        expect(skill.options.map(o => o.id)).toContain('cooking');
        expect(skill.patch('cooking').payload.skill).toBe('cooking');
    });
});

describe('⭐ an unstaffed Token can still act on itself', () => {
    it('transforms with no hero anywhere near it', () => {
        // `Transforms` was born aiming at `the actor`, and resolves a TILE from
        // that role — so an unstaffed passive generator (D-116) could never
        // transform on any board.
        ruleProducer('fixture_lonely_sapling', KEYWORD.TRANSFORMS,
            { typeId: 'fixture_passive' });
        registerTokenTypes({
            fixture_lonely_sapling: {
                ...getTokenType('fixture_lonely_sapling'),
                requiresHero: false
            }
        });

        place(A, 'fixture_lonely_sapling');
        run(13000);

        expect(BoardState.getToken(A).typeId).toBe('fixture_passive');
    });
});

describe('⭐ a hero leaving switches a state filter back off', () => {
    it('drops a "being worked" buff when the hero is recalled', () => {
        /**
         * `HERO_MOVED` is published with `tile: null` on every recall, and
         * `placeHero` names only the destination — the vacated tile is never in
         * the payload. Rebuilding only on arrival meant the buff switched on and
         * never off: it stayed live for the rest of the session.
         */
        registerTokenTypes({
            fixture_worked_buff: {
                id: 'fixture_worked_buff', name: 'Worked Buff', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
                statements: [{
                    id: 'stm_worked_buff', keyword: 'provides',
                    to: { mode: 'all', value: '', filters: [{ kind: 'worked' }] },
                    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }
                }]
            }
        });

        place(NEIGHBOUR, 'fixture_worked_buff');
        place(A, 'fixture_producer', 'hero_1');

        const buffed = TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2, 'logging');
        expect(buffed).toBe(4);

        Placement.recallHeroById('hero_1');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2, 'logging')).toBe(2);
    });
});

describe('⭐ a distant duplicate cannot suppress an adjacent one', () => {
    it('keeps the buff that actually reaches this tile', () => {
        /**
         * The source set widened to every occupied tile, scanned in ascending
         * order, but the `noStackDuplicates` guard still ran BEFORE the reach
         * test. A far copy at a low tile index claimed the slot and the adjacent
         * copy — whose rule genuinely reached here — was skipped.
         */
        registerTokenTypes({
            fixture_unique_buff: {
                id: 'fixture_unique_buff', name: 'Unique Buff', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
                noStackDuplicates: true,
                statements: [{
                    id: 'stm_unique_buff', keyword: 'provides',
                    to: { mode: 'all', value: '' },
                    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }
                }]
            }
        });

        place(0, 'fixture_unique_buff');          // far, and lowest tile index
        place(NEIGHBOUR, 'fixture_unique_buff');  // adjacent to A
        place(A, 'fixture_producer', 'hero_1');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2, 'logging')).toBe(4);
    });
});

describe('⭐ chaining fires immediately, as the editor promises', () => {
    it('runs a no-duration effect at the moment it is applied', () => {
        /**
         * A zero duration pushed an instance already expired: nothing ran then,
         * its statements fired on the *next* five-second tick if at all, and any
         * statement on another moment never fired. "Immediately" meant "up to
         * five seconds later, maybe".
         */
        registerEffects({
            fixture_burst: {
                id: 'fixture_burst', name: 'Burst',
                statements: [{
                    ...makeStatement(KEYWORD.DEALS), id: 'stm_burst',
                    when: { event: 'EFFECT_TICK', scope: 'self' },
                    target: { role: ROLE.SELF },
                    payload: { amount: 7, ignoresArmor: true }
                }]
            }
        });
        registerTokenTypes({
            fixture_burst_trap: {
                id: 'fixture_burst_trap', name: 'Burst Trap', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
                statements: [{
                    ...makeStatement(KEYWORD.APPLIES), id: 'stm_burst_trap',
                    when: null,
                    payload: { effectId: 'fixture_burst', scale: 1, durationMs: 0, chance: 100 }
                }]
            }
        });

        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_burst_trap');
        run(13000);

        // It hurt, and it left nothing behind.
        expect(HeroManager.getHero('hero_1').hp.current).toBeLessThan(100);
        expect(HeroManager.getHero('hero_1').effects).toEqual([]);
    });
});

describe('⭐ the audit names a rule that can never fire where it sits', () => {
    it('flags EFFECT_TICK on a Token, which only a carried effect gets', () => {
        registerEffects({
            fixture_tick_on_token: {
                id: 'fixture_tick_on_token', name: 'Ticking',
                statements: [{
                    ...makeStatement(KEYWORD.DEALS), id: 'stm_tick_tok',
                    when: { event: 'EFFECT_TICK', scope: 'self' }
                }]
            }
        });
        registerTokenTypes({
            fixture_confused_ticker: {
                id: 'fixture_confused_ticker', name: 'Confused Ticker', tokenType: 'buff',
                rarity: 'common', uses: 10, sprite: 'skill_occult',
                effects: [{ effectId: 'fixture_tick_on_token' }]
            }
        });

        const mine = auditContent().filter(f => f.where.includes('fixture_confused_ticker'));
        expect(mine.some(f => /only happens to an effect somebody is CARRYING/.test(f.what))).toBe(true);
    });
});

describe('⭐ a percentage is typed as 5 and stored as 0.05', () => {
    it('round-trips through the slot without inflating a hundredfold', () => {
        // The retired form divided by 100; the slot did not, so typing 5 stored
        // 5 and the sentence read "500% more yield".
        const base = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        };
        const slot = slotsOf(base).find(s => s.id === 'value');

        expect(slot.value).toBe(5);                     // shown as the author typed it
        expect(slot.patch(5).payload.value).toBeCloseTo(0.05, 10);
    });

    it('leaves a flat bucket alone', () => {
        const base = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: { type: EFFECT_TYPES.ARMOR, bucket: 'flat', value: 3 }
        };
        const slot = slotsOf(base).find(s => s.id === 'value');

        expect(slot.value).toBe(3);
        expect(slot.patch(7).payload.value).toBe(7);
    });
});
