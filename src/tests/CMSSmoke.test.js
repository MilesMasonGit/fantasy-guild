import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import App from '../../cms/src/App.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import MapEditor from '../../cms/src/components/editors/MapEditor.jsx';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import EffectBlocks from '../../cms/src/components/editors/EffectBlocks.jsx';
import {
    getPaletteEntry,
    modifierValueRange,
    clampModifierValue,
    describeModifierDirection
} from '../config/registries/modifierPalette.js';

/**
 * A smoke test for the CMS.
 *
 * ## Why this exists
 * `cms/src` had **no tests at all**, while carrying the 990-line
 * `EffectBlocks.jsx` and the Token editor the whole content pipeline goes
 * through. A typo in a component there broke nothing the suite could see: the
 * game's tests never import the CMS, and `npm run build` only builds the game.
 * The first symptom was a blank screen while authoring.
 *
 * ## What it does and does not claim
 * This is deliberately **shallow**. It asserts that the CMS's screens mount and
 * render without throwing, that the Token editor puts its sections on the page,
 * and that the effect editor can render every modifier shape the palette
 * declares. It does not test behaviour — that is a suite this file is not.
 *
 * Its job is to catch gross breakage (a bad import, a renamed export from the
 * game's registries, a component that throws on a normal Token) at the point
 * the change is made rather than in front of the author.
 */

// The CMS talks to its Vite dev plugin for file listings and sync. Nothing in
// this file exercises that, so stub it rather than let jsdom log failures.
const originalFetch = globalThis.fetch;

function resetStore() {
    useEntityStore.setState({
        items: {},
        tokens: {},
        maps: {},
        recipePools: {},
        activeEntityId: null,
        activeEntityType: null
    });
}

/** A Token with something in every section the editor renders. */
function seedToken() {
    const store = useEntityStore.getState();
    const itemId = store.addItem({ name: 'Raw Shrimp' });
    const tokenId = store.addToken({ name: 'Shrimp Coast', tags: ['Coast'] });

    useEntityStore.getState().setEffectBlocks(tokenId, [
        {
            target: 'token',
            targetToken: { mode: 'tag', value: 'Coast' },
            cost: null,
            provides: ['net'],
            modifiers: [
                { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 },
                { type: 'LOOT_MULT', bucket: 'flat', value: 10 },
                { type: 'BONUS_DROP', itemId, chance: 50, quantity: 1 }
            ]
        }
    ]);

    useEntityStore.getState().updateToken(tokenId, {
        acceptedTokens: [{ tag: 'net', minTier: 1 }]
    });

    return { tokenId, itemId };
}

describe('CMS smoke — the screens mount without throwing', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
        );
        resetStore();
    });

    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        resetStore();
    });

    it('renders the app shell with nothing selected', () => {
        const { container } = render(React.createElement(App));
        expect(container.textContent).toContain('Fantasy Guild CMS');
    });

    it('renders the Token editor for a fully populated Token', () => {
        const { tokenId } = seedToken();
        useEntityStore.getState().setActiveEntity(tokenId, 'token');

        const { container } = render(React.createElement(TokenEditor));
        const text = container.textContent;

        // The sections the Token editor is made of. If one disappears or a
        // component inside it throws, this notices.
        for (const heading of ['Identity', 'Effect Blocks', 'Lifecycle', 'Accepted Tokens / Tools']) {
            expect(text).toContain(heading);
        }
        expect(container.querySelectorAll('input').length).toBeGreaterThan(3);
    });

    it('renders the Item, Map and Recipe editors', () => {
        const store = useEntityStore.getState();
        const itemId = store.addItem({ name: 'Raw Shrimp' });
        const mapId = store.addMap({ name: 'Shrimp Coast Map' });

        useEntityStore.getState().setActiveEntity(itemId, 'item');
        expect(() => render(React.createElement(ItemEditor))).not.toThrow();
        cleanup();

        useEntityStore.getState().setActiveEntity(mapId, 'map');
        expect(() => render(React.createElement(MapEditor))).not.toThrow();
        cleanup();

        expect(() => render(React.createElement(RecipeEditor))).not.toThrow();
    });

    it('renders every modifier shape the palette declares', () => {
        const { tokenId } = seedToken();
        const token = useEntityStore.getState().tokens[tokenId];

        const { container } = render(React.createElement(EffectBlocks, { token }));
        const text = container.textContent;

        // One deterministic, one proc and one item modifier were seeded above.
        expect(text).toContain('Work Time');
        expect(text).toContain('Double Loot Chance');
        expect(text).toContain('Bonus Drop');
        // The target picker, showing the tag this block aims at.
        expect(container.querySelector('select')).toBeTruthy();

        // The seeded Work Time modifier is −0.05. Work Time is `inverted`, so
        // the editor must read that back as a buff rather than leaving the
        // author to remember which axis runs backwards.
        expect(text).toContain('5% less work time — a buff.');

        // Tag targeting: the tags already in use are offered for picking.
        expect(container.querySelector('#cms-known-token-tags')).toBeTruthy();
    });

    it('warns when a targeted tag matches no Token, and offers the right case', () => {
        const { tokenId } = seedToken();
        // The engine matches tags exactly, so "coast" reaches no Coast Token.
        useEntityStore.getState().setEffectBlocks(tokenId, [
            {
                target: 'token',
                targetToken: { mode: 'tag', value: 'coast' },
                cost: null,
                provides: [],
                modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.1 }]
            }
        ]);
        const token = useEntityStore.getState().tokens[tokenId];

        const { container } = render(React.createElement(EffectBlocks, { token }));
        expect(container.textContent).toContain('No Token carries the tag');
        expect(container.textContent).toContain('Did you mean');
    });
});

describe('Modifier value bounds and direction come from the palette', () => {
    const workTime = getPaletteEntry('WORK_TIME');     // deterministic, inverted
    const yieldEntry = getPaletteEntry('YIELD');       // deterministic, normal
    const failChance = getPaletteEntry('FAIL_CHANCE'); // proc

    it('leaves a deterministic effect unbounded, so a negative value is possible', () => {
        expect(modifierValueRange(workTime)).toEqual({ min: null, max: null });
        expect(clampModifierValue(workTime, -0.05)).toBe(-0.05);
    });

    it('still holds a proc between 0 and 100 — a chance has no negative side', () => {
        expect(modifierValueRange(failChance)).toEqual({ min: 0, max: 100 });
        expect(clampModifierValue(failChance, -10)).toBe(0);
        expect(clampModifierValue(failChance, 250)).toBe(100);
    });

    it('reads the sign against the effect, not in the abstract', () => {
        // Lower work time is faster, so the negative side is the buff…
        expect(describeModifierDirection(workTime, -0.05).isBuff).toBe(true);
        expect(describeModifierDirection(workTime, 0.05).isBuff).toBe(false);
        // …and on a normal axis it is the other way round.
        expect(describeModifierDirection(yieldEntry, 0.05).isBuff).toBe(true);
        expect(describeModifierDirection(yieldEntry, -0.05).isBuff).toBe(false);
    });

    it('says nothing when there is nothing to say', () => {
        expect(describeModifierDirection(workTime, 0)).toBeNull();
        expect(describeModifierDirection(failChance, 20)).toBeNull();
        expect(describeModifierDirection(null, 5)).toBeNull();
    });
});
