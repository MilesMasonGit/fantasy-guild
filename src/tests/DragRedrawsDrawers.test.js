// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { DeckDndProvider, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { ItemStubColumn } from '../ui/components/notifications/ItemStubColumn.jsx';
import { BannerStack } from '../ui/components/notifications/BannerStack.jsx';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import * as Banners from '../systems/notifications/banners.js';
import { ShopDrawer } from '../ui/components/drawer/ShopDrawer.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { clearMat } from './fixtures/mat.js';

// Called once each time a hero tab, or an equipment slot, draws itself: a count of their draws.
const drawCalls = vi.hoisted(() => ({ tab: 0, slot: 0 }));
vi.mock('../ui/components/board/flagText.js', async (orig) => {
    const real = await orig();
    return { ...real, dockStatusLine: (...a) => { drawCalls.tab++; return real.dockStatusLine(...a); } };
});
vi.mock('../config/registries/equipmentConstants.js', async (orig) => {
    const real = await orig();
    return { ...real, getCategoryInfo: (...a) => { drawCalls.slot++; return real.getCategoryInfo(...a); } };
});
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A drag elsewhere redraws nothing in the drawers and sidebars.** Each holder of a drag or
 * drop hook, and each reader of "is something being dragged", is redrawn by every drag start,
 * end and change of target; the things drawn there are memoised on what they draw.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

function Item() {
    const d = useEntityDrag({ id: 'item-src', kind: DRAG_KIND.ITEM, payload: { itemId: 'item_coal' } });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'item' });
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    clearMat();
    NotificationSystem.dismissAll?.();
});
afterEach(async () => {
    renders.stop();
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

/**
 * Pick up the item, carry it about, and put it down where nothing takes it. jsdom lays nothing
 * out, so every drop target here stands at the corner of the screen: the item and the pointer
 * stay well clear of it, beyond the 240 px a near miss reaches.
 */
function dragAbout(getByTestId) {
    act(() => {
        fireEvent.pointerDown(getByTestId('item'), ptr(2025, 2025));
        fireEvent.pointerMove(document, ptr(2060, 2025));
    });
    expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
    act(() => { fireEvent.pointerMove(document, ptr(2300, 2300)); });
    act(() => { fireEvent.pointerUp(document, ptr(2300, 2300)); });
    expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
}

describe('⭐ the notifications over the mat', () => {
    it('the item stubs and the banners: a drag redraws neither', () => {
        ItemStubs.reset();
        Banners.reset();
        ItemStubs.recordFlow('item_oak_wood', { added: 3 });
        ItemStubs.flush();
        Banners.push({ kind: 'hero', parts: { heroes: ['Aela'] } });
        const view = render(
            h(DeckDndProvider, null, h(Item), h(ItemStubColumn), h(BannerStack))
        );
        view.getByTestId('item').getBoundingClientRect = () => box(2000, 2000, 50, 50);
        expect(view.container.querySelector('[data-item-stub]')).not.toBeNull();
        expect(view.container.querySelector('[data-banner]')).not.toBeNull();
        renders.start();
        dragAbout(view.getByTestId);
        expect(renders.of('ItemStubColumn')).toBe(0);
        expect(renders.of('Stub')).toBe(0);
        expect(renders.of('BannerStack')).toBe(0);
        ItemStubs.reset();
        Banners.reset();
    });
});

const WOOD = 'item_oak_wood';
registerTokenTypes({
    fixture_dr_grove: {
        id: 'fixture_dr_grove', name: 'Fixture Dr Grove', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 5 }], section: 'forestry' }
    }
});

describe('⭐ the drawers', () => {
    
    it('the Shop: a drag elsewhere redraws neither its list nor any row', () => {
        EngineBootstrap.createDefaultGameData();
        GameState.state.inventory.items = {};
        InventoryManager.addItem(WOOD, 30);
        const view = render(
            h(DeckDndProvider, null, h(Item), h(ShopDrawer, { isOpen: true, onClose: () => {} }))
        );
        view.getByTestId('item').getBoundingClientRect = () => box(2000, 2000, 50, 50);
        expect(view.container.querySelector('[data-shop-row="fixture_dr_grove"]')).not.toBeNull();
        renders.start();
        dragAbout(view.getByTestId);
        expect(renders.of('ShopDrawer')).toBeGreaterThan(0);
        expect(renders.of('ShopContents')).toBe(0);
        expect(renders.of('ShopRowBody')).toBe(0);
        expect(renders.of('ArrowScrollList')).toBe(0);
        expect(renders.of('EntityRibbon')).toBe(0);
    });

    it('the Bank: a drag elsewhere redraws no item tile and no tab', () => {
        GameState.state.inventory.items = {};
        InventoryManager.addItem(WOOD, 30);
        InventoryManager.addItem('item_coal', 4);
        const view = render(
            h(DeckDndProvider, null, h(Item), h(BankTab, { onInspect: () => {} }))
        );
        view.getByTestId('item').getBoundingClientRect = () => box(2000, 2000, 50, 50);
        expect(view.container.querySelectorAll('button[data-bank-item]').length).toBe(2);
        renders.start();
        dragAbout(view.getByTestId);
        expect(renders.of('ItemTile')).toBeGreaterThan(0);
        expect(renders.of('ItemTileBody')).toBe(0);
        expect(renders.of('BankTabButtonBody')).toBe(0);
        expect(renders.of('ItemIcon')).toBe(0);
    });

    it('the hero column and the hero sheet: a drag elsewhere redraws no tab and not the sheet', () => {
        GameState.state.heroes = ['h1', 'h2', 'h3'].map(id => ({ id, name: id, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'idle', equipment: {}, skills: {} }));
        const view = render(
            h(DeckDndProvider, null, h(Item), h(BankHeroPanel, { selectedHeroId: 'h1', showTabs: true, menuRight: false }))
        );
        view.getByTestId('item').getBoundingClientRect = () => box(2000, 2000, 50, 50);
        expect(view.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(3);
        expect(view.container.querySelector('[data-hero-panel-body="h1"]')).not.toBeNull();
        drawCalls.tab = 0;
        drawCalls.slot = 0;
        renders.start();
        dragAbout(view.getByTestId);
        expect(drawCalls.tab).toBe(0);
        expect(drawCalls.slot).toBe(0);
        expect(renders.of('HeroDockTab')).toBeGreaterThan(0);
        expect(renders.of('HeroDockTabBody')).toBe(0);
        expect(renders.of('HeroInspectionSheet')).toBe(0);
        expect(renders.of('EquipSlotBody')).toBe(0);
    });
});
