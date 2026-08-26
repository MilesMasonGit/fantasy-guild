// Fantasy Guild — Loot sprites (7×7 Playmat rework, Phase 3)

import { GameState } from '../../state/GameState.js';
import { createEmptyBoard } from '../../state/StateSchema.js';
import { EventBus } from '../core/EventBus.js';
import { SettingsManager } from '../core/SettingsManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { BOARD_PX, TILE_PX, TILE_STEP_PX, rowOf, colOf } from '../../config/boardGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import { QuestManager } from '../quests/QuestManager.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';

/**
 * SpriteLayer — loose loot **floating above the grid** (D-40).
 *
 * Sprites occupy no tile and are not banked until collected. They are the
 * board's answer to three separate problems, which is why they are built before
 * anything produces:
 *
 *  1. **Loot presentation.** Items pop out on an arc and settle 1–2 tiles from
 *     their source (UI §6).
 *  2. **Map bursts** (D-142) and **crafted Tokens** (D-148) both arrive this
 *     way — the burst is the game's headline reward beat, and it is literally
 *     this layer.
 *  3. ⚠️ **Overflow storage** (D-138). **Nothing is ever lost to a full Bank.**
 *     When there is no slot, the item or Token stays on the board until the
 *     player makes room — so a full Bank announces itself *visibly*, as litter
 *     piling up across the grid, rather than through an error message. This is
 *     what protects a one-copy-ever Mythic.
 *
 * ## Sprites are PERSISTED, unlike every other piece of board runtime state
 * Cycle timers are deliberately not saved (D-54 forfeits them anyway). Sprites
 * are the exception: a Mythic sitting on the floor because the Token Bank was
 * full cannot evaporate on reload. That would be exactly the loss D-138 exists
 * to prevent, arriving by a different route.
 *
 * ## Collection confers no mechanical advantage (D-41, D-88)
 * Manual and automatic pickup are **identical in outcome**. The mechanic exists
 * for feel, and a player who turns auto-collect off is not choosing a harder
 * game — they are choosing to click. Nothing here may ever pay a bonus for
 * collecting by hand.
 */

/** Same-type sprites merge into counted stacks after this long (UI §6). */
const MERGE_GRACE_MS = 900;

/** Guards the collect → bank → overflow → collect loop. */
let collecting = false;

let autoCollectTimer = 0;
let initialized = false;

/**
 * The live sprite list, created if a save predates it.
 *
 * ⚠️ Creating the board here used to invent its own shape — one that dropped
 * `maps`, `heroTiles` and `vacancies` (CR2-049). It now builds the same board
 * everything else does.
 */
function sprites() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.board) state.board = createEmptyBoard();
    if (!Array.isArray(state.board.sprites)) state.board.sprites = [];
    return state.board.sprites;
}

/** Every sprite currently on the board. */
export function getSprites() {
    return sprites() || [];
}

/** Clamp a position to the board so nothing lands off the edge. */
const clamp = (v) => Math.max(TILE_PX * 0.25, Math.min(BOARD_PX - TILE_PX * 0.25, v));

/**
 * Where a sprite lands: 1–2 tiles from its source, in a random direction
 * (UI §6). A source of `null` scatters anywhere — that is the overflow case,
 * which has no originating tile.
 *
 * Also returns **where it came from** (`fromX`/`fromY`), which is what makes the
 * arc possible (D-235). The docs claimed for a long time that items "pop out on
 * an arc and settle 1–2 tiles from their source" — the landing was always right
 * and **the travel never existed**: loot simply materialised at its destination.
 * The origin was computed here and then thrown away.
 *
 * For the overflow case there is genuinely nowhere to fly *from*, so origin and
 * landing are the same point and the sprite appears in place.
 */
/** Max distance (in px) between source token and an existing stack for them to merge (~2 tiles). */
const MAX_STACK_MERGE_DISTANCE_PX = 2.25 * TILE_STEP_PX;

/** Extract center (x, y) coordinates from a source tile descriptor. */
function getSourcePosition(sourceTile) {
    if (sourceTile == null) return null;
    if (typeof sourceTile === 'object' && sourceTile !== null && sourceTile.inTray) {
        return {
            x: BOARD_PX + 30,
            y: clamp((sourceTile.y != null ? sourceTile.y : 0.5) * BOARD_PX)
        };
    }
    if (typeof sourceTile === 'object' && sourceTile !== null && typeof sourceTile.x === 'number' && typeof sourceTile.y === 'number') {
        return {
            x: sourceTile.x + (sourceTile.width != null ? sourceTile.width / 2 : TILE_PX / 2),
            y: sourceTile.y + (sourceTile.height != null ? sourceTile.height / 2 : TILE_PX / 2)
        };
    }
    if (typeof sourceTile === 'number') {
        return {
            x: colOf(sourceTile) * TILE_STEP_PX + TILE_PX / 2,
            y: rowOf(sourceTile) * TILE_STEP_PX + TILE_PX / 2
        };
    }
    return null;
}

/**
 * Where a sprite lands: within a tile's distance from its source, in a random direction.
 * A source of `null` scatters anywhere — that is the overflow case.
 *
 * If `existingTarget` is provided, lands in close proximity (~24-48px) to that stack.
 */
function scatterFrom(sourceTile, kind = 'item', existingTarget = null) {
    const sourcePos = getSourcePosition(sourceTile);

    if (existingTarget) {
        const fx = sourcePos ? sourcePos.x : existingTarget.x;
        const fy = sourcePos ? sourcePos.y : existingTarget.y;
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDistance = 24 + Math.random() * 24;
        return {
            x: clamp(existingTarget.x + Math.cos(offsetAngle) * offsetDistance),
            y: clamp(existingTarget.y + Math.sin(offsetAngle) * offsetDistance),
            fromX: fx,
            fromY: fy
        };
    }

    if (!sourcePos) {
        const x = clamp(Math.random() * BOARD_PX);
        const y = clamp(Math.random() * BOARD_PX);
        return { x, y, fromX: x, fromY: y };
    }

    if (typeof sourceTile === 'object' && sourceTile !== null && sourceTile.inTray) {
        const fromX = sourcePos.x;
        const fromY = sourcePos.y;
        const distance = TILE_PX * (kind === 'item' ? (0.4 + 0.3 * Math.random()) : (0.5 + 0.3 * Math.random()));
        const angle = Math.PI + (Math.random() - 0.5) * 1.1; // westward onto the board
        return {
            x: clamp(fromX + Math.cos(angle) * distance),
            y: clamp(fromY + Math.sin(angle) * distance),
            fromX,
            fromY
        };
    }

    const angle = Math.random() * Math.PI * 2;
    // Items land within a tile's distance of the output token (0.4 - 0.85 TILE_PX)
    const distance = kind === 'token'
        ? TILE_PX * (0.5 + 0.3 * Math.random())
        : TILE_PX * (0.4 + 0.45 * Math.random());

    return {
        x: clamp(sourcePos.x + Math.cos(angle) * distance),
        y: clamp(sourcePos.y + Math.sin(angle) * distance),
        fromX: sourcePos.x,
        fromY: sourcePos.y
    };
}

let idCounter = 0;
const nextId = () => `sprite_${Date.now().toString(36)}_${++idCounter}`;
const absorptionTimers = new Map();

/**
 * Absorb a lingering sprite into its parent stack.
 *
 * @param {string} spriteId
 */
export function absorbSprite(spriteId) {
    const list = sprites();
    if (!list) return;
    const index = list.findIndex(s => s.id === spriteId);
    if (index === -1) return;
    const sprite = list[index];
    if (!sprite.targetStackId) return;

    const parent = list.find(s => s.id === sprite.targetStackId);
    if (parent) {
        parent.quantity += sprite.quantity;
        list.splice(index, 1);
        EventBus.publish(BOARD_EVENTS.SPRITE_ABSORBED, {
            parentId: parent.id,
            absorbedId: sprite.id,
            quantity: sprite.quantity
        });
        EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    } else {
        delete sprite.targetStackId;
        delete sprite.absorbAt;
        EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    }
}

function scheduleAbsorption(spriteId, delayMs) {
    if (typeof window === 'undefined') return;
    if (absorptionTimers.has(spriteId)) {
        clearTimeout(absorptionTimers.get(spriteId));
    }
    const timer = setTimeout(() => {
        absorptionTimers.delete(spriteId);
        absorbSprite(spriteId);
    }, delayMs);
    absorptionTimers.set(spriteId, timer);
}

/**
 * Drop a sprite onto the board.
 *
 * Same-type sprites within ~2 tiles merge into nearby stacks after lingering
 * for ~800ms and smoothly sliding in over 300ms. Tokens further away establish
 * their own separate stacks.
 *
 * @param {'item'|'token'} kind
 * @param {string} refId       item id or Token type id
 * @param {number} quantity
 * @param {number|null} sourceTile  tile it came from, or null for overflow
 * @param {number|null} usesRemaining  Tokens only; null means unlimited (D-176)
 */
export function addSprite(kind, refId, quantity = 1, sourceTile = null, usesRemaining = null) {
    const list = sprites();
    if (!list || !refId || quantity <= 0) return null;

    // CR2-108c / CR2-063. The sprite is still created — a nameless thing on the
    // board is better than loot silently evaporating, and the owner's ruling is
    // warn-only. But an id nothing answers to draws no artwork and no name, so
    // it reads as a glitch rather than as content that needs re-pointing.
    if (kind === 'item' && !getItem(refId)) {
        warnMissingContent('SpriteLayer', 'item', refId,
            'the loot that just dropped has no name or artwork to show');
    } else if (kind === 'token' && !getTokenType(refId)) {
        warnMissingContent('SpriteLayer', 'Token', refId,
            'the Token that just appeared on the board has no name or artwork to show');
    }

    let targetExisting = null;
    if (kind === 'item') {
        ItemRateTracker.recordGain(refId, quantity);
        const sourcePos = getSourcePosition(sourceTile);

        // Find primary stacks of the same item
        const candidates = list.filter(s =>
            s.kind === 'item' && s.refId === refId && !s.targetStackId
        );

        if (candidates.length > 0) {
            if (sourcePos) {
                // Find closest candidate within MAX_STACK_MERGE_DISTANCE_PX (2 tiles)
                let closest = null;
                let closestDist = Infinity;
                for (const cand of candidates) {
                    const dist = Math.hypot(cand.x - sourcePos.x, cand.y - sourcePos.y);
                    if (dist <= MAX_STACK_MERGE_DISTANCE_PX && dist < closestDist) {
                        closest = cand;
                        closestDist = dist;
                    }
                }
                targetExisting = closest;
            } else {
                targetExisting = candidates[0];
            }
        }
    }

    const { x, y, fromX, fromY } = scatterFrom(sourceTile, kind, targetExisting);
    const sprite = {
        id: nextId(),
        kind,
        refId,
        quantity,
        x,
        y,
        fromX,
        fromY,
        targetStackId: targetExisting ? targetExisting.id : null,
        absorbAt: targetExisting ? Date.now() + 1100 : null,
        usesRemaining: kind === 'token' ? usesRemaining : null,
        bornAt: Date.now()
    };
    list.push(sprite);

    if (targetExisting) {
        scheduleAbsorption(sprite.id, 1100);
    }

    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, { spriteId: sprite.id });
    return sprite;
}

/** Remove a sprite by id, returning it. */
function takeSprite(id) {
    const list = sprites();
    if (!list) return null;
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;

    if (absorptionTimers.has(id)) {
        clearTimeout(absorptionTimers.get(id));
        absorptionTimers.delete(id);
    }

    // If taking a parent stack, any child targeting it becomes independent
    for (const s of list) {
        if (s.targetStackId === id) {
            delete s.targetStackId;
            delete s.absorbAt;
        }
    }

    return list.splice(index, 1)[0];
}

/**
 * Tell the UI a sprite was actually taken, and from where (D-236).
 *
 * Position travels with the event because the sprite is gone by the time
 * anything can look it up — the particle has to know where it flew from, and
 * `x`/`y` are board coordinates the overlay converts to the screen.
 */
function announceCollected(sprite, destination = null, extra = {}) {
    EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
        kind: sprite.kind,
        refId: sprite.refId,
        quantity: sprite.quantity,
        x: sprite.x,
        y: sprite.y,
        destination,
        ...extra
    });
}

/**
 * Collect one sprite into storage, routing **by kind**: items go to the Bank,
 * Tokens to the Tray first (for immediate play) and then the Token Vault.
 *
 * ⚠️ **Collection can fail, and failing is not an error.** Auto-collect cannot
 * collect into a full Bank, so a player running at zero visible stacks will
 * still see sprites pile up once they hit their slot cap. That accumulation *is*
 * the signal (grid concept §3.4) — leave the sprite where it is.
 *
 * @returns {boolean} whether it was taken off the board
 */
export function collectSprite(id) {
    const sprite = getSprites().find(s => s.id === id);
    if (!sprite) return false;

    collecting = true;
    try {
        if (sprite.kind === 'item' || sprite.kind === 'gold' || sprite.kind === 'currency') {
            if (sprite.refId === 'item_coins' || sprite.refId === 'item_coin' || sprite.refId === 'coins' || sprite.refId === 'coin' || sprite.kind === 'gold' || sprite.kind === 'currency') {
                CurrencyManager.addGold(sprite.quantity || 1, 'loot_collection');
                takeSprite(id);
                announceCollected(sprite, 'bank');
                NotificationSystem.success(`Collected ${(sprite.quantity || 1).toLocaleString()} Gold!`);
                EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
                return true;
            }

            const added = InventoryManager.addItem(sprite.refId, sprite.quantity);
            if (added <= 0) return false;               // Bank full — it stays put
            if (added < sprite.quantity) {
                sprite.quantity -= added;               // partial fit, remainder waits
                EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
                return false;
            }
            takeSprite(id);
            announceCollected(sprite, 'bank');
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            return true;
        }

        // Tokens cascade: **Tray → Token Vault → stay on the board**.
        // Sending to Tray first allows newly collected tokens to be played immediately.
        // If Tray is full, falls through to TokenBank (Vault).
        const instance = BoardState.createTokenInstance(sprite.refId, sprite.usesRemaining);
        instance.isLanding = true;
        if (BoardState.addToTray(instance)) {
            takeSprite(id);
            announceCollected(sprite, 'tray', {
                trayX: instance.x,
                trayY: instance.y,
                instanceId: instance.id
            });
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            return true;
        }
        if (TokenBank.deposit(instance)) {
            takeSprite(id);
            announceCollected(sprite, 'vault');
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            return true;
        }
        return false;   // both full — nothing is lost, it waits
    } finally {
        collecting = false;
        EventBus.publish('state_changed');
    }
}

/**
 * Direct right-click gesture: send a loose floor Token straight to the Token Vault.
 * Triggers the particle fly animation to the Vault icon/drawer.
 */
export function sendTokenToVault(id) {
    const sprite = getSprites().find(s => s.id === id);
    if (!sprite || sprite.kind !== 'token') return false;

    if (!QuestManager.isTokenVaultSendUnlocked()) {
        NotificationSystem.warning('Token Vault storage unlocks after completing "Place a Dropped Token".');
        return false;
    }

    if (getTokenType(sprite.refId)?.mapId) {
        NotificationSystem.warning('Maps cannot be stored — open it.');
        return false;
    }

    const instance = BoardState.createTokenInstance(sprite.refId, sprite.usesRemaining);
    if (!TokenBank.deposit(instance)) {
        NotificationSystem.warning('No room in the Vault');
        return false;
    }

    takeSprite(id);
    announceCollected(sprite, 'vault', { instanceId: instance.id });
    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    EventBus.publish('state_changed');
    return true;
}

/**
 * Collect everything that will fit. Whatever does not fit stays put.
 *
 * @returns {number} how many sprites were taken
 */
export function collectAll() {
    let taken = 0;
    for (const sprite of [...getSprites()]) {
        if (collectSprite(sprite.id)) taken++;
    }
    return taken;
}

/**
 * Take a Token sprite off the board as a placeable instance, without banking it.
 *
 * This is the grab-and-place path (UI §6): click and drag a Token sprite
 * **straight onto a tile**, with no trip through Bank or Tray. It is what makes
 * opening a Map flow directly into building — burst, grab the two things you
 * want, put them down, let the rest tidy itself away.
 */
export function takeTokenSprite(id) {
    const sprite = getSprites().find(s => s.id === id && s.kind === 'token');
    if (!sprite) return null;
    takeSprite(id);
    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    EventBus.publish('state_changed');
    return BoardState.createTokenInstance(sprite.refId, sprite.usesRemaining);
}

/**
 * Pull items off the floor to feed a Token (D-42).
 *
 * **Loot on the ground never starves a chain.** If the Bank lacks an item a
 * Token needs, any matching sprite is consumed first — otherwise a player whose
 * Bank is full would watch their board deadlock while the missing ingredient sat
 * three tiles away.
 *
 * @returns {number} how many units were actually taken
 */
export function consumeFromSprites(itemId, amount) {
    let remaining = amount;
    for (const sprite of [...getSprites()]) {
        if (remaining <= 0) break;
        if (sprite.kind !== 'item' || sprite.refId !== itemId) continue;

        const take = Math.min(sprite.quantity, remaining);
        sprite.quantity -= take;
        remaining -= take;
        if (sprite.quantity <= 0) takeSprite(sprite.id);
    }
    const taken = amount - remaining;
    if (taken > 0) {
        EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
        EventBus.publish('state_changed');
    }
    return taken;
}

/** How many units of an item are lying on the board. */
export function countOnBoard(itemId) {
    return getSprites()
        .filter(s => s.kind === 'item' && s.refId === itemId)
        .reduce((n, s) => n + s.quantity, 0);
}

/**
 * The auto-collect clock (D-41).
 *
 * Two independent behaviours share it:
 *  - **Auto-collect**, if enabled, sweeps sprites into storage on a delay.
 *  - **The stack cap** collects the OLDEST first once visible stacks exceed
 *    `maxItemStacks`, so a producing board cannot bury itself. Setting the cap
 *    to 0 disables the visual mechanic entirely — everything goes straight to
 *    storage.
 *
 * The cap runs whether or not auto-collect is on: it is a rendering guard, not
 * a convenience.
 */
export function tick(deltaMs) {
    const list = sprites();
    if (!list?.length) return;

    const cap = SettingsManager.get('gameplay.maxItemStacks') ?? 40;
    if (cap === 0) {
        collectAll();
        return;
    }
    const now = Date.now();
    for (const sprite of [...list]) {
        if (sprite.targetStackId && sprite.absorbAt && now >= sprite.absorbAt) {
            absorbSprite(sprite.id);
        }
    }

    if (list.length > cap) {
        const excess = [...list].sort((a, b) => a.bornAt - b.bornAt).slice(0, list.length - cap);
        for (const sprite of excess) collectSprite(sprite.id);
    }

    if (!SettingsManager.get('gameplay.autoCollectLoot')) return;
    autoCollectTimer += deltaMs;
    const delay = SettingsManager.get('gameplay.autoCollectDelayMs') ?? 2500;
    if (autoCollectTimer < delay) return;
    autoCollectTimer = 0;

    for (const sprite of [...list]) {
        if (now - sprite.bornAt >= delay) collectSprite(sprite.id);
    }
}

/**
 * Wire the D-138 guarantee.
 *
 * `InventoryManager` publishes `inventory_overflow` rather than importing this
 * module — the two would otherwise import each other. That also means the
 * guarantee is **one subscriber away from being silently untrue**, so this
 * subscription is the thing to check first if items ever start disappearing.
 */
export function init() {
    // Idempotent. Subscribing twice would create TWO sprites per overflow, so
    // the pile would double every time anything re-initialised — and because
    // each sprite is individually valid, it would read as an economy bug rather
    // than a wiring one.
    if (initialized) return;
    initialized = true;

    EventBus.subscribe('inventory_overflow', ({ itemId, amount }) => {
        // Ignore overflow raised by our own collect attempt: the sprite is
        // already on the board and re-adding it would duplicate it every sweep.
        if (collecting) return;
        addSprite('item', itemId, amount, null);
        logger.debug('SpriteLayer', `Bank full — ${amount}× ${itemId} stays on the board (D-138)`);
    });
    logger.info('SpriteLayer', 'Loot sprite layer ready');
}
