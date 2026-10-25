// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import {
    recipeListFor, permittedHeroes, permitsSkill, heroSkillLevel, matchesSearch, ENTRY, SPOILER_COUNT
} from '../systems/board/RecipeList.js';
import { recipeRowOf } from '../ui/components/board/recipeRows.js';
import { RecipeList } from '../ui/components/board/RecipeList.jsx';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

/**
 * The recipe list a station's card flips to: level-sorted rows, hero-face dividers for permitted
 * heroes, the next two locked recipes as "???", and a search that never finds a silhouette.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const out = (itemId, extra = {}) => ({ itemId, minQty: 1, maxQty: 1, chance: 100, ...extra });

/**
 * A ladder of six, authored out of level order. Two share level 10 so ties keep content order.
 * Names are the Carrot / Blueberry / Fish fixtures, so a search has something to find.
 */
registerRecipePools({
    list_skill: [
        { id: 'r_feast', name: 'Feast', levelRequirement: 40, inputs: [{ itemId: 'fixture_fish', quantity: 3 }], outputs: [out('fixture_leek_potato_stew')], durationMs: 9000, xp: 50 },
        { id: 'r_broth', name: 'Broth', levelRequirement: 2, inputs: [{ itemId: 'fixture_carrot', quantity: 2 }], outputs: [out('fixture_leek_potato_stew')], durationMs: 6000, xp: 5 },
        { id: 'r_pie', name: 'Pie', levelRequirement: 10, inputs: [{ itemId: 'item_blueberry', quantity: 4 }], outputs: [out('item_blueberry_pie')], durationMs: 6000, xp: 12 },
        { id: 'r_roast', name: 'Roast', levelRequirement: 10, inputs: [], requiresContext: [{ tag: 'ctx_pie_tin', minTier: 1 }], outputs: [out('fixture_carrot', { chance: 25 }), out('fixture_fish', { minQty: 1, maxQty: 2 })], durationMs: 6000, xp: 12 },
        { id: 'r_banquet', name: 'Banquet', levelRequirement: 30, inputs: [], outputs: [out('item_blueberry_pie')], durationMs: 9000, xp: 40 },
        { id: 'r_grand', name: 'Grand', levelRequirement: 50, inputs: [], outputs: [out('fixture_carrot')], durationMs: 9000, xp: 60 }
    ]
});

const STATION = () => ({
    id: 'list_station', name: 'List Station',
    statements: [{ id: 'stm_list', keyword: KEYWORD.STATION, payload: { skill: 'list_skill' } }]
});

const hero = (id, level, allowed = true) => ({
    id, name: id.toUpperCase(), status: 'idle', level: 1,
    skills: { list_skill: { level, xp: 0 } },
    flagRules: allowed ? {} : { list_skill: { allowed: false, priority: 3 } },
    hp: { current: 100, max: 100 }
});

const kinds = (entries) => entries.map(e => (
    e.kind === ENTRY.RECIPE ? e.recipe.id : e.kind === ENTRY.LOCKED ? `???${e.level}` : `[${e.heroes.map(h => h.heroId).join('+')}]`
));

beforeEach(() => {
    GameState.initNew();
});

describe('who gets a face', () => {
    it('a hero whose Work Permissions disallow the skill gets none; one without the skill gets none', () => {
        const heroes = [hero('a', 5), hero('b', 12, false), { id: 'c', name: 'C', skills: {} }];
        expect(permitsSkill(heroes[0], 'list_skill')).toBe(true);
        expect(permitsSkill(heroes[1], 'list_skill')).toBe(false);
        expect(permitsSkill(heroes[2], 'list_skill')).toBe(false);
        expect(permittedHeroes(heroes, 'list_skill', 'a')).toEqual([{ heroId: 'a', level: 5, isWorker: true }]);
    });

    it('reads a bare-number skill and a missing one', () => {
        expect(heroSkillLevel({ skills: { list_skill: 7 } }, 'list_skill')).toBe(7);
        expect(heroSkillLevel({ skills: {} }, 'list_skill')).toBe(0);
    });
});

describe('recipeListFor', () => {
    it('sorts by level, ties in content order, with a divider after the last row each hero can run', () => {
        const heroes = [hero('cook', 2), hero('chef', 12)];
        const { entries, guildLevel } = recipeListFor(STATION(), { workerId: 'cook', heroes });
        expect(guildLevel).toBe(12);
        expect(kinds(entries)).toEqual(['r_broth', '[cook]', 'r_pie', 'r_roast', '[chef]', '???30', '???40']);
        expect(entries[1].heroes[0].isWorker).toBe(true);
        expect(entries[4].heroes[0].isWorker).toBe(false);
    });

    it('a hero at exactly a recipe’s level sits below it: they can run it', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('chef', 10)] });
        expect(kinds(entries)).toEqual(['r_broth', 'r_pie', 'r_roast', '[chef]', '???30', '???40']);
    });

    it('heroes at the same level share one divider', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('a', 12), hero('b', 12)] });
        expect(kinds(entries)).toContain('[a+b]');
    });

    it('dividers with no row between them are one line, faces lowest level first', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('top', 60), hero('mid', 45), hero('low', 2)] });
        expect(kinds(entries)).toEqual(['r_broth', '[low]', 'r_pie', 'r_roast', 'r_banquet', 'r_feast', '[mid]', 'r_grand', '[top]']);
        const searched = recipeListFor(STATION(), { heroes: [hero('top', 60), hero('mid', 45), hero('low', 2)], query: 'carrot' });
        expect(kinds(searched.entries)).toEqual(['r_broth', '[low]', 'r_roast', '[mid]', 'r_grand', '[top]']);
        const stacked = recipeListFor(STATION(), { heroes: [hero('a', 3), hero('b', 5)], query: 'blueberry' });
        expect(kinds(stacked.entries)).toEqual(['[a+b]']);
    });

    it('shows only the next two locked recipes, and none past the whole list', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('a', 2)] });
        const locked = entries.filter(e => e.kind === ENTRY.LOCKED).map(e => e.level);
        expect(locked).toEqual([10, 10]);
        expect(locked).toHaveLength(SPOILER_COUNT);
        expect(kinds(recipeListFor(STATION(), { heroes: [hero('a', 99)] }).entries).filter(k => k.startsWith('???'))).toEqual([]);
    });

    it('a recipe only a disallowed hero reaches is still a row, with no face above it', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('cook', 2), hero('master', 45, false)] });
        expect(kinds(entries)).toEqual(['r_broth', '[cook]', 'r_pie', 'r_roast', 'r_banquet', 'r_feast', '???50']);
    });

    it('a permitted hero who can run none of the rows gets no face', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('novice', 1), hero('chef', 12)] });
        expect(kinds(entries).join(' ')).not.toContain('novice');
    });

    it('with nobody able to run anything, the list is the two silhouettes', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [] });
        expect(kinds(entries)).toEqual(['???2', '???10']);
    });

    it('a Token with no Station statement has no entries at all', () => {
        const { skill, entries } = recipeListFor({ id: 'not_a_station', statements: [] }, { heroes: [] });
        expect(skill).toBeNull();
        expect(entries).toEqual([]);
    });
});

describe('search', () => {
    it('matches input and output names, case ignored', () => {
        const pool = recipeListFor(STATION(), { heroes: [hero('a', 99)] }).entries.map(e => e.recipe);
        const byId = Object.fromEntries(pool.filter(Boolean).map(r => [r.id, r]));
        expect(matchesSearch(byId.r_broth, 'carr')).toBe(true);     // an input
        expect(matchesSearch(byId.r_pie, 'PIE')).toBe(true);        // an output
        expect(matchesSearch(byId.r_pie, 'carrot')).toBe(false);
        expect(matchesSearch(byId.r_roast, 'fish')).toBe(true);     // a byproduct
    });

    it('hides rows that do not match and keeps the dividers', () => {
        const heroes = [hero('cook', 2), hero('chef', 12)];
        const { entries } = recipeListFor(STATION(), { workerId: 'cook', heroes, query: 'blueberry' });
        expect(kinds(entries)).toEqual(['[cook]', 'r_pie', '[chef]']);
    });

    it('never matches a silhouette, even one whose output it names', () => {
        const { entries } = recipeListFor(STATION(), { heroes: [hero('cook', 2)], query: 'stew' });
        expect(kinds(entries)).toEqual(['r_broth', '[cook]']);
        expect(entries.some(e => e.kind === ENTRY.LOCKED)).toBe(false);
    });
});

describe('a row', () => {
    const src = (have = {}, unmet = []) => ({
        allTypes: () => ({}),
        itemName: (id) => id,
        tokenName: (id) => id,
        available: (id) => have[id] || 0,
        unmetContext: () => unmet
    });
    const pool = () => Object.fromEntries(recipeListFor(STATION(), { heroes: [hero('a', 99)] }).entries.filter(e => e.recipe).map(e => [e.recipe.id, e.recipe]));

    it('inputs read have/need and are short when have < need', () => {
        const row = recipeRowOf(pool().r_broth, 2, null, src({ fixture_carrot: 1 }));
        expect(row.inputs).toEqual([{ itemId: 'fixture_carrot', name: 'fixture_carrot', need: 2, have: 1, short: true }]);
        expect(recipeRowOf(pool().r_broth, 2, null, src({ fixture_carrot: 5 })).inputs[0].short).toBe(false);
    });

    it('the main output is the first certain one; the rest are byproducts with their chance', () => {
        const row = recipeRowOf(pool().r_roast, 10, null, src());
        expect(row.main).toMatchObject({ itemId: 'fixture_fish', min: 1, max: 2, chance: null });
        expect(row.byproducts).toEqual([expect.objectContaining({ itemId: 'fixture_carrot', chance: 25 })]);
        expect(row.xp).toBe(12);
        expect(row.durationMs).toBe(6000);
    });

    it('a requirement is unmet only when the station’s neighbours lack it, and unjudged with no instance', () => {
        expect(recipeRowOf(pool().r_roast, 10, 'inst', src({}, [{ tag: 'ctx_pie_tin' }])).requirements[0].met).toBe(false);
        expect(recipeRowOf(pool().r_roast, 10, 'inst', src({}, [])).requirements[0].met).toBe(true);
        expect(recipeRowOf(pool().r_roast, 10, null, src()).requirements[0].met).toBeNull();
    });
});

describe('RecipeList', () => {
    const open = (props = {}) => {
        GameState.state.heroes = [hero('cook', 2), hero('chef', 12)];
        return render(React.createElement(RecipeList, {
            def: STATION(), heroes: GameState.state.heroes, workerId: 'cook', onChoose: () => {}, ...props
        }));
    };
    const rowIds = () => [...document.querySelectorAll('[data-recipe-id]')].map(r => r.dataset.recipeId);

    it('draws rows, dividers with faces (the worker ringed) and silhouettes, with no bands or banners', () => {
        open();
        expect(rowIds()).toEqual(['r_broth', 'r_pie', 'r_roast']);
        expect([...document.querySelectorAll('[data-recipe-divider]')].map(d => d.dataset.recipeDivider)).toEqual(['2', '12']);
        expect(document.querySelector('[data-recipe-face="cook"]').dataset.worker).toBe('true');
        expect(document.querySelector('[data-recipe-face="chef"]').dataset.worker).toBeUndefined();
        expect([...document.querySelectorAll('[data-recipe-locked]')].map(d => d.textContent)).toEqual(['30???', '40???']);
        expect(document.querySelector('[data-threshold]')).toBeNull();
        expect(document.body.textContent).not.toContain('more skilled');
    });

    it('names a recipe once, by its main output', () => {
        open();
        const row = document.querySelector('[data-recipe-id="r_pie"]');
        expect(row.textContent).toContain('Blueberry Pie');
        expect(row.textContent).not.toMatch(/\bPie\b.*\bPie\b.*\bPie\b/);
        expect(row.querySelector('[data-recipe-input="item_blueberry"]').dataset.short).toBe('true');
        expect(row.querySelector('[data-recipe-xp]').textContent).toBe('+12 XP');
        expect(row.querySelector('[data-recipe-time]').textContent).toBe('6s');
    });

    it('marks the current recipe and chooses another with one click', () => {
        const onChoose = vi.fn();
        open({ selectedRecipeId: 'r_pie', onChoose });
        expect(document.querySelector('[data-recipe-selected="true"]').dataset.recipeId).toBe('r_pie');
        fireEvent.click(document.querySelector('[data-recipe-id="r_roast"]'));
        expect(onChoose).toHaveBeenCalledWith('r_roast');
    });

    it('silhouettes are not buttons', () => {
        open();
        for (const el of document.querySelectorAll('[data-recipe-locked]')) expect(el.tagName).not.toBe('BUTTON');
    });

    it('the search box filters rows and drops the silhouettes', () => {
        open();
        fireEvent.change(document.querySelector('[data-recipe-search]'), { target: { value: 'carrot' } });
        expect(rowIds()).toEqual(['r_broth', 'r_roast']);
        expect(document.querySelectorAll('[data-recipe-locked]')).toHaveLength(0);
        expect(document.querySelectorAll('[data-recipe-divider]')).toHaveLength(2);
        fireEvent.change(document.querySelector('[data-recipe-search]'), { target: { value: 'zzz' } });
        expect(document.querySelector('[data-recipe-no-match]')).not.toBeNull();
    });

    it('Escape and Back go back', () => {
        const onBack = vi.fn();
        open({ onBack });
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.click(document.querySelector('[data-recipe-back]'));
        expect(onBack).toHaveBeenCalledTimes(2);
    });

    it('says so when the skill has no recipes', () => {
        render(React.createElement(RecipeList, {
            def: { id: 'k', statements: [{ id: 's', keyword: KEYWORD.STATION, payload: { skill: 'crafting_none' } }] },
            heroes: [], onChoose: () => {}
        }));
        expect(document.querySelector('[data-recipe-empty]').textContent).toContain('No');
        expect(document.querySelectorAll('[data-recipe-id]').length).toBe(0);
    });
});

describe('StationGearBadge', () => {
    const recipe = {
        id: 'r_mid', name: 'Roast',
        inputs: [{ itemId: 'fixture_carrot', quantity: 2 }],
        requiresContext: [{ tag: 'ctx_pie_tin', minTier: 2 }],
        outputs: [{ itemId: 'fixture_carrot', minQty: 1, maxQty: 1, chance: 100 }]
    };

    // The preview is the shared tooltip, opened by resting on the gear and drawn outside the Token.
    const hoverTip = (container) => {
        fireEvent.pointerEnter(container.querySelector('[data-station-gear]'), { clientX: 10, clientY: 10 });
        const tips = document.body.querySelectorAll('[data-tooltip]');
        return tips[tips.length - 1]?.textContent ?? '';
    };

    it('previews the selected recipe on hover (concept §2.1)', () => {
        const { container } = render(React.createElement(StationGearBadge, {
            isHovered: true, isDragging: false, recipe, onClick: () => { }
        }));
        const tip = hoverTip(container);
        expect(tip).toContain('Roast');
        expect(tip).toContain('Makes 1× Carrot');
        expect(tip).toContain('Needs 2× Carrot');
        // Nothing in the fixtures offers a pie tin above the bottom rung, so there is no name to give.
        expect(tip).toContain('Beside a stronger ctx pie tin');
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
        expect(hoverTip(container)).toContain('No recipe selected');
    });
});
