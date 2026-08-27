import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MapInspection } from '../ui/components/drawer/MapInspection.jsx';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import * as Managers from '../systems/board/Managers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { ALERT_HINT, ALERT_LABEL } from '../ui/components/board/boardConstants.js';
import { InventoryFormatter } from '../systems/inventory/InventoryFormatter.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import { logger } from '../utils/Logger.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import { FIXTURE_TOKENS } from './fixtures/testTokens.js';
import { getAllTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getMap, listMaps } from '../config/registries/mapRegistry.js';
import { resetMissingContentWarnings } from '../utils/missingContent.js';

/**
 * One rule, one place.
 *
 * Every case here is a rule that used to be computed in more than one place,
 * with the copies quietly disagreeing. Each test is written to fail if the
 * second copy comes back — not merely to assert today's answer, which the
 * divergent versions also produced most of the time.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** The id of any authored Map Token, so a Map can be put in the Tray. */
function aMapTokenId() {
    const types = getAllTokenTypes();
    return Object.keys(types).find(id => types[id].mapId);
}

/** The id of any authored Token that is NOT a Map. */
function aPlainTokenId() {
    const types = getAllTokenTypes();
    return Object.keys(types).find(id => !types[id].mapId);
}

beforeEach(() => {
    GameState.initNew();
    resetMissingContentWarnings();
});

// ---------------------------------------------------------------------------
// CR2-054 — Tray capacity
// ---------------------------------------------------------------------------

describe('CR2-054: Tray capacity is one rule', () => {
    const mapId = aMapTokenId();
    const plainId = aPlainTokenId();

    /** Fill the Tray with `n` non-map Tokens, bypassing the capacity check. */
    function fillWithPlain(n) {
        const tray = GameState.state.board.tray;
        for (let i = 0; i < n; i++) {
            tray.push(BoardState.createTokenInstance(plainId, tokenStartingUses(plainId)));
        }
    }

    it('a Map in the Tray does not consume Tray capacity', () => {
        GameState.state.board.tray.push(
            BoardState.createTokenInstance(mapId, tokenStartingUses(mapId))
        );
        fillWithPlain(BoardState.TRAY_CAPACITY - 1);

        // Raw length is now at capacity, but one non-map slot is genuinely free.
        expect(BoardState.getTray().length).toBe(BoardState.TRAY_CAPACITY);
        expect(BoardState.nonMapTrayTokensCount()).toBe(BoardState.TRAY_CAPACITY - 1);
        expect(BoardState.hasTraySpace()).toBe(true);

        // The thing that actually decides — `addToTray` — accepts it. Any route
        // that refuses here is using a second, disagreeing rule.
        const added = BoardState.addToTray(
            BoardState.createTokenInstance(plainId, tokenStartingUses(plainId))
        );
        expect(added).toBe(true);
    });

    it('the Cartographer agrees with addToTray about a full Tray', () => {
        const map = listMaps().find(m => m.price === 0) || listMaps()[0];
        GameState.state.board.tray.push(
            BoardState.createTokenInstance(mapId, tokenStartingUses(mapId))
        );
        fillWithPlain(BoardState.TRAY_CAPACITY - 1);
        GameState.state.currency = { gold: 1_000_000 };

        // Not full by the one rule, so the purchase must not be refused for room.
        expect(BoardState.hasTraySpace()).toBe(true);
        const reason = Cartographer.canBuy(map.id).reason || '';
        expect(reason).not.toMatch(/No room in the Tray/);

        // Now genuinely full by the one rule, and it must refuse.
        fillWithPlain(1);
        expect(BoardState.hasTraySpace()).toBe(false);
        expect(Cartographer.canBuy(map.id).reason).toMatch(/No room in the Tray/);
    });

    it('hasTraySpaceFor counts the whole batch a cascade would displace', () => {
        fillWithPlain(BoardState.TRAY_CAPACITY - 2);
        expect(BoardState.hasTraySpaceFor(1)).toBe(true);
        expect(BoardState.hasTraySpaceFor(2)).toBe(true);
        expect(BoardState.hasTraySpaceFor(3)).toBe(false);
    });

    it('TRAY_CAPACITY is 48 — the comment that said 18 was wrong', () => {
        expect(BoardState.TRAY_CAPACITY).toBe(48);
    });
});

// ---------------------------------------------------------------------------
// CR2-059 / CR2-060 — the tile alert vocabulary
// ---------------------------------------------------------------------------

describe('CR2-060: every alert value comes from one enum', () => {
    it('unstocked is an ALERT value, not a hand-written string', () => {
        expect(ALERT.UNSTOCKED).toBe('unstocked');
    });

    it('every ALERT value has a hint and a label', () => {
        for (const value of Object.values(ALERT)) {
            expect(ALERT_HINT[value], `hint for ${value}`).toBeTruthy();
            expect(ALERT_LABEL[value], `label for ${value}`).toBeTruthy();
        }
    });

    it('Managers publishes the alert once, on the transition into unstocked', () => {
        // A tile with a Manager beside it that manages a type the Vault has no
        // copy of: `restockTile` takes the unstocked branch every sweep.
        const managed = aPlainTokenId();
        const MANAGER = 'fixture_one_rule_manager';
        getAllTokenTypes()[MANAGER] = {
            id: MANAGER, name: 'Fixture Manager', tokenType: 'manager',
            manages: [managed], requiresHero: false
        };

        BoardState.setToken(1, BoardState.createTokenInstance(MANAGER, null));
        const vacancy = { typeId: managed, unstocked: false };

        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, p => seen.push(p));

        expect(Managers.restockTile(0, vacancy)).toBe('unstocked');
        expect(vacancy.unstocked).toBe(true);
        expect(seen).toHaveLength(1);
        expect(seen[0].alert).toBe(ALERT.UNSTOCKED);

        // The sweep retries on a throttle. The mark is already showing, so
        // nothing has changed and nothing more may be published (CR2-060).
        expect(Managers.restockTile(0, vacancy)).toBe('unstocked');
        expect(Managers.restockTile(0, vacancy)).toBe('unstocked');
        expect(seen).toHaveLength(1);

        unsub?.();
        delete getAllTokenTypes()[MANAGER];
    });
});

describe('CR2-059: an alert only re-publishes on a real change', () => {
    it('a freshly placed working Token publishes no alert at all', () => {
        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, p => seen.push(p));

        // `createTokenInstance` leaves `alert` undefined. The runner then calls
        // its clear path with `null`, and `undefined === null` is false — so the
        // unnormalised comparison published a "changed to null" event for a
        // Token whose alert never existed, on every such Token, every time.
        const instance = BoardState.createTokenInstance('fixture_passive', null);
        expect(instance.alert).toBeUndefined();
        Placement.placeToken(0, instance);
        BoardRunner.tick(100);

        const spurious = seen.filter(p => p.tile === 0 && !p.alert);
        expect(spurious).toHaveLength(0);
        unsub?.();
    });
});

describe('CR2-107: the inventory sort survives half-authored content', () => {
    const NAMELESS = 'test_one_rule_nameless';

    beforeEach(() => {
        InventoryManager.init();
        InventoryFormatter._displayCache = null;
        InventoryFormatter._itemReferenceMap = {};
    });

    it('sorts a nameless template by its id instead of throwing', () => {
        // A real template with no name — exactly what an id rename or a
        // half-finished CMS row leaves behind.
        ITEMS[NAMELESS] = { id: NAMELESS, itemType: 'material' };
        try {
            // Several named neighbours, and the nameless one in the middle, so
            // the sort is certain to pass it as the LEFT operand. `a.name` was
            // read straight; `undefined.localeCompare` is the throw, while
            // `'x'.localeCompare(undefined)` quietly compares against the
            // string "undefined" — so a two-item list could pass by luck.
            const named = Object.keys(ITEMS)
                .filter(id => id !== NAMELESS && ITEMS[id]?.name)
                .slice(0, 5);
            expect(named.length).toBeGreaterThan(1);

            const items = {};
            named.forEach((id, i) => {
                if (i === 1) items[NAMELESS] = { quantity: 1, dur: null };
                items[id] = { quantity: 1, dur: null };
            });
            GameState.state.inventory.items = items;

            expect(() => InventoryFormatter.getDisplayInventory()).not.toThrow();
            const ids = InventoryFormatter.getDisplayInventory().map(e => e.id);
            expect(ids).toContain(NAMELESS);
            expect(ids).toHaveLength(named.length + 1);
        } finally {
            delete ITEMS[NAMELESS];
        }
    });

    it('says so when a held stack has no template at all', () => {
        GameState.state.inventory.items = {
            item_no_such_thing_at_all: { quantity: 3, dur: null }
        };
        const warned = [];
        const spy = vi.spyOn(logger, 'warn').mockImplementation((...a) => warned.push(a));

        expect(InventoryFormatter.getDisplayInventory()).toHaveLength(0);
        expect(warned.length).toBeGreaterThan(0);
        expect(warned[0].join(' ')).toMatch(/item_no_such_thing_at_all/);
        spy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// CR2-196 — a Map's materials come from one projection
// ---------------------------------------------------------------------------

describe('CR2-196: Map materials have one display shape', () => {
    const withMaterials = listMaps().filter(m => (m.materials || []).length > 0);

    it('at least one authored Map still has materials to draw', () => {
        expect(withMaterials.length).toBeGreaterThan(0);
    });

    it('mapMaterials resolves an itemId and a name for every entry', () => {
        for (const def of withMaterials) {
            for (const m of Cartographer.mapMaterials(def.id)) {
                expect(m.itemId, `${def.id} material itemId`).toBeTruthy();
                expect(m.name, `${def.id} material name`).toBeTruthy();
                expect(typeof m.quantity).toBe('number');
            }
        }
    });

    it('the keys the panels render with are present and unique', () => {
        for (const def of withMaterials) {
            const keys = Cartographer.mapMaterials(def.id).map(m => m.itemId);
            expect(keys.every(Boolean), `${def.id} has a keyless material`).toBe(true);
            expect(new Set(keys).size, `${def.id} has duplicate keys`).toBe(keys.length);
        }
    });

    it('the catalogue and the inspection panel read the same projection', () => {
        for (const entry of Cartographer.catalogue()) {
            expect(entry.materials).toEqual(Cartographer.mapMaterials(getMap(entry.id)));
        }
    });

    it('the inspection panel names the material instead of drawing "Unknown"', () => {
        const def = withMaterials[0];
        const expected = Cartographer.mapMaterials(def.id);
        const { container } = render(
            React.createElement(MapInspection, { mapId: def.id })
        );
        const text = container.textContent;
        expect(text).toContain('Required Materials');
        for (const m of expected) {
            expect(text, `${def.id} should name ${m.itemId}`).toContain(m.name);
        }
        expect(text).not.toContain('Unknown');

        // And the panel must be reading the shared projection, not the raw
        // registry: the raw entries carry no `name`, so a panel that reads them
        // has nothing to render but "Unknown" (CR2-196).
        for (const raw of def.materials) expect(raw.name).toBeUndefined();
        cleanup();
    });

    it('the raw registry shape has no `id` — which is why `m.id` drew Unknown', () => {
        for (const def of withMaterials) {
            for (const m of def.materials) {
                expect(m.id).toBeUndefined();
                expect(m.itemId).toBeTruthy();
            }
        }
    });
});

// ---------------------------------------------------------------------------
// CR2-192 / CR2-121 — the Token fields the engine actually reads
// ---------------------------------------------------------------------------

describe('CR2-192: a Token\'s XP lives on config, nowhere else', () => {
    /**
     * Tokens the drawer used to promise XP for that the engine cannot award.
     *
     * `??` already handles the `config.xp: 0` case correctly — 0 is not nullish,
     * so the old fallback never reached past it. The Tokens that actually lied
     * are the ones with **no `config` at all**: 23 of the 39 authored, every one
     * carrying the CMS's top-level `xp: 10`.
     */
    const noConfigWithTopLevelXp = Object.values(getAllTokenTypes()).filter(
        d => !d.config && d.xp !== undefined && d.xp > 0 && String(d.id).startsWith('token_')
    );

    it('the drawer promises no XP for a Token the engine awards none for', () => {
        expect(noConfigWithTopLevelXp.length).toBeGreaterThan(0);

        for (const def of noConfigWithTopLevelXp) {
            const { container } = render(
                React.createElement(
                    EngineContext.Provider,
                    { value: { EventBus } },
                    React.createElement(TokenInspection, { typeId: def.id })
                )
            );
            // `RecipeResolver`/`BoardRunner` read `config.xp`; with no config
            // there is nothing to award, so nothing may be promised.
            expect(container.textContent, `${def.id} must not promise +${def.xp} XP`)
                .not.toContain(`+${def.xp}`);
            cleanup();
        }
    });

    it('a Token with config.xp still shows it', () => {
        const withXp = Object.values(getAllTokenTypes()).find(
            d => d.config?.xp > 0 && String(d.id).startsWith('token_')
        );
        expect(withXp, 'no authored Token awards XP').toBeTruthy();
        const { container } = render(
            React.createElement(
                EngineContext.Provider,
                { value: { EventBus } },
                React.createElement(TokenInspection, { typeId: withXp.id })
            )
        );
        expect(container.textContent).toContain(`+${withXp.config.xp}`);
        cleanup();
    });

    it('no authored Token puts skill or skillRequired at the top level', () => {
        const types = getAllTokenTypes();
        for (const [id, def] of Object.entries(types)) {
            expect(def.skill, `${id} top-level skill`).toBeUndefined();
            expect(def.skillRequired, `${id} top-level skillRequired`).toBeUndefined();
            expect(def.xpAwarded, `${id} top-level xpAwarded`).toBeUndefined();
        }
    });
});

describe('CR2-121: `uses` is the charge field, `charges` is not read', () => {
    it('tokenStartingUses reads `uses` and ignores a disagreeing `charges`', () => {
        const types = getAllTokenTypes();
        const [id, def] = Object.entries(types).find(([, d]) => d.uses != null) || [];
        expect(id, 'no authored Token has `uses`').toBeTruthy();
        expect(tokenStartingUses(id)).toBe(def.uses);

        // Prove it is `uses` and not `charges` doing the work.
        const original = def.uses;
        const originalCharges = def.charges;
        def.uses = 7;
        def.charges = 9999;
        expect(tokenStartingUses(id)).toBe(7);
        def.uses = original;
        def.charges = originalCharges;
    });

    it('an unlimited Token is null, not zero (D-176)', () => {
        expect(tokenStartingUses('no_such_token_id')).toBeNull();
    });
});
