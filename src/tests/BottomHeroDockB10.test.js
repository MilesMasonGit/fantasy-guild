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
import { BottomHeroDock, showsBottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { dockHeroDragPayload } from '../ui/components/dock/DockHeroFigure.jsx';
import { DOCK_STRIP_PX, dockArtFilter, hpPercent, hpTone, isDeployedStatus } from '../ui/components/dock/dockHeroView.js';
import { setPortraitCutter, PORTRAIT_PX } from '../ui/components/dock/heroPortrait.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

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
const portraitOf = (el) => el.querySelector('[data-dock-portrait]');

/** Every sheet the stand-in cutter was asked to cut. jsdom has no canvas, so the cut is stood in for. */
const cuts = [];

beforeEach(() => {
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [
        hero('h1', 'Aldric', 100),
        hero('h2', 'Brenna', 40),
        hero('h3', 'Corin', 10, { status: 'wounded' })
    ];
    setLiveMatFit(1);
    cuts.length = 0;
    setPortraitCutter((src) => { cuts.push(src); return `data:image/png;cut=${src}`; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); setPortraitCutter(null); });

/**
 * ⭐ **The horizontal hero bar: each hero a portrait and a name, nothing else.** The portrait is
 * the head and shoulders of the hero's own class sheet, cut once and facing left; deployed heroes
 * are darkened. HP, wounds and the rest live in the hero panel.
 */
describe('B10 horizontal hero dock', () => {
    it('draws one figure per hero, each a portrait and a name and nothing else', () => {
        const view = mount();
        const figs = view.container.querySelectorAll('[data-dock-hero]');
        expect([...figs].map(f => f.getAttribute('data-dock-hero'))).toEqual(['h1', 'h2', 'h3']);
        for (const f of figs) {
            expect(f.querySelector('[data-dock-name]')).not.toBeNull();
            expect(portraitOf(f)).not.toBeNull();
            expect(f.querySelector('[data-dock-hp]')).toBeNull();
            // No animated sprite in the bar.
            expect(f.querySelector('[data-hero-row]')).toBeNull();
        }
        expect(figure(view, 'h1').querySelector('[data-dock-name]').textContent).toBe('Aldric');
        // The wounded hero's name carries no extra mark.
        expect(figure(view, 'h3').querySelector('[data-dock-name]').textContent).toBe('Corin');
        expect(view.container.querySelector('[data-bottom-hero-dock]').style.height).toBe(`${DOCK_STRIP_PX}px`);
    });

    it('cuts each portrait from the class sheet of the hero, once per sheet, at a whole 2x', async () => {
        GameState.state.heroes = [
            hero('h1', 'Aldric', 100, { spriteId: 'fighter' }),
            hero('h2', 'Brenna', 100, { spriteId: 'wizard' }),
            hero('h3', 'Corin', 100, { spriteId: 'fighter' })
        ];
        setLiveMatFit(1.5);
        const view = mount();
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });
        const img = (id) => portraitOf(figure(view, id)).querySelector('img');
        expect(portraitOf(figure(view, 'h1')).getAttribute('data-dock-portrait')).toBe('assets/heroes/hn_fighter_sheet.png');
        expect(img('h1').getAttribute('src')).toBe('data:image/png;cut=/assets/heroes/hn_fighter_sheet.png');
        expect(img('h2').getAttribute('src')).toBe('data:image/png;cut=/assets/heroes/hn_wizard_sheet.png');
        expect(img('h3').getAttribute('src')).toBe(img('h1').getAttribute('src'));
        // Two fighters, one cut.
        expect(cuts).toEqual(['/assets/heroes/hn_fighter_sheet.png', '/assets/heroes/hn_wizard_sheet.png']);
        // Whatever the mat's fit: 24 art pixels at 2x, crisp, and the cut already faces left.
        expect(PORTRAIT_PX).toBe(48);
        expect(img('h1').style.width).toBe('48px');
        expect(img('h1').style.height).toBe('48px');
        expect(img('h1').style.imageRendering).toBe('pixelated');
        expect(img('h1').style.transform).toBe('');
    });

    it('darkens a deployed hero portrait, but not its name', () => {
        STATUS.set('h2', 'working');
        const view = mount();
        const home = figure(view, 'h1');
        const out = figure(view, 'h2');
        expect(home.getAttribute('data-dock-deployed')).toBe('false');
        expect(out.getAttribute('data-dock-deployed')).toBe('true');
        expect(portraitOf(home).style.filter).toBe('');
        expect(portraitOf(out).style.filter).toBe('brightness(0.4)');
        expect(out.querySelector('[data-dock-name]').className).toBe(home.querySelector('[data-dock-name]').className);
    });

    it('counts walking home as deployed, the Dock as home', () => {
        expect(isDeployedStatus('returning')).toBe(true);
        expect(isDeployedStatus('idle')).toBe(true);
        expect(isDeployedStatus('walking')).toBe(true);
        expect(isDeployedStatus('working')).toBe(true);
        expect(isDeployedStatus('docked')).toBe(false);
    });

    it('outlines the portrait in white on hover; a deployed hero brightens partway', () => {
        STATUS.set('h2', 'idle');
        const view = mount();
        const home = figure(view, 'h1');
        fireEvent.mouseEnter(home);
        expect(home.getAttribute('data-dock-hover')).toBe('true');
        expect(portraitOf(home).style.filter).toContain('drop-shadow(2px 0 0 #fff)');
        expect(portraitOf(home).style.filter).not.toContain('brightness');
        fireEvent.mouseLeave(home);
        expect(home.getAttribute('data-dock-hover')).toBe('false');
        expect(portraitOf(home).style.filter).toBe('');

        const out = figure(view, 'h2');
        fireEvent.mouseEnter(out);
        expect(portraitOf(out).style.filter.startsWith('brightness(0.7) drop-shadow(')).toBe(true);
        expect(dockArtFilter({ deployed: true })).toBe('brightness(0.4)');
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

    it('keeps the HP tones for the Bank hero tabs; the bar marks a wounded hero only in its data', () => {
        expect(hpTone(100)).toBe('green');
        expect(hpTone(51)).toBe('green');
        expect(hpTone(50)).toBe('amber');
        expect(hpTone(21)).toBe('amber');
        expect(hpTone(20)).toBe('red');
        expect(hpTone(0)).toBe('red');
        expect(hpPercent({ current: 30, max: 60 })).toBe(50);
        expect(hpPercent({ current: -5, max: 60 })).toBe(0);

        const view = mount();
        expect(figure(view, 'h3').getAttribute('data-dock-wounded')).toBe('true');
        expect(figure(view, 'h1').getAttribute('data-dock-wounded')).toBeNull();
    });

    it('updates when a hero goes out and comes home', async () => {
        const view = mount();
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('false');
        STATUS.set('h1', 'working');
        // A plant or a recall says HERO_MOVED; useGameState batches its update onto a microtask.
        await act(async () => { EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('true');
        STATUS.delete('h1');
        await act(async () => { EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('false');
        STATUS.set('h1', 'working');
        await act(async () => { EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }); await Promise.resolve(); });
        expect(figure(view, 'h1').getAttribute('data-dock-deployed')).toBe('true');
    });

    it('is not shown on the Guild Hall screen (FB-47)', () => {
        expect(showsBottomHeroDock('guild')).toBe(false);
        expect(showsBottomHeroDock(null)).toBe(true);
    });

    it('leaves the vertical hero panel beside the Bank as it was', () => {
        const view = render(
            h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false }))
        );
        expect(view.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(3);
        expect(view.container.querySelector('[data-dock-hero]')).toBeNull();
    });

    it('the Bank hero panel\'s HP bar also updates on an in-place mutation (CR3-300)', async () => {
        const view = render(
            h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false }))
        );
        const tab = view.container.querySelector('[data-dock-hero-id="h1"]');
        const fill = () => tab.querySelector('[data-hero-tab-hp]');
        expect(fill().style.width).toBe('100%');
        const h1 = GameState.state.heroes.find(h => h.id === 'h1');
        h1.hp.current = 43;
        await act(async () => { EventBus.publish('heroes_updated', {}); await Promise.resolve(); });
        expect(fill().style.width).toBe('43%');
    });
});
