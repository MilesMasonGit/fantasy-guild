import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MARKET_PREMIUM } from './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { CommerceSystem } from '../systems/economy/CommerceSystem.js';
import { getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * Market Tokens (D-141) — **a Token whose output is currency.**
 *
 * Goods-specific, with an input list like any other Token, which keeps Markets
 * consistent with the rest of the board and removes any ambiguity about what a
 * Market sells. It also reinforces D-128: the best gold comes from feeding
 * *finished goods* into the right Market, so deep chains pay off in currency as
 * well as in capability.
 *
 * **Serious gold income should cost several tiles and several heroes.** That is
 * the property these tests protect — a Market must never be better than a menu
 * action would have been, or the board stops being where the game happens.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level: 50, xp: 0 };
    }
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(point, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    if (heroId) Placement.plantFlagAt(heroId, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

const MARKET = 'fixture_market';
const SPOT = { x: 400, y: 300 };

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    GameState.state.currency.gold = 0;
});

describe('A Market is an ordinary Token whose output is gold', () => {
    // ⚠️ Changed in slice 2.2 (SP-65): gold is retired, so a Market's currency
    // output credits nothing. It used to assert the gold matched the authored
    // output. The cycle itself is unchanged: it still runs and takes its inputs.
    it('consumes its inputs and credits no gold (SP-65)', () => {
        const def = getTokenType(MARKET);
        expect(def.config.outputs[0].quantity).toBeGreaterThan(0);
        InventoryManager.addItem('item_market_goods', 10);
        place(SPOT, MARKET, 'hero_1');

        run(16000);   // one 15s cycle

        expect(GameState.state.currency.gold).toBe(0);
        expect(InventoryManager.getItemCount('item_market_goods')).toBe(0);
    });

    it('drops no sprite — gold is not an item and has nowhere to land', () => {
        InventoryManager.addItem('item_market_goods', 10);
        place(SPOT, MARKET, 'hero_1');

        run(16000);

        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('waits when it cannot afford its inputs, exactly like any other Token', () => {
        InventoryManager.addItem('item_market_goods', 3);      // needs 10
        const market = place(SPOT, MARKET, 'hero_1');

        run(16000);

        expect(GameState.state.currency.gold).toBe(0);
        expect(BoardState.getTokenById(market.id).alert).toBe(BoardRunner.ALERT.INPUTS);
    });

    it('needs a hero — gold income is not a passive trickle', () => {
        InventoryManager.addItem('item_market_goods', 50);
        place(SPOT, MARKET);                                // unstaffed

        run(30000);

        expect(GameState.state.currency.gold).toBe(0);
    });
});

describe('⚠️ Items are worth more used than sold (D-128)', () => {
    it('pays roughly a 20% premium over dumping the same goods at the Bank', () => {
        // The owner's rule (2026-08-20). The premium is what buys the tile and
        // the hero: without it a Market is strictly worse than the sell button
        // and nobody would ever place one.
        const def = getTokenType(MARKET);
        const input = def.config.inputs[0];
        const raw = CommerceSystem.getItemPrice(input.itemId) * input.quantity;

        expect(raw, 'the fixture input must have a real Bank price').toBeGreaterThan(0);
        expect(def.config.outputs[0].quantity).toBe(Math.round(raw * MARKET_PREMIUM));
    });

    // ⚠️ Changed in slice 2.2 (SP-65). This used to sell the goods raw, run
    // them through the Market, and check the Market paid the premium in gold.
    // Gold is retired: nothing sells from the UI and a Market credits nothing,
    // so the end-to-end check is now that a full Market cycle banks no gold.
    it('a Market cycle banks no gold at all (SP-65)', () => {
        const input = getTokenType(MARKET).config.inputs[0];

        InventoryManager.addItem(input.itemId, input.quantity);
        place(SPOT, MARKET, 'hero_1');
        run(16000);

        expect(InventoryManager.getItemCount(input.itemId)).toBe(0);   // the cycle did run
        expect(GameState.state.currency.gold).toBe(0);
    });

    it('costs a whole spot and a whole hero for its income', () => {
        // The design's actual constraint (D-141): serious gold income costs
        // several spots and several heroes. One Market occupies one of each.
        const def = getTokenType(MARKET);
        expect(def.requiresHero).not.toBe(false);
        expect(def.config.inputs.length).toBeGreaterThan(0);
    });
});
