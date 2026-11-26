import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Flags from '../systems/board/Flags.js';
import * as Shop from '../systems/board/Shop.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins, addCoins } from '../systems/inventory/Coins.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Salvage (brief 800 P4, Construction 75): a Token demolished by a hero holding it gives back a
 * share of what it cost, as loot where it stood. What it cost is what the guild paid for it, kept on
 * the Token (`instance.paid`, saved): its Shop price as bought, and for a building its Foundation's
 * price and the build's materials as paid, coins included. The share is the effect's number (the
 * demolisher's own, at most 100), each line rounded down. A Token nobody paid for (a map's, a spawned
 * one) gives nothing back, and a demolisher without Salvage gives nothing back and draws nothing.
 */

const WOOD = 'item_oak_wood';
const STONE = 'item_stone';
const COAL = 'item_coal';
const PRICE = [{ itemId: WOOD, quantity: 9 }, { itemId: STONE, quantity: 4 }];
const COINS = 5;

registerTokenTypes({
    sv_foundation: {
        id: 'sv_foundation', name: 'SV Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'sv_kind', skill: 'construction' },
        shop: { price: PRICE, coins: COINS, section: 'general' }
    },
    sv_workshop: {
        id: 'sv_workshop', name: 'SV Workshop', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 4000, xp: 1 },
        statements: [{ id: 'stm_sv_workshop', keyword: KEYWORD.STATION, payload: { skill: 'crafting' } }]
    },
    sv_tree: {
        id: 'sv_tree', name: 'SV Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: WOOD, quantity: 1, chance: 100 }] }
    }
});

const BUILD = 'sv_build_workshop';
registerRecipePools({
    construction: [{
        id: BUILD, name: 'Build SV Workshop', levelRequirement: 1, foundationKinds: ['sv_kind'],
        inputs: [{ itemId: COAL, quantity: 7 }],
        outputs: [{ tokenId: 'sv_workshop', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 3000, xp: 5
    }]
});

const salvage = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.SALVAGE, bucket: 'flat', value }
    }]
});
registerEffects({
    sv_salvage: salvage('sv_salvage', 50),
    sv_salvage_all: salvage('sv_salvage_all', 150)
});

const perks = (effectId) => registerSkillPerks({ construction: { perks: effectId ? [{ level: 75, effectId }] : [] } });

function hero(id, construction) {
    return {
        id, name: id, status: 'idle', level: 50, hp: { current: 100, max: 100 },
        skills: { construction: { level: construction, xp: 0 }, crafting: { level: 10, xp: 0 }, forestry: { level: 10, xp: 0 } }
    };
}

const AT = { x: 700, y: 500 };
const ELSEWHERE = { x: 1300, y: 900 };
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const floor = (itemId) => SpriteLayer.countOnBoard(itemId);
const bank = (itemId) => InventoryManager.getItemCount(itemId);
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

/** Buy the Foundation at `point` with exactly its price in hand. */
function buyFoundation(point = AT) {
    for (const { itemId, quantity } of PRICE) InventoryManager.addItem(itemId, quantity);
    addCoins(COINS);
    const res = Shop.buyAt('sv_foundation', point);
    expect(res.success, res.reason).toBe(true);
    return res.instance;
}

/** A Token put on the mat by hand: nobody paid for it. */
function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    TileModifiers.rebuildAround([instance]);
    return BoardState.getTokenById(instance.id);
}

/** Mark `token` and send `heroId` to take it down; runs until it is gone. */
function demolish(token, heroId) {
    expect(Demolition.mark(token.id).success).toBe(true);
    Orders.orderAt(heroId, { x: token.x, y: token.y });
    expect(BoardState.claimOfHero(heroId)?.instanceId).toBe(token.id);
    run(Demolition.DEMOLISH_MS + 500);
    expect(BoardState.getTokenById(token.id)).toBeNull();
}

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

let demolished;
let off;

beforeAll(() => Flags.init());
afterAll(() => { perks(null); Flags.teardown(); resetMatTuning(); });
afterEach(() => { off?.(); vi.restoreAllMocks(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    perks('sv_salvage');
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.inventory.maxSlots = 50;
    // `salvager` holds Salvage (Construction 75); `novice` does not.
    GameState.state.heroes = [hero('salvager', 80), hero('novice', 10)];
    demolished = [];
    off = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, (p) => demolished.push(p));
});

describe('what a Token cost is kept on it', () => {
    it('a Foundation bought at the Shop keeps its price and coins as paid', () => {
        const f = buyFoundation();
        expect(f.paid).toEqual({ items: PRICE, coins: COINS });
    });

    it('a building keeps its Foundation\'s price and the build\'s materials as paid', () => {
        const f = buyFoundation();
        InventoryManager.addItem(COAL, 7);
        expect(StationRecipe.setSelectedRecipe(f, BUILD)).toBe(true);
        Orders.orderAt('novice', AT);
        run(4000);
        const [built] = onMat('sv_workshop');
        expect(built).toBeTruthy();
        expect(bank(COAL)).toBe(0);
        expect(built.paid).toEqual({ items: [...PRICE, { itemId: COAL, quantity: 7 }], coins: COINS });
    });

    it('a Token nobody paid for keeps nothing', () => {
        expect(put('sv_tree').paid).toBeUndefined();
    });

    it('the record is saved and loaded with the Token', () => {
        const f = buyFoundation();
        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED);
        const loaded = BoardState.getTokenById(f.id);
        expect(loaded).not.toBe(f);
        expect(loaded.paid).toEqual({ items: PRICE, coins: COINS });

        demolish(loaded, 'salvager');
        expect(floor(WOOD)).toBe(4);
        expect(floor(STONE)).toBe(2);
        expect(floor(COIN_ITEM_ID)).toBe(2);
    });
});

describe('a demolition by a hero holding Salvage', () => {
    it('drops its share of what the Token cost where it stood, each line rounded down, the coins as a pile', () => {
        const f = buyFoundation();
        const spot = { x: f.x, y: f.y };
        expect(bank(WOOD)).toBe(0);
        const coins = getCoins();

        demolish(f, 'salvager');

        expect(floor(WOOD)).toBe(4);          // 9 at 50%, rounded down
        expect(floor(STONE)).toBe(2);
        expect(floor(COIN_ITEM_ID)).toBe(2);  // 5 at 50%, rounded down
        expect(bank(WOOD)).toBe(0);           // loot on the floor until collected
        expect(getCoins()).toBe(coins);
        for (const sprite of SpriteLayer.getSprites()) {
            expect(Math.hypot(sprite.fromX - spot.x, sprite.fromY - spot.y)).toBeLessThan(1);
        }
        expect(demolished).toHaveLength(1);
        expect(demolished[0]).toMatchObject({ instanceId: f.id, heroId: 'salvager' });
    });

    it('a building gives back a share of its Foundation and its build', () => {
        const f = buyFoundation();
        InventoryManager.addItem(COAL, 7);
        StationRecipe.setSelectedRecipe(f, BUILD);
        Orders.orderAt('novice', AT);
        run(4000);
        const [built] = onMat('sv_workshop');
        Orders.orderAt('novice', ELSEWHERE);

        demolish(built, 'salvager');
        expect(floor(WOOD)).toBe(4);
        expect(floor(STONE)).toBe(2);
        expect(floor(COAL)).toBe(3);          // 7 at 50%, rounded down
        expect(floor(COIN_ITEM_ID)).toBe(2);
    });

    it('never gives back more than was paid: Salvage above 100 counts as 100', () => {
        perks('sv_salvage_all');
        const f = buyFoundation();
        demolish(f, 'salvager');
        expect(floor(WOOD)).toBe(9);
        expect(floor(STONE)).toBe(4);
        expect(floor(COIN_ITEM_ID)).toBe(COINS);
    });

    it('a Token nobody paid for gives nothing back', () => {
        demolish(put('sv_tree'), 'salvager');
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('a picked-up share is banked like any loot, the coins as coins', () => {
        const coins = getCoins();
        demolish(buyFoundation(), 'salvager');
        SpriteLayer.collectAll();
        expect(bank(WOOD)).toBe(4);
        expect(bank(STONE)).toBe(2);
        expect(getCoins()).toBe(coins + 2);
    });
});

describe('a demolition by a hero without Salvage', () => {
    it('gives nothing back, though another hero in the guild holds it', () => {
        demolish(buyFoundation(), 'novice');
        expect(SpriteLayer.getSprites()).toHaveLength(0);
        expect(demolished[0]).toMatchObject({ heroId: 'novice' });
    });

    it('draws no number more than a demolition of a Token nobody paid for', () => {
        const drawsFor = (paidFor) => {
            GameState.initNew();
            InventoryManager.init();
            SpriteLayer.init();
            TileModifiers.clearAll();
            clearMat();
            GameState.state.inventory.maxSlots = 50;
            GameState.state.heroes = [hero('novice', 10)];
            const token = paidFor ? buyFoundation() : put('sv_foundation');
            stream.state = 7;
            stream.draws = 0;
            vi.spyOn(Math, 'random').mockImplementation(seeded);
            demolish(token, 'novice');
            vi.restoreAllMocks();
            return stream.draws;
        };
        expect(drawsFor(true)).toBe(drawsFor(false));
    });
});
