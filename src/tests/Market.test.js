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

function place(tile, typeId, heroId = null) {
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

const MARKET = 'fixture_market';

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
    it('consumes its inputs and credits currency', () => {
        const def = getTokenType(MARKET);
        InventoryManager.addItem('item_market_goods', 10);
        place(10, MARKET, 'hero_1');

        run(16000);   // one 15s cycle

        expect(GameState.state.currency.gold).toBe(def.config.outputs[0].quantity);
        expect(InventoryManager.getItemCount('item_market_goods')).toBe(0);
    });

    it('drops no sprite — gold is not an item and has nowhere to land', () => {
        InventoryManager.addItem('item_market_goods', 10);
        place(10, MARKET, 'hero_1');

        run(16000);

        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('waits when it cannot afford its inputs, exactly like any other Token', () => {
        InventoryManager.addItem('item_market_goods', 3);      // needs 10
        place(10, MARKET, 'hero_1');

        run(16000);

        expect(GameState.state.currency.gold).toBe(0);
        expect(BoardState.getToken(10).alert).toBe(BoardRunner.ALERT.INPUTS);
    });

    it('needs a hero — gold income is not a passive trickle', () => {
        InventoryManager.addItem('item_market_goods', 50);
        place(10, MARKET);                                  // unstaffed

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

    it('the premium is what the player actually banks, not just what is authored', () => {
        // End to end: sell the goods raw, then earn the same goods through the
        // Market, and compare the two piles of gold. This is the assertion that
        // would catch the currency path breaking, which an arithmetic check on
        // the authored numbers never could.
        const input = getTokenType(MARKET).config.inputs[0];

        InventoryManager.addItem(input.itemId, input.quantity);
        CommerceSystem.sellItem(input.itemId, input.quantity);
        const rawGold = GameState.state.currency.gold;

        GameState.state.currency.gold = 0;
        InventoryManager.addItem(input.itemId, input.quantity);
        place(10, MARKET, 'hero_1');
        run(16000);
        const marketGold = GameState.state.currency.gold;

        expect(rawGold).toBeGreaterThan(0);
        expect(marketGold).toBe(Math.round(rawGold * MARKET_PREMIUM));
    });

    it('costs a whole tile and a whole hero for its income', () => {
        // The design's actual constraint (D-141): serious gold income costs
        // several tiles and several heroes. One Market occupies one of each.
        const def = getTokenType(MARKET);
        expect(def.requiresHero).not.toBe(false);
        expect(def.config.inputs.length).toBeGreaterThan(0);
    });
});
