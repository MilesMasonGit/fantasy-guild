// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { FLAG_FILLS } from '../systems/board/FlagColours.js';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { DOCK_STRIP_PX } from '../ui/components/dock/dockHeroView.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import {
    heroSkillList, skillLevelText, skillXpView, skillDetail, formatEta
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
    id, name, spriteId: 'hn_recruit_por', hp: { current: 80, max: 100 }, status: 'idle', equipment: {},
    skills: startingSkills()
});

/** A trained hero: Melee and two specialist skills on top of the Starting nine. */
const master = (id, name) => ({
    ...recruit(id, name),
    // Held out of layer order on purpose: the panel orders them, not the save. Leadership was cut:
    // a record still carrying it lists without it.
    skills: { faith: lvl(3), ...startingSkills(), leadership: lvl(12), melee: lvl(25, 10), fletching: lvl(99) }
});


const wrap = (...children) =>
    h(DeckDndProvider, null, ...children);

const panel = (props) => wrap(h(HeroDrawer, { menuRight: false, ...props }));

const rowIds = (root, group) =>
    [...root.querySelectorAll(`[data-skill-group="${group}"] [data-skill-row]`)].map(el => el.getAttribute('data-skill-row'));

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [master('h1', 'Aldric'), recruit('h2', 'Brenna')];
    setLiveMatFit(1);
    XpRateTracker.clearAll();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('H2: one hero drawer, in one place', () => {
    it('rises across the screen from behind the bar, down to the screen bottom edge, its three blocks left to right', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const box = r.container.querySelector('[data-hero-panel]');
        expect(box.querySelector('[data-hero-panel-body="h1"]')).not.toBeNull();
        expect(box.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'inset-x-0']));
        expect(box.className.split(' ')).not.toContain('top-0');
        // To the screen's bottom edge, behind the bar: no gap under the drawer.
        expect(box.style.bottom).toBe('0px');
        expect(box.getAttribute('data-hero-drawer-state')).toBe('open');
        expect(parseFloat(box.querySelector('[data-hero-drawer-foot]').style.height)).toBeGreaterThan(DOCK_STRIP_PX);
        const blocks = [...box.querySelectorAll('[data-hero-drawer-block]')].map(el => el.getAttribute('data-hero-drawer-block'));
        expect(blocks).toEqual(['summary', 'equipment', 'detail']);
    });

    it('clicking a hero in the bar opens the drawer, outside the bar', () => {
        const Host = () => {
            const [sel, setSel] = React.useState(null);
            return wrap(
                h(BottomHeroDock, { selectedHeroId: sel, onSelectHero: id => setSel(p => (p === id ? null : id)) }),
                h(HeroDrawer, { menuRight: false, selectedHeroId: sel, onCloseHero: () => setSel(null) })
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
            h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1', onCloseHero }),
            h('div', { 'data-testid': 'mat' }, 'mat')
        ));
        fireEvent.pointerDown(view.container.querySelector('[data-hero-panel-body] [data-skill-row="mining"]'));
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
            h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1', onCloseHero }),
            bankButton
        ));
        fireEvent.pointerDown(r.getByTestId('bank'));
        expect(onCloseHero).not.toHaveBeenCalled();
        r.rerender(wrap(
            h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1', onCloseHero }),
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
        const r = render(panel({ selectedHeroId: 'h1' }));
        expect(r.container.querySelectorAll('[data-dnd-droppable-id^="dock-slot-drop-"]').length).toBe(9);
        r.rerender(panel({ selectedHeroId: null }));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(drops(r.container).length).toBe(0);
        expect(r.container.querySelector('[data-hero-panel]')).toBeNull();
    });

});

// Every hero holds every skill, so the drawer lists all of them in one grid, in the concept's order
// (brief 570 D2): combat, gathering, crafting, then the specialist skills.
describe('H2: skills', () => {
    const ALL = [
        'melee', 'ranged', 'magic', 'stealth',
        'mining', 'forestry', 'fishing', 'farming',
        'smithing', 'crafting', 'cooking', 'alchemy', 'construction',
        ...getSkillIdsByLayer(SKILL_LAYERS.SPECIALIST)
    ];

    it('lists every skill in one list: combat, gathering, crafting, then the specialist ones', () => {
        const g = heroSkillList(master('x', 'X'));
        expect(g.rows.map(r => r.id)).toEqual(ALL);
        expect(ALL).toHaveLength(20);
        expect(STARTING.length).toBe(9);
        const level = (id) => g.rows.find(r => r.id === id).level;
        expect([level('melee'), level('ranged'), level('mining'), level('fletching'), level('faith'), level('science')])
            .toEqual([25, 1, 5, 99, 3, 1]);
        expect(Object.keys(g)).toEqual(['rows']);
    });

    it('never lists a cut skill, even one an older record still carries', () => {
        const g = heroSkillList(master('x', 'X'));
        expect(g.rows.map(r => r.id)).not.toContain('leadership');
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

    it('draws each skill as icon and n/99 with a thin bar, the name and XP in the game\'s own tooltip', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const row = r.container.querySelector('[data-skill-row="melee"]');
        // The skill's name on the cell, then its level (owner, 2026-11-10).
        expect(row.textContent).toBe('Melee25/99');
        expect(row.querySelector('[data-skill-name]').textContent).toBe('Melee');
        expect(row.querySelector('[data-skill-level]').textContent).toBe('25/99');
        expect(r.container.textContent).not.toMatch(/Lv\.|LVL|Level/);
        // Never the browser's own title tooltip.
        expect(r.container.querySelector('[data-skill-row][title], [data-skill-row] [title]')).toBeNull();
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
        fireEvent.pointerEnter(row);
        const tip = document.body.querySelector('[data-tooltip]');
        expect(tip.textContent).toContain('Melee 25/99');
        // A clean stat block: this level's XP, what is left, the rate.
        const block = tip.querySelector('[data-skill-tip="melee"]');
        const left = (xpForLevel(26) - xpForLevel(25) - 10).toLocaleString('en-US');
        expect(block.textContent).toBe(`XP10To next level${left}XP/h–`);
        fireEvent.pointerLeave(row);
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
    });

    it('shows one flat list with no Starting drawer, and nothing set aside or locked', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const root = r.container;
        expect(root.querySelector('[data-starting-toggle]')).toBeNull();
        expect(rowIds(root, 'held')).toEqual(ALL);
        const groups = [...root.querySelectorAll('[data-skill-group]')].map(el => el.getAttribute('data-skill-group'));
        expect(groups).toEqual(['held']);
        expect(root.querySelector('[data-locked-toggle]')).toBeNull();
        expect(root.querySelector('[data-skill-banked], [data-skill-locked]')).toBeNull();
        expect(root.textContent).not.toMatch(/Set aside|Locked|Recruit/);
    });

    it('gives the specialist rows their own background and draws no mastered star', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const row = (id) => r.container.querySelector(`[data-skill-group="held"] [data-skill-row="${id}"]`);
        expect(row('fletching').getAttribute('data-skill-tier')).toBe('specialist');
        expect(row('faith').getAttribute('data-skill-tier')).toBe('specialist');
        expect(row('melee').getAttribute('data-skill-tier')).toBeNull();
        expect(row('mining').getAttribute('data-skill-tier')).toBeNull();
        const bg = (el) => el.className.split(' ').filter(c => c.startsWith('bg-')).join(' ');
        expect(bg(row('fletching'))).not.toBe('');
        expect(bg(row('faith'))).toBe(bg(row('fletching')));
        expect(bg(row('melee'))).toBe('');
        expect(r.container.querySelector('[data-skill-mark]')).toBeNull();
        expect(r.container.textContent).not.toContain('★');
    });

    it('opens a skill on click to its exact XP numbers and rate in the skill panel, and folds it on a second click', () => {
        XpRateTracker.recordGain('h1', 'melee', 1000);
        const r = render(panel({ selectedHeroId: 'h1' }));
        const row = () => r.container.querySelector('[data-skill-row="melee"]');
        expect(r.container.querySelector('[data-skill-detail]')).toBeNull();
        fireEvent.click(row());
        const detail = r.container.querySelector('[data-hero-skill-panel="melee"] [data-skill-detail]');
        expect(row().getAttribute('aria-expanded')).toBe('true');
        const d = skillDetail(GameState.state.heroes[0].skills.melee.xp, 1000 / (15 / 3600));
        expect(detail.textContent).toContain(d.level);
        expect(detail.textContent).toContain(d.total);
        expect(detail.textContent).toContain('XP/h+240,000');
        expect(detail.textContent).toContain(d.eta);
        expect(detail.textContent).toMatch(/\d+:\d\d/);
        // Only one open at a time: another skill switches the panel.
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(r.container.querySelector('[data-hero-skill-panel="melee"]')).toBeNull();
        expect(r.container.querySelector('[data-hero-skill-panel="mining"]')).not.toBeNull();
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(r.container.querySelector('[data-skill-detail]')).toBeNull();
    });

    it('has an Edit control that opens the hero editor', () => {
        const onEditHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', onEditHero }));
        fireEvent.click(r.container.querySelector('[data-hero-panel-edit]'));
        expect(onEditHero).toHaveBeenCalledWith('h1');
    });
});

describe('H2: the panel header', () => {
    it('draws the hero at twice the mat size, idling, with their flag behind', () => {
        setLiveMatFit(1);
        const r = render(panel({ selectedHeroId: 'h1' }));
        const box = r.container.querySelector('[data-hero-panel-sprite]');
        const size = 2 * ART_PX * boardArtSteps(1);
        expect(Number(box.getAttribute('data-hero-panel-sprite-px'))).toBe(size);
        const flag = box.querySelector('[data-hero-panel-flag]');
        const hero = box.querySelector('[data-hero-panel-figure]');
        expect(flag).not.toBeNull();
        expect(hero).not.toBeNull();
        // The job flag, as large beside the hero as on the mat: 12 of the hero's 64 art pixels.
        expect(flag.querySelector('[data-flag-mark] svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(flag.querySelector('[data-flag-mark]').style.width).toBe(`${(size * 12) / 64}px`);
        // The flag comes first, so the hero draws over it.
        expect(flag.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // The idle row of the sheet, as the mat's idle hero.
        expect(hero.querySelector('[data-hero-row]').getAttribute('data-hero-row')).toBe('idle');
    });

    it('the flag is in the hero’s own colour', () => {
        GameState.state.heroes[0].flagColour = 'orange';
        const r = render(panel({ selectedHeroId: 'h1' }));
        const mark = r.container.querySelector('[data-hero-panel-flag] [data-flag-mark]');
        expect(mark.getAttribute('data-flag-colour')).toBe('orange');
        const svgs = mark.querySelectorAll('svg');
        expect(svgs[svgs.length - 1].getAttribute('fill')).toBe(FLAG_FILLS.orange);
    });

    it('shows the HP numbers on the bar', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        expect(r.container.querySelector('[data-hero-panel-hp] [data-hp-numbers]').textContent).toBe('80/100');
    });

    it('closes with the game\'s red X icon', () => {
        const onCloseHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', onCloseHero }));
        const close = r.container.querySelector('[data-hero-panel-close]');
        expect(close.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_cancel_red.png');
        fireEvent.click(close);
        expect(onCloseHero).toHaveBeenCalledTimes(1);
    });
});
