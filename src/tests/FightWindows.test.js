// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import {
    openFightPanel, closeFightPanel, toggleFightPanel, minimizeFightPanel, restoreFightPanel, raiseFightPanel,
    moveFightPanel, fightWindows, openFightWindows, fightTabs, fightPanelState, isFightPanelOpen, resetFightPanels
} from '../ui/components/combat/fightPanelStore.js';
import { FightPanelPopup, keepOnScreen, panelPlace } from '../ui/components/combat/FightPanelPopup.jsx';
import { FightTabStrip } from '../ui/components/combat/FightTab.jsx';
import { CombatKit } from '../ui/dev/CombatKit.jsx';
import { pushEscapeLayer, escapeLayerCount } from '../ui/utils/escapeLayers.js';

/**
 * The fight windows (brief 360 C2; owner's picks 2026-11-05): one per hero, several open at once,
 * minimized to a tab (only then a tab), the hero's window kept until closed, Escape closing the
 * top one, one layer at a time.
 */

const ids = (list) => list.map(w => w.heroId);
const escape = () => act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });

afterEach(() => {
    cleanup();
    resetFightPanels();
});

describe('the window store', () => {
    it('⭐ several windows open at once, one per hero; the last opened is on top', () => {
        openFightPanel('kira');
        openFightPanel('aela');
        openFightPanel('bram');
        expect(ids(openFightWindows())).toEqual(['kira', 'aela', 'bram']);
        expect(fightPanelState().heroId).toBe('bram');
        // A hero has one window: opening it again brings it to the top, it does not add one.
        openFightPanel('kira');
        expect(fightWindows()).toHaveLength(3);
        expect(ids(openFightWindows())).toEqual(['aela', 'bram', 'kira']);
    });

    it('⭐ only a minimized window has a tab, in the order they were minimized', () => {
        openFightPanel('kira');
        openFightPanel('aela');
        openFightPanel('bram');
        expect(fightTabs()).toEqual([]);
        minimizeFightPanel('bram');
        minimizeFightPanel('kira');
        expect(ids(fightTabs())).toEqual(['bram', 'kira']);
        expect(ids(openFightWindows())).toEqual(['aela']);
        expect(isFightPanelOpen('kira')).toBe(false);
        // Brought back: its tab goes, it is on top again, where it was.
        moveFightPanel('bram', 300, 120);
        restoreFightPanel('bram');
        expect(ids(fightTabs())).toEqual(['kira']);
        expect(fightPanelState()).toMatchObject({ heroId: 'bram', x: 300, y: 120, minimized: false });
    });

    it('the fight button: opens, closes an open window, and brings back a minimized one', () => {
        toggleFightPanel('kira', { left: 10, top: 10, right: 42, bottom: 42 }, -1);
        expect(fightPanelState()).toMatchObject({ heroId: 'kira', away: -1, anchor: { left: 10, right: 42 } });
        toggleFightPanel('kira');
        expect(fightWindows()).toEqual([]);
        openFightPanel('kira');
        minimizeFightPanel('kira');
        toggleFightPanel('kira');
        expect(isFightPanelOpen('kira')).toBe(true);
        expect(fightTabs()).toEqual([]);
    });

    it('closing one window leaves the others; a minimized one closes too', () => {
        openFightPanel('kira');
        openFightPanel('aela');
        minimizeFightPanel('aela');
        closeFightPanel('kira');
        expect(ids(fightWindows())).toEqual(['aela']);
        closeFightPanel('aela');
        expect(fightWindows()).toEqual([]);
    });

    it('pressing a window brings it to the top; moving it keeps whole pixels', () => {
        openFightPanel('kira');
        openFightPanel('aela');
        raiseFightPanel('kira');
        expect(fightPanelState().heroId).toBe('kira');
        moveFightPanel('kira', 100.4, 50.6);
        expect(fightPanelState()).toMatchObject({ x: 100, y: 51 });
    });
});

describe('Escape with fight windows open', () => {
    it('⭐ closes the top window, one at a time, and leaves the tabs alone', () => {
        render(React.createElement(FightPanelPopup));
        act(() => { openFightPanel('kira'); openFightPanel('aela'); openFightPanel('bram'); });
        act(() => { minimizeFightPanel('aela'); });
        escape();
        expect(ids(fightWindows())).toEqual(['kira', 'aela']);
        escape();
        expect(ids(fightWindows())).toEqual(['aela']);
        // Only a tab is left: no layer, Escape closes nothing here.
        expect(escapeLayerCount()).toBe(0);
        escape();
        expect(ids(fightTabs())).toEqual(['aela']);
    });

    it('a layer opened over the windows closes first; a window pressed to the top is the top layer again', () => {
        render(React.createElement(FightPanelPopup));
        act(() => { openFightPanel('kira'); openFightPanel('aela'); });
        let cardOpen = true;
        let removeCard = null;
        act(() => { removeCard = pushEscapeLayer(() => { cardOpen = false; removeCard(); }); });
        escape();
        expect(cardOpen).toBe(false);
        expect(fightWindows()).toHaveLength(2);
        act(() => { raiseFightPanel('kira'); });
        escape();
        expect(ids(fightWindows())).toEqual(['aela']);
        escape();
        expect(fightWindows()).toEqual([]);
    });
});

describe('where a window stands', () => {
    it('a new window opens beside its button, inside the screen', () => {
        const chip = { left: 500, top: 400, right: 532, bottom: 432 };
        expect(panelPlace(chip, -1, 356, 600, 1920, 1080).left).toBe(500 - 10 - 356);
        expect(panelPlace(chip, 1, 356, 600, 1920, 1080).left).toBe(532 + 10);
        expect(panelPlace({ ...chip, top: 1000, bottom: 1032 }, 1, 356, 600, 1920, 1080).top).toBe(1080 - 12 - 600);
    });

    it('a dragged window stays on the screen', () => {
        expect(keepOnScreen(-50, 20, 356, 600, 1920, 1080)).toEqual({ left: 0, top: 20 });
        expect(keepOnScreen(1800, 900, 356, 600, 1920, 1080)).toEqual({ left: 1920 - 356, top: 1080 - 600 });
        expect(keepOnScreen(10.6, 10.2, 356, 600, 1920, 1080)).toEqual({ left: 11, top: 10 });
    });
});

describe('the tab strip', () => {
    it('⭐ a tab: both faces, both names, both healths with their numbers; Won in place of the enemy after a win', () => {
        const { container } = render(React.createElement(CombatKit));
        const tabs = [...container.querySelectorAll('[data-kit-combat="tabs"] [data-fight-tab]')];
        expect(tabs).toHaveLength(2);
        const hp = (tab, who) => tab.querySelector(`[data-fight-tab-hp="${who}"]`).textContent;
        expect([hp(tabs[0], 'hero'), hp(tabs[0], 'enemy')]).toEqual(['17/30', '24/40']);
        expect(tabs[0].querySelector('[data-fight-tab-enemy]').textContent).toBe('Goblin Warlord');
        expect(tabs[1].querySelector('[data-fight-tab-enemy]')).toBeNull();
        expect(tabs[1].querySelector('[data-fight-tab-result]').getAttribute('data-fight-tab-result')).toBe('won');
        expect(hp(tabs[1], 'enemy')).toBe('0/25');
        expect(tabs[0].querySelectorAll('img').length).toBe(2);
    });

    it('draws nothing until a window is minimized', () => {
        const { container } = render(React.createElement(FightTabStrip));
        act(() => { openFightPanel('kira'); });
        expect(container.querySelector('[data-fight-tabs]')).toBeNull();
        act(() => { minimizeFightPanel('kira'); });
        expect(container.querySelector('[data-fight-tabs]')).not.toBeNull();
    });
});
