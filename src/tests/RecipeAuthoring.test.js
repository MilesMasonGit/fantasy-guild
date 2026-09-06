import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore, makeTokenOutputEntry } from '../../cms/src/stores/useEntityStore.js';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import Statements from '../../cms/src/components/editors/Statements.jsx';
import {
    makeStatement, KEYWORD, DEFAULT_STATEMENT_CHARGE_DELTA
} from '../systems/effects/statements.js';
import { statementChargeDelta } from '../systems/board/Charges.js';

/**
 * CMS authoring for what this rework added (Recipe & Charges rework, P6b).
 *
 * Three things had engine support and no way to author them: a recipe's context
 * requirements past their tag, a Token output, and a statement's `chargeDelta`.
 * This file is about the authoring, not the engines — the engines are pinned by
 * `ChargesEngine.test.js`, `ContextToolTiers.test.js` and `TokenOutputDrops.test.js`.
 *
 * ⚠️ The EV / auto-balance fields are deliberately absent from every assertion
 * here. Nothing in this phase reads or writes them (R-6, R-11), and
 * `RecipeSyncRoundTrip.test.js` is what would notice if that changed.
 */

const originalFetch = globalThis.fetch;

function resetStore() {
    useEntityStore.setState({
        items: {}, tokens: {}, maps: {}, recipePools: {},
        activeEntityId: null, activeEntityType: null
    });
}

/** The pool the editor is showing, straight from the store. */
function poolOf(skillId) {
    return useEntityStore.getState().recipePools[skillId] || [];
}

/**
 * Type into the search box of the column headed `label`.
 *
 * ⚠️ Finds the column by climbing from its heading rather than assuming a
 * shape. Inputs and Outputs used to be a `<label>` over an `IOEntryList`
 * rendered inline in the recipe card, so the heading's parent *was* the column;
 * they now render through `SupplyChainColumn` (2026-09-05), whose title is an
 * `<h3>` inside a header bar, one level above the list. Neither the test's
 * intent nor what it asserts changes — only where the markup puts the box.
 */
function searchIn(container, label, text) {
    const heading = [...container.querySelectorAll('label, h3')]
        .find(el => el.textContent.trim() === label);
    if (!heading) throw new Error(`no column headed "${label}"`);

    // Climb until an ancestor holds the column's own search box.
    let column = heading;
    while (column && !within(column).queryByPlaceholderText(/Add an item/)) {
        column = column.parentElement;
    }
    if (!column) throw new Error(`column "${label}" has no search box`);

    fireEvent.change(within(column).getByPlaceholderText(/Add an item/), {
        target: { value: text },
    });
    return column;
}

describe('Recipe authoring — P6b', () => {
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

    it('authors a Token as a recipe output, in the shape BoardRunner branches on', () => {
        const store = useEntityStore.getState();
        const tokenId = store.addToken({ name: 'Iron Anvil' });
        store.addRecipe('smithing');

        const { container } = render(React.createElement(RecipeEditor));

        // The pool the editor opens on is the first skill; steer it to smithing.
        fireEvent.click([...container.querySelectorAll('button')]
            .find(b => b.textContent.startsWith('Smithing')));

        const column = searchIn(container, 'Outputs', 'Iron');
        fireEvent.click(within(column).getByText('Iron Anvil'));

        const [recipe] = poolOf('smithing');
        expect(recipe.outputs).toEqual([
            { tokenId, chance: 100, minQty: 1, maxQty: 1 }
        ]);
        // `itemId` is what the output loop falls through to, so a Token output
        // must not carry one.
        expect('itemId' in recipe.outputs[0]).toBe(false);
    });

    it('offers no Token in the Inputs column — inputs are items only (CMS-43, R-17)', () => {
        const store = useEntityStore.getState();
        store.addToken({ name: 'Iron Anvil' });
        store.addRecipe('smithing');

        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click([...container.querySelectorAll('button')]
            .find(b => b.textContent.startsWith('Smithing')));

        const column = searchIn(container, 'Inputs', 'Iron');
        expect(within(column).queryByText('Iron Anvil')).toBeNull();
    });

    it('authors a context requirement’s min tier and charge cost, not just its tag', () => {
        useEntityStore.getState().addRecipe('smithing', {
            requiresContext: [{ tag: 'anvil', minTier: 1, chargeCost: 0 }]
        });

        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click([...container.querySelectorAll('button')]
            .find(b => b.textContent.startsWith('Smithing')));

        const tier = [...container.querySelectorAll('label')]
            .find(l => l.textContent.startsWith('Min tier')).querySelector('input');
        const cost = [...container.querySelectorAll('label')]
            .find(l => l.textContent.startsWith('Charge cost')).querySelector('input');

        fireEvent.change(tier, { target: { value: '2' } });
        fireEvent.change(cost, { target: { value: '3' } });

        expect(poolOf('smithing')[0].requiresContext).toEqual([
            { tag: 'anvil', minTier: 2, chargeCost: 3 }
        ]);
    });

    it('keeps the fields the engine reads on one card', () => {
        useEntityStore.getState().addRecipe('smithing');
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click([...container.querySelectorAll('button')]
            .find(b => b.textContent.startsWith('Smithing')));

        /**
         * ⚠️ Read the label's own text, not the whole element.
         *
         * A derived field's label also carries a `DerivedMark` badge ("sim"),
         * so `textContent` on the `<label>` is "Cycle Time (ms)sim". Comparing
         * the whole thing would make this test fail the moment a field is
         * correctly marked as derived — which is not what it is here to catch.
         * `Field` renders the label text as the first `<span>`, so that is the
         * part to compare.
         */
        const labelText = (l) => (l.querySelector('span') || l).textContent.trim();

        for (const label of ['Cycle Time (ms)', 'XP', 'Level Requirement', 'Station Charge Cost']) {
            expect(
                [...container.querySelectorAll('label')].some(l => labelText(l) === label),
                `${label} is not authorable`
            ).toBe(true);
        }
    });

    it('marks the fields the simulator overwrites, and only those', () => {
        /**
         * The authored/derived split, pinned at the one place a designer sees it.
         *
         * Before this, `Cycle Time (ms)` and `XP` (both written by the sim on
         * every Recalculate) sat in the same 2×2 grid as `Level Requirement`
         * and `Station Charge Cost` (both authored), in identical styling, with
         * nothing to tell them apart. Typing into a derived one looked exactly
         * like typing into an authored one and was silently thrown away.
         *
         * They stay editable on purpose — see `DerivedMark`. What must not
         * regress is that they are *labelled*.
         */
        useEntityStore.getState().addRecipe('smithing');
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click([...container.querySelectorAll('button')]
            .find(b => b.textContent.startsWith('Smithing')));

        const labelFor = (text) => [...container.querySelectorAll('label')]
            .find(l => (l.querySelector('span') || l).textContent.trim() === text);
        const isMarked = (text) => {
            const label = labelFor(text);
            expect(label, `no field labelled ${text}`).toBeTruthy();
            return label.textContent.toLowerCase().includes('sim');
        };

        for (const derived of ['Cycle Time (ms)', 'XP']) {
            expect(isMarked(derived), `${derived} is derived but unmarked`).toBe(true);
        }
        for (const authored of ['Level Requirement', 'Station Charge Cost']) {
            expect(isMarked(authored), `${authored} is authored but marked derived`).toBe(false);
        }
    });

    it('leaves a recipe’s other fields alone when one is edited', () => {
        // The store patches rather than rebuilds, which is what lets a recipe
        // carrying fields no editor knows about survive being edited (P6a).
        useEntityStore.getState().addRecipe('smithing', { targetEV: 42, mystery: 'kept' });
        useEntityStore.getState().updateRecipe('smithing', 0, { xp: 7 });

        expect(poolOf('smithing')[0]).toMatchObject({ targetEV: 42, mystery: 'kept', xp: 7 });
    });

    it('makes a Token output entry with no item id', () => {
        expect(makeTokenOutputEntry('token_forge')).toEqual({
            tokenId: 'token_forge', chance: 100, minQty: 1, maxQty: 1
        });
    });
});

describe('Charge delta authoring — P6b', () => {
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

    /**
     * The trap this phase was warned about: absent is −1, so the editor must
     * write a number rather than leave the field blank. A blank box that saved
     * nothing would read as "free" to the author and spend a charge in game.
     */
    it('stamps an explicit −1 on a new statement that can fire', () => {
        for (const keyword of [KEYWORD.GRANTS, KEYWORD.CONVERTS, KEYWORD.APPLIES]) {
            const statement = makeStatement(keyword);
            expect(statement.chargeDelta, keyword).toBe(DEFAULT_STATEMENT_CHARGE_DELTA);
            expect(statementChargeDelta(statement), keyword).toBe(-1);
        }
    });

    it('stamps nothing on a keyword that can never fire', () => {
        for (const keyword of [KEYWORD.PROVIDES, KEYWORD.ACTS_AS, KEYWORD.STATION, KEYWORD.CANNOT]) {
            expect('chargeDelta' in makeStatement(keyword), keyword).toBe(false);
        }
    });

    it('still reads an unauthored delta as −1, as every older statement relies on', () => {
        expect(statementChargeDelta({ id: 'stm_old', keyword: 'grants' })).toBe(-1);
        expect(statementChargeDelta({ id: 'stm_free', keyword: 'grants', chargeDelta: 0 })).toBe(0);
    });

    it('shows the effective delta and writes a zero the author types', () => {
        const store = useEntityStore.getState();
        const itemId = store.addItem({ name: 'Raw Shrimp' });
        const tokenId = store.addToken({ name: 'Shrimp Coast' });
        useEntityStore.getState().setStatements(tokenId, [{
            // No `chargeDelta` — a statement authored before the field existed.
            id: 'stm_a', keyword: 'grants',
            to: { mode: 'all' },
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 5000 },
            payload: { type: 'BONUS_DROP', itemId, chance: 100, quantity: 1 }
        }]);

        const { container } = render(React.createElement(Statements, {
            token: useEntityStore.getState().tokens[tokenId]
        }));

        const field = [...container.querySelectorAll('label')]
            .find(l => l.textContent.includes('Charges per firing')).parentElement;
        const input = field.querySelector('input[type="number"]');

        expect(input.value).toBe('-1');
        expect(container.textContent).toContain('Spends 1 charge each time it fires');

        fireEvent.change(input, { target: { value: '0' } });
        const saved = useEntityStore.getState().tokens[tokenId].statements[0];
        expect(saved.chargeDelta).toBe(0);
    });

    it('offers the field only on statements that can carry a trigger', () => {
        const store = useEntityStore.getState();
        const tokenId = store.addToken({ name: 'Shrimp Coast' });
        useEntityStore.getState().setStatements(tokenId, [
            { id: 'stm_s', keyword: 'station', payload: { skill: 'cooking' } }
        ]);

        const { container } = render(React.createElement(Statements, {
            token: useEntityStore.getState().tokens[tokenId]
        }));
        expect(container.textContent).not.toContain('Charges per firing');
    });
});
