// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act, renderHook } from '@testing-library/react';

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { HeroRulesSidePanel } from '../ui/components/dock/HeroRulesSidePanel.jsx';
import { useOneSidePanel } from '../ui/hooks/useOneSidePanel.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * H3: the work rules open from the hero bar, in the hero panel's box on the notification
 * side, and can be copied to other heroes.
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

/** ReactRoot's wiring in small: the bar, the hero panel, the rules panel, one at a time. */
const Host = () => {
    const [heroId, setHeroId] = React.useState(null);
    const [rulesHeroId, setRulesHeroId] = React.useState(null);
    React.useEffect(() => EventBus.subscribe(UI_EVENTS.UI_OPEN_FLAG_RULES, d => setRulesHeroId(d.heroId)), []);
    const closeHero = React.useCallback(() => setHeroId(null), []);
    const closeRules = React.useCallback(() => setRulesHeroId(null), []);
    useOneSidePanel({ heroId, closeHero, rulesHeroId, closeRules });
    return wrap(
        h('div', { 'data-testid': 'mat' }, 'mat'),
        h(BottomHeroDock, { selectedHeroId: heroId, onSelectHero: id => setHeroId(p => (p === id ? null : id)) }),
        h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: heroId, onCloseHero: closeHero }),
        h(HeroRulesSidePanel, { menuRight: false, heroId: rulesHeroId, onClose: closeRules })
    );
};

const q = (view, sel) => view.container.querySelector(sel);
const gearOf = (view, id) => q(view, `[data-dock-gear="${id}"]`);
const hover = (view, id) => fireEvent.mouseEnter(q(view, `[data-dock-hero="${id}"]`));
const rulesFor = (view) => q(view, '[data-hero-rules-panel] [data-flag-rules]')?.getAttribute('data-flag-rules') || null;
const settle = () => act(() => { vi.advanceTimersByTime(1000); });

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [
        hero('h1', 'Aldric', { forestry: 30, mining: 20, melee: 10 }, { flagColour: 'bluelite' }),
        hero('h2', 'Brenna', { forestry: 12 }, { flagColour: 'orange' }),
        hero('h3', 'Cedric', { forestry: 5, mining: 8 }),
        hero('h4', 'Dara', { forestry: 7, mining: 7 })
    ];
    setLiveMatFit(1);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.classList.remove('gi-dnd-active');
});

describe('H3: the gear in the hero bar', () => {
    it('shows on hover only, and opens that hero’s rules without selecting or dragging the hero', () => {
        const onSelectHero = vi.fn();
        const opened = [];
        const unsub = EventBus.subscribe(UI_EVENTS.UI_OPEN_FLAG_RULES, d => opened.push(d.heroId));
        const view = render(wrap(h(BottomHeroDock, { selectedHeroId: null, onSelectHero })));
        expect(view.container.querySelectorAll('[data-dock-gear]').length).toBe(0);

        hover(view, 'h2');
        expect(gearOf(view, 'h2')).not.toBeNull();
        expect(gearOf(view, 'h1')).toBeNull();

        fireEvent.pointerDown(gearOf(view, 'h2'));
        fireEvent.click(gearOf(view, 'h2'));
        unsub();
        expect(opened).toEqual(['h2']);
        expect(onSelectHero).not.toHaveBeenCalled();
        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);

        fireEvent.mouseLeave(q(view, '[data-dock-hero="h2"]'));
        expect(gearOf(view, 'h2')).toBeNull();
    });

    it('opens the rules panel for that hero, named and in their flag colour', () => {
        const view = render(h(Host));
        expect(q(view, '[data-hero-rules-panel]')).toBeNull();
        hover(view, 'h1');
        fireEvent.click(gearOf(view, 'h1'));
        expect(rulesFor(view)).toBe('h1');
        expect(q(view, '[data-flag-rules-name]').textContent).toBe('Aldric');
        const flag = q(view, '[data-flag-rules-colour]');
        expect(flag.getAttribute('data-flag-rules-colour')).toBe('bluelite');
        expect(flag.querySelector('img').getAttribute('src')).toContain('bluelite');
    });

    it('sits in the hero panel’s box on the notification side', () => {
        const rules = render(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose: () => {} })));
        const box = q(rules, '[data-hero-rules-panel]');
        const place = { cls: box.className, style: box.getAttribute('style') };
        cleanup();
        const heroPanel = render(wrap(h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: 'h1' })));
        const heroBox = q(heroPanel, '[data-hero-panel]');
        expect(place.style).toBe(heroBox.getAttribute('style'));
        expect(place.cls.split(' ')).toEqual(expect.arrayContaining(['absolute', 'inset-y-0', 'right-0']));
        cleanup();
        const left = render(wrap(h(HeroRulesSidePanel, { menuRight: true, heroId: 'h1', onClose: () => {} })));
        expect(q(left, '[data-hero-rules-panel]').className.split(' ')).toContain('left-0');
    });
});

describe('H3: open until closed', () => {
    it('closes on Escape and on its X, not on a click on the mat', () => {
        const onClose = vi.fn();
        const view = render(wrap(
            h('div', { 'data-testid': 'mat' }, 'mat'),
            h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose })
        ));
        fireEvent.pointerDown(q(view, '[data-testid="mat"]'));
        fireEvent.click(q(view, '[data-testid="mat"]'));
        expect(onClose).not.toHaveBeenCalled();
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(q(view, '[data-flag-rules-close]'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('one Escape, one layer: Escape during a drag leaves it open', () => {
        const onClose = vi.fn();
        render(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose })));
        document.body.classList.add('gi-dnd-active');
        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('registers no drop targets while closed (T-104)', () => {
        const drops = (v) => v.container.querySelectorAll('[data-dnd-droppable-id]');
        const view = render(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: null, onClose: () => {} })));
        expect(drops(view).length).toBe(0);
        expect(q(view, '[data-hero-rules-panel]')).toBeNull();

        view.rerender(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose: () => {} })));
        expect([...drops(view)].map(el => el.getAttribute('data-dnd-droppable-id'))).toEqual(['hero-rules-drop']);

        view.rerender(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: null, onClose: () => {} })));
        settle();
        expect(drops(view).length).toBe(0);
        expect(q(view, '[data-hero-rules-panel]')).toBeNull();
    });
});

describe('H3: one side panel at a time', () => {
    it('the rules replace the hero panel; closing them returns to the mat; opening a hero closes them', () => {
        const view = render(h(Host));
        fireEvent.click(q(view, '[data-dock-hero="h1"]'));
        expect(q(view, '[data-hero-panel-body="h1"]')).not.toBeNull();

        hover(view, 'h2');
        fireEvent.click(gearOf(view, 'h2'));
        settle();
        expect(rulesFor(view)).toBe('h2');
        expect(q(view, '[data-hero-panel-body]')).toBeNull();

        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        settle();
        expect(rulesFor(view)).toBeNull();
        expect(q(view, '[data-hero-panel-body]')).toBeNull();

        hover(view, 'h3');
        fireEvent.click(gearOf(view, 'h3'));
        fireEvent.click(q(view, '[data-dock-hero="h4"]'));
        settle();
        expect(q(view, '[data-hero-panel-body="h4"]')).not.toBeNull();
        expect(rulesFor(view)).toBeNull();
    });

    it('as a hook: whichever opened last wins', () => {
        const closeHero = vi.fn();
        const closeRules = vi.fn();
        const { rerender } = renderHook((p) => useOneSidePanel({ ...p, closeHero, closeRules }), {
            initialProps: { heroId: 'h1', rulesHeroId: null }
        });
        rerender({ heroId: 'h1', rulesHeroId: 'h2' });
        expect(closeHero).toHaveBeenCalledTimes(1);
        expect(closeRules).not.toHaveBeenCalled();
        rerender({ heroId: null, rulesHeroId: 'h2' });
        rerender({ heroId: 'h3', rulesHeroId: 'h2' });
        expect(closeRules).toHaveBeenCalledTimes(1);
        expect(closeHero).toHaveBeenCalledTimes(1);
    });
});

describe('H3: the rules read per UI_STYLE', () => {
    it('one line per rule, levels as 30/99, no boxed rows', () => {
        const view = render(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose: () => {} })));
        const row = q(view, '[data-rule-row="forestry"]');
        expect(row.querySelector('[data-rule-level]').textContent).toBe('30/99');
        expect(row.className).not.toMatch(/\bborder\b/);
        expect(q(view, '[data-hero-rules-panel]').textContent).not.toMatch(/Lv\.?\s|LVL|Level/);
    });
});

describe('H3: Copy rules to…', () => {
    beforeEach(() => {
        Flags.setRule('h1', 'forestry', { priority: 1 });
        Flags.setRule('h1', 'mining', { allowed: false });
        Flags.setRule('h1', FlagRules.FIGHT, { priority: 5 });
        Flags.setRule('h3', 'mining', { priority: 2 });
    });

    it('Flags.copyRules sets each rule a target holds and skips the rest', () => {
        const res = Flags.copyRules('h1', ['h2', 'h3']);
        expect(res.success).toBe(true);
        expect(res.results).toEqual([
            { heroId: 'h2', copied: ['forestry'], skipped: ['mining', FlagRules.FIGHT] },
            { heroId: 'h3', copied: ['forestry', 'mining'], skipped: [FlagRules.FIGHT] }
        ]);
        expect(FlagRules.ruleOf('h2', 'forestry')).toEqual({ allowed: true, priority: 1 });
        expect(GameState.state.heroes.find(x => x.id === 'h2').flagRules).toEqual({ forestry: { allowed: true, priority: 1 } });
        // A copy, not a merge: h3's own mining priority 2 becomes the source's 3.
        expect(FlagRules.ruleOf('h3', 'mining')).toEqual({ allowed: false, priority: 3 });
        expect(Flags.copyRules('nobody', ['h2']).success).toBe(false);
    });

    it('lists the other heroes, copies to the checked ones and says what was skipped', () => {
        const view = render(wrap(h(HeroRulesSidePanel, { menuRight: false, heroId: 'h1', onClose: () => {} })));
        const targets = [...view.container.querySelectorAll('[data-copy-target]')].map(el => el.getAttribute('data-copy-target'));
        expect(targets).toEqual(['h2', 'h3', 'h4']);
        const copy = q(view, '[data-copy-rules]');
        expect(copy.disabled).toBe(true);

        fireEvent.click(q(view, '[data-copy-target="h2"] input'));
        fireEvent.click(q(view, '[data-copy-target="h3"] input'));
        expect(copy.disabled).toBe(false);
        act(() => { fireEvent.click(copy); });

        expect(FlagRules.ruleOf('h2', 'forestry').priority).toBe(1);
        expect(FlagRules.ruleOf('h3', 'mining').allowed).toBe(false);
        expect(FlagRules.ruleOf('h4', 'forestry')).toEqual({ allowed: true, priority: 3 });
        expect(FlagRules.ruleOf('h4', 'mining')).toEqual({ allowed: true, priority: 3 });

        const note = q(view, '[data-copy-result]').textContent;
        expect(note).toContain('Brenna');
        expect(note).toContain('Cedric');
        expect(note).toMatch(/Brenna[^.]*skipped[^.]*Mining/i);
        expect(note).not.toContain('Dara');
        expect(view.container.querySelectorAll('[data-copy-target] input:checked').length).toBe(0);
    });
});
