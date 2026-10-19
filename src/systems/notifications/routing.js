import { EventBus, UI_LISTENER } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
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
import { recipesUnlockedBy, othersBestLevel } from './recipeUnlocks.js';

/**
 * Where every game event goes (the owner's audit): items to the stubs, what must not be missed to
 * a banner. Level-ups stay on the hero (the level-up moment and speech), refusals are callouts on
 * the mat, and the rest says nothing; none of those is wired here.
 *
 * Every route is a `UI_LISTENER`: a catch-up's quiet bus skips them, and its summary reports.
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
            const unlocked = recipesUnlockedBy(listRecipes(), {
                skillId,
                oldLevel: Number(oldLevel) || 0,
                newLevel: Number(newLevel) || 0,
                othersBest: othersBestLevel(GameState.heroes, heroId, skillId)
            });
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
        event: ENGINE_EVENTS.HERO_PROMOTED, to: 'banner:promotion',
        handle: ({ heroId, heroName, toJobName } = {}) => Banners.push({
            kind: 'promotion',
            parts: { heroes: [heroName || heroOf(heroId)?.name || 'A hero'], job: toJobName || null },
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
    stopFadeTimer();
    ItemStubs.reset();
    Banners.reset();
    ItemStubs.loadPins(GameState.state?.ui?.pinnedStubs);
}

/** The sound a banner makes as it comes on screen: a chime, or a warning tone for a problem. */
export const BANNER_SOUND = Object.freeze({ [TONE.MILESTONE]: 'quest_claim', [TONE.PROBLEM]: 'invasion' });

let unsubs = [];

/** Hear every route. Idempotent. */
export function wireNotifications() {
    unwireNotifications();
    unsubs = ROUTES.map(r => EventBus.subscribe(r.event, (p) => r.handle(p || {}), UI_LISTENER));
    Banners.setOnShow((b) => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: BANNER_SOUND[b.tone] }));
}

export function unwireNotifications() {
    unsubs.forEach(u => u?.());
    unsubs = [];
    stopFadeTimer();
    Banners.setOnShow(null);
}

/** The pin controls, for the stub column: each keeps the save's copy in step. */
export const pins = Object.freeze({
    pin(itemId) { ItemStubs.pin(itemId); savePins(); },
    unpin(itemId) { ItemStubs.unpin(itemId); savePins(); ensureFadeTimer(); },
    reset(itemId) { ItemStubs.resetPin(itemId); savePins(); }
});
