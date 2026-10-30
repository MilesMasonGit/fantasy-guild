// Flags: the heroes' orders, and the work each order claims

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isBossEnemy } from '../../config/registries/enemyProfile.js';
import { neededToolOf } from '../../config/registries/toolKinds.js';
import { artRadiusOf } from '../../config/matGeometry.js';
import { GameState } from '../../state/GameState.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as BoardState from './BoardState.js';
import * as HeroMotion from './HeroMotion.js';
import { centreOf, distanceSq } from './nearby.js';
import * as WorkCheck from './WorkCheck.js';
import * as Respawn from './Respawn.js';
import * as Growth from './Growth.js';
import * as Demolition from './Demolition.js';
import { workConfigOf } from './StationRecipe.js';
import * as BoardCombat from './BoardCombat.js';
import * as BoardPromotion from './BoardPromotion.js';
import * as Camps from './Camps.js';
import { ensureFlagColour } from './FlagColours.js';
import * as PromotionSystem from '../hero/PromotionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Orders: the player drags a hero onto a Token and they work only it ({@link orderToken}), onto
 * bare ground and they go there and idle ({@link orderSpot}), or onto the Guild Hall and they go
 * home ({@link sendHome}). An order is saved as the hero's flag record (`BoardState`): a Token order
 * is a flag pinned to that Token (`pinnedTo`); anything else is a spot (`spot`), worked nothing; a
 * hero with no record is at the Guild Hall. While pinned the record's point is the Token's centre,
 * and `BoardState` moves it with the Token, so a moved Token carries its hero.
 *
 * When the ordered Token is gone for good (used up, removed, demolished, built into something
 * else) the order becomes a spot at its last place marked `needsJob` ({@link lapsePins}); when it
 * becomes another Token in place that is still the hero's job (a tree regrowing through a Stump and
 * a Sapling) the order follows it ({@link followTransform}).
 *
 * A Token order on a **camp** (`Camps.js`: a Logging Camp, a Farmstead, an enemy camp) is the same
 * record, pinned to the camp; the hero works the camp's Tokens one at a time instead of the camp
 * itself ({@link evaluate}): the nearest free one they can work, measured from where they stand
 * (from their idle spot while they potter, so a stroll never changes the choice), then the
 * earlier-placed. They keep it while it can run and while it stays in the camp's reach (a cycle is
 * always finished), wait silently while what is left rests or grows ({@link waitingOf}), and at an
 * enemy camp wait for its next spawn.
 *
 * Claiming (`assign`, once per tick, before any Token ticks): the ordered Token, or each of a
 * camp's, is checked in this order (cheap checks before `WorkCheck`):
 * 1. the player disallowed it: `disallowed`;
 * 2. a worked Token that names no skill: `no_skill`;
 * 3. the hero lacks that skill / cannot fight: `unskilled`;
 * 4. another hero already holds it: `claimed` (the newcomer waits beside it);
 * 5. a Promotion Token that would not train this hero: `same_job` or its gate reason;
 * 6. the shared `WorkCheck` says it cannot run: skipped with that reason (level too low, no tool in
 * hand, missing inputs, no recipe, charges, resting until it respawns); a no-tool skip also says
 * "Needs Pickaxe" over the Token (`TOOL_NEEDED`);
 * 7. otherwise claimed.
 * Nothing claimable: look again in a second of game time (or sooner, when the board changes).
 *
 * Keeping a claim is sticky: kept while its Token is workable, wherever it now is. Let go when the
 * Token stops being eligible (resting until it respawns included), the hero can no longer work it
 * (skill, level, tool), or, for a fixable problem (inputs, charges, no recipe), only once another
 * Token the order allows can run. If the claimed Token left the board and the same kind of Token
 * stands at its last spot, unclaimed, that one is claimed.
 *
 * ⚠️ Leaving resets progress: every release (a new order, a recall) zeroes the released Token's
 * cycle. A moved Token that keeps its hero keeps its progress.
 *
 * ⚠️ No rebuild storms: `HERO_MOVED` makes `TileModifiers` rebuild two neighbourhoods, so it is
 * published only when a claim actually changes (and once per order, furl or lapsed pin). A stable
 * board publishes none (`Flags.test.js` runs 100 ticks).
 *
 * Attacked heroes fight back: a hostile enemy (`Hostiles.js`) attacks a hero through {@link
 * ambush}: the hero drops their work and claims that enemy, and keeps it whatever their order says
 * until the kill or the enemy is gone, then goes back to their order.
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
    SAME_JOB: 'same_job'
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

const rt = () => BoardState.flagRuntime();

/**
 * The hero record, read straight from state.
 *
 * ⚠️ Not through `HeroManager.getHero`: that rehydrates the hero as a side effect, and the
 * chooser's hot path must not rebuild a hero's modifiers (or crash on a half-made hero record).
 */
export function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** Whether the hero can fight at all (everyone can; see `CombatFormulas.canHeroFight`). */
export function canFight(heroId) {
    return CombatFormulas.canHeroFight(heroRecord(heroId));
}

/** Whether the hero holds a work skill (at any level: the level is `WorkCheck`'s). */
function holdsSkill(heroId, skillId) {
    const skills = heroRecord(heroId)?.skills;
    return !!skillId && !!skills && typeof skills === 'object' && !!skills[skillId];
}

/** The instance id `heroId`'s order is pinned to, or null (a spot, or no order). */
export function pinnedIdOf(heroId) {
    const id = BoardState.flagOf(heroId)?.pinnedTo;
    return typeof id === 'string' && id ? id : null;
}

/** The Token `heroId`'s flag is pinned to, while it is still on the mat; else null. */
export function pinnedTokenOf(heroId) {
    const id = pinnedIdOf(heroId);
    return id ? BoardState.getTokenById(id) : null;
}

/**
 * Whether a flag record is a spot order: go there and idle, work nothing. Every record not pinned
 * to a Token is one (an old save's area flag loads as a spot: `SaveMigration.migrateStateToOrders`).
 */
export function isSpot(flag) {
    return !!flag && typeof flag.pinnedTo !== 'string';
}

/** Whether `heroId`'s ordered Token is gone for good and they wait for a new order. */
export function needsJob(heroId) {
    return BoardState.flagOf(heroId)?.needsJob === true;
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
function hasWorkSkill(def, instance) {
    // `workConfigOf`: a Foundation is worked with its `foundation.skill` though it authors no
    // `config`, and a Token marked for demolition with Construction.
    const skill = workConfigOf(def, instance)?.skill;
    return typeof skill === 'string' && skill.trim() !== '';
}

/**
 * 'enemy' | 'promotion' | 'hall' | 'work' | null (nothing a hero works).
 *
 * 'hall': the Guild Hall, which is home, never a job (its income is Passive Production, no hero
 * needed): a drop on it sends the hero home.
 *
 * A Token marked for demolition is 'work' whatever it was (a spawner, a Promotion Token, a Passive
 * Generator): the same order the runner checks in.
 */
function kindOf(instance, def) {
    if (BoardCombat.isEnemyToken(instance)) return 'enemy';
    if (Demolition.isMarked(instance)) return 'work';
    if (BoardPromotion.isPromotionToken(instance)) return 'promotion';
    if (!workConfigOf(def, instance) || def.requiresHero === false) return null;
    if (instance.typeId === 'token_guild_hall' || def.isGuildHall) return 'hall';
    return 'work';
}

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
 * Whether the hero can take this kind of work at all: an enemy, if they can fight; a worked
 * Token, if they hold its skill. Promotion Tokens answer for themselves (`promotionRefusal`).
 */
function canTake(heroId, kind, def, instance) {
    if (kind === 'enemy') return canFight(heroId);
    if (kind === 'work') return holdsSkill(heroId, workConfigOf(def, instance)?.skill);
    return true;
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
 * ordered back onto it.
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
    // ⚠️ A new claim starts with no cycle-end mark, or an ambush on it would end one tick in.
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

/** The Token wants a tool its hero does not hold: the mat says which, over the Token. */
function announceToolNeeded(instanceId, heroId) {
    const need = neededToolOf(getTokenType(BoardState.getTokenById(instanceId)?.typeId));
    if (need) EventBus.publish(BOARD_EVENTS.TOOL_NEEDED, { instanceId, heroId, ...need });
}

/**
 * A Token its hero stands at is out of an input: the mat says which, over the Token ("Needs
 * Coal"). Said each time the stuck hero's flag looks again (about once a second, and as they
 * leave for other work); the callout spaces itself out (`CalloutLayer`).
 */
function announceInputNeeded(instance, heroId) {
    const itemId = WorkCheck.fixableReason(instance.id, instance).inputCheck?.missing?.[0]?.itemId;
    if (itemId) EventBus.publish(BOARD_EVENTS.INPUT_NEEDED, { instanceId: instance.id, heroId, itemId });
}

function recordSkips(r, heroId, skips) {
    clearSkips(r, heroId);
    if (!skips.length) return;
    const ids = [];
    let toolSaid = false;
    for (const { instanceId, reason } of skips) {
        if (!instanceId) continue;
        const list = r.skips.get(instanceId) || [];
        list.push({ heroId, reason });
        r.skips.set(instanceId, list);
        ids.push(instanceId);
        // Only the Token the hero would have worked says it: the first passed over for want of a
        // tool, in the flag's order. Three veins side by side would otherwise say it three times.
        if (reason === ALERT.NO_TOOL && !toolSaid) {
            toolSaid = true;
            announceToolNeeded(instanceId, heroId);
        }
    }
    r.skipsByHero.set(heroId, ids);
}

/** Every flag that skipped this Token instance, as `[{ heroId, reason }]`. */
export function skipsOf(instanceId) {
    return rt()?.skips.get(instanceId) || [];
}

/**
 * What `heroId`'s flag passed over, in the order it looked (nearest first), as `[{ instanceId,
 * reason, typeId }]`: the flag's hover text. A Token that has since left the board is left out.
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
 * Walk an order's candidates and return the first it can claim, with every skip recorded on the
 * way (see the file comment for the order). A Token order has one candidate, its Token; a camp
 * order, what the camp hands out, nearest first; a spot, none. A pinned hero still passes every
 * check, so they wait (with the reason recorded) rather than working something they cannot.
 *
 * @param {string|null} excludeInstanceId a Token not to consider (the one held)
 */
function evaluate(heroId, flag, excludeInstanceId = null) {
    if (isSpot(flag)) return { pick: null, skips: [] };
    const candidates = [];
    const camp = Camps.campOfHero(heroId);
    if (camp) {
        const at = anchorOf(heroId, flag);
        for (const instance of Camps.campWork(camp)) {
            if (instance.id === excludeInstanceId) continue;
            const def = getTokenType(instance.typeId);
            const kind = kindOf(instance, def);
            if (kind !== 'work' && kind !== 'enemy') continue;
            candidates.push({ instance, def, kind, d: distanceSq(at, centreOf(instance)) });
        }
        // Nearest, then the earlier-placed Token.
        candidates.sort((a, b) => a.d - b.d || (a.instance.placedAt ?? 0) - (b.instance.placedAt ?? 0));
    } else {
        const instance = flag.pinnedTo === excludeInstanceId ? null : BoardState.getTokenById(flag.pinnedTo);
        const def = instance ? getTokenType(instance.typeId) : null;
        const kind = instance ? kindOf(instance, def) : null;
        if (kind) candidates.push({ instance, def, kind });
    }

    const skips = [];
    for (const c of candidates) {
        const instanceId = c.instance.id;
        if (isDisallowed(c.instance)) { skips.push({ instanceId, reason: SKIP.DISALLOWED }); continue; }
        if (c.kind === 'work' && !hasWorkSkill(c.def, c.instance)) { skips.push({ instanceId, reason: SKIP.NO_SKILL }); continue; }
        if (!canTake(heroId, c.kind, c.def, c.instance)) { skips.push({ instanceId, reason: ALERT.UNSKILLED }); continue; }
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

/**
 * Where a camp hero's "nearest" is measured from: where they stand, or their idle spot by the camp
 * while they potter, so a stroll's random spot never changes which Token they take (the catch-up
 * then chooses exactly as live play does).
 */
function anchorOf(heroId, flag) {
    const body = BoardState.heroBodyOf(heroId);
    if (body && !body.potter && !body.home && !body.homeward) return { x: body.x, y: body.y };
    return HeroMotion.idleSpot(flag);
}

/** Whether `instance` is what `heroId`'s camp order hands out right now (in its reach, of its kind). */
function campHolds(heroId, instance) {
    const camp = Camps.campOfHero(heroId);
    return !!camp && Camps.isCampWork(camp, instance);
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

    // ⚠️ Fighting back: a hero a hostile enemy attacked holds that enemy whatever their order says,
    // until a kill (its `CYCLE_COMPLETE`) or the enemy leaves the mat. Then the ambush is over and
    // this same pass treats the claim like any other: kept if their order would keep it, else let
    // go, and their order claims again.
    const ambushId = r.ambushes.get(heroId);
    if (ambushId) {
        const over = ambushId !== claim.instanceId || !instance || r.cycleEnded.has(heroId);
        if (over) r.ambushes.delete(heroId);
        else if (!isDisallowed(instance) && canFight(heroId)) {
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

        // A hero holds nothing but their ordered Token, or, sent to a camp, what the camp hands
        // out (in its reach: a Token the camp moved away from is let go). A spot order holds
        // nothing (an ambush it fought back is over by now).
        const eligible = !isSpot(flag) && !isDisallowed(instance)
            && (flag.pinnedTo === instance.id || campHolds(heroId, instance)) && (
            (kind === 'promotion' && !promotionRefusal(heroId, instance))
            || (kind === 'enemy' && canFight(heroId))
            || (kind === 'work' && hasWorkSkill(def, instance) && canTake(heroId, kind, def, instance)
                // A Token that ran out and rests until it respawns (or a Field with nothing ripe) is
                // let go at once, with no badge: a camp hero works the next thing, an ordered hero
                // waits by it. Unless it is marked for demolition, which a resting Token can still be.
                && (Demolition.isMarked(instance) || !WorkCheck.isAway(instance, def)))
        );

        if (!eligible) {
            r.cycleEnded.delete(heroId);
            release(heroId);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
            return;
        }

        // The cycle-end mark has done its work (ending an ambush, above).
        r.cycleEnded.delete(heroId);

        if (kind !== 'work') return;

        // The runner raised this last tick from the same `WorkCheck`.
        const alert = instance.alert || null;

        if (WorkCheck.HERO_GATES.has(alert)) {
            release(heroId);
            r.nextTryAt.delete(heroId);
            announceMoved(heroId);
            return;
        }

        // Stuck for a fixable reason: stay until something else can run.
        if (FIXABLE.has(alert) && (dirty || r.clock >= (r.nextTryAt.get(heroId) ?? 0))) {
            if (alert === ALERT.INPUTS) announceInputNeeded(instance, heroId);
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
 * A pin lapses when its Token leaves the mat: used up, removed, demolished, or transformed into
 * something that is not the hero's job ({@link followTransform} moves the pin first when it is).
 * The flag stays where it stands (the Token's last spot, since a pinned flag's point follows its
 * Token) as a spot order marked `needsJob`: the hero idles there until given a new order.
 *
 * One id lookup per pinned flag per tick: flat, like the rest of `assign`.
 */
function lapsePins(r, order) {
    for (const heroId of order) {
        const flag = BoardState.flagOf(heroId);
        if (!flag || !('pinnedTo' in flag)) continue;
        if (typeof flag.pinnedTo === 'string' && BoardState.getTokenById(flag.pinnedTo)) continue;
        // Gone for good: the hero waits at its last spot for a new order.
        const { pinnedTo: _gone, ...rest } = flag;
        BoardState.setFlag(heroId, { ...rest, spot: true, needsJob: true });
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
    if (!order.length) {
        pendingAmbushes.length = 0;
        return;
    }

    lapsePins(r, order);
    springAmbushes();

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
 * Why `heroId` cannot be ordered onto `instance`, or null when they can: `{ reason }`, a skip reason
 * (`ALERT.UNSKILLED`, `ALERT.ACCESS`, `ALERT.NO_TOOL`, `SKIP.DISALLOWED`, `SKIP.SAME_JOB`, or the
 * promotion gate's alert) or {@link ORDER_NOTHING} for a Token no hero works (a spawner of no
 * enemy, a support, a quest, unfinished content naming no skill). The Guild Hall is home, not a
 * job: the caller sends the hero there instead. A camp answers for what it hands out
 * ({@link campRefusal}, with `on`); an enemy camp takes anyone who can fight.
 *
 * What the player can fix later (inputs, charges, a recipe, a resting or growing Token) and another
 * hero already on it never refuse: the hero waits by the Token.
 */
export const ORDER_NOTHING = 'nothing';

export function orderRefusal(heroId, instance) {
    if (!heroId || !instance?.typeId) return { reason: ORDER_NOTHING };
    // A camp is an order on what it hands out; an enemy camp, on the enemies it spawns.
    const camp = Camps.campOfInstance(instance);
    if (camp) return campRefusal(heroId, instance, camp);
    if (Camps.isEnemyCamp(instance)) return canFight(heroId) ? null : { reason: ALERT.UNSKILLED };
    const def = getTokenType(instance.typeId);
    // Heroes never work a spawner itself, except to demolish it.
    if (def?.spawner && !Demolition.isMarked(instance)) return { reason: ORDER_NOTHING };
    const kind = kindOf(instance, def);
    if (!kind || kind === 'hall') return { reason: ORDER_NOTHING };
    if (kind === 'work' && !hasWorkSkill(def, instance)) return { reason: ORDER_NOTHING };
    if (isDisallowed(instance)) return { reason: SKIP.DISALLOWED };
    if (kind === 'enemy') return canFight(heroId) ? null : { reason: ALERT.UNSKILLED };
    if (kind === 'promotion') {
        const reason = promotionRefusal(heroId, instance);
        return reason ? { reason } : null;
    }
    const reason = WorkCheck.heroReason(heroId, workConfigOf(def, instance), instance);
    return reason ? { reason } : null;
}

/**
 * Why `heroId` cannot be sent to `camp` (its block `block`), or null when they can: not holding its
 * skill; or, when Tokens of its kind stand in its reach, being able to work none of them (level,
 * tool), `on` naming the one nearest the camp that said so ("Needs Pickaxe" is that vein's tool). A
 * camp with nothing in its reach yet takes the order: the hero waits there.
 */
function campRefusal(heroId, camp, block) {
    if (!holdsSkill(heroId, block.skill)) return { reason: ALERT.UNSKILLED };
    const centre = centreOf(camp);
    const work = Camps.campWork(camp).filter(t => !isDisallowed(t))
        .map(t => ({ t, d: distanceSq(centre, centreOf(t)) }))
        .sort((a, b) => a.d - b.d || (a.t.placedAt ?? 0) - (b.t.placedAt ?? 0));
    let first = null;
    for (const { t } of work) {
        const reason = WorkCheck.heroReason(heroId, workConfigOf(getTokenType(t.typeId), t), t);
        if (!reason) return null;
        first ??= { reason, on: t };
    }
    return first;
}

/** Whether two order records ask the same thing (a re-drop that changes nothing). */
function sameOrder(previous, next) {
    if (!previous) return false;
    if (typeof next.pinnedTo === 'string') return previous.pinnedTo === next.pinnedTo;
    return isSpot(previous) && previous.needsJob !== true && previous.x === next.x && previous.y === next.y;
}

/**
 * Give `heroId` an order: `shape` is the record's own fields (`pinnedTo` or `spot`, and the point),
 * `target` the Token for a Token order. The old claim is let go (its Token's progress
 * reset), the hero sets out from where they stand (the Guild Hall, at home) and chooses at once.
 * Publishes `hero_deployed`, the tutorial's "send a hero out" step, once per real change.
 */
function setOrder(heroId, shape, target = null) {
    const r = rt();
    if (!r) return { success: false, reason: 'No board' };
    ensureFlagColour(heroId);
    // Ordering a hero onto a Promotion Token is the gesture that asks again.
    if (target) clearOfferUnder(heroId, { x: target.x, y: target.y });

    if (sameOrder(BoardState.flagOf(heroId), shape)) {
        return { success: true, unchanged: true, pinnedTo: target?.id ?? null };
    }

    quiet++;
    try {
        release(heroId);
        clearSkips(r, heroId);
        r.nextTryAt.delete(heroId);
        r.cycleEnded.delete(heroId);
        BoardState.setFlag(heroId, { ...shape, plantedAt: BoardState.takeFlagOrder() });
        r.dirty = true;
        HeroMotion.enter(heroId);
        assignHero(heroId);
        HeroMotion.settle(heroId);
    } finally {
        quiet--;
    }
    announceMoved(heroId);
    EventBus.publish(ENGINE_EVENTS.HERO_DEPLOYED, { heroId, instanceId: target?.id ?? null, typeId: target?.typeId ?? null });
    return { success: true, pinnedTo: target?.id ?? null };
}

/**
 * Order `heroId` onto `instance`: they walk there and work only it, or, onto a camp, what it hands
 * out. A Token they cannot work is refused (`{ success: false, refused, instanceId }`, `refused`
 * from {@link orderRefusal}; for a camp, `refusedOn` names the Token in its reach whose need it is)
 * and the hero keeps the order they had. A Token another hero works is not refused: they wait
 * beside it.
 */
export function orderToken(heroId, instance) {
    if (!heroId) return { success: false, reason: 'No hero' };
    const refusal = orderRefusal(heroId, instance);
    if (refusal) {
        return {
            success: false, refused: refusal.reason, instanceId: instance?.id ?? null,
            ...(refusal.on ? { refusedOn: refusal.on.id } : {})
        };
    }
    return setOrder(heroId, { x: instance.x, y: instance.y, pinnedTo: instance.id }, instance);
}

/** Order `heroId` to a bare mat point: they walk there and idle, working nothing. */
export function orderSpot(heroId, point) {
    if (!heroId || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return { success: false, reason: 'Nowhere to go' };
    }
    return setOrder(heroId, { x: point.x, y: point.y, spot: true });
}

/** Clear `heroId`'s order: they walk home to the Guild Hall and wait there. */
export function sendHome(heroId) {
    return furl(heroId, 'home');
}

/**
 * Whether the Token a pinned order's Token became is still the hero's job: one they could be
 * ordered onto, or one growing back into work they could do (a Stump, then a Sapling, then the
 * tree).
 */
function stillTheJob(heroId, instance) {
    if (!orderRefusal(heroId, instance)) return true;
    const toward = Growth.growsTowardWork(instance.typeId);
    return !!toward && holdsSkill(heroId, toward.config.skill)
        && !WorkCheck.heroReason(heroId, toward.config, { typeId: toward.id });
}

/**
 * A Token became another in place (`TOKEN_TRANSFORMED`): every order pinned to the old one moves to
 * the new one when that is still the hero's job ({@link stillTheJob}), so a hero felling a tree
 * waits by its Stump and Sapling and fells it again when it stands. A build (a Foundation becoming
 * a station) is the end of the builder's job. Anything not followed lapses on the next pass
 * (`lapsePins`): the hero needs a job.
 */
export function followTransform({ fromId, instanceId, cause } = {}) {
    if (!fromId || !instanceId || cause === 'build') return;
    const next = BoardState.getTokenById(instanceId);
    if (!next) return;
    for (const [heroId, flag] of Object.entries(BoardState.getFlags())) {
        if (flag?.pinnedTo !== fromId || !stillTheJob(heroId, next)) continue;
        flag.pinnedTo = next.id;
        flag.x = next.x;
        flag.y = next.y;
        markDirty();
    }
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
    if (kind === 'work') return hasWorkSkill(def, instance);
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
 * order says. Then their order claims again as normal, so they go back to their job. A new order,
 * a recall or a defeat ends it early, as any claim.
 *
 * Refused (false): no flag, no such enemy on the mat, a hero who cannot fight, or an enemy
 * another hero already holds.
 *
 * @returns {boolean} whether the hero is now fighting back
 */
export function ambush(heroId, instanceId) {
    const r = rt();
    const enemy = BoardState.getTokenById(instanceId);
    if (!r || !BoardState.flagOf(heroId) || !enemy || !BoardCombat.isEnemyToken(enemy)) return false;
    // A boss fights only when the player sends a hero: it never attacks first.
    if (isBossEnemy(getTokenType(enemy.typeId))) return false;
    if (!canFight(heroId)) return false;
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
 * Ambushes a rule sprang this tick (`BOARD_EVENTS.AMBUSHED`, from `TriggerSystem`): the enemy a
 * node's work just spawned, and the hero who did the work, in the order they were sprung.
 *
 * ⚠️ Queued, not acted on: the rule fires inside the runner's cycle completion, which carries on
 * after publishing, so taking the hero off the Token there would pull it out from under that code
 * (the same reason as {@link cycleCompleted}). The next `assign` springs them first, before any
 * claim is kept or changed, so the worker meets the ambusher before looking for other work.
 * Runtime only: a load or a journey drops it, and the enemy, if hostile, still watches its node.
 */
const pendingAmbushes = [];

function springAmbushes() {
    if (!pendingAmbushes.length) return;
    const sprung = pendingAmbushes.splice(0);
    for (const { heroId, instanceId } of sprung) ambush(heroId, instanceId);
}

/**
 * What `heroId` is waiting for, or null: `{ instanceId, kind }` for a hero with nothing claimed
 * whose order passed over something that will be theirs to work by itself, the first such in the
 * order's own order.
 * - `'fight'`: an enemy another hero is fighting (`claimed`). Every fight is one-on-one, so a hero
 * sent to that enemy (or to its camp) waits beside it and takes it the moment it is free.
 * - `'node'`: a Token resting until it respawns (`resting`) that the hero could work and that is
 * coming back by itself (`Respawn.isComingBack`: not a Bare tree with no Orchard in reach), or a
 * Field whose crop grows (`growing`): the skip reason is the Token's own, so the hero's skill,
 * level and tool have already passed. They wait silently and work it the moment it is back
 * (`TOKEN_RESPAWNED`, or the Field's `TILE_CHANGED` as it ripens, marks flags dirty). Failing
 * those, a Stump or Sapling (the ordered Token, or in a camp's reach) growing back into work they could do
 * ({@link growingFor}): its growth is a transform, whose `TILE_CHANGED` marks flags dirty, so they
 * work it the moment it stands.
 * - `'busy'`: the Token an order names, which another hero is working: the newcomer waits beside
 * it and takes it the moment it is free. Never at a camp: a camp hero whose Tokens are all taken
 * has nothing to do.
 * - `'spawn'`: sent to an enemy camp with nothing of its standing to fight: they wait silently for
 * its next spawn (`typeId` names the first enemy it spawns, for the words), and take it as it lands
 * (the spawn's `TILE_CHANGED` marks flags dirty).
 * For the roster's words, the hero's speech and the idle mark. A spot order waits for nothing.
 */
export function waitingOf(heroId) {
    if (!heroId || BoardState.claimOfHero(heroId)) return null;
    const flag = BoardState.flagOf(heroId);
    if (isSpot(flag)) return null;
    const camp = Camps.campOfHero(heroId);
    for (const s of skipsOfHero(heroId)) {
        if (s.reason === ALERT.RESTING) {
            if (Respawn.isComingBack(BoardState.getTokenById(s.instanceId))) return { instanceId: s.instanceId, kind: 'node' };
            continue;
        }
        if (s.reason === ALERT.GROWING) return { instanceId: s.instanceId, kind: 'node' };
        if (s.reason !== SKIP.CLAIMED) continue;
        if (BoardCombat.isEnemyToken(BoardState.getTokenById(s.instanceId))) return { instanceId: s.instanceId, kind: 'fight' };
        // An order onto a Token another hero works: the newcomer waits beside it.
        if (!camp) return { instanceId: s.instanceId, kind: 'busy' };
    }
    if (camp && Camps.isEnemyCamp(camp)) {
        return { instanceId: camp.id, kind: 'spawn', typeId: Camps.enemiesOf(camp.typeId)[0] ?? null };
    }
    return growingFor(heroId);
}

/**
 * What grows back into `heroId`'s work, as `{ instanceId, kind: 'node' }`, or null: a Stump or
 * Sapling (no work of its own) whose growth chain reaches a Token of a skill the hero holds, at a
 * level they have, with the tool in hand, and that is truly on its way (its Forest in reach, not
 * stopped for want of its seedling: `Growth.isGrowingBack`). A Token order waits only for its own
 * Token; a camp order for the nearest in the camp's reach, then the earlier-placed.
 *
 * ⚠️ Worked out when asked (the roster's words, the speech, the idle mark), never on the pass:
 * a hero with nothing to claim looks again every second, and a catch-up is 86,400 seconds.
 */
function growingFor(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag || isSpot(flag)) return null;
    // A camp order waits for what grows back in the camp's reach into the camp's kind of work.
    const camp = Camps.campOfHero(heroId);
    if (!camp) return pinnedGrowing(heroId, BoardState.getTokenById(flag.pinnedTo));
    const block = Camps.campOfInstance(camp);
    if (!block) return null;
    const inReach = (centre, toward) => Camps.worksType(block, toward) && Camps.reaches(camp, block, centre);
    const from = anchorOf(heroId, flag);
    const canWork = new Map();
    let best = null;
    for (const instance of BoardState.tokens()) {
        const toward = Growth.growsTowardWork(instance.typeId);
        if (!toward) continue;
        const centre = centreOf(instance);
        if (!centre || !inReach(centre, toward) || isDisallowed(instance)) continue;
        let can = canWork.get(toward.id);
        if (can === undefined) {
            can = holdsSkill(heroId, toward.config.skill)
                && !WorkCheck.heroReason(heroId, toward.config, { typeId: toward.id });
            canWork.set(toward.id, can);
        }
        if (!can || !Growth.isGrowingBack(instance)) continue;
        const d = distanceSq(from, centre);
        const order = instance.placedAt ?? 0;
        if (!best || d < best.d || (d === best.d && order < best.order)) best = { instance, d, order };
    }
    return best ? { instanceId: best.instance.id, kind: 'node' } : null;
}

/**
 * An order's own Token growing back into work the hero could do (the Stump or Sapling a felled tree
 * became, {@link followTransform}), as `{ instanceId, kind: 'node' }`, or null when it is not on its
 * way (no Forest in reach, or stopped for want of its seedling).
 */
function pinnedGrowing(heroId, instance) {
    const toward = instance ? Growth.growsTowardWork(instance.typeId) : null;
    if (!toward || isDisallowed(instance) || !Growth.isGrowingBack(instance)) return null;
    if (!holdsSkill(heroId, toward.config.skill) || WorkCheck.heroReason(heroId, toward.config, { typeId: toward.id })) return null;
    return { instanceId: instance.id, kind: 'node' };
}

/** The instance id {@link waitingOf} names, or null. */
export function waitingFor(heroId) {
    return waitingOf(heroId)?.instanceId ?? null;
}

/** Why a Token cannot be disallowed: no hero could ever work it. */
export const NO_HERO_WORKS = 'No hero works this';

/** Why `instance` cannot be disallowed, or null when it can (`isHeroWorkable`). */
export function disallowRefusalOf(instance) {
    return isHeroWorkable(instance) ? null : NO_HERO_WORKS;
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
 * Only a Token a hero could work can be disallowed ({@link disallowRefusalOf}); allowing is never
 * refused. Disallow mode calls this; from the console:
 * `Game.Flags.setDisallowed(instanceId, true)`.
 *
 * @returns {{ success: boolean, reason?: string, unchanged?: boolean }}
 */
export function setDisallowed(instanceId, on = true) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return { success: false, reason: 'No Token there' };
    const next = !!on;
    if (isDisallowed(instance) === next) return { success: true, unchanged: true };
    const refusal = next ? disallowRefusalOf(instance) : null;
    if (refusal) return { success: false, reason: refusal };

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
 * What a hero is doing, for the roster and the marks: `docked` (no order: at the Guild Hall),
 * `returning` (no order, still walking home), `working`, `walking` (on the way: to a claimed Token,
 * `instanceId` set, or back to their order's spot, `instanceId` null) and `idle` (at their order's
 * spot or beside its Token, nothing to do). `instanceId` is the Token they work or walk to (or
 * null), `point` where their job is. `order` is `'token'`, `'spot'` or null (home), `needsJob`
 * says the ordered Token is gone for good, and `campId` names the camp they work from (or null).
 */
export function statusOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) {
        // At home already, but their figure may still be walking there.
        const state = HeroMotion.isReturning(heroId) ? 'returning' : 'docked';
        return { state, instanceId: null, point: null, typeId: null, flag: null, order: null, needsJob: false, limping: HeroMotion.isLimping(heroId) };
    }
    const order = isSpot(flag) ? 'spot' : 'token';
    const extra = { order, needsJob: flag.needsJob === true, campId: order === 'token' ? (Camps.campOfHero(heroId)?.id ?? null) : null };
    const workId = BoardState.workTokenOf(heroId);
    if (workId) {
        return {
            state: 'working', instanceId: workId,
            point: BoardState.displayPointOf(heroId), typeId: BoardState.getTokenById(workId)?.typeId ?? null, flag, ...extra
        };
    }
    const claim = BoardState.claimOfHero(heroId);
    if (claim && BoardState.getTokenById(claim.instanceId)) {
        return {
            state: 'walking', instanceId: claim.instanceId,
            point: { x: claim.x, y: claim.y }, typeId: claim.typeId, flag, ...extra
        };
    }
    // Walking back to the flag after work. A stroll near the flag is still idle.
    if (HeroMotion.isWalking(heroId) && !HeroMotion.isPottering(heroId)) {
        return { state: 'walking', instanceId: null, point: { x: flag.x, y: flag.y }, typeId: null, flag, ...extra };
    }
    return { state: 'idle', instanceId: null, point: BoardState.displayPointOf(heroId), typeId: null, flag, ...extra };
}

/**
 * A hero finished a cycle (or a kill): a fight-back ends with its kill (`keepOrRelease`).
 *
 * ⚠️ Only noted here, not acted on. This runs inside the runner's (or the fight's) completion,
 * which carries on after publishing; letting go of the Token from in here would pull it out from
 * under that code. The next `assign` runs before any Token ticks, so the hero goes back to their
 * order between cycles.
 */
function cycleCompleted(heroId) {
    const r = rt();
    const claim = heroId ? BoardState.claimOfHero(heroId) : null;
    if (!r || !claim) return;
    r.cycleEnded.add(heroId);
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
    pendingAmbushes.length = 0;
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
        const flag = BoardState.flagOf(heroId);
        if (!flag || isSpot(flag) || !token || BoardState.heroOfInstance(token.id)) {
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

/**
 * After travel: the guild arrives with no claim and no fight. Each hero with a flag in this Region
 * starts beside it and chooses work afresh; the notes that would put them back at their old work
 * (a load's `restoreWork`) are dropped.
 */
function arrive() {
    reset();
    for (const [heroId] of BoardState.savedWorkClaims()) BoardState.forgetWorkClaim(heroId);
    restoreWork();
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
    for (const event of [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_PLACED, ENGINE_EVENTS.INVENTORY_UPDATED, BOARD_EVENTS.TOKEN_RESPAWNED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED]) {
        unsubscribers.push(EventBus.subscribe(event, dirty));
    }
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (payload = {}) => cycleCompleted(payload.heroId)));
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.AMBUSHED, ({ heroId, instanceId } = {}) => {
        if (heroId && instanceId) pendingAmbushes.push({ heroId, instanceId });
    }));
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_TRANSFORMED, followTransform));
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => {
        reset();
        restoreWork();
    }));
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, arrive));
    // `BoardCombat.resolveDefeat` publishes a defeat event instead of calling `furl` directly,
    // which would make a `BoardCombat ↔ Flags` import cycle (Flags already reaches into BoardCombat
    // for `isEnemyToken`/`endFightOfHero`). `EventBus.publish` is synchronous, so this runs before
    // `resolveDefeat`'s own `TILE_CHANGED`/`COMBAT_RESOLVED` publishes.
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, ({ heroId }) => furl(heroId, 'defeat')));
}
