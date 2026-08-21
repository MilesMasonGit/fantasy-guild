import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getStatusStacks } from '../config/registries/statusRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * `Applies` — content putting a status on somebody.
 *
 * Seven statuses have existed and worked since the status engine was built, and
 * **only combat ever called them.** Nothing an author could write reached them
 * at all. These tests are about the wire that closes that, and about the one
 * genuinely awkward thing in the design:
 *
 * ⚠️ **The filter selects Tokens; the status lands on a person.** The owner
 * ruled that `Applies` uses the same filter as every other keyword, so a filter
 * naming Tokens has to resolve to *the heroes working those Tokens* — and the
 * generated sentence has to say so in those words, or the card lies. Both
 * halves are asserted here, because a sentence that is subtly untrue is exactly
 * the failure the whole redesign exists to remove.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const AMBIENT = {
    id: 'stm_cookout',
    keyword: KEYWORD.APPLIES,
    payload: { statusId: 'cookout', stacks: 1, chance: 100 },
    to: { mode: 'tag', value: 'Coast' },
    when: null,
    upkeep: null
};

registerTokenTypes({
    /** Sits beside Coasts and feeds whoever is working them. */
    fixture_cook_fire: {
        id: 'fixture_cook_fire', name: 'Fixture Cook Fire', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_flask',
        requiresHero: false,
        statements: [AMBIENT]
    },
    /** The same rule, but on a trigger rather than ambient. */
    fixture_cook_bell: {
        id: 'fixture_cook_bell', name: 'Fixture Cook Bell', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_flask',
        requiresHero: false,
        statements: [{
            id: 'stm_bell',
            keyword: KEYWORD.APPLIES,
            payload: { statusId: 'well_fed', stacks: 2, chance: 100 },
            to: { mode: 'tag', value: 'Coast' },
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
            upkeep: null
        }]
    },
    /** A workable Coast, the thing the filters name. */
    fixture_shrimp_bed: {
        id: 'fixture_shrimp_bed', name: 'Fixture Shrimp Bed', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        tags: ['Coast'],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'item_fish', quantity: 1, chance: 100 }]
        }
    },
    /** Untagged, so the filter must not reach it. */
    fixture_dry_bed: {
        id: 'fixture_dry_bed', name: 'Fixture Dry Bed', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'item_fish', quantity: 1, chance: 100 }]
        }
    }
});

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 }, statuses: [] };
}

function place(tile, typeId, heroId = null) {
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const statusesOf = (heroId) => GameState.state.heroes.find(h => h.id === heroId)?.statuses || [];

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('A Token filter resolves to the heroes working those Tokens', () => {
    it('lands the status on the hero when the Token they are working finishes a cycle', () => {
        place(8, 'fixture_cook_fire');
        place(9, 'fixture_shrimp_bed', 'hero_1');

        run(13000);

        expect(getStatusStacks(statusesOf('hero_1'), 'cookout')).toBeGreaterThan(0);
    });

    it('reaches nobody at all when the Token is unstaffed', () => {
        // Not a failure — the same as a buff aimed at an empty tile. It is
        // precisely why the sentence says "heroes on" rather than "Tokens".
        place(8, 'fixture_cook_fire');
        place(9, 'fixture_shrimp_bed');          // nobody working it

        run(13000);

        expect(statusesOf('hero_1')).toEqual([]);
        expect(statusesOf('hero_2')).toEqual([]);
    });

    it('respects the filter — an untagged neighbour is not reached', () => {
        place(8, 'fixture_cook_fire');
        place(9, 'fixture_dry_bed', 'hero_1');   // no Coast tag

        run(13000);

        expect(statusesOf('hero_1')).toEqual([]);
    });

    it('reaches every matching neighbour independently', () => {
        place(9, 'fixture_cook_fire');
        place(8, 'fixture_shrimp_bed', 'hero_1');
        place(10, 'fixture_shrimp_bed', 'hero_2');

        run(13000);

        expect(getStatusStacks(statusesOf('hero_1'), 'cookout')).toBeGreaterThan(0);
        expect(getStatusStacks(statusesOf('hero_2'), 'cookout')).toBeGreaterThan(0);
    });

    it('needs a completed cycle — a Token nobody is working applies nothing', () => {
        // The moment is the cycle completing, not the passage of time. (The
        // *failed*-cycle case rides the same `!failed` guard as BONUS_DROP
        // directly above it in `BoardRunner.completeCycle`.)
        place(8, 'fixture_cook_fire');
        const token = place(9, 'fixture_shrimp_bed', 'hero_1');
        Placement.recallHero(9);

        run(13000);

        expect(token).toBeTruthy();
        expect(statusesOf('hero_1')).toEqual([]);
    });
});

describe('The same keyword on a trigger', () => {
    beforeEach(() => TriggerSystem.init());

    it('applies when its trigger fires rather than on its own clock', () => {
        // The Bell has no work cycle of its own. It reacts to the Shrimp Bed
        // beside it completing, and puts the status on the hero working the
        // Coast the filter names — which here is that same Bed.
        place(8, 'fixture_cook_bell');
        place(9, 'fixture_shrimp_bed', 'hero_1');

        run(13000);

        expect(getStatusStacks(statusesOf('hero_1'), 'well_fed')).toBe(2);
    });
});

describe('The chance roll', () => {
    it('never applies at 0% and always applies at 100%', async () => {
        const StatusApplication = await import('../systems/board/StatusApplication.js');
        place(9, 'fixture_shrimp_bed', 'hero_1');

        expect(StatusApplication.applyAt(9, { statusId: 'cookout', chance: 100 })).toBe(true);
        expect(StatusApplication.applyAt(9, { statusId: 'cookout', chance: 0 })).toBe(false);
    });

    it('refuses a status the engine has never heard of', async () => {
        const StatusApplication = await import('../systems/board/StatusApplication.js');
        place(9, 'fixture_shrimp_bed', 'hero_1');

        expect(StatusApplication.applyAt(9, { statusId: 'blessed_by_the_moon' })).toBe(false);
        expect(statusesOf('hero_1')).toEqual([]);
    });
});

describe('The sentence is literally true', () => {
    it('names the heroes, not the Tokens, because that is where the status lands', () => {
        expect(renderStatement(AMBIENT))
            .toBe('Applies Cookout to heroes on adjacent Coast Tokens when they finish work.');
    });

    it('counts stacks in the sentence', () => {
        expect(renderStatement({
            keyword: KEYWORD.APPLIES,
            payload: { statusId: 'well_fed', stacks: 2, chance: 100 },
            to: { mode: 'all', value: '' }
        })).toBe('Applies 2 stacks of Well Fed to heroes on adjacent Tokens when they finish work.');
    });

    it('drops "when they finish work" once it has a trigger of its own', () => {
        expect(renderStatement({
            keyword: KEYWORD.APPLIES,
            payload: { statusId: 'poison', stacks: 1, chance: 50 },
            to: { mode: 'tag', value: 'Coast' },
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent' }
        })).toBe(
            'When a neighbour completes a cycle, applies Poison to heroes on adjacent Coast Tokens, 50% of the time.'
        );
    });

    it('shows an unfinished rule as unfinished', () => {
        expect(renderStatement({ keyword: KEYWORD.APPLIES, payload: {}, to: { mode: 'all' } }))
            .toBe('Applies … to heroes on adjacent Tokens.');
    });
});
