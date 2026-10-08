// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools, recipesForFoundation, recipesForToken } from '../config/registries/recipePoolRegistry.js';
import {
    foundationTierOf, foundationMinTierOf, foundationTierMeets
} from '../config/registries/tokenConstants.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { resolveRecipe } from '../systems/board/RecipeResolver.js';
import { bandStationRecipes } from '../systems/board/RecipeBands.js';
import { StationRecipeModal } from '../ui/components/board/StationRecipeModal.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Foundation tiers: a Foundation has a tier, a building recipe a minimum Foundation tier, and a
 * higher tier builds everything a lower one can (the `requiresContext.minTier` rule). No tier on
 * either side reads 1, so content that sets none behaves exactly as before.
 */

const foundation = (id, tier) => ({
    id, name: id, rarity: 'common', theme: 'fixture', uses: 1,
    foundation: tier === undefined
        ? { kind: 'wood', skill: 'construction' }
        : { kind: 'wood', skill: 'construction', tier }
});

registerTokenTypes({
    fixture_tier_cabin: { id: 'fixture_tier_cabin', name: 'Fixture Cabin', rarity: 'common', theme: 'fixture', uses: 1 },
    fixture_tier_hall: { id: 'fixture_tier_hall', name: 'Fixture Hall', rarity: 'common', theme: 'fixture', uses: 1 },
    fixture_tier_none: foundation('fixture_tier_none'),
    fixture_tier_1: foundation('fixture_tier_1', 1),
    fixture_tier_2: foundation('fixture_tier_2', 2),
    fixture_tier_3: foundation('fixture_tier_3', 3),
});

const build = (id, name, target, extra = {}) => ({
    id, name, levelRequirement: 1, foundationKinds: ['wood'], inputs: [],
    outputs: [{ tokenId: target, chance: 100, minQty: 1, maxQty: 1 }],
    durationMs: 3000, xp: 1, ...extra
});

registerRecipePools({
    construction: [
        build('fixture_tier_build_cabin', 'Build Cabin', 'fixture_tier_cabin'),
        build('fixture_tier_build_hall', 'Build Hall', 'fixture_tier_hall', { foundationMinTier: 2 }),
    ]
});

const CABIN = 'fixture_tier_build_cabin';
const HALL = 'fixture_tier_build_hall';
const ids = (list) => list.map(r => r.id);
const pool = (typeId) => ids(recipesForFoundation(getTokenType(typeId)));

beforeEach(() => GameState.initNew());
afterEach(cleanup);

describe('the tier reading', () => {
    it('a Foundation with no tier is tier 1; a recipe with no minimum needs tier 1', () => {
        expect(foundationTierOf(getTokenType('fixture_tier_none'))).toBe(1);
        expect(foundationTierOf(getTokenType('fixture_tier_3'))).toBe(3);
        expect(foundationMinTierOf({})).toBe(1);
        expect(foundationMinTierOf({ foundationMinTier: 2 })).toBe(2);
    });

    it('nonsense reads as tier 1 rather than locking or unlocking everything', () => {
        for (const bad of [0, -2, 1.5, null, '3', Number.NaN, Infinity]) {
            expect(foundationTierOf({ foundation: { tier: bad } })).toBe(1);
            expect(foundationMinTierOf({ foundationMinTier: bad })).toBe(1);
        }
    });

    it('higher meets lower, lower does not meet higher', () => {
        const recipe = { foundationMinTier: 2 };
        expect(foundationTierMeets({ foundation: { tier: 1 } }, recipe)).toBe(false);
        expect(foundationTierMeets({ foundation: { tier: 2 } }, recipe)).toBe(true);
        expect(foundationTierMeets({ foundation: { tier: 3 } }, recipe)).toBe(true);
    });
});

describe('the engine: a Foundation’s pool', () => {
    it('a tier-2 recipe is refused on a tier-1 Foundation, and offered on tier 2 and tier 3', () => {
        expect(pool('fixture_tier_1')).toEqual([CABIN]);
        expect(pool('fixture_tier_2')).toEqual([CABIN, HALL]);
        expect(pool('fixture_tier_3')).toEqual([CABIN, HALL]);
    });

    it('a Foundation with no tier set is tier 1', () => {
        expect(pool('fixture_tier_none')).toEqual([CABIN]);
        expect(ids(recipesForToken(getTokenType('fixture_tier_none')))).toEqual([CABIN]);
    });

    it('the selection refuses a recipe above the Foundation’s tier', () => {
        const low = { id: 't_low', typeId: 'fixture_tier_1' };
        expect(StationRecipe.setSelectedRecipe(low, HALL)).toBe(false);
        expect(low.selectedRecipeId).toBeUndefined();
        expect(StationRecipe.setSelectedRecipe(low, CABIN)).toBe(true);

        const high = { id: 't_high', typeId: 'fixture_tier_3' };
        expect(StationRecipe.setSelectedRecipe(high, HALL)).toBe(true);
        expect(high.selectedRecipeId).toBe(HALL);
    });

    it('an old save that chose a recipe above the tier is dropped back to Choose what to build', () => {
        const saved = { id: 't_saved', typeId: 'fixture_tier_1', selectedRecipeId: HALL };
        const result = resolveRecipe(saved.id, saved);
        expect(result.recipe).toBeNull();
        expect(result.reason).toBe('choose_build');
        expect(saved.selectedRecipeId).toBeUndefined();

        const ok = { id: 't_ok', typeId: 'fixture_tier_2', selectedRecipeId: HALL };
        expect(resolveRecipe(ok.id, ok).recipe?.id).toBe(HALL);
    });
});

describe('the picker', () => {
    const offered = (typeId) => {
        const banding = bandStationRecipes(getTokenType(typeId), null, []);
        render(React.createElement(StationRecipeModal, {
            isOpen: true, onClose: () => {}, tokenName: typeId, banding, selectedRecipeId: null, onSelect: () => {}
        }));
        const shown = [...document.body.querySelectorAll('[data-recipe-id]')].map(el => el.getAttribute('data-recipe-id'));
        cleanup();
        return shown;
    };

    it('a tier-1 Foundation’s picker omits the tier-2 recipe', () => {
        expect(offered('fixture_tier_1')).toEqual([CABIN]);
        expect(offered('fixture_tier_none')).toEqual([CABIN]);
    });

    it('a tier-2 and a tier-3 Foundation’s picker offers it', () => {
        expect(offered('fixture_tier_2')).toEqual([CABIN, HALL]);
        expect(offered('fixture_tier_3')).toEqual([CABIN, HALL]);
    });

    it('a row that needs more than tier 1 says so; a tier-1 row does not', () => {
        const banding = bandStationRecipes(getTokenType('fixture_tier_3'), null, []);
        render(React.createElement(StationRecipeModal, {
            isOpen: true, onClose: () => {}, tokenName: 'T3', banding, selectedRecipeId: null, onSelect: () => {}
        }));
        const row = (id) => document.body.querySelector(`[data-recipe-id="${id}"]`).textContent;
        expect(row(HALL)).toContain('Foundation tier 2 or higher');
        expect(row(CABIN)).not.toContain('Foundation tier');
    });
});
