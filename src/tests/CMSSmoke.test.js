import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import App from '../../cms/src/App.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import MapEditor from '../../cms/src/components/editors/MapEditor.jsx';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import Statements, { StatementList } from '../../cms/src/components/editors/Statements.jsx';
import AuditPanel from '../../cms/src/components/audit/AuditPanel.jsx';
import SettingsModal from '../../cms/src/components/shared/SettingsModal.jsx';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
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

/**
 * A Token with a rule of every shape the editor renders.
 *
 * This is the owner's own worked case: a Shrimp Coast that speeds up other
 * Coast Tokens, acts as a net, grants an extra shrimp, and needs a net beside
 * it to be worked at all.
 */
function seedToken() {
    const store = useEntityStore.getState();
    const itemId = store.addItem({ name: 'Raw Shrimp' });
    const tokenId = store.addToken({ name: 'Shrimp Coast', tags: ['Coast'] });

    // ⚠️ The rules live in a named library entry, not on the Token (Unified
    // Effects P1). The Token references it; the entry is what carries the
    // statements and what the rules editor edits.
    const effectId = useEntityStore.getState().addEffect({
        name: 'Shrimp Trawler',
        statements: [
        {
            id: 'stm_a', keyword: 'provides',
            to: { mode: 'tag', value: 'Coast' },
            payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 }
        },
        {
            id: 'stm_b', keyword: 'provides',
            to: { mode: 'all' },
            payload: { type: 'LOOT_MULT', bucket: 'flat', value: 10 }
        },
        {
            id: 'stm_c', keyword: 'grants',
            to: { mode: 'all' },
            payload: { type: 'BONUS_DROP', itemId, chance: 50, quantity: 1 }
        },
        {
            id: 'stm_d', keyword: 'acts_as',
            payload: { tag: 'net', tier: 1 }
        },
        {
            id: 'stm_e', keyword: 'station',
            payload: { skill: 'cooking' }
        }
        ],
    });

    useEntityStore.getState().addEffectRef('tokens', tokenId, effectId);

    useEntityStore.getState().updateToken(tokenId, {
        acceptedTokens: [{ tag: 'net', minTier: 1 }]
    });

    return { tokenId, itemId, effectId };
}

/** The statements a seeded library entry holds, as the editor sees them. */
function statementsOfEffect(effectId) {
    return useEntityStore.getState().effects[effectId].statements;
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
        for (const heading of ['Identity', 'Tags', 'Rules', 'Rules Text', 'Lifecycle']) {
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

    /**
     * The Map check's surfaces (phase P7).
     *
     * The Map table renders from `mapReports`, which only exists after a
     * Recalculate — so both states matter: the empty prompt, and a table with
     * a passing Map, a failing Map and a skipped one in it.
     */
    it('renders the Map Economics table and the Map dial editors', () => {
        useSimulationStore.setState({ mapReports: [], lastRunTimestamp: null });
        expect(() => render(React.createElement(AuditPanel, { openGenerate: () => {} }))).not.toThrow();
        cleanup();

        useSimulationStore.setState({
            lastRunTimestamp: Date.now(),
            mapReports: [
                {
                    id: 'fixture_map_pass', name: 'Fixture Pass', level: 12, cost: 1000,
                    scrapBudget: 400, scrapSide: 300, scrapBound: 400,
                    productiveSide: 12000, productiveBound: 9000,
                    scrapRich: false, underwater: false, pass: true, entries: [],
                },
                {
                    id: 'fixture_map_fail', name: 'Fixture Fail', level: 3, cost: 200,
                    scrapBudget: 80, scrapSide: 240, scrapBound: 80,
                    productiveSide: 100, productiveBound: 1900,
                    scrapRich: true, underwater: true, pass: false, entries: [],
                },
                { id: 'fixture_map_hall', name: 'Fixture Hall', skipped: 'guild-hall', entries: [] },
            ],
        });

        const { container } = render(React.createElement(AuditPanel, { openGenerate: () => {} }));
        expect(container.textContent).toContain('Map Economics');
        cleanup();

        expect(() => render(React.createElement(SettingsModal, { isOpen: true, onClose: () => {} }))).not.toThrow();
        useSimulationStore.setState({ mapReports: [], lastRunTimestamp: null });
    });

    it('renders a row for every keyword, with the effect shapes the palette declares', () => {
        const { tokenId, effectId } = seedToken();

        // The statement rows belong to the library entry now; `Requires` is the
        // one rule that is still a Token field (`acceptedTokens`, owner Q5), so
        // it is asserted on the Token's own rules panel below.
        const { container } = render(React.createElement(StatementList, {
            statements: statementsOfEffect(effectId),
            onChange: () => {},
        }));
        const text = container.textContent;

        // One deterministic, one proc, one item grant, one capability — each a
        // line whose decision words can be clicked. (Rules Line P4 deleted the
        // per-keyword forms that used to print "Work Time" and render a select.)
        expect(container.querySelectorAll('[data-rules-line]')).toHaveLength(5);
        expect(container.querySelector('[data-rules-line] [data-slot="type"]')).toBeTruthy();
        expect(text).toContain('Acts as');

        const token = useEntityStore.getState().tokens[tokenId];
        const tokenRules = render(React.createElement(Statements, { token }));
        expect(tokenRules.container.textContent).toContain('Requires');

        // The seeded Work Time value is −0.05. Work Time is `inverted`, so the
        // editor must read that back as a buff rather than leaving the author
        // to remember which axis runs backwards.
        expect(text).toContain('5% less work time — a buff.');

        /**
         * Tag suggestions are still offered — the assertion that matters, and
         * the reason it is written by *affordance* rather than by id now.
         *
         * ⚠️ The two hardcoded datalist ids (`cms-known-token-tags`,
         * `cms-capability-tags`) went with the pickers the sentence editor
         * replaced (V3). A slot carries its own `suggestions` and the editor
         * emits one datalist per slot, so the ids are derived rather than
         * global. What must remain true is that a datalist with real options
         * exists — that an author is offered the tags already in use, and the
         * capabilities the content actually grants (B5).
         */
        const lists = [...container.querySelectorAll('datalist')];
        expect(lists.length).toBeGreaterThan(0);
        expect(lists.some((l) => l.querySelectorAll('option').length > 0)).toBe(true);
    });

    it('shows each rule as the sentence it will read as in game', () => {
        const { tokenId, effectId } = seedToken();

        const { container } = render(React.createElement(StatementList, {
            statements: statementsOfEffect(effectId),
            onChange: () => {},
        }));
        const text = container.textContent;

        expect(text).toContain('Makes adjacent Coast Tokens work 5% faster.');
        expect(text).toContain('Acts as a Tier 1 net for adjacent stations.');

        // ⚠️ Once, not three times. Before the Rules Line (P2) a rule's sentence
        // sat in the chip editor's quote AND the row's footer; the line is the
        // sentence now, and a second copy would be the duplication it removed.
        expect(text.split('Makes adjacent Coast Tokens work 5% faster.').length - 1).toBe(1);
        cleanup();

        // The Token's panel repeats the entry's sentences read-only, under the
        // effect's name — that name is the whole point of the library, so the
        // panel must show it rather than just the rules.
        const token = useEntityStore.getState().tokens[tokenId];
        const { container: tokenRules } = render(React.createElement(Statements, { token }));
        expect(tokenRules.textContent).toContain('Shrimp Trawler');
        expect(tokenRules.textContent).toContain('Makes adjacent Coast Tokens work 5% faster.');
        expect(tokenRules.textContent).toContain('Requires an adjacent Tier 1 net.');
    });

    it('warns when a targeted tag matches no Token, and offers the right case', () => {
        const { effectId } = seedToken();
        // The engine matches tags exactly, so "coast" reaches no Coast Token.
        useEntityStore.getState().setEffectStatements(effectId, [
            {
                id: 'stm_typo', keyword: 'provides',
                to: { mode: 'tag', value: 'coast' },
                payload: { type: 'YIELD', bucket: 'percentage', value: 0.1 }
            }
        ]);

        const { container } = render(React.createElement(StatementList, {
            statements: statementsOfEffect(effectId),
            onChange: () => {},
        }));
        expect(container.textContent).toContain('No Token carries the tag');
        expect(container.textContent).toContain('Did you mean');
    });

    it('names the old shape rather than letting a Token look empty', () => {
        const store = useEntityStore.getState();
        const tokenId = store.addToken({ name: 'Old Shape' });
        useEntityStore.getState().updateToken(tokenId, {
            effectBlocks: [{ target: 'token', modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.1 }] }]
        });
        const token = useEntityStore.getState().tokens[tokenId];

        const { container } = render(React.createElement(Statements, { token }));
        expect(container.textContent).toContain('still carries');
        expect(container.textContent).toContain('effect blocks');
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
