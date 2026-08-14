// Fantasy Guild — Loot sprites (7×7 Playmat rework, Phase 3)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { SettingsManager } from '../core/SettingsManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { BOARD_PX, TILE_PX, rowOf, colOf } from '../../ui/components/board/boardConstants.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import { logger } from '../../utils/Logger.js';

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

/** The live sprite list, created if a save predates it. */
function sprites() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.board) state.board = { tiles: {}, tokenBank: {}, tray: [], sprites: [] };
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
function scatterFrom(sourceTile) {
    if (sourceTile == null) {
        const x = clamp(Math.random() * BOARD_PX);
        const y = clamp(Math.random() * BOARD_PX);
        return { x, y, fromX: x, fromY: y };
    }
    const cx = colOf(sourceTile) * TILE_PX + TILE_PX / 2;
    const cy = rowOf(sourceTile) * TILE_PX + TILE_PX / 2;
    const angle = Math.random() * Math.PI * 2;
    const distance = TILE_PX * (1 + Math.random());
    return {
        x: clamp(cx + Math.cos(angle) * distance),
        y: clamp(cy + Math.sin(angle) * distance),
        fromX: cx,
        fromY: cy
    };
}

let idCounter = 0;
const nextId = () => `sprite_${Date.now().toString(36)}_${++idCounter}`;

/**
 * Drop a sprite onto the board.
 *
 * Same-type sprites **merge into counted stacks** once the newest is past its
 * grace window, so a producing board does not fill with individual icons. The
 * window is what lets a single burst scatter visibly before it tidies itself up.
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

    // Tokens never merge: each carries its own remaining charges, and summing
    // two half-spent Forests into "2 Forests" would quietly invent or destroy
    // uses. Consolidation of partials is the Token Bank's job (D-77).
    if (kind === 'item') {
        ItemRateTracker.recordGain(refId, quantity);
        const now = Date.now();
        const existing = list.find(s =>
            s.kind === 'item' && s.refId === refId && (now - s.bornAt) > MERGE_GRACE_MS
        );
        if (existing) {
            existing.quantity += quantity;
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            return existing;
        }
    }

    const { x, y, fromX, fromY } = scatterFrom(sourceTile);
    const sprite = {
        id: nextId(),
        kind,
        refId,
        quantity,
        x,
        y,
        // Where it flew from, so the view can draw the arc (D-235). Persisted
        // with the sprite, which is harmless: the view replays the flight only
        // for sprites born in the last second, so a loaded board does not throw
        // its whole floor across the grid again.
        fromX,
        fromY,
        usesRemaining: kind === 'token' ? usesRemaining : null,
        bornAt: Date.now()
    };
    list.push(sprite);
    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, { spriteId: sprite.id });
    return sprite;
}

/** Remove a sprite by id, returning it. */
function takeSprite(id) {
    const list = sprites();
    if (!list) return null;
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;
    return list.splice(index, 1)[0];
}

/**
 * Tell the UI a sprite was actually taken, and from where (D-236).
 *
 * Position travels with the event because the sprite is gone by the time
 * anything can look it up — the particle has to know where it flew from, and
 * `x`/`y` are board coordinates the overlay converts to the screen.
 */
function announceCollected(sprite) {
    EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
        kind: sprite.kind,
        refId: sprite.refId,
        quantity: sprite.quantity,
        x: sprite.x,
        y: sprite.y
    });
}

/**
 * Collect one sprite into storage, routing **by kind**: items go to the Bank,
 * Tokens to the Token Vault (D-232, reversing D-158's Tray destination).
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
        if (sprite.kind === 'item') {
            const added = InventoryManager.addItem(sprite.refId, sprite.quantity);
            if (added <= 0) return false;               // Bank full — it stays put
            if (added < sprite.quantity) {
                sprite.quantity -= added;               // partial fit, remainder waits
                EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
                return false;
            }
            takeSprite(id);
            announceCollected(sprite);
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            return true;
        }

        // Tokens cascade: **Token Bank → Tray → stay on the board** (D-232).
        //
        // ⚠️ This order is the reverse of D-158, deliberately (owner decision
        // 2026-08-07). D-158 sent Tokens to the Tray "because Tokens are for
        // placing", which meant every burst filled the rack with things the
        // player had not chosen. Collected Tokens now go to storage, and the
        // Tray holds only what was put there on purpose — you still grab the two
        // you want straight off the floor with one drag, which was D-158's
        // actual headline flow.
        //
        // **Maps need no special case here.** `TokenBank.deposit` refuses
        // anything with a `mapId` (D-156 — a Map is a thing you are about to
        // open, not a thing you keep), so a Map falls through to the Tray on its
        // own, which is the only place it may live.
        const instance = BoardState.createTokenInstance(sprite.refId, sprite.usesRemaining);
        if (TokenBank.deposit(instance) || BoardState.addToTray(instance)) {
            takeSprite(id);
            announceCollected(sprite);
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
    if (list.length > cap) {
        const excess = [...list].sort((a, b) => a.bornAt - b.bornAt).slice(0, list.length - cap);
        for (const sprite of excess) collectSprite(sprite.id);
    }

    if (!SettingsManager.get('gameplay.autoCollectLoot')) return;
    autoCollectTimer += deltaMs;
    const delay = SettingsManager.get('gameplay.autoCollectDelayMs') ?? 2500;
    if (autoCollectTimer < delay) return;
    autoCollectTimer = 0;

    const now = Date.now();
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
