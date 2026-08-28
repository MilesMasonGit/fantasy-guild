import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';

/**
 * Hierarchical tool tiers (concept §2.4, R-17).
 *
 * **A higher tier satisfies a lower requirement.** A recipe asking for a Tier 1
 * pickaxe runs beside a Tier 2 one; a recipe asking for Tier 2 does not run
 * beside a Tier 1. That asymmetry is the whole point of tiers — without it,
 * every recipe would have to relist each tool that qualifies, which R-10
 * rules out as making reassignment expensive.
 *
 * The mechanism (`contextTiersAround` keeping the highest tier per tag, and
 * `unmetContext` comparing it against `minTier`) was built across P1 and P2.
 * Nothing pinned the *hierarchy* itself: every other `minTier` test in the
 * suite asks for tier 1 and supplies tier 1, which passes whether the
 * comparison is `>=` or `===`.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const STATION = 17, NEIGHBOUR = 18;

registerTokenTypes({
    fixture_tiered_bench: {
        id: 'fixture_tiered_bench',
        name: 'Fixture Tiered Bench',
        tokenType: 'station',
        rarity: 'common',
        uses: 10,
        sprite: 'skill_mining',
        requiresHero: false,
        statements: [
            {
                id: 'stm_fixture_tiered_bench',
                keyword: KEYWORD.STATION,
                payload: { skill: 'fixture_tier_skill' }
            }
        ]
    }
});

registerRecipePools({
    fixture_tier_skill: [
        {
            id: 'tier_one_job',
            levelRequirement: 1,
            requiresContext: [{ tag: 'pickaxe', minTier: 1, chargeCost: 0 }],
            inputs: [],
            outputs: [{ itemId: 'item_coal', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 10000,
            xp: 1
        },
        {
            id: 'tier_two_job',
            levelRequirement: 1,
            requiresContext: [{ tag: 'pickaxe', minTier: 2, chargeCost: 0 }],
            inputs: [],
            outputs: [{ itemId: 'item_coal', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 10000,
            xp: 1
        }
    ]
});

function place(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

/** What the station is still missing, by tag. */
function missingTags(recipeId) {
    const recipe = { requiresContext: recipeId === 'tier_two_job'
        ? [{ tag: 'pickaxe', minTier: 2 }]
        : [{ tag: 'pickaxe', minTier: 1 }] };
    return RecipeResolver.unmetContext(STATION, recipe).map(r => r.tag);
}

beforeEach(() => {
    GameState.initNew();
});

describe('Hierarchical tool tiers (concept §2.4)', () => {
    it('reads the neighbour’s tier, not merely the presence of its tag', () => {
        place(STATION, 'fixture_tiered_bench');
        place(NEIGHBOUR, 'fixture_pickaxe_t2');
        expect(RecipeResolver.contextTiersAround(STATION).pickaxe).toBe(2);
    });

    it('lets a Tier 2 tool satisfy a Tier 1 requirement', () => {
        place(STATION, 'fixture_tiered_bench');
        place(NEIGHBOUR, 'fixture_pickaxe_t2');
        expect(missingTags('tier_one_job')).toEqual([]);
    });

    it('does NOT let a Tier 1 tool satisfy a Tier 2 requirement', () => {
        place(STATION, 'fixture_tiered_bench');
        place(NEIGHBOUR, 'fixture_pickaxe_t1');
        expect(missingTags('tier_two_job')).toEqual(['pickaxe']);
    });

    it('satisfies a Tier 1 requirement with a Tier 1 tool', () => {
        place(STATION, 'fixture_tiered_bench');
        place(NEIGHBOUR, 'fixture_pickaxe_t1');
        expect(missingTags('tier_one_job')).toEqual([]);
    });

    it('reports the requirement unmet with no tool beside it at all', () => {
        place(STATION, 'fixture_tiered_bench');
        expect(missingTags('tier_one_job')).toEqual(['pickaxe']);
    });
});
