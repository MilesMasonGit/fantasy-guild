// Fantasy Guild — Loot sprites (7×7 Playmat rework, Phase 3)

import { GameState } from '../../state/GameState.js';
import { createEmptyBoard } from '../../state/StateSchema.js';
import { EventBus } from '../core/EventBus.js';
import { SettingsManager } from '../core/SettingsManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { TOKEN_PX, MAT_STEP_U } from '../../config/matGeometry.js';
import { matW, matH } from '../../config/matGeometry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as BoardState from './BoardState.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * SpriteLayer — loose **item** loot floating above the mat (D-40).
 *
 * Sprites are not banked until collected. They answer two problems:
 *
 *  1. **Loot presentation.** Items pop out on an arc and settle beside their
 *     source (UI §6), and are collected by hovering over them (TL-9).
 *  2. ⚠️ **Overflow storage** (D-138). **Nothing is ever lost to a full Bank.**
 *     When there is no slot, the item stays on the mat until the player makes
 *     room — so a full Bank announces itself *visibly*, as litter piling up,
 *     rather than through an error message.
 *
 * ⭐ **Only items.** Map bursts (9.1) and crafted Tokens used to arrive here
 * as Token sprites bound for the Vault; since Token Lifecycle 9.3 a Token a
 * recipe makes stands on the mat beside its station (TL-8,
 * `Placement.placeProduct`) and there is no Vault. An older save's Token
 * sprites are dropped on load (`migrateState`).
 *
 * ## Sprites are PERSISTED, unlike every other piece of board runtime state
 * Cycle timers are deliberately not saved (D-54 forfeits them anyway). Sprites
 * are the exception: loot sitting on the floor because the Bank was full
 * cannot evaporate on reload. That would be exactly the loss D-138 exists to
 * prevent, arriving by a different route.
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

/**
 * Sweep batching (CR2-056, 2026-08-26).
 *
 * A sweep is **one player-visible event** — "the floor tidied itself" — not
 * forty. While `sweepDepth > 0`, `collectSprite` records that the floor
 * changed instead of announcing it, and the sweep publishes once at the end.
 *
 * ⚠️ **`board:sprite_collected` is NOT batched and must not be.** It is
 * per-sprite by design (D-236): it carries the position the particle flies
 * from, and `QuestManager` counts it. Only `state_changed` and
 * `board:sprites_changed` — both of which just mean "re-read the world" —
 * collapse here.
 *
 * Measured before this existed: one `collectAll` over 40 sprites published
 * **322 events**, of which 120 were `state_changed` and 40 `sprites_changed`.
 */
let sweepDepth = 0;
let sweepDirty = false;

/**
 * Say the sprite layer changed — now, or once at the end of the sweep.
 *
 * ⚠️ Call this **only when something actually changed.** The `state_changed`
 * publish used to sit in `collectSprite`'s `finally`, so it fired on the "Bank
 * is full, the sprite stays put" path too — and a full Bank with litter on the
 * floor is D-138's *designed* steady state. The game sat there republishing on
 * every sweep, forever, having changed nothing.
 */
function announceSpriteChange() {
    if (sweepDepth > 0) {
        sweepDirty = true;
        return;
    }
    EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
}

/**
 * Run `fn` as one sweep: every collection inside it announces once, at the end,
 * and only if something moved.
 */
function asSweep(fn) {
    sweepDepth++;
    try {
        return fn();
    } finally {
        sweepDepth--;
        if (sweepDepth === 0 && sweepDirty) {
            sweepDirty = false;
            EventBus.publish(BOARD_EVENTS.SPRITES_CHANGED, {});
            EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        }
    }
}

let autoCollectTimer = 0;
let initialized = false;

/**
 * The live sprite list, created if a save predates it.
 *
 * ⚠️ Creating the board here used to invent its own shape — one that dropped
 * `maps`, hero positions and `vacancies` (CR2-049). It now builds the same board
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

/**
 * Clamp a position to the mat so nothing lands off the edge (the mat's own size
 * since slice 1.6c). The size is read per call, because the mat can be resized
 * while the game runs (slice 1.6d-3).
 */
const clampX = (v) => Math.max(TOKEN_PX * 0.25, Math.min(matW() - TOKEN_PX * 0.25, v));
const clampY = (v) => Math.max(TOKEN_PX * 0.25, Math.min(matH() - TOKEN_PX * 0.25, v));

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
const MAX_STACK_MERGE_DISTANCE_PX = 2.25 * MAT_STEP_U;

/**
 * Where a sprite comes from, as a mat point (Free Playmat slice 1.6b — there
 * are no tiles). A source is one of:
 *
 * * a Token **instance id** (string) — that Token's centre, while it is on the mat;
 * * `{ centre: { x, y } }` — a mat point, e.g. where a Token that has just left stood;
 * * `{ x, y, width?, height? }` — a box's top-left corner (a Map on the mat).
 */
export function sourcePoint(source) {
    if (source == null) return null;
    if (typeof source === 'string') {
        const instance = BoardState.getTokenById(source);
        return instance && Number.isFinite(instance.x) && Number.isFinite(instance.y)
            ? { x: instance.x, y: instance.y }
            : null;
    }
    if (typeof source !== 'object') return null;
    if (source.centre && Number.isFinite(source.centre.x) && Number.isFinite(source.centre.y)) {
        return { x: source.centre.x, y: source.centre.y };
    }
    if (typeof source.x === 'number' && typeof source.y === 'number') {
        return {
            x: source.x + (source.width != null ? source.width / 2 : TOKEN_PX / 2),
            y: source.y + (source.height != null ? source.height / 2 : TOKEN_PX / 2)
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
function scatterFrom(source, existingTarget = null) {
    const sourcePos = sourcePoint(source);

    if (existingTarget) {
        const fx = sourcePos ? sourcePos.x : existingTarget.x;
        const fy = sourcePos ? sourcePos.y : existingTarget.y;
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDistance = 24 + Math.random() * 24;
        return {
            x: clampX(existingTarget.x + Math.cos(offsetAngle) * offsetDistance),
            y: clampY(existingTarget.y + Math.sin(offsetAngle) * offsetDistance),
            fromX: fx,
            fromY: fy
        };
    }

    if (!sourcePos) {
        const x = clampX(Math.random() * matW());
        const y = clampY(Math.random() * matH());
        return { x, y, fromX: x, fromY: y };
    }

    const angle = Math.random() * Math.PI * 2;
    // Items land within a tile's distance of the output token (0.4 - 0.85 TOKEN_PX)
    const distance = TOKEN_PX * (0.4 + 0.45 * Math.random());

    return {
        x: clampX(sourcePos.x + Math.cos(angle) * distance),
        y: clampY(sourcePos.y + Math.sin(angle) * distance),
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
 * @param {'item'} kind      only `'item'`: Token sprites retired in Token
 *        Lifecycle 9.3 (TL-8), and any other kind is refused
 * @param {string} refId       item id
 * @param {number} quantity
 * @param {string|object|null} source  where it came from — a Token instance id,
 *        `{ centre: {x, y} }` or a box (see `sourcePoint`), or null for overflow
 */
export function addSprite(kind, refId, quantity = 1, source = null) {
    const list = sprites();
    if (!list || !refId || quantity <= 0) return null;
    if (kind !== 'item') {
        logger.warn('SpriteLayer', `Refused a ${kind} sprite for ${refId}: only items drop as loot`);
        return null;
    }

    // CR2-108c / CR2-063. The sprite is still created — a nameless thing on the
    // board is better than loot silently evaporating, and the owner's ruling is
    // warn-only. But an id nothing answers to draws no artwork and no name, so
    // it reads as a glitch rather than as content that needs re-pointing.
    if (!getItem(refId)) {
        warnMissingContent('SpriteLayer', 'item', refId,
            'the loot that just dropped has no name or artwork to show');
    }

    ItemRateTracker.recordGain(refId, quantity);
    const sourcePos = sourcePoint(source);

    // Find primary stacks of the same item
    let targetExisting = null;
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

    const { x, y, fromX, fromY } = scatterFrom(source, targetExisting);
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
        usesRemaining: null,
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
 * Collect one item sprite into the Bank. (Token sprites went to the Token
 * Vault until both retired in Token Lifecycle 9.3; a stray one is left alone.)
 *
 * ⚠️ **Collection can fail, and failing is not an error.** Auto-collect cannot
 * collect into a full Bank, so a player running at zero visible stacks will
 * still see sprites pile up once they hit their slot cap. That accumulation *is*
 * the signal (grid concept §3.4) — leave the sprite where it is.
 *
 * ⚠️ **A refusal announces nothing** (CR2-056). Every path that changes the
 * floor sets `changed`; the ones that leave it alone do not. The two announcing
 * publishes are collapsed into `announceSpriteChange` so a sweep can hold them
 * to one round.
 *
 * @returns {boolean} whether it was taken off the board
 */
export function collectSprite(id) {
    const sprite = getSprites().find(s => s.id === id);
    if (!sprite) return false;

    collecting = true;
    let changed = false;
    try {
        if (sprite.kind === 'item' || sprite.kind === 'gold' || sprite.kind === 'currency') {
            if (sprite.refId === 'item_coins' || sprite.refId === 'item_coin' || sprite.refId === 'coins' || sprite.refId === 'coin' || sprite.kind === 'gold' || sprite.kind === 'currency') {
                // Gold is retired (SP-65, slice 2.2): a coin pile is swept off
                // the floor and pays nothing. It is not banked either — coins
                // as an item would be gold under another name.
                logger.debug('SpriteLayer', `Collected ${sprite.quantity || 1} coins; gold is retired, nothing credited`);
                takeSprite(id);
                announceCollected(sprite, 'bank');
                changed = true;
                return true;
            }

            const added = InventoryManager.addItem(sprite.refId, sprite.quantity);
            if (added <= 0) return false;               // Bank full — it stays put
            if (added < sprite.quantity) {
                sprite.quantity -= added;               // partial fit, remainder waits
                changed = true;
                return false;
            }
            takeSprite(id);
            announceCollected(sprite, 'bank');
            changed = true;
            return true;
        }

        // No other kind drops any more (Token Lifecycle 9.3).
        return false;
    } finally {
        collecting = false;
        if (changed) announceSpriteChange();
    }
}

/**
 * ⭐ **Whether a sweep can skip this pile: the Bank would certainly refuse it**
 * (CR3-254, round 3 review R4). An item pile whose item the Bank has no slot
 * for (`InventoryManager.lacksSlotFor`, the very test `addItem` refuses by) is
 * refused by {@link collectSprite} with nothing changed and nothing announced —
 * so skipping it is exact. Coins (always swept) and items with no definition
 * (which `addItem` reports) are never skipped. Read live per pile, so room made
 * any way at all — a sale, a Bank upgrade, a pile collected earlier in the same
 * sweep — is seen at once.
 *
 * Without it, a full Bank under a big loot flood re-tried every pile every
 * tick, each through a linear lookup: 0.42 ms a tick at 400 piles, ~1.5 at 800.
 */
const COIN_REFS = new Set(['item_coins', 'item_coin', 'coins', 'coin']);

function bankRefuses(sprite) {
    if (sprite.kind !== 'item' || COIN_REFS.has(sprite.refId)) return false;
    if (!getItem(sprite.refId)) return false;
    return InventoryManager.lacksSlotFor(sprite.refId);
}

/** {@link collectSprite}, skipping a pile the Bank would refuse. For the sweeps. */
function sweepOne(sprite) {
    return bankRefuses(sprite) ? false : collectSprite(sprite.id);
}

/**
 * Collect everything that will fit. Whatever does not fit stays put.
 *
 * One sweep, one announcement (CR2-056) — see `asSweep`. Each sprite still
 * publishes its own `board:sprite_collected`, so particles and quest counters
 * are untouched.
 *
 * @returns {number} how many sprites were taken
 */
export function collectAll() {
    return asSweep(() => {
        let taken = 0;
        for (const sprite of [...getSprites()]) {
            if (sweepOne(sprite)) taken++;
        }
        return taken;
    });
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
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
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

    // Both sweeps below are batched (CR2-056). They are the ones that ran
    // every tick against a full Bank, republishing `state_changed` three times
    // per refused sprite while nothing moved.
    if (list.length > cap) {
        const excess = [...list].sort((a, b) => a.bornAt - b.bornAt).slice(0, list.length - cap);
        asSweep(() => {
            for (const sprite of excess) sweepOne(sprite);
        });
    }

    if (!SettingsManager.get('gameplay.autoCollectLoot')) return;
    autoCollectTimer += deltaMs;
    const delay = SettingsManager.get('gameplay.autoCollectDelayMs') ?? 2500;
    if (autoCollectTimer < delay) return;
    autoCollectTimer = 0;

    asSweep(() => {
        for (const sprite of [...list]) {
            if (now - sprite.bornAt >= delay) sweepOne(sprite);
        }
    });
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

    EventBus.subscribe(ENGINE_EVENTS.INVENTORY_OVERFLOW, ({ itemId, amount }) => {
        // Ignore overflow raised by our own collect attempt: the sprite is
        // already on the board and re-adding it would duplicate it every sweep.
        if (collecting) return;
        addSprite('item', itemId, amount, null);
        logger.debug('SpriteLayer', `Bank full — ${amount}× ${itemId} stays on the board (D-138)`);
    });
    logger.info('SpriteLayer', 'Loot sprite layer ready');
}
