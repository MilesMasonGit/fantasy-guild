// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS, ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import { SKILL_LAYERS, getSkillIdsByLayer, SKILL_COUNT } from '../config/registries/skillRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { WorkRulesDrawer } from '../ui/components/dock/WorkRulesDrawer.jsx';
import { MAX_ROWS, tintLightness, cycleRule } from '../ui/components/dock/workRules.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * H3 v2: the work rules grid, in a drawer behind the hero bar, opened by the bar's one Work
 * Rules button (and the hero panel's link).
 */

const h = React.createElement;

const skills = (levels) => Object.fromEntries(Object.entries(levels).map(([id, level]) => [id, { level, xp: 0 }]));
const hero = (id, name, levels, extra = {}) => ({
    id, name, spriteId: 'hero_recruit_0', hp: { current: 100, max: 100 }, status: 'idle', equipment: {},
    skills: skills(levels), flagRules: {}, ...extra
});

const engine = {
    GameState,
    EventBus,
    BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: { equipItem: vi.fn(), unequipItem: vi.fn() }
};

const wrap = (...children) => h(EngineContext.Provider, { value: engine }, h(DeckDndProvider, null, ...children));

/** ReactRoot's wiring in small: the bar with its button, and the drawer. */
const Host = () => {
    const [state, setState] = React.useState({ open: false, heroId: null });
    React.useEffect(() => EventBus.subscribe(UI_EVENTS.UI_OPEN_FLAG_RULES, d => setState({ open: true, heroId: d?.heroId || null })), []);
    const toggle = React.useCallback(() => setState(s => ({ open: !s.open, heroId: null })), []);
    const close = React.useCallback(() => setState({ open: false, heroId: null }), []);
    return wrap(
        h('div', { 'data-testid': 'mat' }, 'mat'),
        h(BottomHeroDock, { selectedHeroId: null, onSelectHero: () => {}, rulesOpen: state.open, onToggleRules: toggle }),
        h(WorkRulesDrawer, { open: state.open, litHeroId: state.heroId, onClose: close })
    );
};

const q = (view, sel) => view.container.querySelector(sel);
const qa = (view, sel) => [...view.container.querySelectorAll(sel)];
const drawer = (view) => q(view, '[data-work-rules-drawer]');
const button = (view) => q(view, '[data-work-rules-button]');
const cell = (view, heroId, col) => q(view, `[data-rules-cell="${heroId}:${col}"]`);
const settle = () => act(() => { vi.advanceTimersByTime(1000); });
const openDrawer = (props = {}) => render(wrap(h(WorkRulesDrawer, { open: true, litHeroId: null, onClose: () => {}, ...props })));
const click = (el) => act(() => { fireEvent.click(el); });
const rightClick = (el) => {
    let event;
    act(() => {
        event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
        el.dispatchEvent(event);
    });
    return event;
};

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [
        hero('h1', 'Aldric', { forestry: 30, mining: 20, melee: 10 }, { flagColour: 'bluelite' }),
        hero('h2', 'Brenna', { forestry: 12 }, { flagColour: 'orange' }),
        hero('h3', 'Cedric', { forestry: 5, mining: 8 }),
        hero('h4', 'Dara', { forestry: 99, mining: 1 })
    ];
    setLiveMatFit(1);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.classList.remove('gi-dnd-active');
});

describe('H3 v2: the Work Rules button', () => {
    it('sits in the hero bar with the orange gear, and opens and closes the drawer', () => {
        const view = render(h(Host));
        const btn = button(view);
        expect(btn.closest('[data-bottom-hero-dock]')).not.toBeNull();
        expect(btn.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_gear.png');
        expect(drawer(view)).toBeNull();

        click(btn);
        expect(drawer(view)).not.toBeNull();
        expect(btn.getAttribute('aria-pressed')).toBe('true');

        click(button(view));
        settle();
        expect(drawer(view)).toBeNull();
        expect(button(view).getAttribute('aria-pressed')).toBe('false');
    });

    it('the old gear on a hovered hero is gone', () => {
        const view = render(h(Host));
        fireEvent.mouseEnter(q(view, '[data-dock-hero="h2"]'));
        expect(qa(view, '[data-dock-gear]').length).toBe(0);
    });

    it('the side panel, its one-panel hook and copyRules are gone', () => {
        const ui = path.resolve(__dirname, '../ui');
        expect(fs.existsSync(path.join(ui, 'components/dock/HeroRulesSidePanel.jsx'))).toBe(false);
        expect(fs.existsSync(path.join(ui, 'hooks/useOneSidePanel.js'))).toBe(false);
        expect(Flags.copyRules).toBeUndefined();
    });
});

describe('H3 v2: open until closed', () => {
    it('Escape closes it; a click on the mat does not; Escape during a drag does not', () => {
        const view = render(h(Host));
        click(button(view));
        fireEvent.pointerDown(q(view, '[data-testid="mat"]'));
        click(q(view, '[data-testid="mat"]'));
        settle();
        expect(drawer(view)).not.toBeNull();

        document.body.classList.add('gi-dnd-active');
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        settle();
        expect(drawer(view)).not.toBeNull();

        document.body.classList.remove('gi-dnd-active');
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        settle();
        expect(drawer(view)).toBeNull();
    });

    it('registers no drop targets while closed (T-104)', () => {
        const drops = (v) => qa(v, '[data-dnd-droppable-id]').map(el => el.getAttribute('data-dnd-droppable-id'));
        const props = (open) => ({ open, litHeroId: null, onClose: () => {} });
        const view = render(wrap(h(WorkRulesDrawer, props(false))));
        expect(drops(view)).toEqual([]);

        view.rerender(wrap(h(WorkRulesDrawer, props(true))));
        expect(drops(view)).toEqual(['work-rules-drop']);
        expect(drawer(view).getAttribute('data-dnd-region')).toBe('drawer');

        view.rerender(wrap(h(WorkRulesDrawer, props(false))));
        settle();
        expect(drops(view)).toEqual([]);
        expect(drawer(view)).toBeNull();
    });
});

describe('H3 v2: the grid', () => {
    it('one row per hero, in roster order, following the roster', () => {
        const view = openDrawer();
        const rows = () => qa(view, '[data-rules-row]').map(el => el.getAttribute('data-rules-row'));
        expect(rows()).toEqual(['h1', 'h2', 'h3', 'h4']);
        expect(q(view, '[data-rules-row="h1"] [data-rules-row-header]').textContent).toContain('Aldric');
        expect(q(view, '[data-rules-row="h1"] [data-rules-row-header] img')).not.toBeNull();

        act(() => {
            GameState.state.heroes.push(hero('h5', 'Edda', { forestry: 3 }));
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, {});
        });
        expect(rows()).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    });

    it('is sized to the roster, up to 8 rows', () => {
        const view = openDrawer();
        expect(q(view, '[data-rules-body]').getAttribute('data-rows-shown')).toBe('4');
        cleanup();
        for (let i = 5; i <= 10; i++) GameState.state.heroes.push(hero(`h${i}`, `Hero ${i}`, { forestry: 1 }));
        const big = openDrawer();
        expect(qa(big, '[data-rules-row]').length).toBe(10);
        expect(MAX_ROWS).toBe(8);
        expect(q(big, '[data-rules-body]').getAttribute('data-rows-shown')).toBe('8');
    });

    it('columns: every skill, combat then Starting then specialist, then one Fight column, under group headers', () => {
        const view = openDrawer();
        const cols = qa(view, '[data-rules-col]').map(el => el.getAttribute('data-rules-col'));
        expect(cols).toEqual([
            ...getSkillIdsByLayer(SKILL_LAYERS.COMBAT),
            ...getSkillIdsByLayer(SKILL_LAYERS.STARTING),
            ...getSkillIdsByLayer(SKILL_LAYERS.ADVANCED),
            ...getSkillIdsByLayer(SKILL_LAYERS.MASTER),
            FlagRules.FIGHT
        ]);
        expect(cols.length).toBe(SKILL_COUNT + 1);
        expect(qa(view, '[data-rules-group]').map(el => el.getAttribute('data-rules-group'))).toEqual(['combat', 'starting', 'specialist', 'fight']);
        expect(q(view, '[data-rules-group="specialist"]').textContent).toBe('Specialist');
        // A hairline opens each group after the first.
        const starts = qa(view, '[data-rules-col][data-group-start]').map(el => el.getAttribute('data-rules-col'));
        expect(starts).toEqual([getSkillIdsByLayer(SKILL_LAYERS.STARTING)[0], getSkillIdsByLayer(SKILL_LAYERS.ADVANCED)[0], FlagRules.FIGHT]);
    });

    it('a skill the hero does not hold is a blank, dimmed cell that ignores clicks', () => {
        const view = openDrawer();
        const missing = cell(view, 'h2', 'mining');
        expect(missing.getAttribute('data-cell')).toBe('missing');
        expect(missing.getAttribute('aria-disabled')).toBe('true');
        expect(missing.textContent).toBe('');
        click(missing);
        rightClick(missing);
        expect(GameState.state.heroes.find(x => x.id === 'h2').flagRules).toEqual({});
        // A hero who cannot fight has no Fight cell either.
        expect(cell(view, 'h2', FlagRules.FIGHT).getAttribute('data-cell')).toBe('missing');
        expect(cell(view, 'h1', FlagRules.FIGHT).getAttribute('data-cell')).toBe('rule');
    });

    it('a combat skill’s column is a level tint only, not a rule', () => {
        const view = openDrawer();
        const melee = cell(view, 'h1', 'melee');
        expect(melee.getAttribute('data-cell')).toBe('level');
        expect(melee.textContent).toBe('');
        click(melee);
        expect(GameState.state.heroes.find(x => x.id === 'h1').flagRules).toEqual({});
    });

    it('each cell is tinted by the hero’s level, dark at 1 and bright at 99', () => {
        const view = openDrawer();
        const l = (heroId, col) => Number(cell(view, heroId, col).getAttribute('data-cell-tint'));
        expect(l('h4', 'forestry')).toBe(tintLightness(99));
        expect(l('h4', 'mining')).toBe(tintLightness(1));
        expect(tintLightness(1)).toBeLessThan(tintLightness(99));
        expect(l('h3', 'forestry')).toBeLessThan(l('h2', 'forestry'));
        expect(l('h2', 'forestry')).toBeLessThan(l('h1', 'forestry'));
        expect(cell(view, 'h4', 'forestry').style.backgroundColor).not.toBe(cell(view, 'h4', 'mining').style.backgroundColor);
    });

    it('hovering a cell shows the game’s tooltip with hero, skill and level', () => {
        const view = openDrawer();
        fireEvent.mouseEnter(cell(view, 'h1', 'forestry'));
        const tip = document.querySelector('[data-top-bar-tip]');
        expect(tip.textContent).toContain('Aldric');
        expect(tip.textContent).toContain('Forestry');
        expect(tip.textContent).toContain('30/99');
        fireEvent.mouseLeave(cell(view, 'h1', 'forestry'));
        expect(document.querySelector('[data-top-bar-tip]')).toBeNull();
    });

    it('hovering a row lights that hero (and their flag) on the mat', () => {
        const mat = document.createElement('div');
        mat.innerHTML = '<button data-board-hero="h2"></button><button data-flag="h2"></button><button data-board-hero="h1"></button>';
        document.body.appendChild(mat);
        try {
            const view = openDrawer();
            fireEvent.mouseEnter(q(view, '[data-rules-row="h2"]'));
            expect(mat.querySelector('[data-board-hero="h2"]').getAttribute('data-summary-highlight')).toBe('true');
            expect(mat.querySelector('[data-flag="h2"]').getAttribute('data-summary-highlight')).toBe('true');
            expect(mat.querySelector('[data-board-hero="h1"]').hasAttribute('data-summary-highlight')).toBe(false);
            fireEvent.mouseLeave(q(view, '[data-rules-row="h2"]'));
            expect(mat.querySelector('[data-summary-highlight]')).toBeNull();
        } finally {
            mat.remove();
        }
    });
});

describe('H3 v2: clicking cells', () => {
    it('ticks by default: left- or right-click switches a rule off and on, and suppresses the menu', () => {
        const view = openDrawer();
        const forestry = () => cell(view, 'h1', 'forestry');
        expect(forestry().getAttribute('data-cell-on')).toBe('true');
        expect(forestry().querySelector('[data-cell-tick]')).not.toBeNull();

        click(forestry());
        expect(FlagRules.ruleOf('h1', 'forestry').allowed).toBe(false);
        expect(forestry().querySelector('[data-cell-tick]')).toBeNull();

        const menu = rightClick(forestry());
        expect(menu.defaultPrevented).toBe(true);
        expect(FlagRules.ruleOf('h1', 'forestry')).toEqual({ allowed: true, priority: 1 });

        rightClick(forestry());
        expect(FlagRules.ruleOf('h1', 'forestry').allowed).toBe(false);
    });

    it('a skill switched on starts at priority 1', () => {
        Flags.setRule('h1', 'mining', { allowed: false, priority: 4 });
        const view = openDrawer();
        click(cell(view, 'h1', 'mining'));
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: true, priority: 1 });
    });

    it('priority mode shows numbers; left-click runs 1→2→3→4→5→off→1, right-click the reverse', () => {
        const view = openDrawer();
        const mode = q(view, '[data-rules-mode]');
        expect(mode.getAttribute('aria-pressed')).toBe('false');
        click(mode);
        expect(q(view, '[data-rules-mode]').getAttribute('aria-pressed')).toBe('true');

        const forestry = () => cell(view, 'h1', 'forestry');
        expect(forestry().textContent).toBe('3');
        const seen = [];
        for (let i = 0; i < 5; i++) {
            click(forestry());
            seen.push(forestry().textContent);
        }
        expect(seen).toEqual(['4', '5', '', '1', '2']);
        expect(FlagRules.ruleOf('h1', 'forestry')).toEqual({ allowed: true, priority: 2 });

        const back = [];
        for (let i = 0; i < 4; i++) {
            rightClick(forestry());
            back.push(forestry().textContent);
        }
        expect(back).toEqual(['1', '', '5', '4']);
        expect(FlagRules.ruleOf('h1', 'forestry')).toEqual({ allowed: true, priority: 4 });
    });

    it('the cycle as a function', () => {
        expect(cycleRule({ allowed: true, priority: 5 }, 'up', true)).toEqual({ allowed: false });
        expect(cycleRule({ allowed: false, priority: 3 }, 'up', true)).toEqual({ allowed: true, priority: 1 });
        expect(cycleRule({ allowed: true, priority: 1 }, 'down', true)).toEqual({ allowed: false });
        expect(cycleRule({ allowed: false, priority: 3 }, 'down', true)).toEqual({ allowed: true, priority: 5 });
        expect(cycleRule({ allowed: false, priority: 3 }, 'down', false)).toEqual({ allowed: true, priority: 1 });
    });
});

describe('H3 v2: bulk toggles', () => {
    it('a row header allows or disallows the hero’s whole row', () => {
        const view = openDrawer();
        const header = () => q(view, '[data-rules-row="h1"] [data-rules-row-header]');
        click(header());
        for (const id of ['forestry', 'mining', FlagRules.FIGHT]) expect(FlagRules.ruleOf('h1', id).allowed).toBe(false);
        expect(FlagRules.ruleOf('h2', 'forestry').allowed).toBe(true);

        click(header());
        for (const id of ['forestry', 'mining', FlagRules.FIGHT]) expect(FlagRules.ruleOf('h1', id)).toEqual({ allowed: true, priority: 1 });
    });

    it('a row with any rule off is switched all on first', () => {
        Flags.setRule('h1', 'mining', { allowed: false });
        const view = openDrawer();
        click(q(view, '[data-rules-row="h1"] [data-rules-row-header]'));
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: true, priority: 1 });
        // Rules already on keep their priority.
        expect(FlagRules.ruleOf('h1', 'forestry')).toEqual({ allowed: true, priority: 3 });
    });

    it('a column header allows or disallows that skill for every hero who holds it', () => {
        const view = openDrawer();
        const header = () => q(view, '[data-rules-col="mining"]');
        click(header());
        for (const id of ['h1', 'h3', 'h4']) expect(FlagRules.ruleOf(id, 'mining').allowed).toBe(false);
        expect(GameState.state.heroes.find(x => x.id === 'h2').flagRules).toEqual({});

        click(header());
        for (const id of ['h1', 'h3', 'h4']) expect(FlagRules.ruleOf(id, 'mining')).toEqual({ allowed: true, priority: 1 });

        // A combat skill's column has no rules to switch.
        click(q(view, '[data-rules-col="melee"]'));
        expect(GameState.state.heroes.find(x => x.id === 'h1').flagRules.melee).toBeUndefined();
    });
});

describe('H3 v2: the hero panel’s link', () => {
    it('opens the drawer with that hero’s row lit', () => {
        const opened = [];
        const unsub = EventBus.subscribe(UI_EVENTS.UI_OPEN_FLAG_RULES, d => opened.push(d.heroId));
        const panel = render(wrap(h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: 'h3' })));
        click(panel.container.querySelector('[data-hero-panel-rules]'));
        unsub();
        expect(opened).toEqual(['h3']);
        cleanup();

        const view = render(h(Host));
        act(() => { EventBus.publish(UI_EVENTS.UI_OPEN_FLAG_RULES, { heroId: 'h3' }); });
        expect(drawer(view)).not.toBeNull();
        expect(q(view, '[data-rules-row="h3"]').getAttribute('data-rules-lit')).toBe('true');
        expect(q(view, '[data-rules-row="h1"]').getAttribute('data-rules-lit')).toBeNull();
    });
});
