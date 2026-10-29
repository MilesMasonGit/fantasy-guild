// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

vi.mock('../systems/board/Flags.js', () => ({
    statusOf: () => ({ state: 'docked', instanceId: null, typeId: null, limping: false })
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

import { GameState } from '../state/GameState.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setPortraitCutter, PORTRAIT_PX } from '../ui/components/dock/heroPortrait.js';

const h = React.createElement;
const hero = (id, name, spriteId) => ({
    id, name, spriteId, hp: { current: 100, max: 100 }, status: 'idle', equipment: {}, skills: {}, flagRules: {}
});

/** Every sheet the stand-in cutter was asked for. jsdom has no canvas, so the cut is stood in for. */
const cuts = [];

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [
        hero('h1', 'Aldric', 'fighter'),
        hero('h2', 'Brenna', 'wizard'),
        hero('h3', 'Corin', 'fighter'),
        hero('h4', 'Dena', 'hm_bard_por')
    ];
    cuts.length = 0;
    setPortraitCutter((src) => { cuts.push(src); return `data:image/png;cut=${src}`; });
});
afterEach(() => { cleanup(); setPortraitCutter(null); });

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

/**
 * The hero tabs beside the Bank show each hero as their own class's portrait (the head and
 * shoulders of the idle frame, facing left, crisp, cut once per sheet) and their name.
 */
describe('the Bank hero tabs: portrait and name', () => {
    it('cuts each tab portrait from the class sheet of the hero, once per sheet, at a whole 2x', async () => {
        const view = render(h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false })));
        await settle();
        const img = (id) => view.container.querySelector(`[data-dock-hero-id="${id}"] [data-hero-tab-portrait] img`);
        expect(img('h1').getAttribute('src')).toBe('data:image/png;cut=/assets/heroes/hn_fighter_sheet.png');
        expect(img('h2').getAttribute('src')).toBe('data:image/png;cut=/assets/heroes/hn_wizard_sheet.png');
        expect(img('h3').getAttribute('src')).toBe(img('h1').getAttribute('src'));
        expect(cuts).toEqual(['/assets/heroes/hn_fighter_sheet.png', '/assets/heroes/hn_wizard_sheet.png']);
        expect(PORTRAIT_PX).toBe(48);
        expect(img('h1').style.width).toBe('48px');
        expect(img('h1').style.height).toBe('48px');
        expect(img('h1').style.imageRendering).toBe('pixelated');
        // The cut already faces left; a hero with no sheet keeps their still portrait, turned left.
        expect(img('h1').style.transform).toBe('');
        expect(img('h4').getAttribute('src')).toBe('/assets/heroes/hm_bard_por.png');
        expect(img('h4').style.transform).toBe('scaleX(-1)');
    });
});
