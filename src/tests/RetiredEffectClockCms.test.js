// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { StatementList } from '../../cms/src/components/editors/Statements.jsx';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';

/**
 * The CMS's rules line for an `Applies` rule, as the owner sees it: no time to set (timed effects
 * are retired), and a rule still holding one shows an "old timer" tick that clears it.
 */

const content = {
    tokens: {},
    items: {},
    effects: { fx_1: { id: 'fx_1', name: 'Effect 1' } },
};

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
    const chips = () => [...utils.container.querySelectorAll('[data-rules-more] [data-slot]')].map(b => b.getAttribute('data-slot'));
    const latest = () => (calls.length ? calls[calls.length - 1][0] : statements[0]);
    return { ...utils, chips, latest };
}

const elixir = (payload) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId: 'fx_1', scale: 1, chance: 100, ...payload }
});

afterEach(() => cleanup());

describe('an Applies rule in the CMS offers no time', () => {
    it('shows no time to set, whether the rule holds the blank 0 or nothing', () => {
        expect(mount([elixir({ durationMs: 0 })]).chips()).not.toContain('durationMs');
        cleanup();
        expect(mount([elixir({})]).chips()).not.toContain('durationMs');
    });

    it('a rule still holding a time shows the old timer, and unticking it clears the time', () => {
        const { container, chips, latest } = mount([elixir({ durationMs: 30_000 })]);
        expect(chips()).toContain('durationMs');
        fireEvent.click(container.querySelector('[data-rules-more] [data-slot="durationMs"]'));
        const panel = container.querySelector('[data-rules-panel]');
        expect(panel.textContent).toMatch(/old timer \(retired\)/);
        fireEvent.click(panel.querySelector('input[type="checkbox"]'));
        expect(latest().payload).toEqual({ effectId: 'fx_1', scale: 1, chance: 100 });
    });
});
