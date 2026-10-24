// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import {
    SKILL_LAYERS, getSkillIdsByLayer, getSkill, COMBAT_PURPOSE, skillPurpose
} from '../config/registries/skillRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { WorkRulesDrawer, LAUNCHER_PX, CELL_PX, drawerInsets } from '../ui/components/dock/WorkRulesDrawer.jsx';
import { requiresText } from '../ui/components/dock/heroPanelSkills.js';
import { setLockedListOpen } from '../ui/components/dock/heroPanelSkills.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { matW } from '../config/matGeometry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Work Permissions: the launcher in its own slot on the hero bar (the only way in), the drawer
 * as wide as its square cells with every skill column, one Combat column in place of the combat
 * skills and Fight, and header tooltips that say what each skill is for.
 */

const h = React.createElement;

const skills = (levels) => Object.fromEntries(Object.entries(levels).map(([id, level]) => [id, { level, xp: 0 }]));
const hero = (id, name, levels) => ({
    id, name, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'idle', equipment: {},
    skills: skills(levels), flagRules: {}
});

const wrap = (...children) => h(DeckDndProvider, null, ...children);

/** The bar and the drawer, wired as ReactRoot wires them. */
const Host = () => {
    const [open, setOpen] = React.useState(false);
    const toggle = React.useCallback(() => setOpen(o => !o), []);
    const close = React.useCallback(() => setOpen(false), []);
    return wrap(
        h(BottomHeroDock, { selectedHeroId: null, onSelectHero: () => {}, rulesOpen: open, onToggleRules: toggle }),
        h(WorkRulesDrawer, { open, litHeroId: null, onClose: close })
    );
};

const q = (view, sel) => view.container.querySelector(sel);
const qa = (view, sel) => [...view.container.querySelectorAll(sel)];
const drawer = (view) => q(view, '[data-work-rules-drawer]');
const cell = (view, heroId, col) => q(view, `[data-rules-cell="${heroId}:${col}"]`);
const click = (el) => act(() => { fireEvent.click(el); });
const rightClick = (el) => act(() => {
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
});
const settle = () => act(() => { vi.advanceTimersByTime(1000); });
const openDrawer = () => render(wrap(h(WorkRulesDrawer, { open: true, litHeroId: null, onClose: () => {} })));
const tipText = () => document.querySelector('[data-tooltip]')?.textContent ?? null;

/** The concept doc's drafted lines (concept_work_permissions.md), word for word. */
const DRAFTED = {
    mining: 'Mines ore, stone and gems from veins, for Smithing, Crafting and Construction.',
    forestry: 'Fells trees for logs, sap and bark, for Construction, Crafting and fuel.',
    fishing: 'Catches fish and finds from the water, for Cooking and Crafting.',
    farming: 'Plants and harvests crops, fruit, herbs and saplings, for Cooking, Alchemy and Forestry.',
    smithing: 'Smelts ingots and forges tools, weapons and metal armour for heroes.',
    crafting: 'Makes rope, cloth, glass, leather gear and the everyday parts other skills need.',
    cooking: 'Cooks food and drinks that heal heroes in fights.',
    alchemy: 'Brews potions heroes use in fights and at work.',
    construction: 'Builds stations and buildings on Foundations, and takes down marked Tokens.'
};

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [
        // A Ranger: a combat skill and an Advanced skill.
        hero('h1', 'Aldric', { forestry: 30, mining: 20, ranged: 12, fletching: 4 }),
        // A Recruit: no combat skill, fights as a level 1 fighter.
        hero('r1', 'Rook', { forestry: 5 })
    ];
    setLiveMatFit(1);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    setLockedListOpen(false);
});

describe('the launcher', () => {
    it('sits in its own slot at the hero bar’s left end, inside the mat’s edges, labelled Work Permissions, with the heroes after it', () => {
        const view = render(h(Host));
        const slot = q(view, '[data-work-rules-slot]');
        expect(slot.closest('[data-bottom-hero-dock]')).not.toBeNull();
        expect(slot.style.width).toBe(`${LAUNCHER_PX}px`);
        expect(slot.className).toContain('left-0');
        // Under the mat: the bar's contents span the mat's width on screen, centred as the Board centres it.
        const span = slot.closest('[data-dock-mat-span]');
        expect(span).not.toBeNull();
        expect(span.style.width).toBe(`${Math.round(matW() * 1)}px`);
        expect(span.className).toContain('mx-auto');
        // A solid button: the chamfer frame with its hard shadow, and the shine.
        expect(slot.querySelector('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(slot.querySelector('[data-pixel-frame-shadow]')).not.toBeNull();
        const button = slot.querySelector('[data-work-rules-button]');
        expect(button.closest('[data-pixel-frame="chamfer"]')).not.toBeNull();
        expect(button.className).toContain('ui-shine');
        expect(button.textContent).toBe('WorkPermissions');
        expect(button.getAttribute('aria-label')).toBe('Work Permissions');
        expect(button.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_gear.png');
        // The heroes stand to the right of the slot, never under it.
        const heroes = q(view, '[data-dock-slot]').parentElement;
        expect(heroes.style.left).toBe(`${LAUNCHER_PX}px`);
    });

    it('opens and closes the drawer', () => {
        const view = render(h(Host));
        const button = () => q(view, '[data-work-rules-button]');
        expect(drawer(view)).toBeNull();
        click(button());
        expect(drawer(view)).not.toBeNull();
        expect(button().getAttribute('aria-pressed')).toBe('true');
        click(button());
        settle();
        expect(drawer(view)).toBeNull();
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('its tooltip names it Work Permissions', () => {
        const view = render(h(Host));
        fireEvent.pointerEnter(q(view, '[data-work-rules-button]'));
        expect(tipText()).toContain('Work Permissions');
    });
});

describe('the drawer’s frame and slide', () => {
    it('wears the chamfer frame and rises from below the hero bar into place', () => {
        const view = render(h(Host));
        click(q(view, '[data-work-rules-button]'));
        const panel = () => q(view, '[data-work-rules-panel]');
        expect(panel().getAttribute('data-pixel-frame')).toBe('chamfer');
        // Mounted below the bottom of the screen: its own height plus the bar's, and a little more.
        expect(panel().style.transform).toBe('translateY(calc(100% + 72px))');
        act(() => { vi.advanceTimersByTime(20); });
        expect(panel().style.transform).toBe('translateY(0)');
        // It rests on the bar's top edge, and nothing clips it on the way up.
        expect(drawer(view).style.bottom).toBe('64px');
        expect(drawer(view).className).not.toContain('overflow-hidden');
        // Reduced motion: it is simply there.
        expect(panel().className).toContain('motion-reduce:transition-none');
        click(q(view, '[data-work-rules-button]'));
        expect(panel().style.transform).toBe('translateY(calc(100% + 72px))');
        settle();
        expect(drawer(view)).toBeNull();
    });

    it('puts Combat in its first column', () => {
        const view = openDrawer();
        expect(q(view, '[data-rules-col]').getAttribute('data-rules-col')).toBe(FlagRules.FIGHT);
        expect(q(view, '[data-rules-row="h1"] [data-rules-cell]').getAttribute('data-rules-cell')).toBe(`h1:${FlagRules.FIGHT}`);
    });
});

describe('the drawer centring', () => {
    const rect = (left, right) => ({ left, right });
    it('measures how far the hero panel intrudes into the mat column from either side', () => {
        expect(drawerInsets(rect(100, 900), null)).toEqual({ left: 0, right: 0 });
        expect(drawerInsets(rect(100, 900), rect(580, 940))).toEqual({ left: 0, right: 320 });
        expect(drawerInsets(rect(100, 900), rect(60, 420))).toEqual({ left: 320, right: 0 });
        expect(drawerInsets(rect(100, 900), rect(920, 1280))).toEqual({ left: 0, right: 0 });
    });

    it('with the hero panel open the drawer is inset by the panel so it clears it', () => {
        const panel = document.createElement('aside');
        panel.setAttribute('data-hero-panel', 'true');
        document.body.appendChild(panel);
        const proto = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
            if (this === panel) return { left: 580, right: 940, top: 0, bottom: 800, width: 360, height: 800 };
            return { left: 100, right: 900, top: 0, bottom: 800, width: 800, height: 800 };
        };
        try {
            const view = render(wrap(h(WorkRulesDrawer, { open: true, heroPanelOpen: true, litHeroId: null, onClose: () => {} })));
            expect(drawer(view).style.left).toBe('0px');
            expect(drawer(view).style.right).toBe('320px');
            expect(drawer(view).style.maxWidth).toBe('calc(100% - 320px)');
            expect(drawer(view).className).toContain('mx-auto');
            view.rerender(wrap(h(WorkRulesDrawer, { open: true, heroPanelOpen: false, litHeroId: null, onClose: () => {} })));
            expect(drawer(view).style.right).toBe('0px');
        } finally {
            Element.prototype.getBoundingClientRect = proto;
            panel.remove();
        }
    });
});

describe('the drawer', () => {
    it('is titled Work Permissions and is as wide as its content, with square fixed-size cells', () => {
        const view = openDrawer();
        expect(q(view, '[data-rules-title]').textContent).toBe('Work Permissions');
        expect(drawer(view).textContent).not.toMatch(/work rules/i);
        expect(drawer(view).className).toContain('w-max');
        // Centred: margins auto between a zero left and right inset while the hero panel is closed.
        expect(drawer(view).className).toContain('mx-auto');
        expect(drawer(view).className).not.toContain('left-0');
        expect(drawer(view).style.left).toBe('0px');
        expect(drawer(view).style.right).toBe('0px');
        expect(drawer(view).style.maxWidth).toBe('calc(100% - 0px)');
        const row = q(view, '[data-rules-row="h1"]');
        const cols = view.container.querySelectorAll('[data-rules-col]').length;
        expect(row.style.gridTemplateColumns).toBe(`150px repeat(${cols}, ${CELL_PX}px)`);
        expect(row.style.gridTemplateColumns).not.toContain('fr');
        expect(row.style.height).toBe(`${CELL_PX}px`);
        const header = q(view, '[data-rules-col]').parentElement;
        expect(header.style.gridTemplateColumns).toBe(row.style.gridTemplateColumns);
        expect(header.style.height).toBe(`${CELL_PX}px`);
    });

    it('shows every skill column, Advanced and Master included, whatever the heroes hold', () => {
        const view = openDrawer();
        const cols = qa(view, '[data-rules-col]').map(el => el.getAttribute('data-rules-col'));
        for (const id of [
            ...getSkillIdsByLayer(SKILL_LAYERS.STARTING),
            ...getSkillIdsByLayer(SKILL_LAYERS.ADVANCED),
            ...getSkillIdsByLayer(SKILL_LAYERS.MASTER)
        ]) expect(cols).toContain(id);
        // A skill the hero lacks is a blank cell, not a missing one.
        for (const id of getSkillIdsByLayer(SKILL_LAYERS.MASTER)) {
            expect(cell(view, 'r1', id).getAttribute('data-cell')).toBe('missing');
            expect(cell(view, 'r1', id).textContent).toBe('');
        }
        expect(cell(view, 'h1', 'fletching').getAttribute('data-cell')).toBe('rule');
    });
});

describe('one Combat column', () => {
    it('replaces the combat skill columns and Fight', () => {
        const view = openDrawer();
        const cols = qa(view, '[data-rules-col]').map(el => el.getAttribute('data-rules-col'));
        for (const id of getSkillIdsByLayer(SKILL_LAYERS.COMBAT)) expect(cols).not.toContain(id);
        expect(cols.filter(id => id === FlagRules.FIGHT)).toHaveLength(1);
        expect(q(view, `[data-rules-col="${FlagRules.FIGHT}"]`).getAttribute('aria-label')).toBe('Combat');
        expect(drawer(view).textContent).not.toContain('Fight');
        // Every hero has the cell, the Recruit included.
        expect(cell(view, 'h1', FlagRules.FIGHT).getAttribute('data-cell')).toBe('rule');
        expect(cell(view, 'r1', FlagRules.FIGHT).getAttribute('data-cell')).toBe('rule');
    });

    it('a plain tick turns the hero’s fighting off and on', () => {
        const view = openDrawer();
        const combat = () => cell(view, 'r1', FlagRules.FIGHT);
        expect(combat().querySelector('[data-cell-tick]')).not.toBeNull();
        click(combat());
        expect(FlagRules.ruleOf('r1', FlagRules.FIGHT).allowed).toBe(false);
        expect(combat().querySelector('[data-cell-tick]')).toBeNull();
        click(combat());
        expect(FlagRules.ruleOf('r1', FlagRules.FIGHT)).toEqual({ allowed: true, priority: 1 });
    });

    it('takes a priority in priority mode, to rank fighting against work', () => {
        const view = openDrawer();
        click(q(view, '[data-rules-mode]'));
        const combat = () => cell(view, 'h1', FlagRules.FIGHT);
        expect(combat().textContent).toBe('3');
        rightClick(combat());
        rightClick(combat());
        expect(FlagRules.ruleOf('h1', FlagRules.FIGHT)).toEqual({ allowed: true, priority: 1 });
        expect(combat().textContent).toBe('1');
        click(cell(view, 'h1', 'forestry'));
        click(cell(view, 'h1', 'forestry'));
        expect(FlagRules.ruleOf('h1', 'forestry')).toEqual({ allowed: true, priority: 5 });
    });

    it('its column header switches fighting for every hero', () => {
        const view = openDrawer();
        click(q(view, `[data-rules-col="${FlagRules.FIGHT}"]`));
        expect(FlagRules.ruleOf('h1', FlagRules.FIGHT).allowed).toBe(false);
        expect(FlagRules.ruleOf('r1', FlagRules.FIGHT).allowed).toBe(false);
    });
});

describe('header tooltips: what a skill is for', () => {
    it('the Starting skills carry the drafted purpose lines', () => {
        for (const [id, line] of Object.entries(DRAFTED)) expect(getSkill(id).purpose).toBe(line);
        expect(Object.keys(DRAFTED).sort()).toEqual(getSkillIdsByLayer(SKILL_LAYERS.STARTING).sort());
    });

    it('each header shows its skill’s name and purpose line, and no clicking hint', () => {
        const view = openDrawer();
        for (const id of Object.keys(DRAFTED)) {
            const header = q(view, `[data-rules-col="${id}"]`);
            fireEvent.pointerEnter(header);
            expect(tipText()).toBe(`${getSkill(id).name}${DRAFTED[id]}`);
            fireEvent.pointerLeave(header);
        }
    });

    it('Combat shows its own line; a placeholder skill shows its description', () => {
        const view = openDrawer();
        fireEvent.pointerEnter(q(view, `[data-rules-col="${FlagRules.FIGHT}"]`));
        expect(tipText()).toBe(`Combat${COMBAT_PURPOSE}`);
        expect(COMBAT_PURPOSE).toBe('Fights enemies within the hero’s reach for loot, Maps and combat XP.');
        fireEvent.pointerLeave(q(view, `[data-rules-col="${FlagRules.FIGHT}"]`));

        const faith = q(view, '[data-rules-col="faith"]');
        fireEvent.pointerEnter(faith);
        expect(tipText()).toBe(`Faith${getSkill('faith').description}`);
        expect(skillPurpose('faith')).toBe(getSkill('faith').description);
    });
});

describe('the hero panel tidy', () => {
    const panel = (heroId) => render(wrap(h(BankHeroPanel, { menuRight: false, showTabs: false, selectedHeroId: heroId })));

    it('has no Work Rules button or link: the launcher is the only way in', () => {
        const view = panel('h1');
        expect(q(view, '[data-hero-panel-body="h1"]')).not.toBeNull();
        expect(q(view, '[data-hero-panel-rules]')).toBeNull();
        expect(view.container.textContent).not.toMatch(/work rules|work permissions/i);
    });

    it('a locked skill’s tooltip names the class that unlocks it', () => {
        expect(requiresText('ranged')).toBe('Requires Ranger.');
        expect(requiresText('melee')).toBe('Requires Fighter.');
        expect(requiresText('faith')).toBe('Requires Paladin.');
        expect(requiresText('enchanting')).toBe('Requires Wizard, Paladin or Beastmaster.');

        setLockedListOpen(true);
        const view = panel('r1');
        const ranged = q(view, '[data-skill-row="ranged"]');
        expect(ranged.getAttribute('data-skill-locked')).toBe('true');
        fireEvent.pointerEnter(ranged);
        expect(tipText()).toContain('Requires Ranger.');
    });

    it('the close X draws at its sprite’s size, 16 px at 2×', () => {
        const view = panel('h1');
        const img = q(view, '[data-hero-panel-close] img');
        expect(img.style.width).toBe('32px');
        expect(img.style.height).toBe('32px');
    });
});
