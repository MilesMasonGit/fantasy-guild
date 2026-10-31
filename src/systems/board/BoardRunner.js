// the board's cycle engine

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType, rollOutputQuantity, outputRange, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import * as TileModifiers from './TileModifiers.js';
import * as RecipeResolver from './RecipeResolver.js';
import * as Charges from './Charges.js';
import * as BlockUpkeep from './BlockUpkeep.js';
import * as TriggerSystem from './TriggerSystem.js';
import { RECIPE } from './RecipeResolver.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import * as BoardCombat from './BoardCombat.js';
import * as Flags from './Flags.js';
import * as HeroMotion from './HeroMotion.js';
import * as EnemyMotion from './EnemyMotion.js';
import * as Hostiles from './Hostiles.js';
import * as TimedChanges from './TimedChanges.js';
import * as WorkCheck from './WorkCheck.js';
import * as Foundations from './Foundations.js';
import * as Demolition from './Demolition.js';
import { workConfigOf } from './StationRecipe.js';
import * as Restrictions from './Restrictions.js';
import * as Placement from './Placement.js';
import * as MatPlacement from './MatPlacement.js';
import * as StatusApplication from './StatusApplication.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as RareDrops from './RareDrops.js';
import * as OutputRules from './OutputRules.js';
import * as Fishing from './Fishing.js';
import * as Fields from './Fields.js';
import * as LoadoutMoments from './LoadoutMoments.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { centreOf } from './nearby.js';
import * as Hand from './Hand.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Re-exported so `BoardRunner.ALERT` keeps working for the engine suites that read it that way. The
 * definition lives in `boardEvents.js` so every publisher and reader can name it without an import
 * cycle.
 */
export { ALERT };

/**
 * BoardRunner: every Token on the board, ticking.
 *
 * The fast path: most ticks only add `delta` to a countdown. The expensive work (paying inputs,
 * granting output, spending a charge) happens only at the rare moment a timer hits zero.
 *
 * A Token runs when four things are true:
 * 1. It has a config: Context, Buff and Structure Tokens are inert by design; they work by
 * adjacency, not by running.
 * 2. It has a hero, unless it is a Passive Generator.
 * 3. That hero meets its skill requirement (Access) and holds the tool its work needs.
 * 4. Its inputs are available. No partial cycles: full speed or waiting.
 *
 * Fail 2 and the tile is quietly idle. Fail 3 or 4 with a hero present and it raises a red alert
 * mark, because that is a problem the player can act on. Fail 2 alone raises nothing: most of the
 * board is unstaffed at any moment, and flagging all of it would make the mark meaningless.
 *
 * Hero effects on the board: only Access, the skill gate in rule 3. ⚠️ A skill level deliberately
 * adds no work speed: an invisible per-level bonus was removed as one more number to balance.
 * Efficiency is not implemented: input cost is resolved in `completeCycle` through
 * `TileModifiers.resolveAxis(INPUT_COST)`, which reads tile, neighbour and guild-wide effects.
 * ⚠️ Deferred to the hero rework: do not quietly fill it in because it looks missing.
 */

/** Tick counter, so progress events don't fire at full rate. */
let tickCounter = 0;

/** Publish progress every N engine ticks. */
const PROGRESS_EVERY = 3;

/**
 * The part of a tick left over after a cycle finished inside it, by instance id. Handed to the
 * cycle that starts on the very next tick, so a cycle ending part-way through a tick loses nothing:
 * without it a 1500 ms cycle at 1000 ms steps runs every 2 s instead of every 1.5 s. A station that
 * does not start again on the next tick (waiting for inputs, its hero gone) loses it, as it would
 * have lost the time anyway. Negative for a Token that refilled during this tick: the part of the
 * tick it was still resting (`TimedChanges.lateRefillsThisTick`).
 */
let carryIn = new Map();
let carryOut = new Map();

/**
 * The same leftover by hero id: handed to the cycle the hero starts on the very next tick on
 * another Token (a camp hero whose tree was just used up moves to the next one), so moving on loses
 * nothing either, and a catch-up's 1 s steps take the next Token at the same moment many small live
 * steps do. Where both a Token's and its hero's leftover stand, the later start wins (the smaller
 * leftover: a Token that refilled during the tick is not worked before it refilled).
 */
let heroCarryIn = new Map();
let heroCarryOut = new Map();

// Why the hero on a Token cannot work it (possession, level, then tool) lives in `WorkCheck.heroReason`,
// shared with the flags that choose which Token to work.

/**
 * Set or clear a tile's alert, publishing only on an actual change.
 *
 * Both sides are normalised to `null` before comparing: a Token that has just been created or
 * loaded has no `alert` field at all, and `undefined === null` is false, so the first clear-alert
 * call would announce a change from no alert to no alert. `alert` is not persisted, so that would
 * be a burst across the whole board on every load.
 *
 * Returns whether the alert changed. A stuck station's news (`TILE_EVENT_ALERT`) is published only
 * then: once when the problem starts, and again only if it clears and comes back.
 */
function setAlert(instance, reason) {
    const next = reason || null;
    if ((instance.alert || null) === next) return false;
    instance.alert = next;
    EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: instance.id, alert: instance.alert });
    return true;
}

/**
 * The most copies a recipe's Token outputs can make in one cycle: each output's authored maximum,
 * `chance` ignored (room is reserved for all).
 */
function tokenOutputCount(io) {
    let n = 0;
    for (const output of io?.outputs || []) {
        if (output?.tokenId) n += Math.max(0, outputRange(output).max);
    }
    return n;
}

/**
 * Whether every Token this cycle could make has room beside the station. True when the recipe makes
 * no Token.
 */
function hasRoomForTokenOutputs(id, io) {
    const count = tokenOutputCount(io);
    if (count <= 0) return true;
    for (const output of io.outputs) {
        if (output?.tokenId && !Placement.hasRoomForProduct(id, output.tokenId, count)) return false;
    }
    return true;
}

/**
 * A Token output makes exactly what it rolled, beside the station: never widened by YIELD or
 * doubled by LOOT_MULT, because room was reserved for the recipe's authored maximum before the
 * cycle paid, and a Token must never be made with nowhere to stand. It is not pushed to `produced`:
 * that list is matched against item ids (`TriggerSystem.producedMatches`).
 */
function placeTokenOutput(instance, output) {
    const copies = rollOutputQuantity(output);
    for (let i = 0; i < copies; i++) {
        const placed = Placement.placeProduct(instance.id, output.tokenId);
        if (!placed?.success) {
            logger.warn('BoardRunner',
                `${tokenName(output.tokenId) || output.tokenId} found no room beside ${tokenName(instance.typeId) || instance.typeId}: ${placed?.reason || 'no spot'}`);
        }
    }
}

/** How far the load-time repair looks for a legal spot, in mat units. */
const RELOCATE_REACH = 640;

/**
 * Where a Token that breaks a `Cannot` on load should stand instead: the
 * nearest legal point, or null to leave it where it is.
 */
function relocateOffender(instance) {
    return MatPlacement.findSpot(instance.typeId, { x: instance.x, y: instance.y }, {
        excludeId: instance.id,
        plan: { id: instance.id },
        reach: RELOCATE_REACH
    });
}

/**
 * One Token finished a cycle.
 *
 * Order matters: pay first, then produce. Deciding the whole exchange before any of it happens is
 * what stops a Token handing out output it cannot afford.
 *
 * Every reader is asked by the Token's instance id, and every event names it by `instanceId`.
 */
function completeCycle(instance, def, io, heroId, config = def.config, overMs = 0) {
    const id = instance.id;

    // Building in place: a Foundation's cycle ends with it BECOMING the Token its recipe outputs.
    // Room is checked before anything is paid: with nowhere legal to stand, the Foundation stays,
    // its progress stays full and nothing is spent, so the retry on the next tick cannot charge
    // twice.
    const buildTypeId = Foundations.isFoundation(def) ? Foundations.buildTargetOf(io) : null;
    if (buildTypeId && !Foundations.hasRoomToBuild(instance, buildTypeId)) {
        setAlert(instance, ALERT.NO_ROOM);
        return;
    }

    // A Token a recipe makes lands on the mat beside this station as a `placed` Token, under the
    // mat's Token cap. Room is checked here, before anything is paid, exactly as a build checks
    // above: with the mat full or nowhere legal beside the station, the cycle holds at full
    // progress with the `NO_ROOM` mark, nothing is spent and nothing is lost, and it retries every
    // tick.
    if (!buildTypeId && !hasRoomForTokenOutputs(id, io)) {
        setAlert(instance, ALERT.NO_ROOM);
        return;
    }

    // INPUT_COST, widened to read the Token's neighbours: a Tool Rack beside a Forge makes it
    // cheaper to run, so the Token's own aggregator is not the only one consulted.
    const inputs = (io.inputs || []).map(input => ({
        ...input,
        quantity: Math.max(1, Math.round(TileModifiers.resolveAxis(
            id, EFFECT_TYPES.INPUT_COST, input.quantity || 1, config.skill
        )))
    }));

    // The atomic requirement check, in the order that makes it atomic: plan every charge debit
    // first, then spend the items, then commit the charges. A cycle needs 100% of its inputs (bank
    // items, station charges, and charges on the nearby context Tokens its recipe draws on) before
    // any of them is touched, and a short cycle deducts nothing of any kind.
    // Charges are planned before the items are spent because `planCycle` mutates nothing: if it
    // comes back short, the return below leaves the Bank exactly as it found it. Committing after
    // production keeps the order in which a station that spends its last charge is destroyed only
    // once the cycle it paid for has actually produced.
    const chargePlan = Charges.planCycle(id, instance, io);
    if (!chargePlan.ok) {
        InputAllocator.noteStarved(instance.typeId);
        setAlert(instance,ALERT.CHARGES);
        return;
    }

    if (!InputAllocator.consumeInputs(inputs)) {
        // Raced by another Token between the availability check and here.
        // Keep the progress and wait — the cycle is not lost, only delayed.
        InputAllocator.noteStarved(instance.typeId);
        setAlert(instance,ALERT.INPUTS);
        return;
    }

    instance.cycleElapsedMs = 0;

    // FAIL_CHANCE: a probability axis, resolved through the same three-bucket formula as everything
    // else and then rolled once. Base 0: nothing fails unless something nearby says so. A failed
    // cycle still consumes its inputs, wears nearby support and burns a charge (failure costs the
    // cycle, it does not rewind it) but produces no output and grants no XP. That also makes
    // `failed: true` real for triggers, which fire on success only.
    const failChance = TileModifiers.resolveAxis(
        id, EFFECT_TYPES.FAIL_CHANCE, 0, config.skill
    );
    const failed = failChance > 0 && Math.random() * 100 < failChance;

    // Item output lands on the BOARD, not in the Bank: it is not banked until collected, and if the
    // Bank is full it simply waits there. A Token output stands on the mat beside the station.
    // YIELD and LOOT_MULT are the output rules a kill's loot follows too (`OutputRules`).
    const isGuildHall = instance.typeId === 'token_guild_hall';
    const doubled = (failed || isGuildHall) ? false : OutputRules.rollDoubleLoot(id, config.skill);

    // What this cycle actually made, for the `a neighbour produces X` trigger.
    // ⚠️ Only what genuinely landed: an output whose chance roll missed, or
    // whose quantity rounded to nothing, did not happen and must not fire a
    // listener that says it did.
    const produced = [];

    // Water: one catch from the pool the hero's tool and bait pick (one draw, unless the pool holds
    // one fish), in place of the Token's own outputs. It then lands like any output.
    // A failed cycle catches nothing and keeps its bait.
    let outputs = io.outputs || [];
    if (failed || buildTypeId) {
        outputs = [];
    } else if (Fishing.isWater(def)) {
        const caught = Fishing.catchOf(id, def, heroId);
        outputs = caught ? [{ itemId: caught.itemId, chance: 100, minQty: 1, maxQty: 1 }] : [];
    }

    // A build makes its Token by becoming it (below), never as a sprite.
    for (const output of outputs) {
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;

        if (output.tokenId) {
            placeTokenOutput(instance, output);
            continue;
        }

        // Roll the authored range FIRST, then widen it, so a 1-5 output buffs a lucky cycle more
        // than an unlucky one.
        const rolled = isGuildHall
            ? OutputRules.roundUp(rollOutputQuantity(output))
            : OutputRules.widenYield(id, config.skill, rollOutputQuantity(output));
        const widened = doubled ? rolled * 2 : rolled;
        // A chance that this one item comes out doubled, after everything else (not at the Hall).
        const quantity = (isGuildHall || !output.itemId) ? widened : OutputRules.doubleItemDrop(id, output.itemId, widened);
        if (quantity <= 0) continue;

        // An output names a Token or an item. One that names neither pays nothing: the cycle still
        // runs and still takes its inputs.
        if (output.itemId) {
            RareDrops.noteDrop(SpriteLayer.addSprite('item', output.itemId, quantity, id), chance);
            produced.push(output.itemId);
        }
    }

    // BONUS_DROP, skipped entirely on a failed cycle: nothing happened, so nothing drops.
    if (!failed && !isGuildHall) produced.push(...OutputRules.dropBonusGrants(id));

    // `Applies`: a neighbour putting a status on the hero who just worked here. The same moment and
    // the same rules as BONUS_DROP directly above: skipped on a failed cycle, and it needs a
    // person, because a status has nowhere to live on a tile.
    // ⚠️ Deliberately here rather than on a clock. A status is a stack applied at an instant, not a
    // field that hangs in the air: reapplying one every tick would pin every DoT at maximum and
    // never let a buff decay.
    if (!failed && heroId) {
        for (const application of TileModifiers.collectStatusApplications(id)) {
            // `applyAt` already answers whether it rolled AND found somebody to land on, so the
            // announcement follows the status rather than the attempt.
            // ⚠️ Checked, then applied, then paid. `applyAt` rolls the chance internally, so paying
            // up front would spend a potion on a roll that missed; paying without checking first
            // could apply a status the hero cannot afford.
            if (!HeroEffects.canPayLoadoutCost(application)) continue;
            if (StatusApplication.applyAt(id, application)) {
                HeroEffects.payLoadoutCost(application);
                EffectFeedback.announce(id, application);
            }
        }
    }

    // XP likewise comes from the active recipe when it defines its own: a Feast should teach more
    // than Bread even though both run on a Kitchen. XP_BONUS then widens it the same way YIELD
    // widens output.
    const baseXp = io.xp ?? config.xp;
    const xpAwarded = failed ? 0 : SkillSystem.applyXpBonus(baseXp || 0, TileModifiers.resolveAxis(
        id, EFFECT_TYPES.XP_BONUS, baseXp || 0, config.skill
    ));
    if (xpAwarded > 0 && heroId && config.skill) {
        SkillSystem.addXP(heroId, config.skill, xpAwarded);
    }

    // Pay the plan built at the top of this function: the Token's own operational cost. Anything
    // that hits 0 is destroyed by `commitPlan`, which is also where `null`-means-unlimited is
    // honoured: `null` is the opposite of 0, not a large version of it.
    // ⚠️ Nothing near the Token pays for this cycle: help is free (owner, 2026-10-24). A support or
    // a context Token never wears out, and a gathering node that helps its neighbours spends its
    // charges only on its own gathering (`Charges.planContextCharges`, `wearRule.js`).
    Charges.commitPlan(chargePlan, { heroId });

    // A Field spends one harvest of its load; the last sows its crop again, growing from the moment
    // this cycle ended (`overMs` into the tick), or stops it without a seed (`Fields.js`).
    if (Fields.isField(def)) Fields.harvested(instance, def, { overMs });

    // The board's universal unit of work. One kill counts as one cycle too, so combat feeds this
    // exactly as production does.
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        instanceId: id,
        typeId: instance.typeId,
        heroId: heroId || null,
        failed,
        // Which items this completion put on the board. The coarse "a neighbour
        // completed a cycle" trigger has always been able to say *that* one
        // finished; this is what lets a listener care about *what* it made.
        produced
    });

    // Cheap tally, used by the Token-type statistics surface.
    const counts = GameState.state?.collection?.cardUseCounts;
    if (counts) counts[instance.typeId] = (counts[instance.typeId] || 0) + 1;

    // Last, so every reader above saw the Foundation that did the work. Its hero lets go on the
    // next pass and moves on. A failed build has spent its inputs and stays a Foundation, like any
    // failed cycle.
    if (buildTypeId && !failed) {
        const fromTypeId = instance.typeId;
        // The paid `inputs` go with it: the built Token remembers its Foundation and build cost for
        // the discard refund.
        const built = Foundations.buildInPlace(instance, buildTypeId, inputs);
        if (built) {
            EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, {
                instanceId: built.id, typeId: buildTypeId, fromTypeId, heroId: heroId || null
            });
        } else {
            logger.warn('BoardRunner', `${def.name}: had room to build ${buildTypeId}, then did not`);
        }
    }
}

/**
 * A Token marked for demolition, for one tick: its hero's Construction work, a fixed time with no
 * recipe, inputs or charges, after which `Demolition.finish` takes it off the mat.
 *
 * ⚠️ No `CYCLE_START` or `CYCLE_COMPLETE`, no XP, no output: demolishing is not production, and a
 * rule or quest counting cycles must not count it.
 */
function tickDemolition(instance, def, delta, heroId, publishProgress) {
    if (!heroId) {
        setAlert(instance, null);
        return;
    }
    const config = workConfigOf(def, instance);
    const skillAlert = WorkCheck.heroReason(heroId, config);
    if (skillAlert) {
        setAlert(instance, skillAlert);
        return;
    }
    setAlert(instance, null);

    instance.cycleElapsedMs = (instance.cycleElapsedMs > 0 ? instance.cycleElapsedMs : 0) + delta;
    if (instance.cycleElapsedMs >= config.cycleTimeMs) {
        Demolition.finish(instance, { heroId });
    } else if (publishProgress) {
        EventBus.publish(BOARD_EVENTS.PROGRESS, {
            instanceId: instance.id,
            percent: Math.min(100, (instance.cycleElapsedMs / config.cycleTimeMs) * 100),
            elapsedMs: instance.cycleElapsedMs,
            cycleTimeMs: config.cycleTimeMs
        });
    }
}

/**
 * What a cycle starting now on Token `id`, worked by `heroId`, has already done: the Token's own
 * leftover, the hero's from the Token they finished on last tick ({@link heroCarryIn}), the later
 * start of the two when both stand, or nothing. The hero's is spent here.
 */
function carryAtStart(id, heroId) {
    const own = carryIn.get(id);
    const hero = heroId ? heroCarryIn.get(heroId) : undefined;
    if (hero !== undefined) heroCarryIn.delete(heroId);
    if (own !== undefined && hero !== undefined) return Math.min(own, hero);
    return own ?? hero ?? 0;
}

/**
 * Advance every Token on the board.
 *
 * @param {number} delta game milliseconds since the last tick
 */
export function tick(delta) {
    [carryIn, carryOut] = [carryOut, carryIn];
    carryOut.clear();
    [heroCarryIn, heroCarryOut] = [heroCarryOut, heroCarryIn];
    heroCarryOut.clear();

    // An older save's untethered enemies join their nearest camp before any camp counts what it
    // spawned below; a no-op once per board.
    EnemyMotion.attachUntethered();

    // Timed changes: Saplings grow, Coasts turn and turn back, on clocks advanced by this tick's
    // `delta`, so a catch-up fast-forwards them with everything else. Before Flags, so a hero
    // whose Token just changed under them lets go and chooses again this same tick, and before any
    // Token ticks, so a cycle on a Token that has gone is never advanced or completed.
    TimedChanges.tick(delta);
    // A Token that refilled during this tick works only the part of it after the refill: its
    // cycle starts owing the time it was still resting (a negative carry, read where a cycle
    // begins), so a big catch-up step and many small live ones end in the same place.
    for (const [id, sinceMs] of TimedChanges.lateRefillsThisTick()) {
        if (sinceMs < delta) carryIn.set(id, sinceMs - delta);
    }

    // Flags keep, change or find their work: after the timed changes above, so a hero sees any new
    // Token this tick, and before any Token ticks, so `workerOf` below is already settled.
    Flags.assign(delta);

    // Heroes walk toward their work: after Flags has told them where, and before any Token ticks,
    // since a Token's cycle runs only once its hero has arrived and one who arrives this tick
    // starts now.
    HeroMotion.tick(delta);

    // Enemies potter by their spawner: after the heroes, so an enemy a hero claimed this tick
    // already holds still for them.
    EnemyMotion.tick(delta);

    // Hostile enemies attack heroes whose flag is inside the radius of their spawner: after the enemies'
    // steps, and before any Token ticks, so an attacked hero standing beside the enemy fights this
    // same tick.
    Hostiles.tick(delta);

    const onMat = BoardState.tokens();
    if (!onMat.length) return;

    tickCounter++;
    const publishProgress = tickCounter % PROGRESS_EVERY === 0;

    for (const instance of onMat) {
        const id = instance.id;
        // A Token taken off the mat earlier in this same tick is skipped.
        if (!BoardState.getTokenById(id)) continue;
        const def = getTokenType(instance.typeId);
        const heroId = BoardState.workerOf(id);

        // Effect-block upkeep runs on its OWN clock, before every guard below: a Buff Token has no
        // config, no hero and no work cycle, so anything conditional on those would never charge
        // it. When a block switches between paid and unpaid the neighbourhood must be rebuilt: an
        // aura going dark has to actually stop applying, not just be flagged.
        if (BlockUpkeep.tickUpkeep(instance, def, delta)) {
            TileModifiers.rebuildAround([centreOf(instance)]);
        }

        // Triggered Tokens are rate-limited by a cooldown rather than a cycle, and like upkeep this
        // must run before every guard below: a purely triggered Token has no config and no hero at
        // all.
        TriggerSystem.tickCooldowns(instance, delta);

        // A Token in the player's hand is paused: no cycle, no fight, no charge spent, so nothing
        // can take it off the mat mid-drag. Its hero keeps the claim and stands by, and the cycle
        // (any carried-over leftover included) resumes where it stopped once it is put down.
        if (Hand.isInHand(id)) {
            if (carryIn.has(id)) carryOut.set(id, carryIn.get(id));
            continue;
        }

        // Enemy Tokens run on the combat engine rather than a work cycle. A tile with no hero on it
        // does nothing here and raises no alert, for the same reason an unstaffed Forest doesn't; a
        // hostile enemy gets a hero onto it through `Hostiles` and `Flags.ambush`, not through this
        // function.
        if (BoardCombat.isEnemyToken(instance)) {
            // A hero who cannot fight never claims an enemy under flags: the flag records
            // `unskilled` against it, shown on hover only, so an enemy Token never carries a red mark.
            setAlert(instance,null);

            // Called unconditionally: `tickToken` also owns ENDING a fight when the hero has gone.
            // Guarding on `heroId` here would leave the old fight, and its damaged enemy, alive
            // forever, so a player could chip a boss down across free retreats.
            BoardCombat.tickToken(instance, delta, heroId);
            continue;
        }

        // Marked for demolition: its own work (recipe, build, passive cycle) stops and the
        // demolition runs in its place. After enemies, which can never be marked, and before the
        // Passive Generators, which can.
        if (Demolition.isMarked(instance)) {
            tickDemolition(instance, def, delta, heroId, publishProgress);
            continue;
        }

        // A Foundation authors no `config`; its skill and the selected recipe's level stand in for
        // one.
        const config = workConfigOf(def, instance);

        // Inert by design — nothing to advance.
        if (!config) continue;

        const needsHero = def.requiresHero !== false;
        if (needsHero && !heroId) {
            // Quietly idle. NOT an alert: an unstaffed Token is not an error, and most of the board
            // is unstaffed at any moment.
            // ⚠️ One exception: a Token some flag passed over for a reason the player can fix keeps
            // its red badge, re-read live so it clears the moment the problem does. Skill too low,
            // wrong skill and no skill are hover-only and never badge.
            const skipped = Flags.hasFixableSkip(instance)
                ? WorkCheck.fixableReason(id, instance).reason
                : null;
            // A Token that has since started resting keeps no badge: resting is not fixable.
            setAlert(instance, WorkCheck.FIXABLE.has(skipped) ? skipped : null);
            continue;
        }

        if (needsHero) {
            const skillAlert = WorkCheck.heroReason(heroId, config, instance);
            if (skillAlert) {
                setAlert(instance,skillAlert);
                continue;
            }
        }

        // What is this station making? Whatever the player set it to (see `StationRecipe.js`).
        // `WorkCheck` resolves whether the board around it lets that recipe run, whether the inputs
        // are there and whether the charges are affordable: the same check a flag makes before
        // claiming. The side effects stay here: they describe a hero actually standing on the
        // Token.
        const check = WorkCheck.fixableReason(id, instance);
        const io = check.io;

        // Resting until it respawns, or a Field with nothing ripe: no cycle and no mark. Its hero
        // lets go on the next flag pass.
        if (WorkCheck.AWAY.has(check.reason)) {
            setAlert(instance, null);
            continue;
        }

        if (check.reason === ALERT.NO_RECIPE) {
            // Its selected recipe wants context that is not beside it (or the Token's pool is empty
            // and it has nothing to select). Adjacency does not decide what a station makes, only
            // whether it can make it.
            const reqs = RecipeResolver.getMissingRequirements(id, instance);
            const missingNames = reqs.items?.length > 0
                ? reqs.items.join(', ')
                : (def?.name || tokenName(instance.typeId) || instance.typeId);

            if (setAlert(instance, ALERT.NO_RECIPE)) EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: id,
                severity: 'yellow',
                type: 'out_of_token',
                name: missingNames,
                title: `Missing token: ${missingNames}`,
                message: `Missing token: ${missingNames}`
            });
            continue;
        }

        if (check.reason === ALERT.CHOOSE_BUILD || check.reason === ALERT.CHOOSE_RECIPE) {
            // A Foundation or a station with nothing picked. Flags do not claim one, so this is
            // only reached by a hero already on it when the pick was cleared. It waits, saying so.
            setAlert(instance, check.reason);
            continue;
        }

        if (check.reason === ALERT.INPUTS) {
            // Waits, keeping whatever progress it had. There are no partial cycles: it does not run
            // slower, it runs later.
            InputAllocator.noteStarved(instance.typeId);
            const startsNow = setAlert(instance, ALERT.INPUTS);

            const missingItem = check.inputCheck?.missing?.[0];
            const itemDef = missingItem ? getItem(missingItem.itemId) : null;
            const itemName = itemDef?.name || missingItem?.itemId || 'Item';
            if (startsNow) EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: id,
                severity: 'yellow',
                type: 'out_of_item',
                name: itemName,
                message: `Out of item: ${itemName}`
            });
            continue;
        }

        // Charges are a requirement like any other, so they are checked in the same place as the
        // items: before the timer advances, not when it expires. A station that cannot afford a
        // full cycle waits and says so, rather than counting down to a completion it will have to
        // abandon. Nothing is deducted by the check.
        if (check.reason === ALERT.CHARGES) {
            InputAllocator.noteStarved(instance.typeId);
            if (setAlert(instance, ALERT.CHARGES)) EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: id,
                severity: 'yellow',
                type: 'out_of_charges',
                name: def?.name || tokenName(instance.typeId) || instance.typeId,
                message: `Out of charges: ${def?.name || tokenName(instance.typeId) || instance.typeId}`
            });
            continue;
        }

        // A finished build still waiting for room holds its full progress and its mark until the
        // room appears, rather than clearing the mark and raising it again every tick.
        if (instance.alert === ALERT.NO_ROOM && Foundations.isFoundation(def)
            && Foundations.buildTargetOf(io)
            && !Foundations.hasRoomToBuild(instance, Foundations.buildTargetOf(io))) {
            continue;
        }
        // Likewise a station whose finished cycle makes a Token with no room beside it or no room
        // under the mat cap.
        if (instance.alert === ALERT.NO_ROOM && !Foundations.isFoundation(def)
            && !hasRoomForTokenOutputs(id, io)) {
            continue;
        }

        setAlert(instance,null);

        // Refilled at the very end of this tick, it rested all of it: its cycle begins next tick and
        // is announced once, there. Begun here, its clock would stand at exactly zero and the next
        // tick would announce it a second time.
        const owed = carryIn.get(id);
        if (!(instance.cycleElapsedMs > 0) && owed !== undefined && owed + delta <= 0) continue;

        // A new cycle begins here.
        // ⚠️ This position is the whole meaning of the event. Everything above it is a guard (a
        // hero is present, the recipe resolved, the inputs are in the Bank, the charges are
        // affordable), so a Token that reaches this line is genuinely starting work, not merely
        // being ticked. A Token stalled for want of ore never gets here and never claims to have
        // started; when it finally resumes, it fires once.
        // `cycleElapsedMs` is still zero for exactly one tick per cycle, which is what makes this
        // fire once rather than every tick. `completeCycle` resets it, so the next cycle announces
        // itself too.
        if (!(instance.cycleElapsedMs > 0)) {
            // `heroId` rides along so a rule reacting to a cycle STARTING can know who started it,
            // as the same rule on a cycle COMPLETING can.
            EventBus.publish(BOARD_EVENTS.CYCLE_START, { instanceId: id, typeId: instance.typeId, heroId: heroId || null });
            LoadoutMoments.fire(id, heroId, 'CYCLE_START');
        }

        // The fast path: everything above is a cheap guard, this is the work.
        const before = instance.cycleElapsedMs > 0 ? instance.cycleElapsedMs : carryAtStart(id, heroId);
        instance.cycleElapsedMs = before + delta;

        // WORK_TIME, widened to the neighbours, then floored twice (`TileModifiers.workTimeOf`).
        // `io.cycleTimeMs` is the active recipe's own timing when it has one, falling back to the
        // station's flat config.
        const isGuildHall = instance.typeId === 'token_guild_hall';
        const baseCycle = io.cycleTimeMs || config.cycleTimeMs || 10000;
        const cycleTime = isGuildHall
            ? (config.cycleTimeMs || 10000)
            : TileModifiers.workTimeOf(id, baseCycle, config.skill);

        if (instance.cycleElapsedMs >= cycleTime) {
            // Only a cycle that crossed its end during this tick has a leftover; one that held at
            // full progress (no room, a raced input) and finishes on a retry does not.
            const overshoot = before < cycleTime ? instance.cycleElapsedMs - cycleTime : 0;
            completeCycle(instance, def, io, heroId, config, overshoot);
            if (overshoot > 0 && instance.cycleElapsedMs === 0) {
                carryOut.set(id, overshoot);
                if (heroId) heroCarryOut.set(heroId, overshoot);
            }
        } else if (publishProgress) {
            // Ref-based UI updates only: this bypasses React entirely, because re-rendering every
            // tile several times a second would be a cascade.
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                instanceId: id,
                percent: Math.min(100, (instance.cycleElapsedMs / cycleTime) * 100),
                elapsedMs: instance.cycleElapsedMs,
                cycleTimeMs: cycleTime
            });
        }
    }
}

/** A board just came in, from a save or from another Region: rebuild what is derived from it. */
function boardInstalled() {
    // A station or support saved with charges, from before they stopped wearing out, reads as
    // unlimited from here on.
    Charges.clearNeverWearingCharges();
    TileModifiers.rebuildAll();

    // The one path a `Cannot` has no last location to fly back to: a save authored before the
    // restriction existed, loading into a board the rule now forbids. The offenders are moved
    // to the nearest legal spot on the mat, so nothing is destroyed and the board is legal by
    // the time the player sees it. A Token with no legal spot anywhere near stays put.
    // Almost always a no-op: it costs one pass over the Tokens, and only Tokens carrying a
    // `Cannot` are examined at all.
    const moved = Restrictions.reconcile(relocateOffender);
    for (const { id, typeId, x, y, to } of moved) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, x, y, typeId: null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, ...to, typeId });
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [{ x, y }, to] });
    }
    if (moved.length) {
        TileModifiers.rebuildAll();
        logger.info('BoardRunner',
            `${moved.length} Token(s) sat somewhere their rules forbid and were moved to a legal spot`);
    }
}

export function init() {
    // Tile aggregators are runtime-only and rebuilt from board state, so they must be refreshed
    // whenever the neighbourhood changes (placement, removal, depletion) and replayed wholesale
    // after a load. A silently empty aggregator after a reload is the classic failure this guards
    // against (`ModifierScopes.test.js` pins the rule).
    // The payload is `points`: the mat points a change touched (where Tokens left AND where they
    // landed); every Token within Near of any of them is rebuilt. A board-reach rule widens it to
    // the whole board (`rebuildTokens`).
    EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, ({ points } = {}) => {
        if (Array.isArray(points)) TileModifiers.rebuildAround(points);
    });
    EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, boardInstalled);
    EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, boardInstalled);

    // Triggered Tokens listen on the board's own events. Subscribing here keeps every board
    // subscription in one place, and `init` is idempotent so a reload replaces the handlers rather
    // than doubling them.
    TriggerSystem.init();

    logger.info('BoardRunner', 'Board cycle engine ready');
}

/**
 * Whether a hero has nothing to do: the yellow mark.
 *
 * Deliberately a hero fact rather than a tile fact: it lives on the person, so it costs nothing
 * against the tile's information budget. It should stand out hard, because spotting idle people is
 * the main thing a returning player needs to do.
 */
export function isHeroIdle(heroId) {
    if (!heroId) return false;
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded') return false;

    // A hero is idle with no order (at the Guild Hall), at a spot, or with their job gone.
    const status = Flags.statusOf(heroId);
    if (status.state === 'docked' || status.state === 'returning' || status.needsJob) return true;
    const unclaimed = status.state === 'idle' || (status.state === 'walking' && !status.instanceId);
    if (unclaimed) {
        if (status.order === 'spot') return true;
        const kind = Flags.waitingOf(heroId)?.kind;
        // Waiting by the Token their order names (resting, growing, another hero's) is their job.
        if (status.order === 'token') return !kind;
        // Waiting for a node in reach to come back is doing their job, not idling.
        return kind !== 'node';
    }
    if (status.state === 'walking') return false;
    return !!BoardState.getTokenById(status.instanceId)?.alert;   // working, but stuck
}
