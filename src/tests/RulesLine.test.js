import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { StatementList } from '../../cms/src/components/editors/Statements.jsx';
import { visibleOptions, LIST_CAP } from '../../cms/src/components/editors/rulesLineModel.js';
import { KEYWORD, KEYWORDS, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { slotsOf, SLOT_KIND } from '../systems/effects/statementSlots.js';

/**
 * ⭐ **The Rules Line, driven the way an author drives it** (Rules Line P2–P3).
 *
 * Mounted as the real list the CMS mounts — `StatementList`, with its one shared
 * panel — holding its rules in state, so a commit re-renders the sentence
 * exactly as it does for the author. The vocabulary comes in through `content`,
 * never through the store: the CMS store persists itself, and a test must not
 * write there.
 *
 * Every locked decision has a test here:
 *
 * * E-1/E-2 — the line reads exactly as the game prints it, once.
 * * E-3 — clicking a word retypes that word, and nothing else moves.
 * * E-4 — an unrecognised word inserts nothing and offers the nearest.
 * * E-5 — one panel, on the left, following the author between rules.
 * * Q3  — Tab walks the words; arrows move through the panel.
 */

const content = {
    tokens: { tok_oak: { id: 'tok_oak', name: 'Oak Tree', tags: ['Forest'] } },
    items: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`item_${i}`, { id: `item_${i}`, name: `Item ${i}` }])),
    effects: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`fx_${i}`, { id: `fx_${i}`, name: `Effect ${i}` }])),
};
const ctx = { ...content, capabilities: [] };

/** The list, holding its rules in state — so a commit re-renders like the real editor. */
function Harness({ initial, onList }) {
    const [list, setList] = React.useState(initial);
    return React.createElement(StatementList, {
        statements: list,
        content,
        onChange: (next) => { onList(next); setList(next); },
    });
}

function mount(statements) {
    const calls = [];
    const utils = render(React.createElement(Harness, { initial: statements, onList: (next) => calls.push(next) }));
    const lines = () => [...utils.container.querySelectorAll('[data-rules-line]')];
    const line = (rule = 0) => lines()[rule];
    const word = (slot, rule = 0) => line(rule).querySelector(`[data-slot="${slot}"]`);
    const box = () => utils.container.querySelector('[data-retyping]');
    const type = (text) => fireEvent.change(box(), { target: { value: text } });
    const press = (key, opts = {}) => fireEvent.keyDown(box(), { key, ...opts });
    const panel = () => utils.container.querySelector('[data-rules-panel]');
    /** The latest version of a rule, after everything committed so far. */
    const latest = (rule = 0) => (calls.length ? calls[calls.length - 1][rule] : statements[rule]);
    return { ...utils, calls, lines, line, word, box, type, press, panel, latest };
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
        const statements = [
            deals(),
            faster(),
            { ...makeStatement(KEYWORD.GRANTS), payload: { itemId: 'x', quantity: 2, chance: 40 } },
            { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'tok_oak', placement: 'here' } }
        ];
        const { lines } = mount(statements);
        const names = { token: (id) => content.tokens[id]?.name || id, item: (id) => content.items[id]?.name || id };
        lines().forEach((el, i) => expect(el.textContent).toBe(renderStatement(statements[i], names)));
    });

    it('takes names from `content`, not from the store', () => {
        const { line } = mount([{ ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'tok_oak', placement: 'here' } }]);
        expect(line().textContent).toContain('Oak Tree');
    });

    it('⚠️ shows the sentence once — no quoted copy (Q1)', () => {
        const st = deals();
        const { container } = mount([st]);
        const sentence = renderStatement(st);
        expect(container.textContent.split(sentence).length - 1).toBe(1);
        expect(container.textContent).not.toContain('“');
    });
});

describe('⭐ click a word, retype that word (E-3)', () => {
    it('turns only the clicked word into a typing box', () => {
        const { word, box, line } = mount([deals()]);
        fireEvent.click(word('amount'));
        expect(box().getAttribute('data-retyping')).toBe('amount');
        expect(line().querySelectorAll('input')).toHaveLength(1);
    });

    it('commits a typed number on Enter, and the sentence says so', () => {
        const { word, type, press, latest, line, box } = mount([deals()]);
        fireEvent.click(word('amount'));
        type('5');
        press('Enter');
        expect(latest().payload.amount).toBe(5);
        expect(box()).toBeNull();
        expect(line().textContent).toContain('deals 5 damage');
    });

    it('leaves every other word exactly where it was', () => {
        const { word, line } = mount([deals()]);
        const others = () => [...line().querySelectorAll('button[data-slot]')]
            .filter(el => el.getAttribute('data-slot') !== 'amount')
            .map(el => `${el.getAttribute('data-slot')}:${el.textContent}`);
        const before = others();
        fireEvent.click(word('amount'));
        expect(others()).toEqual(before);
    });

    it('Escape leaves the word as it was, and changes nothing', () => {
        const { word, type, press, box, calls } = mount([deals()]);
        fireEvent.click(word('amount'));
        type('9');
        press('Escape');
        expect(calls).toHaveLength(0);
        expect(box()).toBeNull();
        expect(word('amount').textContent).toBe('2');
    });

    it('Enter with nothing typed keeps what was there', () => {
        const { word, press, calls, box } = mount([deals()]);
        fireEvent.click(word('amount'));
        press('Enter');
        expect(calls).toHaveLength(0);
        expect(box()).toBeNull();
    });

    it('commits the best match for a word from a vocabulary', () => {
        const { word, type, press, latest } = mount([deals()]);
        fireEvent.click(word('moment'));
        type('on tick');
        press('Enter');
        expect(latest().when.event).toBe('EFFECT_TICK');
    });

    it('commits an option picked from the panel', () => {
        const { word, panel, latest } = mount([deals()]);
        fireEvent.click(word('moment'));
        const option = panel().querySelector('[data-option="SELF_TOKEN_DEPLETED"]');
        fireEvent.mouseDown(option);
        fireEvent.click(option);
        expect(latest().when.event).toBe('SELF_TOKEN_DEPLETED');
    });
});

describe('⭐ an unrecognised word inserts nothing (E-4)', () => {
    it('refuses to commit, keeps the box open, and offers the nearest words', () => {
        const { word, type, press, box, panel, calls } = mount([deals()]);
        fireEvent.click(word('moment'));
        type('depletd');
        press('Enter');
        expect(calls).toHaveLength(0);
        expect(box()).toBeTruthy();
        expect(panel().querySelector('[data-nearest]')).toBeTruthy();
        expect(panel().querySelector('[data-option]').textContent).toContain('On Depleted');
    });

    it('commits a suggestion only when the author arrows onto it', () => {
        const { word, type, press, latest } = mount([deals()]);
        fireEvent.click(word('moment'));
        type('depletd');
        press('ArrowDown');   // onto the first suggestion — an explicit choice
        press('ArrowUp');     // …and back to it, still explicit
        press('Enter');
        expect(latest().when.event).toBe('SELF_TOKEN_DEPLETED');
    });

    it('refuses a number that is not a number', () => {
        const { word, type, press, calls } = mount([deals()]);
        fireEvent.click(word('amount'));
        type('lots');
        press('Enter');
        expect(calls).toHaveLength(0);
    });
});

describe('⚠️ a retyped number keeps its direction', () => {
    it('"work 5% faster" retyped as 20 stays faster', () => {
        const { word, type, press, latest } = mount([faster()]);
        fireEvent.click(word('value'));
        type('20');
        press('Enter');
        expect(latest().payload.value).toBeCloseTo(-0.2, 5);
    });

    it('a typed sign flips it on purpose', () => {
        const { word, type, press, latest } = mount([faster()]);
        fireEvent.click(word('value'));
        type('+20');
        press('Enter');
        expect(latest().payload.value).toBeCloseTo(0.2, 5);
    });

    it('accepts the % the author can see in the sentence', () => {
        const { word, type, press, latest } = mount([faster()]);
        fireEvent.click(word('value'));
        type('15%');
        press('Enter');
        expect(latest().payload.value).toBeCloseTo(-0.15, 5);
    });
});

describe('⭐ one panel, on the left, following the author (E-5)', () => {
    it('is a single panel for the whole list, placed before the rules', () => {
        const { container } = mount([deals(), faster()]);
        expect(container.querySelectorAll('[data-rules-panel]')).toHaveLength(1);
        const editor = container.querySelector('[data-rules-editor]');
        const column = container.querySelector('[data-rules-panel-column]');
        expect(editor.firstElementChild).toBe(column);
        expect(column.style.position).toBe('sticky');
    });

    it('follows the word into another rule, and changes only that rule', () => {
        const { word, panel, latest } = mount([deals(), deals()]);
        fireEvent.click(word('moment', 1));
        expect(panel().querySelector('p').textContent).toBe('when');
        const option = panel().querySelector('[data-option="EFFECT_TICK"]');
        fireEvent.mouseDown(option);
        fireEvent.click(option);
        expect(latest(1).when.event).toBe('EFFECT_TICK');
        expect(latest(0).when.event).not.toBe('EFFECT_TICK');
    });

    it('says "Pick …" and invites a search when the word is a blank', () => {
        const { word, panel } = mount([{ ...makeStatement(KEYWORD.APPLIES), payload: { effectId: '', durationMs: 1000 } }]);
        fireEvent.click(word('effectId'));
        expect(panel().querySelector('p').textContent).toBe('Pick effect');
        expect(panel().textContent).toContain('Start typing to search');
    });

    it('⚠️ names a picked effect by its name, never by its id', () => {
        // Found in the browser: picking "Poison" from a blank committed the
        // right effect and then printed "Applies effect_1", because the list's
        // name lookup knew Tokens and items but not effects.
        const { word, type, press, line, latest } = mount([{ ...makeStatement(KEYWORD.APPLIES), payload: { effectId: '', durationMs: 1000 } }]);
        fireEvent.click(word('effectId'));
        type('Effect 12');
        press('Enter');
        expect(latest().payload.effectId).toBe('fx_12');
        expect(line().textContent).toContain('Applies Effect 12');
        expect(line().textContent).not.toContain('fx_12');
    });

    it('lists a long vocabulary a screenful at a time, with a count', () => {
        const { word, panel, type } = mount([{ ...makeStatement(KEYWORD.APPLIES), payload: { effectId: '', durationMs: 1000 } }]);
        fireEvent.click(word('effectId'));
        expect(panel().querySelectorAll('[data-option]')).toHaveLength(LIST_CAP);
        expect(panel().querySelector('[data-list-count]').textContent).toContain(`${LIST_CAP} of 50`);
        type('Effect 4');
        expect(panel().querySelector('[data-list-count]')).toBeNull();
        expect(panel().querySelectorAll('[data-option]').length).toBeLessThan(LIST_CAP);
    });
});

describe('⭐ Tab walks the words (Q3)', () => {
    it('moves the typing box word by word, and Shift+Tab goes back', () => {
        const { word, box, press } = mount([deals()]);
        fireEvent.click(word('moment'));
        expect(box().getAttribute('data-retyping')).toBe('moment');
        press('Tab');
        // "deals" is the verb — a vocabulary word too, so it is retyped in place.
        expect(box().getAttribute('data-retyping')).toBe('keyword');
        press('Tab');
        expect(box().getAttribute('data-retyping')).toBe('amount');
        press('Tab');
        expect(box().getAttribute('data-retyping')).toBe('role');
        press('Tab', { shiftKey: true });
        expect(box().getAttribute('data-retyping')).toBe('amount');
    });

    it('commits what was typed on the way', () => {
        const { word, box, type, press, latest, line } = mount([deals()]);
        fireEvent.click(word('amount'));
        type('7');
        press('Tab');
        expect(latest().payload.amount).toBe(7);
        expect(box().getAttribute('data-retyping')).toBe('role');
        expect(line().textContent).toContain('deals 7 damage');
    });

    it('⚠️ never guesses on the way — a non-word is dropped, not committed', () => {
        const { word, type, press, calls, box } = mount([deals()]);
        fireEvent.click(word('moment'));
        type('depletd');
        press('Tab');
        expect(calls).toHaveLength(0);
        expect(box().getAttribute('data-retyping')).toBe('keyword');
    });

    it('leaves the sentence past its last word', () => {
        const { word, press, box } = mount([deals()]);
        fireEvent.click(word('role'));
        press('Tab');
        expect(box()).toBeNull();
    });

    it('reaches a word that is not retyped in place, and gives it the focus', () => {
        const count = deals({ payload: { amount: 1, magnitude: 'count', ignoresArmor: true }, counted: { mode: 'tag', value: 'Coast' } });
        const { word, press, box, panel } = mount([count]);
        fireEvent.click(word('role'));
        press('Tab');
        expect(box()).toBeNull();
        expect(document.activeElement.getAttribute('data-slot')).toBe('ignoresArmor');
        expect(panel().querySelector('input[type="checkbox"]')).toBeTruthy();
    });
});

describe('⭐ arrows move through the panel', () => {
    it('Down then Enter takes the second option, not the first', () => {
        const st = deals();
        const { word, type, press, latest, panel } = mount([st]);
        fireEvent.click(word('moment'));
        type('on');
        const expected = visibleOptions(slotsOf(st, ctx).find(s => s.id === 'moment'), 'on').shown[1].id;
        press('ArrowDown');
        expect(panel().querySelector('[data-highlighted]').getAttribute('data-option')).toBe(expected);
        press('Enter');
        expect(latest().when.event).toBe(expected);
    });

    it('stops at the top and bottom of the list', () => {
        const { word, type, press, panel } = mount([deals()]);
        fireEvent.click(word('moment'));
        type('on tick');
        for (let i = 0; i < 10; i++) press('ArrowDown');
        const options = panel().querySelectorAll('[data-option]');
        expect(panel().querySelector('[data-highlighted]')).toBe(options[options.length - 1]);
        for (let i = 0; i < 10; i++) press('ArrowUp');
        expect(panel().querySelector('[data-highlighted]')).toBe(options[0]);
    });
});

describe('every control is named by what it says', () => {
    it('gives each clickable word and "+" control its visible text as its name', () => {
        const { container } = mount([deals()]);
        const buttons = [...container.querySelectorAll('button[data-slot]')];
        expect(buttons.length).toBeGreaterThan(0);
        for (const b of buttons) expect(b.getAttribute('aria-label')).toBe(b.textContent);
    });

    it('can find a word by the word itself', () => {
        const { getByRole } = mount([deals()]);
        expect(getByRole('button', { name: '2' }).getAttribute('data-slot')).toBe('amount');
        expect(getByRole('button', { name: 'On Cycle' }).getAttribute('data-slot')).toBe('moment');
        expect(getByRole('button', { name: '+ ignores armour' }).getAttribute('data-slot')).toBe('ignoresArmor');
    });
});

describe('⚠️ a decision with no word still has a control', () => {
    it('offers "ignores armour" on a hit that does not yet ignore it', () => {
        const { container, panel, latest } = mount([deals()]);
        fireEvent.click(container.querySelector('[data-rules-more] [data-slot="ignoresArmor"]'));
        fireEvent.click(panel().querySelector('input[type="checkbox"]'));
        expect(latest().payload.ignoresArmor).toBe(true);
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
            const { container } = mount([st]);
            const reachable = new Set([...container.querySelectorAll('[data-slot]')].map(el => el.getAttribute('data-slot')));
            for (const slot of slotsOf(st, ctx)) {
                if (slot.kind !== SLOT_KIND.FORM && !reachable.has(slot.id)) bad.push(`${st.keyword}: ${slot.id}`);
            }
            cleanup();
        }
        expect(bad).toEqual([]);
    });
});
