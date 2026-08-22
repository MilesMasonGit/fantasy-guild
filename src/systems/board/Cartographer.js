// Fantasy Guild — The Cartographer and Map bursts (7×7 Playmat rework, Phase 8)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { getMap, listMaps } from '../../config/registries/mapRegistry.js';
import { GUILD_HALL_DROP_SEQUENCE } from '../../config/registries/guildHallMaps.js';
import {
    getTokenType, getAllTokenTypes, tokenName, tokenStartingUses
} from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import { logger } from '../../utils/Logger.js';

/**
 * The Cartographer — progression, and the game's **headline reward beat**.
 *
 * This is the replacement for the pack/booster economy. `CollectionManager` and
 * `PackOpeningOverlay` were the old machinery and were deleted in Phase 1; git
 * history is the reference, and deliberately only for the *plumbing*. The
 * mechanic is not the same: packs were per-area escalating price with a
 * pick-1-of-N; Maps are **flat within-theme price with a burst where all of it
 * is yours**.
 *
 * ## An off-board NPC, and the second deliberate exception (D-98)
 * Everything happens on the board — except this. "Collecting Cartographers" was
 * an odd fiction; visiting *the* cartographer is a natural one, and a
 * Cartographer Token would have permanently consumed a tile *and* a hero purely
 * to keep progression ticking. **The Map itself is still a Token**, so only the
 * transaction leaves the grid.
 *
 * ## Nothing is ever locked (D-99)
 * Every Map is listed from the very start, in price order. **Cost is the only
 * gate.** No tutorial, no recommendations, no greyed-out nodes — ambition is
 * *expensive* rather than *forbidden*, which feels far better, and it removed
 * the design's most fragile number: progression no longer hangs on a drop rate
 * that stalls the game if too rare and trivialises it if too common.
 *
 * ## Maps cost no hero-time (D-142)
 * Progression does not compete with production. Opening a Map is **an act, not
 * a task** — the player double-clicks and it bursts. This strikes D-37's
 * "Maps are worked by a hero on a timer" outright.
 */

/** A burst yields 3–6 things (D-167) — a modest handful, not a windfall. */
export const BURST_MIN = 3;
export const BURST_MAX = 5;

/** Standard refusal shape, so the UI can state the reason (D-160). */
const refuse = (reason) => ({ success: false, reason });

/**
 * Which Token type carries a given Map.
 *
 * Looked up by `mapId` rather than derived from the name, so a Map Token can be
 * called anything and the two registries cannot drift into disagreement.
 */
export function tokenForMap(mapId) {
    const types = getAllTokenTypes();
    const found = Object.keys(types).find(id => types[id].mapId === mapId);
    if (found) return found;
    if (mapId && String(mapId).startsWith('map_guild_hall')) return 'token_guild_hall_map';
    return Object.keys(types).find(id => types[id].mapId) || 'token_guild_hall_map';
}

/** Get list of maps the player has purchased from the Cartographer. */
export function getPurchasedMaps() {
    return GameState.state?.cartographer?.purchasedMaps || [];
}

// ---------------------------------------------------------------------------
// Discovery — the silhouettes (D-159)
// ---------------------------------------------------------------------------

/**
 * What the player has actually seen come out of a Map.
 *
 * **Each Map shows its full pool, with undiscovered entries as silhouettes**,
 * and that does two jobs at once:
 *
 * * It makes **restocking deliberate.** A player who needs Forests can see
 *   which Maps yield them and shop accordingly — the main answer to D-154's
 *   "bursts are random with no reliability guarantee". D-101 decided
 *   price-order-only guidance *before* D-153 made Maps the restocking route as
 *   well as the discovery route; blind shopping was acceptable for discovery,
 *   and is not for supply.
 * * It restores a **collection hook** that D-52 removed when playsets were cut.
 *   An unopened silhouette is something to want, and filling one in is its own
 *   small reward.
 */
function discovered() {
    const state = GameState.state;
    if (!state) return {};
    if (!state.progress) state.progress = {};
    if (!state.progress.mapDiscoveries) state.progress.mapDiscoveries = {};
    return state.progress.mapDiscoveries;
}

/** Whether a pool entry has ever been seen. */
export function isDiscovered(refId) {
    return !!discovered()[refId];
}

/** Mark a pool entry as seen. Returns true if this was the first time. */
export function markDiscovered(refId) {
    const seen = discovered();
    if (!seen || !refId) return false;
    if (seen[refId]) return false;
    seen[refId] = true;
    EventBus.publish('discovery_unmasked', { refId });
    return true;
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

/**
 * Whether a Map can be bought right now, and why not.
 *
 * Kept separate from {@link buyMap} so the menu can grey a row and *say* what is
 * missing without attempting the purchase. Every refusal names its cause
 * (D-160, D-150) — a silent "no" on a shop row is the worst possible outcome.
 */
export function canBuy(mapId) {
    const def = getMap(mapId);
    if (!def) return refuse('No such Map');

    if (!BoardState.hasMapSpace()) {
        return refuse('Map limit reached (50/50) — burst existing maps to acquire more');
    }

    const gold = CurrencyManager.getCurrency('gold');
    if (gold < def.price) {
        return refuse(`Not enough gold — ${def.price}g needed`);
    }

    // Materials come from the Bank automatically (D-150), the same rule Tokens
    // already use for their inputs (D-24). One consistent way the game consumes
    // items, and no inventory management on a purchase.
    const check = InputAllocator.checkInputs(def.materials);
    if (!check.ok) {
        const names = check.missing
            .map(m => `${m.needed - m.available}× ${getItem(m.itemId)?.name || m.itemId}`)
            .join(', ');
        return refuse(`Short on materials — need ${names}`);
    }

    // **A purchased Map goes straight to the Tray** (D-156): Maps cannot be
    // stored, never occupy Vault slots, and there is no Map inventory. So a
    // full Tray refuses the purchase rather than leaving it nowhere to go.
    if (BoardState.getTray().length >= BoardState.TRAY_CAPACITY) {
        return refuse('No room in the Tray — place or open something first');
    }

    return { success: true };
}

/**
 * Buy one Map. It lands in the Tray, never in the Vault (D-156).
 *
 * Gold and materials are both taken only after every check has passed, for the
 * same reason `completeCycle` decides the whole exchange before any of it
 * happens: a half-paid purchase destroys items for nothing.
 */
export function buyMap(mapId, options = {}) {
    const allowed = canBuy(mapId);
    if (!allowed.success) return allowed;

    const def = getMap(mapId);
    const typeId = tokenForMap(mapId);
    if (!typeId) return refuse('That Map has no Token');

    if (!InputAllocator.consumeInputs(def.materials)) {
        return refuse('Short on materials');
    }
    if (!CurrencyManager.spendGold(def.price, `Map: ${def.name}`)) {
        return refuse(`Not enough gold — ${def.price}g needed`);
    }

    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    let initialPos = undefined;
    if (options.sourceRect && typeof document !== 'undefined') {
        const trayEl = document.querySelector('[data-tray-surface]');
        const trayRect = trayEl?.getBoundingClientRect();
        if (trayRect && trayRect.height > 0) {
            const spriteCenterY = options.sourceRect.top + (options.sourceRect.height || 0) / 2;
            const targetFractionY = Math.max(0.08, Math.min(0.92, (spriteCenterY - trayRect.top) / trayRect.height));
            initialPos = { x: 0.5, y: targetFractionY };
        }
    }
    BoardState.addToTray(instance, undefined, initialPos);
    instance.bornAt = Date.now();

    if (options.sourceRect) {
        instance.sourceRect = options.sourceRect;
        instance.fromX = -1;
        instance.fromY = instance.y;
    } else {
        // Sideways fallback (from the left instead of top)
        instance.fromX = -1;
        instance.fromY = instance.y;
    }

    // Track purchased map for bounty unlocking
    if (!GameState.state.cartographer) GameState.state.cartographer = { purchasedMaps: [] };
    if (!Array.isArray(GameState.state.cartographer.purchasedMaps)) {
        GameState.state.cartographer.purchasedMaps = [];
    }
    if (!GameState.state.cartographer.purchasedMaps.includes(mapId)) {
        GameState.state.cartographer.purchasedMaps.push(mapId);
    }

    EventBus.publish('map_purchased', { mapId, price: def.price });
    EventBus.publish('state_changed');
    logger.info('Cartographer', `Bought ${def.name} for ${def.price}g`);
    return { success: true, instance };
}

// ---------------------------------------------------------------------------
// The burst
// ---------------------------------------------------------------------------

/** One weighted draw from a Map's pool. */
function rollOne(def) {
    const total = def.pool.reduce((sum, e) => sum + (e.weight || 0), 0);
    if (total <= 0) return null;

    let roll = Math.random() * total;
    for (const entry of def.pool) {
        roll -= entry.weight || 0;
        if (roll <= 0) return entry;
    }
    return def.pool[def.pool.length - 1];
}

/**
 * Roll a burst's contents. Exposed for tests; `openMap` is the real entry point.
 *
 * **Random with no reliability guarantee** (D-154). A Woodland Map might hand
 * you six Forests or three Bears and a Tool Rack. That is a genuine accepted
 * cost, and its two mitigations both arrive elsewhere — unwanted Tokens sell
 * (D-146, built in Phase 7) and support Tokens become craftable (D-144, later)
 * — so **the exposure is the first hour** (risk 16).
 */
export function rollBurst(mapId) {
    const def = getMap(mapId);
    if (!def?.pool?.length) return [];

    // Guild Hall tutorial maps drop from the scripted sequence regardless of open order
    if (def.theme === 'guild_hall' || def.id === 'map_guild_hall' || (typeof mapId === 'string' && mapId.startsWith('map_guild_hall'))) {
        const state = GameState.state;
        if (!state) return [...GUILD_HALL_DROP_SEQUENCE[0]];
        if (!state.progress) state.progress = {};
        const openCount = state.progress.guildHallMapOpens || 0;
        state.progress.guildHallMapOpens = openCount + 1;

        const dropIndex = Math.min(openCount, GUILD_HALL_DROP_SEQUENCE.length - 1);
        return [...GUILD_HALL_DROP_SEQUENCE[dropIndex]];
    }

    const count = BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN + 1));
    const out = [];
    for (let i = 0; i < count; i++) {
        const entry = rollOne(def);
        if (entry) out.push(entry);
    }
    return out;
}

/**
 * Open a Map and scatter its contents across the board.
 *
 * **A Map is a single burst and is consumed** (D-155). It can be opened from
 * the Tray or from a tile: opening it on the board scatters the contents around
 * where it sat, opening it in the Tray throws them onto the grid. Either way it
 * is spent.
 *
 * Contents land **as sprites** rather than in storage, which is what makes the
 * burst physical — things fly out and you scramble to see what you got — and it
 * is also what lets a player grab the two Tokens they want and put them
 * straight down, with the rest tidying itself away (UI §6).
 *
 * ⚠️ **The spectacle rests on presentation, not volume** (D-167). Four items
 * cannot carry the game's headline reward beat on quantity; it has to come from
 * how it looks and how often it happens. **If a burst reads as flat in testing,
 * the lever is presentation first and volume second.**
 *
 * @param {object} instance the Map Token being spent
 * @param {number|null} origin the tile it sat on, or null when opened from the Tray
 */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function openMap(instance, origin = null) {
    const mapId = instance?.mapId || getTokenType(instance?.typeId)?.mapId || (instance?.typeId?.startsWith('token_map') ? instance.typeId.replace('token_', '') : null) || 'map_test_map';
    const def = getMap(mapId) || getMap('map_test_map');
    if (!def) return refuse('That is not a Map');

    const contents = rollBurst(def.id);
    const isTray = origin === 'tray' || (typeof origin === 'object' && origin?.inTray);
    const originObj = typeof origin === 'object' && origin !== null ? origin : (origin === 'tray' ? { inTray: true, x: 0.5, y: 0.5 } : null);
    const scatterFrom = isTray ? (originObj || { inTray: true, x: 0.5, y: 0.5 }) : (origin == null ? centreOfBoard() : origin);
    const firstSeen = [];

    for (const entry of contents) {
        if (markDiscovered(entry.refId)) firstSeen.push(entry.refId);

        if (entry.kind === 'token') {
            if (isTray && BoardState.hasTraySpace()) {
                const tokInstance = BoardState.createTokenInstance(entry.refId, tokenStartingUses(entry.refId));
                // Scatter close to the Map in the Tray (fly less far in the tray)
                const mapX = originObj?.x ?? 0.5;
                const mapY = originObj?.y ?? 0.5;
                const angle = Math.random() * Math.PI * 2;
                const dist = 0.12 + Math.random() * 0.12;
                const tx = clamp01(mapX + Math.cos(angle) * dist);
                const ty = clamp01(mapY + Math.sin(angle) * dist);
                tokInstance.fromX = mapX;
                tokInstance.fromY = mapY;
                tokInstance.bornAt = Date.now();
                BoardState.addToTray(tokInstance, undefined, { x: tx, y: ty });
                tokInstance.fromX = mapX;
                tokInstance.fromY = mapY;
                tokInstance.bornAt = Date.now();
            } else {
                SpriteLayer.addSprite(
                    'token', entry.refId, 1, scatterFrom, tokenStartingUses(entry.refId)
                );
            }
        } else {
            SpriteLayer.addSprite('item', entry.refId, entry.quantity || 1, scatterFrom);
        }
    }

    EventBus.publish('map_opened', {
        mapId: def.id, origin: scatterFrom, count: contents.length, firstSeen, inTray: isTray
    });
    EventBus.publish('map_burst', {
        mapId: def.id, origin: scatterFrom, count: contents.length, firstSeen, inTray: isTray
    });
    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    EventBus.publish('state_changed');
    logger.info('Cartographer', `${def.name} burst: ${contents.length} things`);

    return { success: true, contents, firstSeen };
}

/**
 * Where a Tray-opened burst lands.
 *
 * The Guild Hall is the one tile guaranteed to exist and never to hold
 * anything, so it is a stable centre to throw from — the sprite layer scatters
 * outward from here on its own.
 */
function centreOfBoard() {
    return 24;
}

/** Whether a Token instance is a Map. */
export function isMap(instance) {
    return !!getTokenType(instance?.typeId)?.mapId;
}

/**
 * The catalogue, shaped for the menu: every Map, in price order, with its full
 * pool and which entries are still silhouettes.
 */
export function catalogue() {
    return listMaps().map(def => ({
        id: def.id,
        name: def.name,
        theme: def.theme,
        price: def.price,
        materials: (def.materials || []).map(m => ({
            itemId: m.itemId,
            quantity: m.quantity,
            name: getItem(m.itemId)?.name || m.itemId
        })),
        // The Token this Map becomes, so a drag can show the right art while
        // it is being carried (D-244) — the ghost draws from a `typeId`.
        tokenId: tokenForMap(def.id),
        affordability: canBuy(def.id),
        pool: def.pool.map(entry => ({
            kind: entry.kind,
            refId: entry.refId,
            quantity: entry.quantity || 1,
            known: isDiscovered(entry.refId),
            name: entry.kind === 'token'
                ? tokenName(entry.refId)
                : (getItem(entry.refId)?.name || entry.refId)
        }))
    }));
}

export function init() {
    logger.info('Cartographer', 'Map catalogue ready');
}
