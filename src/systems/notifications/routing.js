import { EventBus, UI_LISTENER } from '../core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { GameState } from '../../state/GameState.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { getUpgradeDef } from '../../config/guildUpgrades.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import * as ItemStubs from './itemStubs.js';
import * as Banners from './banners.js';
import { TONE } from './bannerKinds.js';
import { recipesUnlockedByLevelUp, recipesUnlockedByGift } from './recipeUnlocks.js';
import { hasNews } from './catchUpNews.js';
import * as Atlas from '../atlas/Atlas.js';
import { defaultBannerFor } from '../../config/areaBanners.js';

/**
 * Where every game event goes (the owner's audit): items to the stubs, what must not be missed to
 * a banner. Level-ups stay on the hero (the level-up moment and speech), refusals are callouts on
 * the mat, and the rest says nothing; none of those is wired here.
 *
 * Every route is a `UI_LISTENER`: a catch-up's quiet bus skips them. The catch-up hears that news
 * itself (`summary.news`, `catchUpNews.js`) and it is handed over here once its summary closes
 * ({@link deliverCatchUpNews}).
 */

const itemName = (itemId) => getItem(itemId)?.name || itemId;
const itemSprite = (itemId) => (itemId ? { kind: 'item', id: itemId } : null);
const heroOf = (heroId) => (GameState.heroes || []).find(h => h?.id === heroId) || null;

function heroSprite(heroId) {
    const path = resolveSpritePath(heroOf(heroId)?.spriteId);
    return path ? { kind: 'src', src: path.startsWith('/') ? path : `/${path}` } : null;
}

/** Keep the save's copy of the pins in step with the stubs. */
function savePins() {
    const ui = GameState.state?.ui;
    if (ui) ui.pinnedStubs = ItemStubs.serializePins();
}

// --- The fade timer: runs only while some stub can still fade. ------------------------------

let fadeTimer = null;

function stopFadeTimer() {
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
}

function ensureFadeTimer() {
    if (fadeTimer || typeof setInterval === 'undefined') return;
    fadeTimer = setInterval(() => {
        ItemStubs.prune();
        if (!ItemStubs.hasUnpinned()) stopFadeTimer();
    }, 1000);
}

// --- The routes ------------------------------------------------------------------------------

/**
 * One row per event the notifications hear: what it is, where it goes, and the handler. The table
 * is the routing; `NotificationRouting.test.js` reads it.
 */
export const ROUTES = [
    {
        event: ENGINE_EVENTS.INVENTORY_UPDATED, to: 'stub',
        handle: ({ itemId, added = 0, removed = 0 } = {}) => {
            // A bulk change (a load, a reset) names no item and is not a flow.
            if (!itemId || (!(added > 0) && !(removed > 0))) return;
            // Gains are counted where they are made (`SpriteLayer.addSprite`), spending here.
            if (removed > 0) ItemRateTracker.recordLoss(itemId, removed);
            ItemStubs.recordFlow(itemId, { added, removed });
            if (ItemStubs.getStub(itemId)?.pinned) savePins();
            ensureFadeTimer();
        }
    },
    {
        event: ENGINE_EVENTS.ITEM_DISCOVERED, to: 'stub:new',
        handle: ({ itemId } = {}) => ItemStubs.markNew(itemId)
    },
    {
        event: ENGINE_EVENTS.HERO_LEVELED, to: 'banner:recipe',
        handle: ({ heroId, heroName, skillId, oldLevel, newLevel, startLevel } = {}) => {
            const unlocked = recipesUnlockedByLevelUp(listRecipes(), GameState.heroes, { heroId, skillId, oldLevel, newLevel });
            if (!unlocked.length) return;
            const name = heroName || heroOf(heroId)?.name || 'A hero';
            Banners.push({
                kind: 'recipe',
                // One level-up said as several level events (5 to 6, 6 to 7) is one banner.
                groupKey: `recipe:${heroId}:${skillId}:${startLevel ?? oldLevel}`,
                parts: { heroes: [name], recipes: unlocked.map(r => r.name || r.id) },
                sprite: itemSprite(unlocked[0].outputs?.[0]?.itemId),
                subjects: heroId ? [{ type: 'hero', id: heroId }] : []
            });
        }
    },
    {
        // A Guild Hall gift (XP for Everyone) raised every hero at once: one banner for all it unlocked.
        event: ENGINE_EVENTS.XP_FOR_EVERYONE_GIVEN, to: 'banner:recipe',
        handle: ({ heroes } = {}) => {
            const batch = ++giftBatches;
            const rows = recipesUnlockedByGift(listRecipes(), GameState.heroes, heroes);
            for (const { heroId, recipes } of rows) {
                const name = (heroes || []).find(r => r.heroId === heroId)?.heroName || heroOf(heroId)?.name || 'A hero';
                Banners.push({
                    kind: 'recipe',
                    groupKey: `xp_for_everyone:${batch}`,
                    parts: { heroes: [name], recipes: recipes.map(r => r.name || r.id) },
                    sprite: itemSprite(recipes[0].outputs?.[0]?.itemId),
                    subjects: [{ type: 'hero', id: heroId }]
                });
            }
        }
    },
    {
        event: ENGINE_EVENTS.HERO_RECRUITED, to: 'banner:hero',
        handle: ({ heroId, name } = {}) => Banners.push({
            kind: 'hero',
            parts: { heroes: [name || heroOf(heroId)?.name || 'A hero'] },
            sprite: heroSprite(heroId),
            subjects: heroId ? [{ type: 'hero', id: heroId }] : []
        })
    },
    {
        event: ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, to: 'banner:upgrade',
        handle: ({ upgradeId, rank } = {}) => {
            // A Roster Size rank recruits a hero, and the new hero's banner says it.
            if (upgradeId === 'roster_size') return;
            const def = getUpgradeDef(upgradeId);
            if (!def) return;
            Banners.push({
                kind: 'upgrade',
                parts: { upgrades: [def.name], detail: typeof def.statLabel === 'function' ? def.statLabel(rank) : null },
                sprite: def.sprite ? { kind: 'src', src: def.sprite } : null
            });
        }
    },
    {
        event: BOARD_EVENTS.HERO_DEFEATED, to: 'banner:knockout',
        handle: ({ heroId, heroName, lost = [] } = {}) => Banners.push({
            kind: 'knockout',
            parts: { heroes: [heroName || heroOf(heroId)?.name || 'Your hero'], lost: Array.isArray(lost) ? lost : [] },
            sprite: heroSprite(heroId),
            subjects: heroId ? [{ type: 'hero', id: heroId }] : []
        })
    },
    {
        event: ENGINE_EVENTS.BANK_FULL, to: 'banner:bankFull',
        handle: ({ itemId } = {}) => itemId && Banners.push({
            kind: 'bankFull',
            parts: { items: [itemName(itemId)] },
            sprite: itemSprite(itemId)
        })
    },
    {
        event: ENGINE_EVENTS.ATLAS_CHANGED, to: 'banner:settled',
        handle: ({ reason, regionId } = {}) => {
            if (reason !== 'created') return;
            // The first camp of a new game is never announced as created; a settled place is.
            const region = Atlas.getRegion(regionId);
            if (!region || region.kind !== Atlas.REGION_KIND.SETTLED) return;
            const banner = defaultBannerFor(region.ground?.main || null);
            Banners.push({
                kind: 'settled',
                parts: { places: [region.flavourName || region.practicalName || 'A new place'] },
                sprite: banner ? { kind: 'area', id: banner } : null
            });
        }
    },
    {
        // A catch-up long enough for "While you were away" keeps its news until the summary closes;
        // a short one, with no summary, hands it over at once.
        event: ENGINE_EVENTS.CATCH_UP_FINISHED, to: 'catchUp:news',
        handle: ({ show, summary } = {}) => {
            const news = summary?.news;
            if (!hasNews(news)) return;
            if (show) heldNews.push(news);
            else deliverCatchUpNews(news);
        }
    },
    {
        event: UI_EVENTS.CATCH_UP_SUMMARY_CLOSED, to: 'catchUp:news',
        handle: () => {
            const held = heldNews;
            heldNews = [];
            for (const news of held) deliverCatchUpNews(news);
        }
    },
    {
        // Another save, or a new game: nothing carries over but the pins that save kept.
        event: ENGINE_EVENTS.GAME_LOADED, to: 'reset',
        handle: () => startFresh()
    },
    {
        event: ENGINE_EVENTS.GAME_RESET, to: 'reset',
        handle: ({ reason } = {}) => {
            if (reason === 'new_game' || reason === 'dev_stress') startFresh();
        }
    }
];

/** Empty stubs and banners, then the pins of the game now running. */
function startFresh() {
    heldNews = [];
    stopFadeTimer();
    ItemStubs.reset();
    Banners.reset();
    ItemStubs.loadPins(GameState.state?.ui?.pinnedStubs);
}

// --- After time away -------------------------------------------------------------------------

/** News from catch-ups whose summary is still open. A load forgets it; "Load as I left it" reloads the page. */
let heldNews = [];

/** The most first-find stubs one catch-up raises; the summary lists every find. */
export const MAX_FIND_STUBS = 6;

/**
 * Hand a catch-up's news (`summary.news`) to the banners and stubs, merged as live play merges
 * them: one banner each for its recipes, its knock-outs and the Bank refusing items, however
 * long the absence, and a gold "New!" stub for each first find (at most {@link MAX_FIND_STUBS}).
 * Milestones go first, so the problems drop in on top.
 */
export function deliverCatchUpNews(news) {
    if (!hasNews(news)) return;
    const batch = ++newsBatches;
    for (const row of news.recipes || []) {
        Banners.push({
            kind: 'recipe',
            groupKey: `catch_up_recipes:${batch}`,
            parts: { heroes: [row.heroName], recipes: row.recipes.map(r => r.name) },
            sprite: itemSprite(row.recipes[0]?.itemId),
            subjects: row.heroId ? [{ type: 'hero', id: row.heroId }] : []
        });
    }
    for (const row of news.knockouts || []) {
        Banners.push({
            kind: 'knockout',
            groupKey: `catch_up_knockouts:${batch}`,
            parts: { heroes: [row.heroName], lost: row.lost || [] },
            sprite: heroSprite(row.heroId),
            subjects: row.heroId ? [{ type: 'hero', id: row.heroId }] : []
        });
    }
    for (const itemId of news.bankFull || []) {
        Banners.push({ kind: 'bankFull', parts: { items: [itemName(itemId)] }, sprite: itemSprite(itemId) });
    }
    for (const { itemId, count } of (news.finds || []).slice(0, MAX_FIND_STUBS)) {
        ItemStubs.markNew(itemId);
        ItemStubs.recordFlow(itemId, { added: count });
    }
    if (news.finds?.length) ensureFadeTimer();
}

let newsBatches = 0;
/** Guild Hall gifts so far: each one's recipe banners share a group, so they are one banner. */
let giftBatches = 0;

/** The sound a banner makes as it comes on screen: a chime, or a warning tone for a problem. */
export const BANNER_SOUND = Object.freeze({ [TONE.MILESTONE]: 'quest_claim', [TONE.PROBLEM]: 'invasion' });

/**
 * Banner sounds so far: each plays the next file of its clip's pool.
 *
 * ⚠️ Never a random pick. The routes are UI listeners, which a catch-up's quiet bus skips, so a
 * draw from `Math.random` here would leave live play and a catch-up of the same hour with different
 * random numbers, and any change to the banners would change the engine bench's work.
 */
let soundsPlayed = 0;

let unsubs = [];

/** Hear every route. Idempotent. */
export function wireNotifications() {
    unwireNotifications();
    unsubs = ROUTES.map(r => EventBus.subscribe(r.event, (p) => r.handle(p || {}), UI_LISTENER));
    Banners.setOnShow((b) => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, {
        clip: BANNER_SOUND[b.tone],
        options: { variant: soundsPlayed++ }
    }));
}

export function unwireNotifications() {
    unsubs.forEach(u => u?.());
    unsubs = [];
    stopFadeTimer();
    Banners.setOnShow(null);
}

/** The stub column's clicks: each keeps the save's copy of the pins in step. */
export const pins = Object.freeze({
    pin(itemId) { ItemStubs.pin(itemId); savePins(); },
    unpin(itemId) { ItemStubs.unpin(itemId); savePins(); ensureFadeTimer(); },
    reset(itemId) { ItemStubs.resetPin(itemId); savePins(); },
    /** Left-click: pin or unpin. */
    toggle(itemId) {
        if (ItemStubs.getStub(itemId)?.pinned) pins.unpin(itemId);
        else pins.pin(itemId);
    },
    /** Right-click: a pinned stub back to +0, an unpinned one cleared. */
    clear(itemId) {
        if (ItemStubs.getStub(itemId)?.pinned) pins.reset(itemId);
        else ItemStubs.remove(itemId);
    }
});
