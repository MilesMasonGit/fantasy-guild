// Fantasy Guild — Board state accessors (7×7 Playmat rework, Phase 2)

import { GameState } from '../../state/GameState.js';
import { createEmptyBoard } from '../../state/StateSchema.js';
import { TERRAIN_ENABLED } from '../../config/registries/terrainRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * Announce a Tray change (CR2-055, CR2-177 — added 2026-08-25).
 *
 * This is the one exception to "this layer knows shape, not rules": the three
 * tray mutators below are the funnel every route into the Tray passes through,
 * and putting the announcement here is what stops the ~10 callers each having
 * to remember it. It is a notification, not a rule.
 */
function announceTray(reason) {
    EventBus.publish(BOARD_EVENTS.TRAY_CHANGED, { reason });
}

/**
 * BoardState — read/write primitives over `state.board`.
 *
 * This layer knows the SHAPE of board state and nothing about the rules.
 * Displacement, forfeited cycles and what may go where all live in
 * `Placement.js`; keeping them apart is what stops "put a Token here" quietly
 * growing a policy.
 *
 * ## The Token instance shape (D-79)
 * A Token is **a definition plus board state**: the registry holds the type, and
 * a light instance holds only what is true of this copy, on this tile, right now.
 *
 * ```js
 * { typeId: 'token_forest',   // → the definition; NEVER copied onto the instance
 *   usesRemaining: 4200,      // null means unlimited use (D-176)
 *   cycleElapsedMs: 0 }       // runtime; reset by any interruption (D-54)
 * ```
 *
 * A station also carries **`selectedRecipeId`** — the recipe the player set it
 * to (R-5). It is optional and absent on everything that is not a station;
 * `StationRecipe.js` is the only thing that reads or writes it, and its absence
 * on a station means "not chosen yet", which resolves to the pool default.
 *
 * ## Where a Token is (Free Playmat slice 1.6a)
 * `board.tokens[id]` holds every Token on the mat, keyed by its instance id,
 * and the instance itself carries its point: `x`, `y` in mat units (1 u = one
 * natural board pixel) and `placedAt`, from `board.nextTokenOrder`, the order
 * it arrived on the mat in. There are no tiles in this storage, and since slice
 * 1.6d-2 there is no tile-index view over it either: a Token is addressed by
 * its instance id or by a point, and by nothing else.
 *
 * ⚠️ **`heroId` is NOT on the instance.** A hero's flag is their own state
 * (`board.flags`), and which Token they work is a runtime claim keyed by the
 * instance's `id` — see "Flags" and "Claims" below.
 *
 * The definition is deliberately never copied onto the instance. Retuning a
 * Token in the registry has to take effect immediately, everywhere — with
 * D-161's hand-authored numbers and ~60 Tokens to balance, stale copies
 * stranded on live tiles would make tuning untrustworthy.
 *
 * ## `usesRemaining: null` means unlimited, and is not `0`
 * Charges are a per-Token property, independent of rarity (D-176) — a Common
 * may be unlimited and a Mythic may be charged. `null` and `0` are opposites
 * here: one never depletes, the other is spent. Anything comparing charges must
 * check `== null` first.
 */

/**
 * The live board slice, created if a save predates it.
 *
 * The shape comes from `createEmptyBoard()` in StateSchema — this file used to
 * carry its own shorter list, one of three that disagreed (CR2-049). The
 * per-field guards below stay because they also repair a board that is present
 * but has a field of the wrong type.
 *
 * Terrain's paint hook and its backfill of old saves were removed from this
 * file in slice 1.6a (terrain is dormant, FP-10; its modules stay).
 */
function board() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.board) state.board = createEmptyBoard();
    if (!state.board.tokens || typeof state.board.tokens !== 'object') state.board.tokens = {};
    if (typeof state.board.nextTokenOrder !== 'number') state.board.nextTokenOrder = 0;
    if (!state.board.tokenBank) state.board.tokenBank = {};
    if (!Array.isArray(state.board.tray)) state.board.tray = [];
    if (!Array.isArray(state.board.maps)) state.board.maps = [];
    if (!state.board.flags || typeof state.board.flags !== 'object') state.board.flags = {};
    if (typeof state.board.nextFlagOrder !== 'number') state.board.nextFlagOrder = 0;
    if (!state.board.workClaims || typeof state.board.workClaims !== 'object') state.board.workClaims = {};
    if (!state.board.vacancies) state.board.vacancies = {};
    return state.board;
}

/**
 * A fresh Token instance of `typeId`. `uses` of null means unlimited (D-176).
 *
 * `terrain` is the Map's stamp (D-T6): the terrain of whichever Map burst this
 * Token into existence. It is set only when there is one, so the field is
 * absent on the great majority of Tokens rather than being null on all of them.
 * A Token that never came from a Map falls back to its own authored terrain —
 * see `terrainForToken`.
 */
function newTokenId() {
    return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createTokenInstance(typeId, uses = null, terrain = null) {
    const instance = {
        id: newTokenId(),
        typeId,
        usesRemaining: uses,
        cycleElapsedMs: 0
    };
    if (terrain) instance.terrain = terrain;
    return instance;
}

// ---------------------------------------------------------------------------
// Tokens on the mat (Free Playmat slice 1.6a)
// ---------------------------------------------------------------------------

/** Stamp `placedAt` from the board's counter, unless the instance already has one. */
function stampOrder(b, instance) {
    if (!Number.isInteger(instance.placedAt)) instance.placedAt = b.nextTokenOrder++;
}

/**
 * ## The layout version (Free Playmat slice 1.6b)
 * A counter bumped whenever any Token is put on the mat, moved, or taken off,
 * kept per `tokens` object (so a load or a hand-built test board starts a new
 * count). Readers that cache something about *where Tokens are* — the
 * neighbour-id cache in `nearby.js` — key their cache on it, so a cached answer
 * can never outlive a change to the layout.
 */
const layoutVersions = new WeakMap();

function bumpLayout(b) {
    layoutVersions.set(b.tokens, (layoutVersions.get(b.tokens) || 0) + 1);
}

/** `{ tokens, version }` — changes identity or number whenever the layout does. */
export function layoutVersion() {
    const tokensObj = board()?.tokens || null;
    return { tokens: tokensObj, version: tokensObj ? (layoutVersions.get(tokensObj) || 0) : 0 };
}

/** After a Token's point changes: a claimed Token keeps its hero (FP-68), and the claim's last-known point follows. */
function afterPointChange(b, instance) {
    bumpLayout(b);
    for (const claim of runtimeOf(b).claims.values()) {
        if (claim.instanceId === instance.id) {
            claim.x = instance.x;
            claim.y = instance.y;
        }
    }
}

/**
 * Put a Token on the mat at `(x, y)`. **No rules** — callers apply them.
 *
 * The instance itself is stored (not a copy) and gains `x`, `y` and, if it has
 * none, `placedAt`. A Token that is already on the mat is simply moved.
 * Anything landing exactly on a spot vacancy satisfies it, whether it came from
 * a Manager or from the player's hand.
 *
 * @returns the instance, or null
 */
export function addToken(instance, x, y) {
    const b = board();
    if (!b || !instance?.typeId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    // ⚠️ Claims are keyed by instance id (Free Playmat 1.4b), so every Token
    // on the mat must have one.
    if (!instance.id) instance.id = newTokenId();
    const current = b.tokens[instance.id];
    if (current && current !== instance) delete b.tokens[instance.id];
    instance.x = x;
    instance.y = y;
    stampOrder(b, instance);
    b.tokens[instance.id] = instance;
    clearVacancyAt(b, x, y);
    afterPointChange(b, instance);
    return instance;
}

/**
 * Take Token `id` off the mat and return it (or null). No rules.
 *
 * Its `x`, `y` and `placedAt` stay on the instance: a Token lifted and put
 * straight back down elsewhere keeps its place in the arrival order, as a move
 * does. Only entering the Tray clears `placedAt` (see `addToTray`).
 */
export function removeToken(id) {
    const b = board();
    const instance = id ? b?.tokens?.[id] : null;
    if (!instance) return null;
    delete b.tokens[id];
    bumpLayout(b);
    return instance;
}

/** Move Token `id` to `(x, y)`, keeping its `placedAt`. No rules. Returns false if it is not on the mat. */
export function setTokenPoint(id, x, y) {
    const b = board();
    const instance = id ? b?.tokens?.[id] : null;
    if (!instance || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    instance.x = x;
    instance.y = y;
    clearVacancyAt(b, x, y);
    afterPointChange(b, instance);
    return true;
}

/**
 * Carry out a push that `MatPlacement.forceSpot` decided (slice 1.8): move each
 * pushed Token to its new point. No rules — the push was already checked.
 *
 * @param {{id: string, x: number, y: number}[]} pushed
 * @returns {{x: number, y: number}[]} every point touched, old and new, for the
 *          caller's `TileModifiers.rebuildAround`
 */
export function applyPushes(pushed = []) {
    const touched = [];
    for (const p of pushed) {
        const instance = getTokenById(p.id);
        if (!instance) continue;
        touched.push({ x: instance.x, y: instance.y });
        if (setTokenPoint(p.id, p.x, p.y)) touched.push({ x: p.x, y: p.y });
    }
    return touched;
}

/** The Token on the mat with instance id `id`, or null. A direct lookup, never a scan. */
export function getTokenById(id) {
    if (!id) return null;
    return board()?.tokens?.[id] || null;
}

/** Every Token on the mat, in the order they arrived (`placedAt` ascending). */
export function tokens() {
    const map = board()?.tokens || {};
    return Object.values(map)
        .filter(t => t?.typeId)
        .sort((a, b) => (a.placedAt ?? 0) - (b.placedAt ?? 0));
}

/** Every Token whose centre is exactly `(x, y)`, in arrival order. */
export function tokensAtPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return tokens().filter(t => t.x === x && t.y === y);
}

// ---------------------------------------------------------------------------
// Heroes on the board — flags
// ---------------------------------------------------------------------------

/**
 * ## Flags (Free Playmat slice 1.4b) — the saved half
 *
 * `board.flags[heroId] = { x, y, skill, plantedAt }` is where each hero's flag
 * stands, in mat units, with the one skill it works (FP-23). **A hero with no
 * flag is in the Dock** — the Dock is still not a data structure.
 *
 * `plantedAt` comes from `board.nextFlagOrder`, a counter bumped on every plant,
 * and is the order heroes choose in (earlier flags choose first).
 *
 * It replaced the old hero → tile map. Saves from before the 0.8.0 schema
 * (slice 1.6a) are refused outright, so nothing converts that shape any more.
 *
 * This layer knows the shape only. Choosing, claiming and releasing are rules,
 * and live in `Flags.js`.
 */
export function getFlags() {
    return board()?.flags || {};
}

/** The flag `heroId` has planted, or null. */
export function flagOf(heroId) {
    if (!heroId) return null;
    return board()?.flags?.[heroId] || null;
}

/** Plant (or with `null`, take down) a hero's flag. No rules — see `Flags.js`. */
export function setFlag(heroId, flag) {
    const b = board();
    if (!b || !heroId) return;
    if (flag) b.flags[heroId] = flag;
    else delete b.flags[heroId];
}

/** Take the next `plantedAt` number. */
export function takeFlagOrder() {
    const b = board();
    if (!b) return 0;
    return b.nextFlagOrder++;
}

/** Every hero with a flag as `[heroId, displayPoint]`, in planting order (see `displayPointOf`). */
export function heroesOnBoard() {
    const flags = getFlags();
    return Object.keys(flags)
        .sort((a, c) => (flags[a].plantedAt ?? 0) - (flags[c].plantedAt ?? 0))
        .map(heroId => [heroId, displayPointOf(heroId)]);
}

// ---------------------------------------------------------------------------
// Claims — the runtime half (Free Playmat slice 1.4b)
// ---------------------------------------------------------------------------

/**
 * **Which Token each flag is working right now** — the live record, never
 * saved as such. Since Hero Movement M5 (HM-7, amending FP-58) the save keeps a
 * separate note of the Tokens heroes had *reached* (`board.workClaims`, below
 * "Saved work"), and `Flags.restoreWork` rebuilds claims from it on load.
 *
 * * `claims`   heroId → `{ instanceId, typeId, x, y }` — keyed by Token
 *   **instance id**, so a Token that moves carries its hero (FP-68). `x`, `y`
 *   is the Token's last-known point, refreshed whenever it moves, so a hero
 *   whose Token has left can still find the spot it stood on (slice 1.6b).
 * * `waits`    heroId → `{ spotId, typeId, x, y }` — waiting on a spot for a
 *   Manager's restock (FP-70); `x`, `y` is the spot's point.
 * * the rest (`skips`, retry times, notices, cycle ends, clock) belong to `Flags.js`.
 *
 * ## ⚠️ Kept per board object, not per module
 * A new game or a load replaces `GameState.state`, and with it the board, so
 * nothing claimed on one board can leak onto another — including the hand-built
 * boards the test suites swap in between tests.
 */
const runtimes = new WeakMap();

function runtimeOf(b) {
    let rt = runtimes.get(b);
    if (!rt) {
        rt = {
            claims: new Map(),
            waits: new Map(),
            skips: new Map(),
            skipsByHero: new Map(),
            nextTryAt: new Map(),
            notified: new Set(),
            // Heroes who just finished a cycle, to look for better work (FP-80).
            cycleEnded: new Set(),
            // Where each hero on the mat actually is (Hero Movement M1) — see
            // "Hero bodies" below. Owned by `HeroMotion.js`.
            bodies: new Map(),
            clock: 0,
            dirty: true
        };
        runtimes.set(b, rt);
    }
    return rt;
}

/** The live runtime record for the current board. For `Flags.js` only. */
export function flagRuntime() {
    const b = board();
    return b ? runtimeOf(b) : null;
}

/** The claim `heroId` holds, or null. */
export function claimOfHero(heroId) {
    return flagRuntime()?.claims.get(heroId) || null;
}

/** Record (or with `null`, drop) `heroId`'s claim. No rules — see `Flags.js`. */
export function setClaim(heroId, claim) {
    const rt = flagRuntime();
    if (!rt || !heroId) return;
    if (claim) rt.claims.set(heroId, claim);
    else rt.claims.delete(heroId);
    // A saved note about different work is stale the moment the claim changes.
    const saved = board()?.workClaims?.[heroId];
    if (saved && saved.instanceId !== claim?.instanceId) delete board().workClaims[heroId];
}

// ---------------------------------------------------------------------------
// Saved work — what each hero had reached (Hero Movement M5, HM-7)
// ---------------------------------------------------------------------------

/**
 * Note in the save that `heroId` has **reached** Token `instanceId` and works
 * it from `side` (−1 left, 1 right). Written when they arrive — never while
 * they are still walking there — so a reload puts them back only at work they
 * were really doing. `setClaim` erases it when the claim changes.
 */
export function recordWorkClaim(heroId, instanceId, side) {
    const b = board();
    if (!b || !heroId || !instanceId) return;
    b.workClaims[heroId] = { instanceId, side: side === 1 ? 1 : -1 };
}

/** Drop `heroId`'s saved work note. */
export function forgetWorkClaim(heroId) {
    const b = board();
    if (b?.workClaims) delete b.workClaims[heroId];
}

/** Every saved work note, as `[heroId, { instanceId, side }]`. */
export function savedWorkClaims() {
    return Object.entries(board()?.workClaims || {});
}

/** The wait `heroId` is on, or null. */
export function waitOfHero(heroId) {
    return flagRuntime()?.waits.get(heroId) || null;
}

/** Record (or with `null`, drop) `heroId`'s wait. */
export function setWait(heroId, wait) {
    const rt = flagRuntime();
    if (!rt || !heroId) return;
    if (wait) rt.waits.set(heroId, wait);
    else rt.waits.delete(heroId);
}

/** The hero whose flag has claimed Token instance `instanceId`, or null. */
export function heroOfInstance(instanceId) {
    if (!instanceId) return null;
    const rt = flagRuntime();
    if (!rt) return null;
    for (const [heroId, claim] of rt.claims) {
        if (claim.instanceId === instanceId) return heroId;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Hero bodies — the runtime half of walking (Hero Movement M1)
// ---------------------------------------------------------------------------

/**
 * **Where a hero on the mat actually is**, as they walk: `heroId → { x, y,
 * targetId, side, atWork, moving, facing }`. Never saved: on load a hero is
 * placed from the saved work note (`workClaims`) or beside their flag (M5). `HeroMotion.js` is the only writer; this file just
 * holds them and answers the seam's "has the hero arrived?".
 *
 * `atWork` is the instance id of the claimed Token the hero has **reached**.
 * Until then they are walking to it and do not count as working it (FP-26,
 * HMP-2). Once reached it sticks for that claim, even if the Token is moved
 * and they have to catch up — so a moved Token keeps its progress (FP-68) and a
 * moved enemy keeps its fight (FPP-4).
 */
export function heroBodyOf(heroId) {
    return flagRuntime()?.bodies.get(heroId) || null;
}

/** Record (or with `null`, drop) a hero's body. For `HeroMotion.js` only. */
export function setHeroBody(heroId, body) {
    const rt = flagRuntime();
    if (!rt || !heroId) return;
    if (body) rt.bodies.set(heroId, body);
    else rt.bodies.delete(heroId);
}

/** Every hero body on the current board, as `[heroId, body]`. */
export function heroBodies() {
    const rt = flagRuntime();
    return rt ? [...rt.bodies] : [];
}

/**
 * ⚠️ **Test-only switch: heroes arrive the moment they claim.** Thousands of
 * tests plant a flag and expect the hero to be working at once, as they were
 * before walking existed. `src/tests/setup/instantArrival.js` turns this on for
 * every test file; the walking tests turn it off. The game never sets it.
 */
let instantArrival = globalThis.__FG_INSTANT_ARRIVAL__ === true;

export function setInstantArrival(on) {
    instantArrival = !!on;
}

export function isInstantArrival() {
    return instantArrival;
}

/** Whether `heroId` has reached the Token `instanceId` they claimed. */
function arrivedAt(heroId, instanceId) {
    if (instantArrival) return true;
    return flagRuntime()?.bodies.get(heroId)?.atWork === instanceId;
}

// ---------------------------------------------------------------------------
// The worker seam (Free Playmat slices 1.4a, 1.4b)
// ---------------------------------------------------------------------------

/**
 * ⭐ **The only three questions the rest of the game may ask about where a hero
 * is.** `WorkerSeam.test.js` fails if any other file reads the flag storage.
 *
 *   * `workerOf(instanceId)`   — who works this Token (damage, statuses, roles,
 *                                gear feeding the Token, filters, the tick)
 *   * `workTokenOf(heroId)`    — the instance id of the Token this hero works
 *                                (their cycle, their idle mark, where their
 *                                actor rules act from)
 *   * `displayPointOf(heroId)` — the mat point to draw them at (badges,
 *                                particles, level-up pops)
 *
 * ## Under flags (slice 1.4b, roadmap §2), by id and point (slice 1.6b)
 * * `workerOf(id)` is **the hero whose flag has claimed that Token**, while it
 *   is on the mat **and the hero has arrived** (Hero Movement M1 — walking to
 *   it is not working it, FP-26). ⚠️ A spot with no Token has no worker, ever:
 *   a hero waiting on an empty spot for a restock (FP-70) is not working it.
 * * `workTokenOf(heroId)` is the claimed Token's id while it is on the mat and
 *   the hero has arrived, or null. (Flags reads the claim itself through
 *   `claimOfHero` — a claim is made when the hero sets off, HMP-2.)
 * * `displayPointOf(heroId)` is the claimed Token's centre, else the spot they
 *   wait on, else their flag's point, else null (in the Dock).
 *
 * ⭐ The tile forms that stood beside them — `workerOfTile` and `workTileOf` —
 * were deleted with the grid in slice 1.6d-2.
 */
export function workerOf(instanceId) {
    if (typeof instanceId !== 'string' || !instanceId) return null;
    if (!board()?.tokens?.[instanceId]) return null;
    const heroId = heroOfInstance(instanceId);
    return heroId && arrivedAt(heroId, instanceId) ? heroId : null;
}

/** The instance id of the Token `heroId` works, or null. */
export function workTokenOf(heroId) {
    if (!heroId) return null;
    const claim = claimOfHero(heroId);
    if (!claim) return null;
    const instance = getTokenById(claim.instanceId);
    if (!instance) return null;
    claim.x = instance.x;
    claim.y = instance.y;
    return arrivedAt(heroId, instance.id) ? instance.id : null;
}

/** The mat point to draw `heroId` at: claimed Token > waiting spot > flag > null. */
export function displayPointOf(heroId) {
    if (!heroId) return null;
    const work = getTokenById(workTokenOf(heroId));
    if (work) return { x: work.x, y: work.y };
    const wait = waitOfHero(heroId);
    if (wait && Number.isFinite(wait.x) && Number.isFinite(wait.y)) return { x: wait.x, y: wait.y };
    const flag = flagOf(heroId);
    return flag ? { x: flag.x, y: flag.y } : null;
}

// ---------------------------------------------------------------------------
// Vacancies — the spot a spent Token stood on (Phase 7, D-35; by spot since 1.6a)
// ---------------------------------------------------------------------------

/**
 * A **spot that ran dry**, remembering what depleted on it.
 *
 * `board.vacancies[spotId] = { typeId, x, y, unstocked }`, where `x`, `y` is
 * the spent Token's own point — exactly where a Manager's restock lands
 * (FP-19). The spot id is derived from that point, so a second Token running
 * dry on the same point replaces the first record rather than adding one.
 *
 * This is what makes a Manager type-specific without making it invasive. A
 * Lumber Camp refills a spot where a *Forest* wore out; it never colonises
 * ground that was simply always empty, so placing a Manager cannot carpet the
 * ground you were saving for something else (owner decision 2026-08-06).
 *
 * Set only by depletion. Cleared the moment anything lands on the spot —
 * including by hand, which is the player overriding the Manager's claim.
 */
export function spotIdAt(x, y) {
    return `spot_${x}_${y}`;
}

/** Record (or with a null `typeId`, clear) the vacancy at a mat point. */
export function setVacancyAt(point, typeId) {
    const b = board();
    if (!b || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const spotId = spotIdAt(point.x, point.y);
    if (!typeId) {
        delete b.vacancies[spotId];
        return;
    }
    b.vacancies[spotId] = { typeId, x: point.x, y: point.y, unstocked: false };
}

/** Clear any vacancy standing exactly at `(x, y)`. */
function clearVacancyAt(b, x, y) {
    delete b.vacancies[spotIdAt(x, y)];
}

/** The vacancy recorded for `spotId`, or null. */
export function vacancyAt(spotId) {
    if (!spotId) return null;
    return board()?.vacancies?.[spotId] || null;
}

/**
 * Every spot vacancy as `[spotId, vacancy]`, in the order the spots ran dry.
 * Sparse — usually empty.
 */
export function spotVacancies() {
    const map = board()?.vacancies || {};
    return Object.keys(map).map(spotId => [spotId, map[spotId]]).filter(([, v]) => v?.typeId);
}

// ---------------------------------------------------------------------------
// The Tray (D-86, D-107, D-168)
// ---------------------------------------------------------------------------

/**
 * The Tray — a permanent staging area, and **load-bearing rather than
 * decorative**.
 *
 * Opening a Bank covers the board, so Tokens cannot be dragged Bank→tile
 * directly. The flow is **Bank → Tray → Board**. Remove the Tray and placement
 * stops working entirely.
 *
 * It is also where purchased Maps land (D-156) and where displaced Tokens go,
 * which is why it is roomy from the start — ~15–20 slots, so a full Map burst
 * always fits (D-168).
 */
export function getTray() {
    const b = board();
    if (!b) return [];
    backfillTrayPositions(b.tray);
    return b.tray;
}

/** Maximum unburst maps allowed across Playmat + Tray to prevent lagging */
export const MAX_MAP_LIMIT = 50;

/** All map tokens sitting in the tray. */
export function getTrayMaps() {
    const b = board();
    if (!b) return [];
    return b.tray.filter(t => !!getTokenType(t.typeId)?.mapId);
}

/** Count non-map playable tokens in the Tray. */
export function nonMapTrayTokensCount() {
    const b = board();
    if (!b) return 0;
    return b.tray.filter(t => !getTokenType(t.typeId)?.mapId).length;
}

/** Total unburst maps across Playmat + Tray. */
export function getTotalMapCount() {
    return (getBoardMaps().length + getTrayMaps().length);
}

/** Whether a new map can be spawned/purchased without exceeding the 50-map cap. */
export function hasMapSpace() {
    return getTotalMapCount() < MAX_MAP_LIMIT;
}

/**
 * Whether the Tray has room for `count` more standard Tokens.
 *
 * **The one definition of Tray capacity (CR2-054.)** Maps do not occupy Tray
 * capacity — `MAX_MAP_LIMIT` caps them instead — so only non-map Tokens are
 * counted, which is what `addToTray` has always actually enforced. Placement
 * and the Cartographer used to check raw `getTray().length` against
 * `TRAY_CAPACITY` instead, so with a Map sitting in the Tray those routes
 * refused a move that `addToTray` would have accepted, and the same Tray
 * reported "full" on one route and "not full" on another.
 */
export function hasTraySpaceFor(count = 1, capacity = TRAY_CAPACITY) {
    return nonMapTrayTokensCount() + count <= capacity;
}

/** Whether the Tray has room for at least one more standard Token. */
export function hasTraySpace(capacity = TRAY_CAPACITY) {
    return hasTraySpaceFor(1, capacity);
}

/**
 * Append to the Tray. Returns false when full.
 * Maps do not count towards Tray capacity (capped only by MAX_MAP_LIMIT).
 */
export function addToTray(instance, capacity = TRAY_CAPACITY, position = null) {
    const b = board();
    if (!b || !instance) return false;

    const isMap = !!getTokenType(instance.typeId)?.mapId;
    if (isMap) {
        if (!hasMapSpace()) return false;
    } else {
        if (!hasTraySpaceFor(1, capacity)) return false;
    }

    // A Token entering the Tray gives up its place in the mat's arrival order.
    // ⚠️ The Tray stores fractions in the same `x`/`y` the mat stores points in,
    // so its caller must take it off the mat straight after this.
    delete instance.placedAt;

    const at = position || scatterIntoTray(b.tray, { biasTop: isMap });
    instance.x = clamp01(at.x);
    instance.y = clamp01(at.y);
    instance.z = nextTrayZ();
    if (position != null) {
        delete instance.isLanding;
    }

    b.tray.push(instance);
    announceTray('added');
    return true;
}

/** Remove and return the Tray entry at `slot`, or null. */
export function takeFromTray(slot) {
    const b = board();
    if (!b || slot < 0 || slot >= b.tray.length) return null;
    const taken = b.tray.splice(slot, 1)[0] || null;
    if (taken) announceTray('taken');
    return taken;
}

/** Increment and return the next monotonically increasing Tray z-index. */
export function nextTrayZ() {
    const b = board();
    if (!b) return 1;
    b.nextTrayZ = (b.nextTrayZ || 0) + 1;
    return b.nextTrayZ;
}

/** Bring a Tray token to the very top z-level when handled. */
export function bringTrayTokenToFront(slot) {
    const b = board();
    const entry = b?.tray?.[slot];
    if (!entry) return null;
    entry.z = nextTrayZ();
    return entry.z;
}

/** Move the Token at `slot` to a new Tray position. Fractions, clamped. */
export function setTrayPosition(slot, x, y) {
    const b = board();
    const entry = b?.tray?.[slot];
    if (!entry) return false;
    entry.x = clamp01(x);
    entry.y = clamp01(y);
    entry.z = nextTrayZ();
    announceTray('moved');
    return true;
}

/** Tray capacity (D-168). Raised later by the Economy upgrade track (D-163). */
export const TRAY_CAPACITY = 48;

// ---------------------------------------------------------------------------
// Tray positions (D-223, D-226, D-227)
// ---------------------------------------------------------------------------

/**
 * ## The Tray is a free surface, not a grid (D-223)
 *
 * Tokens sit wherever they are put, may overlap freely, and stay there between
 * sessions. Three things about how that is stored are load-bearing:
 *
 * **1. Position lives on the INSTANCE, never on the slot index.**
 * `takeFromTray()` splices, so every index after the removed one shifts down.
 * Anything keyed to a slot number would make the whole Tray jump whenever one
 * Token was placed. Because each Token carries its own `x`/`y`, splicing cannot
 * disturb the arrangement — **which is also why no Token id is needed here.**
 *
 * **2. Positions are FRACTIONS of the placeable area, not pixels (D-226).**
 * `0` is flush against the left/top edge and `1` flush against the right/bottom,
 * so the renderer computes `fraction × (surface − sprite)`. The Tray body is
 * `flex-1` — its height changes with the window and collapses when a bottom
 * drawer opens — and absolute pixels would leave Tokens below the fold, on the
 * one surface D-156 makes the only home for an unopened Map. Fractions squash
 * and stretch instead: nothing ever leaves the surface, nothing needs scrolling,
 * and all 18 stay visible so the `n / 18` count keeps describing what you see.
 * *Accepted cost:* spacing is not preserved, only rough layout — a deliberate
 * gap can close up on a short window.
 *
 * **3. Scattering happens in that same fraction space**, so a narrow tall Tray
 * naturally spreads Tokens further apart vertically than horizontally. That is
 * the right bias for a 256px column and is why no aspect correction is applied.
 */

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);

/** How many candidate spots to consider before choosing the emptiest. */
const SCATTER_DARTS = 40;

/**
 * A position for a Token arriving on its own — random, but biased toward open
 * space (D-227).
 *
 * Throw `SCATTER_DARTS` random points and keep whichever lands furthest from
 * everything already down. Overlap therefore begins only once the Tray genuinely
 * runs out of room.
 *
 * *Why not uniform random:* it does not read as physical, it reads as broken —
 * Tokens bury each other while obvious free space sits unused beside them, and a
 * six-item Map burst (D-167) can drop three things on one spot. Real objects
 * tipped onto a real surface spread out, so seeking space is **more** physical
 * than uniform randomness, not less.
 */
export function scatterIntoTray(existing = [], options = {}) {
    let best = { x: Math.random(), y: options.biasTop ? Math.random() * 0.45 : Math.random() };
    let bestGap = -1;

    for (let d = 0; d < SCATTER_DARTS; d++) {
        const x = Math.random();
        const y = options.biasTop ? (0.05 + Math.random() * 0.42) : Math.random();

        let nearest = Infinity;
        for (const e of existing) {
            if (e?.x == null || e?.y == null) continue;
            const gap = Math.hypot(e.x - x, e.y - y);
            if (gap < nearest) nearest = gap;
        }

        if (nearest > bestGap) { bestGap = nearest; best = { x, y }; }
    }

    return best;
}

/**
 * Give a position to any Tray Token that loaded without one.
 *
 * **This is what makes the change need no save-schema break.** `migrateState()`
 * refuses any save whose version is not an exact match, and every rework so far
 * has broken compatibility deliberately — but adding an optional field does not
 * require that. A Token saved before positions existed is simply scattered on
 * read, exactly as a fresh arrival would be. Schema stays 0.6.0.
 */
export function backfillTrayPositions(tray) {
    if (!Array.isArray(tray)) return;
    for (const entry of tray) {
        if (!entry || (entry.x != null && entry.y != null)) continue;
        const at = scatterIntoTray(tray);
        entry.x = at.x;
        entry.y = at.y;
    }
}

// ---------------------------------------------------------------------------
// The Token Bank (D-137)
// ---------------------------------------------------------------------------

/**
 * **Stacks are never capped; slots are** (D-137). The Token Bank caps the number
 * of *distinct types* held, never how many copies of one type.
 *
 * Capping copies would punish a productive board, which is the opposite of what
 * the economy is for. Capping variety creates pressure to specialise without
 * ever making success feel like a problem.
 *
 * These are the storage primitives only. Consolidation (D-77), the slot cap and
 * selling are **rules**, and live in `TokenBank.js` — the same split that keeps
 * placement policy out of `setToken`.
 */
export function getTokenBank() {
    return board()?.tokenBank || {};
}

/** How many distinct Token types the Bank holds — the thing that is capped. */
export function tokenBankSlotsUsed() {
    return Object.keys(getTokenBank()).length;
}

/** Every copy of one Token type held in the Bank. */
export function tokenBankCopies(typeId) {
    return getTokenBank()[typeId] || [];
}

/**
 * Put a Token into the Bank, **raw** — no consolidation, no slot cap.
 *
 * Callers should use `TokenBank.deposit()`, which applies both. This stays
 * exported because consolidation needs a way to write copies back without
 * recursing through its own rules.
 *
 * Refused only when it would need a NEW slot and none is free — adding to a
 * type already held never needs one, exactly as the item Bank behaves. A
 * refusal never destroys the Token: every caller leaves it on the board as a
 * sprite instead (D-138).
 */
export function addToTokenBank(instance, slotCap = Infinity) {
    const b = board();
    if (!b || !instance?.typeId) return false;
    const bank = b.tokenBank;
    if (!bank[instance.typeId]) {
        if (Object.keys(bank).length >= slotCap) return false;
        bank[instance.typeId] = [];
    }
    // ⚠️ The Vault stores copies, not instances — its key IS the type, and
    // everything else about a Token is dropped. `terrain` has to be carried
    // explicitly or a Token that goes board → Vault → board forgets which Map
    // produced it (D-T6). Absent rather than null when there is no stamp, so
    // Vault records stay the size they were.
    const copy = { usesRemaining: instance.usesRemaining ?? null };
    if (TERRAIN_ENABLED && instance.terrain) copy.terrain = instance.terrain; // dormant (FP-10)
    bank[instance.typeId].push(copy);
    return true;
}

/** Replace every copy of a type at once. Used by consolidation's repack. */
export function setTokenBankCopies(typeId, copies) {
    const b = board();
    if (!b || !typeId) return;
    if (copies?.length) b.tokenBank[typeId] = copies;
    else delete b.tokenBank[typeId];
}

/**
 * Take one copy of a type out of the Bank.
 *
 * **Placement always draws a full Token first** (D-77); partials are used last.
 * Doing it here rather than at each call site means a player can never be handed
 * a nearly-spent Token while a fresh one sits in storage.
 */
export function takeFromTokenBank(typeId) {
    const bank = board()?.tokenBank;
    const copies = bank?.[typeId];
    if (!copies?.length) return null;

    // Unlimited (null) counts as the fullest possible.
    let best = 0;
    for (let i = 1; i < copies.length; i++) {
        const a = copies[best].usesRemaining;
        const b2 = copies[i].usesRemaining;
        if (a === null) break;
        if (b2 === null || b2 > a) best = i;
    }

    const [copy] = copies.splice(best, 1);
    if (!copies.length) delete bank[typeId];
    return createTokenInstance(typeId, copy.usesRemaining ?? null, copy.terrain || null);
}

// ---------------------------------------------------------------------------
// Board Maps (freely placed overtop the playmat)
// ---------------------------------------------------------------------------

/** All maps freely sitting on the playmat. */
export function getBoardMaps() {
    return board()?.maps || [];
}

/** Add a map token instance at (x, y) coordinates on the playmat. */
export function addBoardMap(typeId, x, y, usesRemaining = 1, options = {}) {
    const b = board();
    if (!b || !typeId) return null;
    const instance = {
        id: 'map_' + Math.random().toString(36).slice(2, 9),
        typeId,
        x: Math.round(x),
        y: Math.round(y),
        usesRemaining: usesRemaining ?? 1,
        bornAt: options.bornAt ?? Date.now(),
        fromX: options.fromX ?? null,
        fromY: options.fromY ?? null
    };
    b.maps.push(instance);
    return instance;
}

/** Remove and return a board map by id (or null). */
export function removeBoardMap(id) {
    const b = board();
    if (!b) return null;
    const idx = b.maps.findIndex(m => m.id === id);
    if (idx === -1) return null;
    return b.maps.splice(idx, 1)[0] || null;
}

/** Update the (x, y) coordinates of a board map. */
/** Update the (x, y) coordinates of a board map. */
export function setBoardMapPosition(id, x, y) {
    const b = board();
    const map = b?.maps?.find(m => m.id === id);
    if (!map) return false;
    map.x = Math.round(x);
    map.y = Math.round(y);
    return true;
}
