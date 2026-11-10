// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { SkillIcon, skillArt, SKILL_PLACEHOLDER_SPRITE } from '../ui/components/base/SkillIcon.jsx';
import { resolveSpritePath } from '../utils/AssetManager.js';
import { getSkill } from '../config/registries/skillRegistry.js';
import { heroSkillList } from '../ui/components/dock/heroPanelSkills.js';
import { DOCK_STRIP_PX } from '../ui/components/dock/dockHeroView.js';
import { SLOT_ORDER } from '../config/registries/equipmentConstants.js';
import { t } from '../i18n/index.js';
import fs from 'node:fs';
import path from 'node:path';

const h = React.createElement;
const hero = (id, name, extra = {}) => ({
    id, name, spriteId: 'hn_recruit_por', hp: { current: 80, max: 100 }, status: 'idle', equipment: {}, skills: {}, ...extra
});
const panel = (props) => h(DeckDndProvider, null, h(HeroDrawer, { menuRight: false, ...props }));

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric'), hero('h2', 'Brenna')];
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('skill icons are pixel, never emoji', () => {
    const ids = heroSkillList({ skills: {} }).rows.map(r => r.id);

    it('every skill on the sheet draws a picture and no text', () => {
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            const r = render(h(SkillIcon, { skillId: id }));
            expect(r.container.querySelector('img')?.getAttribute('src'), id).toBeTruthy();
            expect(r.container.textContent, id).toBe('');
            cleanup();
        }
    });

    it('Farming, Alchemy and Construction have their art; a skill with none shares the placeholder', () => {
        expect(resolveSpritePath('farming')).toBe('assets/skills/s_farming.png');
        expect(resolveSpritePath('alchemy')).toBe('assets/skills/s_flask.png');
        expect(resolveSpritePath('construction')).toBe('assets/skills/s_industry.png');
        expect(skillArt('farming').spritePath).toBe('assets/skills/s_farming.png');
        expect(skillArt('stealth').spritePath).toBe(SKILL_PLACEHOLDER_SPRITE);
        expect(skillArt('faith').spritePath).toBe(SKILL_PLACEHOLDER_SPRITE);
        expect(skillArt('no_such_skill').spritePath).toBe(SKILL_PLACEHOLDER_SPRITE);
    });

    it('art that fails to load falls back to the placeholder, not an emoji', () => {
        const r = render(h(SkillIcon, { skillId: 'mining' }));
        fireEvent.error(r.container.querySelector('img'));
        expect(r.container.querySelector('img').getAttribute('src')).toBe(SKILL_PLACEHOLDER_SPRITE);
        expect(r.container.textContent).toBe('');
    });
});

describe('the drawer\'s skills, in columns of four', () => {
    it('flows the skills down columns of four, each with its large icon and its name', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const group = r.container.querySelector('[data-skill-group="held"]');
        expect(group.className.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-flow-col']));
        expect(group.style.gridTemplateRows).toBe('repeat(4, auto)');
        // No section headers among the skills.
        expect([...group.children].every(el => el.querySelector('[data-skill-row]') || el.hasAttribute('data-skill-row'))).toBe(true);
        const row = group.querySelector('[data-skill-row="mining"]');
        expect(row.textContent).toBe('Mining1/99');
        // The name in the bright white of values, not muted.
        expect(row.querySelector('[data-skill-name]').className.split(' ')).toContain('text-white');
        expect(row.querySelector('img').style.width).toBe('48px');
        fireEvent.pointerEnter(row);
        const tip = document.body.querySelector('[data-tooltip]');
        expect(tip.textContent).toContain('Mining 1/99');
        fireEvent.pointerLeave(row);
    });

    it('a click opens the skill panel over the drawer; another switches it; its X and Escape close it first', () => {
        const onCloseHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', onCloseHero }));
        const group = r.container.querySelector('[data-skill-group="held"]');
        const [a, b] = [...group.querySelectorAll('[data-skill-row]')].map(el => el.getAttribute('data-skill-row'));

        fireEvent.click(group.querySelector(`[data-skill-row="${a}"]`));
        const opened = r.container.querySelector(`[data-hero-skill-panel="${a}"]`);
        expect(opened).not.toBeNull();
        // Over the drawer's top edge, not inside the grid.
        expect(group.contains(opened)).toBe(false);
        expect(opened.style.bottom).toMatch(/^calc\(100% \+ \d+px\)$/);
        expect(opened.querySelector('[data-skill-detail]')).not.toBeNull();
        expect(opened.textContent).toContain(getSkill(a).name);
        expect(opened.querySelector('[data-hero-skill-panel-book]')).not.toBeNull();

        fireEvent.click(group.querySelector(`[data-skill-row="${b}"]`));
        expect(r.container.querySelector(`[data-hero-skill-panel="${a}"]`)).toBeNull();
        expect(r.container.querySelector(`[data-hero-skill-panel="${b}"]`)).not.toBeNull();

        act(() => fireEvent.keyDown(document, { key: 'Escape' }));
        expect(r.container.querySelector('[data-hero-skill-panel]')).toBeNull();
        expect(onCloseHero).not.toHaveBeenCalled();

        fireEvent.click(group.querySelector(`[data-skill-row="${a}"]`));
        fireEvent.click(r.container.querySelector('[data-hero-skill-panel-close]'));
        expect(r.container.querySelector('[data-hero-skill-panel]')).toBeNull();
        expect(onCloseHero).not.toHaveBeenCalled();
    });

    it('a skill\'s panel says what the skill is for, from the strings file', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(r.container.querySelector('[data-hero-skill-panel-purpose]').textContent)
            .toBe(t('skillPurpose.mining'));
    });
});

describe('Skills and Combat', () => {
    it('switches the right-hand block between the skills grid and the combat numbers, the loadout staying', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const tab = (id) => r.container.querySelector(`[data-hero-view-tab="${id}"]`);
        expect(tab('skills').getAttribute('aria-selected')).toBe('true');
        expect(r.container.querySelector('[data-hero-combat]')).toBeNull();
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        fireEvent.click(tab('combat'));
        expect(tab('combat').getAttribute('aria-selected')).toBe('true');
        expect(r.container.querySelector('[data-skill-group]')).toBeNull();
        // The skill panel belongs to the skills: it goes with them.
        expect(r.container.querySelector('[data-hero-skill-panel]')).toBeNull();
        const stats = [...r.container.querySelectorAll('[data-hero-combat-stat]')].map(el => el.getAttribute('data-hero-combat-stat'));
        expect(stats).toEqual(['style', 'hit', 'range', 'swing', 'crit', 'accuracy', 'dodge', 'resists', 'cuts', 'effects']);
        expect(r.container.querySelectorAll('[data-hero-drawer-block="equipment"] [data-equip-slot]').length).toBe(SLOT_ORDER.length);
        fireEvent.click(tab('skills'));
        expect(r.container.querySelector('[data-skill-group="held"]')).not.toBeNull();
    });
});

describe('nothing in the drawer scrolls', () => {
    it('has no scroll list, arrow bars or scroll bar', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const body = r.container.querySelector('[data-hero-panel-body]');
        expect(body.querySelector('[data-scroll-list]')).toBeNull();
        expect(body.querySelector('[data-scroll-arrow]')).toBeNull();
        expect(body.querySelector('.gi-scrollbar')).toBeNull();
    });
});

describe('the header, and close and edit in the drawer\'s corner', () => {
    const controls = (r) => r.container.querySelector('[data-hero-panel-controls]');

    it('a header runs above the blocks: the name over the hero\'s column, the HP bar over the rest', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const header = r.container.querySelector('[data-hero-drawer-header]');
        const name = header.querySelector('[data-hero-panel-name]');
        const hp = header.querySelector('[data-hero-panel-hp]');
        expect(name.className).toContain('ui-text-display');
        expect(name.compareDocumentPosition(hp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // The HP bar takes the rest of the header's width.
        expect(hp.style.flex).toBe('1 1 0%');
        // The name's column is the hero's column below it.
        const summary = r.container.querySelector('[data-hero-drawer-block="summary"]');
        expect(name.style.width).toBe(summary.style.width);
        expect(header.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(summary.querySelector('[data-hero-panel-name], [data-hero-panel-hp]')).toBeNull();
    });

    it('stand in the drawer\'s own top right corner, outside the blocks, clear of a nav on that side', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const body = r.container.querySelector('[data-hero-panel-body]');
        expect(body.contains(controls(r))).toBe(false);
        expect(controls(r).className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'top-2']));
        expect(controls(r).style.right).toContain('--nav-inset-r');
        // The quill first, the X at the very corner.
        expect(controls(r).lastElementChild.hasAttribute('data-hero-panel-close')).toBe(true);
        expect(controls(r).querySelector('[data-hero-panel-close]')).not.toBeNull();
        expect(controls(r).querySelector('[data-hero-panel-edit]')).not.toBeNull();
    });

    it('the Edit and close controls work', () => {
        const onEditHero = vi.fn();
        const onCloseHero = vi.fn();
        const r = render(panel({ selectedHeroId: 'h1', onEditHero, onCloseHero }));
        fireEvent.click(controls(r).querySelector('[data-hero-panel-edit]'));
        expect(onEditHero).toHaveBeenCalledWith('h1');
        fireEvent.click(controls(r).querySelector('[data-hero-panel-close]'));
        expect(onCloseHero).toHaveBeenCalledTimes(1);
    });
});

describe('the flag on the sheet', () => {
    it('stands behind the hero\'s shoulder, farther out than beside the head, drawn behind them', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const box = r.container.querySelector('[data-hero-panel-sprite]');
        const size = Number(box.getAttribute('data-hero-panel-sprite-px'));
        const flag = r.container.querySelector('[data-hero-panel-flag]');
        const figure = r.container.querySelector('[data-hero-panel-figure]');
        const flagPx = parseFloat(flag.style.width);
        // Its near edge 12 % of the art left of the hero's middle (the bar's shoulder), not 4 %.
        expect(parseFloat(flag.style.left) + flagPx).toBe(Math.round(size / 2 - size * 0.12));
        expect(flag.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('no hero column: the heroes stay on the bar', () => {
    it('draws nothing at all with no hero open', () => {
        const r = render(panel({ selectedHeroId: null }));
        expect(r.container.querySelector('[data-hero-panel]')).toBeNull();
    });

    it('reaches the screen\'s bottom edge behind the bar, keeps a band at its foot for the strip and names, and holds no hero tabs', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const aside = r.container.querySelector('[data-hero-panel]');
        expect(aside.style.bottom).toBe('0px');
        expect(parseFloat(aside.querySelector('[data-hero-drawer-foot]').style.height)).toBeGreaterThan(DOCK_STRIP_PX);
        expect(aside.className.split(' ')).not.toContain('top-0');
        expect(Number.parseFloat(aside.querySelector('[data-hero-drawer-foot]').style.height)).toBeGreaterThan(0);
        expect(r.container.querySelector('[data-hero-column], [data-hero-dock-tab]')).toBeNull();
    });
});

describe('the Inventory label and the slide', () => {
    it('names the loadout grid in one word over it', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const block = r.container.querySelector('[data-hero-drawer-block="equipment"]');
        const label = block.querySelector('[data-hero-drawer-inventory]');
        expect(label.textContent).toBe(t('heroPanel.inventory'));
        expect(t('heroPanel.inventory')).toBe('Inventory');
        expect(label.compareDocumentPosition(block.querySelector('[data-equip-slot]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('slides as the side drawers do, still under reduced motion (source)', () => {
        const code = fs.readFileSync(path.resolve(__dirname, '../ui/components/dock/HeroDrawer.jsx'), 'utf8');
        expect(code.includes('<motion.aside')).toBe(true);
        expect(code).toMatch(/prefersReducedMotion\(\) \? \{ duration: 0 \} : SIDE_DRAWER_TRANSITION/);
        expect(code).toMatch(/initial=\{\{ y: heroDrawerY\(false\) \}\}/);
    });
});

describe('the loadout can grow', () => {
    it('draws one slot per entry of the slot order, three to a row', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        expect(r.container.querySelectorAll('[data-equip-slot]').length).toBe(SLOT_ORDER.length);
    });
});
