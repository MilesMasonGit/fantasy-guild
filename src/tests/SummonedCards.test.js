// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Summons from '../systems/board/Summons.js';
import * as Flags from '../systems/board/Flags.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { GameState } from '../state/GameState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { hasHeroSheet } from '../ui/hooks/useHeroSheetRequests.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * What the player sees of Summoned workers (brief 810 K5): a Circle's card names its Summoned
 * worker and charges, picking another summon there warns first and dismisses only on Change, and a
 * Summoned worker has no hero sheet.
 */

registerTokenTypes({
    k5v_slime: { id: 'k5v_slime', name: 'Summoned Card Slime', rarity: 'common', theme: 'fixture', sprite: 's_occult', summon: { skills: { mining: 30 } } },
    k5v_digger: { id: 'k5v_digger', name: 'Summoned Card Digger', rarity: 'common', theme: 'fixture', sprite: 's_occult', summon: { skills: { mining: 40 } } },
    k5v_circle: {
        id: 'k5v_circle', name: 'Card Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
        summonCircle: { charges: 3, perLevel: 0 },
        config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_k5v_circle', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
    }
});
registerRecipePools({
    summoning: [
        { id: 'recipe_k5v_slime', name: 'Summoned Card Slime', skill: 'summoning', levelRequirement: 1, requiresContext: [], inputs: [], outputs: [{ tokenId: 'k5v_slime', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 2000, xp: 0 },
        { id: 'recipe_k5v_digger', name: 'Summoned Card Digger', skill: 'summoning', levelRequirement: 1, requiresContext: [], inputs: [], outputs: [{ tokenId: 'k5v_digger', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 2000, xp: 0 }
    ]
}, { takeOver: false });

const h = React.createElement;
let circle;
let summon;

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    const hero = generateHero({ name: 'Ana' });
    hero.id = 'ana';
    GameState.state.heroes = [hero];
    Flags.init();
    Summons.init();
    circle = BoardState.createTokenInstance('k5v_circle', tokenStartingUses('k5v_circle'));
    Placement.placeTokenAt(circle, { x: 400, y: 300 });
    StationRecipe.setSelectedRecipe(circle, 'recipe_k5v_slime');
    summon = Summons.chargeFromCircle(circle, 'k5v_slime', 'ana');
});
afterEach(() => {
    cleanup();
    Summons.teardown();
    Flags.teardown();
});

/** The Circle's card, flipped to its recipe list. */
function openList() {
    const view = render(h(TokenCard, { typeId: 'k5v_circle', instanceId: circle.id }));
    fireEvent.click(view.container.querySelector('[data-card-change-recipe]'));
    return view;
}

describe('⭐ a Summoning Circle\'s card', () => {
    it('names its Summoned worker and the charges it has left', () => {
        const { container } = render(h(TokenCard, { typeId: 'k5v_circle', instanceId: circle.id }));
        expect(container.querySelector('[data-card-summon]').textContent).toBe('Summoned Card Slime: 3 charges left');
    });

    it('picking another summon warns first, and Keep leaves the Summoned worker and the pick as they were', () => {
        const { container } = openList();
        fireEvent.click(container.querySelector('[data-recipe-id="recipe_k5v_digger"]'));
        const warning = container.querySelector(`[data-summon-dismiss="${summon.id}"]`);
        expect(warning.textContent).toContain('Summoned Card Slime will be dismissed (3 charges left).');
        fireEvent.click(container.querySelector('[data-summon-dismiss-keep]'));
        expect(container.querySelector('[data-summon-dismiss]')).toBeNull();
        expect(Summons.summonOfCircle(circle.id)?.id).toBe(summon.id);
        expect(circle.selectedRecipeId).toBe('recipe_k5v_slime');
    });

    it('Change picks it and dismisses the Summoned worker; the same summon asks nothing', () => {
        const { container } = openList();
        fireEvent.click(container.querySelector('[data-recipe-id="recipe_k5v_slime"]'));
        expect(container.querySelector('[data-summon-dismiss]')).toBeNull();
        expect(Summons.summonOfCircle(circle.id)?.id).toBe(summon.id);

        const again = openList();
        fireEvent.click(again.container.querySelector('[data-recipe-id="recipe_k5v_digger"]'));
        act(() => { fireEvent.click(again.container.querySelector('[data-summon-dismiss-confirm]')); });
        expect(circle.selectedRecipeId).toBe('recipe_k5v_digger');
        expect(Summons.summonOfCircle(circle.id)).toBeNull();
        expect(GameState.state.heroes.map(x => x.id)).toEqual(['ana']);
    });
});

describe('⭐ no hero sheet', () => {
    it('a hero has one; a Summoned worker and a record that is gone have none', () => {
        expect(hasHeroSheet('ana')).toBe(true);
        expect(hasHeroSheet(summon.id)).toBe(false);
        expect(hasHeroSheet('nobody')).toBe(false);
    });
});
