import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore, makeTokenOutputEntry } from '../../cms/src/stores/useEntityStore.js';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import { StatementList } from '../../cms/src/components/editors/Statements.jsx';
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

    it('stamps a FREE cost on a keyword that can never fire (UE-20)', () => {
        // It used to stamp nothing at all, because firing was the only moment
        // anything spent at. Every statement carries the field now — but a rule
        // that cannot fire is born costing nothing, so an aura stays free unless
        // its author says otherwise.
        for (const keyword of [KEYWORD.PROVIDES, KEYWORD.ACTS_AS, KEYWORD.STATION, KEYWORD.CANNOT]) {
            expect(makeStatement(keyword).chargeDelta, keyword).toBe(0);
        }
    });

    it('still reads an unauthored delta as −1 for a rule that FIRES', () => {
        // The rule every older statement relies on, unchanged: a triggered
        // statement with no authored delta spends one charge per firing
        // ("charge burns on service", CMS-26).
        const firing = { id: 'stm_old', keyword: 'grants', when: { event: 'CYCLE_COMPLETE' } };
        expect(statementChargeDelta(firing)).toBe(-1);
        expect(statementChargeDelta({ ...firing, chargeDelta: 0 })).toBe(0);
    });

    it('reads an unauthored delta as 0 for a rule that does not fire (UE-20)', () => {
        // ⚠️ The default is per MOMENT, not one number. A rule with no `When`
        // clause has never spent anything — the per-cycle moment did not exist
        // before P2 — so defaulting it to −1 would silently start wearing down
        // every Token carrying an aura. Both callers of this function sit inside
        // `TriggerSystem.fireStatement`, which only ever sees statements matched
        // by their `when.event`, so nothing in the game reads this arm today.
        expect(statementChargeDelta({ id: 'stm_aura', keyword: 'provides' })).toBe(0);
        expect(statementChargeDelta({ id: 'stm_costly', keyword: 'provides', chargeDelta: -2 })).toBe(-2);
    });

    it('shows the effective delta and writes a zero the author types', () => {
        const store = useEntityStore.getState();
        const itemId = store.addItem({ name: 'Raw Shrimp' });
        // Statements live in a named library entry (Unified Effects P1), and
        // `StatementList` is the editor for one entry's rules.
        const effectId = store.addEffect({
            name: 'Bonus Shrimp',
            statements: [{
                // No `chargeDelta` — a statement authored before the field existed.
                id: 'stm_a', keyword: 'grants',
                to: { mode: 'all' },
                when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 5000 },
                payload: { type: 'BONUS_DROP', itemId, chance: 100, quantity: 1 }
            }],
        });

        const { container } = render(React.createElement(StatementList, {
            statements: useEntityStore.getState().effects[effectId].statements,
            onChange: (next) => useEntityStore.getState().setEffectStatements(effectId, next),
        }));

        const field = [...container.querySelectorAll('label')]
            .find(l => l.textContent.includes('Charge cost')).parentElement;
        const input = field.querySelector('input[type="number"]');

        expect(input.value).toBe('-1');
        expect(container.textContent).toContain('Spends 1 charge each time it fires');

        fireEvent.change(input, { target: { value: '0' } });
        const saved = useEntityStore.getState().effects[effectId].statements[0];
        expect(saved.chargeDelta).toBe(0);
    });

    it('offers the moment picker without a firing option when a rule cannot fire', () => {
        const store = useEntityStore.getState();
        const effectId = store.addEffect({
            name: 'Cooking Station',
            statements: [{ id: 'stm_s', keyword: 'station', payload: { skill: 'cooking' } }],
        });

        const { container } = render(React.createElement(StatementList, {
            statements: useEntityStore.getState().effects[effectId].statements,
            onChange: () => {},
        }));

        // The cost is offered on every rule now (UE-20) — what changes is the
        // moment list. A `Works as` statement has no When clause, so "each time
        // it fires" is not a moment it could ever reach and is not offered.
        expect(container.textContent).toContain('Charge cost');
        expect(container.textContent).toContain('Every cycle of this Token');
        expect(container.textContent).not.toContain('Each time it fires');
    });
});
