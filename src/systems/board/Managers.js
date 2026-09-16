// Fantasy Guild — Manager Tokens (7×7 Playmat rework, Phase 7)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { centreOf, distanceSq, nearRadius, tokensWithin } from './nearby.js';
// ⚠️ `centreOf` takes a Token instance and `tokensWithin` answers instance ids (slice 1.6b).
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as TileModifiers from './TileModifiers.js';
import * as MatPlacement from './MatPlacement.js';
import { logger } from '../../utils/Logger.js';

/**
 * Managers — the phase where **the AFK story becomes real**.
 *
 * Until Managers exist, an unattended board simply winds down as charged Tokens
 * run out. A Manager is the automation that keeps it running, and it completes
 * the chain the whole economy is built around:
 *
 * ```
 * gold → Maps → Token Bank → Manager → board
 * ```
 *
 * That chain is the reason the AFK story is **"the board runs as long as you
 * left it supplies for"** rather than "automation runs forever" (D-133). It
 * turns logging off into a decision rather than an event.
 *
 * ## The four rules
 *
 * 1. **Type-specific** (D-35). A Lumber Camp replaces exhausted Forests; a
 *    Goblin Camp refreshes Goblin-type enemy Tokens. Enemies are not a special
 *    case — they deplete, restock and automate exactly like resources (D-104),
 *    so one economic model covers the whole board.
 * 2. **Near reach, and never depletes** (D-140, Free Playmat 1.3). A Manager
 *    that wore out would be a restocker needing restocking, which is precisely
 *    the chore it exists to remove. Reach is Near, centre to centre (FP-41),
 *    measured from the spot that ran dry. Where several Managers reach one
 *    spot, the **nearest** does the job, then the one placed earlier (slice
 *    1.6b; it was the lowest anchor index), which is stable rather than merely
 *    arbitrary.
 * 3. **Restocks under a working hero, who resumes automatically** (D-151).
 *    ⚠️ **This is the whole point.** A hero whose Forest ran dry does not need
 *    re-placing, because a fresh Forest arrives under their feet and they carry
 *    on. Without it Managers would restock tiles nobody was working while
 *    leaving idle heroes idle — the opposite of the mitigation they exist to
 *    provide. It is buildable at all only because Phase 7 moved hero position
 *    off the Token instance (see `BoardState.workTileOf`).
 * 4. **An empty Bank fails silently** (D-133). A Manager cannot conjure a
 *    Token, only move one from storage. The tile stays depleted and the hero
 *    idles.
 *
 * ## Only tiles that ran dry (owner decision 2026-08-06)
 * A Manager refills a **vacancy** — a tile remembering what depleted on it —
 * never a tile that was simply always empty. Placing a Lumber Camp therefore
 * cannot carpet the ground you were saving for something else. The vacancy is
 * cleared the moment anything lands on the tile, including by hand.
 *
 * ## Why this is a sweep rather than an event handler
 * Restocking has three independent triggers: a Token depletes, a Manager is
 * placed near an existing vacancy, or the Bank is restocked while a vacancy is
 * waiting. Subscribing to all three is three chances to miss one; sweeping the
 * vacancy map is one cheap loop that catches every case by construction.
 * Vacancies are sparse and usually empty, so the common cost is an
 * `Object.keys` on `{}`.
 */

/** Sweep every N engine ticks. At 10Hz this is roughly twice a second. */
const SWEEP_EVERY = 5;

let tickCounter = 0;

/**
 * Whether a Token type is a Manager, and what it looks after.
 *
 * ## The field that had no box (owner decision Q6)
 * This has always read `def.manages`. **Nothing in the CMS ever wrote it**, and
 * no authored Token carried it — so `token_copper_ore_minecart`, typed
 * `manager` and described as restocking its neighbours from the Guild Bank, did
 * precisely nothing. The type picker made a promise the data could not keep.
 *
 * A **Restocks** statement is now that box, and it is where the answer comes
 * from first. `def.manages` still reads, for test fixtures and anything not yet
 * re-authored.
 */
export function managedTypes(typeId) {
    const def = getTokenType(typeId);
    if (!def) return null;

    const restocked = statementsWith(def, KEYWORD.RESTOCKS)
        .flatMap(s => s?.payload?.tokenIds || [])
        .filter(Boolean);

    if (restocked.length) return restocked;
    return def.manages || null;
}

/** Whether a Token definition is a Manager at all. */
export function isManager(typeId) {
    return !!managedTypes(typeId)?.length;
}

/**
 * The Manager in reach of a spot that looks after `typeId`, as
 * `[managerInstanceId, managerTypeId]`, or null.
 *
 * ## Measured from the spot (Free Playmat 1.3, by point since 1.6b)
 * A vacancy is a spot with no Token on it, so there is no Token to measure
 * from. The spot is the owed Token's own point — exactly where the restock will
 * put it (FP-19) — so the Manager is measured from `spot.x`, `spot.y`.
 *
 * ## Tie-break: nearest, then the earlier-placed Manager
 * The "first come" of D-140 — with no ordering overlapping Managers would
 * restock unpredictably. Distances compare exactly (whole-number centres).
 * `tokensWithin` answers in arrival order, so a strict `<` keeps the Manager
 * placed first on a tie (`placedAt` replaced "lowest anchor", plan §A).
 *
 * @param {{x: number, y: number}} spot  a vacancy, or any mat point
 * @param {string} typeId                what is owed there
 */
export function managerFor(spot, typeId) {
    if (!typeId || !spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return null;
    const origin = { x: spot.x, y: spot.y };

    let best = null;
    for (const id of tokensWithin(origin, nearRadius())) {
        const instance = BoardState.getTokenById(id);
        if (!instance || !managedTypes(instance.typeId)?.includes(typeId)) continue;
        const d = distanceSq(origin, centreOf(instance));
        // Normally nothing stands on a vacancy; a Token that does is not its own Manager.
        if (d === 0) continue;
        if (!best || d < best.d) best = { id, typeId: instance.typeId, d };
    }
    return best ? [best.id, best.typeId] : null;
}

/**
 * Try to restock one spot that ran dry.
 *
 * @param {string} spotId the vacancy's key (`BoardState.spotIdAt`)
 * @returns {'restocked'|'unstocked'|'unmanaged'} what happened, for the sweep
 *          and for tests. `unstocked` is D-133's silent failure.
 */
export function restockSpot(spotId) {
    const vacancy = BoardState.vacancyAt(spotId);
    const owed = vacancy?.typeId;
    if (!owed) return 'unmanaged';

    const manager = managerFor(vacancy, owed);
    if (!manager) return 'unmanaged';

    // **It can only move a Token from storage, never conjure one** (D-133).
    const instance = TokenBank.withdraw(owed);
    if (!instance) {
        // Fails silently: no notification, no retry backoff, nothing but the
        // tile's own mark. The mark is deliberately the ONLY cue, which is
        // exactly what risk 15 asks us to check — a returning player has to be
        // able to tell "I ran out of stock" from "something else went wrong".
        //
        // Published only on the transition into `unstocked` (CR2-060). The
        // sweep retries every dry tile on a throttle, and this used to re-fire
        // `ALERT_CHANGED` on every one of those retries for a mark that was
        // already showing. `ALERT.UNSTOCKED` is the same enum the runner
        // publishes and `boardConstants` reads, so the string is written once.
        if (!vacancy.unstocked) {
            vacancy.unstocked = true;
            // A spot with no Token is named by its point (slice 1.6b).
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { spotId, x: vacancy.x, y: vacancy.y, alert: ALERT.UNSTOCKED });
        }
        return 'unstocked';
    }

    // The hero is untouched. A hero waiting on this spot (FP-70) claims the
    // Token arriving on it at the next flag pass — no re-placement, no
    // reassignment, no event (D-151). Lands exactly on the spot that ran dry
    // (FP-19); arriving there also clears the vacancy.
    //
    // ⚠️ Unless something has since been put down on top of it. Free placement
    // (slice 1.6d) lets a player stand a Token anywhere, including across a spot
    // waiting for a restock — and a Manager that insisted on the exact point
    // would then stack two Tokens on each other for as long as the neighbour
    // stayed, which is the one outcome free placement must never produce. So the
    // spot is tried first and, only if it is no longer clear, the nearest legal
    // point to it is used instead.
    let spot = { x: vacancy.x, y: vacancy.y };
    if (!MatPlacement.isClear(instance.typeId, spot)) {
        const found = MatPlacement.findSpot(instance.typeId, spot);
        if (!found) {
            // Nowhere to put it: the Bank keeps it and the spot stays dry.
            TokenBank.deposit(instance);
            return 'unmanaged';
        }
        spot = { x: found.x, y: found.y };
    }
    BoardState.addToken(instance, spot.x, spot.y);
    TileModifiers.rebuildAround([spot]);

    const instanceId = instance.id;
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [spot] });
    const sourceName = tokenName(manager[1]) || tokenName(owed) || 'Manager';
    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        instanceId,
        severity: 'green',
        type: 'token_restocked',
        name: tokenName(owed) || 'Token',
        title: `Restocked from ${sourceName}`,
        message: `Restocked from ${sourceName}`
    });
    if (instance.usesRemaining != null) {
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            instanceId,
            delta: instance.usesRemaining,
            remaining: instance.usesRemaining,
            typeId: instance.typeId
        });
    }

    EventBus.publish('state_changed');

    logger.debug('Managers', `${tokenName(manager[1])} restocked ${tokenName(owed)} at (${spot.x}, ${spot.y})`);
    return 'restocked';
}

/**
 * Restock every vacancy a Manager covers and the Bank can supply, in the order
 * the spots ran dry.
 *
 * @returns {number} how many spots were restocked
 */
export function sweep() {
    const pending = BoardState.spotVacancies();
    if (!pending.length) return 0;

    let restocked = 0;
    for (const [spotId] of pending) {
        if (restockSpot(spotId) === 'restocked') restocked++;
    }
    return restocked;
}

/** Driven from the board runner's tick, throttled — see the sweep note above. */
export function tick() {
    tickCounter++;
    if (tickCounter % SWEEP_EVERY !== 0) return;
    sweep();
}

export function init() {
    logger.info('Managers', 'Manager restocking ready');
}
