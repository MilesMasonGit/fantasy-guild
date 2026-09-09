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
import * as EffectActions from '../systems/board/EffectActions.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, getKeyword, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **`Heals`, `Restores` and `Removes`** (Effects Grammar v2, V8 — G-11).
 *
 * Each ships with a reader that already existed. Two of them finally give a home
 * to things this project has been carrying unused for a long time: `Restores`
 * is what `CHARGE_EXTEND` was named for and never got, and `Removes` is the
 * first caller `purge()` has ever had.
 */

const A = 15;

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
const hp = () => HeroManager.getHero('hero_1').hp.current;

/** A producer carrying one action rule, fired by its own completed cycle. */
function actingProducer(id, keyword, payload, target = ROLE.ACTOR) {
    registerEffects({
        [`effect_${id}`]: {
            id: `effect_${id}`, name: id,
            statements: [{
                ...makeStatement(keyword), id: `stm_${id}`,
                target: { role: target }, payload
            }]
        }
    });
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: 50, sprite: 'skill_nature',
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

describe('Heals', () => {
    it('puts health back on the hero who worked it', () => {
        actingProducer('fixture_healing_spring', KEYWORD.HEALS, { amount: 15 });
        GameState.state.heroes = [makeHero('hero_1', 50)];
        place(A, 'fixture_healing_spring', 'hero_1');

        run(13000);

        expect(hp()).toBe(65);
    });

    it('⚠️ never overheals — a top-up stops at full', () => {
        // `modifyHeroHp` clamps to max, which is what every other heal in the
        // game does. Inventing an overheal here would be a mechanic arriving
        // through a verb rather than through a decision.
        actingProducer('fixture_big_heal', KEYWORD.HEALS, { amount: 500 });
        GameState.state.heroes = [makeHero('hero_1', 90)];
        place(A, 'fixture_big_heal', 'hero_1');

        run(13000);

        expect(hp()).toBe(100);
    });

    it('takes a computed magnitude, exactly as damage does', () => {
        actingProducer('fixture_pct_heal', KEYWORD.HEALS, {
            amount: 20, magnitude: 'stat', stat: 'actor_max_hp'
        });
        GameState.state.heroes = [makeHero('hero_1', 50)];
        place(A, 'fixture_pct_heal', 'hero_1');

        run(13000);

        expect(hp()).toBe(70);   // 20% of 100 max
    });
});

describe('Restores — the reader CHARGE_EXTEND was named for', () => {
    it('gives a Token charges back', () => {
        actingProducer('fixture_self_repair', KEYWORD.RESTORES, { amount: 5 }, ROLE.SELF);
        const token = place(A, 'fixture_self_repair', 'hero_1', 20);

        run(13000);

        // One cycle spent one charge and the rule gave five back, ceilinged at
        // the Token's starting charges by `Charges.applyDelta`.
        expect(token.usesRemaining).toBeGreaterThan(19);
    });

    it('⚠️ never pushes a Token past what it was authored to hold', () => {
        actingProducer('fixture_over_repair', KEYWORD.RESTORES, { amount: 500 }, ROLE.SELF);
        const token = place(A, 'fixture_over_repair', 'hero_1', 50);

        run(13000);

        expect(token.usesRemaining).toBeLessThanOrEqual(tokenStartingUses('fixture_over_repair'));
    });

    it('reaches nothing when the role points at no tile', () => {
        expect(EffectActions.restore(
            { payload: { amount: 5 }, target: { role: ROLE.SELF } },
            { self: null, actor: null, source: null }
        )).toBe(0);
    });
});

describe('⭐ Removes — the first caller a cleanse has ever had', () => {
    beforeEach(() => {
        registerEffects({
            fixture_curse: {
                id: 'fixture_curse', name: 'Curse',
                statements: [{ ...makeStatement(KEYWORD.DEALS), id: 'stm_curse' }]
            },
            fixture_blessing: {
                id: 'fixture_blessing', name: 'Blessing',
                statements: [{ ...makeStatement(KEYWORD.DEALS), id: 'stm_bless' }]
            }
        });
    });

    it('takes one named effect off, and leaves the rest', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_curse', durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_blessing', durationMs: 60000 });

        actingProducer('fixture_shrine', KEYWORD.REMOVES, { effectId: 'fixture_curse' });
        place(A, 'fixture_shrine', 'hero_1');

        run(13000);

        expect(HeroManager.getHero('hero_1').effects.map(e => e.effectId))
            .toEqual(['fixture_blessing']);
    });

    it('clears everything when it names nothing — the cure-all', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_curse', durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_blessing', durationMs: 60000 });

        actingProducer('fixture_font', KEYWORD.REMOVES, { effectId: '' });
        place(A, 'fixture_font', 'hero_1');

        run(13000);

        expect(HeroManager.getHero('hero_1').effects).toEqual([]);
    });

    it('does nothing gracefully when there is nothing to remove', () => {
        actingProducer('fixture_idle_shrine', KEYWORD.REMOVES, { effectId: 'fixture_curse' });
        place(A, 'fixture_idle_shrine', 'hero_1');

        expect(() => run(13000)).not.toThrow();
        expect(HeroManager.getHero('hero_1').effects).toEqual([]);
    });
});

describe('the grammar declares all three', () => {
    it('makes each a role-targeting verb that needs a moment', () => {
        for (const id of [KEYWORD.HEALS, KEYWORD.RESTORES, KEYWORD.REMOVES]) {
            const kw = getKeyword(id);
            expect(kw, id).toBeTruthy();
            expect(kw.targetsRole, id).toBe(true);
            expect(kw.when, id).toBe('required');
            expect(kw.filter, id).toBe(false);
        }
    });

    it('starts each on the Thorns moment rather than as a Bank watcher', () => {
        for (const id of [KEYWORD.HEALS, KEYWORD.RESTORES, KEYWORD.REMOVES]) {
            expect(makeStatement(id).when.event, id).toBe('SELF_CYCLE_COMPLETE');
        }
    });

    it('⚠️ gives each the default target its verb actually means', () => {
        // Stamping `actor` on everything meant `Restores` and `Transforms` were
        // born aiming at a hero, and both resolve a TILE from that role — so an
        // unstaffed Token could never repair or transform itself on any board.
        expect(makeStatement(KEYWORD.HEALS).target.role).toBe(ROLE.ACTOR);
        expect(makeStatement(KEYWORD.REMOVES).target.role).toBe(ROLE.ACTOR);
        expect(makeStatement(KEYWORD.RESTORES).target.role).toBe(ROLE.SELF);
        expect(makeStatement(KEYWORD.TRANSFORMS).target.role).toBe(ROLE.SELF);
    });
});

describe('the sentences read literally', () => {
    it('says health, charges and effects in their own words', () => {
        expect(renderStatement(makeStatement(KEYWORD.HEALS)))
            .toBe("When this Token's own cycle completes, heals 1 health on the actor.");
        // ⚠️ `Restores` is born aiming at THIS TOKEN, not at the actor. Charges
        // belong to a Token, and aiming at the hero meant an unstaffed Token
        // could never repair itself on any board.
        expect(renderStatement(makeStatement(KEYWORD.RESTORES)))
            .toBe("When this Token's own cycle completes, restores 1 charge to this entity.");
    });

    it('⚠️ distinguishes the cure-all from a named cleanse', () => {
        expect(renderStatement(makeStatement(KEYWORD.REMOVES)))
            .toContain('every lingering effect');
        expect(renderStatement(
            { ...makeStatement(KEYWORD.REMOVES), payload: { effectId: 'e' } },
            { effect: () => 'Poison' }
        )).toContain('removes Poison from');
    });

    it('pluralises charges correctly', () => {
        const s = makeStatement(KEYWORD.RESTORES);
        expect(renderStatement({ ...s, payload: { amount: 1 } })).toContain('1 charge to');
        expect(renderStatement({ ...s, payload: { amount: 3 } })).toContain('3 charges to');
    });
});
