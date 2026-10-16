// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
    setTutorialAideTarget,
    resolveTutorialTargetElement,
    TUTORIAL_AIDE_EVENTS
} from '../ui/components/base/TutorialAideOverlay.jsx';
import { EventBus } from '../systems/core/EventBus.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * The beacon for each step of the cartographer's chain. The fixture mirrors the attributes the
 * live page carries today (checked against the source by the last test below): the nav orbs'
 * ids, the hero bar's `data-dock-hero`, the Shop rows' `data-shop-item`, the mat's
 * `data-token-art` / `data-token-type`, loot's `data-item-sprite`, and the Atlas screen's tabs and
 * buttons. A step whose thing is not on screen yet points at the orb that gets it.
 */

const SITE = 'fixture_aide_site';
registerTokenTypes({
    [SITE]: {
        id: SITE, name: 'Old Site', landmark: true, tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, size: 1, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 600000, xp: 0, inputs: [], outputs: [] }
    }
});

const NEW_GAME = `
    <nav>
        <button id="guild-bubble-target">Guild Hall</button>
        <button id="bank-bubble-target">Bank</button>
        <button id="shop-bubble-target">Shop</button>
        <button id="atlas-bubble-target">Atlas</button>
    </nav>
    <div data-hero-bar>
        <div data-dock-hero="hero_1" data-dock-deployed="true">Hero Arthur</div>
        <div data-dock-hero="hero_2" data-dock-deployed="false">Hero Tilly</div>
    </div>
    <div id="board-container">
        <div data-token-art="true" data-token-type="token_guild_hall" data-token-id="t1">Guild Hall Token</div>
        <div data-token-art="true" data-token-type="token_oak_forest" data-token-id="t2">Oak Forest Token</div>
        <div data-token-art="true" data-token-type="token_oak_sapling" data-token-id="t3">Oak Sapling Token</div>
        <div data-token-art="true" data-token-type="token_oak_tree" data-token-id="t4">Oak Tree Token</div>
        <div data-token-art="true" data-token-type="token_cow" data-token-id="t5">Cow Token</div>
        <div data-token-art="true" data-token-type="${SITE}" data-token-id="t6">Old Site Token</div>
    </div>
`;

const el = (id) => resolveTutorialTargetElement(id);
const text = (id) => el(id)?.textContent;

describe('the tutorial aide\'s beacons', () => {
    beforeEach(() => { document.body.innerHTML = NEW_GAME; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('publishes hover and unhover events via setTutorialAideTarget', () => {
        const events = [];
        const unsub1 = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.HOVER, (e) => events.push({ type: 'hover', ...e }));
        const unsub2 = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.UNHOVER, (e) => events.push({ type: 'unhover', ...e }));

        setTutorialAideTarget('cart_recruit');
        setTutorialAideTarget(null);
        expect(events).toEqual([{ type: 'hover', questId: 'cart_recruit' }, { type: 'unhover' }]);

        unsub1();
        unsub2();
    });

    it('every step has a beacon on a new game\'s screen', () => {
        for (const { id } of TUTORIAL_QUESTS) {
            expect(el(id), id).not.toBeNull();
        }
    });

    it('points at the right thing for each step', () => {
        expect(el('cart_recruit').id).toBe('guild-bubble-target');
        // The hero bar: a hero not yet on the mat first.
        expect(el('cart_flag').getAttribute('data-dock-hero')).toBe('hero_2');
        // Something a hero can gather, not the sapling or the endgame site.
        expect(text('cart_gather')).toBe('Oak Tree Token');
        // No loot yet: where it will fall.
        expect(text('cart_loot')).toBe('Oak Tree Token');
        expect(el('cart_foundation').id).toBe('shop-bubble-target');
        expect(el('cart_station').id).toBe('shop-bubble-target');
        expect(el('cart_craft').id).toBe('shop-bubble-target');
        expect(text('cart_fight')).toBe('Cow Token');
        expect(text('cart_inspect')).toBe('Old Site Token');
        expect(el('cart_settle').id).toBe('atlas-bubble-target');
        expect(el('cart_travel').id).toBe('atlas-bubble-target');
    });

    it('the flag beacon falls back to any hero, and to the Guild Hall orb with no hero yet', () => {
        document.querySelector('[data-dock-hero="hero_2"]').remove();
        expect(el('cart_flag').getAttribute('data-dock-hero')).toBe('hero_1');
        document.querySelector('[data-hero-bar]').remove();
        expect(el('cart_flag').id).toBe('guild-bubble-target');
    });

    it('prefers the Guild Hall board\'s Bunk Beds once it is open', () => {
        document.body.insertAdjacentHTML('beforeend', `
            <div data-guild-hall-board="true">
                <div id="guild-roster-upgrade-node" data-guild-roster-upgrade="true">Bunk Beds</div>
            </div>
        `);
        expect(el('cart_recruit').id).toBe('guild-roster-upgrade-node');
    });

    it('prefers the dropped loot, then the Shop row, then the Token on the mat, as they appear', () => {
        document.body.insertAdjacentHTML('beforeend', `
            <div data-item-sprite="true">Wood Drop</div>
            <div data-shop-item="token_wood_foundation" data-shop-row="token_wood_foundation">Wood Foundation row</div>
        `);
        expect(text('cart_loot')).toBe('Wood Drop');
        expect(text('cart_foundation')).toBe('Wood Foundation row');
        expect(text('cart_station')).toBe('Wood Foundation row');

        document.getElementById('board-container').insertAdjacentHTML('beforeend', `
            <div data-token-art="true" data-token-type="token_wood_foundation">Wood Foundation Token</div>
        `);
        expect(text('cart_station')).toBe('Wood Foundation Token');
        expect(text('cart_craft')).toBe('Wood Foundation Token');

        document.getElementById('board-container').insertAdjacentHTML('beforeend', `
            <div data-token-art="true" data-token-type="token_workbench">Workbench Token</div>
        `);
        expect(text('cart_craft')).toBe('Workbench Token');
    });

    it('inside the Atlas: the Cartography tab, Settle, then Travel, never a hidden tab\'s button', () => {
        document.body.insertAdjacentHTML('beforeend', `
            <div data-atlas-overlay>
                <button data-atlas-tab="regions">Regions</button>
                <button data-atlas-tab="cartography">Cartography</button>
                <div class="hidden"><ul data-region-list><button data-region-travel>Travel</button></ul></div>
                <div><div data-cartography>
                    <button data-cartography-settle>Settle</button>
                </div></div>
            </div>
        `);
        expect(text('cart_settle')).toBe('Settle');
        // The Regions tab is hidden, so its Travel button is not a target: the Regions tab is.
        expect(el('cart_travel').getAttribute('data-atlas-tab')).toBe('regions');

        document.querySelector('[data-cartography]').insertAdjacentHTML('beforeend', `
            <div data-cartography-settled><button data-settled-travel>Travel there</button></div>
        `);
        expect(text('cart_travel')).toBe('Travel there');
    });

    it('an old chain id resolves to nothing', () => {
        for (const id of ['tut_recruit', 'tut_flag', 'tut_log', 'tutorial_4']) expect(el(id), id).toBeNull();
    });

    it('the fixture\'s attributes are the ones the live page renders', () => {
        const SRC = path.resolve(__dirname, '..');
        const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
        const menu = read('ui/components/nav/BubbleMenu.jsx');
        for (const id of ['guild-bubble-target', 'bank-bubble-target', 'shop-bubble-target', 'atlas-bubble-target']) {
            expect(menu, id).toContain(`id="${id}"`);
        }
        expect(read('ui/components/dock/DockHeroFigure.jsx')).toMatch(/data-dock-hero=\{heroId\}/);
        expect(read('ui/components/dock/DockHeroFigure.jsx')).toMatch(/data-dock-deployed=/);
        expect(read('ui/components/board/MatToken.jsx')).toMatch(/data-token-art="true"[\s\S]*data-token-type=\{typeId\}/);
        expect(read('ui/components/board/SpriteLayerView.jsx')).toContain('data-item-sprite="true"');
        expect(read('ui/components/drawer/ShopDrawer.jsx')).toMatch(/data-shop-item=\{chosen\.typeId\}/);
        expect(read('ui/components/board/GuildHallBoard.jsx')).toContain('data-guild-roster-upgrade=');
        expect(read('ui/components/atlas/AtlasScreen.jsx')).toContain('data-atlas-tab={id}');
        expect(read('ui/components/atlas/AtlasScreen.jsx')).toContain("CARTOGRAPHY: 'cartography'");
        const atlas = read('ui/components/atlas/CartographyTable.jsx') + read('ui/components/atlas/RegionList.jsx');
        for (const attr of ['data-cartography-settle', 'data-settled-travel', 'data-region-travel']) {
            expect(atlas, attr).toContain(attr);
        }
    });
});
