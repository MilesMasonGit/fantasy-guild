// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
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
import { listMaps } from '../config/registries/mapRegistry.js';
import { resetMissingContentWarnings } from '../utils/missingContent.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * spots 0 and 1 are 160 u apart, inside the shipped 164 u Near.
 */
const C = (i) => ({ x: 400 + i * 160, y: 200 });

/** The instance id of the Token standing on spot `i`, or null. */
const idAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0]?.id ?? null;

/**
 * One rule, one place.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

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
// the tile alert vocabulary
// ---------------------------------------------------------------------------

describe('CR2-060: every alert value comes from one enum', () => {
    it('unstocked went with the Managers (SP-55, 9.2)', () => {
        expect(ALERT.UNSTOCKED).toBeUndefined();
        expect(Object.values(ALERT)).not.toContain('unstocked');
    });

    it('every ALERT value has a hint and a label', () => {
        for (const value of Object.values(ALERT)) {
            expect(ALERT_HINT[value], `hint for ${value}`).toBeTruthy();
            expect(ALERT_LABEL[value], `label for ${value}`).toBeTruthy();
        }
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
        Placement.placeTokenAt(instance, C(0));
        BoardRunner.tick(100);

        const spurious = seen.filter(p => p.instanceId === idAt(0) && !p.alert);
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
// a Map's materials come from one projection
// ---------------------------------------------------------------------------

describe('CR2-196: Map materials have one display shape', () => {
    const withMaterials = listMaps().filter(m => (m.materials || []).length > 0);

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
// the Token fields the engine actually reads
// ---------------------------------------------------------------------------

describe('CR2-192: a Token\'s XP lives on config, nowhere else', () => {
    /**
     * ## ⚠️ This test was inverted on and here is why
     */
    const allTokenDefs = Object.values(getAllTokenTypes()).filter(
        d => String(d.id).startsWith('token_')
    );
    const noConfigTokens = allTokenDefs.filter(d => !d.config);

    it('no authored Token carries a top-level `xp` — the field is gone (CR2-192)', () => {
        const offenders = allTokenDefs.filter(d => d.xp !== undefined).map(d => d.id);
        expect(offenders, 'top-level `xp` is dead data the engine never reads').toEqual([]);
    });

    it('the drawer promises no XP for a Token the engine awards none for', () => {
        expect(noConfigTokens.length, 'no config-less Token to check').toBeGreaterThan(0);

        for (const def of noConfigTokens) {
            const { container } = render(
                React.createElement(
                    EngineContext.Provider,
                    { value: { EventBus } },
                    React.createElement(TokenInspection, { typeId: def.id })
                )
            );
            // `RecipeResolver`/`BoardRunner` read `config.xp`; with no config
            // there is nothing to award, so no XP badge may be drawn at all.
            // The badge renders as `<span>XP</span><span>+N</span>`, which
            // flattens to `XP+N` in `textContent`.
            expect(container.textContent, `${def.id} must promise no XP`)
                .not.toMatch(/XP\+\d/);
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
        //
        // `charges` was deleted from `data/tokens.json` on so no authored Token
        // carries it any more — this plants one, which is now the only way the
        // disagreement can be staged at all. `delete` (not reassignment)
        // restores the def: writing `undefined` back would leave the key
        // present and quietly defeat the `no top-level charges` reading of the
        // corpus elsewhere.
        const original = def.uses;
        expect(def.charges, 'the dead `charges` field is back in the corpus').toBeUndefined();
        def.uses = 7;
        def.charges = 9999;
        expect(tokenStartingUses(id)).toBe(7);
        def.uses = original;
        delete def.charges;
    });

    it('an unlimited Token is null, not zero (D-176)', () => {
        expect(tokenStartingUses('no_such_token_id')).toBeNull();
    });
});
