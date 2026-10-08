import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Shop from '../systems/board/Shop.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { placeAt } from './fixtures/mat.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

/**
 * Token Lifecycle slice 5.1 — **the Shop**.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const WOOD = 'item_oak_wood';

registerTokenTypes({
    fixture_shop_forest: {
        id: 'fixture_shop_forest', name: 'Fixture Oak Forest', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 10 }], section: 'forestry' }
    },
    fixture_shop_bench: {
        id: 'fixture_shop_bench', name: 'Fixture Bench', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 2 }, { itemId: 'item_stone', quantity: 1 }], section: 'general' }
    },
    fixture_grp_big: {
        id: 'fixture_grp_big', name: 'Fixture Grp Big', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 20 }], section: 'forestry', group: 'Fixture Group' }
    },
    fixture_grp_small: {
        id: 'fixture_grp_small', name: 'Fixture Grp Small', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 4 }], section: 'forestry', group: 'Fixture Group' }
    },
    fixture_not_sold: { id: 'fixture_not_sold', name: 'Fixture Not Sold', size: 1 },
    // Foundations whose price order is the reverse of their tier order.
    fixture_tgrp_t3: {
        id: 'fixture_tgrp_t3', name: 'Fixture Tier 3', size: 1, foundation: { kind: 'wood', skill: 'construction', tier: 3 },
        shop: { price: [{ itemId: WOOD, quantity: 2 }], section: 'smithing', group: 'Fixture Tier Group' }
    },
    fixture_tgrp_t1: {
        id: 'fixture_tgrp_t1', name: 'Fixture Tier 1', size: 1, foundation: { kind: 'wood', skill: 'construction' },
        shop: { price: [{ itemId: WOOD, quantity: 30 }], section: 'smithing', group: 'Fixture Tier Group' }
    },
    fixture_tgrp_t2: {
        id: 'fixture_tgrp_t2', name: 'Fixture Tier 2', size: 1, foundation: { kind: 'wood', skill: 'construction', tier: 2 },
        shop: { price: [{ itemId: WOOD, quantity: 9 }], section: 'smithing', group: 'Fixture Tier Group' }
    }
});

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    EngineBootstrap.createDefaultGameData();
    // The Hall alone and an empty Bank: a new game minus the starter set and
    // opening items (Token Lifecycle 10.1), which these tests do not count.
    for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
    GameState.state.inventory.items = {};
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
});

const hall = () => BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

describe('the catalogue', () => {
    it('lists only Tokens with a shop block, grouped by section, General last', () => {
        const groups = Shop.catalogue();
        const all = groups.flatMap(g => g.items.map(i => i.typeId));
        expect(all).toContain('fixture_shop_forest');
        expect(all).toContain('fixture_shop_bench');
        expect(all).not.toContain('fixture_not_sold');

        const forestry = groups.find(g => g.section === 'forestry');
        expect(forestry.items.map(i => i.typeId)).toContain('fixture_shop_forest');
        expect(groups[groups.length - 1].section).toBe('general');
        expect(groups[groups.length - 1].name).toBe('General');
    });

    it('shows a group as one entry, options cheapest first, and leaves ungrouped Tokens alone', () => {
        const forestry = Shop.catalogue().find(g => g.section === 'forestry');
        const groupEntries = forestry.items.filter(i => i.group);
        expect(groupEntries).toHaveLength(1);
        const [entry] = groupEntries;
        expect(entry.group).toBe('Fixture Group');
        expect(entry.name).toBe('Fixture Group');
        expect(entry.options.map(o => o.typeId)).toEqual(['fixture_grp_small', 'fixture_grp_big']);
        expect(entry.typeId).toBe('fixture_grp_small');
        const all = Shop.catalogue().flatMap(g => g.items);
        // The members are not also listed on their own.
        expect(all.filter(i => i.typeId === 'fixture_grp_big' && !i.options)).toHaveLength(0);
        const forest = all.find(i => i.typeId === 'fixture_shop_forest');
        expect(forest.options).toBeUndefined();
        expect(forest.group).toBeUndefined();
    });

    it('a group of Foundations lists its options by Foundation tier, not by price', () => {
        const entry = Shop.catalogue().flatMap(g => g.items).find(i => i.group === 'Fixture Tier Group');
        expect(entry.options.map(o => o.typeId)).toEqual(['fixture_tgrp_t1', 'fixture_tgrp_t2', 'fixture_tgrp_t3']);
        expect(entry.typeId).toBe('fixture_tgrp_t1');
    });

    it('each option is gated by its own price only', () => {
        InventoryManager.addItem(WOOD, 5);
        const entry = Shop.catalogue().flatMap(g => g.items).find(i => i.group);
        expect(entry.options.find(o => o.typeId === 'fixture_grp_small').affordability.success).toBe(true);
        expect(entry.options.find(o => o.typeId === 'fixture_grp_big').affordability.success).toBe(false);
    });

    it('shows have / need against each price line', () => {
        InventoryManager.addItem(WOOD, 4);
        const [line] = Shop.priceLines('fixture_shop_forest');
        expect(line).toMatchObject({ itemId: WOOD, need: 10, have: 4, enough: false });
    });
});

describe('buying from a group', () => {
    it('buys the chosen option at the drop point, and its price only', () => {
        InventoryManager.addItem(WOOD, 25);
        const result = Shop.buyAt('fixture_grp_big', { x: 600, y: 600 });
        expect(result.success).toBe(true);
        expect(onMat('fixture_grp_big')).toHaveLength(1);
        expect(onMat('fixture_grp_small')).toHaveLength(0);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
    });
});

describe('buying', () => {
    it('takes the price and lands the Token beside the Guild Hall as placed', () => {
        InventoryManager.addItem(WOOD, 12);
        const before = MatCap.tokenCount();

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(2);

        const [forest] = onMat('fixture_shop_forest');
        expect(forest).toBeTruthy();
        expect(forest.origin).toBe('placed');
        expect(MatCap.tokenCount()).toBe(before + 1);

        const h = hall();
        const dist = Math.hypot(forest.x - h.x, forest.y - h.y);
        expect(dist).toBeLessThan(400);
    });

    it('with too little wood it refuses, names what is missing, and takes nothing', () => {
        InventoryManager.addItem(WOOD, 7);
        const check = Shop.canBuy('fixture_shop_forest');
        expect(check.success).toBe(false);
        expect(check.reason).toMatch(/3× /);

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(InventoryManager.getItemCount(WOOD)).toBe(7);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('is all or nothing across several items', () => {
        InventoryManager.addItem(WOOD, 5);
        const result = Shop.buy('fixture_shop_bench');
        expect(result.success).toBe(false);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
    });

    it('is refused at the mat cap, and takes nothing', () => {
        InventoryManager.addItem(WOOD, 50);
        placeAt('fixture_not_sold', 100, 100);
        setMatTuning('tokenCap', MatCap.tokenCount());
        expect(MatCap.matCap()).toBe(MatCap.tokenCount());
        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/full/i);
        expect(InventoryManager.getItemCount(WOOD)).toBe(50);
    });

    it('⭐ spawned Tokens count toward the cap too (T-102)', () => {
        InventoryManager.addItem(WOOD, 10);
        setMatTuning('tokenCap', MatCap.tokenCount() + 1);
        const spawned = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
        BoardState.addToken(spawned, 100, 100);
        const refused = Shop.buy('fixture_shop_forest');
        expect(refused.success).toBe(false);
        expect(refused.reason).toMatch(/Token cap full/);
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
    });

    it('⭐ the cap is 80 by default (T-102)', () => {
        expect(MatCap.BASE_TOKEN_CAP).toBe(80);
        expect(MatCap.matCap()).toBe(80);
    });

    it('refuses a Token that is not sold', () => {
        expect(Shop.buy('fixture_not_sold').success).toBe(false);
    });

    it('lands elsewhere on the mat when the area around the Hall is crowded (5.3)', () => {
        InventoryManager.addItem(WOOD, 25);
        const h = hall();
        const hallAt = { x: h.x, y: h.y };
        // Spawned Tokens packed 50 u apart out to 400 u round the Hall — far
        // past nudge reach — so no legal spot exists anywhere near it. The cap
        // is lifted: crowding is the point here, not the count.
        setMatTuning('tokenCap', 2000);
        let crowd = 0;
        for (let dx = -400; dx <= 400; dx += 50) {
            for (let dy = -400; dy <= 400; dy += 50) {
                if (Math.hypot(dx, dy) > 400) continue;
                const t = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, h.x + dx, h.y + dy);
                crowd++;
            }
        }
        const crowdPoints = BoardState.tokens().filter(t => t.typeId === 'fixture_not_sold').map(t => `${t.x},${t.y}`);

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(15); // paid once

        const [forest] = onMat('fixture_shop_forest');
        expect(forest.origin).toBe('placed');
        expect(Math.hypot(forest.x - hallAt.x, forest.y - hallAt.y)).toBeGreaterThan(400);
        // Nothing was pushed: the Hall and every crowding Token stayed put.
        expect({ x: hall().x, y: hall().y }).toEqual(hallAt);
        expect(onMat('fixture_not_sold')).toHaveLength(crowd);
        expect(onMat('fixture_not_sold').map(t => `${t.x},${t.y}`)).toEqual(crowdPoints);
    });

    it('refuses on a mat with no legal spot anywhere, and takes nothing (5.3)', () => {
        InventoryManager.addItem(WOOD, 25);
        // The whole mat packed 50 u apart with spawned Tokens, the cap lifted above them.
        setMatTuning('tokenCap', 2000);
        for (let x = 0; x <= 2000; x += 50) {
            for (let y = 0; y <= 1400; y += 50) {
                const t = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, x, y);
            }
        }
        expect(Shop.canBuy('fixture_shop_forest').success).toBe(true); // the cap is not the reason

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('The mat is full');
        expect(InventoryManager.getItemCount(WOOD)).toBe(25);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('reports the Token count against the cap', () => {
        placeAt('fixture_not_sold', 100, 100);
        const { count, cap } = Shop.capStatus();
        expect(count).toBe(MatCap.tokenCount());
        expect(cap).toBe(MatCap.matCap());
    });
});


/**
 * ⭐ B4: **buy by dragging onto the mat** — pay on drop, placed at the drop
 * point, nothing taken when the spot, the cap or the Bank says no.
 */
describe('buying at a point (B4)', () => {
    const SPOT = { x: 400, y: 300 };

    it('pays and places the Token at the drop point, as placed', () => {
        InventoryManager.addItem(WOOD, 12);
        const result = Shop.buyAt('fixture_shop_forest', SPOT);
        expect(result.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(2);
        const [forest] = onMat('fixture_shop_forest');
        expect({ x: forest.x, y: forest.y }).toEqual(SPOT);
        expect(forest.origin).toBe('placed');
    });

    it('a refused placement charges nothing and flies back (full)', () => {
        InventoryManager.addItem(WOOD, 25);
        // Pack the area round the spot far past nudge reach with spawned Tokens, the cap lifted.
        setMatTuning('tokenCap', 2000);
        for (let dx = -400; dx <= 400; dx += 50) {
            for (let dy = -300; dy <= 300; dy += 50) {
                const t = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, SPOT.x + dx, SPOT.y + dy);
            }
        }
        const result = Shop.buyAt('fixture_shop_forest', SPOT);
        expect(result.success).toBe(false);
        expect(result.full).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(25);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('is refused at the mat cap, and takes nothing', () => {
        InventoryManager.addItem(WOOD, 50);
        placeAt('fixture_not_sold', 1200, 900);
        setMatTuning('tokenCap', MatCap.tokenCount());
        const result = Shop.buyAt('fixture_shop_forest', SPOT);
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/full/i);
        expect(InventoryManager.getItemCount(WOOD)).toBe(50);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('is refused when the Bank is short, naming what is missing', () => {
        InventoryManager.addItem(WOOD, 4);
        const result = Shop.buyAt('fixture_shop_forest', SPOT);
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/6× /);
        expect(InventoryManager.getItemCount(WOOD)).toBe(4);
    });

    it('a point off the mat is refused as offMat, nothing taken', () => {
        InventoryManager.addItem(WOOD, 12);
        const result = Shop.buyAt('fixture_shop_forest', { x: -50, y: 300 });
        expect(result).toMatchObject({ success: false, offMat: true });
        expect(InventoryManager.getItemCount(WOOD)).toBe(12);
    });

    it('never restocks a copy it is dropped on: it is a new Token', () => {
        InventoryManager.addItem(WOOD, 25);
        expect(Shop.buyAt('fixture_shop_forest', SPOT).success).toBe(true);
        expect(Shop.buyAt('fixture_shop_forest', SPOT).success).toBe(true);
        expect(onMat('fixture_shop_forest')).toHaveLength(2);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
    });
});

describe('the mat drop route for a Shop row (B4)', () => {
    const payload = (typeId) => ({ kind: DRAG_KIND.TOKEN, typeId, from: { shop: typeId } });

    it('buys at the drop point', () => {
        InventoryManager.addItem(WOOD, 10);
        const res = dropOnMat(payload('fixture_shop_forest'), { x: 500, y: 350 });
        expect(res.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(0);
        const [forest] = onMat('fixture_shop_forest');
        expect({ x: forest.x, y: forest.y }).toEqual({ x: 500, y: 350 });
    });

    it('a refusal is announced, flies back, and makes nothing', () => {
        const res = dropOnMat(payload('fixture_shop_forest'), { x: 500, y: 350 });
        expect(res).toMatchObject({ success: false, flyBack: true });
        expect(NotificationSystem.warning).toHaveBeenCalledWith(expect.stringMatching(/Need/));
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('off the mat is a plain cancel: flown back, not announced', () => {
        InventoryManager.addItem(WOOD, 10);
        const res = dropOnMat(payload('fixture_shop_forest'), { x: -200, y: 350 });
        expect(res).toMatchObject({ success: false, flyBack: true });
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
    });
});
