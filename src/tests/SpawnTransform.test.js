import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import {
    PLACEMENT, PLACEMENTS, getPlacement, placementOf, resolvePlacement
} from '../config/registries/placementRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **`Spawns` and `Transforms`** (Effects Grammar v2, V9 — G-15).
 *
 * ⭐ The placement vocabulary is the owner's own answer, and it is better than
 * any of the options offered: *"bearer's tile, nearest tile, and random tile"* —
 * a **choice** rather than a hidden fallback. Every option I proposed buried
 * "nearest" as a rule the author could not see or control.
 */

const A = 15;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
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

/** A producer that spawns or transforms when it finishes a cycle. */
function actingProducer(id, keyword, payload) {
    registerEffects({
        [`effect_${id}`]: {
            id: `effect_${id}`, name: id,
            statements: [{ ...makeStatement(keyword), id: `stm_${id}`, payload }]
        }
    });
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: null, sprite: 'skill_nature',
            config: {
                skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            effects: [{ effectId: `effect_${id}` }]
        }
    });
    return id;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
});

describe('⭐ Transforms — one Token becomes another', () => {
    it('replaces itself where it stands', () => {
        actingProducer('fixture_sapling', KEYWORD.TRANSFORMS, { typeId: 'fixture_passive' });
        place(A, 'fixture_sapling', 'hero_1');

        run(13000);

        expect(BoardState.getToken(A).typeId).toBe('fixture_passive');
    });

    it('⚠️ arrives FRESH, not carrying the old Token’s wear', () => {
        // Charges and cooldowns belong to what it WAS. Carrying them across
        // would give the new Token a worn-down history it never had, and the two
        // may not even hold the same number of charges.
        actingProducer('fixture_worn', KEYWORD.TRANSFORMS, { typeId: 'fixture_enemy' });
        place(A, 'fixture_worn', 'hero_1');

        run(13000);

        expect(BoardState.getToken(A).usesRemaining)
            .toBe(tokenStartingUses('fixture_enemy'));
    });

    it('⚠️ leaves the hero standing there', () => {
        // Somebody working a Sapling is still standing there when it becomes an
        // Oak; moving them would be a displacement nobody authored.
        actingProducer('fixture_shifting', KEYWORD.TRANSFORMS, { typeId: 'fixture_passive' });
        place(A, 'fixture_shifting', 'hero_1');

        run(13000);

        expect(BoardState.heroOnTile(A)).toBe('hero_1');
    });

    it('refuses a Token that does not exist', () => {
        expect(EffectActions.transform(
            { payload: { typeId: 'no_such_token' }, target: { role: ROLE.SELF } },
            { self: A }
        )).toBe(false);
    });
});

describe('⭐ Spawns — putting a Token on the board', () => {
    it('lands on the bearer’s own tile, replacing it', () => {
        actingProducer('fixture_dies_to_stump', KEYWORD.SPAWNS, {
            typeId: 'fixture_passive', placement: PLACEMENT.HERE
        });
        place(A, 'fixture_dies_to_stump', 'hero_1');

        run(13000);

        expect(BoardState.getToken(A).typeId).toBe('fixture_passive');
    });

    it('lands on the nearest free tile when told to', () => {
        actingProducer('fixture_seeder', KEYWORD.SPAWNS, {
            typeId: 'fixture_passive', placement: PLACEMENT.NEAREST_FREE
        });
        place(A, 'fixture_seeder', 'hero_1');

        run(13000);

        // The bearer is untouched, and something new is adjacent to it.
        expect(BoardState.getToken(A).typeId).toBe('fixture_seeder');
        const spawned = [...BoardState.occupiedTiles()]
            .filter(([, inst]) => inst.typeId === 'fixture_passive');
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('⚠️ never lands on an occupied tile', () => {
        // Shoving a Token onto an occupied tile would silently destroy whatever
        // was there. `here` is the one placement where replacing IS the intent.
        const board = {
            allTiles: [0, 1, 2],
            isFree: (t) => t === 2,
            distance: (a, b) => Math.abs(a - b)
        };
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, 0, board)).toBe(2);
    });

    it('⚠️ does nothing at all when the board is full', () => {
        // A full board is an ordinary state, not a failure.
        const full = { allTiles: [0, 1], isFree: () => false, distance: () => 0 };
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, 0, full)).toBeNull();
        expect(resolvePlacement(PLACEMENT.RANDOM_FREE, 0, full)).toBeNull();
    });

    it('breaks a distance tie toward the lower tile index', () => {
        // Deterministic, the same tie-break `Managers` and `Converts` use.
        const board = {
            allTiles: [3, 7],
            isFree: () => true,
            distance: () => 1        // both equally near
        };
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, 5, board)).toBe(3);
    });

    it('picks at random when told to, from the free tiles only', () => {
        const board = {
            allTiles: [0, 1, 2, 3],
            isFree: (t) => t > 1,
            distance: () => 0
        };
        expect([2, 3]).toContain(resolvePlacement(PLACEMENT.RANDOM_FREE, 0, board, () => 0.9));
    });

    it('refuses a Token that does not exist', () => {
        expect(EffectActions.spawn(
            { payload: { typeId: 'no_such_token' } }, { self: A }
        )).toBeNull();
    });
});

describe('the placement vocabulary is declared, not hidden', () => {
    it('offers exactly the three the owner asked for', () => {
        expect(PLACEMENTS.map(p => p.id))
            .toEqual([PLACEMENT.HERE, PLACEMENT.NEAREST_FREE, PLACEMENT.RANDOM_FREE]);
        for (const p of PLACEMENTS) {
            expect(p.label, p.id).toBeTruthy();
            expect(p.hint, p.id).toBeTruthy();
            expect(getPlacement(p.id)).toBe(p);
        }
    });

    it('defaults to the bearer’s own tile', () => {
        expect(placementOf({})).toBe(PLACEMENT.HERE);
        expect(placementOf({ placement: 'nonsense' })).toBe(PLACEMENT.HERE);
    });
});

describe('the sentence says where it lands', () => {
    const names = { token: (id) => ({ t_stump: 'Stump', t_oak: 'Oak' })[id] || id };

    it('names the destination, so it is never a hidden rule', () => {
        expect(renderStatement(
            { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 't_stump', placement: 'here' } }, names
        )).toContain('spawns Stump on this Token’s own tile');

        expect(renderStatement(
            { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 't_stump', placement: 'random_free' } }, names
        )).toContain('on a random free tile');
    });

    it('reads a transform plainly', () => {
        expect(renderStatement(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 't_oak' } }, names
        )).toBe("When this Token's own cycle completes, transforms into Oak.");
    });
});
