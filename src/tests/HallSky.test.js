// @vitest-environment jsdom
// The Guild Hall's night sky: stars by state, tags, lines, constellations, the drifting
// backdrop, the hover-filled details panel, and a web that cannot be scrolled.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, act } from '@testing-library/react';
import {
    GuildHallBoard, STAR_SPRITES, STAR_SCALE, STAR_ART_PX, finishedConstellations, linkConstellation, starLook
} from '../ui/components/board/GuildHallBoard.jsx';
import { HallSky, SKY_TILE_PX, SKY_STARS_SRC, SKY_CLOUDS_SRC } from '../ui/components/board/HallSky.jsx';
import { selectGuildInspectSelection } from '../ui/guildInspectSelection.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GUILD_UPGRADES, CONSTELLATIONS, HALL_NODE, getUpgradeDef } from '../config/guildUpgrades.js';
import { SKY_SAMPLE_RANKS, SKY_SAMPLE_PAID, devGiveNextPrice } from '../ui/dev/GuildHallDevSection.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const renderWeb = (props = {}) => render(React.createElement(GuildHallBoard, props));
const star = (container, id) => container.querySelector(`[data-hall-node="${id}"] img`);
const src = (rel) => readFileSync(resolve(__dirname, rel), 'utf8');

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
});

describe('the Hall sky: stars by state', () => {
    it('draws each look with its own sprite, sized by state at a whole-pixel scale', () => {
        GameState.state.progress.guildUpgrades = { ...SKY_SAMPLE_RANKS };
        devGiveNextPrice(SKY_SAMPLE_PAID);
        const { container } = renderWeb();
        const states = new Set();
        const looks = new Set();
        for (const def of GUILD_UPGRADES) {
            const button = container.querySelector(`[data-hall-node="${def.id}"]`);
            const state = button.getAttribute('data-node-state');
            const look = button.getAttribute('data-star-look');
            states.add(state);
            looks.add(look);
            const img = star(container, def.id);
            expect(img.getAttribute('src'), def.id).toBe(STAR_SPRITES[look]);
            expect(img.style.width, def.id).toBe(`${STAR_ART_PX * STAR_SCALE[state]}px`);
            expect(Number.isInteger(STAR_SCALE[state])).toBe(true);
            // The upgrade's own sprite is only in the details panel now.
            expect(container.querySelector(`img[src="${def.sprite}"]`)).toBeNull();
        }
        // The QA button's sample shows all four states and all three looks.
        expect([...states].sort()).toEqual(['bought', 'buyable', 'locked', 'maxed']);
        expect([...looks].sort()).toEqual(['blue', 'gold', 'grey']);
        for (const id of SKY_SAMPLE_PAID) {
            expect(container.querySelector(`[data-hall-node="${id}"]`).getAttribute('data-star-look'), id).toBe('blue');
        }
        expect(STAR_SCALE.locked).toBeLessThanOrEqual(STAR_SCALE.buyable);
        expect(STAR_SCALE.buyable).toBeLessThan(STAR_SCALE.bought);
    });

    it('is gold at its top rank, blue while the Bank can pay for the next rank, grey otherwise', async () => {
        expect(starLook('maxed', false)).toBe('gold');
        expect(starLook('bought', true)).toBe('blue');
        expect(starLook('buyable', true)).toBe('blue');
        expect(starLook('bought', false)).toBe('grey');
        expect(starLook('buyable', false)).toBe('grey');
        expect(starLook('locked', false)).toBe('grey');

        // In the web: open but unaffordable is grey; its price in the Bank turns it blue, live.
        GameState.state.progress.guildUpgrades = { bank_slots: 1 };
        const look = (c, id) => c.querySelector(`[data-hall-node="${id}"]`).getAttribute('data-star-look');
        const { container } = renderWeb();
        expect(look(container, 'bank_tabs')).toBe('grey');
        await act(async () => devGiveNextPrice(['bank_tabs']));
        expect(look(container, 'bank_tabs')).toBe('blue');
    });

    it('keeps a locked star grey however rich the Bank', () => {
        GameState.state.progress.guildUpgrades = {};
        devGiveNextPrice(['bank_tabs']);
        const { container } = renderWeb();
        const node = container.querySelector('[data-hall-node="bank_tabs"]');
        expect(node.getAttribute('data-node-state')).toBe('locked');
        expect(node.getAttribute('data-star-look')).toBe('grey');
    });

    it('holds every star steady: no star animates', () => {
        GameState.state.progress.guildUpgrades = { ...SKY_SAMPLE_RANKS };
        devGiveNextPrice(SKY_SAMPLE_PAID);
        const { container } = renderWeb();
        for (const img of container.querySelectorAll('[data-hall-node] img')) {
            expect(img.className).not.toMatch(/twinkle|animate-/);
            expect(img.style.animationDelay).toBe('');
        }
        expect(src('../tailwind.css')).not.toContain('gi-star-twinkle');
    });

    it('tags every star with its name and rank, locked ones included', () => {
        GameState.state.progress.guildUpgrades = { bank_slots: 3 };
        const { container } = renderWeb();
        for (const def of GUILD_UPGRADES) {
            const tag = container.querySelector(`[data-hall-node="${def.id}"]`).parentElement;
            const rank = GameState.state.progress.guildUpgrades[def.id] || 0;
            expect(tag.textContent, def.id).toContain(`${def.name} ${rank}/${def.maxRank}`);
        }
        expect(container.querySelector('[data-hall-node="bank_tabs"]').getAttribute('data-node-state')).toBe('buyable');
    });

    it('sets each tag on the side its upgrade names, below when it names none', () => {
        const { container } = renderWeb();
        for (const def of GUILD_UPGRADES) {
            const tag = container.querySelector(`[data-hall-node="${def.id}"]`).parentElement.querySelector('[data-star-tag]');
            expect(tag.getAttribute('data-star-tag'), def.id).toBe(def.tag || 'below');
        }
    });

    it('makes the Hall a labelled pole star with no Hall sprite', () => {
        const { container } = renderWeb();
        const hall = container.querySelector(`[data-hall-node="${HALL_NODE}"]`);
        expect(hall.querySelector('img').getAttribute('src')).toBe(STAR_SPRITES.gold);
        expect(hall.parentElement.textContent).toContain('Guild Hall');
        expect(container.querySelector('img[src*="t_guildhall"]')).toBeNull();
    });

    it('outlines a star only under the pointer or keyboard focus, never at rest', () => {
        InventoryManager.addItem('item_oak_wood', 10);
        const { container } = renderWeb({ selectedUpgradeId: 'bank_slots' });
        // An affordable, pinned star at rest: blue, with no outline class or bouncing badge.
        const node = container.querySelector('[data-hall-node="bank_slots"]');
        expect(node.getAttribute('data-star-look')).toBe('blue');
        expect(node.querySelector('img').style.filter).toBe('');
        expect(container.querySelector('.animate-bounce')).toBeNull();

        // jsdom cannot apply :hover, so the stylesheet is the proof: every rule that outlines a
        // star's sprite names :hover or :focus-visible in every one of its selectors.
        const css = src('../tailwind.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
            .filter(([, sel, body]) => sel.includes('.gi-star-img') && /filter\s*:/.test(body));
        expect(rules.length).toBeGreaterThan(0);
        for (const [, sel] of rules) {
            for (const one of sel.split(',').map(x => x.trim()).filter(Boolean)) {
                expect(one, 'a star outline at rest').toMatch(/:hover|:focus-visible/);
            }
        }
        // The hover outline is the kit's: white, one of the star's art pixels wide.
        const hover = rules.find(([, sel]) => sel.includes('.gi-star-btn:hover .gi-star-img'));
        expect(hover[2]).toContain('drop-shadow(var(--star-px) 0 0 #fff)');
    });
});

describe('the Hall sky: constellations', () => {
    it('puts every upgrade in one of the named constellations', () => {
        const ids = new Set(CONSTELLATIONS.map(c => c.id));
        for (const def of GUILD_UPGRADES) expect(ids.has(def.constellation), def.id).toBe(true);
        expect(CONSTELLATIONS.map(c => c.name)).toEqual(['The Hearth', 'The Vault', 'The Compass', 'The Well']);
    });

    it('finishes a constellation when every star in it is lit', () => {
        expect(finishedConstellations({})).toEqual([]);
        expect(finishedConstellations({ roster_size: 1 })).toEqual(['hearth']);
        expect(finishedConstellations({ bank_slots: 1 })).toEqual([]);
        expect(finishedConstellations({ bank_slots: 1, bank_tabs: 2 })).toEqual(['vault']);
    });

    it('counts a line to the Hall or within a constellation as its picture, not one between two', () => {
        expect(linkConstellation('bank_slots', HALL_NODE)).toBe('vault');
        expect(linkConstellation('bank_tabs', 'bank_slots')).toBe('vault');
        expect(linkConstellation('flag_radius', 'roster_size')).toBeNull();
    });

    it('brightens a finished constellation\'s name; the rest stay faint', () => {
        GameState.state.progress.guildUpgrades = { roster_size: 1 };
        const { container } = renderWeb();
        expect(container.querySelector('[data-constellation="hearth"]').getAttribute('data-constellation-finished')).toBe('true');
        expect(container.querySelector('[data-constellation="vault"]').getAttribute('data-constellation-finished')).toBe('false');
    });

    it('flashes a constellation finished while the screen is open, not one finished before', async () => {
        GameState.state.progress.guildUpgrades = { roster_size: 1, bank_slots: 1 };
        const { container } = renderWeb();
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();

        await act(async () => {
            GameState.state.progress.guildUpgrades.bank_tabs = 1;
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'bank_tabs', rank: 1 });
        });
        const glow = container.querySelector('[data-constellation-glow]');
        expect(glow?.getAttribute('data-constellation-glow')).toBe('vault');
        // Its picture is the Vault's two lines.
        expect(glow.querySelectorAll('line')).toHaveLength(2);

        fireEvent.animationEnd(glow);
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();
    });
});

describe('the Hall sky: the details panel follows the pointer', () => {
    it('reports the hovered star, and nothing once the pointer leaves', () => {
        const onHoverUpgrade = vi.fn();
        const { container } = renderWeb({ onHoverUpgrade });
        const node = container.querySelector('[data-hall-node="notice_board"]');
        fireEvent.mouseEnter(node);
        expect(onHoverUpgrade).toHaveBeenLastCalledWith('notice_board');
        fireEvent.mouseLeave(node);
        expect(onHoverUpgrade).toHaveBeenLastCalledWith(null);
    });

    it('shows the hovered star over the pinned one, and the pinned one again after', () => {
        const pinned = { type: 'guild_upgrade', id: 'bank_slots', pane: 'guild' };
        const hovered = selectGuildInspectSelection({
            hoveredUpgradeId: 'token_cap', guildPaneSelection: pinned, getUpgradeDefFn: getUpgradeDef
        });
        expect(hovered.id).toBe('token_cap');
        expect(selectGuildInspectSelection({
            hoveredUpgradeId: null, guildPaneSelection: pinned, getUpgradeDefFn: getUpgradeDef
        })).toBe(pinned);
    });

    it('docks the details panel right of the web whichever side the nav is on', () => {
        const root = src('../ui/ReactRoot.jsx');
        const details = [...root.matchAll(/data-hall-details/g)];
        expect(details).toHaveLength(1);
        expect(details[0].index).toBeGreaterThan(root.indexOf('<GuildHallBoard'));
        expect(root).toContain('selection={guildShownSelection}');
    });
});

describe('the Hall sky: the drifting backdrop', () => {
    it('draws the star field and the cloud layer, both tiled at 2×, clouds at a quarter opacity', () => {
        const { container } = render(React.createElement(HallSky));
        const stars = container.querySelector('[data-hall-sky-layer="stars"]');
        const clouds = container.querySelector('[data-hall-sky-layer="clouds"]');
        expect(SKY_TILE_PX).toBe(1024);
        expect(stars.style.backgroundImage).toContain(SKY_STARS_SRC);
        expect(clouds.style.backgroundImage).toContain(SKY_CLOUDS_SRC);
        for (const layer of [stars, clouds]) {
            expect(layer.style.backgroundSize).toBe('1024px');
            expect(layer.style.imageRendering).toBe('pixelated');
        }
        expect(clouds.style.opacity).toBe('0.25');
        expect(stars.className).toContain('gi-sky-drift-stars');
        expect(clouds.className).toContain('gi-sky-drift-clouds');
    });

    it('glides linearly, the clouds twice as fast on another heading, by transform only', () => {
        const css = src('../tailwind.css');
        const rule = (name) => css.match(new RegExp(`\\.${name}\\s*\\{[^}]*animation:\\s*${name}\\s+(\\d+)s\\s+var\\(--gi-sky-ease\\)\\s+infinite`));
        const frames = (name) => css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`))[1];
        const s = rule('gi-sky-drift-stars');
        const c = rule('gi-sky-drift-clouds');
        // Both layers take their glide from one switch, set to linear.
        expect(css).toMatch(/\[data-hall-sky\]\s*\{\s*--gi-sky-ease:\s*linear;\s*\}/);
        expect(Number(s[1])).toBe(600);   // a tile in ten minutes
        expect(Number(c[1])).toBe(300);   // and in five
        expect(frames('gi-sky-drift-stars')).toContain('translate3d(-1024px, 0, 0)');
        expect(frames('gi-sky-drift-clouds')).toContain('translate3d(1024px, 1024px, 0)');
        for (const name of ['gi-sky-drift-stars', 'gi-sky-drift-clouds']) {
            expect(frames(name)).not.toMatch(/background|left|top|width|height/);
        }
        // And stops under reduce motion.
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.gi-sky-drift-stars,\s*\.gi-sky-drift-clouds\s*\{\s*animation: none;/);
    });

    it('shows no item stubs or banners over it', () => {
        const root = src('../ui/ReactRoot.jsx');
        expect([...root.matchAll(/<ItemStubColumn\b/g)]).toHaveLength(1);
        expect([...root.matchAll(/<BannerStack\b/g)]).toHaveLength(1);
        expect(root).toMatch(/\{!isGuildView && \(\s*<ErrorBoundary label="Notifications">\s*<ItemStubColumn \/>\s*<BannerStack \/>\s*<\/ErrorBoundary>\s*\)\}/);
    });

    it('exists only while the Hall screen is open', () => {
        const root = src('../ui/ReactRoot.jsx');
        expect([...root.matchAll(/<HallSky\b/g)]).toHaveLength(1);
        expect(root).toContain('{isGuildView && <HallSky />}');
    });
});

describe('⭐ the upgrade web cannot be scrolled (T-128)', () => {
    it('clips with overflow: clip, never a hidden box (a scroll container focus can scroll)', () => {
        const { container } = renderWeb();
        const web = container.querySelector('[data-guild-hall-board]');
        let el = web;
        let clipper = null;
        while (el && el !== container) {
            const classes = el.className.split?.(/\s+/) || [];
            expect(classes, 'a box around the web hides its overflow').not.toContain('overflow-hidden');
            if (classes.includes('overflow-clip')) clipper = el;
            el = el.parentElement;
        }
        expect(clipper).toBeTruthy();
    });
});
