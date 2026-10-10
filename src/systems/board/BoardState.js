// board state accessors

import { GameState } from '../../state/GameState.js';
import { createEmptyBoard } from '../../state/StateSchema.js';

/**
 * BoardState: read/write primitives over `state.board`.
 *
 * This layer knows the SHAPE of board state and nothing about the rules. Displacement, forfeited
 * cycles and what may go where all live in `Placement.js`; keeping them apart stops
 * put-a-Token-here quietly growing a policy.
 *
 * A Token is a definition plus board state. The registry holds the type, and a light instance holds
 * only what is true of this copy right now: `typeId` (the definition, NEVER copied onto the
 * instance), `usesRemaining` (null means unlimited) and `cycleElapsedMs` (runtime; reset by any
 * interruption). A station also carries `selectedRecipeId`, the recipe the player set it to. It is
 * optional and absent on everything that is not a station; `StationRecipe.js` is the only thing
 * that reads or writes it, and its absence on a station means not chosen yet: the station waits,
 * and nobody works it until the player picks.
 *
 * Where a Token is: `board.tokens[id]` holds every Token on the mat, keyed by its instance id, and
 * the instance itself carries its point: `x`, `y` in mat units (1 u = one natural board pixel) and
 * `placedAt`, from `board.nextTokenOrder`, the order it arrived on the mat in. A Token is addressed
 * by its instance id or by a point, and by nothing else.
 *
 * ⚠️ `heroId` is NOT on the instance. A hero's flag is their own state (`board.flags`), and which
 * Token they work is a runtime claim keyed by the instance's `id` (see Flags and Claims below).
 *
 * The definition is deliberately never copied onto the instance: retuning a Token in the registry
 * has to take effect immediately, everywhere, and stale copies stranded on live Tokens would make
 * tuning untrustworthy.
 *
 * `usesRemaining: null` means unlimited, and is not `0`: one never depletes, the other is spent.
 * Charges are a per-Token property, independent of rarity. Anything comparing charges must check
 * `== null` first.
 */

/**
 * The live board slice, created if a save predates it. The shape comes from `createEmptyBoard()` in
 * StateSchema; the per-field guards below stay because they also repair a board that is present but
 * has a field of the wrong type.
 */
function board() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.board) state.board = createEmptyBoard();
    if (!state.board.tokens || typeof state.board.tokens !== 'object') state.board.tokens = {};
    if (typeof state.board.nextTokenOrder !== 'number') state.board.nextTokenOrder = 0;
    if (!state.board.flags || typeof state.board.flags !== 'object') state.board.flags = {};
    if (typeof state.board.nextFlagOrder !== 'number') state.board.nextFlagOrder = 0;
    if (!state.board.workClaims || typeof state.board.workClaims !== 'object') state.board.workClaims = {};
    if (!Array.isArray(state.board.bin)) state.board.bin = [];
    if ('vacancies' in state.board) delete state.board.vacancies;
    return state.board;
}

/**
 * A fresh Token instance of `typeId`. `uses` of null means unlimited.
 *
 * `terrain` is the Map's stamp: the terrain of whichever Map burst this Token into existence. It is
 * set only when there is one, so the field is absent on the great majority of Tokens rather than
 * being null on all of them. Nothing reads the stamp today.
 */
function newTokenId() {
    return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Where a Token came from:
 * - `placed`: the player put it there, or the game did on the player's behalf: the opening Guild
 * Hall, a crafted Token, anything bought or built.
 * - `spawned`: the engine made it (`EffectActions.spawn`): a sapling from a Forest, a goblin from a
 * camp.
 *
 * A spawn may push only `spawned` Tokens; the Token cap (`MatCap.js`) counts both. A `grows` or `turns` change (a transform) keeps it.
 *
 * Saved with the instance. ⚠️ An instance without it reads as `placed` ({@link originOf}), so a
 * save from before the field existed loses nothing.
 */
export const ORIGIN = Object.freeze({ PLACED: 'placed', SPAWNED: 'spawned' });

/** A Token instance's origin: `spawned` only when it says so, else `placed`. */
export function originOf(instance) {
    return instance?.origin === ORIGIN.SPAWNED ? ORIGIN.SPAWNED : ORIGIN.PLACED;
}

/**
 * A map's node: a Token a map wrote into its Region when the Region was settled (`Atlas.settle`),
 * saved as `fixture: true` beside the `biome` it stands in. Always `placed`, so no spawn pushes it.
 * A transform keeps the mark (`EffectActions.transformInstance`), as it keeps `origin`.
 */
export function isFixture(instance) {
    return instance?.fixture === true;
}

/**
 * A fresh Token instance. `origin` defaults to `placed`: every route that makes a Token except a
 * spawn is the player's, so only `EffectActions.spawn` passes `spawned`. `id` is drawn fresh unless
 * given: a settled Region names its Tokens itself, so writing one draws no random number.
 */
export function createTokenInstance(typeId, uses = null, terrain = null, origin = ORIGIN.PLACED, id = null) {
    const instance = {
        id: id || newTokenId(),
        typeId,
        usesRemaining: uses,
        cycleElapsedMs: 0,
        origin: origin === ORIGIN.SPAWNED ? ORIGIN.SPAWNED : ORIGIN.PLACED
    };
    if (terrain) instance.terrain = terrain;
    return instance;
}

/** The ids of every `placed` Token on the mat: what a spawn may not push. */
export function placedTokenIds() {
    return tokens().filter(t => originOf(t) === ORIGIN.PLACED).map(t => t.id);
}

/** Stamp `placedAt` from the board's counter, unless the instance already has one. */
function stampOrder(b, instance) {
    if (!Number.isInteger(instance.placedAt)) instance.placedAt = b.nextTokenOrder++;
}

/**
 * A board that is not the live one, holding `placements` in order, each instance given its point
 * and arrival order exactly as {@link addToken} gives them on the mat. ⚠️ Every other writer here
 * writes only the live board (`state.board`); this is how a Region is built before the guild goes
 * there (`Atlas.settle`), with nothing live read or touched. No rules, as `addToken`.
 *
 * @param {{instance: object, x: number, y: number}[]} placements  instances with their ids
 * @returns {object} a board in the shape of `createEmptyBoard()`
 */
export function detachedBoard(placements = []) {
    const b = createEmptyBoard();
    for (const { instance, x, y } of placements) {
        if (!instance?.id || !instance.typeId || !Number.isFinite(x) || !Number.isFinite(y)) continue;
        instance.x = x;
        instance.y = y;
        stampOrder(b, instance);
        b.tokens[instance.id] = instance;
    }
    return b;
}

/**
 * The layout version: a counter bumped whenever any Token is put on the mat, moved, or taken off,
 * kept per `tokens` object (so a load or a hand-built test board starts a new count). Readers that
 * cache something about where Tokens are, like the neighbour-id cache in `nearby.js`, key their
 * cache on it, so a cached answer can never outlive a change to the layout.
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

/**
 * The membership version: a counter bumped only when a Token is added to or removed from the mat
 * (`addToken`, `removeToken`), never by `setTokenPoint`, whose moves cannot change which Tokens are
 * on the mat or their arrival order. Kept per `tokens` object, like {@link layoutVersion}, which
 * also counts moves and so would rebuild a membership-keyed cache on nearly every tick (walking
 * enemies bump it almost every tick).
 *
 * `tokens()` below keys its cache on this; `SpawnerSystem`'s census keys its own on the same
 * counter.
 */
const membershipVersions = new WeakMap();

function bumpMembership(b) {
    membershipVersions.set(b.tokens, (membershipVersions.get(b.tokens) || 0) + 1);
}

/** `{ tokens, version }` — changes identity or number only when membership does. */
export function membershipVersion() {
    const tokensObj = board()?.tokens || null;
    return { tokens: tokensObj, version: tokensObj ? (membershipVersions.get(tokensObj) || 0) : 0 };
}

/**
 * The move journal: every {@link setTokenPoint} records the moved id and its from and to points
 * here, kept per `tokens` object like the counters above. A reader that caches something about who
 * is near whom (`nearby.neighbourIds`) replays the moves it has not seen ({@link eachMoveSince})
 * and drops only the entries a move can have changed, instead of the whole cache on every step a
 * walking enemy takes. Adds and removes are not journalled: they bump {@link membershipVersion},
 * which drops such a cache outright.
 *
 * It is a journal the reader pulls rather than a callback, because this file cannot import
 * `nearby.js` (that would be a cycle). A fixed ring of the last {@link MOVE_JOURNAL_SIZE} moves, so
 * a step allocates nothing; a reader that fell further behind than that is told so and must start
 * over.
 */
const moveJournals = new WeakMap();
export const MOVE_JOURNAL_SIZE = 512;

function journalMove(b, id, fx, fy, tx, ty) {
    let journal = moveJournals.get(b.tokens);
    if (!journal) {
        journal = { count: 0, ids: new Array(MOVE_JOURNAL_SIZE), xy: new Float64Array(MOVE_JOURNAL_SIZE * 4) };
        moveJournals.set(b.tokens, journal);
    }
    const slot = journal.count % MOVE_JOURNAL_SIZE;
    journal.ids[slot] = id;
    journal.xy[slot * 4] = fx;
    journal.xy[slot * 4 + 1] = fy;
    journal.xy[slot * 4 + 2] = tx;
    journal.xy[slot * 4 + 3] = ty;
    journal.count++;
}

/** How many moves the current board has journalled, ever (a position, not a size). */
export function moveCount() {
    return moveJournals.get(board()?.tokens)?.count || 0;
}

/**
 * Call `fn(id, fromX, fromY, toX, toY)` for every move journalled on the
 * current board after position `since`, oldest first. Returns **false** — and
 * calls nothing — when some of those moves are no longer kept (start over).
 */
export function eachMoveSince(since, fn) {
    const journal = moveJournals.get(board()?.tokens);
    const count = journal?.count || 0;
    if (since === count) return true;
    if (!journal || since > count || count - since > MOVE_JOURNAL_SIZE) return false;
    const { ids, xy } = journal;
    for (let i = since; i < count; i++) {
        const slot = i % MOVE_JOURNAL_SIZE;
        fn(ids[slot], xy[slot * 4], xy[slot * 4 + 1], xy[slot * 4 + 2], xy[slot * 4 + 3]);
    }
    return true;
}

/**
 * After a Token's point changes: a claimed Token keeps its hero, and the claim's last-known point
 * follows. A flag pinned to it moves with it: a pinned flag's point is its Token's centre, so the
 * hero walks after the Token and, should it be used up, the flag is left standing at its last spot.
 */
function afterPointChange(b, instance) {
    bumpLayout(b);
    for (const claim of runtimeOf(b).claims.values()) {
        if (claim.instanceId === instance.id) {
            claim.x = instance.x;
            claim.y = instance.y;
        }
    }
    for (const flag of Object.values(b.flags || {})) {
        if (flag?.pinnedTo === instance.id) {
            flag.x = instance.x;
            flag.y = instance.y;
        }
    }
}

/**
 * Put a Token on the mat at `(x, y)`. **No rules** — callers apply them.
 *
 * The instance itself is stored (not a copy) and gains `x`, `y` and, if it has
 * none, `placedAt`. A Token that is already on the mat is simply moved.
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
    // Every call bumps membership, including a different object replacing the same id above: a
    // cached list holding the old instance would be stale. Over-bumping on a plain move-through-add
    // (`placeTokenAt`) is harmless.
    bumpMembership(b);
    afterPointChange(b, instance);
    return instance;
}

/**
 * Take Token `id` off the mat and return it (or null). No rules.
 *
 * Its `x`, `y` and `placedAt` stay on the instance: a Token lifted and put
 * straight back down elsewhere keeps its place in the arrival order, as a move
 * does.
 */
export function removeToken(id) {
    const b = board();
    const instance = id ? b?.tokens?.[id] : null;
    if (!instance) return null;
    delete b.tokens[id];
    bumpLayout(b);
    bumpMembership(b);
    return instance;
}

/** Move Token `id` to `(x, y)`, keeping its `placedAt`. No rules. Returns false if it is not on the mat. */
export function setTokenPoint(id, x, y) {
    const b = board();
    const instance = id ? b?.tokens?.[id] : null;
    if (!instance || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const fx = instance.x;
    const fy = instance.y;
    instance.x = x;
    instance.y = y;
    journalMove(b, id, fx, fy, x, y);
    afterPointChange(b, instance);
    return true;
}

/**
 * Carry out a push that `MatPlacement.forceSpot` decided: move each pushed Token to its new point.
 * No rules; the push was already checked.
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

/** No Tokens — a frozen, shared empty list for when there is no board. */
const EMPTY_TOKENS = Object.freeze([]);

/**
 * The cached Token list. Rebuilt only when membership changes (an add or a remove, never a move),
 * so a tick that neither adds nor removes anything reuses the same array. Replaced, never patched:
 * a caller mid-iteration when a Token is added or removed keeps walking its own snapshot, exactly
 * as a fresh `Object.values().sort()` would have (`BoardTokensWritePath.test.js`,
 * `FreeReaders.test.js`).
 */
let tokenListCache = { tokens: null, version: -1, list: EMPTY_TOKENS };

/**
 * Every Token on the mat, in the order they arrived (`placedAt` ascending).
 *
 * ⚠️ Shared and frozen. Iterate it, map it, filter it, never mutate it, and never hand it to a UI
 * selector: the instances inside it move in place (their `x`/`y` change without the array
 * changing), so a selector that returned this list itself would deep-compare equal to a stale
 * snapshot and miss every move.
 */
export function tokens() {
    const map = board()?.tokens || null;
    if (!map) return EMPTY_TOKENS;
    const version = membershipVersions.get(map) || 0;
    if (tokenListCache.tokens === map && tokenListCache.version === version) return tokenListCache.list;
    const list = Object.freeze(
        Object.values(map)
            .filter(t => t?.typeId)
            .sort((a, b) => (a.placedAt ?? 0) - (b.placedAt ?? 0))
    );
    tokenListCache = { tokens: map, version, list };
    return list;
}

/** Every Token whose centre is exactly `(x, y)`, in arrival order. */
export function tokensAtPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return tokens().filter(t => t.x === x && t.y === y);
}

/**
 * The discard bin, the saved half: `board.bin` is an array of whole Token instances lifted off the
 * mat, in the order they went in. They are not in `board.tokens`, so nothing that walks the mat
 * (work, adjacency, spawner families, drawing) sees them. The rules (what may go in, refunds,
 * discarding) live in `DiscardBin.js`; this is the storage only. The live array is returned, so
 * callers must not hold it across a load.
 */
export function binTokens() {
    return board()?.bin || [];
}

/**
 * Flags, the saved half: `board.flags[heroId] = { x, y, plantedAt, pinnedTo? }` is where each
 * hero's flag stands, in mat units. A hero with no flag is in the Dock; the Dock is not a data
 * structure.
 *
 * `pinnedTo` is the instance id of the Token the flag is pinned to (its hero works only that Token)
 * and is absent on an area flag. While pinned, `x`/`y` are that Token's centre and follow it when
 * it moves (`afterPointChange`); `Flags.js` lapses the pin when the Token is gone.
 *
 * `plantedAt` comes from `board.nextFlagOrder`, a counter bumped on every plant, and is the order
 * heroes choose in (earlier flags choose first).
 *
 * This layer knows the shape only. Choosing, claiming and releasing are rules, and live in
 * `Flags.js`.
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

/**
 * Which Token each flag is working right now: the live record, never saved as such. The save keeps
 * a separate note of the Tokens heroes had reached (`board.workClaims`, below under Saved work),
 * and `Flags.restoreWork` rebuilds claims from it on load.
 * - `claims`: heroId → `{ instanceId, typeId, x, y }`, keyed by Token instance id, so a Token that
 * moves carries its hero. `x`, `y` is the Token's last-known point, refreshed whenever it moves, so
 * a hero whose Token has left can still find the spot it stood on.
 * - the rest (`skips`, retry times, notices, cycle ends, clock) belong to `Flags.js`.
 *
 * ⚠️ Kept per board object, not per module: a new game or a load replaces `GameState.state`, and
 * with it the board, so nothing claimed on one board can leak onto another, including the
 * hand-built boards the test suites swap in between tests.
 */
const runtimes = new WeakMap();

function runtimeOf(b) {
    let rt = runtimes.get(b);
    if (!rt) {
        rt = {
            claims: new Map(),
            skips: new Map(),
            skipsByHero: new Map(),
            nextTryAt: new Map(),
            // Heroes who just finished a cycle, to look for better work.
            cycleEnded: new Set(),
            // Heroes a hostile enemy attacked, heroId → that enemy's instance id: they fight back
            // whatever their rules say.
            ambushes: new Map(),
            // Where each hero on the mat actually is: see Hero bodies below. Owned by
            // `HeroMotion.js`.
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

/**
 * Where a hero on the mat actually is, as they walk: `heroId → { x, y, targetId, side, atWork,
 * moving, facing }`. Never saved: on load a hero is placed from the saved work note (`workClaims`)
 * or beside their flag. `HeroMotion.js` is the only writer; this file just holds them and answers
 * the seam's has-the-hero-arrived question.
 *
 * `atWork` is the instance id of the claimed Token the hero has reached. Until then they are
 * walking to it and do not count as working it. Once reached it sticks for that claim, even if the
 * Token is moved and they have to catch up, so a moved Token keeps its progress and a moved enemy
 * keeps its fight.
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

/**
 * The only three questions the rest of the game may ask about where a hero is. `WorkerSeam.test.js`
 * fails if any other file reads the flag storage.
 * - `workerOf(instanceId)`: who works this Token (damage, statuses, roles, gear feeding the Token,
 * filters, the tick)
 * - `workTokenOf(heroId)`: the instance id of the Token this hero works (their cycle, their idle
 * mark, where their actor rules act from)
 * - `displayPointOf(heroId)`: the mat point to draw them at (badges, particles, level-up pops)
 *
 * `workerOf(id)` is the hero whose flag has claimed that Token, while it is on the mat and the hero
 * has arrived (walking to it is not working it). ⚠️ A spot with no Token has no worker, ever.
 * `workTokenOf(heroId)` is the claimed Token's id while it is on the mat and the hero has arrived,
 * or null (Flags reads the claim itself through `claimOfHero`: a claim is made when the hero sets
 * off). `displayPointOf(heroId)` is the claimed Token's centre, else their flag's point, else null
 * (in the Dock).
 */
export function workerOf(instanceId) {
    if (typeof instanceId !== 'string' || !instanceId) return null;
    if (!board()?.tokens?.[instanceId]) return null;
    const heroId = heroOfInstance(instanceId);
    return heroId && arrivedAt(heroId, instanceId) ? heroId : null;
}

/**
 * The instance id of the Token `heroId` works, or null.
 *
 * A read, not a write: a seam documented as a question silently writing is the kind of thing a
 * future cache or memo over it would break.
 */
export function workTokenOf(heroId) {
    if (!heroId) return null;
    const claim = claimOfHero(heroId);
    if (!claim) return null;
    const instance = getTokenById(claim.instanceId);
    if (!instance) return null;
    return arrivedAt(heroId, instance.id) ? instance.id : null;
}

/** The mat point to draw `heroId` at: claimed Token > flag > null. */
export function displayPointOf(heroId) {
    if (!heroId) return null;
    const work = getTokenById(workTokenOf(heroId));
    if (work) return { x: work.x, y: work.y };
    const flag = flagOf(heroId);
    return flag ? { x: flag.x, y: flag.y } : null;
}
