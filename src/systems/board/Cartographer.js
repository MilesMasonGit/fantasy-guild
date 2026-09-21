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
import { matW, matH } from '../../config/matGeometry.js';
import { terrainForMap } from '../../config/registries/terrainAssignments.js';
import { TERRAIN_ENABLED } from '../../config/registries/terrainRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import * as MatPlacement from './MatPlacement.js';
import * as TileModifiers from './TileModifiers.js';
import { logger } from '../../utils/Logger.js';

/**
 * The Cartographer — progression, and the game's **headline reward beat**.
 *
 * This is the replacement for the pack/booster economy. `CollectionManager` and
 * `PackOpeningOverlay` were the old machinery and were deleted in Phase 1; git
 * history is the reference, and deliberately only for the *plumbing*. The
 * mechanic is not the same: packs were per-area escalating price with a
 * pick-1-of-N; Maps are **a flat price that never rises, with a burst where all
 * of it is yours**.
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
 * a task** — the player clicks it and it bursts. This strikes D-37's
 * "Maps are worked by a hero on a timer" outright.
 *
 * ⚠️ **A single click bursts a Map, in the Tray and on the board alike** —
 * owner ruling 2026-08-24, which supersedes the earlier double-click wording of
 * D-142 and decision 19 of `code_review_v2_findings.md` (CR2-158). Both
 * surfaces also still accept a double-click, since the first click of one
 * already bursts.
 */

/**
 * A burst is **always exactly this many things** (CMS-129), and slot one is
 * always a Token — see {@link rollBurst}.
 *
 * **Supersedes D-167's range.** The old rule was a random count; the constants
 * here were `BURST_MIN = 3` / `BURST_MAX = 5` and their comment claimed "3–6",
 * which was never true of the code. A fixed three with a guaranteed Token is
 * the ruling: a dud burst of raw items strands a player who cannot restock.
 *
 * Exported because P7's CMS Map check **will** read it live rather than
 * hardcoding 3 — **do not inline this as a literal.** ⚠️ That check is not
 * built yet; this export exists ahead of it.
 */
export const BURST_SIZE = 3;

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

    // Maps are placed on the board directly beside the Guild Hall, so they don't
    // require Tray space anymore. The 50-Map cap above is the only limit.

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

    // Maps are dropped onto the playmat (beside the Guild Hall).
    const center = centreOfBoard();
    const mapX = center.x + (Math.random() - 0.5) * 100;
    const mapY = center.y + (Math.random() - 0.5) * 100;

    const instance = BoardState.addBoardMap(typeId, mapX, mapY, tokenStartingUses(typeId), {
        bornAt: Date.now(),
        fromX: -1,
        fromY: mapY
    });

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

/**
 * One weighted draw from a Map's pool, or from a subset of it.
 *
 * `entries` narrows the draw without changing the arithmetic: the total is
 * recomputed over whatever list is handed in, so **the weights renormalise
 * themselves** among that subset and relative odds inside it are preserved.
 * That is how CMS-129's Token-only first slot works — one draw algorithm, one
 * filtered list, no second copy of the loop.
 */
function rollOne(def, entries = def.pool) {
    if (!entries?.length) return null;
    const total = entries.reduce((sum, e) => sum + (e.weight || 0), 0);
    if (total <= 0) return null;

    let roll = Math.random() * total;
    for (const entry of entries) {
        roll -= entry.weight || 0;
        if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
}

/**
 * Roll a burst's contents. Exposed for tests; `openMap` is the real entry point.
 *
 * **Exactly three things, and slot one is always a Token** (CMS-129, which
 * supersedes D-167's random range). Slot one draws over the pool's
 * `kind === 'token'` entries only, with their weights renormalised among
 * themselves; slots two and three are free weighted draws over the whole pool,
 * so they can be items or gold. A pool with no Token entries falls back to
 * three free draws — P7's CMS Map check will warn about such a pool; this
 * does not, and no such check exists yet.
 *
 * **Still random, and still no reliability guarantee** (D-154). The guarantee
 * is *a* Token, not *the* Token: a Woodland Map can hand you a Bear, a Tool
 * Rack and a pile of Oak Wood, and never the Forest you came for. That is a
 * genuine accepted cost, and its two mitigations both arrive elsewhere —
 * unwanted Tokens sell (D-146, built in Phase 7) and support Tokens become
 * craftable (D-144, later) — so **the exposure is the first hour** (risk 16).
 */
export function rollBurst(mapId) {
    const def = getMap(mapId);
    if (!def?.pool?.length) return [];

    // Guild Hall tutorial maps drop from the scripted sequence regardless of open order
    //
    // ⚠️ **Exempt from CMS-129 by owner ruling 24.** CMS-129 governs weighted
    // pool bursts; this branch is a fixed ten-step tutorial of single drops and
    // keeps its authored pacing. **Do not "fix" it to three** — the one-at-a-
    // time reveal is the point, and P7's CMS Map check will skip guild-hall
    // maps (that check is not built yet).
    //
    // (The `def.theme === 'guild_hall'` test that used to lead this line was
    // dropped 2026-08-24, CR2-125: `theme` is a retired concept and the two id
    // checks below already catch every Guild Hall alias.)
    if (def.id === 'map_guild_hall' || (typeof mapId === 'string' && mapId.startsWith('map_guild_hall'))) {
        const state = GameState.state;
        if (!state) return [...GUILD_HALL_DROP_SEQUENCE[0]];
        if (!state.progress) state.progress = {};
        const openCount = state.progress.guildHallMapOpens || 0;
        state.progress.guildHallMapOpens = openCount + 1;

        const dropIndex = Math.min(openCount, GUILD_HALL_DROP_SEQUENCE.length - 1);
        return [...GUILD_HALL_DROP_SEQUENCE[dropIndex]];
    }

    const out = [];

    // Slot one: Tokens only, renormalised among themselves (CMS-129). Gold and
    // raw items can never satisfy the guarantee — the point of the ruling is
    // that a real Token advances the supply line, so this filters on
    // `kind === 'token'` specifically, not "anything that isn't gold".
    //
    // ⚠️ **The guarantee is not absolute, and cannot be.** A Token entry
    // authored at `weight: 0` is undrawable by definition, so a pool whose
    // Tokens all carry zero weight degrades to three free draws exactly as a
    // token-less pool does — three things, no Token. There is no fix at this
    // level: an undrawable entry is a content mistake, and warning about it is
    // P7's Map check's job. The count never suffers; only the guarantee does.
    const tokenEntries = def.pool.filter(e => e.kind === 'token');
    const first = rollOne(def, tokenEntries.length ? tokenEntries : def.pool);
    if (first) out.push(first);

    // Slots two and three: free weighted draws over the whole pool, as before.
    while (out.length < BURST_SIZE) {
        const entry = rollOne(def);
        if (!entry) break; // a pool whose weights all total zero — cannot draw
        out.push(entry);
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
 * ⚠️ **The spectacle rests on presentation, not volume** (D-167). Three things
 * cannot carry the game's headline reward beat on quantity; it has to come from
 * how it looks and how often it happens. **If a burst reads as flat in testing,
 * the lever is presentation first and volume second.** D-167's *count* was
 * superseded by CMS-129 (exactly three, Token-led); this presentation half was
 * not, and stands.
 *
 * @param {object} instance the Map Token being spent
 * @param {string|object|null} origin where it burst from — `'tray'` or a Tray
 *        origin, a Map box on the mat, a Token instance id, or null (the Guild Hall)
 */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function openMap(instance, origin = null) {
    const mapId = instance?.mapId || getTokenType(instance?.typeId)?.mapId || (instance?.typeId === 'token_guild_hall_map' ? 'map_guild_hall' : null) || (instance?.typeId?.startsWith('token_map') ? instance.typeId.replace('token_', '') : null) || 'map_test_map';
    const def = getMap(mapId) || getMap('map_guild_hall') || getMap('map_test_map');
    if (!def) return refuse('That is not a Map');

    const contents = rollBurst(def.id);
    // The Map's terrain, stamped onto everything it produces (D-T6). It has to
    // be applied here, at the moment of birth, because it cannot be recovered
    // afterwards: only 25 of the 75 Tokens appear in a pool at all, and six of
    // those appear in two, so "which Map did this come from" has no answer once
    // the Token exists. See `terrainAssignments.js`.
    // Dormant while terrain is off (FP-10): nothing is stamped.
    const stamp = TERRAIN_ENABLED ? terrainForMap(def.id) : null;
    const isTray = origin === 'tray' || (typeof origin === 'object' && origin?.inTray);
    const originObj = typeof origin === 'object' && origin !== null ? origin : (origin === 'tray' ? { inTray: true, x: 0.5, y: 0.5 } : null);
    // A Map on the mat bursts from its box, a Map Token by its instance id from
    // its centre (slice 1.6b), and one with no origin from the Guild Hall.
    const scatterFrom = isTray ? (originObj || { inTray: true, x: 0.5, y: 0.5 }) : (origin == null ? { centre: centreOfBoard() } : origin);
    const firstSeen = [];

    for (const entry of contents) {
        if (entry.refId && markDiscovered(entry.refId)) firstSeen.push(entry.refId);

        if (entry.kind === 'token') {
            // Map bursts scatter their contents directly onto the mat as fully functioning Tokens.
            const spawnPoint = scatterFrom.centre || { x: scatterFrom.x || matW()/2, y: scatterFrom.y || matH()/2 };
            // Add a little randomness so multiple tokens don't land exactly on each other before pushing
            const landingX = spawnPoint.x + (Math.random() - 0.5) * 40;
            const landingY = spawnPoint.y + (Math.random() - 0.5) * 40;
            
            // Use forceSpot to resolve placement, cascading push neighbors
            const where = MatPlacement.forceSpot(entry.refId, { x: landingX, y: landingY });
            
            if (where) {
                // Apply pushes
                const dirty = [];
                if (where.pushed && where.pushed.length > 0) {
                    for (const p of where.pushed) {
                        const tok = BoardState.getTokenById(p.id);
                        if (tok) {
                            dirty.push({ x: tok.x, y: tok.y });
                            BoardState.setTokenPoint(p.id, p.x, p.y);
                            dirty.push({ x: p.x, y: p.y });
                        }
                    }
                }

                const tokInstance = BoardState.createTokenInstance(entry.refId, tokenStartingUses(entry.refId), stamp);
                tokInstance.bornAt = Date.now();
                tokInstance.fromX = spawnPoint.x;
                tokInstance.fromY = spawnPoint.y;
                
                BoardState.addToken(tokInstance, where.x, where.y);
                EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: tokInstance.id, typeId: entry.refId });
                EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: tokInstance.id, typeId: entry.refId });
                
                dirty.push({ x: where.x, y: where.y });
                TileModifiers.rebuildAround(dirty);
            }
        } else if (entry.kind === 'gold' || entry.kind === 'currency') {
            const amount = entry.amount || entry.quantity || 2000;
            CurrencyManager.addGold(amount, 'map_reward');
            NotificationSystem.success(`Gained ${amount.toLocaleString()} Gold!`);
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
 * Where a burst with no origin is thrown from, as a mat point.
 *
 * The **Guild Hall's point**: it is the one Token guaranteed to be on the mat,
 * so it is a stable centre to throw from — the sprite layer scatters outward
 * from here on its own. With no Hall (a hand-built test board) it is the mat's
 * centre.
 *
 * ⚠️ This used to return `24`, a tile index left over from the 7×7 board — on
 * the 6×6 board that was a tile in the bottom-right corner, not the Hall.
 *
 * The mat's centre is (matW() / 2, matH() / 2) since slice 1.6c — read live, as
 * the mat can be resized while the game runs (slice 1.6d-3).
 */
export function centreOfBoard() {
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    if (hall && Number.isFinite(hall.x) && Number.isFinite(hall.y)) return { x: hall.x, y: hall.y };
    return { x: matW() / 2, y: matH() / 2 };
}

/** Whether a Token instance is a Map. */
export function isMap(instance) {
    return !!getTokenType(instance?.typeId)?.mapId;
}

/**
 * A Map's required materials, shaped for display.
 *
 * The registry stores them as `{ itemId, quantity }` — an id and a number, no
 * name. Every surface that draws a material needs the resolved item name too,
 * so this is the ONE place that turns one shape into the other (CR2-196).
 *
 * `MapInspection` used to read the raw registry and hand its ribbons
 * `id={m.id}` and `key={m.id || m.name}`. Neither field exists on the raw
 * shape, so both were `undefined`: every material rendered as "Unknown", and a
 * Map needing two of them rendered two React children under the same undefined
 * key. The shop pane looked right only because it happened to read the
 * projection — its own `m.id` was undefined too.
 *
 * @param {string|object} mapIdOrDef a map id, or a map definition
 * @returns {Array<{itemId: string, quantity: number, name: string}>}
 */
export function mapMaterials(mapIdOrDef) {
    const def = typeof mapIdOrDef === 'string' ? getMap(mapIdOrDef) : mapIdOrDef;
    return (def?.materials || []).map(m => ({
        itemId: m.itemId,
        quantity: m.quantity,
        name: getItem(m.itemId)?.name || m.itemId
    }));
}

/**
 * The catalogue, shaped for the menu: every Map, in price order, with its full
 * pool and which entries are still silhouettes.
 */
export function catalogue() {
    return listMaps().map(def => ({
        id: def.id,
        name: def.name,
        price: def.price,
        materials: mapMaterials(def),
        // The Token this Map becomes, so a drag can show the right art while
        // it is being carried (D-244) — the ghost draws from a `typeId`.
        tokenId: tokenForMap(def.id),
        affordability: canBuy(def.id),
        pool: def.pool.map(entry => ({
            kind: entry.kind,
            refId: entry.refId,
            quantity: entry.quantity || entry.amount || 1,
            known: entry.refId ? isDiscovered(entry.refId) : true,
            name: entry.kind === 'token'
                ? tokenName(entry.refId)
                : (entry.kind === 'gold' || entry.kind === 'currency')
                    ? `${(entry.amount || entry.quantity || 2000).toLocaleString()} Gold`
                    : (getItem(entry.refId)?.name || entry.refId)
        }))
    }));
}

export function init() {
    logger.info('Cartographer', 'Map catalogue ready');
}
