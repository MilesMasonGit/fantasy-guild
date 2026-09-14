// Fantasy Guild — Flags: heroes choose their own work (Free Playmat slice 1.4b)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { matTuning, onMatTuningChanged } from '../../config/matTuning.js';
import { isCombatSkill } from '../../config/registries/skillRegistry.js';
import { TILE_STEP_PX, colOf, rowOf } from '../../config/boardGeometry.js';
import * as BoardState from './BoardState.js';
import { centreOf, distanceSq } from './nearby.js';
import * as WorkCheck from './WorkCheck.js';
import * as BoardCombat from './BoardCombat.js';
import * as BoardPromotion from './BoardPromotion.js';
import * as Managers from './Managers.js';
import * as HeroManager from '../hero/HeroManager.js';
import { GameState } from '../../state/GameState.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * Flags — **a hero plants a flag, and the flag picks the work** (roadmap §4
 * slice 1.4, FP-20…FP-35, FP-47…FP-49, FP-57, FP-60, FP-61, FP-68…FP-70).
 *
 * The saved half (where each flag stands, and its skill) and the runtime claim
 * records live in `BoardState`. This file is the rules: which Token a flag
 * claims, when it lets go, and what it says about Tokens it passed over.
 *
 * ## A flag (FP-23, FP-57)
 * A point on the mat, one skill, and the global **flag radius** (Mat Tuner,
 * default 400 u — FP-65). Stage 1's flags choose **nearest to the flag's point**,
 * one hero per Token (FP-25). The hero appears at the Token they work.
 *
 * ## Choosing (phase 2 of `assign`)
 * Every Token whose centre is within the radius, nearest first (then lowest
 * anchor). For each, in order:
 *  1. no work cycle, or passive — not a candidate at all;
 *  2. **no skill named** — skipped as `no_skill` (FP-47);
 *  3. a different skill from the flag's — not a candidate;
 *  4. **another flag already holds it** — skipped as `claimed` (FP-25);
 *  5. the shared `WorkCheck` says it cannot run — skipped with that reason
 *     (FP-48: level too low, wrong skill, missing inputs, no recipe, charges);
 *  6. otherwise **claimed**.
 * Two exceptions come before the radius list and ignore it: a **Promotion Token**
 * is only ever worked when the flag's point is on it (FP-34, FP-61), and a
 * **combat flag** works only the enemy under its point (slice 1.4b — roaming the
 * radius is slice 1.4c). Neither is skill-matched.
 *
 * Nothing claimable → retry in a second of game time (or sooner, when the board
 * changes — see "dirty").
 *
 * ## Keeping a claim (phase 1) — sticky (FP-57)
 * A claim is **kept while its Token is workable, wherever that Token now is**:
 * a moved Token carries its hero, even outside the radius (FP-68). It is let go
 * when the Token stops being eligible, or the hero can no longer work it
 * (skill), or — for a fixable problem (inputs, charges, no recipe) — **only once
 * another Token in range can run** (FPP-1), with one notification (FP-69, FPP-5).
 *
 * If the claimed Token is gone from the board:
 *  a. the same kind of Token stands at its last spot, unclaimed → claim that;
 *  b. a Manager in reach owes that spot and the Vault holds a copy → **wait**
 *     there (FP-70, FPP-9), re-checked every pass;
 *  c. otherwise let go, and choose again this very pass.
 * Phase 1 runs for every hero before phase 2, so a waiting hero gets the
 * restocked Token before an earlier-planted hero looking for work.
 *
 * ## ⚠️ Leaving resets progress (FP-68, D-131)
 * Every release — moving on, a re-plant, a recall — zeroes the released Token's
 * cycle. A moved Token that keeps its hero keeps its progress.
 *
 * ## ⚠️ No rebuild storms
 * `HERO_MOVED` makes `TileModifiers` rebuild two neighbourhoods, so it is
 * published **only when a claim actually changes** (and once per plant or
 * furl). A stable board publishes none (`Flags.test.js` runs 100 ticks).
 */

/** The flag skill that fights instead of working (FP-32). */
export const COMBAT_FLAG = 'combat';

/** How long a flag with nothing to do waits before looking again, in game ms. */
export const RETRY_MS = 1000;

/** Skip reasons beyond the runner's `ALERT` vocabulary. */
export const SKIP = Object.freeze({
    /** The Token names no skill, so no flag works it (FP-47). */
    NO_SKILL: 'no_skill',
    /** Another hero's flag already holds it (FP-25). */
    CLAIMED: 'claimed'
});

/** Fixable reasons — the ones that keep a red badge and earn a notice (FP-69). */
export const FIXABLE = WorkCheck.FIXABLE;

/** The live flag radius, in mat units (Mat Tuner, FP-65/66). */
export function flagRadius() {
    return matTuning('flagRadius');
}

const rt = () => BoardState.flagRuntime();

/** Something changed that could make a skipped Token workable: look again next tick. */
export function markDirty() {
    const r = rt();
    if (r) r.dirty = true;
}

// ---------------------------------------------------------------------------
// Small rules
// ---------------------------------------------------------------------------

/** Batching depth: while > 0, claim changes do not announce themselves. */
let quiet = 0;

function announceMoved(heroId) {
    if (quiet > 0) return;
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: BoardState.displayTileOf(heroId), heroId });
}

/**
 * Whether a Token names a work skill. Same test as `workSkillRule.js`, applied
 * here only after enemies and Promotion Tokens (its two exemptions) are sorted
 * out — which is why it can be this cheap on the chooser's hot path.
 */
function hasWorkSkill(def) {
    const skill = def?.config?.skill;
    return typeof skill === 'string' && skill.trim() !== '';
}

/**
 * 'enemy' | 'promotion' | 'hall' | 'work' | null (nothing a hero works).
 *
 * ⚠️ **'hall' is a provisional exemption (1.4b), awaiting a ruling.** The Guild
 * Hall's work cycle is not authored: `GuildUpgradeManager` writes it (the
 * Wishing Well's water) with no skill, so strict FP-47 would silently stop the
 * water. It is treated like a Promotion Token instead — worked only when a flag
 * is planted on it, whatever the flag's skill.
 */
function kindOf(instance, def) {
    if (BoardCombat.isEnemyToken(instance)) return 'enemy';
    if (BoardPromotion.isPromotionToken(instance)) return 'promotion';
    if (!def?.config || def.requiresHero === false) return null;
    if (instance.typeId === 'token_guild_hall' || def.isGuildHall) return 'hall';
    return 'work';
}

/** Kinds worked only when the flag's point is on them, ignoring skill and radius. */
const UNDER_POINT = new Set(['promotion', 'hall']);

/** Whether a mat point sits on a Token's footprint (its tiles plus their gaps). */
export function pointOnToken(anchor, typeId, point) {
    const size = getTokenType(typeId)?.size || 1;
    const col = Math.floor(point.x / TILE_STEP_PX);
    const row = Math.floor(point.y / TILE_STEP_PX);
    return col >= colOf(anchor) && col < colOf(anchor) + size
        && row >= rowOf(anchor) && row < rowOf(anchor) + size;
}

/**
 * The hero's best non-combat skill — highest level, then alphabetical — or null.
 * What a flag with no skill works (FPP-7, and the bridge's fallback).
 */
export function bestWorkSkill(heroId) {
    const skills = heldSkills(heroId);
    let best = null;
    let bestLevel = -Infinity;
    for (const skill of Object.keys(skills).sort()) {
        if (isCombatSkill(skill)) continue;
        const level = skills[skill]?.level ?? 0;
        if (level > bestLevel) { best = skill; bestLevel = level; }
    }
    return best;
}

/** Whether the hero holds a skill at all (FPP-3). */
export function heroHolds(heroId, skill) {
    return !!skill && !!heldSkills(heroId)[skill];
}

/**
 * The hero's saved skill map, read straight from state.
 *
 * ⚠️ Not through `HeroManager.getHero`: that rehydrates the hero as a side
 * effect, and a flag being planted must not be what rebuilds a hero's
 * modifiers (or crash on a half-made hero record).
 */
function heldSkills(heroId) {
    const hero = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return hero?.skills && typeof hero.skills === 'object' ? hero.skills : {};
}

/** Zero a Token's cycle — the forfeit of D-131, when a hero leaves it (FP-68). */
function resetProgress(anchor, instance) {
    if (!instance || !(instance.cycleElapsedMs > 0)) return;
    instance.cycleElapsedMs = 0;
    EventBus.publish(BOARD_EVENTS.PROGRESS, { tile: anchor, percent: 0 });
}

/** Let go of `heroId`'s claim, resetting the Token they leave. */
function release(heroId) {
    const claim = BoardState.claimOfHero(heroId);
    if (!claim) return null;
    const found = BoardState.findTokenById(claim.instanceId, claim.tile);
    if (found) resetProgress(found.anchor, found.instance);
    BoardState.setClaim(heroId, null);
    return claim;
}

function claimToken(heroId, anchor, instance) {
    BoardState.setWait(heroId, null);
    BoardState.setClaim(heroId, { instanceId: instance.id, tile: anchor, typeId: instance.typeId });
    /**
     * ⚠️ A Token a flag skipped carries that skip's red badge (FPP-2). It passed
     * the check to be claimed, so the badge is stale — and phase 1 reads the
     * badge to decide whether a claimed Token is stuck, so a stale one would
     * make the hero leave the Token they just chose.
     */
    if (instance.alert) {
        instance.alert = null;
        EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { tile: anchor, alert: null });
    }
}

// ---------------------------------------------------------------------------
// Skips — what a flag passed over, and why (FP-48)
// ---------------------------------------------------------------------------

function clearSkips(r, heroId) {
    const ids = r.skipsByHero.get(heroId);
    if (!ids) return;
    for (const id of ids) {
        const rest = (r.skips.get(id) || []).filter(s => s.heroId !== heroId);
        if (rest.length) r.skips.set(id, rest);
        else r.skips.delete(id);
    }
    r.skipsByHero.delete(heroId);
}

function recordSkips(r, heroId, skips) {
    clearSkips(r, heroId);
    if (!skips.length) return;
    const ids = [];
    for (const { instanceId, reason } of skips) {
        if (!instanceId) continue;
        const list = r.skips.get(instanceId) || [];
        list.push({ heroId, reason });
        r.skips.set(instanceId, list);
        ids.push(instanceId);
    }
    r.skipsByHero.set(heroId, ids);
}

/** Every flag that skipped this Token instance, as `[{ heroId, reason }]`. */
export function skipsOf(instanceId) {
    return rt()?.skips.get(instanceId) || [];
}

/** Whether some flag skipped this Token for a reason the player can fix (FPP-2). */
export function hasFixableSkip(instance) {
    return skipsOf(instance?.id).some(s => FIXABLE.has(s.reason));
}

// ---------------------------------------------------------------------------
// The FP-69 notice (FPP-5)
// ---------------------------------------------------------------------------

const LEAVE_WHY = {
    [ALERT.INPUTS]: 'it is out of materials',
    [ALERT.CHARGES]: 'it has too few charges for a cycle',
    [ALERT.NO_RECIPE]: 'its recipe is missing a Token beside it'
};

/**
 * One warning when a hero goes elsewhere because a Token has a fixable problem
 * — once per hero, Token and reason, until that hero completes a cycle there or
 * re-plants (FPP-5).
 */
function notifyLeft(r, heroId, instance, reason) {
    if (!instance?.id || !FIXABLE.has(reason)) return;
    const key = `${heroId}|${instance.id}|${reason}`;
    if (r.notified.has(key)) return;
    r.notified.add(key);
    const hero = HeroManager.getHero(heroId);
    NotificationSystem.warning(
        `${hero?.name || 'A hero'} went elsewhere: ${tokenName(instance.typeId) || 'a Token'} can't run — ${LEAVE_WHY[reason]}.`,
        { category: 'hero', aggregationKey: `flag-leave:${heroId}:${instance.id}:${reason}` }
    );
}

function forgetNotices(r, heroId, instanceId = null) {
    const prefix = instanceId ? `${heroId}|${instanceId}|` : `${heroId}|`;
    for (const key of [...r.notified]) {
        if (key.startsWith(prefix)) r.notified.delete(key);
    }
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/**
 * Walk a flag's candidates in order and return the first it can claim, with
 * every skip recorded on the way — see the file comment for the order.
 */
function evaluate(heroId, flag, excludeInstanceId = null) {
    const point = { x: flag.x, y: flag.y };
    const radius = flagRadius();
    const radiusSq = radius * radius;
    const underPoint = [];
    const inRange = [];

    for (const [anchor, instance] of BoardState.occupiedTiles()) {
        if (!instance?.typeId || instance.id === excludeInstanceId) continue;
        const def = getTokenType(instance.typeId);
        const kind = kindOf(instance, def);
        if (!kind) continue;

        if (UNDER_POINT.has(kind) || kind === 'enemy') {
            if (kind === 'enemy' && flag.skill !== COMBAT_FLAG) continue;
            if (pointOnToken(anchor, instance.typeId, point)) underPoint.push({ anchor, instance, def, kind });
            continue;
        }

        if (flag.skill === COMBAT_FLAG) continue;
        const d = distanceSq(point, centreOf(anchor, instance.typeId));
        if (d > radiusSq) continue;
        inRange.push({ anchor, instance, def, kind, d });
    }

    inRange.sort((a, b) => a.d - b.d || a.anchor - b.anchor);

    const skips = [];
    for (const c of [...underPoint, ...inRange]) {
        const instanceId = c.instance.id;
        if (c.kind === 'work') {
            if (!hasWorkSkill(c.def)) { skips.push({ instanceId, reason: SKIP.NO_SKILL }); continue; }
            if (c.def.config.skill !== flag.skill) continue;
        }
        const holder = BoardState.heroOfInstance(instanceId);
        if (holder && holder !== heroId) { skips.push({ instanceId, reason: SKIP.CLAIMED }); continue; }
        if (c.kind === 'work') {
            const reason = WorkCheck.whyCannotRun(c.anchor, c.instance, heroId, c.def.config);
            if (reason) { skips.push({ instanceId, reason }); continue; }
        }
        return { pick: c, skips };
    }
    return { pick: null, skips };
}

/** Phase 2 for one hero with no claim and no wait. */
function choose(r, heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) return false;

    // FPP-7: a converted flag with no skill takes the hero's best, lazily.
    if (flag.skill == null) {
        const skill = bestWorkSkill(heroId);
        if (skill) flag.skill = skill;
    }

    const { pick, skips } = evaluate(heroId, flag);
    recordSkips(r, heroId, skips);

    if (!pick) {
        r.nextTryAt.set(heroId, r.clock + RETRY_MS);
        return false;
    }

    claimToken(heroId, pick.anchor, pick.instance);
    r.nextTryAt.delete(heroId);

    // Went past a nearer Token the player could fix: say so, once (FP-69).
    const passed = skips.find(s => FIXABLE.has(s.reason));
    if (passed) notifyLeft(r, heroId, BoardState.findTokenById(passed.instanceId)?.instance, passed.reason);

    announceMoved(heroId);
    return true;
}

/** Whether a hero may wait on `tile` for a restock of `typeId` (FP-70, FPP-9). */
function canWait(tile, typeId) {
    const vacancy = BoardState.getVacancy(tile);
    if (!vacancy || vacancy.typeId !== typeId || vacancy.unstocked) return false;
    if (!Managers.managerFor(tile, typeId)) return false;
    return BoardState.tokenBankCopies(typeId).length > 0;
}

/** Phase 1 for a hero holding a claim. */
function keepOrRelease(r, heroId, dirty) {
    const flag = BoardState.flagOf(heroId);
    const claim = BoardState.claimOfHero(heroId);
    const found = BoardState.findTokenById(claim.instanceId, claim.tile);

    if (found) {
        claim.tile = found.anchor;
        const { instance } = found;
        const def = getTokenType(instance.typeId);
        const kind = kindOf(instance, def);

        const eligible = UNDER_POINT.has(kind)
            || (kind === 'enemy' && flag.skill === COMBAT_FLAG)
            || (kind === 'work' && hasWorkSkill(def) && def.config.skill === flag.skill);

        if (!eligible) {
            release(heroId);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
            return;
        }
        if (kind !== 'work') return;

        // The runner raised this last tick from the same `WorkCheck`.
        const alert = instance.alert || null;

        if (alert === ALERT.ACCESS || alert === ALERT.UNSKILLED) {
            release(heroId);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
            return;
        }

        // FPP-1: stuck for a fixable reason — stay until something else can run.
        if (FIXABLE.has(alert) && (dirty || r.clock >= (r.nextTryAt.get(heroId) ?? 0))) {
            const { pick, skips } = evaluate(heroId, flag, instance.id);
            if (!pick) {
                r.nextTryAt.set(heroId, r.clock + RETRY_MS);
                return;
            }
            release(heroId);
            notifyLeft(r, heroId, instance, alert);
            // The Token left behind keeps its red badge (FPP-2).
            recordSkips(r, heroId, [{ instanceId: instance.id, reason: alert }, ...skips]);
            claimToken(heroId, pick.anchor, pick.instance);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
        }
        return;
    }

    // The claimed Token has left the board.
    const here = BoardState.getToken(claim.tile);
    if (here?.typeId === claim.typeId && !BoardState.heroOfInstance(here.id)) {
        resetProgress(claim.tile, here);
        claimToken(heroId, claim.tile, here);
        announceMoved(heroId);
        return;
    }

    BoardState.setClaim(heroId, null);
    if (canWait(claim.tile, claim.typeId)) {
        BoardState.setWait(heroId, { tile: claim.tile, typeId: claim.typeId });
    } else {
        r.nextTryAt.delete(heroId);
    }
    announceMoved(heroId);
}

/** Phase 1 for a hero waiting on a restock. */
function checkWait(r, heroId) {
    const wait = BoardState.waitOfHero(heroId);
    const here = BoardState.getToken(wait.tile);

    if (here?.typeId === wait.typeId && !BoardState.heroOfInstance(here.id)) {
        resetProgress(wait.tile, here);
        claimToken(heroId, wait.tile, here);
        announceMoved(heroId);
        return;
    }
    if (!here && canWait(wait.tile, wait.typeId)) return;

    BoardState.setWait(heroId, null);
    r.nextTryAt.delete(heroId);
    announceMoved(heroId);
}

function plantingOrder() {
    const flags = BoardState.getFlags();
    return Object.keys(flags).sort((a, b) => (flags[a].plantedAt ?? 0) - (flags[b].plantedAt ?? 0));
}

/**
 * Every flag keeps, changes or finds its work. Run once per engine tick, right
 * after `Managers.tick()` and before any Token ticks.
 *
 * @param {number} delta game ms since the last tick (the retry clock)
 */
export function assign(delta = 0) {
    const r = rt();
    if (!r) return;
    r.clock += delta;

    const dirty = r.dirty;
    r.dirty = false;

    const order = plantingOrder();
    if (!order.length) return;

    for (const heroId of order) {
        if (BoardState.claimOfHero(heroId)) keepOrRelease(r, heroId, dirty);
        else if (BoardState.waitOfHero(heroId)) checkWait(r, heroId);
    }

    for (const heroId of order) {
        if (BoardState.claimOfHero(heroId) || BoardState.waitOfHero(heroId)) continue;
        if (!dirty && r.clock < (r.nextTryAt.get(heroId) ?? 0)) continue;
        choose(r, heroId);
    }
}

/** Run both phases for one hero now, ignoring the retry clock. */
export function assignHero(heroId) {
    const r = rt();
    if (!r || !BoardState.flagOf(heroId)) return;
    if (BoardState.claimOfHero(heroId)) keepOrRelease(r, heroId, true);
    else if (BoardState.waitOfHero(heroId)) checkWait(r, heroId);
    if (!BoardState.claimOfHero(heroId) && !BoardState.waitOfHero(heroId)) choose(r, heroId);
}

// ---------------------------------------------------------------------------
// Planting and furling
// ---------------------------------------------------------------------------

/**
 * Plant `heroId`'s flag at a mat point with a skill, and let it choose at once.
 *
 * Planting the same flag at the same point with the same skill changes nothing.
 * Anything else is a re-plant: the old claim is let go (its Token's progress
 * reset — FP-68), any wait ends, the notices re-arm (FPP-5), and the flag goes
 * to the back of the planting order.
 */
export function plant(heroId, point, { skill = null } = {}) {
    if (!heroId || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return { success: false, reason: 'Nowhere to plant a flag' };
    }
    const r = rt();
    if (!r) return { success: false, reason: 'No board' };

    const previous = BoardState.flagOf(heroId);
    if (previous && previous.x === point.x && previous.y === point.y && previous.skill === skill) {
        return { success: true, unchanged: true };
    }

    quiet++;
    try {
        release(heroId);
        BoardState.setWait(heroId, null);
        clearSkips(r, heroId);
        forgetNotices(r, heroId);
        r.nextTryAt.delete(heroId);
        BoardState.setFlag(heroId, { x: point.x, y: point.y, skill, plantedAt: BoardState.takeFlagOrder() });
        r.dirty = true;
        assignHero(heroId);
    } finally {
        quiet--;
    }
    announceMoved(heroId);
    return { success: true };
}

/**
 * Take `heroId`'s flag down — a recall, or a defeat. The hero goes to the Dock
 * and the Token they worked loses its progress (FP-68).
 *
 * @returns {boolean} whether there was a flag to take down
 */
export function furl(heroId, reason = 'recall') {
    const r = rt();
    if (!r || !BoardState.flagOf(heroId)) return false;
    quiet++;
    try {
        release(heroId);
        BoardState.setWait(heroId, null);
        clearSkips(r, heroId);
        forgetNotices(r, heroId);
        r.nextTryAt.delete(heroId);
        BoardState.setFlag(heroId, null);
        r.dirty = true;
    } finally {
        quiet--;
    }
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId, reason });
    return true;
}

/**
 * What a hero is doing, for the dock and the idle mark:
 * `docked` (no flag) · `working` · `waiting` (for a restock) · `idle` (a flag,
 * nothing to do). `tile` is where they are drawn.
 */
export function statusOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) return { state: 'docked', tile: null, typeId: null, flag: null };
    const work = BoardState.workTileOf(heroId);
    if (work != null) return { state: 'working', tile: work, typeId: BoardState.getToken(work)?.typeId ?? null, flag };
    const wait = BoardState.waitOfHero(heroId);
    if (wait) return { state: 'waiting', tile: wait.tile, typeId: wait.typeId, flag };
    return { state: 'idle', tile: BoardState.displayTileOf(heroId), typeId: null, flag };
}

/** A hero finished a cycle: their notices about that Token re-arm (FPP-5). */
function cycleCompleted(heroId) {
    const r = rt();
    const claim = heroId ? BoardState.claimOfHero(heroId) : null;
    if (r && claim) forgetNotices(r, heroId, claim.instanceId);
}

/** Drop every runtime record (claims, waits, skips) for the current board. */
export function reset() {
    const r = rt();
    if (!r) return;
    r.claims.clear();
    r.waits.clear();
    r.skips.clear();
    r.skipsByHero.clear();
    r.nextTryAt.clear();
    r.notified.clear();
    r.dirty = true;
}

let unsubscribers = [];

export function teardown() {
    unsubscribers.forEach(u => u?.());
    unsubscribers = [];
}

/**
 * The "dirty" triggers: anything that can make a skipped Token workable makes
 * waiting flags look again on the next tick instead of after their retry.
 */
export function init() {
    teardown();
    const dirty = () => markDirty();
    for (const event of [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_PLACED, 'token_bank_updated', 'inventory_updated']) {
        unsubscribers.push(EventBus.subscribe(event, dirty));
    }
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (payload = {}) => cycleCompleted(payload.heroId)));
    unsubscribers.push(onMatTuningChanged((key) => {
        if (key == null || key === 'flagRadius') markDirty();
    }));
    unsubscribers.push(EventBus.subscribe('game_loaded', () => reset()));
}
