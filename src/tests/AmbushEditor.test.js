// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { StatementList } from '../../cms/src/components/editors/Statements.jsx';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';

/**
 * The ambush chance in the CMS rules editor: the Spawns line says "a 5% chance to
 * spawn …", the number is its own clickable word, and a rule that always fires still offers the
 * chance beneath the line.
 *
 * ⚠️ The list gets its own `content`, so nothing reaches the CMS store (and through a Sync, `data/`).
 */

const content = {
    tokens: {
        tok_vein: { id: 'tok_vein', name: 'Copper Vein', tags: ['Ore'] },
        tok_elemental: { id: 'tok_elemental', name: 'Rock Elemental', tags: [] }
    },
    items: {},
    effects: {}
};
const names = { token: (id) => content.tokens[id]?.name || id };

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
    const line = () => utils.container.querySelector('[data-rules-line]');
    const box = () => utils.container.querySelector('[data-retyping]');
    const latest = () => (calls.length ? calls[calls.length - 1][0] : statements[0]);
    return { ...utils, line, box, latest };
}

const ambush = (chance) => ({
    ...makeStatement(KEYWORD.SPAWNS),
    payload: { typeId: 'tok_elemental', placement: 'nearest_free', chance }
});

afterEach(() => cleanup());

describe('the Spawns chance in the rules editor', () => {
    it('reads as the game prints it, with the chance a word of its own', () => {
        const st = ambush(5);
        const { line } = mount([st]);
        expect(line().textContent).toBe('On Cycle: a 5% chance to spawn Rock Elemental on the nearest free tile.');
        expect(line().textContent).toBe(renderStatement(st, names));
        expect(line().querySelector('[data-slot="chance"]').textContent).toBe('5%');
    });

    it('retypes the chance in place', () => {
        const { line, box, latest } = mount([ambush(5)]);
        fireEvent.click(line().querySelector('[data-slot="chance"]'));
        fireEvent.change(box(), { target: { value: '12' } });
        fireEvent.keyDown(box(), { key: 'Enter' });
        expect(latest().payload.chance).toBe(12);
        expect(line().textContent).toContain('a 12% chance to spawn Rock Elemental');
    });

    it('a rule that always fires offers its chance beneath the line', () => {
        const { line, container } = mount([ambush(100)]);
        expect(line().textContent).toBe('On Cycle: spawns Rock Elemental on the nearest free tile.');
        const offer = container.querySelector('[data-rules-more] [data-slot="chance"]');
        expect(offer?.textContent).toBe('chance (%): 100');
    });
});
