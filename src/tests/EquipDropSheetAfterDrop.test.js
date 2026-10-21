// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { flushSync } from 'react-dom';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { useHeroSheetRequests } from '../ui/hooks/useHeroSheetRequests.js';

vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

/**
 * ⭐ **Equipping by drop opens the hero sheet after the drop, not in it.** The sheet mounting
 * redraws the whole screen; in the drop's own commit it made the equip drop the heaviest of any
 * drag. It opens in a transition: React draws the drop first, the sheet a frame later at most. A
 * click on a hero still opens it at once.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

// As the engine's: an equip that succeeds says so before it returns.
const engine = {
    GameState, EventBus, BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: {
        equipItem: vi.fn((heroId, itemId) => {
            EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot: 0, itemId, action: 'equip' });
            return { success: true };
        })
    }
};
const hero = (id) => ({
    id, name: id, spriteId: 'hn_recruit_por', status: 'idle', level: 50, equipment: {},
    skills: {}, hp: { current: 100, max: 100 }
});

function Item() {
    const d = useEntityDrag({ id: 'item-src', kind: DRAG_KIND.ITEM, payload: { itemId: 'item_copper_sword' } });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'item-src' });
}

/** Stands in for the sheet `ReactRoot` mounts for the hero it is asked to show. */
function HeroSheetStandIn({ heroId }) {
    return h('div', { 'data-testid': 'sheet', 'data-hero': heroId });
}
function SheetHost() {
    const [heroId, setHeroId] = React.useState(null);
    useHeroSheetRequests(setHeroId);
    return heroId ? h(HeroSheetStandIn, { heroId }) : null;
}

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    GameState.state.heroes = ['h1', 'h2'].map(hero);
    setLiveMatFit(1);
});
afterEach(async () => {
    renders.stop();
    // dnd-kit drops its after-drag click guard 50 ms after a drag ends.
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

/** Carry the item onto `target` (its box at 500,900, 100 across) and let go. */
async function dropOn(view, target) {
    view.getByTestId('item-src').getBoundingClientRect = () => box(0, 0, 50, 50);
    target.getBoundingClientRect = () => box(500, 900, 100, 100);
    act(() => {
        fireEvent.pointerDown(view.getByTestId('item-src'), ptr(25, 25));
        fireEvent.pointerMove(document, ptr(60, 25));
    });
    act(() => { fireEvent.pointerMove(document, ptr(550, 950)); });
    renders.start();
    await act(async () => { fireEvent.pointerUp(document, ptr(550, 950)); });
    renders.stop();
}

/** The drop's own commit, and the first commit the sheet drew in. */
function order() {
    const commits = renders.commits();
    return {
        drop: commits.findIndex(c => c.has('DeckDndProvider')),
        sheet: commits.findIndex(c => c.has('HeroSheetStandIn'))
    };
}

describe('⭐ the hero sheet an equip drop opens', () => {
    it('a drop on a hero in the bar: the drop commits first, the sheet after it', async () => {
        const view = render(h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null, h(Item), h(BottomHeroDock, { selectedHeroId: null }), h(SheetHost))));
        await dropOn(view, view.container.querySelector('[data-dock-hero="h1"]'));

        expect(engine.EquipmentManager.equipItem).toHaveBeenCalledWith('h1', 'item_copper_sword', null);
        expect(view.getByTestId('sheet').getAttribute('data-hero')).toBe('h1');
        const { drop, sheet } = order();
        expect(drop).toBeGreaterThanOrEqual(0);
        expect(sheet).toBeGreaterThan(drop);
    });

    it('a drop on a hero tab beside the Bank: the same', async () => {
        const view = render(h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null, h(Item), h(BankHeroPanel, { selectedHeroId: null, showTabs: true, menuRight: false }), h(SheetHost))));
        const tab = view.container.querySelector('[data-dnd-droppable-id$="-drop-h2"]');
        expect(tab).not.toBeNull();
        await dropOn(view, tab);

        expect(engine.EquipmentManager.equipItem).toHaveBeenCalledWith('h2', 'item_copper_sword', null);
        expect(view.getByTestId('sheet').getAttribute('data-hero')).toBe('h2');
        const { drop, sheet } = order();
        expect(drop).toBeGreaterThanOrEqual(0);
        expect(sheet).toBeGreaterThan(drop);
    });

    it('a click on a hero still opens the sheet in the click\'s own commit', () => {
        const view = render(h(SheetHost));
        act(() => {
            // A click is a discrete event: its updates are drawn before it returns.
            flushSync(() => { EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId: 'h1' }); });
            expect(view.queryByTestId('sheet')?.getAttribute('data-hero')).toBe('h1');
        });
    });
});
