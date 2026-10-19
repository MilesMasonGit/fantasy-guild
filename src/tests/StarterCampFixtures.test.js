import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Foundations from '../systems/board/Foundations.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Shop from '../systems/board/Shop.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The Starter Camp is fixed** (concept_map_tools.md, "What can't be demolished"): every Token
 * the camp lays down when a new game begins is a fixture, like a map's nodes: never dragged, never
 * pushed, never demolished, and it says why. The Guild Hall still moves (and is never demolished).
 * What the player buys, crafts or builds there is theirs: movable and demolishable as usual.
 */

const WOOD = 'item_oak_wood';
const base = { tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', uses: null };

registerTokenTypes({
    scf_site: { ...base, id: 'scf_site', name: 'Scf Site', landmark: true },
    scf_big: { ...base, id: 'scf_big', name: 'Scf Big', size: 2 },
    scf_shop: {
        ...base, id: 'scf_shop', name: 'Scf Shop Token', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 1 }], section: 'general' }
    },
    scf_plot: { ...base, id: 'scf_plot', name: 'Scf Plot', size: 1, foundation: { kind: 'wood', skill: 'construction' } }
});

/** A Starter Camp as the CMS writes it: two Tokens and an endgame site around the Hall. */
const CAMP = Object.freeze({
    version: 1,
    savedAt: '2026-10-17T10:00:00.000Z',
    mat: { w: 1760, h: 1126 },
    hall: { x: 880, y: 563 },
    tokens: [
        { typeId: 'fixture_producer', x: 500, y: 563 },
        { typeId: 'fixture_passive', x: 1260, y: 563 },
        { typeId: 'scf_site', x: 300, y: 250 }
    ],
    bank: { [WOOD]: 10 }
});

/** A new game, as a slot's New Game makes one, in `camp` (null: the built-in camp). */
function newGame(camp = CAMP) {
    setStarterCampForTests(camp);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    EngineBootstrap.createDefaultGameData();
}

const hall = () => BoardState.tokens().find(t => MatCap.isGuildHall(t));
const campTokens = () => BoardState.tokens().filter(t => !MatCap.isGuildHall(t));
const byType = (typeId) => BoardState.tokens().find(t => t.typeId === typeId);
const pointOf = (t) => ({ x: t.x, y: t.y });
const spawnedAt = (typeId, x, y) =>
    BoardState.addToken(BoardState.createTokenInstance(typeId, null, null, BoardState.ORIGIN.SPAWNED), x, y);

/** Save the game and load it back, as a slot does. */
async function saveAndLoad() {
    const data = JSON.parse(GameState.serializeJson());
    await GameState.initFromSave(migrateState(data.state, data.version));
    return data;
}

beforeEach(() => {
    resetMatTuning();
    newGame();
});

afterEach(() => {
    Landmarks.setLayoutEditing(false);
    TileModifiers.teardown();
    resetStarterCampForTests();
    resetMatTuning();
});

describe('⭐ a new game lays the Starter Camp down as fixtures', () => {
    it('every Token the camp lays is the camp\'s fixture and fixed; the Guild Hall is neither', () => {
        const laid = campTokens();
        expect(laid.map(t => t.typeId)).toEqual(['fixture_producer', 'fixture_passive', 'scf_site']);
        for (const t of laid) {
            expect(t.fixture, t.typeId).toBe(BoardState.FIXTURE.CAMP);
            expect(BoardState.isFixture(t), t.typeId).toBe(true);
            expect(BoardState.isCampFixture(t), t.typeId).toBe(true);
            expect(FixedTokens.isFixed(t), t.typeId).toBe(true);
            expect(FixedTokens.showsMoveMarker(t), t.typeId).toBe(false);
            // Still the player's side of a spawn: placed, as a map's nodes are.
            expect(BoardState.originOf(t), t.typeId).toBe(BoardState.ORIGIN.PLACED);
        }
        expect(hall().fixture).toBeUndefined();
        expect(FixedTokens.isFixed(hall())).toBe(false);
        expect(FixedTokens.showsMoveMarker(hall())).toBe(true);
    });

    it('the built-in camp too: its Oak Forest and Copper Mine', () => {
        newGame(null);
        expect(campTokens().map(t => [t.typeId, t.fixture])).toEqual([
            ['token_oak_forest', BoardState.FIXTURE.CAMP],
            ['token_copper_mine', BoardState.FIXTURE.CAMP]
        ]);
        expect(hall().fixture).toBeUndefined();
    });

    it('a map\'s node keeps its own mark, and is no camp fixture', () => {
        const node = placeAt('fixture_producer', 1400, 900);
        node.fixture = true;
        expect(BoardState.isFixture(node)).toBe(true);
        expect(BoardState.isCampFixture(node)).toBe(false);
    });
});

describe('⭐ a camp Token refuses a drag, and says why', () => {
    it('by the engine and by a drop on the mat, it stays where it is', () => {
        for (const t of campTokens().filter(c => !MatCap.isLandmark(c))) {
            const before = pointOf(t);
            expect(Placement.moveTokenTo(t.id, { x: 1500, y: 950 }), t.typeId)
                .toEqual({ success: false, reason: Placement.CAMP_FIXED_IN_PLACE });
            expect(pointOf(t), t.typeId).toEqual(before);

            const dropped = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { instanceId: t.id } }, { x: 1500, y: 950 });
            expect(dropped.success, t.typeId).toBe(false);
            expect(pointOf(t), t.typeId).toEqual(before);
        }
        expect(Placement.CAMP_FIXED_IN_PLACE).toMatch(/Starter Camp/);
    });

    it('an endgame site in the camp refuses as a landmark does', () => {
        const site = byType('scf_site');
        const res = Placement.moveTokenTo(site.id, { x: 1500, y: 950 });
        expect(res.success).toBe(false);
        expect(res.reason).toMatch(/\w/);
        expect(pointOf(site)).toEqual({ x: 300, y: 250 });
    });
});

describe('⭐ no push moves a camp Token', () => {
    it('it is among the ids no push may move', () => {
        for (const t of campTokens()) {
            expect(FixedTokens.holdsItsGround(t), t.typeId).toBe(true);
            expect(FixedTokens.fixedTokenIds(), t.typeId).toContain(t.id);
            expect(FixedTokens.unpushableIds(), t.typeId).toContain(t.id);
        }
    });

    it('a Transforms statement growing into its space does not shove it', () => {
        const producer = byType('fixture_producer');
        const gap = Math.ceil(MatPlacement.minGap('fixture_passive', 'fixture_producer')) + 1;
        expect(gap).toBeLessThan(MatPlacement.minGap('scf_big', 'fixture_producer'));
        const bearer = spawnedAt('fixture_passive', producer.x, producer.y + gap);
        const before = pointOf(producer);

        EffectActions.transform(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'scf_big' } },
            { self: bearer.id }
        );

        expect(BoardState.getTokenById(bearer.id)).toBeNull();
        expect(pointOf(producer)).toEqual(before);
    });
});

describe('⭐ a camp Token cannot be demolished, and says why', () => {
    it('marking it is refused with the camp\'s reason, and nothing is marked', () => {
        for (const t of campTokens().filter(c => !MatCap.isLandmark(c))) {
            const refused = Demolition.mark(t.id);
            expect(refused, t.typeId).toEqual({
                success: false, code: Demolition.REFUSAL.CAMP, reason: Demolition.REFUSAL_TEXT[Demolition.REFUSAL.CAMP]
            });
            expect(Demolition.refusalOf(t), t.typeId).toBe(Demolition.REFUSAL.CAMP);
            expect(Demolition.isMarked(t), t.typeId).toBe(false);
        }
        expect(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.CAMP]).toMatch(/Starter Camp/);
    });

    it('nor taken off the mat for good', () => {
        const producer = byType('fixture_producer');
        expect(Demolition.canDemolish(producer)).toBe(false);
        expect(Placement.removePlacedToken(producer.id).success).toBe(false);
        expect(BoardState.getTokenById(producer.id)).toBeTruthy();
    });

    it('an endgame site in the camp still gives the landmark\'s reason; a map\'s node its own', () => {
        expect(Demolition.refusalOf(byType('scf_site'))).toBe(Demolition.REFUSAL.LANDMARK);
        const node = placeAt('fixture_producer', 1400, 900);
        node.fixture = true;
        expect(Demolition.refusalOf(node)).toBe(Demolition.REFUSAL.MAP_NODE);
    });
});

describe('⭐ what the player buys, crafts or builds in the camp is theirs', () => {
    /** Movable, demolishable, carrying the marker, and no fixture. */
    function expectTheirs(t) {
        expect(t.fixture, t.typeId).toBeUndefined();
        expect(FixedTokens.isFixed(t), t.typeId).toBe(false);
        expect(FixedTokens.showsMoveMarker(t), t.typeId).toBe(true);
        expect(Demolition.canMark(t.id), t.typeId).toMatchObject({ success: true });
        expect(Placement.moveTokenTo(t.id, { x: 1500, y: 950 }), t.typeId).toMatchObject({ success: true });
    }

    it('a Token bought at the Shop', () => {
        const res = Shop.buy('scf_shop');
        expect(res.success).toBe(true);
        expectTheirs(res.instance);
    });

    it('a Token a camp station crafts, landing beside it', () => {
        const station = byType('fixture_producer');
        const res = Placement.placeProduct(station.id, 'fixture_producer');
        expect(res.success).toBe(true);
        expectTheirs(res.instance);
    });

    it('a Token built on a Foundation the player put down', () => {
        const plot = placeAt('scf_plot', 1100, 300);
        const built = Foundations.buildInPlace(plot, 'fixture_producer');
        expect(built?.typeId).toBe('fixture_producer');
        expectTheirs(built);
    });
});

describe('⭐ the Guild Hall moves, and is never demolished', () => {
    it('it moves, by the engine and by a drop on the mat', () => {
        expect(Placement.moveTokenTo(hall().id, { x: 1100, y: 800 })).toMatchObject({ success: true });
        expect(pointOf(hall())).toEqual({ x: 1100, y: 800 });
        const dropped = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: hall().typeId, from: { instanceId: hall().id } }, { x: 900, y: 300 });
        expect(dropped.success).toBe(true);
        expect(pointOf(hall())).toEqual({ x: 900, y: 300 });
    });

    it('it refuses demolition with its own reason', () => {
        expect(Demolition.mark(hall().id)).toMatchObject({ success: false, code: Demolition.REFUSAL.GUILD_HALL });
        expect(Demolition.canDemolish(hall())).toBe(false);
    });
});

describe('⭐ the mark is saved with the Token', () => {
    it('after a save and a load the camp is still fixed, and the Hall still moves', async () => {
        const ids = campTokens().map(t => t.id);
        const data = await saveAndLoad();
        for (const id of ids) expect(data.state.board.tokens[id].fixture).toBe(BoardState.FIXTURE.CAMP);

        for (const id of ids) {
            const t = BoardState.getTokenById(id);
            expect(t.fixture, t.typeId).toBe(BoardState.FIXTURE.CAMP);
            expect(FixedTokens.isFixed(t), t.typeId).toBe(true);
        }
        const producer = byType('fixture_producer');
        expect(Placement.moveTokenTo(producer.id, { x: 1500, y: 950 }))
            .toEqual({ success: false, reason: Placement.CAMP_FIXED_IN_PLACE });
        expect(Demolition.mark(producer.id)).toMatchObject({ success: false, code: Demolition.REFUSAL.CAMP });
        expect(hall().fixture).toBeUndefined();
        expect(Placement.moveTokenTo(hall().id, { x: 1100, y: 800 })).toMatchObject({ success: true });
    });

    it('and after the guild travels away and back', () => {
        const ids = campTokens().map(t => t.id);
        const home = Atlas.createStarterRegion().id;
        const away = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.travel(away).success).toBe(true);
        expect(ids.some(id => BoardState.getTokenById(id))).toBe(false);
        expect(Atlas.travel(home).success).toBe(true);
        for (const id of ids) expect(BoardState.getTokenById(id)?.fixture).toBe(BoardState.FIXTURE.CAMP);
    });

    it('a save from before the mark is not converted: its camp Tokens stay movable', async () => {
        for (const t of campTokens()) delete t.fixture;
        await saveAndLoad();
        const producer = byType('fixture_producer');
        expect(FixedTokens.isFixed(producer)).toBe(false);
        expect(Placement.moveTokenTo(producer.id, { x: 1500, y: 950 })).toMatchObject({ success: true });
    });
});

describe('⭐ a transform keeps the camp\'s mark', () => {
    it('a camp Token a Transforms statement turns is still the camp\'s, with the camp\'s reason', () => {
        const producer = byType('fixture_producer');
        const at = pointOf(producer);
        EffectActions.transform(
            { ...makeStatement(KEYWORD.TRANSFORMS), payload: { typeId: 'fixture_passive' } },
            { self: producer.id }
        );
        const now = BoardState.tokensAtPoint(at.x, at.y).find(t => t.id !== producer.id);
        expect(now.typeId).toBe('fixture_passive');
        expect(now.fixture).toBe(BoardState.FIXTURE.CAMP);
        expect(FixedTokens.isFixed(now)).toBe(true);
        expect(Demolition.refusalOf(now)).toBe(Demolition.REFUSAL.CAMP);
    });
});

describe('the dev layout tool lifts the camp\'s fixtures, as it lifts landmarks', () => {
    it('while it is on a camp Token moves and may be taken off, never marked; off again, it is fixed', () => {
        const producer = byType('fixture_producer');
        Landmarks.setLayoutEditing(true);
        expect(FixedTokens.isFixed(producer)).toBe(false);
        expect(Demolition.canDemolish(producer)).toBe(true);
        expect(Demolition.mark(producer.id)).toMatchObject({ success: false, code: Demolition.REFUSAL.CAMP });
        expect(Placement.moveTokenTo(producer.id, { x: 1500, y: 950 })).toMatchObject({ success: true });

        Landmarks.setLayoutEditing(false);
        expect(FixedTokens.isFixed(producer)).toBe(true);
        expect(Demolition.canDemolish(producer)).toBe(false);
    });

    it('a map\'s node stays fixed while it is on', () => {
        const node = placeAt('fixture_producer', 1400, 900);
        node.fixture = true;
        Landmarks.setLayoutEditing(true);
        expect(FixedTokens.isFixed(node)).toBe(true);
    });
});
