// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { selectHero, clearSelection, getSelection } from '../ui/hooks/useMatSelection.js';

/**
 * ⭐ **The hero bar selects** (brief 610 S1). A single click on a hero's card selects them (a gold
 * outline on the card, as on the mat); a double-click opens their Hero drawer. The click no longer
 * opens or closes the drawer by itself.
 */

const h = React.createElement;
const hero = (id, name) => ({ id, name, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'idle', equipment: {} });
const figure = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"]`);

function mount(props = {}) {
    return render(h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null, ...props })));
}

beforeEach(() => {
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric'), hero('h2', 'Brenna')];
    setLiveMatFit(1);
    clearSelection();
});
afterEach(() => { cleanup(); clearSelection(); });

describe('⭐ the hero bar', () => {
    it('a single click hands the bar\'s select, a double-click its inspect', () => {
        const onSelectHero = vi.fn();
        const onDoubleClickHero = vi.fn();
        const view = mount({ onSelectHero, onDoubleClickHero });
        fireEvent.click(figure(view, 'h1'));
        expect(onSelectHero).toHaveBeenCalledWith('h1');
        expect(onDoubleClickHero).not.toHaveBeenCalled();
        fireEvent.doubleClick(figure(view, 'h1'));
        expect(onDoubleClickHero).toHaveBeenCalledWith('h1');
    });

    it('the selected hero\'s card is marked picked; a new pick moves the mark', () => {
        const view = mount({ onSelectHero: selectHero });
        expect(figure(view, 'h1').getAttribute('data-dock-picked')).toBeNull();
        act(() => { fireEvent.click(figure(view, 'h1')); });
        expect(getSelection()).toEqual({ kind: 'hero', id: 'h1' });
        expect(figure(view, 'h1').getAttribute('data-dock-picked')).toBe('true');
        act(() => { fireEvent.click(figure(view, 'h2')); });
        expect(figure(view, 'h1').getAttribute('data-dock-picked')).toBeNull();
        expect(figure(view, 'h2').getAttribute('data-dock-picked')).toBe('true');
        act(() => clearSelection());
        expect(figure(view, 'h2').getAttribute('data-dock-picked')).toBeNull();
    });
});
