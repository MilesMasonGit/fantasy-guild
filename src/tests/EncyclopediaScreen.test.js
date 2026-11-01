// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { EncyclopediaScreen } from '../ui/components/encyclopedia/EncyclopediaScreen.jsx';
import { lookUp, takeLookUp } from '../ui/components/encyclopedia/encyclopediaLink.js';
import { itemKey, tokenKey } from '../systems/progression/ledger/engine.js';
import { encyclopedia, KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';

afterEach(() => {
    cleanup();
    takeLookUp();
});

const open = (props = {}) => render(React.createElement(EncyclopediaScreen, { onClose: () => {}, ...props }));
const q = (c, sel) => c.querySelector(sel);
const focused = (c) => q(c, '[data-codex-entry]')?.getAttribute('data-codex-entry');

describe('the Encyclopedia screen', () => {
    it('opens on the Items tab with every item listed, and every kind has a tab', () => {
        const { container } = open();
        expect(q(container, '[data-codex-list="items"]').querySelectorAll('[data-codex-row]').length)
            .toBe(encyclopedia().byKind[KIND.ITEM].length);
        for (const k of ['items', 'tokens', 'enemies', 'recipes']) expect(q(container, `[data-codex-tab="${k}"]`)).not.toBeNull();
        fireEvent.click(q(container, '[data-codex-tab="enemies"]'));
        expect(q(container, '[data-codex-list="enemies"]').querySelectorAll('[data-codex-row]').length)
            .toBe(encyclopedia().byKind[KIND.ENEMY].length);
    });

    it('searches every kind: "iron" finds Iron Ore, Iron Ingot and the Iron Smithy', () => {
        const { container } = open();
        fireEvent.change(q(container, '[data-codex-search]'), { target: { value: 'iron' } });
        const rows = [...container.querySelectorAll('[data-codex-list="search"] [data-codex-row]')].map(r => r.getAttribute('data-codex-row'));
        expect(rows).toEqual(expect.arrayContaining([itemKey('item_iron_ore'), itemKey('item_iron_ingot'), tokenKey('token_iron_smithy')]));
        expect(q(container, '[data-codex-group="tokens"]')).not.toBeNull();
    });

    it('walks Iron Ingot\'s folded tree to Iron Ore, shows its vein, and steps back', () => {
        lookUp(itemKey('item_iron_ingot'));
        const { container } = open();
        expect(focused(container)).toBe(itemKey('item_iron_ingot'));
        const tree = q(container, '[data-codex-section="tree"]');
        const top = [...tree.querySelectorAll(':scope ul[data-codex-tree] > li')].map(li => li.getAttribute('data-codex-tree-node'));
        expect(top.sort()).toEqual(['item_coal', 'item_iron_ore']);
        // Folded: nothing below the first level shows until opened.
        expect(tree.querySelectorAll('li li').length).toBe(0);

        fireEvent.click(q(tree, `[data-codex-tree-link="${itemKey('item_iron_ore')}"]`));
        expect(focused(container)).toBe(itemKey('item_iron_ore'));
        const sources = q(container, '[data-codex-section="sources"]');
        expect(q(sources, `[data-codex-link="${tokenKey('token_iron_ore_vein')}"]`)).not.toBeNull();

        fireEvent.click(q(container, '[data-codex-back]'));
        expect(focused(container)).toBe(itemKey('item_iron_ingot'));
        expect(q(container, '[data-codex-back]')).toBeNull();
    });

    it('opens a level of a deeper tree at a time', () => {
        const book = encyclopedia();
        // Any item whose tree is at least two levels deep.
        const deep = book.byKind[KIND.ITEM].find(e => book.treeOf(e.id)?.children.some(c => c.children.length && !c.cycle));
        expect(deep).toBeTruthy();
        lookUp(deep.key);
        const { container } = open();
        const tree = q(container, '[data-codex-section="tree"]');
        const toggle = q(tree, '[data-codex-tree-toggle]');
        expect(tree.querySelectorAll('li li').length).toBe(0);
        fireEvent.click(toggle);
        expect(tree.querySelectorAll('li li').length).toBeGreaterThan(0);
        expect(tree.querySelectorAll('li li li').length).toBe(0);
    });

    it('moves to an entry a link asks for while open, and the link announces itself', () => {
        const heard = [];
        const off = EventBus.subscribe(UI_EVENTS.OPEN_ENCYCLOPEDIA, (d) => heard.push(d.key));
        const { container } = open();
        act(() => lookUp(tokenKey('token_iron_smithy')));
        off();
        expect(heard).toEqual([tokenKey('token_iron_smithy')]);
        expect(focused(container)).toBe(tokenKey('token_iron_smithy'));
        expect(q(container, '[data-codex-tab="tokens"]').getAttribute('aria-selected')).toBe('true');
        // A Token's entry shows its card and what it gives.
        expect(q(container, '[data-token-card]')).not.toBeNull();
    });

    it('shows no wedge, cell or tier anywhere', () => {
        lookUp(itemKey('item_iron_ore'));
        const { container } = open();
        expect(container.textContent).not.toMatch(/\b(tier|wedge|cell|plane)\b/i);
    });
});
