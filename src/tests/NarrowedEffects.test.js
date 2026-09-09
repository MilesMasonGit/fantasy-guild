import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StatusEffectSystem from '../systems/effects/StatusEffectSystem.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { getPaletteEntry, MODIFIER_PALETTE } from '../config/registries/modifierPalette.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **Two axes that were readable and unwritable** (Effects Robustness P4).
 *
 * `ModifierAggregator._forEachMatching` has matched on `mod.target.category`
 * since it was written, and two live readers pass two different vocabularies
 * into it:
 *
 * * `BoardRunner` passes the Token's `config.skill` on **every** `resolveAxis`
 *   call — so *"+10% yield to Mining only"* has been resolvable all along.
 * * `StatusEffectSystem.applyToHero` passes a status id as
 *   `query('STATUS_IMMUNITY', statusId)` — so immunity has been queryable since
 *   the status engine was built.
 *
 * Neither had a field in the editor, so neither could ever be true. This is the
 * same condition the five combat axes were in before Unified Effects P7, and the
 * Unified Effects roadmap deferred immunity on the false premise that it needed
 * "category-scoped targeting the grammar has never had". The grammar needed
 * nothing; the editor needed a dropdown.
 */

const A = 15, NEIGHBOUR = 16;

function makeHero(id, equipment = []) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    const grid = [...equipment];
    while (grid.length < 9) grid.push(null);
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, equipment: grid,
        aggregator: new ModifierAggregator(id), statuses: []
    };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** A buff Token whose yield rule is scoped to one skill, or to none. */
function skillScopedBuff(id, category) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'buff', rarity: 'rare', theme: 'fixture',
            uses: null, sprite: 'skill_industry',
            statements: [{
                id: `stm_${id}`, keyword: 'provides',
                to: { mode: 'all', value: '' },
                payload: {
                    type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0,
                    ...(category ? { category } : {})
                }
            }]
        }
    });
    return id;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

describe('⭐ a rule can be narrowed to one skill', () => {
    it('applies when the Token is doing that skill', () => {
        // `fixture_producer` works `logging`.
        skillScopedBuff('fixture_logging_only', 'logging');
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_logging_only');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);   // 2 × (1 + 1)
    });

    it('does NOT apply when the Token is doing a different skill', () => {
        skillScopedBuff('fixture_mining_only', 'mining');
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_mining_only');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);   // untouched
    });

    it('applies to everything when no skill is named, as it always has', () => {
        skillScopedBuff('fixture_any_skill', null);
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_any_skill');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);
    });

    it('narrows a CARRIED rule too, which reads live rather than through the aggregator', () => {
        // ⚠️ The loadout path bypasses `ModifierAggregator` entirely, so it
        // bypasses the matching that would normally honour a category. It has to
        // mirror the rule by hand, and this is what proves it does.
        registerEffects({
            fixture_effect_mining_yield: {
                id: 'fixture_effect_mining_yield', name: 'Mining Yield',
                statements: [{
                    ...makeStatement(KEYWORD.PROVIDES),
                    payload: {
                        type: EFFECT_TYPES.YIELD, bucket: 'percentage',
                        value: 1.0, category: 'mining'
                    }
                }]
            }
        });
        registerItems({
            fixture_miners_charm: {
                id: 'fixture_miners_charm', name: "Miner's Charm",
                effects: [{ effectId: 'fixture_effect_mining_yield', scale: 1 }]
            }
        });
        InventoryManager.addItem('fixture_miners_charm', 1);
        GameState.state.heroes = [makeHero('hero_1', ['fixture_miners_charm'])];

        place(A, 'fixture_producer', 'hero_1');   // a LOGGING Token
        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);   // mining rule, logging work
    });
});

describe('⭐ status immunity can finally be written', () => {
    it('blocks the status it names', () => {
        const hero = makeHero('hero_immune');
        hero.aggregator.addModifier({
            type: EFFECT_TYPES.STATUS_IMMUNITY, value: 1, bucket: 'flat',
            source: 'test', target: { category: 'poison' }
        });
        GameState.state.heroes = [hero];

        const result = StatusEffectSystem.applyToHero('hero_immune', 'poison', 3);

        expect(result).toEqual({ success: true, blocked: true });
        expect(HeroManager.getHero('hero_immune').statuses).toEqual([]);
    });

    it('does not block a DIFFERENT status — immunity is per status, not a blanket', () => {
        const hero = makeHero('hero_partly');
        hero.aggregator.addModifier({
            type: EFFECT_TYPES.STATUS_IMMUNITY, value: 1, bucket: 'flat',
            source: 'test', target: { category: 'poison' }
        });
        GameState.state.heroes = [hero];

        StatusEffectSystem.applyToHero('hero_partly', 'burning', 2);

        expect(HeroManager.getHero('hero_partly').statuses)
            .toEqual([{ id: 'burning', stacks: 2 }]);
    });

    it('lets the status through when nothing grants immunity', () => {
        GameState.state.heroes = [makeHero('hero_plain')];
        StatusEffectSystem.applyToHero('hero_plain', 'poison', 2);
        expect(HeroManager.getHero('hero_plain').statuses)
            .toEqual([{ id: 'poison', stacks: 2 }]);
    });

    it('reaches the aggregator from a carried item, category and all', () => {
        // The whole path: library entry → item → loadout → hero-only
        // contribution → the shape `_forEachMatching` matches on.
        registerEffects({
            fixture_effect_antivenom: {
                id: 'fixture_effect_antivenom', name: 'Antivenom',
                statements: [{
                    ...makeStatement(KEYWORD.PROVIDES),
                    payload: {
                        type: EFFECT_TYPES.STATUS_IMMUNITY, bucket: 'flat',
                        value: 1, category: 'poison'
                    }
                }]
            }
        });
        registerItems({
            fixture_antivenom: {
                id: 'fixture_antivenom', name: 'Antivenom',
                effects: [{ effectId: 'fixture_effect_antivenom', scale: 1 }]
            }
        });
        InventoryManager.addItem('fixture_antivenom', 1);

        const hero = makeHero('hero_carrier', ['fixture_antivenom']);
        const contributions = HeroEffects.loadoutCombatContributions(hero);

        expect(contributions).toEqual([
            { type: EFFECT_TYPES.STATUS_IMMUNITY, value: 1, category: 'poison' }
        ]);
    });
});

describe('the palette declares both, rather than inferring them', () => {
    it('offers immunity, scoped to a status, flat, and hero-only', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.STATUS_IMMUNITY);
        expect(entry).toBeTruthy();
        expect(entry.categories).toBe('status');
        expect(entry.heroOnly).toBe(true);
        expect(entry.buckets).toEqual(['flat']);
        // ⚠️ No scale: the reader asks `> 0`, so a scale of 3 would look
        // stronger to an author and behave identically.
        expect(entry.scales).toBeUndefined();
    });

    it('offers a skill scope on exactly the axes whose reader passes one', () => {
        const skillScoped = MODIFIER_PALETTE.filter(e => e.categories === 'skill').map(e => e.type);
        expect(new Set(skillScoped)).toEqual(new Set([
            EFFECT_TYPES.YIELD, EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.INPUT_COST,
            EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.FAIL_CHANCE
        ]));
    });

    it('offers NO category on the combat axes, whose reader passes none', () => {
        // `query('ARMOR')` with no category would never match a scoped modifier,
        // so offering the field would offer something silently discarded.
        for (const type of [EFFECT_TYPES.ARMOR, EFFECT_TYPES.ACCURACY, EFFECT_TYPES.BLOCK,
            EFFECT_TYPES.DAMAGE, EFFECT_TYPES.RESIST_FLAT]) {
            expect(getPaletteEntry(type).categories).toBeUndefined();
        }
    });

    it('marks hero-only axes by declaration, not by the group label', () => {
        // P4 generalised a hardcoded `group === 'Combat'` check in three places.
        // `STATUS_IMMUNITY` has the property and is not combat.
        expect(getPaletteEntry(EFFECT_TYPES.STATUS_IMMUNITY).group).not.toBe('Combat');
        expect(getPaletteEntry(EFFECT_TYPES.STATUS_IMMUNITY).heroOnly).toBe(true);
        expect(getPaletteEntry(EFFECT_TYPES.YIELD).heroOnly).toBeFalsy();
    });
});

describe('the sentence says what was narrowed', () => {
    it('names the status rather than a meaningless magnitude', () => {
        const statement = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: {
                type: EFFECT_TYPES.STATUS_IMMUNITY, bucket: 'flat',
                value: 1, category: 'poison'
            }
        };
        const line = renderStatement(statement);
        expect(line).toContain('immunity to Poison');
        // ⚠️ Never a number: the reader asks `> 0`, so "1 more status immunity"
        // would imply a magnitude that does not exist.
        expect(line).not.toMatch(/\d/);
    });

    it('says which work a skill-scoped rule applies to', () => {
        const statement = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: {
                type: EFFECT_TYPES.YIELD, bucket: 'percentage',
                value: 0.1, category: 'mining'
            }
        };
        expect(renderStatement(statement))
            .toBe('Provides 10% more yield to every adjacent Token, but only for Mining work.');
    });

    it('says nothing extra when a rule is not narrowed', () => {
        const statement = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }
        };
        expect(renderStatement(statement))
            .toBe('Provides 10% more yield to every adjacent Token.');
    });
});
