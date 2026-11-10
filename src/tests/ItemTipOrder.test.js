// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { ItemTipContent } from '../ui/components/drawer/ItemTip.jsx';
import { ItemIcon } from '../ui/components/base/ItemIcon.jsx';
import { GLYPHS } from '../ui/components/base/PixelGlyph.jsx';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The item tooltip reads name, count, tool, tags.** The name is its header, the count right
 * under it, then its tool and the tags, with no type or "Equippable" line; anything more comes
 * after (or not at all, where the Bank's Item drawer says it). And the Bank's sheet keeps the icon rule: a pixel lock,
 * a pixel "?" for an unknown item, no Lucide header icon.
 */

const h = React.createElement;
const SRC = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

registerItems({
    tip_order_pick: {
        id: 'tip_order_pick', name: 'Order Pick', type: 'tool', equipSlot: 'hand', stackable: true,
        tags: ['metal', 'starter'], description: 'Digs.', tool: { kind: 'pickaxe', tier: 1 }
    }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
});
afterEach(cleanup);

const order = (root) => [...root.querySelectorAll('[data-item-tip] > *')].map(el =>
    [...el.attributes].map(a => a.name).find(n => n.startsWith('data-item-tip-')) || el.textContent);

describe('the item tooltip order', () => {
    it('count first, then tool, tags, with no type or Equippable line; details after them', () => {
        const { container } = render(h(ItemTipContent, { item: { id: 'tip_order_pick', name: 'Order Pick', type: 'tool', equipSlot: 'hand', tags: ['metal'], tool: { kind: 'pickaxe', tier: 1 }, description: 'Digs.' }, count: 4321 }));
        const seen = order(container);
        expect(seen.slice(0, 3)).toEqual(['data-item-tip-count', 'data-item-tip-tool', 'data-item-tip-tags']);
        expect(container.querySelector('[data-item-tip-type], [data-item-tip-equip]')).toBeNull();
        expect(container.textContent).not.toMatch(/Equippable|Tool/);
        expect(seen.indexOf('data-item-tip-description')).toBeGreaterThan(seen.indexOf('data-item-tip-tags'));
        expect(container.querySelector('[data-item-tip-count]').textContent).toBe('×4,321');
    });

    it('with details off it stops at the tags', () => {
        const { container } = render(h(ItemTipContent, { item: { id: 'x', name: 'X', type: 'food', equipSlot: 'food', restoreAmount: 5, tags: ['meal'], description: 'Tasty.' }, count: 2, details: false }));
        const seen = order(container);
        expect(seen[seen.length - 1]).toBe('data-item-tip-tags');
        expect(container.textContent).not.toMatch(/Restores|Tasty/);
    });

    it('with no count, the tags lead (the Encyclopedia\'s card), and no type line at all', () => {
        const { container } = render(h(ItemTipContent, { item: { id: 'x', name: 'X', type: 'material', tags: ['Ore'] } }));
        expect(container.querySelector('[data-item-tip-count]')).toBeNull();
        expect(order(container)[0]).toBe('data-item-tip-tags');
        expect(container.textContent).not.toContain('Material');
    });
});

describe('the icon rule on the Bank\'s sheet', () => {
    it('a locked tab shows the pixel lock, not a Lucide one', () => {
        InventoryManager.addItem('tip_order_pick', 1);
        const view = render(h(DeckDndProvider, null, h(BankTab)));
        const locked = view.container.querySelectorAll('[data-bank-tab-locked]');
        expect(locked.length).toBeGreaterThan(0);
        for (const el of locked) {
            expect(el.querySelector('[data-glyph="lock"]')).not.toBeNull();
            expect(el.querySelector('.lucide')).toBeNull();
        }
    });

    it('an undiscovered item is the pixel "?", at a whole scale, in the icon and the ribbon', () => {
        const { container } = render(h(ItemIcon, { item: 'tip_order_pick', size: 64, isDiscovered: false }));
        const glyph = container.querySelector('[data-item-unknown] [data-glyph="unknown"]');
        expect(glyph).not.toBeNull();
        expect(glyph.getAttribute('width')).toBe('32');
        expect(container.textContent).not.toContain('❓');
        expect(read('ui/components/base/EntityRibbon.jsx')).not.toMatch(/HelpCircle/);
        expect(read('ui/components/base/EntityRibbon.jsx')).toMatch(/name="unknown"/);
        for (const rows of [GLYPHS.lock, GLYPHS.unknown]) {
            expect(rows).toHaveLength(8);
            for (const row of rows) expect(row).toMatch(/^[.#]{8}$/);
        }
    });

    it('the Bank\'s header is its title and the X, with no Lucide icon', () => {
        const src = read('ui/components/drawer/BankDrawer.jsx');
        expect(src).not.toMatch(/lucide-react/);
        expect(src).not.toMatch(/sprite=/);
    });
});
