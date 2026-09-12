import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import RulesLine from '../../cms/src/components/editors/RulesLine.jsx';
import { KEYWORD, KEYWORDS, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { slotsOf, SLOT_KIND } from '../systems/effects/statementSlots.js';

/**
 * ⭐ **The Rules Line, driven the way an author drives it** (Rules Line P2).
 *
 * A rule is a line of prose you write into. These tests click words, type, and
 * press keys, and assert on the change the line hands back — the same `patch`
 * the CMS merges into the statement.
 *
 * The locked decisions each have a test:
 *
 * * E-1/E-2 — the line reads exactly as the game prints it, once.
 * * E-3 — clicking a word retypes that word, and nothing else moves.
 * * E-4 — an unrecognised word inserts nothing and offers the nearest.
 */

const ctx = { tokens: {}, items: {}, capabilities: [], effects: {} };

function mount(statement, onChange = vi.fn()) {
    const utils = render(React.createElement(RulesLine, { statement, onChange, names: {}, ctx, form: null }));
    const line = () => utils.container.querySelector('[data-rules-line]');
    const word = (slot) => line().querySelector(`[data-slot="${slot}"]`);
    const box = () => line().querySelector('[data-retyping]');
    const type = (text) => fireEvent.change(box(), { target: { value: text } });
    const press = (key) => fireEvent.keyDown(box(), { key });
    return { ...utils, onChange, line, word, box, type, press };
}

const deals = (extra = {}) => ({ ...makeStatement(KEYWORD.DEALS), payload: { amount: 2 }, ...extra });
const faster = () => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 },
    to: { mode: 'tag', value: 'Coast' }
});

afterEach(() => cleanup());

describe('⭐ the line IS the sentence (E-1, E-2)', () => {
    it('reads exactly as the game prints it', () => {
        for (const st of [
            deals(),
            faster(),
            { ...makeStatement(KEYWORD.GRANTS), payload: { itemId: 'x', quantity: 2, chance: 40 } },
            { ...makeStatement(KEYWORD.APPLIES), payload: { effectId: 'e', durationMs: 30000 } }
        ]) {
            const { line } = mount(st);
            expect(line().textContent).toBe(renderStatement(st));
            cleanup();
        }
    });

    it('⚠️ shows the sentence once — the quoted copy beneath is gone (Q1)', () => {
        const st = deals();
        const { container } = mount(st);
        const sentence = renderStatement(st);
        expect(container.textContent.split(sentence).length - 1).toBe(1);
        expect(container.textContent).not.toContain('“');
    });
});

describe('⭐ click a word, retype that word (E-3)', () => {
    it('turns only the clicked word into a typing box', () => {
        const { word, box, line } = mount(deals());
        fireEvent.click(word('amount'));
        expect(box()).toBeTruthy();
        expect(box().getAttribute('data-retyping')).toBe('amount');
        expect(line().querySelectorAll('input')).toHaveLength(1);
    });

    it('commits a typed number on Enter', () => {
        const { word, type, press, onChange } = mount(deals());
        fireEvent.click(word('amount'));
        type('5');
        press('Enter');
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({ amount: 5 })
        }));
    });

    it('leaves every other word exactly where it was', () => {
        const { word, line } = mount(deals());
        const before = [...line().querySelectorAll('[data-slot]')]
            .filter(el => el.getAttribute('data-slot') !== 'amount')
            .map(el => `${el.getAttribute('data-slot')}:${el.textContent}`);
        fireEvent.click(word('amount'));
        const after = [...line().querySelectorAll('button[data-slot]')]
            .map(el => `${el.getAttribute('data-slot')}:${el.textContent}`);
        expect(after).toEqual(before);
    });

    it('Escape leaves the word as it was, and changes nothing', () => {
        const { word, type, press, box, onChange } = mount(deals());
        fireEvent.click(word('amount'));
        type('9');
        press('Escape');
        expect(onChange).not.toHaveBeenCalled();
        expect(box()).toBeNull();
        expect(word('amount').textContent).toBe('2');
    });

    it('Enter with nothing typed keeps what was there', () => {
        const { word, press, onChange } = mount(deals());
        fireEvent.click(word('amount'));
        press('Enter');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('commits the best match for a word from a vocabulary', () => {
        const { word, type, press, onChange } = mount(deals());
        fireEvent.click(word('moment'));
        type('on tick');
        press('Enter');
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            when: expect.objectContaining({ event: 'EFFECT_TICK' })
        }));
    });

    it('commits an option picked from the panel instead of typed', () => {
        const { word, container, onChange } = mount(deals());
        fireEvent.click(word('moment'));
        const option = container.querySelector('[data-rules-panel] [data-option="SELF_TOKEN_DEPLETED"]');
        expect(option).toBeTruthy();
        fireEvent.mouseDown(option);
        fireEvent.click(option);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            when: expect.objectContaining({ event: 'SELF_TOKEN_DEPLETED' })
        }));
    });
});

describe('⭐ an unrecognised word inserts nothing (E-4)', () => {
    it('refuses to commit, keeps the box open, and offers the nearest words', () => {
        const { word, type, press, box, container, onChange } = mount(deals());
        fireEvent.click(word('moment'));
        type('depletd');
        press('Enter');
        expect(onChange).not.toHaveBeenCalled();
        expect(box()).toBeTruthy();
        const panel = container.querySelector('[data-rules-panel]');
        expect(panel.querySelector('[data-nearest]')).toBeTruthy();
        expect(panel.querySelector('[data-option]').textContent).toContain('On Depleted');
    });

    it('refuses a number that is not a number', () => {
        const { word, type, press, onChange } = mount(deals());
        fireEvent.click(word('amount'));
        type('lots');
        press('Enter');
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('⚠️ a retyped number keeps its direction', () => {
    it('"work 5% faster" retyped as 20 stays faster', () => {
        const { word, type, press, onChange } = mount(faster());
        fireEvent.click(word('value'));
        type('20');
        press('Enter');
        const value = onChange.mock.calls[0][0].payload.value;
        expect(value).toBeCloseTo(-0.2, 5);
    });

    it('a typed sign flips it on purpose', () => {
        const { word, type, press, onChange } = mount(faster());
        fireEvent.click(word('value'));
        type('+20');
        press('Enter');
        expect(onChange.mock.calls[0][0].payload.value).toBeCloseTo(0.2, 5);
    });

    it('accepts the % the author can see in the sentence', () => {
        const { word, type, press, onChange } = mount(faster());
        fireEvent.click(word('value'));
        type('15%');
        press('Enter');
        expect(onChange.mock.calls[0][0].payload.value).toBeCloseTo(-0.15, 5);
    });
});

describe('every control is named by what it says', () => {
    it('gives each clickable word and "+" control its visible text as its name', () => {
        // With only a tooltip, a browser's accessibility tree named the "2"
        // button "damage", and a re-rendered one came back nameless — so a
        // screen reader would announce the slot, not the rule.
        const { container } = mount(deals());
        const buttons = [...container.querySelectorAll('button[data-slot]')];
        expect(buttons.length).toBeGreaterThan(0);
        for (const b of buttons) expect(b.getAttribute('aria-label')).toBe(b.textContent);
    });

    it('can find a word by the word itself', () => {
        const { getByRole } = mount(deals());
        expect(getByRole('button', { name: '2' }).getAttribute('data-slot')).toBe('amount');
        expect(getByRole('button', { name: 'On Cycle' }).getAttribute('data-slot')).toBe('moment');
        expect(getByRole('button', { name: '+ ignores armour' }).getAttribute('data-slot')).toBe('ignoresArmor');
    });
});

describe('⚠️ a decision with no word still has a control', () => {
    it('offers "ignores armour" on a hit that does not yet ignore it', () => {
        const { container, onChange } = mount(deals());
        const more = container.querySelector('[data-rules-more] [data-slot="ignoresArmor"]');
        expect(more).toBeTruthy();
        fireEvent.click(more);
        const box = container.querySelector('[data-rules-panel] input[type="checkbox"]');
        fireEvent.click(box);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({ ignoresArmor: true })
        }));
    });

    it('⭐ reaches every slot of every keyword, blank or filled', () => {
        const statements = [
            ...KEYWORDS.map(k => makeStatement(k.id)),
            deals({ payload: { amount: 10, magnitude: 'stat', stat: 'actor_max_hp' } }),
            deals({ payload: { amount: 1, magnitude: 'count' }, counted: { mode: 'tag', value: 'Coast' } }),
            { ...faster(), payload: { type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'mining' },
                to: { mode: 'tag', value: 'Coast', filters: [{ kind: 'worked' }] } },
            { ...makeStatement(KEYWORD.APPLIES), payload: { statusId: 'poison', stacks: 3 } },
            { ...makeStatement(KEYWORD.GRANTS), payload: { itemId: 'x' },
                when: { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: 'x', threshold: 5, cooldownMs: 3000 } }
        ];
        const bad = [];
        for (const st of statements) {
            const { container } = mount(st);
            const reachable = new Set([...container.querySelectorAll('[data-slot]')].map(el => el.getAttribute('data-slot')));
            for (const slot of slotsOf(st, ctx)) {
                if (slot.kind !== SLOT_KIND.FORM && !reachable.has(slot.id)) bad.push(`${st.keyword}: ${slot.id}`);
            }
            cleanup();
        }
        expect(bad).toEqual([]);
    });
});
