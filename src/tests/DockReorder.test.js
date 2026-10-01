// CR3-457 — BankHeroPanel accepted and highlighted a hero-reorder drop
// (HeroDockTab draws the insertion line on its own, regardless of whether
// anyone is listening) and then silently dropped it: no onReorder was ever
// passed in, unlike BottomHeroDock which already wired one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { reorderHeroInDock } from '../ui/components/dock/dockReorder.js';

describe('reorderHeroInDock — the shared logic both docks now call', () => {
    it('reorders to the target hero\'s current index', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2', 'h3'], 'h3', 'h1');
        expect(did).toBe(true);
        expect(heroManager.reorderHero).toHaveBeenCalledWith('h3', 0);
    });

    it('does nothing when the source and target are the same hero', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2'], 'h1', 'h1');
        expect(did).toBe(false);
        expect(heroManager.reorderHero).not.toHaveBeenCalled();
    });

    it('does nothing when the target is not in the list', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2'], 'h1', 'ghost');
        expect(did).toBe(false);
        expect(heroManager.reorderHero).not.toHaveBeenCalled();
    });
});

// Captures the props BankHeroPanel actually hands its hero tabs, without
// needing to drive a real dnd-kit drag (unreliable in jsdom — master plan
// R7's own finding).
const capturedTabProps = [];
vi.mock('../ui/components/dock/HeroDockTab.jsx', () => ({
    HeroDockTab: (props) => {
        capturedTabProps.push(props);
        return null;
    }
}));

const reorderHeroMock = vi.fn();
vi.mock('../systems/hero/HeroManager.js', () => ({
    HeroManager: { reorderHero: (...args) => reorderHeroMock(...args) }
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';

const h = React.createElement;
const engine = { GameState, EventBus };
const mount = (props) => render(h(EngineContext.Provider, { value: engine }, h(BankHeroPanel, props)));

beforeEach(() => {
    capturedTabProps.length = 0;
    reorderHeroMock.mockClear();
    GameState.initNew();
    GameState.state.heroes = [
        { id: 'h1', name: 'Aldric', hp: { current: 100, max: 100 }, equipment: {} },
        { id: 'h2', name: 'Brenna', hp: { current: 100, max: 100 }, equipment: {} },
        { id: 'h3', name: 'Corin', hp: { current: 100, max: 100 }, equipment: {} }
    ];
});
afterEach(cleanup);

describe('CR3-457: BankHeroPanel wires onReorder like the bottom dock', () => {
    it('passes a real onReorder to every hero tab', () => {
        mount({ menuRight: false });
        expect(capturedTabProps.length).toBe(3);
        for (const props of capturedTabProps) {
            expect(typeof props.onReorder).toBe('function');
        }
    });

    it('calling the onReorder it was given actually reorders through HeroManager', () => {
        mount({ menuRight: false });
        const h3Props = capturedTabProps.find(p => p.heroId === 'h3');
        expect(h3Props).toBeTruthy();
        h3Props.onReorder('h3', 'h1'); // drop h3 onto h1's tab
        expect(reorderHeroMock).toHaveBeenCalledWith('h3', 0);
    });
});
