import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { BAND, bandForLevel, bandStationRecipes, guildLevelFor, workerLevelFor } from '../systems/board/RecipeBands.js';
import { StationRecipeModal } from '../ui/components/board/StationRecipeModal.jsx';
import { StationGearBadge } from '../ui/components/board/BoardTile.jsx';

/**
 * Recipe modal banding (Recipe & Charges rework, P3).
 *
 * The shipped corpus is three recipes at levels 1, 1 and 5, so the live game
 * cannot show all five of concept §2.2's bands at once. These fixtures exist to
 * exercise the general case the modal is built for.
 *
 * **Bands key on skill level only (R-12).** Nothing here asserts anything about
 * inputs or adjacent context Tokens, because the modal computes neither.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** A ladder of three: one under the worker, one over them, one over the guild. */
registerRecipePools({
    band_skill: [
        { id: 'band_high', name: 'Banquet', levelRequirement: 30, inputs: [], requiresContext: [], outputs: [{ itemId: 'item_carrot', minQty: 1, maxQty: 1, chance: 100 }], durationMs: 10000, xp: 1 },
        { id: 'band_low', name: 'Broth', levelRequirement: 2, inputs: [{ itemId: 'item_carrot', quantity: 2 }], requiresContext: [], outputs: [{ itemId: 'item_carrot', minQty: 1, maxQty: 1, chance: 100 }], durationMs: 10000, xp: 1 },
        { id: 'band_mid', name: 'Roast', levelRequirement: 10, inputs: [], requiresContext: [{ tag: 'ctx_pie_tin', minTier: 2 }], outputs: [{ itemId: 'item_carrot', minQty: 1, maxQty: 2, chance: 50 }], durationMs: 10000, xp: 1 }
    ]
});

const hero = (id, level) => ({
    id, name: id, status: 'idle', level: 1,
    skills: { band_skill: { level, xp: 0 } },
    hp: { current: 100, max: 100 }
});

/**
 * A station def written here rather than taken from the fixture Tokens: the
 * shared fixtures pool `cooking`, and this suite needs a pool of its own so a
 * recipe added to the fixture Kitchen cannot renumber these bands.
 */
const KITCHEN = () => ({
    id: 'band_station', name: 'Band Station',
    statements: [{ id: 'stm_band', keyword: KEYWORD.STATION, payload: { skill: 'band_skill' } }]
});

beforeEach(() => {
    GameState.initNew();
});

describe('bandForLevel', () => {
    it('splits at the worker line, then at the guild line', () => {
        expect(bandForLevel(5, 5, 20)).toBe(BAND.WORKER);
        expect(bandForLevel(6, 5, 20)).toBe(BAND.GUILD);
        expect(bandForLevel(20, 5, 20)).toBe(BAND.GUILD);
        expect(bandForLevel(21, 5, 20)).toBe(BAND.LOCKED);
    });
});

describe('the two thresholds', () => {
    it('a station with no worker has a worker level of 0', () => {
        expect(workerLevelFor(null, 'band_skill')).toBe(0);
    });

    it('a worker who does not hold the skill counts as 0, not as absent', () => {
        GameState.state.heroes = [{ id: 'nocook', name: 'nocook', skills: {} }];
        expect(workerLevelFor('nocook', 'band_skill')).toBe(0);
    });

    it('the guild line is the best level anyone in the roster holds', () => {
        GameState.state.heroes = [hero('a', 3), hero('b', 12), hero('c', 7)];
        expect(guildLevelFor(GameState.state.heroes, 'band_skill')).toBe(12);
    });

    it('an empty roster has a guild line of 0', () => {
        expect(guildLevelFor([], 'band_skill')).toBe(0);
    });
});

describe('bandStationRecipes', () => {
    it('orders by level and files each recipe into its band', () => {
        GameState.state.heroes = [hero('cook', 2), hero('chef', 12)];
        const { rows, workerLevel, guildLevel } = bandStationRecipes(KITCHEN(), 'cook', GameState.state.heroes);

        expect(workerLevel).toBe(2);
        expect(guildLevel).toBe(12);
        expect(rows.map(r => r.recipe.id)).toEqual(['band_low', 'band_mid', 'band_high']);
        expect(rows.map(r => r.band)).toEqual([BAND.WORKER, BAND.GUILD, BAND.LOCKED]);
    });

    it('locks only the band above the whole roster — the guild band stays selectable', () => {
        GameState.state.heroes = [hero('cook', 2), hero('chef', 12)];
        const { rows } = bandStationRecipes(KITCHEN(), 'cook', GameState.state.heroes);
        expect(rows.map(r => r.selectable)).toEqual([true, true, false]);
    });

    it('with nobody assigned, everything the guild can reach is still selectable', () => {
        GameState.state.heroes = [hero('chef', 12)];
        const { workerLevel, rows } = bandStationRecipes(KITCHEN(), null, GameState.state.heroes);

        expect(workerLevel).toBe(0);
        expect(rows.map(r => r.band)).toEqual([BAND.GUILD, BAND.GUILD, BAND.LOCKED]);
        expect(rows.filter(r => r.selectable).map(r => r.recipe.id)).toEqual(['band_low', 'band_mid']);
    });

    it('a worker above the rest of the roster raises the guild line to their own', () => {
        GameState.state.heroes = [hero('cook', 40), hero('chef', 3)];
        const { guildLevel, rows } = bandStationRecipes(KITCHEN(), 'cook', GameState.state.heroes);

        expect(guildLevel).toBe(40);
        expect(rows.every(r => r.band === BAND.WORKER)).toBe(true);
    });

    it('a Token with no Station statement has no rows at all', () => {
        const { skill, rows } = bandStationRecipes({ id: 'not_a_station', statements: [] }, null, []);
        expect(skill).toBeNull();
        expect(rows).toEqual([]);
    });
});

describe('StationRecipeModal', () => {
    const open = (heroId, selectedRecipeId = null, onSelect = () => { }) => {
        GameState.state.heroes = [hero('cook', 2), hero('chef', 12)];
        const banding = bandStationRecipes(KITCHEN(), heroId, GameState.state.heroes);
        return render(React.createElement(StationRecipeModal, {
            isOpen: true, onClose: () => { }, tokenName: 'Fixture Kitchen',
            banding, selectedRecipeId, onSelect
        }));
    };

    it('renders every band and both threshold markers', () => {
        open('cook');
        const rows = document.querySelectorAll('[data-recipe-id]');
        expect([...rows].map(r => r.dataset.recipeBand)).toEqual(['worker', 'guild', 'locked']);
        expect(document.querySelector('[data-threshold="worker"]').textContent).toContain('level 2');
        expect(document.querySelector('[data-threshold="guild"]').textContent).toContain('level 12');
    });

    it('disables the locked band and nothing else', () => {
        open('cook');
        const disabled = [...document.querySelectorAll('[data-recipe-id]')].filter(b => b.disabled);
        expect(disabled.map(b => b.dataset.recipeId)).toEqual(['band_high']);
    });

    it('selects a recipe by id when a selectable row is clicked', () => {
        const onSelect = vi.fn();
        open('cook', 'band_low', onSelect);
        fireEvent.click(document.querySelector('[data-recipe-id="band_mid"]'));
        expect(onSelect).toHaveBeenCalledWith('band_mid');
    });

    it('a locked row does not select', () => {
        const onSelect = vi.fn();
        open('cook', 'band_low', onSelect);
        fireEvent.click(document.querySelector('[data-recipe-id="band_high"]'));
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('says so when the station\'s skill has no recipes', () => {
        render(React.createElement(StationRecipeModal, {
            isOpen: true, onClose: () => { }, tokenName: 'Kiln',
            banding: { skill: 'crafting', workerLevel: 0, guildLevel: 0, rows: [] },
            selectedRecipeId: null, onSelect: () => { }
        }));
        expect(document.querySelector('[data-recipe-empty]').textContent).toContain('no');
        expect(document.querySelectorAll('[data-recipe-id]').length).toBe(0);
    });
});

describe('StationGearBadge', () => {
    const recipe = {
        id: 'band_mid', name: 'Roast',
        inputs: [{ itemId: 'item_carrot', quantity: 2 }],
        requiresContext: [{ tag: 'ctx_pie_tin', minTier: 2 }],
        outputs: [{ itemId: 'item_carrot', minQty: 1, maxQty: 1, chance: 100 }]
    };

    it('previews the selected recipe on hover (concept §2.1)', () => {
        const { container } = render(React.createElement(StationGearBadge, {
            isHovered: true, isDragging: false, recipe, onClick: () => { }
        }));
        expect(container.textContent).toContain('Roast');
        expect(container.textContent).toContain('Makes 1× Carrot');
        expect(container.textContent).toContain('Needs 2× Carrot');
        expect(container.textContent).toContain('ctx_pie_tin (tier 2)');
    });

    it('opens the picker when clicked', () => {
        const onClick = vi.fn();
        render(React.createElement(StationGearBadge, {
            isHovered: true, isDragging: false, recipe, onClick
        }));
        fireEvent.click(screen.getByLabelText('Choose recipe'));
        expect(onClick).toHaveBeenCalled();
    });

    it('renders nothing while the Token is being dragged', () => {
        const { container } = render(React.createElement(StationGearBadge, {
            isHovered: true, isDragging: true, recipe, onClick: () => { }
        }));
        expect(container.firstChild).toBeNull();
    });

    it('reads as unselected when the station has no recipe', () => {
        const { container } = render(React.createElement(StationGearBadge, {
            isHovered: true, isDragging: false, recipe: null, onClick: () => { }
        }));
        expect(container.textContent).toContain('No recipe selected');
    });
});
