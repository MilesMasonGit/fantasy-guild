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
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { SkillIcon, skillArt, SKILL_PLACEHOLDER_SPRITE } from '../ui/components/base/SkillIcon.jsx';
import { resolveSpritePath } from '../utils/AssetManager.js';
import { getSkill } from '../config/registries/skillRegistry.js';
import { heroSkillList } from '../ui/components/dock/heroPanelSkills.js';
import { DOCK_STRIP_PX } from '../ui/components/dock/dockHeroView.js';
import { SLOT_ORDER } from '../config/registries/equipmentConstants.js';

const h = React.createElement;
const hero = (id, name, extra = {}) => ({
    id, name, spriteId: 'hn_recruit_por', hp: { current: 80, max: 100 }, status: 'idle', equipment: {}, skills: {}, ...extra
});
const panel = (props) => h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false, ...props }));

/** `ArrowScrollList` draws its bars only when its content is taller than its box. */
function fakeOverflow(list) {
    Object.defineProperty(list, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true });
    act(() => { window.dispatchEvent(new Event('resize')); });
}

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

describe('the sheet\'s skills, two side by side', () => {
    it('lays the skills in two columns with the name only in the tip', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const group = r.container.querySelector('[data-skill-group="held"]');
        expect(group.className.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-2']));
        const row = group.querySelector('[data-skill-row="mining"]');
        expect(row.textContent).toBe('1/99');
        fireEvent.pointerEnter(row);
        const tip = document.body.querySelector('[data-tooltip]');
        expect(tip.textContent).toContain('Mining');
        fireEvent.pointerLeave(row);
    });

    it('a click opens the numbers across both columns, under the pair the skill stands in', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const group = r.container.querySelector('[data-skill-group="held"]');
        const order = () => [...group.children].map(el => el.getAttribute('data-skill-row') || `open:${el.getAttribute('data-skill-opened')}`);
        const [a, b, c] = order();

        fireEvent.click(group.querySelector(`[data-skill-row="${a}"]`));
        expect(order().slice(0, 4)).toEqual([a, b, `open:${a}`, c]);
        const opened = group.querySelector(`[data-skill-opened="${a}"]`);
        expect(opened.className.split(' ')).toContain('col-span-2');
        expect(opened.querySelector('[data-skill-detail]')).not.toBeNull();
        expect(opened.textContent).toContain(getSkill(a).name);

        // The second of a pair opens in the same place.
        fireEvent.click(group.querySelector(`[data-skill-row="${b}"]`));
        expect(order().slice(0, 4)).toEqual([a, b, `open:${b}`, c]);
    });
});

describe('the sheet scrolls with arrows', () => {
    it('has no bars when it fits, both when it overflows, and no scroll bar class', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const body = r.container.querySelector('[data-hero-panel-body]');
        expect(body.querySelector('[data-scroll-arrow]')).toBeNull();
        expect(body.querySelector('.gi-scrollbar')).toBeNull();
        fakeOverflow(body.querySelector('[data-scroll-list]'));
        expect(body.querySelector('[data-scroll-arrow="up"]')).not.toBeNull();
        expect(body.querySelector('[data-scroll-arrow="down"]')).not.toBeNull();
    });
});

describe('close and edit in the side space', () => {
    const controls = (r) => r.container.querySelector('[data-hero-panel-controls]');

    it('stand outside the sheet', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        expect(r.container.querySelector('[data-hero-panel-body] [data-hero-panel-close]')).toBeNull();
        expect(controls(r).querySelector('[data-hero-panel-close]')).not.toBeNull();
        expect(controls(r).querySelector('[data-hero-panel-edit]')).not.toBeNull();
    });

    it('are on the outer edge, on whichever side the panel sits', () => {
        const right = render(panel({ selectedHeroId: 'h1', menuRight: false }));
        expect(controls(right).className.split(' ')).toContain('right-0');
        cleanup();
        const left = render(panel({ selectedHeroId: 'h1', menuRight: true }));
        expect(controls(left).className.split(' ')).toContain('left-0');
    });

    it('the Edit and close controls still work from there', () => {
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
    it('stands on the hero\'s other side, drawn behind them', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const flag = r.container.querySelector('[data-hero-panel-flag]');
        const figure = r.container.querySelector('[data-hero-panel-figure]');
        expect(flag.style.left).toMatch(/^calc\(50% - \d+px\)$/);
        expect(flag.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('no hero column: the heroes stay on the bar', () => {
    it('draws nothing at all with no hero open', () => {
        const r = render(panel({ selectedHeroId: null }));
        expect(r.container.querySelector('[data-hero-panel]')).toBeNull();
    });

    it('stops at the hero bar, which is drawn over the side drawers, and holds no hero tabs', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        const aside = r.container.querySelector('[data-hero-panel]');
        expect(aside.style.bottom).toBe(`${DOCK_STRIP_PX}px`);
        expect(aside.className.split(' ')).toContain('top-0');
        expect(r.container.querySelector('[data-hero-column], [data-hero-dock-tab]')).toBeNull();
    });
});

describe('the loadout can grow', () => {
    it('draws one slot per entry of the slot order, three to a row', () => {
        const r = render(panel({ selectedHeroId: 'h1' }));
        expect(r.container.querySelectorAll('[data-equip-slot]').length).toBe(SLOT_ORDER.length);
    });
});
