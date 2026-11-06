// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, renderHook } from '@testing-library/react';
import { buildEncyclopedia, encyclopedia, progressOf, countsTowardTotal, KIND, KINDS } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { EncyclopediaScreen, bookLayout } from '../ui/components/encyclopedia/EncyclopediaScreen.jsx';
import { lookUp, lookUpItem, takeLookUp, takeBack, onLookUp } from '../ui/components/encyclopedia/encyclopediaLink.js';
import { takeRecipeListRequest } from '../ui/components/board/recipeFlip.js';
import { progressFillPx } from '../ui/components/base/ProgressBar.jsx';
import { useEncyclopediaBack } from '../ui/hooks/useEncyclopediaBack.js';
import { pageRects, TOME_SCALE, spreadSize } from '../ui/components/atlas/tomeArt.js';
import { collectedOf } from '../systems/progression/collectionLog.js';
import { RegistryManager } from '../systems/progression/RegistryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ledgerContent, withIronChest } from './fixtures/ledgerWorld.js';

/**
 * ⭐ The Encyclopedia's progress (brief 470 E3): a count and a bar per kind at the foot of the left
 * page, read as the book opens, out of what this world can give; and an ingredient in a Token's
 * recipe list that opens its page, the card coming back as the book closes.
 */

const none = () => ({ items: new Set(), tokens: new Set(), enemies: new Set(), recipes: new Set() });
const byKind = (rows) => Object.fromEntries(rows.map(r => [r.kind, r]));

describe('what counts toward a total', () => {
    const book = buildEncyclopedia(ledgerContent());

    it('a Planned stub is no entry and never counts', () => {
        expect(book.entryOf('item:item_mythril_ore')).toBeNull();
        expect(book.entryOf('recipe:recipe_mythril_bar')).toBeNull();
    });

    it('an entry nothing reaches stays out of the total until this run has one, then counts in both', () => {
        const gem = book.entryOf('item:item_gem');
        expect(gem).not.toBeNull();
        expect(Number.isInteger(book.reachOf(gem.key)?.tier)).toBe(false);
        expect(countsTowardTotal(book, gem, none())).toBe(false);
        const before = byKind(progressOf(book, none()))[KIND.ITEM];
        const got = none();
        got.items.add('item_gem');
        const after = byKind(progressOf(book, got))[KIND.ITEM];
        expect(after).toEqual({ kind: KIND.ITEM, found: 1, total: before.total + 1 });
    });

    it('a Token only some worlds hold (a chest) counts only once had', () => {
        const chestBook = buildEncyclopedia(withIronChest());
        const chest = chestBook.entryOf('token:token_iron_chest');
        expect(chestBook.reachOf(chest.key)?.maybe).toBe(true);
        expect(countsTowardTotal(chestBook, chest, none())).toBe(false);
        const got = none();
        got.tokens.add('token_iron_chest');
        expect(countsTowardTotal(chestBook, chest, got)).toBe(true);
    });

    it('every reachable entry counts: everything collected fills every bar', () => {
        const all = none();
        for (const kind of KINDS) for (const e of book.byKind[kind]) all[kind].add(e.id);
        for (const row of progressOf(book, all)) {
            expect(row.found).toBe(row.total);
            expect(row.total).toBe(book.byKind[row.kind].length);
        }
    });

    it('over the shipped content, a new run reads 0 of a total of reachable entries for each kind, in tab order', () => {
        const shipped = encyclopedia();
        const rows = progressOf(shipped, none());
        expect(rows.map(r => r.kind)).toEqual(KINDS);
        for (const row of rows) {
            expect(row.found).toBe(0);
            expect(row.total).toBeGreaterThan(0);
            expect(row.total).toBe(shipped.byKind[row.kind].filter(e => Number.isInteger(shipped.reachOf(e.key)?.tier) && !shipped.reachOf(e.key).maybe).length);
        }
    });
});

describe('the bar', () => {
    it('fills in whole art pixels, never full short of the total, never empty above nothing', () => {
        expect(progressFillPx(0, 145, 132)).toBe(0);
        expect(progressFillPx(1, 145, 132)).toBe(2);
        expect(progressFillPx(144, 145, 132)).toBe(126);
        expect(progressFillPx(145, 145, 132)).toBe(128);
        expect(progressFillPx(3, 0, 132)).toBe(0);
        for (let v = 0; v <= 145; v++) expect(progressFillPx(v, 145, 132) % 2).toBe(0);
    });
});

describe('the strip in the book', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
    });
    afterEach(() => {
        cleanup();
        takeLookUp();
        takeBack();
    });

    const open = () => render(React.createElement(EncyclopediaScreen, { onClose: () => {} }));
    const counts = (c) => Object.fromEntries([...c.querySelectorAll('[data-codex-progress-kind]')].map(el => [
        el.getAttribute('data-codex-progress-kind'), [Number(el.dataset.found), Number(el.dataset.total)]
    ]));

    it('shows a count and a bar per kind on the opening page and on a chart, read as the book opens', () => {
        const first = open();
        const fresh = counts(first.container);
        expect(Object.keys(fresh)).toEqual(KINDS);
        for (const kind of KINDS) expect(fresh[kind][0]).toBe(0);
        expect(first.container.querySelectorAll('[data-codex-progress] [data-progress-fill]')).toHaveLength(4);

        // A new tick while the book is open does not move it; the next opening does.
        RegistryManager.recordItemGain('item_iron_ore', 1);
        expect(counts(first.container)[KIND.ITEM][0]).toBe(0);
        cleanup();
        lookUp('item:item_iron_ingot');
        const second = open();
        expect(second.container.querySelector('[data-encyclopedia]').getAttribute('data-codex-page')).toBe('chart');
        expect(counts(second.container)[KIND.ITEM]).toEqual([1, fresh[KIND.ITEM][1]]);
        expect(collectedOf().items.has('item_iron_ore')).toBe(true);
    });

    it('stands under the left page’s panel and under the chart, which ends above it across both pages', () => {
        const { w, h } = spreadSize(TOME_SCALE);
        for (const visible of [null, { left: 0, top: 0, width: w, height: h }, { left: 341, top: 187, width: 1366, height: 650 }, { left: 64, top: 100, width: 1920, height: 900 }]) {
            for (const k of [1, 1.25]) {
                const at = bookLayout(visible, k);
                const page = pageRects(TOME_SCALE, visible, 8);
                const pageBottom = Math.min(page.left.top + page.left.height, page.right.top + page.right.height);
                expect(at.progress.top + at.progress.height).toBe(pageBottom);
                expect(at.chart.top + at.chart.height).toBeLessThanOrEqual(at.progress.top);
                expect(at.left.top + at.left.height).toBeLessThanOrEqual(at.progress.top);
                expect(at.progress.left).toBeGreaterThanOrEqual(page.left.width > 0 ? page.left.left : page.right.left);
                expect(at.progress.height).toBeGreaterThan(0);
            }
        }
    });
});

describe('the way back to a recipe list', () => {
    let frames;
    beforeEach(() => {
        GameState.initNew();
        frames = [];
        vi.stubGlobal('requestAnimationFrame', (fn) => { frames.push(fn); return frames.length; });
        vi.stubGlobal('cancelAnimationFrame', () => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        takeLookUp();
        takeBack();
    });
    const flush = () => { while (frames.length) frames.shift()(); };
    const placeToken = () => {
        const instance = BoardState.addToken(BoardState.createTokenInstance('token_iron_smithy'), 300, 300);
        return instance.id;
    };

    it('an ingredient opened from a card brings that card back on its recipe list as the book closes', () => {
        const id = placeToken();
        expect(BoardState.getTokenById(id)).toBeTruthy();
        lookUpItem('item_iron_ore', { back: { recipesOf: id } });
        const onInspectToken = vi.fn();
        const hook = renderHook(({ isOpen, other }) => useEncyclopediaBack(isOpen, other, onInspectToken), { initialProps: { isOpen: true, other: false } });
        hook.rerender({ isOpen: false, other: false });
        flush();
        expect(onInspectToken).toHaveBeenCalledWith('token_iron_smithy', null, id);
        expect(takeRecipeListRequest(id)).toBe(true);
    });

    it('a link followed inside the open book keeps the way back; a book opened from nowhere has none', () => {
        const id = placeToken();
        lookUpItem('item_iron_ore', { back: { recipesOf: id } });
        const stop = onLookUp(() => {});
        lookUp('item:item_coal');
        stop();
        expect(takeBack()).toEqual({ recipesOf: id });
        lookUp('item:item_coal');
        expect(takeBack()).toBeNull();
    });

    it('nothing comes back when another view took the book’s place, or the Token is gone', () => {
        const id = placeToken();
        const onInspectToken = vi.fn();
        lookUpItem('item_iron_ore', { back: { recipesOf: id } });
        const hook = renderHook(({ isOpen, other }) => useEncyclopediaBack(isOpen, other, onInspectToken), { initialProps: { isOpen: true, other: false } });
        hook.rerender({ isOpen: false, other: false });
        hook.rerender({ isOpen: false, other: true });
        flush();
        expect(onInspectToken).not.toHaveBeenCalled();

        lookUpItem('item_iron_ore', { back: { recipesOf: 'gone' } });
        hook.rerender({ isOpen: true, other: false });
        hook.rerender({ isOpen: false, other: false });
        flush();
        expect(onInspectToken).not.toHaveBeenCalled();
    });
});
