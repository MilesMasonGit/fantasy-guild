import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import {
    FILTER_KINDS, FILTER_NEEDS, getFilterKind, filtersOf, matchesFilters, filtersPhrase
} from '../config/registries/filterRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **Composable filters** (Effects Grammar v2, V4 — G-9).
 *
 * A selector picks a source set and then stacks any number of filters on it, all
 * AND-composed. This is the expressiveness the owner said was the actual pain —
 * *"I can't express the effects I'm imagining"* — and it is bounded by two
 * things: G-8 refuses guards, and every filter declares what it needs to look at
 * so a caller that cannot evaluate one refuses rather than guessing.
 */

const A = 15, NEIGHBOUR = 16;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
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

/** A buff Token whose yield rule carries whatever filters the caller stacks. */
function filteredBuff(id, filters) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'buff', rarity: 'rare', theme: 'fixture',
            uses: null, sprite: 'skill_industry',
            statements: [{
                id: `stm_${id}`, keyword: 'provides',
                to: { mode: 'all', value: '', filters },
                payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }
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
    // The `being worked` filter needs the tile caches to follow hero movement.
    TileModifiers.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TileModifiers.teardown();
});

describe('a filter narrows who a rule reaches', () => {
    it('applies when the filter passes', () => {
        // `fixture_seafood_producer` carries the tag; the producer does not.
        filteredBuff('fixture_only_seafood', [{ kind: 'tagged', value: 'seafood' }]);
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_only_seafood');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(4);   // 2 × (1 + 1)
    });

    it('does not apply when it fails', () => {
        filteredBuff('fixture_only_wrong_tag', [{ kind: 'tagged', value: 'nothing_has_this' }]);
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_only_wrong_tag');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(2);
    });

    it('⭐ negates, which doubles what every filter can say', () => {
        filteredBuff('fixture_not_seafood', [{ kind: 'tagged', value: 'seafood', not: true }]);
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_not_seafood');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(2);   // excluded
    });

    it('⭐ stacks, and every one must pass (G-9: AND, always)', () => {
        // Tagged seafood AND being worked — the producer is both.
        filteredBuff('fixture_both', [
            { kind: 'tagged', value: 'seafood' },
            { kind: 'worked' }
        ]);
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_both');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(4);
    });

    it('fails the whole stack when one of them fails', () => {
        filteredBuff('fixture_one_bad', [
            { kind: 'tagged', value: 'seafood' },
            { kind: 'tagged', value: 'nothing_has_this' }
        ]);
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_one_bad');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(2);
    });
});

describe('state filters read the live board, not the definition', () => {
    it('⚠️ treats unlimited charges as never running low, not as zero', () => {
        // `null` is UNLIMITED (R-4). Reading it as 0 would make every unlimited
        // Token match a rule aimed at exhausted ones — the whole board.
        const kind = getFilterKind('charges_below');
        expect(kind.match({ instance: { usesRemaining: null } }, 3)).toBe(false);
        expect(kind.match({ instance: { usesRemaining: 2 } }, 3)).toBe(true);
        expect(kind.match({ instance: { usesRemaining: 5 } }, 3)).toBe(false);
    });

    it('sees whether somebody is standing there', () => {
        const kind = getFilterKind('worked');
        expect(kind.match({ heroOnTile: 'hero_1' })).toBe(true);
        expect(kind.match({ heroOnTile: null })).toBe(false);
    });

    it('reaches a worked neighbour and not an idle one', () => {
        filteredBuff('fixture_only_worked', [{ kind: 'worked' }]);
        place(NEIGHBOUR, 'fixture_only_worked');
        place(A, 'fixture_producer', 'hero_1');     // worked
        place(17, 'fixture_producer');              // idle, no hero

        run(13000);

        // Only the staffed one is buffed; the idle one produces nothing anyway,
        // so the total is the buffed tile alone.
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);
    });
});

describe('⚠️ a filter the caller cannot evaluate FAILS, never passes', () => {
    it('refuses rather than guessing when the state is not available', () => {
        // `Restrictions` asks about a Token being put down and has no live
        // instance. Passing would turn a narrow rule board-wide, which is the
        // exact failure `matchesTokenTarget` refuses for unknown modes.
        const spec = { mode: 'all', filters: [{ kind: 'charges_below', value: 3 }] };
        const defOnly = new Set([FILTER_NEEDS.DEF]);
        expect(matchesFilters(spec, { def: {} }, defOnly)).toBe(false);
    });

    it('still passes a definition filter the caller CAN evaluate', () => {
        const spec = { mode: 'all', filters: [{ kind: 'tagged', value: 'seafood' }] };
        const defOnly = new Set([FILTER_NEEDS.DEF]);
        expect(matchesFilters(spec, { def: { tags: ['seafood'] } }, defOnly)).toBe(true);
    });

    it('ignores an unknown filter kind rather than choking on it', () => {
        expect(filtersOf({ filters: [{ kind: 'not_a_real_filter' }] })).toEqual([]);
    });
});

describe('the sentence says what was filtered (G-10)', () => {
    const provides = (filters, extra = {}) => ({
        ...makeStatement(KEYWORD.PROVIDES),
        to: { mode: 'all', value: '', filters }, ...extra,
        payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }
    });

    it('reads unchanged when nothing is filtered', () => {
        expect(renderStatement(provides([])))
            .toBe('Provides 10% more yield to every adjacent Token.');
    });

    it('attaches one filter as a modifier', () => {
        expect(renderStatement(provides([{ kind: 'worked' }])))
            .toBe('Provides 10% more yield to every adjacent Token being worked.');
    });

    it('joins a stack with "and"', () => {
        expect(renderStatement(provides([{ kind: 'tagged', value: 'Coast' }, { kind: 'worked' }])))
            .toBe('Provides 10% more yield to every adjacent Token tagged Coast and being worked.');
    });

    it('⚠️ says a negation as its positive opposite, not as "not with fewer than"', () => {
        // Negating mechanically produces sentences nobody would write, so each
        // filter owns both readings.
        expect(renderStatement(provides([{ kind: 'charges_below', value: 3, not: true }])))
            .toContain('with 3 or more charges');
        expect(renderStatement(provides([{ kind: 'tagged', value: 'Coast', not: true }])))
            .toContain('not tagged Coast');
    });

    it('⚠️ agrees with a plural frame as well as a singular one', () => {
        // The first version wrote "that is …", which produced "Tokens that is
        // being worked". Modifiers attach after either.
        const plural = renderStatement({
            ...provides([{ kind: 'worked' }]),
            to: { mode: 'tag', value: 'Coast', filters: [{ kind: 'worked' }] }
        });
        expect(plural).toBe('Provides 10% more yield to adjacent Coast Tokens being worked.');

        const singular = renderStatement(provides([{ kind: 'worked' }], { reach: 'self' }));
        expect(singular).toBe('Provides 10% more yield to this Token being worked.');
    });

    it('says nothing at all when there are no filters, so callers need no guard', () => {
        expect(filtersPhrase({ mode: 'all' })).toBe('');
        expect(filtersPhrase(null)).toBe('');
    });
});

describe('the vocabulary is declared, with a reader for every row', () => {
    it('gives every filter a label, a hint, a matcher and both readings', () => {
        for (const f of FILTER_KINDS) {
            expect(f.label, f.id).toBeTruthy();
            expect(f.hint, f.id).toBeTruthy();
            expect(typeof f.match, f.id).toBe('function');
            expect(typeof f.phrase, f.id).toBe('function');
            expect(typeof f.negative, f.id).toBe('function');
            expect(Object.values(FILTER_NEEDS), f.id).toContain(f.needs);
        }
    });
});
