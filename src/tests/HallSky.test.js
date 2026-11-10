// @vitest-environment jsdom
// The Guild Hall's night sky: stars by state, tags, lines, constellations, the drifting
// backdrop, a click (never a hover) choosing a star, and a web that cannot be scrolled.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, act } from '@testing-library/react';
import {
    GuildHallBoard, STAR_SPRITES, STAR_SCALE, STAR_ART_PX, finishedConstellations, linkConstellation, starLook
} from '../ui/components/board/GuildHallBoard.jsx';
import { HallSky, SKY_TILE_PX, SKY_STARS_SRC, SKY_CLOUDS_SRC } from '../ui/components/board/HallSky.jsx';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import {
    GUILD_UPGRADES, CONSTELLATIONS, BUILT_IN_CONSTELLATIONS, HALL_NODE, UPGRADE_SPRITES, getUpgradeDef
} from '../config/guildUpgrades.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import { SKY_SAMPLE_RANKS, SKY_SAMPLE_PAID, devGiveNextPrice } from '../ui/dev/GuildHallDevSection.jsx';
import { hallCameraSides } from './fixtures/hallCameraSides.js';
import { withOuterUpgrade, OUTER_UPGRADE_ID as OUTER } from './fixtures/outerUpgrade.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const renderWeb = (props = {}) => render(React.createElement(GuildHallBoard, props));
const star = (container, id) => container.querySelector(`[data-hall-node="${id}"] img`);
const src = (rel) => readFileSync(resolve(__dirname, rel), 'utf8');

withOuterUpgrade();

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
            // The upgrade's own sprite is only in the details panel now. An authored star without
            // one stands in with the gold star, which is also the web's gold look.
            if (def.sprite !== UPGRADE_SPRITES.star) {
                expect(container.querySelector(`img[src="${def.sprite}"]`), def.id).toBeNull();
            }
        }
        // The QA button's sample, on the shipped sky, shows all three looks and every state.
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
        GameState.state.progress.guildUpgrades = { bank_tabs: 1 };
        const look = (c, id) => c.querySelector(`[data-hall-node="${id}"]`).getAttribute('data-star-look');
        const { container } = renderWeb();
        expect(look(container, 'bank_tabs')).toBe('grey');
        await act(async () => devGiveNextPrice(['bank_tabs']));
        expect(look(container, 'bank_tabs')).toBe('blue');
    });

    it('keeps a locked star grey however rich the Bank', () => {
        GameState.state.progress.guildUpgrades = {};
        devGiveNextPrice([OUTER]);
        const { container } = renderWeb();
        const node = container.querySelector(`[data-hall-node="${OUTER}"]`);
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
        GameState.state.progress.guildUpgrades = { bank_tabs: 3 };
        const { container } = renderWeb();
        for (const def of GUILD_UPGRADES) {
            const tag = container.querySelector(`[data-hall-node="${def.id}"]`).parentElement;
            const rank = GameState.state.progress.guildUpgrades[def.id] || 0;
            expect(tag.textContent, def.id).toContain(`${def.name} ${rank}/${def.maxRank}`);
        }
        expect(container.querySelector(`[data-hall-node="${OUTER}"]`).getAttribute('data-node-state')).toBe('buyable');
    });

    it('sets every title under its star, whatever side the star names', () => {
        const { container } = renderWeb();
        for (const def of GUILD_UPGRADES) {
            const node = container.querySelector(`[data-hall-node="${def.id}"]`);
            const tag = node.parentElement.querySelector('[data-star-tag]');
            expect(tag.getAttribute('data-star-tag'), def.id).toBe('below');
            const box = parseFloat(node.style.width);
            expect(parseFloat(tag.style.top), def.id).toBeGreaterThan(box / 2);
            expect(tag.style.bottom, def.id).toBe('');
        }
    });

    it('shows a star\'s rank only under the pointer or keyboard focus', () => {
        // jsdom cannot apply :hover, so the stylesheet is the proof: the rank is hidden at rest, and
        // the one rule that shows it names :hover and :focus-visible on the star.
        const css = src('../tailwind.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => sel.includes('.gi-star-rank'));
        const rest = rules.find(([, sel]) => sel.trim() === '.gi-star-rank');
        expect(rest[2]).toMatch(/display:\s*none/);
        const shown = rules.filter(([, , body]) => /display:\s*inline/.test(body));
        expect(shown).toHaveLength(1);
        expect(shown[0][1]).toMatch(/\.gi-star-btn:is\(:hover, :focus-visible\) \+ \[data-star-tag\] \.gi-star-rank/);
        const { container } = renderWeb();
        for (const rank of container.querySelectorAll('[data-node-rank]')) expect(rank.classList.contains('gi-star-rank')).toBe(true);
    });

    it('draws an item\'s outline over every star of a kind with a pick, and none on the Hall', () => {
        const { container } = renderWeb();
        expect(container.querySelector('[data-hall-node="roster_size"] [data-star-outline]').getAttribute('data-star-outline')).toContain('t_bunk_bed');
        expect(container.querySelector('[data-hall-node="wishing_well"] [data-star-outline]').getAttribute('data-star-outline')).toContain('i_water');
        expect(container.querySelector(`[data-hall-node="${HALL_NODE}"] [data-star-outline]`)).toBeNull();
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
        const { container } = renderWeb({ selectedUpgradeId: 'bank_tabs' });
        // An affordable, pinned star at rest: blue, with no outline class or bouncing badge.
        const node = container.querySelector('[data-hall-node="bank_tabs"]');
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

describe('the Hall sky: the shipped constellations', () => {
    it('puts every upgrade in one of the named constellations', () => {
        const ids = new Set(CONSTELLATIONS.map(c => c.id));
        for (const def of GUILD_UPGRADES) expect(ids.has(def.constellation), def.id).toBe(true);
        expect(CONSTELLATIONS.map(c => c.name)).toEqual([
            'The Hearth', 'The Vault', 'The Well',
            ...Object.values(authoredHallSky().constellations).map(c => c.name)
        ]);
        expect(CONSTELLATIONS.slice(0, 3)).toEqual(BUILT_IN_CONSTELLATIONS);
    });
});

describe('the Hall sky: constellations', () => {
    // The built-in tracks alone: the shipped sky's stars join the Hearth and the Well.
    beforeEach(() => registerHallSky({}));
    afterEach(() => registerHallSky(null));

    it('finishes a constellation when every star in it is lit', () => {
        expect(finishedConstellations({})).toEqual([]);
        expect(finishedConstellations({ roster_size: 1 })).toEqual(['hearth']);
        expect(finishedConstellations({ bank_tabs: 1 })).toEqual([]);
        expect(finishedConstellations({ bank_tabs: 1, [OUTER]: 2 })).toEqual(['vault']);
    });

    it('counts a line to the Hall or within a constellation as its picture, not one between two', () => {
        expect(linkConstellation('bank_tabs', HALL_NODE)).toBe('vault');
        expect(linkConstellation(OUTER, 'bank_tabs')).toBe('vault');
        // A line between two constellations (none is drawn since Scouting Flags retired, brief 260 O2).
        expect(linkConstellation('bank_tabs', 'roster_size')).toBeNull();
    });

    it('brightens a finished constellation\'s name; the rest stay faint', () => {
        GameState.state.progress.guildUpgrades = { roster_size: 1 };
        const { container } = renderWeb();
        expect(container.querySelector('[data-constellation="hearth"]').getAttribute('data-constellation-finished')).toBe('true');
        expect(container.querySelector('[data-constellation="vault"]').getAttribute('data-constellation-finished')).toBe('false');
    });

    it('flashes a constellation finished while the screen is open, not one finished before', async () => {
        GameState.state.progress.guildUpgrades = { roster_size: 1, bank_tabs: 1 };
        const { container } = renderWeb();
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();

        await act(async () => {
            GameState.state.progress.guildUpgrades[OUTER] = 1;
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: OUTER, rank: 1 });
        });
        const glow = container.querySelector('[data-constellation-glow]');
        expect(glow?.getAttribute('data-constellation-glow')).toBe('vault');
        // Its picture is the Vault's two lines.
        expect(glow.querySelectorAll('line')).toHaveLength(2);

        fireEvent.animationEnd(glow);
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();
    });
});

describe('the Hall sky: a click chooses a star, a hover does not', () => {
    it('reports a clicked star, and nothing for a star under the pointer', () => {
        const onSelectUpgrade = vi.fn();
        const { container } = renderWeb({ onSelectUpgrade });
        const node = container.querySelector('[data-hall-node="wishing_well"]');
        fireEvent.mouseEnter(node);
        fireEvent.focus(node);
        expect(onSelectUpgrade).not.toHaveBeenCalled();
        fireEvent.click(node);
        expect(onSelectUpgrade).toHaveBeenCalledWith(getUpgradeDef('wishing_well'));
    });

    it('opens the Hall with its drawer closed, and no Return button', () => {
        const root = src('../ui/ReactRoot.jsx');
        expect(root).toContain('const [hallStarId, setHallStarId] = React.useState(null);');
        expect(root).not.toMatch(/onHoverUpgrade|hoveredUpgradeId|returnToPlaymat|data-hall-return/);
        expect(src('../i18n/en.json')).not.toContain('returnToPlaymat');
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

    // On the table side of the camera, which is gone while the camera rests on the sky
    // (HallCamera.test.js); mid-glide they go down with the mat.
    it('shows no item stubs or banners over it', () => {
        const { code, mat } = hallCameraSides();
        expect([...code.matchAll(/<ItemStubColumn\b/g)]).toHaveLength(1);
        expect([...code.matchAll(/<BannerStack\b/g)]).toHaveLength(1);
        expect(mat).toMatch(/<ErrorBoundary label="Notifications">\s*<ItemStubColumn \/>\s*<BannerStack \/>\s*<\/ErrorBoundary>/);
    });

    // The camera lays the sky only while it is off the mat (HallCamera.test.js).
    it('exists only while the Hall screen is open', () => {
        const { code } = hallCameraSides();
        expect([...code.matchAll(/<HallSky\b/g)]).toHaveLength(1);
        expect(code).toContain('sky={<HallSky />}');
    });
});

describe('⭐ the upgrade web cannot be scrolled (T-128)', () => {
    it('never sits in a hidden box (a scroll container focus can scroll); the screen clips it', () => {
        const { container } = renderWeb();
        const web = container.querySelector('[data-guild-hall-board]');
        let el = web;
        while (el && el !== container) {
            const classes = el.className.split?.(/\s+/) || [];
            expect(classes, 'a box around the web hides its overflow').not.toContain('overflow-hidden');
            // The web runs on under the nav and the details panel: nothing of the screen's own clips it.
            expect(classes, 'a box around the web clips it short of the screen').not.toContain('overflow-clip');
            el = el.parentElement;
        }
        // The clip is the screen's (`ReactRoot`'s table, an `overflow-clip` box): HallCamera.test.js.
    });
});
