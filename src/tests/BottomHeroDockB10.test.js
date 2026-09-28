import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

// Which heroes are out on the mat: stood in, so no board has to be booted.
const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));
// The sheet is its own component; these tests are about the strip.
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock, showsBottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { dockHeroDragPayload } from '../ui/components/dock/DockHeroFigure.jsx';
import {
    DOCK_STRIP_PX, dockArtPx, dockArtOffset, dockArtFilter, hpPercent, hpTone, isDeployedStatus
} from '../ui/components/dock/dockHeroView.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

const h = React.createElement;

const hero = (id, name, hp = 100, extra = {}) => ({
    id, name, spriteId: 'hero_recruit_0', hp: { current: hp, max: 100 }, status: 'idle', equipment: {}, ...extra
});

const engine = {
    GameState,
    EventBus,
    BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: { equipItem: vi.fn() },
    HeroAssignmentManager: { unassignHero: vi.fn() }
};

function mount(props = {}) {
    return render(
        h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null,
                h(BottomHeroDock, { selectedHeroId: null, ...props })))
    );
}

const figure = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
const labelOf = (el) => el.querySelector('[data-dock-label]');

beforeEach(() => {
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [
        hero('h1', 'Aldric', 100),
        hero('h2', 'Brenna', 40),
        hero('h3', 'Corin', 10, { status: 'wounded' })
    ];
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

/**
 * ⭐ **B10: the horizontal hero dock is a dark strip with the heroes standing
 * in it** (FB-46). Full-size idle art cut at the waist, a name and HP bar over
 * each head, deployed heroes darkened and sunk while their labels stay put.
 */
describe('B10 horizontal hero dock', () => {
    it('draws one figure per hero, each with a name and an HP bar', () => {
        const view = mount();
        const figs = view.container.querySelectorAll('[data-dock-hero]');
        expect([...figs].map(f => f.getAttribute('data-dock-hero'))).toEqual(['h1', 'h2', 'h3']);
        for (const f of figs) {
            expect(f.querySelector('[data-dock-name]')).not.toBeNull();
            expect(f.querySelector('[data-dock-hp]')).not.toBeNull();
        }
        expect(figure(view, 'h1').querySelector('[data-dock-name]').textContent).toContain('Aldric');
        expect(figure(view, 'h2').querySelector('[data-dock-hp]').getAttribute('data-dock-hp')).toBe('40');
    });

    it('reuses the mat\'s idle hero sprite at the mat\'s art size, cut at the strip edge', () => {
        setLiveMatFit(1);
        const view = mount();
        const art = figure(view, 'h1').querySelector('[data-dock-art]');
        const sprite = art.querySelector('[data-hero-row]');
        expect(sprite).not.toBeNull();
        expect(sprite.getAttribute('data-hero-row')).toBe('idle');
        // At a fit of 1 the mat draws heroes at 2 × 64 px.
        expect(sprite.style.width).toBe('128px');
        // The frame's top half shows: it starts half an art above the edge.
        expect(art.style.top).toBe('64px');
        expect(view.container.querySelector('[data-bottom-hero-dock]').style.height).toBe(`${DOCK_STRIP_PX}px`);
    });

    it('follows the mat\'s art steps (FP-99)', () => {
        expect(dockArtPx(0.5)).toBe(128);   // floor of two steps (B10: 'full size')
        expect(dockArtPx(1)).toBe(128);
        expect(dockArtPx(1.5)).toBe(192);
        setLiveMatFit(0.5);
        const view = mount();
        expect(view.container.querySelector('[data-bottom-hero-dock]').getAttribute('data-dock-art-px')).toBe('128');
    });

    it('darkens and lowers a deployed hero\'s art, but not its name and HP bar', () => {
        STATUS.set('h2', 'working');
        const view = mount();
        const home = figure(view, 'h1');
        const out = figure(view, 'h2');
        expect(home.getAttribute('data-dock-deployed')).toBe('false');
        expect(out.getAttribute('data-dock-deployed')).toBe('true');

        const homeArt = home.querySelector('[data-dock-art]');
        const outArt = out.querySelector('[data-dock-art]');
        expect(homeArt.style.transform).toBe('translateY(0px)');
        expect(homeArt.style.filter).toBe('');
        expect(outArt.style.transform).toBe(`translateY(${dockArtOffset(128, { deployed: true })}px)`);
        expect(dockArtOffset(128, { deployed: true })).toBeGreaterThanOrEqual(20);
        expect(outArt.style.filter).toBe('brightness(0.4)');

        // Labels at one height for everybody.
        expect(labelOf(out).style.bottom).toBe(labelOf(home).style.bottom);
    });

    it('counts walking home as deployed, the Dock as home', () => {
        expect(isDeployedStatus('returning')).toBe(true);
        expect(isDeployedStatus('idle')).toBe(true);
        expect(isDeployedStatus('walking')).toBe(true);
        expect(isDeployedStatus('working')).toBe(true);
        expect(isDeployedStatus('docked')).toBe(false);
    });

    it('lifts on hover; a deployed hero rises partway out of the dark', () => {
        STATUS.set('h2', 'idle');
        const view = mount();
        const home = figure(view, 'h1');
        fireEvent.mouseEnter(home);
        expect(home.getAttribute('data-dock-hover')).toBe('true');
        expect(Number(home.getAttribute('data-dock-art-offset'))).toBeLessThan(0);
        fireEvent.mouseLeave(home);
        expect(home.getAttribute('data-dock-hover')).toBe('false');
        expect(Number(home.getAttribute('data-dock-art-offset'))).toBe(0);

        const out = figure(view, 'h2');
        const sunk = Number(out.getAttribute('data-dock-art-offset'));
        fireEvent.mouseEnter(out);
        const risen = Number(out.getAttribute('data-dock-art-offset'));
        expect(risen).toBeGreaterThan(0);
        expect(risen).toBeLessThan(sunk);
        expect(dockArtFilter({ deployed: true, hovered: true })).toBe('brightness(0.7)');
        // The labels never move.
        const labelBefore = labelOf(home).style.bottom;
        fireEvent.mouseEnter(home);
        expect(labelOf(home).style.bottom).toBe(labelBefore);
    });

    it('click and double-click call the existing handlers', () => {
        const onSelectHero = vi.fn();
        const onDoubleClickHero = vi.fn();
        const view = mount({ onSelectHero, onDoubleClickHero });
        fireEvent.click(figure(view, 'h2'));
        expect(onSelectHero).toHaveBeenCalledWith('h2');
        fireEvent.doubleClick(figure(view, 'h3'));
        expect(onDoubleClickHero).toHaveBeenCalledWith('h3');
    });

    it('drags the same payload the old dock tab did', () => {
        const hr = hero('h1', 'Aldric');
        // The old HeroDockTab payload, verbatim.
        const old = {
            kind: DRAG_KIND.HERO,
            heroId: 'h1',
            name: hr?.name,
            spriteId: hr?.spriteId || hr?.icon || hr?.heroSprite || hr?.classId,
            from: { dock: true }
        };
        expect(dockHeroDragPayload('h1', hr)).toEqual(old);
        expect(dockHeroDragPayload('h9', { classId: 'fighter' }).spriteId).toBe('fighter');
    });

    it('marks the selected hero', () => {
        const view = mount({ selectedHeroId: 'h1' });
        expect(figure(view, 'h1').getAttribute('data-dock-selected')).toBe('true');
        expect(figure(view, 'h2').getAttribute('data-dock-selected')).toBeNull();
    });

    it('colours the HP bar green, amber, red; wounded heroes are marked', () => {
        expect(hpTone(100)).toBe('green');
        expect(hpTone(51)).toBe('green');
        expect(hpTone(50)).toBe('amber');
        expect(hpTone(21)).toBe('amber');
        expect(hpTone(20)).toBe('red');
        expect(hpTone(0)).toBe('red');
        expect(hpPercent({ current: 30, max: 60 })).toBe(50);
        expect(hpPercent({ current: -5, max: 60 })).toBe(0);

        const view = mount();
        const tone = id => figure(view, id).querySelector('[data-dock-hp]').getAttribute('data-dock-hp-tone');
        expect(tone('h1')).toBe('green');
        expect(tone('h2')).toBe('amber');
        expect(tone('h3')).toBe('red');
        expect(figure(view, 'h3').getAttribute('data-dock-wounded')).toBe('true');
        expect(figure(view, 'h1').getAttribute('data-dock-wounded')).toBeNull();
    });

    it('updates when a hero goes out and comes home', async () => {
        const view = mount();
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('false');
        STATUS.set('h1', 'working');
        // useGameState batches its update onto a microtask.
        await act(async () => { EventBus.publish('state_changed', {}); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('true');
        STATUS.delete('h1');
        await act(async () => { EventBus.publish('state_changed', {}); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('false');
        STATUS.set('h1', 'working');
        await act(async () => { EventBus.publish('state_changed', {}); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('true');
    });

    it('is not shown on the Guild Hall screen (FB-47)', () => {
        expect(showsBottomHeroDock('guild')).toBe(false);
        expect(showsBottomHeroDock(null)).toBe(true);
    });

    it('leaves the vertical hero panel beside the Bank as it was', () => {
        const view = render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false })))
        );
        expect(view.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(3);
        expect(view.container.querySelector('[data-dock-hero]')).toBeNull();
    });
});
