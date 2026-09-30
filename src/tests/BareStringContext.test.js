import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as Charges from '../systems/board/Charges.js';
import { showsNearRing } from '../systems/board/reachDisplay.js';
import { contextSummary } from '../ui/components/board/StationRecipeModal.jsx';
import { registerRecipePools, contextRequirementsOf, contextTagsOf } from '../config/registries/recipePoolRegistry.js';
import { registerTokenTypes, tokenStartingUses, productionRoutes } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { pickRecipe } from './fixtures/stations.js';

/**
 * Slice 7.5a — a bare-string `requiresContext` must never crash the game.
 *
 * The CMS writes `["anvil"]` before the author picks a tier. The game screen
 * used to die in `RecipeResolver.getMissingRequirements` (`req.tag.split` on
 * undefined). Every reader now goes through `contextRequirementsOf`, which
 * reads a bare string as that tag at tier 1 with no charge cost.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerTokenTypes({
    fx_bare_station: {
        id: 'fx_bare_station', name: 'Bare Context Station', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 900, sprite: 'skill_flask',
        config: { skill: 'fx_bare_ctx', skillRequired: 1, cycleTimeMs: 16000, xp: 3 },
        statements: [{ id: 'stm_fx_bare_station', keyword: KEYWORD.STATION, payload: { skill: 'fx_bare_ctx' } }]
    }
});

registerRecipePools({
    fx_bare_ctx: [{
        id: 'fx_bare_recipe',
        levelRequirement: 1,
        // A bare string, exactly as the CMS writes it before a tier is picked.
        requiresContext: ['ctx_fixture_a'],
        inputs: [],
        outputs: [{ itemId: 'fixture_carrot', minQty: 1, maxQty: 1, chance: 100 }],
        durationMs: 10000,
        xp: 1
    }]
});

// 160 u apart: inside the Near radius.
const STATION = { x: 400, y: 300 };
const BESIDE = { x: 560, y: 300 };

function place(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return pickRecipe(instance);   // the player picks a station's recipe (TL-15)
}

beforeEach(() => {
    GameState.initNew();
});

describe('contextRequirementsOf — the one reader of requiresContext', () => {
    it('reads a bare string as that tag at tier 1, costing nothing', () => {
        expect(contextRequirementsOf({ requiresContext: ['anvil'] }))
            .toEqual([{ tag: 'anvil', minTier: 1, chargeCost: 0 }]);
    });

    it('keeps a complete object entry as authored', () => {
        expect(contextRequirementsOf({ requiresContext: [{ tag: 'anvil', minTier: 2, chargeCost: 3 }] }))
            .toEqual([{ tag: 'anvil', minTier: 2, chargeCost: 3 }]);
    });

    it('mixes both, and drops entries with no tag', () => {
        const recipe = { requiresContext: ['anvil', { tag: 'tongs', minTier: 2 }, '', null, {}, { minTier: 1 }] };
        expect(contextRequirementsOf(recipe)).toEqual([
            { tag: 'anvil', minTier: 1, chargeCost: 0 },
            { tag: 'tongs', minTier: 2, chargeCost: 0 },
        ]);
        expect(contextTagsOf(recipe)).toEqual(['anvil', 'tongs']);
    });

    it('treats a missing or non-list requiresContext as no requirements', () => {
        expect(contextRequirementsOf({})).toEqual([]);
        expect(contextRequirementsOf(null)).toEqual([]);
        expect(contextRequirementsOf({ requiresContext: 'anvil' })).toEqual([]);
    });
});

describe('A station whose recipe names its context as a bare string', () => {
    it('reports missing_context, not a crash, when the tag is absent', () => {
        const station = place(STATION, 'fx_bare_station');
        expect(station.selectedRecipeId).toBe('fx_bare_recipe');
        const verdict = RecipeResolver.resolveRecipe(station.id, station);
        expect(verdict.reason).toBe('missing_context');
        expect(verdict.missingContext.map((c) => c.tag)).toEqual(['ctx_fixture_a']);
    });

    it('getMissingRequirements (the progress bar and hero bubbles) names it and never throws', () => {
        const station = place(STATION, 'fx_bare_station');
        let result;
        expect(() => { result = RecipeResolver.getMissingRequirements(station.id, station); }).not.toThrow();
        expect(result).toEqual({ type: 'tokens', items: ['Ctx Fixture A'] });
    });

    it('runs when the tag is provided beside it', () => {
        const station = place(STATION, 'fx_bare_station');
        place(BESIDE, 'fixture_context_a');
        const verdict = RecipeResolver.resolveRecipe(station.id, station);
        expect(verdict.reason).toBeUndefined();
        expect(verdict.recipe.id).toBe('fx_bare_recipe');
        expect(RecipeResolver.getMissingRequirements(station.id, station).type).not.toBe('tokens');
        expect(Charges.planCycle(station.id, station, { recipe: verdict.recipe }).ok).toBe(true);
    });

    it('the charge planner counts the bare tag as a requirement rather than skipping it', () => {
        const station = place(STATION, 'fx_bare_station');
        const plan = Charges.planContextCharges(station.id, ['ctx_fixture_a']);
        expect(plan.missing).toEqual([{ tag: 'ctx_fixture_a', reason: 'absent' }]);
    });

    it('the recipe picker, the inspection drawer and the reach ring read it too', () => {
        expect(contextSummary(StationRecipe.selectedRecipe(place(STATION, 'fx_bare_station'))))
            .toBe('ctx_fixture_a (tier 1)');
        expect(productionRoutes('fx_bare_station').map((r) => r.requiresContext)).toEqual([['ctx_fixture_a']]);
        expect(showsNearRing('fx_bare_station')).toBe(true);
    });
});
