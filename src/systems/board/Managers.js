// Fantasy Guild — Manager Tokens (7×7 Playmat rework, Phase 7)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { neighboursOf } from './adjacency.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as TileModifiers from './TileModifiers.js';
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
 * 2. **Eight adjacent tiles, and never depletes** (D-140). A Manager that wore
 *    out would be a restocker needing restocking, which is precisely the chore
 *    it exists to remove. Where two Managers cover one tile, whichever acts
 *    first does the job — resolved here by ascending tile index, which is
 *    stable rather than merely arbitrary.
 * 3. **Restocks under a working hero, who resumes automatically** (D-151).
 *    ⚠️ **This is the whole point.** A hero whose Forest ran dry does not need
 *    re-placing, because a fresh Forest arrives under their feet and they carry
 *    on. Without it Managers would restock tiles nobody was working while
 *    leaving idle heroes idle — the opposite of the mitigation they exist to
 *    provide. It is buildable at all only because Phase 7 moved hero position
 *    off the Token instance (see `BoardState.tileOfHero`).
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
 * The Manager covering a tile that looks after `typeId`, as `[tile, typeId]`,
 * or null.
 *
 * Ascending tile index is the "first come" of D-140 — with no ordering the two
 * overlapping Managers would restock unpredictably, which is a difference the
 * player can see (their stock drains from a different pile) for no benefit.
 */
export function managerFor(tile, typeId) {
    if (!typeId) return null;
    // Copied before sorting — `neighboursOf` hands back a shared, frozen array.
    for (const n of [...neighboursOf(tile)].sort((a, b) => a - b)) {
        const instance = BoardState.getToken(n);
        if (!instance) continue;
        if (managedTypes(instance.typeId)?.includes(typeId)) return [n, instance.typeId];
    }
    return null;
}

/**
 * Try to restock one vacant tile.
 *
 * @returns {'restocked'|'unstocked'|'unmanaged'} what happened, for the sweep
 *          and for tests. `unstocked` is D-133's silent failure.
 */
export function restockTile(tile, vacancy) {
    const owed = vacancy?.typeId;
    if (!owed) return 'unmanaged';

    const manager = managerFor(tile, owed);
    if (!manager) return 'unmanaged';

    // **It can only move a Token from storage, never conjure one** (D-133).
    const instance = TokenBank.withdraw(owed);
    if (!instance) {
        // Fails silently: no notification, no retry backoff, nothing but the
        // tile's own mark. The mark is deliberately the ONLY cue, which is
        // exactly what risk 15 asks us to check — a returning player has to be
        // able to tell "I ran out of stock" from "something else went wrong".
        vacancy.unstocked = true;
        EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { tile, alert: 'unstocked' });
        return 'unstocked';
    }

    // The hero is untouched. They are standing on this tile in `heroTiles`, so
    // a Token arriving underneath them is all it takes for work to resume on
    // the next tick — no re-placement, no reassignment, no event (D-151).
    BoardState.setToken(tile, instance);      // also clears the vacancy
    TileModifiers.rebuildAround(tile);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile });
    const sourceName = tokenName(manager[1]) || tokenName(owed) || 'Manager';
    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        tile,
        severity: 'green',
        type: 'token_restocked',
        name: tokenName(owed) || 'Token',
        title: `Restocked from ${sourceName}`,
        message: `Restocked from ${sourceName}`
    });
    EventBus.publish('state_changed');

    logger.debug('Managers', `${tokenName(manager[1])} restocked ${tokenName(owed)} on tile ${tile}`);
    return 'restocked';
}

/**
 * Restock every vacancy a Manager covers and the Bank can supply.
 *
 * @returns {number} how many tiles were restocked
 */
export function sweep() {
    const pending = BoardState.vacancies();
    if (!pending.length) return 0;

    let restocked = 0;
    for (const [tile, vacancy] of pending) {
        if (restockTile(tile, vacancy) === 'restocked') restocked++;
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
