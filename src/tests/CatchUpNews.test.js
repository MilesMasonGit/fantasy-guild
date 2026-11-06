// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import * as Banners from '../systems/notifications/banners.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { getAllItems } from '../config/registries/itemRegistry.js';
import { othersBestLevel } from '../systems/notifications/recipeUnlocks.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { buildRealistic } from '../../bench/scenarios/realistic.mjs';

/**
 * After time away nothing goes missing (brief 430 N1): the catch-up hears the news its quiet bus
 * keeps from the banners and stubs, and hands it over once the summary closes; collecting it
 * changes nothing the game does.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Seeded streams, rewound for each board, counting the draws (as the bench's prelude does). */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const motion = { state: 7 };
function motionRandom() {
    motion.state = (motion.state + 0x6D2B79F5) | 0;
    let t = motion.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

const run = (opts) => CatchUp.run({ yieldFn: () => Promise.resolve(), ...opts });

/** The bench's realistic board (S2), the streams rewound. */
function buildBoard() {
    stream.state = 41;
    stream.draws = 0;
    motion.state = 7;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    buildRealistic({ fixtures, setMatTuning });
    TileModifiers.rebuildAll();
    for (let i = 0; i < 100; i++) GameLoop.runHandlers(100);
    // The heroes joining said so live: only the time away's own news is looked for.
    Banners.reset();
    ItemStubs.reset();
}

/** A recipe some hero can reach that nobody in the guild can run yet: `{ hero, skillId, level }`. */
function recipeToUnlock() {
    for (const hero of GameState.heroes) {
        for (const [skillId, skill] of Object.entries(hero.skills || {})) {
            const floor = Math.max(skill.level, othersBestLevel(GameState.heroes, hero.id, skillId));
            const r = listRecipes().find(x => x.skill === skillId && typeof x.levelRequirement === 'number'
                && x.levelRequirement > floor && x.levelRequirement <= floor + 3);
            if (r) return { hero, skillId, level: r.levelRequirement };
        }
    }
    return null;
}

/** An item no one has found yet. */
function unfoundItem() {
    const found = GameState.state.collection.discoveredItems;
    return Object.values(getAllItems()).find(i => i?.id && !found[i.id] && i.stackable !== false)?.id;
}

/**
 * Real news half-way through the time away, through the game's own paths: a level-up that
 * unlocks recipes, a first find, and a knock-out.
 */
function newsHalfWay() {
    const unlock = recipeToUnlock();
    const find = unfoundItem();
    const victim = GameState.heroes[3];
    expect(unlock).not.toBeNull();
    expect(find).toBeTruthy();
    let step = 0;
    GameLoop.onTick('test_news', () => {
        step++;
        if (step === 600) {
            const skill = unlock.hero.skills[unlock.skillId];
            SkillSystem.addXP(unlock.hero.id, unlock.skillId, xpForLevel(unlock.level) - skill.xp);
            InventoryManager.addItem(find, 3);
        }
        if (step === 900) BoardCombat.resolveStatusDefeat(victim.id);
    }, 1);
    return { unlock, find, victim };
}

/** What the game is, by place and amount (instance ids differ from run to run). */
function fingerprint() {
    const s = GameState.state;
    return {
        time: s.time.gameTimeMs,
        heroes: s.heroes.map(h => ({
            skills: Object.fromEntries(Object.entries(h.skills || {}).map(([k, v]) => [k, [v.level, v.xp]])),
            hp: h.stats?.hp ?? h.hp ?? null,
            status: h.status ?? null,
            x: Math.round(h.x ?? 0), y: Math.round(h.y ?? 0)
        })),
        bank: Object.fromEntries(Object.entries(s.inventory.items).map(([k, v]) => [k, v.quantity])),
        found: Object.keys(s.collection.discoveredItems).sort(),
        tokens: BoardState.tokens().map(t => `${t.typeId}@${Math.round(t.x)},${Math.round(t.y)}:${t.usesRemaining ?? '-'}`).sort(),
        floor: SpriteLayer.getSprites().map(sp => `${sp.refId}:${sp.quantity}`).sort(),
        draws: stream.draws
    };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
    Math.random = seeded;
    HeroMotion.setRandomForTests(motionRandom);
});

beforeEach(() => {
    localStorage.clear();
    Banners.reset();
    ItemStubs.reset();
});

afterEach(() => {
    GameLoop.offTick('test_news');
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
    Banners.reset();
    ItemStubs.reset();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the catch-up hears the news its quiet bus keeps from the banners', () => {
    it('recipes unlocked, a first find and a knock-out: in the summary, and only after it closes on screen', async () => {
        buildBoard();
        const { unlock, find, victim } = newsHalfWay();
        const r = await run({ savedAt: NOW - 20 * MIN, now: NOW, save: false });
        expect(r.show).toBe(true);
        const { news } = r.summary;

        expect(news.recipes).toHaveLength(1);
        expect(news.recipes[0]).toMatchObject({ heroId: unlock.hero.id, heroName: unlock.hero.name, skillId: unlock.skillId });
        expect(news.recipes[0].recipes.length).toBeGreaterThan(0);
        expect(news.finds).toContainEqual({ itemId: find, count: 3 });
        expect(news.knockouts).toContainEqual(expect.objectContaining({ heroId: victim.id, heroName: victim.name, times: 1 }));

        // Nothing while the summary is up: not one banner or stub from the time away.
        expect(Banners.getAll()).toEqual([]);
        expect(ItemStubs.getStub(find)).toBeNull();

        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
        const kinds = Banners.getAll().map(b => b.kind);
        expect(kinds).toContain('recipe');
        expect(kinds).toContain('knockout');
        expect(Banners.getAll().filter(b => b.kind === 'recipe')).toHaveLength(1);
        expect(ItemStubs.getStub(find)).toMatchObject({ isNew: true });
    }, 60_000);

    it('a short gap with no summary hands it over at once', async () => {
        buildBoard();
        const { find } = newsHalfWay();
        // Under the two minutes that bring up the summary, in short steps so the news falls inside it.
        const r = await run({ savedAt: NOW - 100_000, now: NOW, save: false, stepMs: 100 });
        expect(r.show).toBe(false);
        expect(Banners.getAll().map(b => b.kind)).toContain('recipe');
        expect(ItemStubs.getStub(find)).toMatchObject({ isNew: true });
    }, 60_000);

    it('a full Bank refusing an item is heard', async () => {
        buildBoard();
        GameLoop.onTick('test_news', () => {
            EventBus.publish(ENGINE_EVENTS.INVENTORY_OVERFLOW, { itemId: 'item_oak_wood', amount: 2 });
            GameLoop.offTick('test_news');
        }, 1);
        const r = await run({ savedAt: NOW - 5 * MIN, now: NOW, save: false });
        expect(r.summary.news.bankFull).toEqual(['item_oak_wood']);
    }, 60_000);

    it('"Load as I left it" shows none of it', async () => {
        buildBoard();
        newsHalfWay();
        SaveManager.currentSlot = 0;
        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            await run({ savedAt: NOW - 20 * MIN, now: NOW });
            expect(CatchUp.canUndo()).toBe(true);
            expect(CatchUp.undoLast()).toBe(true);
            expect(restore).toHaveBeenCalled();
            // The page reloads into the old save: the summary never closed, so nothing was raised.
            expect(Banners.getAll()).toEqual([]);
            expect(ItemStubs.getStubs()).toEqual([]);
        } finally {
            restore.mockRestore();
        }
    }, 60_000);
});

describe('hearing the news changes nothing the game does', () => {
    it('the same time away plays the same with it and without it: same state, same random draws', async () => {
        const play = async (news) => {
            buildBoard();
            newsHalfWay();
            const r = await run({ savedAt: NOW - 30 * MIN, now: NOW, save: false, news });
            GameLoop.offTick('test_news');
            return { r, game: fingerprint() };
        };
        const withNews = await play(true);
        const without = await play(false);

        // There really was news to hear.
        expect(withNews.r.summary.news.recipes.length).toBeGreaterThan(0);
        expect(withNews.r.summary.news.finds.length).toBeGreaterThan(0);
        expect(withNews.r.summary.news.knockouts.length).toBeGreaterThan(0);
        expect(without.r.summary.news).toBeNull();

        expect(withNews.game.draws).toBeGreaterThan(0);
        expect(withNews.game).toEqual(without.game);
        const { news: _a, ...restWith } = withNews.r.summary;
        const { news: _b, ...restWithout } = without.r.summary;
        expect(restWith).toEqual(restWithout);
    }, 120_000);
});

describe('what it hears is the engine\'s own announcement, never a UI one', () => {
    it('the routes stay quiet while it plays', async () => {
        buildBoard();
        newsHalfWay();
        let heardDuring = 0;
        GameLoop.onTick('test_watch', () => { heardDuring += Banners.getAll().length; }, 99);
        try {
            await run({ savedAt: NOW - 20 * MIN, now: NOW, save: false });
        } finally {
            GameLoop.offTick('test_watch');
        }
        expect(heardDuring).toBe(0);
    }, 60_000);
});
