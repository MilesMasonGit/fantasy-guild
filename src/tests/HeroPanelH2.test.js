// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import {
    groupHeroSkills, skillLevelText, skillXpView, setStartingDrawerOpen
} from '../ui/components/dock/heroPanelSkills.js';
import { getSkillIdsByLayer, SKILL_LAYERS } from '../config/registries/skillRegistry.js';
import { xpForLevel } from '../utils/XPCurve.js';

const h = React.createElement;

const STARTING = getSkillIdsByLayer(SKILL_LAYERS.STARTING);
const lvl = (level, extra = 0) => ({ level, xp: xpForLevel(level) + extra });
const startingSkills = (level = 5) => Object.fromEntries(STARTING.map(id => [id, lvl(level)]));

const recruit = (id, name) => ({
    id, name, spriteId: 'hero_recruit_0', hp: { current: 80, max: 100 }, status: 'idle', equipment: {},
    skills: startingSkills()
});

/** A master-class hero: combat, two advanced and a master skill on top of the Starting nine. */
const master = (id, name) => ({
    ...recruit(id, name),
    // Held out of layer order on purpose: the panel orders them, not the save.
    skills: { faith: lvl(3), ...startingSkills(), leadership: lvl(12), melee: lvl(25, 10), fletching: lvl(99) },
    bankedSkills: { ranged: lvl(30) }
});

const engine = {
    GameState,
    EventBus,
    BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: { equipItem: vi.fn(), unequipItem: vi.fn() }
};

const wrap = (...children) =>
    h(EngineContext.Provider, { value: engine }, h(DeckDndProvider, null, ...children));

const panel = (props) => wrap(h(BankHeroPanel, { menuRight: false, ...props }));

const rowIds = (root, group) =>
    [...root.querySelectorAll(`[data-skill-group="${group}"] [data-skill-row]`)].map(el => el.getAttribute('data-skill-row'));

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [master('h1', 'Aldric'), recruit('h2', 'Brenna')];
    setLiveMatFit(1);
    setStartingDrawerOpen(null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); setStartingDrawerOpen(null); });

describe('H2: one hero panel, in one place', () => {
    it('opens in the same box from the bar (Bank shut) as from the Bank', () => {
        const fromBar = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const barBox = fromBar.container.querySelector('[data-hero-panel]');
        expect(barBox).not.toBeNull();
        expect(barBox.querySelector('[data-hero-panel-body="h1"]')).not.toBeNull();
        const barPlace = { cls: barBox.className, style: barBox.getAttribute('style') };
        cleanup();

        const fromBank = render(panel({ selectedHeroId: 'h1', showTabs: true }));
        const bankBox = fromBank.container.querySelector('[data-hero-panel]');
        expect(bankBox.querySelector('[data-hero-panel-body="h1"]')).not.toBeNull();
        expect({ cls: bankBox.className, style: bankBox.getAttribute('style') }).toEqual(barPlace);
        // jsdom drops the `clamp()` width; the box is the Bank's hero column on the right.
        expect(barPlace.cls.split(' ')).toEqual(expect.arrayContaining(['absolute', 'inset-y-0', 'right-0']));
    });

    it('shows the hero tabs only beside the Bank (the bar is under it)', () => {
        const withBank = render(panel({ selectedHeroId: null, showTabs: true }));
        expect(withBank.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(2);
        cleanup();
        const shut = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        expect(shut.container.querySelectorAll('[data-hero-dock-tab]').length).toBe(0);
    });

    it('clicking a hero in the bar opens the side panel; nothing rises from the bar', () => {
        const Host = () => {
            const [sel, setSel] = React.useState(null);
            return wrap(
                h(BottomHeroDock, { selectedHeroId: sel, onSelectHero: id => setSel(p => (p === id ? null : id)) }),
                h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: sel, onCloseHero: () => setSel(null) })
            );
        };
        const view = render(h(Host));
        expect(view.container.querySelector('[data-hero-panel-body]')).toBeNull();
        fireEvent.click(view.container.querySelector('[data-dock-hero="h2"]'));
        const body = view.container.querySelector('[data-hero-panel] [data-hero-panel-body="h2"]');
        expect(body).not.toBeNull();
        const dock = view.container.querySelector('[data-bottom-hero-dock]');
        expect(dock.querySelector('[data-hero-panel-body]')).toBeNull();
    });

    it('closes on Escape and on a click outside, not on a click inside or on the bar', () => {
        const onCloseHero = vi.fn();
        const view = render(wrap(
            h(BottomHeroDock, { selectedHeroId: 'h1' }),
            h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: 'h1', onCloseHero }),
            h('div', { 'data-testid': 'mat' }, 'mat')
        ));
        fireEvent.pointerDown(view.container.querySelector('[data-hero-panel-body] [data-starting-toggle]'));
        fireEvent.pointerDown(view.container.querySelector('[data-dock-hero="h2"]'));
        expect(onCloseHero).not.toHaveBeenCalled();
        fireEvent.pointerDown(view.container.querySelector('[data-testid="mat"]'));
        expect(onCloseHero).toHaveBeenCalledTimes(1);
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        expect(onCloseHero).toHaveBeenCalledTimes(2);
    });
});

describe('H2: a closed panel registers no drop targets (T-104)', () => {
    const drops = (root) => root.querySelectorAll('[data-dnd-droppable-id]');

    it('has drop targets while open and none once closed (Bank shut)', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        expect(r.container.querySelectorAll('[data-dnd-droppable-id^="dock-slot-drop-"]').length).toBe(9);
        r.rerender(panel({ selectedHeroId: null, showTabs: false }));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(drops(r.container).length).toBe(0);
        expect(r.container.querySelector('[data-hero-panel]')).toBeNull();
    });

    it('keeps only the hero tabs as targets beside the Bank once closed', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: true }));
        r.rerender(panel({ selectedHeroId: null, showTabs: true }));
        act(() => { vi.advanceTimersByTime(1000); });
        const ids = [...drops(r.container)].map(el => el.getAttribute('data-dnd-droppable-id'));
        expect(ids.sort()).toEqual(['bank-hero-drop-h1', 'bank-hero-drop-h2']);
    });
});

describe('H2: skills', () => {
    it('orders class skills by layer on top, then the Starting nine in registry order', () => {
        const g = groupHeroSkills(master('x', 'X'));
        expect(g.classRows.map(r => r.id)).toEqual(['melee', 'leadership', 'fletching', 'faith']);
        expect(g.startingRows.map(r => r.id)).toEqual(STARTING);
        expect(STARTING.length).toBe(9);
        expect(g.bankedRows.map(r => [r.id, r.level])).toEqual([['ranged', 30]]);
    });

    it('reads levels as 25/99 and keeps the XP number for the hover', () => {
        expect(skillLevelText(25)).toBe('25/99');
        expect(skillLevelText(3)).toBe('3/99');
        const into = 1154;
        const v = skillXpView(xpForLevel(40) + into);
        const span = xpForLevel(41) - xpForLevel(40);
        expect(v.title).toBe(`1,154 / ${span.toLocaleString('en-US')} XP`);
        expect(v.fill).toBeCloseTo(into / span, 5);
        expect(skillXpView(xpForLevel(99)).title).toBe(`${xpForLevel(99).toLocaleString('en-US')} XP`);
    });

    it('draws each skill as icon, name and n/99 with a thin bar, the XP on hover', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const row = r.container.querySelector('[data-skill-row="melee"]');
        expect(row.textContent).toContain('Melee');
        expect(row.querySelector('[data-skill-level]').textContent).toBe('25/99');
        expect(row.getAttribute('title')).toMatch(/^Melee: 10 \/ [\d,]+ XP$/);
        expect(r.container.textContent).not.toMatch(/Lv\.|LVL|Level/);
    });

    it('groups the panel: class skills on top, Starting in a drawer, banked set aside, mastered marked', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const root = r.container;
        expect(rowIds(root, 'class')).toEqual(['melee', 'leadership', 'fletching', 'faith']);
        const groups = [...root.querySelectorAll('[data-skill-group]')].map(el => el.getAttribute('data-skill-group'));
        expect(groups).toEqual(['class', 'starting', 'banked']);

        const banked = root.querySelector('[data-skill-group="banked"]');
        expect(banked.textContent).toContain('Set aside');
        const ranged = banked.querySelector('[data-skill-row="ranged"]');
        expect(ranged.getAttribute('data-skill-banked')).toBe('true');
        expect(ranged.querySelector('[data-skill-level]').textContent).toBe('30/99');

        const fletching = root.querySelector('[data-skill-group="class"] [data-skill-row="fletching"]');
        expect(fletching.querySelector('[data-skill-mark="mastered"]')).not.toBeNull();
        expect(root.querySelector('[data-skill-row="melee"] [data-skill-mark]')).toBeNull();
    });

    it('starts the Starting drawer shut under class skills, open for a Recruit, and remembers a toggle', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const toggle = () => r.container.querySelector('[data-starting-toggle]');
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(rowIds(r.container, 'starting')).toEqual([]);
        expect(toggle().textContent).toContain('9');

        fireEvent.click(toggle());
        expect(rowIds(r.container, 'starting')).toEqual(STARTING);

        r.rerender(panel({ selectedHeroId: 'h2', showTabs: false }));
        expect(rowIds(r.container, 'starting')).toEqual(STARTING);
        fireEvent.click(toggle());
        cleanup();

        const again = render(panel({ selectedHeroId: 'h2', showTabs: false }));
        expect(again.container.querySelector('[data-starting-toggle]').getAttribute('aria-expanded')).toBe('false');
        expect(again.container.querySelector('[data-skill-group="class"]')).toBeNull();
    });

    it('opens the Starting drawer by default for a Recruit', () => {
        const r = render(panel({ selectedHeroId: 'h2', showTabs: false }));
        expect(rowIds(r.container, 'starting')).toEqual(STARTING);
    });

    it('has an Edit control that opens the hero editor', () => {
        const onEditHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false, onEditHero }));
        fireEvent.click(r.container.querySelector('[data-hero-panel-edit]'));
        expect(onEditHero).toHaveBeenCalledWith('h1');
    });
});
