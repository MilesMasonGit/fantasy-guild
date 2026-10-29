// @vitest-environment jsdom
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
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { hallCameraSides } from './fixtures/hallCameraSides.js';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { dockHeroDragPayload } from '../ui/components/dock/DockHeroFigure.jsx';
import {
    DOCK_STRIP_PX, dockArtPx, dockArtOffset, hpPercent, hpTone, ROSTER_STATE_CLASS,
    ROSTER_FLAG_PX, rosterFlagPlace
} from '../ui/components/dock/dockHeroView.js';
import { flagFill } from '../systems/board/FlagColours.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { drawnPoint } from './fixtures/drawnPoint.js';

const h = React.createElement;

const hero = (id, name, hp = 100, extra = {}) => ({
    id, name, spriteId: 'hn_recruit_por', hp: { current: hp, max: 100 }, status: 'idle', equipment: {}, ...extra
});


function mount(props = {}) {
    return render(
        h(DeckDndProvider, null,
                h(BottomHeroDock, { selectedHeroId: null, ...props }))
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
 * in it**. Full-size idle art cut at the waist, a name and HP bar over each
 * head. Since hero orders (brief 260 O1) it is the roster: every hero is on the
 * mat, so none sinks or darkens; each says whether they are idle, busy or hurt.
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
        expect(drawnPoint(art).y).toBe(64);
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

    it('every hero is on the mat: no art sinks or darkens; each says idle, busy or hurt', () => {
        STATUS.set('h2', 'working');
        const view = mount();
        const home = figure(view, 'h1');
        const out = figure(view, 'h2');
        for (const f of [home, out]) {
            const art = f.querySelector('[data-dock-art]');
            expect(art.style.transform).toBe('translateY(0px)');
            expect(art.style.filter).toBe('');
        }
        expect(home.getAttribute('data-dock-state')).toBe('idle');
        expect(out.getAttribute('data-dock-state')).toBe('busy');
        expect(figure(view, 'h3').getAttribute('data-dock-state')).toBe('hurt');
        const word = (f) => f.querySelector('[data-dock-state-word]');
        expect(word(home).textContent).toBe('Idle');
        expect(word(home).className).toContain(ROSTER_STATE_CLASS.idle);
        expect(word(out).textContent).toBe('Busy');
        expect(word(figure(view, 'h3')).textContent).toBe('Hurt');

        // Labels at one height for everybody.
        expect(labelOf(out).style.bottom).toBe(labelOf(home).style.bottom);
    });

    it('lifts on hover, every hero alike', () => {
        STATUS.set('h2', 'working');
        const view = mount();
        const home = figure(view, 'h1');
        fireEvent.mouseEnter(home);
        expect(home.getAttribute('data-dock-hover')).toBe('true');
        expect(Number(home.getAttribute('data-dock-art-offset'))).toBeLessThan(0);
        fireEvent.mouseLeave(home);
        expect(home.getAttribute('data-dock-hover')).toBe('false');
        expect(Number(home.getAttribute('data-dock-art-offset'))).toBe(0);

        const out = figure(view, 'h2');
        fireEvent.mouseEnter(out);
        expect(Number(out.getAttribute('data-dock-art-offset'))).toBe(dockArtOffset(128, { hovered: true }));
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

    it('updates when a hero is given an order and sent home', async () => {
        const view = mount();
        expect(figure(view, 'h1').getAttribute('data-dock-state')).toBe('idle');
        STATUS.set('h1', 'working');
        // An order or a defeat says HERO_MOVED; useGameState batches its update onto a microtask.
        await act(async () => { EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-state')).toBe('busy');
        STATUS.delete('h1');
        await act(async () => { EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-state')).toBe('idle');
    });

    it('updates the HP bar when hp is mutated in place and heroes_updated fires (CR3-300)', async () => {
        const view = mount();
        expect(figure(view, 'h1').querySelector('[data-dock-hp]').getAttribute('data-dock-hp')).toBe('100');
        // The engine mutates state IN PLACE: same hp object, new current value.
        const h1 = GameState.state.heroes.find(h => h.id === 'h1');
        h1.hp.current = 43;
        await act(async () => { EventBus.publish('heroes_updated', {}); await Promise.resolve(); });
        expect(figure(view, 'h1').querySelector('[data-dock-hp]').getAttribute('data-dock-hp')).toBe('43');
    });

    // On the table side of the Hall camera, which is gone while the camera rests on the sky.
    it('is not shown on the Guild Hall screen (FB-47)', () => {
        expect(hallCameraSides().mat).toContain('<BottomHeroDock');
    });

    it('leaves the vertical hero panel beside the Bank as it was', () => {
        const view = render(
            h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false }))
        );
        expect(view.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(3);
        expect(view.container.querySelector('[data-dock-hero]')).toBeNull();
    });

    it('the Bank hero tab\'s tooltip HP also updates on an in-place mutation (CR3-300)', async () => {
        const view = render(
            h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false }))
        );
        const face = view.container.querySelector('[data-dock-hero-id="h1"] [data-hero-tab-face]');
        const h1 = GameState.state.heroes.find(h => h.id === 'h1');
        h1.hp.current = 43;
        await act(async () => { EventBus.publish('heroes_updated', {}); await Promise.resolve(); });
        fireEvent.mouseEnter(face);
        expect(document.body.querySelector('[data-top-bar-tip]').textContent).toContain('43 / 100 HP');
        fireEvent.mouseLeave(face);
    });
});

/** Each hero on the roster carries their job flag, in their own colour, at their shoulder. */
describe('the hero bar shows each hero’s flag', () => {
    const flagOf = (view, id) => figure(view, id).querySelector(`[data-dock-flag="${id}"]`);
    const fillOf = (el) => { const svgs = el.querySelectorAll('[data-flag-mark] svg'); return svgs[svgs.length - 1].getAttribute('fill'); };

    it('each hero’s flag is in their own colour, 24 px, inside their figure', () => {
        GameState.state.heroes[0].flagColour = 'reddark';
        GameState.state.heroes[1].flagColour = 'bluelite';
        const view = mount();
        for (const [id, colour] of [['h1', 'reddark'], ['h2', 'bluelite']]) {
            const flag = flagOf(view, id);
            expect(flag).not.toBeNull();
            expect(flag.style.width).toBe(`${ROSTER_FLAG_PX}px`);
            expect(flag.querySelector('[data-flag-mark]').getAttribute('data-flag-colour')).toBe(colour);
            expect(fillOf(flag)).toBe(flagFill(colour));
        }
        // A hero with no colour carries the pale flag.
        expect(fillOf(flagOf(view, 'h3'))).toBe(flagFill(null));
    });

    it('stands at the shoulder: beside the head, below the name, HP bar and state word', () => {
        const view = mount();
        const flag = flagOf(view, 'h1');
        const place = rosterFlagPlace(128);
        expect(flag.style.left).toBe(`calc(50% + ${place.left}px)`);
        expect(parseFloat(flag.style.bottom)).toBe(place.bottom);
        // Its top is below the labels' bottom edge, and inside the strip.
        expect(place.bottom + ROSTER_FLAG_PX).toBeLessThanOrEqual(parseFloat(labelOf(figure(view, 'h1')).style.bottom));
        expect(place.bottom).toBeGreaterThanOrEqual(0);
        expect(place.bottom + ROSTER_FLAG_PX).toBeLessThanOrEqual(DOCK_STRIP_PX);
        expect(flag.className).toContain('pointer-events-none');
    });

    it('lifts and lights with the hero on hover', () => {
        const view = mount();
        const fig = figure(view, 'h1');
        const flag = flagOf(view, 'h1');
        expect(flag.querySelector('[data-flag-mark]').getAttribute('data-sprite-outline')).toBeNull();
        fireEvent.mouseEnter(fig);
        expect(flag.style.transform).toBe(`translateY(${dockArtOffset(128, { hovered: true })}px)`);
        expect(flag.querySelector('[data-flag-mark]').getAttribute('data-sprite-outline')).toBe('hover');
        fireEvent.mouseLeave(fig);
        expect(flag.style.transform).toBe('translateY(0px)');
    });

    it('a colour change repaints the hero’s flag on the bar', async () => {
        GameState.state.heroes[0].flagColour = 'reddark';
        const view = mount();
        GameState.state.heroes[0].flagColour = 'yelpur';
        await act(async () => { EventBus.publish('heroes_updated', {}); await Promise.resolve(); });
        expect(fillOf(flagOf(view, 'h1'))).toBe(flagFill('yelpur'));
    });
});
