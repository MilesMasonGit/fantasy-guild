import { EventBus, UI_LISTENER } from '../core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { GameState } from '../../state/GameState.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { getUpgradeDef } from '../../config/guildUpgrades.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import * as ItemStubs from './itemStubs.js';
import * as Banners from './banners.js';
import { TONE } from './bannerKinds.js';
import { recipesUnlockedByLevelUp } from './recipeUnlocks.js';
import { hasNews } from './catchUpNews.js';
import * as Atlas from '../atlas/Atlas.js';
import { defaultBannerFor } from '../../config/areaBanners.js';
import * as BoardState from '../board/BoardState.js';
import { getEvent } from '../../config/registries/eventRegistry.js';
import * as EventTokens from '../board/EventTokens.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import { InventoryManager } from '../inventory/InventoryManager.js';

/**
 * Where every game event goes (the owner's audit): items to the stubs, what must not be missed to
 * a banner. Level-ups stay on the hero (the level-up moment and speech), refusals are callouts on
 * the mat, and the rest says nothing; none of those is wired here.
 *
 * Every route is a `UI_LISTENER`: a catch-up's quiet bus skips them. The catch-up hears that news
 * itself (`summary.news`, `catchUpNews.js`). With no summary it is handed over here at once
 * ({@link deliverCatchUpNews}); after a summary, which told it, only what still needs the player
 * is raised ({@link deliverAfterSummary}).
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

/** The game whose banners the stack holds, set as a load or a new game starts it afresh. */
let stackOf = null;

/**
 * Keep the save's copy of the unclicked kept banners in step with the stack.
 * ⚠️ Only into the game the stack belongs to: written into a game just loaded, before its
 * `GAME_LOADED`, the game before's banners would come back in it.
 */
function saveBanners() {
    const ui = GameState.state?.ui;
    if (ui && GameState.state === stackOf) ui.banners = Banners.serializeKept();
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
            settleProblemBanners();
            // A bulk change (a load, a reset) names no item and is not a flow.
            if (!itemId || (!(added > 0) && !(removed > 0))) return;
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
            // A Bank upgrade may be the slot a full Bank was waiting for.
            settleProblemBanners();
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
        // A hero who fled under Valiant lost nothing: their own banner says Fled.
        handle: ({ heroId, heroName, lost = [], fled = false } = {}) => {
            const heroes = [heroName || heroOf(heroId)?.name || 'Your hero'];
            Banners.push({
                kind: fled ? 'fled' : 'knockout',
                parts: fled ? { heroes } : { heroes, lost: Array.isArray(lost) ? lost : [] },
                sprite: heroSprite(heroId),
                subjects: heroId ? [{ type: 'hero', id: heroId }] : []
            });
        }
    },
    {
        event: ENGINE_EVENTS.BANK_FULL, to: 'banner:bankFull',
        handle: ({ itemId, reason } = {}) => itemId && pushRefused(itemId, reason === 'stack' ? 'stackFull' : 'bankFull')
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
        // Something new found no room and waits: told once per wait (`RoomWait`), the station or
        // spawner named and outlined, or the arrival or event said without a Token.
        event: BOARD_EVENTS.NO_ROOM_WAIT, to: 'banner:noRoom',
        handle: ({ source, instanceId, typeId, name } = {}) => Banners.push({
            kind: 'noRoom',
            parts: {
                beside: instanceId && name ? [name] : [],
                arrival: source === 'arrival',
                event: source === 'event'
            },
            sprite: typeId ? { kind: 'token', id: typeId } : null,
            subjects: instanceId ? [{ type: 'token', id: instanceId }] : []
        })
    },
    {
        // An event landing on the mat: a banner naming it, pointing to its Token.
        event: BOARD_EVENTS.EVENT_LANDED, to: 'banner:event',
        handle: ({ instanceId, typeId, name } = {}) => pushEventBanner({ instanceId, typeId, name })
    },
    {
        // Its Token gone, the banner pointing to it goes too, and one banner says goodbye.
        event: BOARD_EVENTS.EVENT_ENDED, to: 'banner:event',
        handle: ({ instanceId, eventId, name, reason } = {}) => {
            if (!instanceId) return;
            Banners.withdraw(eventBannerKey(instanceId));
            Banners.push({
                kind: 'eventGone',
                groupKey: `eventGone:${instanceId}`,
                parts: { name: name || 'An event', word: EventTokens.endedWord(reason), goodbye: getEvent(eventId)?.goodbye || '' },
                sprite: null
            });
        }
    },
    {
        // Travel: the Region left takes its event's banner with it; one standing here gets its own.
        event: ENGINE_EVENTS.BOARD_SWAPPED, to: 'banner:event',
        handle: () => {
            pruneEventBanners();
            raiseStandingEventBanners();
        }
    },
    {
        // A catch-up long enough for "While you were away" keeps its news until the summary closes;
        // a short one, with no summary, hands it over at once. An event that landed while away and
        // still stands is news too; one that came and went is not.
        event: ENGINE_EVENTS.CATCH_UP_FINISHED, to: 'catchUp:news',
        handle: ({ show, summary } = {}) => {
            countTimeAwayOnPins(summary?.items);
            pruneEventBanners();
            settleProblemBanners();
            const landed = (summary?.events || []).filter(e => e?.landed && !e.ended && e.instanceId);
            const news = summary?.news;
            if (show) {
                heldEvents.push(...landed);
                if (hasNews(news)) heldNews.push(news);
                return;
            }
            for (const e of landed) pushEventBanner(e, { onMat: true });
            deliverCatchUpNews(news);
        }
    },
    {
        // A summary offered again after a reload keeps its news until it closes, as it did before.
        event: ENGINE_EVENTS.CATCH_UP_OFFERED_AGAIN, to: 'catchUp:news',
        handle: ({ news } = {}) => {
            for (const n of news || []) if (hasNews(n)) heldNews.push(n);
        }
    },
    {
        event: UI_EVENTS.CATCH_UP_SUMMARY_CLOSED, to: 'catchUp:news',
        handle: () => {
            const events = heldEvents;
            const held = heldNews;
            heldEvents = [];
            heldNews = [];
            for (const e of events) pushEventBanner(e, { onMat: true });
            deliverAfterSummary(held);
        }
    },
    {
        // Another save, or a new game: nothing carries over but what that save kept (the pins, the
        // unclicked kept banners), and the banner of an event standing on its mat.
        event: ENGINE_EVENTS.GAME_LOADED, to: 'reset',
        handle: () => {
            startFresh();
            raiseStandingEventBanners();
            settleProblemBanners();
        }
    },
    {
        event: ENGINE_EVENTS.GAME_RESET, to: 'reset',
        handle: ({ reason } = {}) => {
            if (reason === 'new_game' || reason === 'dev_stress') startFresh();
        }
    }
];

/** The `groupKey` of the banner about the event Token `instanceId`: one banner per Token. */
const eventBannerKey = (instanceId) => `event:${instanceId}`;

/**
 * The banner naming the event Token `instanceId` and pointing to it. `onMat`: only while that
 * Token stands on the mat (an event handed over after a catch-up or a summary may have left).
 */
function pushEventBanner({ instanceId, typeId, name }, { onMat = false, silent = false } = {}) {
    if (!instanceId) return;
    const token = BoardState.getTokenById(instanceId);
    if (onMat && !token) return;
    const event = EventTokens.eventOf(token);
    Banners.push({
        kind: 'event',
        groupKey: eventBannerKey(instanceId),
        parts: {
            name: name || typeId || 'An event',
            kind: event?.kind ?? null,
            lastsMs: EventTokens.lastsMsOf(token),
            leavesMs: EventTokens.isEventNode(token) ? EventTokens.leavesInMs(token) : 0
        },
        sprite: typeId ? { kind: 'token', id: typeId } : null,
        subjects: [{ type: 'token', id: instanceId }]
    }, { silent });
}

/**
 * Every event Token standing on the mat gets its banner, if it has none up (a load, a return by
 * travel). Silent: it is a reminder, not news.
 */
function raiseStandingEventBanners() {
    for (const token of BoardState.tokens()) {
        const event = EventTokens.eventOf(token);
        if (!event) continue;
        const key = eventBannerKey(token.id);
        if (Banners.getAll().some(b => b.groupKey === key)) continue;
        pushEventBanner({ instanceId: token.id, typeId: token.typeId, name: event.name }, { silent: true });
    }
}

/** Take back every event banner whose Token has left the mat meanwhile (a catch-up's quiet bus said nothing). */
function pruneEventBanners() {
    for (const b of Banners.getAll()) {
        if (b.kind !== 'event') continue;
        const id = b.subjects[0]?.id;
        if (!id || !BoardState.getTokenById(id)) Banners.withdraw(b.groupKey);
    }
}

/**
 * A pinned stub counts the guild's whole time, so a catch-up's gained and spent are added to it at
 * once, whether or not a summary shows. Unpinned stubs stay quiet: the summary speaks for them.
 * ⚠️ Only on `CATCH_UP_FINISHED`: a summary offered again after a reload played nothing new, and
 * counting it there would count the same time twice.
 */
function countTimeAwayOnPins(items) {
    if (!items) return;
    let any = false;
    for (const stub of ItemStubs.getStubs()) {
        if (!stub.pinned) continue;
        const added = Number(items.gained?.[stub.itemId]) || 0;
        const removed = Number(items.spent?.[stub.itemId]) || 0;
        if (!(added > 0) && !(removed > 0)) continue;
        ItemStubs.recordFlow(stub.itemId, { added, removed });
        any = true;
    }
    if (any) savePins();
}

/** Empty stubs and banners, then the pins and kept banners of the game now running. */
function startFresh() {
    stackOf = null;
    const kept = GameState.state?.ui?.banners;
    heldNews = [];
    heldEvents = [];
    stopFadeTimer();
    ItemStubs.reset();
    Banners.reset();
    ItemStubs.loadPins(GameState.state?.ui?.pinnedStubs);
    stackOf = GameState.state;
    Banners.restore(kept);
}

// --- After time away -------------------------------------------------------------------------

/** News from catch-ups whose summary is still open. A load forgets it; "Load as I left it" reloads the page. */
let heldNews = [];
/** Events that landed in those catch-ups (`summary.events` rows), raised as the summary closes if still standing. */
let heldEvents = [];

/** The most first-find stubs one catch-up raises; the summary lists every find. */
export const MAX_FIND_STUBS = 6;

/**
 * Hand the news of a catch-up that showed no summary (`summary.news`) to the banners and stubs,
 * merged as live play merges them: one banner each for its recipes, its knock-outs and the Bank
 * refusing items, and a gold "New!" stub for each first find (at most {@link MAX_FIND_STUBS}).
 * Milestones go first, so the problems drop in on top; a refusal already fixed is not raised.
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
        // A hero who only ever fled (Valiant) is told as Fled; one Defeated even once, as Defeated.
        const fled = row.times > 0 && row.fled === row.times;
        Banners.push({
            kind: fled ? 'fled' : 'knockout',
            groupKey: `catch_up_${fled ? 'fled' : 'knockouts'}:${batch}`,
            parts: fled ? { heroes: [row.heroName] } : { heroes: [row.heroName], lost: row.lost || [] },
            sprite: heroSprite(row.heroId),
            subjects: row.heroId ? [{ type: 'hero', id: row.heroId }] : []
        });
    }
    for (const itemId of news.bankFull || []) pushRefused(itemId, 'bankFull');
    for (const itemId of news.stackFull || []) pushRefused(itemId, 'stackFull');
    settleProblemBanners();
    markFinds(news.finds);
}

/** A gold "New!" stub for each first find, at most {@link MAX_FIND_STUBS}. */
function markFinds(finds) {
    for (const { itemId, count } of (finds || []).slice(0, MAX_FIND_STUBS)) {
        ItemStubs.markNew(itemId);
        ItemStubs.recordFlow(itemId, { added: count });
    }
    if (finds?.length) ensureFadeTimer();
}

/**
 * What a closed "While you were away" leaves up: the summary told every recipe, knock-out and
 * refusal, so no milestone is raised again; only the problems that still stand now are, read from
 * the game rather than from the summary's rows (a pile on the mat the Bank refuses now), and the
 * first finds' stubs, which mark items in the Bank rather than tell news.
 */
export function deliverAfterSummary(newsList = []) {
    for (const news of newsList) if (hasNews(news)) markFinds(news.finds);
    raiseOpenProblems();
}

/** A banner kind for each reason the Bank refuses an item (`InventoryManager.refusalOf`). */
const REFUSED_KIND = Object.freeze({ slots: 'bankFull', stack: 'stackFull' });

/** Banner `kind` saying the Bank refused `itemId`. */
function pushRefused(itemId, kind) {
    if (!itemId) return;
    Banners.push({ kind, parts: { items: [itemName(itemId)], itemIds: [itemId] }, sprite: itemSprite(itemId) });
}

/** Every item lying on the mat that the Bank would refuse now, said as its kind of banner. */
function raiseOpenProblems() {
    const seen = new Set();
    for (const sprite of SpriteLayer.getSprites()) {
        const itemId = sprite?.kind === 'item' ? sprite.refId : null;
        if (!itemId || seen.has(itemId)) continue;
        seen.add(itemId);
        const kind = REFUSED_KIND[InventoryManager.refusalOf(itemId)];
        if (kind) pushRefused(itemId, kind);
    }
}

/**
 * Take each item the Bank would now take out of its Bank-full or stack-full banner, and the banner
 * away once none is left: a problem banner goes by itself once fixed.
 * ⚠️ A banner from a save older than `itemIds` names no ids and stays until clicked.
 */
function settleProblemBanners() {
    for (const [reason, kind] of Object.entries(REFUSED_KIND)) {
        if (!Banners.hasKind(kind)) continue;
        Banners.revise(kind, (parts) => {
            const ids = parts?.itemIds;
            if (!Array.isArray(ids)) return parts;
            const still = ids.filter(id => InventoryManager.refusalOf(id) === reason);
            if (still.length === ids.length) return parts;
            return still.length ? { ...parts, items: still.map(itemName), itemIds: still } : null;
        });
    }
}

let newsBatches = 0;

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
    unsubs.push(Banners.subscribe(saveBanners));
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
