// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import './fixtures/fixtureItems.js';

vi.mock('../config/registries/recipePoolRegistry.js', async (importOriginal) => ({
    ...(await importOriginal()),
    listRecipes: () => [
        { id: 'r_bar', name: 'Copper Bar', skill: 'smithing', levelRequirement: 2, outputs: [{ itemId: 'item_copper_bar' }] },
        { id: 'r_pin', name: 'Copper Pin', skill: 'smithing', levelRequirement: 3, outputs: [{ itemId: 'item_pin' }] },
        { id: 'r_pie', name: 'Apple Pie', skill: 'cooking', levelRequirement: 3, outputs: [{ itemId: 'item_pie' }] },
        { id: 'r_stew', name: 'Stew', skill: 'cooking', levelRequirement: 9, outputs: [{ itemId: 'item_stew' }] }
    ]
}));
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => false),
    undoLast: vi.fn(() => false),
    forgetUndo: vi.fn()
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { HeroManager } from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { HERO_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { levelFromXp } from '../utils/XPCurve.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { floatsOf, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import { bubblesOf, clearAllHeroBubbles } from '../ui/components/dock/heroBarBubbles.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

/**
 * XP for Everyone's level-ups show as ordinary level-ups do (owner, 2026-11-12: the existing
 * level-up animations are enough): a purchase shows exactly what the same XP earned working shows,
 * each skill that rose with its own float and hero-bar alert and the usual recipe banners, and no
 * float or alert of its own. The level-up sound plays once for the purchase. A recruit arriving with
 * the gift is not a level-up.
 */

const h = React.createElement;
const ORE = 'fixture_copper_ore';
const OAK = 'item_oak_wood';
/** 250 XP takes a fresh skill from level 1 to 3: two level events a skill. */
const GIFT = 250;
const REACHED = levelFromXp(GIFT);

const giftRule = { id: 'stm_xfe_announce', keyword: KEYWORD.PROVIDES,
    payload: { type: EFFECT_TYPES.XP_FOR_EVERYONE, bucket: 'flat', value: GIFT },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null };
const SKY = {
    constellations: { hearth_x: { id: 'hearth_x', name: 'Hearth X', label: { x: 0, y: -1 } } },
    stars: {
        xp_all: { id: 'xp_all', constellation: 'hearth_x', name: 'Fresh Recruits', node: { x: 0, y: -0.7 }, links: [HALL_NODE],
            ranks: [{ tier: 1, price: [{ itemId: ORE, quantity: 5 }], rules: [giftRule], lines: [] }] }
    }
};

/** A guild of `n` fresh heroes (every skill at level 1, no XP), nothing shown yet. */
function fresh(n = 3) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 200;
    registerHallSky(SKY);
    GameState.state.progress.guildUpgrades.roster_size = n;
    GuildUpgradeManager.recompute();
    for (let i = 0; i < n; i++) expect(HeroManager.addHero(generateHero({ name: `Hero ${i + 1}` }))).toBeTruthy();
    InventoryManager.addItem(ORE, 1000);
    InventoryManager.addItem(OAK, 1000);
    clearAllFloats();
    clearAllHeroBubbles();
    Banners.reset();
}

const layerHeroes = () => GameState.heroes.map((hero, i) => ({
    heroId: hero.id, state: 'working', x: 300 + 200 * i, y: 500, moving: false, tokenId: null, alert: null
}));
const floatsIn = (c, heroId) => [...c.querySelectorAll(`[data-hero-bubble-stack="${heroId}"] [data-level-float]`)];

/** What the player is shown, hero by hero in roster order (ids differ between guilds). */
function shown() {
    return {
        floats: GameState.heroes.map(hero => floatsOf(hero.id, Date.now()).map(f => [f.key, f.from, f.to])),
        alerts: GameState.heroes.map(hero => bubblesOf(hero.id).map(b => b.text)),
        // The purchase's own banner (the star bought) aside.
        banners: Banners.getAll().filter(b => b.kind !== 'upgrade').map(b => ({
            kind: b.kind, heroes: b.parts.heroes, recipes: b.parts.recipes,
            subjects: (b.subjects || []).map(s => GameState.heroes.findIndex(hero => hero.id === s.id))
        }))
    };
}

/** The same XP earned working: every skill of every hero, hero by hero, through the ordinary award. */
function earnTheSameWorking() {
    for (const hero of GameState.heroes) {
        for (const skillId of Object.keys(hero.skills)) expect(addXP(hero.id, skillId, GIFT).success).toBe(true);
    }
}

let play;
beforeAll(() => {
    GuildUpgradeManager.init();
    play = vi.spyOn(AudioSystem, 'playSfx').mockImplementation(() => {});
    vi.spyOn(AudioSystem, 'playNextTrack').mockImplementation(() => {});
    AudioSystem.init();
});
beforeEach(() => {
    vi.useFakeTimers();
    fresh();
    wireNotifications();
    play.mockClear();
});
afterEach(() => {
    unwireNotifications();
    Banners.reset();
    cleanup();
    vi.useRealTimers();
    registerHallSky(null);
    HallRules.apply({});
});
afterAll(() => {
    HallRules.teardown();
    vi.restoreAllMocks();
});

const levelUpSounds = () => play.mock.calls.filter(([clip]) => clip === 'levelup').length;

describe('a purchase shows what the same XP earned working shows', () => {
    it('the same floats, hero-bar alerts and recipe banners, hero by hero', () => {
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        const byGift = shown();

        fresh();
        act(() => earnTheSameWorking());
        const byWork = shown();

        expect(byGift.banners.length).toBeGreaterThan(0);
        expect(byGift).toEqual(byWork);
    });

    it('a float a skill that rose over each hero, rolling from the old level to the new', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes: layerHeroes() }));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        for (const hero of GameState.heroes) {
            const floats = floatsIn(container, hero.id);
            expect(floats.map(f => f.getAttribute('data-level-float')).sort()).toEqual([...HERO_SKILL_IDS].sort());
            expect(floatsOf(hero.id, Date.now()).every(f => f.from === 1 && f.to === REACHED)).toBe(true);
            expect(floats.every(f => f.querySelector('img').getAttribute('src') !== '/assets/ui/u_upgrade.png')).toBe(true);
        }
    });

    it('an alert a skill on the hero bar, worded as any level-up, never a levels-in-all alert', () => {
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        for (const hero of GameState.heroes) {
            const texts = bubblesOf(hero.id).map(b => b.text);
            expect(texts).toHaveLength(HERO_SKILL_IDS.length);
            expect(texts).toContain(`${REACHED} Mining!`);
            expect(texts.some(t => /levels?!/.test(t))).toBe(false);
        }
    });

    it('the usual recipe banner: the first hero to reach a recipe\'s level unlocks it for the guild', () => {
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        const recipes = Banners.getAll().filter(b => b.kind === 'recipe');
        expect(recipes.flatMap(b => b.parts.recipes).sort()).toEqual(['Apple Pie', 'Copper Bar', 'Copper Pin']);
        // Each hero's level-ups are said before the next hero is given theirs, so the first hero
        // reaches level 3 first and the others find it already reached.
        const first = GameState.heroes[0];
        expect(recipes.flatMap(b => b.parts.heroes)).toEqual(recipes.map(() => first.name));
        expect(recipes.flatMap(b => b.subjects.map(s => s.id))).toEqual(recipes.map(() => first.id));
    });
});

describe('one level-up sound for the purchase', () => {
    it('plays once for a purchase that raised anyone, where the same XP earned working plays once a level', () => {
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        expect(levelUpSounds()).toBe(1);

        fresh();
        play.mockClear();
        act(() => earnTheSameWorking());
        expect(levelUpSounds()).toBe(GameState.heroes.length * HERO_SKILL_IDS.length * (REACHED - 1));
    });

    it('plays none when nobody rose', () => {
        fresh(0);
        play.mockClear();
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        expect(levelUpSounds()).toBe(0);
    });
});

describe('a recruit arriving with the gift is not a level-up', () => {
    it('no float, alert, recipe banner or level-up sound for them: only their own banner', () => {
        fresh(1);
        act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        clearAllFloats();
        clearAllHeroBubbles();
        Banners.reset();
        play.mockClear();

        act(() => { expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true); });
        const recruit = GameState.heroes[GameState.heroes.length - 1];
        expect(recruit.skills.mining.level).toBe(REACHED);
        expect(floatsOf(recruit.id, Date.now())).toEqual([]);
        expect(bubblesOf(recruit.id)).toEqual([]);
        expect(Banners.getAll().map(b => b.kind)).toEqual(['hero']);
        expect(levelUpSounds()).toBe(0);
    });
});

describe('no float or alert of its own', () => {
    it('the hero bar has no levels-in-all wording', async () => {
        const en = (await import('../i18n/en.json')).default;
        expect(en.heroBar.giftLevels).toBeUndefined();
    });

    it('no event of its own: a gift\'s level-ups are HERO_LEVELED, nothing else', () => {
        expect(Object.values(ENGINE_EVENTS)).not.toContain('xp_for_everyone_given');
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, (d) => heard.push(d));
        try {
            act(() => { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); });
        } finally { off(); }
        expect(heard).toHaveLength(GameState.heroes.length * HERO_SKILL_IDS.length * (REACHED - 1));
    });
});
