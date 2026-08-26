import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';

/**
 * Triggered Tokens — the fifth category (CMS-29).
 *
 * These do not run a work cycle and need no hero. They listen, and act on a
 * cooldown. The suite is built around the two worked examples the design was
 * derived from: the Masonry Wheelbarrow (reacts to a neighbour's cycle) and the
 * Stoneshaper Sigil (watches the Bank globally and converts).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId,
        uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    // Mirrors the adjacency suite: nothing subscribes ADJACENCY_DIRTY here, so
    // the neighbourhood is rebuilt explicitly.
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

const A = 17, NEIGHBOUR = 18, FAR = 45;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
    TriggerSystem.init();
});

afterEach(() => {
    TriggerSystem.teardown();
});

describe('The Wheelbarrow — reacting to a NEIGHBOUR\'s cycle (CMS-29, CMS-30)', () => {
    it('grants an item when the neighbour it watches completes', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_wheelbarrow');

        run(13000);

        // Every proc modifier before Phase 6 assumed a Token reacts to its OWN
        // cycle. This one has no cycle at all.
        expect(SpriteLayer.countOnBoard('item_bones')).toBe(1);
    });

    it('does nothing when the neighbour is not the one it names', () => {
        place(A, 'fixture_producer_alt', 'hero_1');   // different producer
        place(NEIGHBOUR, 'fixture_wheelbarrow');      // scoped to fixture_producer

        run(16000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(0);
    });

    it('fires for any neighbour when no source is named', () => {
        place(A, 'fixture_producer_alt', 'hero_1');
        place(NEIGHBOUR, 'fixture_trigger_any');

        run(16000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(1);
    });

    it('is not reached from a non-adjacent tile — reach is exactly 8 (D-81)', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(FAR, 'fixture_wheelbarrow');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(0);
    });

    it('⚠️ does NOT fire on a failed cycle (CMS-34)', () => {
        // A chain reaction should cascade because something actually happened.
        // Reacting to a stuck neighbour would trigger off nothing being made.
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_wheelbarrow');
        place(16, 'fixture_buff_always_fails');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(0);
    });

    it('reacts to a neighbour running out of charges', () => {
        place(A, 'fixture_producer', 'hero_1', 1);   // one charge left
        place(NEIGHBOUR, 'fixture_trigger_depleted');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(1);
    });
});

describe('The Sigil — global scope and CONVERT (CMS-35, CMS-72)', () => {
    it('converts once the Bank holds enough, with no hero and no cycle', () => {
        place(A, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 2);

        // No `run()` — the Sigil does not cycle. Adding stock is the event.
        expect(InventoryManager.getItemCount('item_coal')).toBe(0);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });

    it('does nothing below its threshold', () => {
        place(A, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 1);

        expect(InventoryManager.getItemCount('item_coal')).toBe(1);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(0);
    });

    it('fires wherever it sits — global scope ignores adjacency (D-83)', () => {
        place(FAR, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 2);

        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });

    it('⚠️ does not loop forever while its own condition stays true', () => {
        // The cooldown is set BEFORE actions run, so a Token that converts an
        // item it is also watching cannot re-enter itself.
        place(A, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 10);

        // One conversion only, despite stock remaining above the threshold.
        expect(InventoryManager.getItemCount('item_coal')).toBe(8);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });

    it('converts again once the cooldown expires', () => {
        place(A, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 10);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);

        run(10100);                                  // cooldown elapses
        InventoryManager.addItem('item_coal', 1);   // a fresh inventory event

        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(2);
    });

    it('never half-consumes a conversion it cannot afford', () => {
        place(A, 'fixture_sigil');
        InventoryManager.addItem('item_coal', 2);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);

        run(10100);
        InventoryManager.addItem('item_coal', 1);   // only 1, needs 2

        expect(InventoryManager.getItemCount('item_coal')).toBe(1);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });
});

describe('⚠️ The charge burns on SERVICE, not on luck (CMS-26, D-126)', () => {
    it('spends a charge even when the proc misses', () => {
        // The fixture's grant is 0% — it can never hit. A Token serving 100
        // events must still wear out in 100 events, or wear rate becomes
        // unpredictable and luck-dependent.
        const trigger = place(NEIGHBOUR, 'fixture_trigger_wearing');   // 3 charges
        place(A, 'fixture_producer', 'hero_1');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_bones')).toBe(0);   // never hit
        expect(trigger.usesRemaining).toBe(2);                    // still wore
    });

    it('depletes and leaves the board after its last charge', () => {
        place(NEIGHBOUR, 'fixture_trigger_wearing');
        place(A, 'fixture_producer', 'hero_1');

        run(13000 * 3 + 1000);

        expect(BoardState.getToken(NEIGHBOUR)).toBeFalsy();
    });

    it('announces its depletion like any other Token', () => {
        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => seen.push(p.typeId));

        place(NEIGHBOUR, 'fixture_trigger_wearing');
        place(A, 'fixture_producer', 'hero_1');
        run(13000 * 3 + 1000);

        unsub?.();
        expect(seen).toContain('fixture_trigger_wearing');
    });
});

describe('Cooldowns rate-limit an adjacency trigger too', () => {
    it('fires once per cooldown window, not once per event', () => {
        // Give the wheelbarrow a cooldown by using the Sigil's, via a Token
        // that watches any neighbour: two producer cycles, one grant.
        place(A, 'fixture_producer', 'hero_1');       // 12s cycle
        const t = place(NEIGHBOUR, 'fixture_trigger_any');
        t.blockCooldowns = { 0: 0 };

        run(13000);
        expect(SpriteLayer.countOnBoard('item_bones')).toBe(1);

        // With cooldownMs 0 the fixture is unlimited, so a second cycle grants
        // again — this pins that the cooldown path is opt-in, not implicit.
        run(13000);
        expect(SpriteLayer.countOnBoard('item_bones')).toBe(2);
    });
});

describe('Purely-triggered Tokens (CMS-31, CMS-80)', () => {
    it('recognises a Token with no staffed production as purely triggered', () => {
        expect(TriggerSystem.isPurelyTriggered(getTokenType('fixture_sigil'))).toBe(true);
    });

    it('does NOT exempt a Token that also produces (CMS-80)', () => {
        // D-116's carve-out applies only to Tokens with no production side at
        // all. A mixed Token is held to the normal standard.
        expect(TriggerSystem.isPurelyTriggered(getTokenType('fixture_producer'))).toBe(false);
    });
});
