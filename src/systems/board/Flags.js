// Flags: heroes choose their own work

import { EventBus } from '../core/EventBus.js';
import { GameState } from '../../state/GameState.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { matTuning, onMatTuningChanged } from '../../config/matTuning.js';
import { artRadiusOf } from '../../config/matGeometry.js';
import * as BoardState from './BoardState.js';
import * as HeroMotion from './HeroMotion.js';
import { centreOf, distanceSq } from './nearby.js';
import * as WorkCheck from './WorkCheck.js';
import { workConfigOf } from './StationRecipe.js';
import * as BoardCombat from './BoardCombat.js';
import * as BoardPromotion from './BoardPromotion.js';
import * as FlagRules from './FlagRules.js';
import { ensureFlagColour } from './FlagColours.js';
import * as PromotionSystem from '../hero/PromotionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Flags: a hero plants a flag, and works anything they can around it.
 *
 * The saved half (where each flag stands) and the runtime claim records live in `BoardState`; each
 * hero's rules live on the hero (`FlagRules`). This file is the behaviour: which Token a flag
 * claims, when it lets go, and which Tokens it passed over.
 *
 * A flag is a point on the mat and the global flag radius (Mat Tuner). A flag has no skill of its
 * own: the hero works every skill they hold, plus combat, shaped by their rules (allowed, priority
 * 1-5). One hero per Token. The hero appears at the Token they work.
 *
 * Choosing (phase 2 of `assign`): first any Promotion Token or Guild Hall under the flag's point
 * (the radius and the rules do not apply to them). Then every worked Token and enemy whose centre
 * is within the radius, ordered by priority (1 first), then distance, then the earlier-placed
 * Token. Each candidate's rule is its Token's skill, or `FlagRules.FIGHT` for an enemy. For each,
 * in order (cheap checks before `WorkCheck`):
 * 1. the player disallowed it: `disallowed`;
 * 2. a worked Token that names no skill: `no_skill`;
 * 3. the hero lacks that skill / cannot fight: `unskilled`;
 * 4. the hero's rule for it is off: `rule_off`;
 * 5. another flag already holds it: `claimed`;
 * 6. a Promotion Token that would not train this hero: `same_job` or its gate reason, so a hero who
 * has just accepted goes back to work;
 * 7. the shared `WorkCheck` says it cannot run: skipped with that reason (level too low, missing
 * inputs, no recipe, charges);
 * 8. otherwise claimed.
 *
 * Nothing claimable: retry in a second of game time (or sooner, when the board changes: see dirty).
 *
 * Keeping a claim (phase 1) is sticky: a claim is kept while its Token is workable, wherever that
 * Token now is, so a moved Token carries its hero, even outside the radius. It is let go when the
 * Token stops being eligible, or the hero can no longer work it (skill, or its rule switched off),
 * or, for a fixable problem (inputs, charges, no recipe), only once another Token in range can run.
 *
 * Better work appears: a hero never leaves mid-cycle for a higher priority. When the hero's cycle
 * completes (a kill, for a fight), the next pass looks again, and they switch only to a strictly
 * better priority they can claim. The finished cycle has already zeroed the Token, so nothing is
 * lost.
 *
 * If the claimed Token is gone from the board: (a) the same kind of Token stands at its last spot,
 * unclaimed: claim that; (b) otherwise let go, and choose again this very pass.
 *
 * ⚠️ Leaving resets progress: every release (moving on, a re-plant, a recall) zeroes the released
 * Token's cycle. A moved Token that keeps its hero keeps its progress.
 *
 * ⚠️ No rebuild storms: `HERO_MOVED` makes `TileModifiers` rebuild two neighbourhoods, so it is
 * published only when a claim actually changes (and once per plant, furl or lapsed pin). A stable
 * board publishes none (`Flags.test.js` runs 100 ticks).
 *
 * Pinned flags: a flag the player drops onto a Token (`plant(…, { pin: true })`, the drop route
 * only) is pinned to it (`flag.pinnedTo` is that Token's instance id) and the hero works only that
 * Token: the radius, the priorities, other Tokens, enemies they would seek and anything under the
 * flag's point are all ignored (`evaluate`).
 * - Only a Token the hero can work is pinned (`pinRefusal`): a worked Token or an enemy, not
 * disallowed, naming a skill, held at the level it asks, with the hero's rule on. A spawner (or
 * anything else no hero works; promotion Tokens and the Guild Hall keep their own under-the-flag
 * rule) is silently a normal area flag. A skill or level refusal plants a normal area flag at the
 * drop point and publishes `PIN_REFUSED`, which the hero's speech bubble says. A fixable problem
 * (inputs, charges, no recipe) does not refuse: the hero can work it once it is fixed.
 * - While pinned the flag's point is the Token's centre: `BoardState` moves it with the Token, so a
 * moved Token carries its flag and the hero walks after it.
 * - When the pinned Token leaves the mat (used up, removed, binned, or turned into something else:
 * a transform is a fresh instance, so a tree becoming a stump counts) the pin lapses at the start
 * of the next `assign`: the flag stays at the Token's last spot as a normal area flag and the hero
 * chooses again that same pass. Never re-pinned by itself.
 * - A pin whose Token is still there but can no longer be worked (disallowed later, a rule switched
 * off, another hero on it) is kept: the hero waits by it, and the flag's hover says why.
 *
 * Attacked heroes fight back: a hostile enemy (`Hostiles.js`) attacks a hero through {@link
 * ambush}: the hero drops their work and claims that enemy, and keeps it whatever their Fight rule
 * or pin says until the kill or the enemy is gone. The rules here still govern only what a hero
 * seeks.
 */

/** How long a flag with nothing to do waits before looking again, in game ms. */
export const RETRY_MS = 1000;

/** Skip reasons beyond the runner's `ALERT` vocabulary. */
export const SKIP = Object.freeze({
    /** The Token names no skill, so no flag works it. */
    NO_SKILL: 'no_skill',
    /** Another hero's flag already holds it. */
    CLAIMED: 'claimed',
    /** The player marked it "heroes may not work this". */
    DISALLOWED: 'disallowed',
    /** A Promotion Token offering the job the hero already holds. */
    SAME_JOB: 'same_job',
    /** The hero's own rule for this skill (or Fight) is switched off. */
    RULE_OFF: 'rule_off'
});

/**
 * Whether the player has marked this Token disallowed.
 *
 * ⚠️ Stops hero work and nothing else. The Token's own rules (Provides, triggers) never read this.
 * Saved on the instance, so it survives a reload and a move.
 */
export function isDisallowed(instance) {
    return instance?.disallowed === true;
}

/** Fixable reasons: the ones that keep a red badge and earn a notice. */
export const FIXABLE = WorkCheck.FIXABLE;

/**
 * The live flag radius, in mat units: the Mat Tuner's base plus the Guild Hall's Scouting Flags
 * upgrade (`progress.flagRadiusBonus`).
 */
export function flagRadius() {
    const bonus = GameState.state?.progress?.flagRadiusBonus || 0;
    return matTuning('flagRadius') + bonus;
}

/**
 * Whether a Token centred at `point` is within a flag's reach — its centre
 * inside the radius. The ONE test: heroes use it to find work, and the reach
 * ring uses it to decide whether to show while a Token is dragged.
 */
export function flagReaches(flag, point) {
    if (!flag || !point) return false;
    const radius = flagRadius();
    return distanceSq({ x: flag.x, y: flag.y }, point) <= radius * radius;
}

const rt = () => BoardState.flagRuntime();

/** The instance id `heroId`'s flag is pinned to, or null (an area flag). */
export function pinnedIdOf(heroId) {
    const id = BoardState.flagOf(heroId)?.pinnedTo;
    return typeof id === 'string' && id ? id : null;
}

/** The Token `heroId`'s flag is pinned to, while it is still on the mat; else null. */
export function pinnedTokenOf(heroId) {
    const id = pinnedIdOf(heroId);
    return id ? BoardState.getTokenById(id) : null;
}

/** Something changed that could make a skipped Token workable: look again next tick. */
export function markDirty() {
    const r = rt();
    if (r) r.dirty = true;
}

/** Batching depth: while > 0, claim changes do not announce themselves. */
let quiet = 0;

/**
 * A `HERO_MOVED` payload for `heroId`: the Token they work (`instanceId`, or null) and the mat
 * point they are drawn at (`x`, `y`, absent in the Dock).
 */
export function heroMovedPayload(heroId, extra = {}) {
    const point = BoardState.displayPointOf(heroId);
    return {
        heroId,
        instanceId: BoardState.workTokenOf(heroId),
        ...(point ? { x: point.x, y: point.y } : {}),
        ...extra
    };
}

function announceMoved(heroId) {
    if (quiet > 0) return;
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, heroMovedPayload(heroId));
}

/**
 * Whether a Token names a work skill. Same test as `workSkillRule.js`, applied
 * here only after enemies and Promotion Tokens (its two exemptions) are sorted
 * out — which is why it can be this cheap on the chooser's hot path.
 */
function hasWorkSkill(def) {
    // `workConfigOf`: a Foundation is worked with its `foundation.skill` though it authors no
    // `config`.
    const skill = workConfigOf(def)?.skill;
    return typeof skill === 'string' && skill.trim() !== '';
}

/**
 * 'enemy' | 'promotion' | 'hall' | 'work' | null (nothing a hero works).
 *
 * 'hall': the Guild Hall has no work of its own today (its income is Passive Production, no hero
 * needed). Should it be given a work cycle, it is treated like a Promotion Token: worked only when
 * a flag is planted on it, whatever the flag's skill.
 */
function kindOf(instance, def) {
    if (BoardCombat.isEnemyToken(instance)) return 'enemy';
    if (BoardPromotion.isPromotionToken(instance)) return 'promotion';
    if (!workConfigOf(def) || def.requiresHero === false) return null;
    if (instance.typeId === 'token_guild_hall' || def.isGuildHall) return 'hall';
    return 'work';
}

/** Kinds worked only when the flag's point is on them, ignoring skill and radius. */
const UNDER_POINT = new Set(['promotion', 'hall']);

/** Whether a mat point sits on a Token: inside its art circle (`matGeometry.artRadiusOf`). */
export function pointOnToken(instance, point) {
    const centre = centreOf(instance);
    if (!centre || !point) return false;
    const r = artRadiusOf(instance.typeId);
    return distanceSq(point, centre) <= r * r;
}

/**
 * The Token under a mat point: of every Token whose art circle holds the point,
 * the one with the **nearest centre** (the earlier-placed on a tie), or null.
 */
export function tokenAtPoint(point) {
    if (!point) return null;
    let best = null;
    for (const instance of BoardState.tokens()) {
        if (!pointOnToken(instance, point)) continue;
        const d = distanceSq(point, centreOf(instance));
        if (!best || d < best.d) best = { instance, d };
    }
    return best ? best.instance : null;
}

/**
 * The rule a candidate answers to: the worked Token's skill, or Fight for an
 * enemy. Null for kinds the rules never touch (promotion, hall) and for a work
 * Token naming no skill.
 */
function ruleIdOf(kind, def) {
    if (kind === 'enemy') return FlagRules.FIGHT;
    if (kind === 'work' && hasWorkSkill(def)) return workConfigOf(def).skill;
    return null;
}

/**
 * Where a claim ranks when looking for better work: 0 for anything under the flag's point (it
 * outranks every priority), else the priority of its rule. Lower is better.
 */
function rankOf(heroId, kind, def) {
    if (UNDER_POINT.has(kind)) return 0;
    const ruleId = ruleIdOf(kind, def);
    return ruleId ? FlagRules.ruleOf(heroId, ruleId).priority : FlagRules.PRIORITY_MAX + 1;
}

/**
 * Whether the hero may take this rule's work at all: holds it (or can fight)
 * and has not switched it off. The single eligibility test phase 1 uses.
 */
function ruleAllows(heroId, ruleId) {
    return FlagRules.holdsRule(heroId, ruleId) && FlagRules.ruleOf(heroId, ruleId).allowed;
}

/**
 * Why this Promotion Token would not train `heroId`: a skip reason, or null if it would. Already
 * holding the job reads `same_job`; failing the skill gate reads as the board's own `unskilled` /
 * `access`.
 */
function promotionRefusal(heroId, instance) {
    const job = BoardPromotion.jobFor(instance);
    if (!job) return null;
    const blocked = BoardPromotion.blockedReason(heroId, job.id);
    if (!blocked) return null;
    if (blocked.reason === PromotionSystem.REFUSAL.SAME_JOB) return SKIP.SAME_JOB;
    return blocked.alert || ALERT.UNSKILLED;
}

/** Zero a Token's cycle: the forfeit when a hero leaves it. */
function resetProgress(instance) {
    if (!instance || !(instance.cycleElapsedMs > 0)) return;
    instance.cycleElapsedMs = 0;
    EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: instance.id, percent: 0 });
}

/**
 * Let go of `heroId`'s claim, resetting the Token they leave, and ending their fight at once if it
 * was an enemy, so the enemy is whole the next time anyone engages it, including this hero
 * re-planting on it.
 */
function release(heroId) {
    // A cycle-end mark belongs to the claim it was earned on, and so does an ambush: letting go of
    // the enemy ends the fight-back.
    rt()?.cycleEnded.delete(heroId);
    rt()?.ambushes.delete(heroId);
    const claim = BoardState.claimOfHero(heroId);
    if (!claim) return null;
    resetProgress(BoardState.getTokenById(claim.instanceId));
    BoardState.setClaim(heroId, null);
    BoardCombat.endFightOfHero(heroId);
    HeroMotion.settle(heroId);
    return claim;
}

function claimToken(heroId, instance) {
    // ⚠️ A new claim starts with no cycle-end mark, or the better-work check could switch the hero
    // off it one tick into its first cycle.
    rt()?.cycleEnded.delete(heroId);
    BoardState.setClaim(heroId, { instanceId: instance.id, typeId: instance.typeId, x: instance.x, y: instance.y });
    // A different hero taking a Promotion Token is the gesture that asks again. The same hero
    // coming back after a gap is not.
    if (instance.promotionHeroId && instance.promotionHeroId !== heroId) {
        BoardPromotion.clearPause(instance);
    }
    // ⚠️ A Token a flag skipped carries that skip's red badge. It passed the check to be claimed,
    // so the badge is stale, and phase 1 reads the badge to decide whether a claimed Token is
    // stuck, so a stale one would make the hero leave the Token they just chose.
    if (instance.alert) {
        instance.alert = null;
        EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: instance.id, alert: null });
    }
    // The hero sets off toward it, or, already standing there, starts now (work begins on arrival).
    HeroMotion.settle(heroId);
}

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

/**
 * What `heroId`'s flag passed over, in the order it looked (nearest first), as `[{ instanceId,
 * reason, typeId }]`: the pennant's hover text. A Token that has since left the board is left out.
 */
export function skipsOfHero(heroId) {
    const r = rt();
    const ids = r?.skipsByHero.get(heroId);
    if (!ids) return [];
    const out = [];
    for (const instanceId of new Set(ids)) {
        const instance = BoardState.getTokenById(instanceId);
        if (!instance) continue;
        for (const s of r.skips.get(instanceId) || []) {
            if (s.heroId !== heroId) continue;
            out.push({ instanceId, reason: s.reason, typeId: instance.typeId });
        }
    }
    return out;
}

/** Whether some flag skipped this Token for a reason the player can fix. */
export function hasFixableSkip(instance) {
    return skipsOf(instance?.id).some(s => FIXABLE.has(s.reason));
}

/**
 * Walk a flag's candidates in order and return the first it can claim, with every skip recorded on
 * the way (see the file comment for the order).
 *
 * @param {string|null} excludeInstanceId a Token not to consider (the one held)
 * @param {number} [belowRank] only consider candidates ranked strictly better than this (the look
 * for better work): the walk stops at the first candidate that is not
 */
function evaluate(heroId, flag, excludeInstanceId = null, belowRank = Infinity) {
    const point = { x: flag.x, y: flag.y };
    const from = HeroMotion.heroPointOf(heroId) || point;
    const underPoint = [];
    const inRange = [];

    // A pinned flag has one candidate, its Token: no radius, no other Token, no enemy to seek,
    // nothing under the point. It still passes every check below, so a pinned hero waits (with the
    // reason recorded) rather than working something they cannot. A lapsed pin is an area flag
    // again by the time anything calls this (`lapsePins`).
    const pinnedId = typeof flag.pinnedTo === 'string' ? flag.pinnedTo : null;
    if (pinnedId) {
        const instance = pinnedId === excludeInstanceId ? null : BoardState.getTokenById(pinnedId);
        const def = instance ? getTokenType(instance.typeId) : null;
        const kind = instance ? kindOf(instance, def) : null;
        if (kind) {
            const ruleId = ruleIdOf(kind, def);
            const rank = ruleId ? FlagRules.ruleOf(heroId, ruleId).priority : FlagRules.PRIORITY_DEFAULT;
            inRange.push({ instance, def, kind, d: 0, ruleId, rank });
        }
    }

    const under = pinnedId ? null : tokenAtPoint(point);

    for (const instance of (pinnedId ? [] : BoardState.tokens())) {
        if (!instance?.typeId || instance.id === excludeInstanceId) continue;
        const def = getTokenType(instance.typeId);
        const kind = kindOf(instance, def);
        if (!kind) continue;

        if (UNDER_POINT.has(kind)) {
            if (instance === under) underPoint.push({ instance, def, kind, rank: 0 });
            continue;
        }

        // Work and enemies alike: no split between combat and work.
        const centre = centreOf(instance);
        if (!centre || !flagReaches(flag, centre)) continue;
        // Reach is measured from the flag; nearest from the hero.
        const d = distanceSq(from, centre);
        const ruleId = ruleIdOf(kind, def);
        const rank = ruleId ? FlagRules.ruleOf(heroId, ruleId).priority : FlagRules.PRIORITY_DEFAULT;
        inRange.push({ instance, def, kind, d, ruleId, rank });
    }

    // Priority first, then nearest, then the earlier-placed Token.
    inRange.sort((a, b) => a.rank - b.rank || a.d - b.d
        || (a.instance.placedAt ?? 0) - (b.instance.placedAt ?? 0));

    const skips = [];
    for (const c of [...underPoint, ...inRange]) {
        if (c.rank >= belowRank) break;
        const instanceId = c.instance.id;
        if (isDisallowed(c.instance)) { skips.push({ instanceId, reason: SKIP.DISALLOWED }); continue; }
        if (c.kind === 'work' && !c.ruleId) { skips.push({ instanceId, reason: SKIP.NO_SKILL }); continue; }
        if (c.ruleId) {
            if (!FlagRules.holdsRule(heroId, c.ruleId)) { skips.push({ instanceId, reason: ALERT.UNSKILLED }); continue; }
            if (!FlagRules.ruleOf(heroId, c.ruleId).allowed) { skips.push({ instanceId, reason: SKIP.RULE_OFF }); continue; }
        }
        const holder = BoardState.heroOfInstance(instanceId);
        if (holder && holder !== heroId) { skips.push({ instanceId, reason: SKIP.CLAIMED }); continue; }
        if (c.kind === 'promotion') {
            const reason = promotionRefusal(heroId, c.instance);
            if (reason) { skips.push({ instanceId, reason }); continue; }
        }
        if (c.kind === 'work') {
            const reason = WorkCheck.whyCannotRun(c.instance.id, c.instance, heroId, workConfigOf(c.def, c.instance));
            if (reason) { skips.push({ instanceId, reason }); continue; }
        }
        return { pick: c, skips };
    }
    return { pick: null, skips };
}

/** Phase 2 for one hero with no claim. */
function choose(r, heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) return false;

    const { pick, skips } = evaluate(heroId, flag);
    recordSkips(r, heroId, skips);

    if (!pick) {
        r.nextTryAt.set(heroId, r.clock + RETRY_MS);
        return false;
    }

    claimToken(heroId, pick.instance);
    r.nextTryAt.delete(heroId);


    announceMoved(heroId);
    return true;
}

/**
 * The better-work switch: let go of the held Token (already at zero, a cycle just ended) and claim
 * `pick`. Skips are recorded, exactly as when choosing.
 */
function switchTo(r, heroId, pick, skips) {
    release(heroId);
    recordSkips(r, heroId, skips);
    claimToken(heroId, pick.instance);
    r.nextTryAt.delete(heroId);
    announceMoved(heroId);
}

/**
 * The unclaimed-or-not Token of `typeId` standing exactly on a remembered
 * point — what a hero whose Token left looks for at its last spot.
 */
function sameKindAt(x, y, typeId) {
    return BoardState.tokensAtPoint(x, y).find(t => t.typeId === typeId) || null;
}

/** Phase 1 for a hero holding a claim. */
function keepOrRelease(r, heroId, dirty) {
    const flag = BoardState.flagOf(heroId);
    const claim = BoardState.claimOfHero(heroId);
    const instance = BoardState.getTokenById(claim.instanceId);

    // ⚠️ Fighting back: a hero a hostile enemy attacked holds that enemy whatever their rules or
    // pin say, until a kill (its `CYCLE_COMPLETE`) or the enemy leaves the mat. Then the ambush is
    // over and this same pass treats the claim like any other: kept if their own rules would keep
    // it, else let go, and their flag (or pin) chooses again.
    const ambushId = r.ambushes.get(heroId);
    if (ambushId) {
        const over = ambushId !== claim.instanceId || !instance || r.cycleEnded.has(heroId);
        if (over) r.ambushes.delete(heroId);
        else if (!isDisallowed(instance) && FlagRules.canFight(heroId)) {
            claim.x = instance.x;
            claim.y = instance.y;
            return;
        }
    }

    if (instance) {
        claim.x = instance.x;
        claim.y = instance.y;
        const def = getTokenType(instance.typeId);
        const kind = kindOf(instance, def);

        // A pinned hero holds nothing but their pinned Token.
        const pinnedId = typeof flag?.pinnedTo === 'string' ? flag.pinnedTo : null;
        const eligible = !isDisallowed(instance) && (!pinnedId || pinnedId === instance.id) && (
            (kind === 'hall')
            || (kind === 'promotion' && !promotionRefusal(heroId, instance))
            || (kind === 'enemy' && ruleAllows(heroId, FlagRules.FIGHT))
            || (kind === 'work' && hasWorkSkill(def) && ruleAllows(heroId, workConfigOf(def).skill))
        );

        if (!eligible) {
            r.cycleEnded.delete(heroId);
            release(heroId);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
            return;
        }

        // A cycle (or a kill) just ended: take strictly better work if any can be claimed. Checked
        // here, at the start of the next pass and before any Token ticks, so the Token left behind
        // is still at zero.
        if (r.cycleEnded.delete(heroId)) {
            const { pick, skips } = evaluate(heroId, flag, instance.id, rankOf(heroId, kind, def));
            if (pick) {
                switchTo(r, heroId, pick, skips);
                return;
            }
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

        // Stuck for a fixable reason: stay until something else can run.
        if (FIXABLE.has(alert) && (dirty || r.clock >= (r.nextTryAt.get(heroId) ?? 0))) {
            const { pick, skips } = evaluate(heroId, flag, instance.id);
            if (!pick) {
                r.nextTryAt.set(heroId, r.clock + RETRY_MS);
                return;
            }
            release(heroId);
            // The Token left behind keeps its red badge.
            recordSkips(r, heroId, [{ instanceId: instance.id, reason: alert }, ...skips]);
            claimToken(heroId, pick.instance);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
        }
        return;
    }

    // The claimed Token has left the board, and with it any fight against it (a depleted camp has
    // already ended its own; a removed Token has not). Its last spot is the claim's remembered
    // point.
    BoardCombat.endFightOfHero(heroId);
    const here = sameKindAt(claim.x, claim.y, claim.typeId);
    if (here && !BoardState.heroOfInstance(here.id)) {
        resetProgress(here);
        claimToken(heroId, here);
        announceMoved(heroId);
        return;
    }

    BoardState.setClaim(heroId, null);
    r.nextTryAt.delete(heroId);
    announceMoved(heroId);
}

/**
 * A pin lapses when its Token leaves the mat: used up, removed, binned, or transformed (a fresh
 * instance, `EffectActions.transformInstance`). The flag stays where it stands (the Token's last
 * spot, since a pinned flag's point follows its Token) as a normal area flag, and the hero looks
 * for other work in its radius on this same pass. Never re-pinned by itself.
 *
 * One id lookup per pinned flag per tick: flat, like the rest of `assign`.
 */
function lapsePins(r, order) {
    for (const heroId of order) {
        const flag = BoardState.flagOf(heroId);
        if (!flag || !('pinnedTo' in flag)) continue;
        if (typeof flag.pinnedTo === 'string' && BoardState.getTokenById(flag.pinnedTo)) continue;
        const { pinnedTo: _gone, ...area } = flag;
        BoardState.setFlag(heroId, area);
        r.nextTryAt.delete(heroId);
        r.dirty = true;
        // The flag is drawn differently now (no longer on a Token), and a hero
        // standing idle by it has no claim change to announce it.
        announceMoved(heroId);
    }
}

function plantingOrder() {
    const flags = BoardState.getFlags();
    return Object.keys(flags).sort((a, b) => (flags[a].plantedAt ?? 0) - (flags[b].plantedAt ?? 0));
}

/**
 * Every flag keeps, changes or finds its work. Run once per engine tick, right after the timed
 * changes and before any Token ticks.
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

    lapsePins(r, order);

    for (const heroId of order) {
        if (BoardState.claimOfHero(heroId)) keepOrRelease(r, heroId, dirty);
    }

    for (const heroId of order) {
        if (BoardState.claimOfHero(heroId)) continue;
        if (!dirty && r.clock < (r.nextTryAt.get(heroId) ?? 0)) continue;
        choose(r, heroId);
    }
}

/** Run both phases for one hero now, ignoring the retry clock. */
export function assignHero(heroId) {
    const r = rt();
    if (!r || !BoardState.flagOf(heroId)) return;
    if (BoardState.claimOfHero(heroId)) keepOrRelease(r, heroId, true);
    if (!BoardState.claimOfHero(heroId)) choose(r, heroId);
}

/**
 * Plant `heroId`'s flag at a mat point, and let it choose at once.
 *
 * Planting the same flag at the same point changes nothing. Anything else is a re-plant: the old
 * claim is let go (its Token's progress reset), the notices re-arm, and the flag goes to the back
 * of the planting order. A flag carries no skill: what the hero works comes from their rules, which
 * a re-plant does not touch.
 */
/**
 * Why `heroId`'s flag may not be pinned to `instance`, or null if it may. `{ reason, silent }`: a
 * `silent` refusal is a Token no flag is ever pinned to (a spawner, a Token no hero works, a
 * Promotion Token or the Guild Hall, which keep their own under-the-flag rule), so the flag just
 * plants there with nothing said. Otherwise `reason` is a skip reason (`ALERT.UNSKILLED`,
 * `ALERT.ACCESS`, `SKIP.DISALLOWED`, `SKIP.RULE_OFF`), which the hero's bubble says where it has
 * words for it.
 *
 * The same gates `evaluate` applies (disallowed, the skill, the rule, the level via
 * `WorkCheck.heroReason`) minus the ones the player can fix later (inputs, charges, a recipe:
 * FIXABLE) and another hero working it, which a pinned hero simply waits out.
 */
export function pinRefusal(heroId, instance) {
    if (!heroId || !instance?.typeId) return { reason: null, silent: true };
    const def = getTokenType(instance.typeId);
    // Heroes never work a spawner itself.
    if (def?.spawner) return { reason: null, silent: true };
    const kind = kindOf(instance, def);
    if (kind !== 'work' && kind !== 'enemy') return { reason: null, silent: true };
    // A worked Token naming no skill is unfinished content: no pin, nothing said.
    if (kind === 'work' && !hasWorkSkill(def)) return { reason: SKIP.NO_SKILL, silent: true };
    if (isDisallowed(instance)) return { reason: SKIP.DISALLOWED, silent: false };
    const ruleId = ruleIdOf(kind, def);
    if (!FlagRules.holdsRule(heroId, ruleId)) return { reason: ALERT.UNSKILLED, silent: false };
    if (!FlagRules.ruleOf(heroId, ruleId).allowed) return { reason: SKIP.RULE_OFF, silent: false };
    if (kind === 'work') {
        const reason = WorkCheck.heroReason(heroId, workConfigOf(def, instance));
        if (reason) return { reason, silent: false };
    }
    return null;
}

export function plant(heroId, point, { pin = false } = {}) {
    if (!heroId || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return { success: false, reason: 'Nowhere to plant a flag' };
    }
    const r = rt();
    if (!r) return { success: false, reason: 'No board' };

    // A hero's first flag gets their lasting colour; later plants keep it.
    ensureFlagColour(heroId);

    // Planting on a Promotion Token is the deliberate gesture that asks again, even onto the very
    // spot the flag already stands on. Not when another hero holds the Token: that hero's standing
    // offer is theirs to answer.
    clearOfferUnder(heroId, point);

    // A drop inside a Token's art circle (the same test the mat uses for which Token is under the
    // pointer) pins the flag to it when the hero can work it. A pinned flag stands on the Token's
    // centre, so it moves with the Token (`BoardState`). A refused pin is an area flag at the drop
    // point, and a loud refusal is said by the hero's bubble.
    let pinTo = null;
    let refused = null;
    if (pin) {
        const target = tokenAtPoint(point);
        if (target) {
            const refusal = pinRefusal(heroId, target);
            if (!refusal) pinTo = target;
            else if (!refusal.silent) refused = { instanceId: target.id, reason: refusal.reason };
        }
    }
    const at = pinTo ? { x: pinTo.x, y: pinTo.y } : { x: point.x, y: point.y };

    const previous = BoardState.flagOf(heroId);
    if (previous && previous.x === at.x && previous.y === at.y
        && (previous.pinnedTo || null) === (pinTo?.id || null)) {
        if (refused) EventBus.publish(BOARD_EVENTS.PIN_REFUSED, { heroId, ...refused });
        return { success: true, unchanged: true, pinnedTo: pinTo?.id ?? null, pinRefused: refused?.reason ?? null };
    }

    quiet++;
    try {
        release(heroId);
        clearSkips(r, heroId);
        r.nextTryAt.delete(heroId);
        r.cycleEnded.delete(heroId);
        BoardState.setFlag(heroId, {
            x: at.x, y: at.y, plantedAt: BoardState.takeFlagOrder(),
            ...(pinTo ? { pinnedTo: pinTo.id } : {})
        });
        r.dirty = true;
        // Out of the Guild Hall (or turning round on the way home) BEFORE choosing, so nearest is
        // measured from where they are.
        HeroMotion.enter(heroId);
        assignHero(heroId);
        HeroMotion.settle(heroId);
    } finally {
        quiet--;
    }
    announceMoved(heroId);

    // The quest action deploy a hero is planting a flag, by every route: a drop from the dock, a
    // hero dragged on the board, a pennant moved, the + badge. Published here, once, so no caller
    // can forget it or announce it twice. An unchanged plant is not a deployment and returned
    // above. Names the Token the flag was planted on by `instanceId` (and its type), or null for
    // bare mat.
    const under = tokenAtPoint(point);
    EventBus.publish(ENGINE_EVENTS.HERO_DEPLOYED, { heroId, instanceId: under?.id ?? null, typeId: under?.typeId ?? null });
    // Said after the plant, so the bubble finds the hero on the mat.
    if (refused) EventBus.publish(BOARD_EVENTS.PIN_REFUSED, { heroId, ...refused });
    return { success: true, pinnedTo: pinTo?.id ?? null, pinRefused: refused?.reason ?? null };
}

/**
 * Change one of a hero's flag rules: allowed and/or priority. `ruleId` is a work skill id or
 * `FlagRules.FIGHT`.
 *
 * Refused: a skill the hero does not hold (a banked one included), Fight for a hero who cannot
 * fight, a priority that is not a whole number 1-5.
 *
 * ⚠️ Not a re-plant. The flag stays, `plantedAt` and the notices are untouched, and no
 * `hero_deployed` is published. Two effects only:
 * - switching off the rule of the Token the hero is working lets go of it now (its progress resets)
 * and the hero chooses again next pass;
 * - anything else just marks flags dirty: an idle hero looks again next tick, and a busy one takes
 * a now-better priority when their cycle ends.
 *
 * Works with no flag planted: the rules live on the hero. From the console:
 * `Game.Flags.setRule(heroId, 'forestry', { priority: 1 })`.
 *
 * @returns {{ success: boolean, reason?: string, unchanged?: boolean }}
 */
export function setRule(heroId, ruleId, { allowed, priority } = {}) {
    const hero = FlagRules.heroRecord(heroId);
    if (!hero) return { success: false, reason: 'No such hero' };
    if (!FlagRules.holdsRule(heroId, ruleId)) {
        return {
            success: false,
            reason: ruleId === FlagRules.FIGHT ? 'That hero cannot fight' : 'That hero does not hold that skill'
        };
    }
    if (allowed !== undefined && typeof allowed !== 'boolean') return { success: false, reason: 'Allowed must be true or false' };
    if (priority !== undefined && !FlagRules.isPriority(priority)) {
        return { success: false, reason: `Priority must be a whole number from ${FlagRules.PRIORITY_MIN} to ${FlagRules.PRIORITY_MAX}` };
    }

    const current = FlagRules.ruleOf(heroId, ruleId);
    const next = {
        allowed: allowed ?? current.allowed,
        priority: priority ?? current.priority
    };
    if (next.allowed === current.allowed && next.priority === current.priority) return { success: true, unchanged: true };

    if (!hero.flagRules || typeof hero.flagRules !== 'object') hero.flagRules = {};
    // Sparse: a rule back at the default is no entry at all.
    if (next.allowed && next.priority === FlagRules.PRIORITY_DEFAULT) delete hero.flagRules[ruleId];
    else hero.flagRules[ruleId] = next;

    if (!next.allowed) releaseIfWorking(heroId, ruleId);
    markDirty();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'flag_rules', heroId });
    return { success: true };
}

/** Put every one of a hero's flag rules back to allowed, priority 3. */
export function resetRules(heroId) {
    const hero = FlagRules.heroRecord(heroId);
    if (!hero) return { success: false, reason: 'No such hero' };
    if (!hero.flagRules || Object.keys(hero.flagRules).length === 0) {
        hero.flagRules = {};
        return { success: true, unchanged: true };
    }
    hero.flagRules = {};
    markDirty();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'flag_rules', heroId });
    return { success: true };
}

/** Let go of the hero's claim if it answers to `ruleId` (a rule just switched off). */
function releaseIfWorking(heroId, ruleId) {
    const claim = BoardState.claimOfHero(heroId);
    if (!claim) return;
    // An attacked hero fights back whatever the Fight rule says.
    if (rt()?.ambushes.get(heroId) === claim.instanceId) return;
    const instance = BoardState.getTokenById(claim.instanceId);
    if (!instance) return;
    const def = getTokenType(instance.typeId);
    if (ruleIdOf(kindOf(instance, def), def) !== ruleId) return;
    const r = rt();
    r?.cycleEnded.delete(heroId);
    release(heroId);
    r?.nextTryAt.delete(heroId);
    announceMoved(heroId);
}

/**
 * Whether a hero could ever work this board Token: the Tokens the Heroes-may-work-this toggle is
 * offered on: a work cycle that needs a hero and names a skill, an enemy, a Promotion Token, or the
 * Guild Hall.
 */
export function isHeroWorkable(instance) {
    if (!instance?.typeId) return false;
    const def = getTokenType(instance.typeId);
    const kind = kindOf(instance, def);
    if (kind === 'work') return hasWorkSkill(def);
    return kind !== null;
}

/** Clear a standing promotion offer on the Token under `point`, unless another hero holds it. */
function clearOfferUnder(heroId, point) {
    const instance = tokenAtPoint(point);
    if (!instance || !BoardPromotion.isPromotionToken(instance)) return;
    const holder = BoardState.heroOfInstance(instance.id);
    if (holder && holder !== heroId) return;
    BoardPromotion.clearPause(instance);
}

/**
 * Take `heroId`'s flag down: a recall, or a defeat. The hero goes to the Dock and the Token they
 * worked loses its progress. A fight ends in this call: `BoardCombat.fightOfHero` is null by the
 * time it returns.
 *
 * @returns {boolean} whether there was a flag to take down
 */
export function furl(heroId, reason = 'recall') {
    const r = rt();
    if (!r || !BoardState.flagOf(heroId)) return false;
    quiet++;
    try {
        release(heroId);
        BoardCombat.endFightOfHero(heroId);
        clearSkips(r, heroId);
        r.nextTryAt.delete(heroId);
        BoardState.setFlag(heroId, null);
        // The flag is gone at once; the hero walks, or limps, home.
        HeroMotion.sendHome(heroId, { limp: reason === 'defeat' });
        r.dirty = true;
    } finally {
        quiet--;
    }
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, instanceId: null, reason });
    return true;
}

/**
 * A hostile enemy attacks `heroId` (called by `Hostiles.js`). The hero drops whatever they were
 * doing (let go exactly as any hero leaving work is, so that Token's cycle resets) and claims the
 * enemy, which starts the fight through the normal route: they walk up to it (the enemy holds still
 * for them) and `BoardCombat.tickToken` begins the fight on arrival.
 *
 * Until the kill, or the enemy leaving the mat, `keepOrRelease` keeps the claim whatever their
 * Fight rule or pin says: the rule governs only whether a hero seeks a fight. Then their flag
 * chooses again as normal, so they go back to work (or to their pinned Token). A re-plant, a recall
 * or a defeat ends it early, as any claim.
 *
 * Refused (false): no flag, no such enemy on the mat, a hero who cannot fight (a Recruit would
 * stand there forever: no fight can start), or an enemy another hero already holds.
 *
 * @returns {boolean} whether the hero is now fighting back
 */
export function ambush(heroId, instanceId) {
    const r = rt();
    const enemy = BoardState.getTokenById(instanceId);
    if (!r || !BoardState.flagOf(heroId) || !enemy || !BoardCombat.isEnemyToken(enemy)) return false;
    if (!FlagRules.canFight(heroId)) return false;
    const holder = BoardState.heroOfInstance(instanceId);
    if (holder && holder !== heroId) return false;

    quiet++;
    try {
        if (BoardState.claimOfHero(heroId)?.instanceId !== instanceId) release(heroId);
        r.nextTryAt.delete(heroId);
        claimToken(heroId, enemy);
        r.ambushes.set(heroId, instanceId);
    } finally {
        quiet--;
    }
    announceMoved(heroId);
    return true;
}

/** The enemy that attacked `heroId` and that they are fighting back, or null. */
export function ambusherOf(heroId) {
    return rt()?.ambushes.get(heroId) ?? null;
}

/**
 * Mark a Token heroes may not work, or allow it again.
 *
 * Names the Token by instance id. Turning it on lets go of any hero working it (their progress
 * there is reset; a fight ends) and their flag chooses again on the next tick; from then on every
 * flag records `disallowed` against it and never claims it: work, combat, promotion and the Guild
 * Hall alike. Nothing else about the Token changes: its rules and triggers carry on (see
 * `isDisallowed`).
 *
 * The Token panel's Disallow switch calls this; from the console:
 * `Game.Flags.setDisallowed(instanceId, true)`.
 *
 * @returns {{ success: boolean, reason?: string, unchanged?: boolean }}
 */
export function setDisallowed(instanceId, on = true) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return { success: false, reason: 'No Token there' };
    const next = !!on;
    if (isDisallowed(instance) === next) return { success: true, unchanged: true };

    if (next) instance.disallowed = true;
    else delete instance.disallowed;

    if (next) {
        const heroId = BoardState.heroOfInstance(instance.id);
        if (heroId) {
            release(heroId);
            rt()?.nextTryAt.delete(heroId);
            announceMoved(heroId);
        }
    }

    markDirty();
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    return { success: true };
}

/**
 * Allow every disallowed Token on the mat again, at once (no confirm). Each goes through {@link
 * setDisallowed}, so flags are marked to choose again on the next tick.
 *
 * @returns {number} how many Tokens were allowed
 */
export function allowAll() {
    let n = 0;
    for (const instance of BoardState.tokens()) {
        if (!isDisallowed(instance)) continue;
        if (setDisallowed(instance.id, false).success) n++;
    }
    return n;
}

/**
 * What a hero is doing, for the dock and the idle mark: `docked` (no flag), `returning` (no flag,
 * still walking home), `working`, `walking` (on the way: to a claimed Token, `instanceId` set, or
 * back to their flag, `instanceId` null) and `idle` (at their flag, nothing to do). `instanceId` is
 * the Token they work or walk to (or null), `point` where their job is.
 */
export function statusOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) {
        // In the Dock already, but their figure may still be walking home.
        const state = HeroMotion.isReturning(heroId) ? 'returning' : 'docked';
        return { state, instanceId: null, point: null, typeId: null, flag: null, limping: HeroMotion.isLimping(heroId) };
    }
    const workId = BoardState.workTokenOf(heroId);
    if (workId) {
        return {
            state: 'working', instanceId: workId,
            point: BoardState.displayPointOf(heroId), typeId: BoardState.getTokenById(workId)?.typeId ?? null, flag
        };
    }
    const claim = BoardState.claimOfHero(heroId);
    if (claim && BoardState.getTokenById(claim.instanceId)) {
        return {
            state: 'walking', instanceId: claim.instanceId,
            point: { x: claim.x, y: claim.y }, typeId: claim.typeId, flag
        };
    }
    // Walking back to the flag after work. A stroll near the flag is still idle.
    if (HeroMotion.isWalking(heroId) && !HeroMotion.isPottering(heroId)) {
        return { state: 'walking', instanceId: null, point: { x: flag.x, y: flag.y }, typeId: null, flag };
    }
    return { state: 'idle', instanceId: null, point: BoardState.displayPointOf(heroId), typeId: null, flag };
}

/**
 * A hero finished a cycle (or a kill): their notices about that Token re-arm, and the next pass
 * looks for better work.
 *
 * ⚠️ Only noted here, not acted on. This runs inside the runner's (or the fight's) completion,
 * which carries on after publishing; letting go of the Token from in here would pull it out from
 * under that code. The next `assign` runs before any Token ticks, so the switch still lands between
 * cycles.
 */
function cycleCompleted(heroId) {
    const r = rt();
    const claim = heroId ? BoardState.claimOfHero(heroId) : null;
    if (!r || !claim) return;
    r.cycleEnded.add(heroId);
}

/**
 * The rule the hero's current work answers to (a work skill id, or `FlagRules.FIGHT` for an enemy),
 * or null (not working, or working a Promotion Token or the Guild Hall, which no rule governs).
 * Read by the rules panel to highlight the row the hero is working now.
 */
export function workingRuleOf(heroId) {
    const claim = heroId ? BoardState.claimOfHero(heroId) : null;
    if (!claim) return null;
    const instance = BoardState.getTokenById(claim.instanceId);
    if (!instance) return null;
    const def = getTokenType(instance.typeId);
    return ruleIdOf(kindOf(instance, def), def);
}

/** Drop every runtime record (claims, skips) for the current board. */
export function reset() {
    const r = rt();
    if (!r) return;
    r.claims.clear();
    r.skips.clear();
    r.skipsByHero.clear();
    r.nextTryAt.clear();
    r.cycleEnded.clear();
    r.ambushes.clear();
    r.bodies.clear();
    r.dirty = true;
}

/**
 * After a load, heroes carry on where they were. Every hero the save says had reached a Token
 * stands back beside it, on the same side, and works on: the Token's cycle progress is saved with
 * the Token, so the bar continues from where it was. A note that no longer fits (no flag, the Token
 * gone, another hero on it) is dropped and that hero chooses afresh. Everyone else starts beside
 * their flag. A fight in progress still restarts: the hero is back at the enemy, which is whole
 * again.
 *
 * Runs on `game_loaded`, right after `reset()` has cleared the runtime.
 */
export function restoreWork() {
    const r = rt();
    if (!r) return;
    const restored = [];
    for (const [heroId, note] of BoardState.savedWorkClaims()) {
        const token = BoardState.getTokenById(note?.instanceId);
        if (!BoardState.flagOf(heroId) || !token || BoardState.heroOfInstance(token.id)) {
            BoardState.forgetWorkClaim(heroId);
            continue;
        }
        HeroMotion.restoreAtWork(heroId, token, note.side === 1 ? 1 : -1);
        claimToken(heroId, token);
        restored.push(heroId);
    }
    for (const heroId of plantingOrder()) HeroMotion.placeAtFlag(heroId);
    r.dirty = true;
    for (const heroId of restored) announceMoved(heroId);
}

let unsubscribers = [];

export function teardown() {
    unsubscribers.forEach(u => u?.());
    unsubscribers = [];
}

/**
 * The "dirty" triggers: anything that can make a skipped Token workable makes
 * idle flags look again on the next tick instead of after their retry.
 */
export function init() {
    teardown();
    const dirty = () => markDirty();
    for (const event of [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_PLACED, ENGINE_EVENTS.INVENTORY_UPDATED]) {
        unsubscribers.push(EventBus.subscribe(event, dirty));
    }
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (payload = {}) => cycleCompleted(payload.heroId)));
    unsubscribers.push(onMatTuningChanged((key) => {
        if (key == null || key === 'flagRadius') markDirty();
    }));
    // The Scouting Flags upgrade widens the radius too.
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ({ upgradeId } = {}) => {
        if (upgradeId === 'flag_radius') markDirty();
    }));
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => {
        reset();
        restoreWork();
    }));
    // `BoardCombat.resolveDefeat` publishes a defeat event instead of calling `furl` directly,
    // which would make a `BoardCombat ↔ Flags` import cycle (Flags already reaches into BoardCombat
    // for `isEnemyToken`/`endFightOfHero`). `EventBus.publish` is synchronous, so this runs before
    // `resolveDefeat`'s own `TILE_CHANGED`/`COMBAT_RESOLVED` publishes.
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, ({ heroId }) => furl(heroId, 'defeat')));
}
