import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { ALERT_HINT, ALERT_LABEL, SKIP_HINT } from '../ui/components/board/boardConstants.js';
import { blockedText } from '../ui/components/board/heroBubbles.js';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Stations start with no recipe** (owner feedback).
 */

registerTokenTypes({
    fixture_nr_bench: {
        id: 'fixture_nr_bench', name: 'Fixture Bench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'fixture_nr_skill', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fixture_nr_bench', keyword: KEYWORD.STATION, payload: { skill: 'fixture_nr_skill' } }]
    },
    fixture_nr_foundation: {
        id: 'fixture_nr_foundation', name: 'Fixture Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'wood', skill: 'fixture_nr_build' }
    }
});

registerRecipePools({
    fixture_nr_skill: [
        {
            id: 'fixture_nr_make', name: 'Make Coal', levelRequirement: 1,
            inputs: [], outputs: [{ itemId: 'item_coal', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 2000, xp: 1
        }
    ],
    fixture_nr_build: [
        {
            id: 'fixture_nr_build_bench', name: 'Build Bench', levelRequirement: 1,
            foundationKinds: ['wood'], inputs: [],
            outputs: [{ tokenId: 'fixture_nr_bench', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 1000, xp: 1
        }
    ]
});

const AT = { x: 560, y: 520 };

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
/** Coal made so far: in the Bank or lying on the mat as loot. */
const coalMade = () => InventoryManager.getItemCount('item_coal') + SpriteLayer.countOnBoard('item_coal');

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { fixture_nr_skill: 5, fixture_nr_build: 5 })];
});

describe('a new station waits for the player (TL-15)', () => {
    it('is placed with no recipe, and says choose_recipe', () => {
        const bench = put('fixture_nr_bench');
        expect(bench.selectedRecipeId).toBeUndefined();
        expect(WorkCheck.fixableReason(bench.id, bench).reason).toBe(ALERT.CHOOSE_RECIPE);
    });

    it('with nothing picked, a hero in range does not work it and nothing is made', () => {
        const bench = put('fixture_nr_bench');
        Flags.plant('h1', AT);
        run(10000);

        expect(BoardState.workTokenOf('h1')).toBeFalsy();
        expect(coalMade()).toBe(0);
        expect(Flags.skipsOf(bench.id).map(s => s.reason)).toContain(ALERT.CHOOSE_RECIPE);
        // A flag passed it over for a reason the player can fix, so it says so.
        expect(WorkCheck.FIXABLE.has(ALERT.CHOOSE_RECIPE)).toBe(true);
        expect(BoardState.getTokenById(bench.id).alert).toBe(ALERT.CHOOSE_RECIPE);
    });

    it('once the player picks, the hero starts, and the pick stays', () => {
        const bench = put('fixture_nr_bench');
        Flags.plant('h1', AT);
        run(3000);
        expect(coalMade()).toBe(0);

        expect(StationRecipe.setSelectedRecipe(bench, 'fixture_nr_make')).toBe(true);
        run(10000);

        expect(BoardState.workTokenOf('h1')).toBe(bench.id);
        expect(coalMade()).toBeGreaterThan(0);
        expect(bench.selectedRecipeId).toBe('fixture_nr_make');
        expect(bench.alert || null).not.toBe(ALERT.CHOOSE_RECIPE);
    });

    it('a station built on a Foundation arrives with no recipe too', () => {
        const f = put('fixture_nr_foundation');
        StationRecipe.setSelectedRecipe(f, 'fixture_nr_build_bench');
        Flags.plant('h1', AT);
        run(4000);

        const [bench] = onMat('fixture_nr_bench');
        expect(bench).toBeTruthy();
        expect(bench.selectedRecipeId).toBeUndefined();
        run(6000);
        expect(coalMade()).toBe(0);
        expect(WorkCheck.fixableReason(bench.id, bench).reason).toBe(ALERT.CHOOSE_RECIPE);
    });

    it('a Foundation still says choose_build, not choose_recipe', () => {
        const f = put('fixture_nr_foundation');
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.CHOOSE_BUILD);
    });
});

describe('the player can see it is waiting', () => {
    it('every surface has words for choose_recipe', () => {
        expect(ALERT_HINT[ALERT.CHOOSE_RECIPE]).toBe('Choose a recipe for this station');
        expect(ALERT_LABEL[ALERT.CHOOSE_RECIPE]).toBe('Choose Recipe');
        expect(SKIP_HINT[ALERT.CHOOSE_RECIPE]).toBeTruthy();
        expect(blockedText(ALERT.CHOOSE_RECIPE, { token: 'Workbench' })).toBe('Choose a recipe for Workbench.');
    });

    it('the inspection drawer says "Choose a recipe" until one is picked', () => {
        const bench = put('fixture_nr_bench');
        const src = {
            typeOf: getTokenType,
            tokenName: (id) => id,
            itemName: (id) => id,
            spawnerStatus: () => null,
            selectedRecipe: StationRecipe.selectedRecipe,
            poolFor: StationRecipe.poolFor,
            originOf: BoardState.originOf
        };
        expect(lifecycleLines(bench, src)).toContainEqual(
            expect.objectContaining({ label: 'Recipe', value: 'Choose a recipe' }));

        StationRecipe.setSelectedRecipe(bench, 'fixture_nr_make');
        expect(lifecycleLines(bench, src).find(l => l.label === 'Recipe')).toBeUndefined();
    });
});
