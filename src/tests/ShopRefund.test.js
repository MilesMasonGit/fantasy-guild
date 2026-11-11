import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Shop from '../systems/board/Shop.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * An unbuilt Foundation goes back to the Shop for its whole price (brief 580 S1). A build in
 * progress has paid nothing (inputs are taken when the cycle completes), so the refund is the
 * Shop price only, and the hero working it lets go.
 */

const WOOD = 'item_oak_wood';
const STONE = 'item_stone';
const COAL = 'item_coal';
const PRICE = [{ itemId: WOOD, quantity: 3 }, { itemId: STONE, quantity: 2 }];

registerTokenTypes({
    fixture_rf_foundation: {
        id: 'fixture_rf_foundation', name: 'Fixture Refund Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'rf_stone', skill: 'construction' },
        shop: { price: PRICE, section: 'general' }
    },
    fixture_rf_unsold_foundation: {
        id: 'fixture_rf_unsold_foundation', name: 'Fixture Unsold Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'rf_stone', skill: 'construction' }
    },
    fixture_rf_sold: {
        id: 'fixture_rf_sold', name: 'Fixture Sold Bench', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 1 }], section: 'general' }
    },
    fixture_rf_built: {
        id: 'fixture_rf_built', name: 'Fixture Built Furnace', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 100,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_fixture_rf_built', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    }
});

registerRecipePools({
    construction: [
        {
            id: 'fixture_rf_build', name: 'Build Fixture Furnace', levelRequirement: 1,
            foundationKinds: ['rf_stone'],
            inputs: [{ itemId: COAL, quantity: 5 }],
            outputs: [{ tokenId: 'fixture_rf_built', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 3000, xp: 10
        }
    ]
});

const AT = { x: 560, y: 520 };

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const bank = (itemId) => InventoryManager.getItemCount(itemId);
const floor = (itemId) => SpriteLayer.countOnBoard(itemId);

/** Buy the fixture Foundation at `point` with exactly its price in the Bank. */
function buyFoundation(point = AT) {
    for (const { itemId, quantity } of PRICE) InventoryManager.addItem(itemId, quantity);
    const res = Shop.buyAt('fixture_rf_foundation', point);
    expect(res.success, res.reason).toBe(true);
    return res.instance;
}

/** A Token put on the mat by hand, not bought. */
function put(typeId, { origin, fixture } = {}, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin);
    if (fixture) instance.fixture = fixture;
    Placement.placeTokenAt(instance, point);
    return BoardState.getTokenById(instance.id);
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { construction: 5 })];
});

describe('a refund', () => {
    it('gives back exactly the Shop price, takes the Token off the mat and lowers the cap count', () => {
        const f = buyFoundation();
        expect(bank(WOOD)).toBe(0);
        expect(bank(STONE)).toBe(0);
        const count = MatCap.tokenCount();

        expect(Shop.canRefund(f.id)).toEqual({ ok: true });
        const res = Shop.refund(f.id);

        expect(res).toMatchObject({ success: true, typeId: 'fixture_rf_foundation', heroId: null });
        expect(res.price).toEqual(PRICE);
        expect(bank(WOOD)).toBe(3);
        expect(bank(STONE)).toBe(2);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(MatCap.tokenCount()).toBe(count - 1);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('announces itself once with what came back and where it stood', () => {
        const f = buyFoundation();
        const { x, y } = f;
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.TOKEN_REFUNDED, (d) => heard.push(d));
        Shop.refund(f.id);
        off?.();
        expect(heard).toEqual([{ typeId: 'fixture_rf_foundation', instanceId: f.id, price: PRICE, x, y, heroId: null }]);
    });

    it('with a full Bank the price waits on the floor as loot, none of it lost', () => {
        const f = buyFoundation();
        InventoryManager.addItem(COAL, 1);
        // No slot left for a new kind: wood and stone were spent to nothing.
        GameState.state.inventory.maxSlots = Object.keys(GameState.state.inventory.items).length;
        expect(InventoryManager.lacksSlotFor(WOOD)).toBe(true);

        expect(Shop.refund(f.id).success).toBe(true);
        expect(bank(WOOD)).toBe(0);
        expect(bank(STONE)).toBe(0);
        expect(floor(WOOD)).toBe(3);
        expect(floor(STONE)).toBe(2);
    });
});

describe('a Foundation part-way through a build', () => {
    it('is refundable for its Shop price only: the build has taken nothing and its hero lets go', () => {
        const f = buyFoundation();
        InventoryManager.addItem(COAL, 10);
        expect(StationRecipe.setSelectedRecipe(f, 'fixture_rf_build')).toBe(true);
        Orders.orderAt('h1', AT);
        expect(BoardState.workTokenOf('h1')).toBe(f.id);

        run(2000);
        expect(BoardState.getTokenById(f.id).cycleElapsedMs).toBeGreaterThan(0);
        expect(bank(COAL)).toBe(10);                       // checked at the start, not taken

        const res = Shop.refund(f.id);
        expect(res).toMatchObject({ success: true, heroId: 'h1' });
        expect(bank(COAL)).toBe(10);                       // the build's inputs untouched
        expect(bank(WOOD)).toBe(3);
        expect(bank(STONE)).toBe(2);
        expect(BoardState.workTokenOf('h1')).toBeNull();
        expect(BoardState.workerOf(f.id)).toBeNull();

        run(5000);
        expect(onMat('fixture_rf_built')).toHaveLength(0);
        expect(bank(COAL)).toBe(10);
        expect(Flags.pinnedIdOf('h1')).toBeNull();
    });
});

describe('what cannot go back', () => {
    it('a built Token: it is no longer a Foundation', () => {
        const f = buyFoundation();
        InventoryManager.addItem(COAL, 5);
        StationRecipe.setSelectedRecipe(f, 'fixture_rf_build');
        Orders.orderAt('h1', AT);
        run(4000);
        const [built] = onMat('fixture_rf_built');
        expect(built).toBeTruthy();

        const check = Shop.canRefund(built.id);
        expect(check.ok).toBe(false);
        expect(check.reason).toMatch(/built/);
        expect(Shop.refund(built.id)).toMatchObject({ success: false, reason: check.reason });
        expect(BoardState.getTokenById(built.id)).toBeTruthy();
        expect(bank(WOOD)).toBe(0);
        expect(Shop.canRefund(f.id)).toEqual({ ok: false, reason: 'No Token there' });
    });

    it('a spawned Foundation', () => {
        const f = put('fixture_rf_foundation', { origin: BoardState.ORIGIN.SPAWNED });
        expect(Shop.canRefund(f.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/not bought/) });
        expect(Shop.refund(f.id).success).toBe(false);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(bank(WOOD)).toBe(0);
    });

    it('a Foundation laid down with the land: a map node or a Starter Camp Token', () => {
        for (const fixture of [BoardState.FIXTURE.MAP, BoardState.FIXTURE.CAMP]) {
            const f = put('fixture_rf_foundation', { fixture });
            expect(Shop.canRefund(f.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/came with the land/) });
            expect(Shop.refund(f.id).success).toBe(false);
            expect(BoardState.getTokenById(f.id)).toBeTruthy();
            BoardState.removeToken(f.id);
        }
        expect(bank(WOOD)).toBe(0);
    });

    it('a Token the Shop sells that is not a Foundation, a Foundation the Shop does not sell, the Guild Hall, nothing', () => {
        const sold = put('fixture_rf_sold');
        expect(Shop.canRefund(sold.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/Only an unbuilt Foundation/) });
        const unsold = put('fixture_rf_unsold_foundation', {}, { x: 900, y: 900 });
        expect(Shop.canRefund(unsold.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/not sold/) });
        const hall = put('token_guild_hall', {}, { x: 1300, y: 300 });
        expect(Shop.canRefund(hall.id).ok).toBe(false);
        expect(Shop.canRefund('no_such_id')).toEqual({ ok: false, reason: 'No Token there' });
        expect(Shop.refund('no_such_id')).toMatchObject({ success: false, reason: 'No Token there' });
        for (const t of [sold, unsold, hall]) expect(BoardState.getTokenById(t.id)).toBeTruthy();
    });
});

describe('a quest counting purchases', () => {
    beforeEach(() => QuestManager.init());

    it('keeps the purchase it counted: a refund reports no progress, up or down', () => {
        const spy = vi.spyOn(QuestManager, 'reportProgress');
        const f = buyFoundation();
        expect(spy.mock.calls.some(([target]) => target === 'token_purchased')).toBe(true);

        spy.mockClear();
        Shop.refund(f.id);
        expect(spy.mock.calls.filter(([target]) => target === 'token_purchased')).toEqual([]);
        expect(spy.mock.calls.filter(([, amount]) => amount < 0)).toEqual([]);
        spy.mockRestore();
        QuestManager.cleanup();
    });
});
