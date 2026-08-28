import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * The burst — the game's headline reward beat (D-142, D-155, CMS-129).
 *
 * ⚠️ These tests pin the *mechanics*. They cannot pin the thing the phase is
 * actually for: whether **exactly three things, one of them guaranteed to be a
 * Token** (CMS-129, superseding D-167's random 3–5 range) **feels** like a
 * reward. D-167's presentation half survives untouched: the spectacle rests on
 * presentation rather than volume, and if it reads flat the lever is
 * presentation first and volume second — a judgement only made by watching it.
 *
 * ⚠️ **Some paths here are fixture-proven only.** Every entry in every shipped
 * Map pool is `kind: "token"`, so shipped content cannot exercise the mixed
 * pool, the token-less pool, or the renormalisation of slot one's weights.
 * Those three cases use `FIXTURE_MAPS` below, injected through a partial mock
 * of the Map registry. Stated plainly rather than left to be discovered.
 *
 * ⚠️ **The Map ids here changed on 2026-08-28 (P1).** The helper used to build
 * `token_map_woodland` and roll `map_woodland`; **neither id exists.** The
 * Token id fell through `openMap`'s fallback chain to `map_guild_hall`, so the
 * Tray suite was bursting the scripted tutorial and asserting on its single
 * drop, and `rollBurst('map_woodland')` returned `[]` at its first guard, which
 * made the D-154 probe vacuous. Both now point at `map_test_map`, which exists
 * and has an eight-entry all-Token pool.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Pools that shipped content cannot provide (S12: every shipped pool entry is a
 * Token). Injected by the registry mock below; real Maps are untouched.
 */
// `vi.hoisted` because `vi.mock`'s factory is hoisted above ordinary consts and
// would otherwise see this as undefined.
const { FIXTURE_MAPS } = vi.hoisted(() => ({ FIXTURE_MAPS: {
    // Tokens, a raw item and gold together — the only way to prove slot one
    // filters on `kind === 'token'` rather than on "not gold" or "not an item".
    map_fixture_mixed: {
        id: 'map_fixture_mixed', name: 'Mixed Fixture', price: 1, materials: [],
        pool: [
            { kind: 'token', refId: 'token_forest', weight: 10 },
            { kind: 'item', refId: 'item_oak_wood', weight: 500, quantity: 3 },
            { kind: 'gold', refId: 'gold_pile', weight: 500, amount: 100 }
        ]
    },
    // Two Tokens at 30/10 behind a very heavy item: slot one must land ~75/25
    // between the Tokens and never on the item.
    map_fixture_weighted: {
        id: 'map_fixture_weighted', name: 'Weighted Fixture', price: 1, materials: [],
        pool: [
            { kind: 'token', refId: 'token_forest', weight: 30 },
            { kind: 'token', refId: 'token_campfire', weight: 10 },
            { kind: 'item', refId: 'item_oak_wood', weight: 960, quantity: 1 }
        ]
    },
    // Token entries present but all carrying zero weight — authorable in the
    // CMS, and a hole the first cut of CMS-129 fell through: the Token subset
    // is non-empty, so a length check alone would try to draw from it, get
    // nothing, and hand back a two-thing burst with no Token in it.
    map_fixture_zero_weight_tokens: {
        id: 'map_fixture_zero_weight_tokens', name: 'Zero-weight Fixture', price: 1, materials: [],
        pool: [
            { kind: 'token', refId: 'token_forest', weight: 0 },
            { kind: 'item', refId: 'item_oak_wood', weight: 10, quantity: 1 }
        ]
    },
    // No Token at all — the documented fallback to three free draws.
    map_fixture_tokenless: {
        id: 'map_fixture_tokenless', name: 'Tokenless Fixture', price: 1, materials: [],
        pool: [
            { kind: 'item', refId: 'item_oak_wood', weight: 10, quantity: 1 },
            { kind: 'gold', refId: 'gold_pile', weight: 10, amount: 50 }
        ]
    }
} }));

vi.mock('../config/registries/mapRegistry.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMap: (mapId) => FIXTURE_MAPS[mapId] || actual.getMap(mapId)
    };
});

const TEST_MAP = 'map_test_map';

/** A Map Token instance, as bought. `token_test_map` carries `map_test_map`. */
function aMap(typeId = 'token_test_map') {
    return BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.inventory.maxSlots = 50;
    // Auto-collect would tidy the burst away before it could be counted.
    GameState.state.settings = { ...(GameState.state.settings || {}), autoCollect: false };
});

describe('Opening from the Tray (D-155)', () => {
    it('populates the Tray directly with tokens when opened in the Tray', () => {
        const result = Cartographer.openMap(aMap(), 'tray');

        expect(result.success).toBe(true);
        const tokenEntries = result.contents.filter(e => e.kind === 'token');
        const itemEntries = result.contents.filter(e => e.kind === 'item');

        // Tokens that fit into Tray are in the Tray
        expect(BoardState.getTray().length).toBe(tokenEntries.length);
        // Items scatter onto the board as sprites
        expect(SpriteLayer.getSprites().length).toBe(itemEntries.length);
    });

    it('scatters excess tokens onto the board as sprites when the Tray is full', () => {
        // Fill Tray to max capacity
        while (BoardState.getTray().length < BoardState.TRAY_CAPACITY) {
            BoardState.addToTray(BoardState.createTokenInstance('token_forest', 100));
        }
        expect(BoardState.hasTraySpace()).toBe(false);

        const result = Cartographer.openMap(aMap(), 'tray');
        expect(result.success).toBe(true);
        // All burst contents land as sprites because Tray has no room
        expect(SpriteLayer.getSprites().length).toBe(result.contents.length);
    });

});

describe('Maps freely sit overtop of the playmat (D-155)', () => {
    it('bursts open from exact pixel coordinates of a free-sitting map', () => {
        const pixelOrigin = { x: 300, y: 400 };
        const result = Cartographer.openMap(aMap(), pixelOrigin);

        expect(result.success).toBe(true);
        const sprites = SpriteLayer.getSprites();
        expect(sprites.length).toBeGreaterThan(0);
        for (const s of sprites) {
            expect(s.fromX).toBe(364); // 300 + 128 / 2
            expect(s.fromY).toBe(464); // 400 + 128 / 2
        }
    });

});

describe('Discovery is driven by the burst, not the purchase (D-159)', () => {
    it('marks what actually came out, and reports the first sightings', () => {
        const result = Cartographer.openMap(aMap(), null);

        for (const entry of result.contents) {
            expect(Cartographer.isDiscovered(entry.refId)).toBe(true);
        }
        // Everything in the first burst is new by definition.
        expect(new Set(result.firstSeen).size).toBe(new Set(result.contents.map(c => c.refId)).size);
    });

    it('reports a repeat sighting as not-first', () => {
        Cartographer.markDiscovered('token_forest');
        const result = Cartographer.openMap(aMap(), null);
        expect(result.firstSeen).not.toContain('token_forest');
    });
});

describe('Bursts are random with no reliability guarantee (D-154)', () => {
    it('⚠️ can hand the player a burst without the Token they came for', () => {
        // A genuine accepted cost, recorded as risk 16. Its two mitigations
        // arrive elsewhere — selling (D-146, built) and crafting (D-144, later)
        // — so the exposure is the first hour. This test exists to make the
        // exposure explicit rather than to assert it is fine.
        //
        // ⚠️ **Narrowed by CMS-129, not retired.** Slot one now guarantees *a*
        // Token, so "a burst with no producer at all" is no longer possible on
        // a Token-bearing pool and asserting it would be dishonest. What
        // survives is the part D-154 was actually about: the guarantee does not
        // extend to *which* Token, so the Map can miss the one you wanted.
        //
        // (Before P1 this probe rolled `map_woodland`, an id that does not
        // exist. `rollBurst` returned `[]` at its first guard and `[].some()`
        // is false, so it passed on iteration one without ever rolling a
        // burst. It has never tested D-154 until now.)
        const WANTED = 'token_coal_vein'; // one of map_test_map's eight entries
        let sawABurstWithoutIt = false;
        for (let i = 0; i < 200 && !sawABurstWithoutIt; i++) {
            const contents = Cartographer.rollBurst(TEST_MAP);
            expect(contents.length).toBe(3); // it really is rolling now
            if (!contents.some(e => e.refId === WANTED)) sawABurstWithoutIt = true;
        }
        expect(sawABurstWithoutIt).toBe(true);
    });
});

describe('A burst is exactly 3, and slot one is a Token (CMS-129)', () => {
    it('always yields exactly three things, over many rolls', () => {
        for (let i = 0; i < 300; i++) {
            expect(Cartographer.rollBurst(TEST_MAP).length).toBe(Cartographer.BURST_SIZE);
        }
        expect(Cartographer.BURST_SIZE).toBe(3);
    });

    it('leads with a Token on a mixed pool of Tokens, items and gold', () => {
        // Fixture-proven: no shipped pool has a non-Token entry. The item and
        // gold entries carry 500 weight each against the Token's 10, so a free
        // draw would put a non-Token first almost every time.
        for (let i = 0; i < 300; i++) {
            const contents = Cartographer.rollBurst('map_fixture_mixed');
            expect(contents.length).toBe(3);
            expect(contents[0].kind).toBe('token');
        }
    });

    it('leaves slots two and three free — the guarantee is "at least one"', () => {
        let sawANonTokenAfterSlotOne = false;
        for (let i = 0; i < 300 && !sawANonTokenAfterSlotOne; i++) {
            const contents = Cartographer.rollBurst('map_fixture_mixed');
            if (contents.slice(1).some(e => e.kind !== 'token')) sawANonTokenAfterSlotOne = true;
        }
        expect(sawANonTokenAfterSlotOne).toBe(true);
    });

    it('renormalises slot one among the Tokens, preserving their relative weights', () => {
        // Two Tokens at 30 and 10 behind an item at 960. Renormalised among the
        // Tokens alone that is 75/25; a whole-pool draw would be 3%/1%/96%.
        const RUNS = 4000;
        const counts = { token_forest: 0, token_campfire: 0, other: 0 };
        for (let i = 0; i < RUNS; i++) {
            const first = Cartographer.rollBurst('map_fixture_weighted')[0];
            if (counts[first.refId] === undefined) counts.other++;
            else counts[first.refId]++;
        }
        expect(counts.other).toBe(0); // the heavy item never wins slot one
        // Tolerance band, not an exact ratio — this is a random draw.
        expect(counts.token_forest / RUNS).toBeGreaterThan(0.71);
        expect(counts.token_forest / RUNS).toBeLessThan(0.79);
        expect(counts.token_campfire / RUNS).toBeGreaterThan(0.21);
        expect(counts.token_campfire / RUNS).toBeLessThan(0.29);
    });

    it('falls back to three free draws on a pool with no Token in it', () => {
        // Must not crash, hang, or return short. Warning about such a pool is
        // P7's CMS Map check's job, not the roller's — that check is not built
        // yet.
        for (let i = 0; i < 100; i++) {
            const contents = Cartographer.rollBurst('map_fixture_tokenless');
            expect(contents.length).toBe(3);
            expect(contents.every(e => e.kind !== 'token')).toBe(true);
        }
    });

    it('⚠️ cannot guarantee a Token when every Token entry has zero weight', () => {
        // A `weight: 0` Token is undrawable by definition, so the subset is
        // non-empty but unusable and slot one degrades to a free draw. This
        // pins the **limit** of CMS-129's guarantee rather than the guarantee:
        // the count still holds at three, and the missing Token is a content
        // mistake for P7's Map check to warn about, not something the roller
        // can repair. Documented so nobody reads the guarantee as absolute.
        let sawABurstWithNoToken = false;
        for (let i = 0; i < 100; i++) {
            const contents = Cartographer.rollBurst('map_fixture_zero_weight_tokens');
            expect(contents.length).toBe(3);
            if (!contents.some(e => e.kind === 'token')) sawABurstWithNoToken = true;
        }
        expect(sawABurstWithNoToken).toBe(true);
    });

    it('⚠️ exempts the Guild Hall tutorial — owner ruling 24', () => {
        // CMS-129 governs weighted pool bursts. The Guild Hall's ten scripted
        // single drops keep their authored pacing deliberately. Pinned here so
        // a later agent cannot silently "fix" it to three.
        const first = Cartographer.rollBurst('map_guild_hall');
        const second = Cartographer.rollBurst('map_guild_hall');

        expect(first.length).toBe(1);
        expect(second.length).toBe(1);
        expect(first[0].refId).toBe('token_campfire');    // sequence step 1
        expect(second[0].refId).toBe('token_redberry_bush'); // step 2
    });
});

describe('Coins floor loot collection', () => {
    it('credits gold directly to player currency balance and does not consume inventory slots', () => {
        const initialGold = GameState.state.currency.gold || 0;

        const sprite = SpriteLayer.addSprite('item', 'item_coins', 2000, { x: 0.5, y: 0.5 });
        expect(sprite).toBeDefined();
        expect(sprite.refId).toBe('item_coins');
        expect(sprite.quantity).toBe(2000);

        const collected = SpriteLayer.collectSprite(sprite.id);
        expect(collected).toBe(true);
        expect(GameState.state.currency.gold).toBe(initialGold + 2000);
        expect(InventoryManager.getItemCount('item_coins')).toBe(0);
    });
});
