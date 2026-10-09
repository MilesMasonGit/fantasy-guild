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
    heroSkillList, skillLevelText, skillXpView, skillDetail, formatEta, setLockedListOpen
} from '../ui/components/dock/heroPanelSkills.js';
import { getSkillIdsByLayer, SKILL_LAYERS } from '../config/registries/skillRegistry.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { XpRateTracker } from '../systems/hero/XpRateTracker.js';
import { ART_PX } from '../config/matGeometry.js';
import { boardArtSteps } from '../ui/components/base/TokenSprite.jsx';

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
    setLockedListOpen(false);
    XpRateTracker.clearAll();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); setLockedListOpen(false); });

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
        fireEvent.pointerDown(view.container.querySelector('[data-hero-panel-body] [data-locked-toggle]'));
        fireEvent.pointerDown(view.container.querySelector('[data-dock-hero="h2"]'));
        expect(onCloseHero).not.toHaveBeenCalled();
        fireEvent.pointerDown(view.container.querySelector('[data-testid="mat"]'));
        expect(onCloseHero).toHaveBeenCalledTimes(1);
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        expect(onCloseHero).toHaveBeenCalledTimes(2);
    });
});

describe('H2: the panel stays open when the Bank opens', () => {
    it('a press on the Bank button does not close it, and opening the Bank keeps it', () => {
        const onCloseHero = vi.fn();
        const bankButton = h('div', { id: 'bank-bubble-target' }, h('button', { 'data-testid': 'bank' }, 'Bank'));
        const r = render(wrap(
            h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: 'h1', onCloseHero }),
            bankButton
        ));
        fireEvent.pointerDown(r.getByTestId('bank'));
        expect(onCloseHero).not.toHaveBeenCalled();
        r.rerender(wrap(
            h(BankHeroPanel, { menuRight: false, showTabs: true, selectedHeroId: 'h1', onCloseHero }),
            bankButton
        ));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(r.container.querySelector('[data-hero-panel] [data-hero-panel-body="h1"]')).not.toBeNull();
        expect(onCloseHero).not.toHaveBeenCalled();
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
    const ALL = [
        ...getSkillIdsByLayer(SKILL_LAYERS.COMBAT), ...STARTING,
        ...getSkillIdsByLayer(SKILL_LAYERS.ADVANCED), ...getSkillIdsByLayer(SKILL_LAYERS.MASTER)
    ];

    it('lists held skills in one list: combat, then the Starting nine, then the specialist layers', () => {
        const g = heroSkillList(master('x', 'X'));
        expect(g.rows.map(r => r.id)).toEqual(['melee', ...STARTING, 'leadership', 'fletching', 'faith']);
        expect(STARTING.length).toBe(9);
        expect(g.bankedRows.map(r => [r.id, r.level])).toEqual([['ranged', 30]]);
    });

    it('lists every skill never held as locked, in the same order', () => {
        const g = heroSkillList(master('x', 'X'));
        const held = new Set(['melee', ...STARTING, 'leadership', 'fletching', 'faith', 'ranged']);
        expect(g.lockedRows.map(r => r.id)).toEqual(ALL.filter(id => !held.has(id)));
        expect(g.lockedRows.length).toBeGreaterThan(0);
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

    it('writes times as 0:34, 4:05 and 1:04:05', () => {
        expect(formatEta(34)).toBe('0:34');
        expect(formatEta(245)).toBe('4:05');
        expect(formatEta(3845)).toBe('1:04:05');
        expect(formatEta(0.2)).toBe('0:01');
    });

    it('works out a row\'s detail: exact XP, what is left, the rate and the time to the next level', () => {
        const span = xpForLevel(41) - xpForLevel(40);
        const left = span - 1154;
        const d = skillDetail(xpForLevel(40) + 1154, 3600);
        expect(d.level).toBe(`1,154 / ${span.toLocaleString('en-US')}`);
        expect(d.toNext).toBe(left.toLocaleString('en-US'));
        expect(d.nextLevel).toBe('41/99');
        expect(d.total).toBe((xpForLevel(40) + 1154).toLocaleString('en-US'));
        expect(d.rate).toBe('+3,600');
        expect(d.eta).toBe(formatEta(left));
        const idle = skillDetail(xpForLevel(40), 0);
        expect(idle.rate).toBeNull();
        expect(idle.eta).toBeNull();
        expect(skillDetail(xpForLevel(99), 500)).toMatchObject({ level: null, rate: null, eta: null });
    });

    it('draws each skill as icon, name and n/99 with a thin bar, the XP in the game\'s own tooltip', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const row = r.container.querySelector('[data-skill-row="melee"]');
        expect(row.textContent).toContain('Melee');
        expect(row.querySelector('[data-skill-level]').textContent).toBe('25/99');
        expect(r.container.textContent).not.toMatch(/Lv\.|LVL|Level/);
        // Never the browser's own title tooltip.
        expect(r.container.querySelector('[data-skill-row][title], [data-skill-row] [title]')).toBeNull();
        expect(document.body.querySelector('[data-top-bar-tip]')).toBeNull();
        fireEvent.mouseEnter(row);
        const tip = document.body.querySelector('[data-top-bar-tip]');
        expect(tip.textContent).toContain('Melee');
        expect(tip.textContent).toMatch(/10 \/ [\d,]+ XP/);
        fireEvent.mouseLeave(row);
        expect(document.body.querySelector('[data-top-bar-tip]')).toBeNull();
    });

    it('shows one flat list with no Starting drawer, set aside skills, then the locked list shut', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const root = r.container;
        expect(root.querySelector('[data-starting-toggle]')).toBeNull();
        expect(rowIds(root, 'held')).toEqual(['melee', ...STARTING, 'leadership', 'fletching', 'faith']);
        const groups = [...root.querySelectorAll('[data-skill-group]')].map(el => el.getAttribute('data-skill-group'));
        expect(groups).toEqual(['held', 'banked', 'locked']);

        const banked = root.querySelector('[data-skill-group="banked"]');
        expect(banked.textContent).toContain('Set aside');
        const ranged = banked.querySelector('[data-skill-row="ranged"]');
        expect(ranged.getAttribute('data-skill-banked')).toBe('true');
        expect(ranged.querySelector('[data-skill-level]').textContent).toBe('30/99');

        const toggle = root.querySelector('[data-locked-toggle]');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(rowIds(root, 'locked')).toEqual([]);
    });

    it('opens the locked list on a click and remembers it for the session', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const locked = heroSkillList(GameState.state.heroes[0]).lockedRows.map(x => x.id);
        expect(r.container.querySelector('[data-locked-toggle]').textContent).toContain(String(locked.length));
        fireEvent.click(r.container.querySelector('[data-locked-toggle]'));
        expect(rowIds(r.container, 'locked')).toEqual(locked);
        expect(r.container.querySelector(`[data-skill-row="${locked[0]}"]`).getAttribute('data-skill-locked')).toBe('true');
        cleanup();
        const again = render(panel({ selectedHeroId: 'h2', showTabs: false }));
        expect(again.container.querySelector('[data-locked-toggle]').getAttribute('aria-expanded')).toBe('true');
    });

    it('gives Advanced and Master rows their own background and draws no mastered star', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const row = (id) => r.container.querySelector(`[data-skill-group="held"] [data-skill-row="${id}"]`);
        expect(row('leadership').getAttribute('data-skill-tier')).toBe('advanced');
        expect(row('fletching').getAttribute('data-skill-tier')).toBe('advanced');
        expect(row('faith').getAttribute('data-skill-tier')).toBe('master');
        expect(row('melee').getAttribute('data-skill-tier')).toBeNull();
        const bg = (el) => el.className.split(' ').filter(c => c.startsWith('bg-')).join(' ');
        expect(bg(row('leadership'))).not.toBe('');
        expect(bg(row('faith'))).not.toBe('');
        expect(bg(row('faith'))).not.toBe(bg(row('leadership')));
        expect(bg(row('melee'))).toBe('');
        expect(r.container.querySelector('[data-skill-mark]')).toBeNull();
        expect(r.container.textContent).not.toContain('★');
    });

    it('expands a row on click to its exact XP numbers and rate, and folds it on a second click', () => {
        XpRateTracker.recordGain('h1', 'melee', 1000);
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const row = () => r.container.querySelector('[data-skill-row="melee"]');
        expect(row().querySelector('[data-skill-detail]')).toBeNull();
        fireEvent.click(row());
        const detail = row().querySelector('[data-skill-detail]');
        expect(row().getAttribute('aria-expanded')).toBe('true');
        const d = skillDetail(GameState.state.heroes[0].skills.melee.xp, 1000 / (15 / 3600));
        expect(detail.textContent).toContain(d.level);
        expect(detail.textContent).toContain(d.total);
        expect(detail.textContent).toContain('XP/h+240,000');
        expect(detail.textContent).toContain(d.eta);
        expect(detail.textContent).toMatch(/\d+:\d\d/);
        // Only one row open at a time.
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(row().querySelector('[data-skill-detail]')).toBeNull();
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(r.container.querySelector('[data-skill-detail]')).toBeNull();
    });

    it('has an Edit control that opens the hero editor', () => {
        const onEditHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false, onEditHero }));
        fireEvent.click(r.container.querySelector('[data-hero-panel-edit]'));
        expect(onEditHero).toHaveBeenCalledWith('h1');
    });
});

describe('H2: the panel header', () => {
    it('draws the hero at twice the mat size, idling, with their flag behind', () => {
        setLiveMatFit(1);
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        const box = r.container.querySelector('[data-hero-panel-sprite]');
        const size = 2 * ART_PX * boardArtSteps(1);
        expect(Number(box.getAttribute('data-hero-panel-sprite-px'))).toBe(size);
        const flag = box.querySelector('[data-hero-panel-flag]');
        const hero = box.querySelector('[data-hero-panel-figure]');
        expect(flag).not.toBeNull();
        expect(hero).not.toBeNull();
        // The flag comes first, so the hero draws over it.
        expect(flag.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // The idle row of the sheet, as the mat's idle hero.
        expect(hero.querySelector('[data-hero-row]').getAttribute('data-hero-row')).toBe('idle');
    });

    it('shows the HP numbers on the bar', () => {
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false }));
        expect(r.container.querySelector('[data-hero-panel-hp-text]').textContent).toBe('80 / 100');
    });

    it('closes with the game\'s red X icon', () => {
        const onCloseHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', showTabs: false, onCloseHero }));
        const close = r.container.querySelector('[data-hero-panel-close]');
        expect(close.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_cancel_red.png');
        fireEvent.click(close);
        expect(onCloseHero).toHaveBeenCalledTimes(1);
    });
});

describe('H2: the hero tabs beside the Bank', () => {
    it('hovering a tab grows nothing; the hero\'s name, job, status and HP show in the game\'s tooltip', () => {
        const r = render(panel({ selectedHeroId: null, showTabs: true }));
        const tab = r.container.querySelector('[data-dock-hero-id="h1"] [data-hero-tab-face]');
        const before = tab.className;
        const textBefore = tab.textContent;
        fireEvent.mouseEnter(tab);
        expect(tab.className).toBe(before);
        expect(tab.textContent).toBe(textBefore);
        const tip = document.body.querySelector('[data-top-bar-tip]');
        expect(tip.textContent).toContain('Aldric');
        expect(tip.textContent).toContain('80 / 100 HP');
        fireEvent.mouseLeave(tab);
        expect(document.body.querySelector('[data-top-bar-tip]')).toBeNull();
    });

    it('reads each tab as portrait, name and a thin HP bar, with no level text', () => {
        const r = render(panel({ selectedHeroId: null, showTabs: true }));
        const tab = r.container.querySelector('[data-dock-hero-id="h1"]');
        expect(tab.textContent).toContain('Aldric');
        expect(tab.textContent).not.toMatch(/Lv|LVL|Level/);
        expect(tab.querySelector('[data-hero-tab-hp]').style.width).toBe('80%');
    });
});
