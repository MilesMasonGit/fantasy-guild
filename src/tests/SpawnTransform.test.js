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

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat for the bearer to stand on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **`Spawns` and `Transforms`** (Effects Grammar v2, V9).
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
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
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

        expect(tokenAt(A).typeId).toBe('fixture_passive');
    });

    it('⚠️ arrives FRESH, not carrying the old Token’s wear', () => {
        // Charges and cooldowns belong to what it WAS. Carrying them across
        // would give the new Token a worn-down history it never had, and the two
        // may not even hold the same number of charges.
        actingProducer('fixture_worn', KEYWORD.TRANSFORMS, { typeId: 'fixture_enemy' });
        place(A, 'fixture_worn', 'hero_1');

        run(13000);

        expect(tokenAt(A).usesRemaining)
            .toBe(tokenStartingUses('fixture_enemy'));
    });

    it('⚠️ leaves the hero standing there', () => {
        // Somebody working a Sapling is still standing there when it becomes an
        // Oak; moving them would be a displacement nobody authored.
        actingProducer('fixture_shifting', KEYWORD.TRANSFORMS, { typeId: 'fixture_passive' });
        place(A, 'fixture_shifting', 'hero_1');

        run(13000);

        // Free Playmat 1.4b: the Token it became is a new instance (and here a
        // passive one), so the claim ends and the flag chooses again — but
        // nobody is moved. The flag still stands on the spot.
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(C(A));
        expect(BoardState.workerOf(idAt(A))).toBeNull();
    });

    it('refuses a Token that does not exist', () => {
        const bearer = place(A, 'fixture_passive');
        expect(EffectActions.transform(
            { payload: { typeId: 'no_such_token' }, target: { role: ROLE.SELF } },
            { self: bearer.id }
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

        expect(tokenAt(A).typeId).toBe('fixture_passive');
    });

    it('lands on the nearest free tile when told to', () => {
        actingProducer('fixture_seeder', KEYWORD.SPAWNS, {
            typeId: 'fixture_passive', placement: PLACEMENT.NEAREST_FREE
        });
        place(A, 'fixture_seeder', 'hero_1');

        run(13000);

        // The bearer is untouched, and something new stands beside it.
        // ⚠️ Asked of the mat as a whole: since free placement (1.6d-1) a spawn
        // lands at the nearest legal POINT, which is usually not one of the
        // named spots at all.
        expect(tokenAt(A).typeId).toBe('fixture_seeder');
        const spawned = BoardState.tokens().filter(t => t.typeId === 'fixture_passive');
        expect(spawned.length).toBeGreaterThan(0);
    });

    // Free Playmat slice 1.6b: `resolvePlacement` chooses among the free SPOTS
    // (mat points) its caller found, measured from the bearer's point — it used
    // to take tile numbers and a tile distance.
    const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

    it('⚠️ never lands anywhere but a free spot', () => {
        // Shoving a Token onto an occupied spot would silently destroy whatever
        // was there. `here` is the one placement where replacing IS the intent.
        const view = { candidates: [{ x: 384, y: 64 }], distanceSq: d2 };
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, { x: 64, y: 64 }, view)).toEqual({ x: 384, y: 64 });
    });

    it('⚠️ does nothing at all when the mat is full (FP-46)', () => {
        // A full mat is an ordinary state, not a failure.
        const full = { candidates: [], distanceSq: d2 };
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, { x: 64, y: 64 }, full)).toBeNull();
        expect(resolvePlacement(PLACEMENT.RANDOM_FREE, { x: 64, y: 64 }, full)).toBeNull();
    });

    it('picks the nearest spot, and breaks a distance tie in reading order', () => {
        const from = { x: 224, y: 224 };
        // Nearest wins outright.
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, from, {
            candidates: [{ x: 544, y: 224 }, { x: 384, y: 224 }], distanceSq: d2
        })).toEqual({ x: 384, y: 224 });
        // Equally near: the higher-up spot, then the one further left.
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, from, {
            candidates: [{ x: 384, y: 224 }, { x: 224, y: 64 }, { x: 64, y: 224 }], distanceSq: d2
        })).toEqual({ x: 224, y: 64 });
        expect(resolvePlacement(PLACEMENT.NEAREST_FREE, from, {
            candidates: [{ x: 384, y: 224 }, { x: 64, y: 224 }], distanceSq: d2
        })).toEqual({ x: 64, y: 224 });
    });

    it('picks at random when told to, from the free spots only, keeping the roomiest', () => {
        const spots = [{ x: 64, y: 64 }, { x: 704, y: 704 }];
        const view = { candidates: spots, distanceSq: d2, openness: (p) => p.x };
        let n = 0;
        const alternating = () => (n++ % 2 ? 0.9 : 0.1);
        expect(resolvePlacement(PLACEMENT.RANDOM_FREE, { x: 0, y: 0 }, view, alternating)).toEqual({ x: 704, y: 704 });
        expect(spots).toContainEqual(resolvePlacement(PLACEMENT.RANDOM_FREE, { x: 0, y: 0 }, { candidates: spots, distanceSq: d2 }, () => 0.9));
    });

    it('refuses a Token that does not exist', () => {
        const bearer = place(A, 'fixture_passive');
        expect(EffectActions.spawn(
            { payload: { typeId: 'no_such_token' } }, { self: bearer.id }
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
        )).toContain('spawns Stump on this Token’s tile');

        expect(renderStatement(
            { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 't_stump', placement: 'random_free' } }, names
        )).toContain('on a random free tile');
    });

    it('reads a transform plainly', () => {
        expect(renderStatement(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 't_oak' } }, names
        )).toBe("On Cycle: transforms into Oak.");
    });
});
