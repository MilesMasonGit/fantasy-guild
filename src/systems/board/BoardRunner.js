// the board's cycle engine

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType, rollOutputQuantity, outputRange, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as BoardState from './BoardState.js';
import * as InputAllocator from './InputAllocator.js';
import * as TileModifiers from './TileModifiers.js';
import * as RecipeResolver from './RecipeResolver.js';
import * as Charges from './Charges.js';
import * as Respawn from './Respawn.js';
import * as BlockUpkeep from './BlockUpkeep.js';
import * as TriggerSystem from './TriggerSystem.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import * as BoardCombat from './BoardCombat.js';
import * as Flags from './Flags.js';
import * as HeroMotion from './HeroMotion.js';
import * as EnemyMotion from './EnemyMotion.js';
import * as Groves from './Groves.js';
import * as GroveFelling from './GroveFelling.js';
import * as TimedChanges from './TimedChanges.js';
import * as WorkCheck from './WorkCheck.js';
import * as Foundations from './Foundations.js';
import * as Demolition from './Demolition.js';
import { workConfigOf, LANE } from './StationRecipe.js';
import * as SecondRecipe from './SecondRecipe.js';
import * as Restrictions from './Restrictions.js';
import * as Placement from './Placement.js';
import * as RoomWait from './RoomWait.js';
import * as MatPlacement from './MatPlacement.js';
import * as StatusApplication from './StatusApplication.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as RareDrops from './RareDrops.js';
import * as RareTables from './RareTables.js';
import * as OutputRules from './OutputRules.js';
import * as CycleSavings from './CycleSavings.js';
import * as Fortune from './Fortune.js';
import * as Wisdom from './Wisdom.js';
import * as InputCost from './InputCost.js';
import * as Fishing from './Fishing.js';
import * as FishingSpots from './FishingSpots.js';
import * as Fields from './Fields.js';
import * as Shrines from './Shrines.js';
import * as Studies from './Studies.js';
import * as SupportLinks from './supportLinks.js';
import * as Thefts from './Thefts.js';
import * as CoinDrops from './CoinDrops.js';
import * as LoadoutMoments from './LoadoutMoments.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as Breakage from '../equipment/Breakage.js';
import * as Summons from './Summons.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { centreOf } from './nearby.js';
import * as Hand from './Hand.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { noteRecipeMade, noteTokenBuilt } from '../progression/collectionLog.js';

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
 * Nor does a skill level save inputs: a cycle's input cost moves only by Efficiency rules
 * (`INPUT_COST`: tile, neighbour, guild-wide and carried), resolved in `completeCycle` through
 * `InputCost`. ⚠️ A per-level saving was deferred to the hero rework: do not quietly add one.
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
 * have lost the time anyway. Negative for a Token a timed change put in place or brought back
 * during this tick (a refill, a Sapling's Oak, a spawn): the part of the tick before it stood
 * there (`TimedChanges.arrivalsThisTick`).
 */
let carryIn = new Map();
let carryOut = new Map();

/**
 * The same leftover by hero id: handed to the cycle the hero starts on the very next tick on
 * another Token (a camp hero whose tree was just used up moves to the next one), so moving on loses
 * nothing either, and a catch-up's 1 s steps take the next Token at the same moment many small live
 * steps do. Where both a Token's and its hero's leftover stand, the later start wins (the smaller
 * leftover: a Token that came during the tick is not worked before it came).
 */
let heroCarryIn = new Map();
let heroCarryOut = new Map();

/**
 * A Many Hands station's second recipe's leftover, by instance id, as {@link carryIn} is its first's:
 * each lane's cycle ends on its own clock, so each hands its own leftover on. A Token that refilled
 * during the tick owes its rest on both. ⚠️ No hero record for it: a hero arrives at both lanes at
 * once and the first's carries the hero's leftover; a second leftover beside it would cut the first
 * lane's own (the later start wins in {@link carryAtStart}).
 */
let carry2In = new Map();
let carry2Out = new Map();

/**
 * The board the leftovers above were made on. ⚠️ A new game, a load and a journey to another Region
 * each put a new board object in place, and the leftovers go with the old one: a hero keeps their
 * id across all three and a load brings back the same Token ids, so a leftover kept would start the
 * first cycle on the new board part-done.
 */
let carryBoard = null;

function forgetCarryOffItsBoard() {
    const board = GameState.state?.board ?? null;
    if (board === carryBoard) return;
    carryBoard = board;
    carryIn.clear();
    carryOut.clear();
    heroCarryIn.clear();
    heroCarryOut.clear();
    carry2In.clear();
    carry2Out.clear();
}

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
 * A station's second recipe's problem (an `ALERT` reason), or none: kept on the instance as
 * `secondAlert` for its card alone, which names it. Never the mat's mark, never news: the red mark
 * is the first recipe's (owner, 2026-11-25).
 */
function setSecondAlert(instance, reason) {
    const next = reason || null;
    if ((instance.secondAlert || null) === next) return;
    if (next) instance.secondAlert = next;
    else delete instance.secondAlert;
}

/** The problem of `lane`'s recipe: the first's is the Token's mark, the second's its card's. */
function setLaneAlert(instance, lane, reason) {
    if (lane === LANE.SECOND) setSecondAlert(instance, reason);
    else setAlert(instance, reason);
}

/** What a station's no-room wait is told under: the Token's id for its first recipe. */
function roomKeyOf(id, lane) {
    return lane === LANE.SECOND ? `${id}:second` : id;
}

/**
 * The most copies a recipe's Token outputs can make in one cycle: each output's authored maximum,
 * `chance` ignored (room is reserved for all). A summon is no Token on the mat: it needs no room.
 */
function tokenOutputCount(io) {
    let n = 0;
    for (const output of io?.outputs || []) {
        if (output?.tokenId && !Summons.isSummonOutput(output)) n += Math.max(0, outputRange(output).max);
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
        if (output?.tokenId && !Summons.isSummonOutput(output) && !Placement.hasRoomForProduct(id, output.tokenId, count)) return false;
    }
    return true;
}

/**
 * A Token output makes exactly what it rolled, beside the station: never widened by YIELD,
 * doubled by LOOT_MULT or multiplied by GIANT_HARVEST, because room was reserved for the recipe's
 * authored maximum before the cycle paid, and a Token must never be made with nowhere to stand. It
 * is not pushed to `produced`: that list is matched against item ids (`TriggerSystem.producedMatches`).
 *
 * ⚠️ The room check before paying looks at the first copy only (`Placement.hasRoomForProduct`), so
 * on a crowded mat a later copy can still find nowhere. It is not lost: it waits in the station
 * (`instance.waitingOutput`, saved) and lands when room appears ({@link landWaitingOutput}).
 */
function placeTokenOutput(instance, output) {
    const copies = rollOutputQuantity(output);
    for (let i = 0; i < copies; i++) {
        const placed = (instance.waitingOutput?.length) ? null : Placement.placeProduct(instance.id, output.tokenId);
        if (!placed?.success) waitForRoom(instance, output.tokenId);
    }
}

/** Keep a made Token in its station until there is room for it, and say so once. */
function waitForRoom(instance, typeId) {
    (instance.waitingOutput ||= []).push(typeId);
    setAlert(instance, ALERT.NO_ROOM);
    RoomWait.tell(instance.id, { source: RoomWait.SOURCE.STATION, instanceId: instance.id, typeId: instance.typeId });
}

/**
 * Land what a station made and kept for want of room, in the order it was made, as far as room
 * allows. Returns whether any still waits: the station starts no new cycle until all have landed.
 */
function landWaitingOutput(instance) {
    const left = [];
    for (const typeId of instance.waitingOutput) {
        const placed = !left.length && Placement.hasRoomForProduct(instance.id, typeId)
            ? Placement.placeProduct(instance.id, typeId)
            : null;
        if (!placed?.success) left.push(typeId);
    }
    if (left.length) {
        instance.waitingOutput = left;
        return true;
    }
    delete instance.waitingOutput;
    RoomWait.landed(instance.id);
    return false;
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
 * A finished cycle's Double Loot and Giant Harvest, rolled: `{ doubled, giant }`. A failed cycle
 * rolls neither.
 * YIELD and LOOT_MULT are the output rules a kill's loot follows too (`OutputRules`).
 * GIANT_HARVEST: a Farming cycle's drops all come in at ten times, Double Loot's on top. ⚠️ Rolled
 * after Double Loot and only for Farming work a rule reaches, so without one nothing is drawn; and
 * before a water's catch, which draws too.
 */
function rollMultipliers(instanceId, config, failed) {
    return {
        doubled: failed ? false : OutputRules.rollDoubleLoot(instanceId, config.skill),
        giant: failed ? false : OutputRules.rollGiantHarvest(instanceId, config.skill)
    };
}

/**
 * What a finished cycle makes, once it is paid: its outputs (`made.outputs`, already the catch on a
 * water) rolled and landed with its Double Loot and Giant Harvest (`rolls`), the rare table's find,
 * the bonus drops, a theft's coins, and a shrine's offering lighting it. A failed cycle makes nothing
 * here. Run once per cycle, and once more for an Echo. Fills `made.produced`, and on a theft
 * `made.stolen` (its coins among them, marked `coins`).
 * Item output lands on the BOARD, not in the Bank: it is not banked until collected, and if the
 * Bank is full it simply waits there. A Token output stands on the mat beside the station.
 */
function landOutputs(made, { doubled, giant }) {
    const { instance, def, io, config, outputs, produced, stolen, failed, building, sure } = made;
    const id = instance.id;
    // A Laboratory's study makes no goods: its one yield is a mastery point to the node's kind.
    if (io.study) {
        if (!failed) Studies.land(instance, io.study, made.heroId);
        return;
    }
    const times = (doubled ? 2 : 1) * (giant ? OutputRules.GIANT_HARVEST_TIMES : 1);
    let giantLanded = false;

    // What a theft took, one line an item, so an Echo's second landing (or a rare find of a line's
    // item) adds up.
    const noteStolen = (line) => {
        const same = stolen.find(s => s.itemId === line.itemId);
        if (same) same.quantity += line.quantity;
        else stolen.push({ ...line });
    };
    // One item line, once its chance has landed: the authored range rolled, then the cycle's rules
    // (`OutputRules.landItemLine`). Every drop lands this way, the rare table's too. `note` hears the
    // sprite (for the twinkle). A line naming no item pays nothing: the cycle still runs and still
    // takes its inputs.
    const landLine = (output, note) => {
        const quantity = OutputRules.landItemLine(id, config.skill, output, times, note);
        if (!quantity) return;
        produced.push(output.itemId);
        if (io.steal) noteStolen({ itemId: output.itemId, quantity });
        giantLanded = giant;
    };

    // A build makes its Token by becoming it (below), never as a sprite. A summon is charged once,
    // by `chargeSummons`, never landed. Fortune's sure find on a Token with no rare table is its
    // rarest line (`sure.line`), landed without its roll.
    for (const output of outputs) {
        if (Summons.isSummonOutput(output)) continue;
        const chance = output.chance ?? 100;
        if (output !== sure?.line && chance < 100 && Math.random() * 100 > chance) continue;

        if (output.tokenId) {
            placeTokenOutput(instance, output);
            continue;
        }
        landLine(output, (sprite) => RareDrops.noteDrop(sprite, chance));
    }

    // The Token's rare drop table, after its own lines: one roll at its chance widened by Lucky,
    // and on a hit one find by weight, landed as any line is (Double Loot doubles it, Double Item
    // works on it) and always marked a rare find for the mat's twinkle (`RareDrops.noteRareFind`;
    // the twinkle itself is switched off in `lootEffects.js`). A failed cycle rolls nothing, a build drops nothing, and
    // a Token with no table draws nothing.
    // A theft rolls its camp's steal table's rare finds, never the Hideout's own. Fortune's sure find
    // (`sure.entry`) is the table's rarest, landed with no roll and no pick.
    if (!failed && !building) {
        const block = io.steal ? io.steal.table.block : def;
        const find = sure?.entry ? RareTables.sureFind(id, block, config.skill) : RareTables.rollRareTable(id, block, config.skill);
        if (find) landLine(find.entry, (sprite) => RareDrops.noteRareFind(sprite, find.chance));
    }
    // BONUS_DROP, skipped entirely on a failed cycle: nothing happened, so nothing drops. Double Loot
    // and Giant Harvest multiply it as they do the Token's own drops.
    if (!failed) {
        const bonus = OutputRules.dropBonusGrants(id, times);
        if (bonus.length) giantLanded = giant;
        for (const drop of bonus) produced.push(drop.itemId);
    }
    // A theft's coins last, a pile of their own as a kill's are (`CoinDrops`): Coin Find reaching the
    // Hideout raises them, Double Loot never does. A caught thief takes none; an Echo takes them again.
    // ⚠️ A table with no coins draws nothing here.
    if (io.steal && !failed && !building) {
        const coins = CoinDrops.dropStolenCoins(id, io.steal.table, config.skill);
        if (coins) noteStolen(coins);
    }
    // Celebrated only once something did come in at ten times (a line whose chance missed did not).
    if (giantLanded) EffectFeedback.giantHarvest(id);

    // A shrine's offering: the cycle that spent it keeps the shrine lit longer. Lit from out, its
    // blessing starts reaching its neighbours now.
    if (!failed && !building && Shrines.light(instance, def, io.recipe)) {
        TileModifiers.rebuildAround([centreOf(instance)]);
    }
}

/**
 * A finished cycle's summon outputs (a Summoning Circle's call, `Summons.isSummonOutput`), each
 * charging the Circle's Summoned worker for `heroId`'s level once its chance has landed. Once a
 * cycle: an Echo lands the outputs again but never charges again. A failed cycle or a build has no
 * outputs here.
 */
function chargeSummons({ instance, config, outputs }, heroId) {
    for (const output of outputs) {
        if (!Summons.isSummonOutput(output)) continue;
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;
        Summons.chargeFromCircle(instance, output.tokenId, heroId, config.skill);
    }
}

/**
 * A finished cycle's XP to its hero: the active recipe's when it defines its own (a Feast should
 * teach more than Bread even though both run on a Kitchen), a catch its fish's own when it names one,
 * widened by XP_BONUS the way YIELD widens output, and shared by a Wisdom rule reaching the Token
 * (`Wisdom.js`). A failed cycle teaches nothing.
 */
function giveCycleXp({ instance, io, config, caught, failed }, heroId) {
    const baseXp = caught?.xp ?? io.xp ?? config.xp;
    const xpAwarded = failed ? 0 : SkillSystem.applyXpBonus(baseXp || 0, TileModifiers.resolveAxis(
        instance.id, EFFECT_TYPES.XP_BONUS, baseXp || 0, config.skill
    ));
    if (xpAwarded > 0 && heroId && config.skill) {
        SkillSystem.addXP(heroId, config.skill, xpAwarded);
        Wisdom.shareXp(instance.id, heroId, config.skill, xpAwarded);
    }
}

/**
 * One Token finished a cycle.
 *
 * Order matters: pay first, then produce. Deciding the whole exchange before any of it happens is
 * what stops a Token handing out output it cannot afford.
 *
 * Every reader is asked by the Token's instance id, and every event names it by `instanceId`.
 *
 * `lane` is the station's recipe that finished (`StationRecipe.LANE`): a Many Hands station's second
 * recipe finishes on its own clock, with its own problem, and says so on `CYCLE_COMPLETE`
 * (`lane: 2`); everything else a cycle does, it does.
 */
function completeCycle(instance, def, io, heroId, config = def.config, overMs = 0, lane = LANE.FIRST) {
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
        setLaneAlert(instance, lane, ALERT.NO_ROOM);
        RoomWait.tell(roomKeyOf(id, lane), { source: RoomWait.SOURCE.STATION, instanceId: id, typeId: instance.typeId });
        return;
    }
    RoomWait.landed(roomKeyOf(id, lane));

    // INPUT_COST (Efficiency), widened to read the Token's neighbours: a Tool Rack beside a Forge
    // makes it cheaper to run. Each input carries its exact cost and the most it can take (the cost
    // rounded up); it is made whole by chance only as the cycle pays (`InputCost`), so this check
    // asks for the most and the roll can never make the cycle unaffordable.
    const costed = InputCost.costedInputs(id, io.inputs, config.skill);

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
        setLaneAlert(instance, lane, ALERT.CHARGES);
        return;
    }

    // PRESERVATION: a chance a cycle that works uses none of its materials. Asked before anything is
    // paid; with no chance offered (or nothing to pay) the cycle pays exactly as it always has.
    // ⚠️ With a chance offered the inputs are paid AFTER the failure roll, since a failed cycle pays
    // and never rolls: only checked here, then paid below unless the roll hits. Paying moves the Bank,
    // and an On Bank Holds rule fires (and may draw) the moment it moves, so the order without a
    // chance must stay pay-then-fail or the bench's work check would see a different stream.
    // Either way an Efficiency cost is rounded just before it is paid, and never for a cycle that
    // keeps its materials: check, [failure, Preservation,] round, pay.
    const keepChance = costed.length ? CycleSavings.preservationChance(id, config.skill) : 0;
    if (!InputAllocator.checkInputs(costed).ok) {
        // Raced by another Token between the availability check and here.
        // Keep the progress and wait — the cycle is not lost, only delayed.
        setLaneAlert(instance, lane, ALERT.INPUTS);
        return;
    }
    // What was paid, kept for a build: the building remembers what its materials cost.
    let paid = [];
    const pay = () => {
        paid = InputCost.rolledInputs(costed);
        InputAllocator.consumeInputs(paid);
    };
    if (!(keepChance > 0)) pay();

    if (lane === LANE.SECOND) instance.secondElapsedMs = 0;
    else instance.cycleElapsedMs = 0;

    // FAIL_CHANCE: a probability axis, resolved through the same three-bucket formula as everything
    // else and then rolled once. Base 0: nothing fails unless something nearby says so. A failed
    // cycle still consumes its inputs, wears nearby support and burns a charge (failure costs the
    // cycle, it does not rewind it) but produces no output and grants no XP. That also makes
    // `failed: true` real for triggers, which fire on success only.
    const failChance = TileModifiers.resolveAxis(
        id, EFFECT_TYPES.FAIL_CHANCE, 0, config.skill
    );
    const failedRoll = failChance > 0 && Math.random() * 100 < failChance;
    // A Hideout's theft (`io.steal`): a thief caught takes nothing and learns nothing, a failed cycle
    // in all but name, and the camp gets its guard below. One draw, only for a theft that did not fail.
    const thiefCaught = !failedRoll && !!io.steal && Thefts.rollCaught(id, heroId, io.steal);
    const failed = failedRoll || thiefCaught;

    // The cycle still runs, makes its outputs and spends its charges; a Field's owed seed is never
    // paid for that crop, and a build that kept its materials remembers paying nothing.
    const preserved = keepChance > 0 && !failed && CycleSavings.rollChance(keepChance);
    if (keepChance > 0 && !preserved) pay();

    const rolls = rollMultipliers(id, config, failed);

    // What this cycle actually made, for the `a neighbour produces X` trigger.
    // ⚠️ Only what genuinely landed: an output whose chance roll missed, or
    // whose quantity rounded to nothing, did not happen and must not fire a
    // listener that says it did.
    const produced = [];
    // What a theft took, with how many, for its word (`Thefts.afterTheft`).
    const stolen = [];

    // Water: one catch from the pool the hero's tool and bait pick (one draw, unless the pool holds
    // one fish), in place of the Token's own outputs. It then lands like any output.
    // A failed cycle catches nothing and keeps its bait.
    let outputs = io.outputs || [];
    let caught = null;
    if (failed || buildTypeId) {
        outputs = [];
    } else if (Fishing.isWater(def)) {
        caught = Fishing.catchOf(id, def, heroId);
        outputs = caught ? [{ itemId: caught.itemId, chance: 100, minQty: 1, maxQty: 1 }] : [];
    }

    // FORTUNE, a shrine's blessing: a finished cycle counts toward a sure rare find, and the one that
    // fills the count lands the Token's rarest drop for certain (`Fortune.js`). Draws nothing. A
    // Laboratory's study lands no drops, so it counts nothing.
    const sure = failed || buildTypeId || io.study ? null
        : Fortune.countCycle(instance, config.skill, Fortune.rarestDropOf(io.steal ? io.steal.table.block : def, outputs));

    const made = { instance, def, io, config, outputs, caught, produced, stolen, failed, building: !!buildTypeId, heroId, sure };
    landOutputs(made, rolls);
    // A summon is a Summoned worker for this Circle to charge, never a Token beside it: charged here,
    // once a cycle, so an Echo (which lands the outputs again) does not charge it twice.
    chargeSummons(made, heroId);
    if (sure) EffectFeedback.fortune(id, () => SupportLinks.firstSupportOf(id, EFFECT_TYPES.FORTUNE, config.skill));

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
                CycleSavings.payItemRule(id, application);
                EffectFeedback.announce(id, application);
            }
        }
    }

    giveCycleXp(made, heroId);

    // ECHO, a shrine's blessing: the cycle that just ended repeats at once, for free. Its outputs land
    // again (rolled afresh; a water's catch is the same fish, with no Bait spent and no lure's break
    // rolled) and its XP comes again (a fish's own); it pays nothing, spends no charge, load or tool,
    // so it draws no chance to end, and the rules hear one cycle. Never a failed cycle or a build,
    // and never an echo of an echo. Fortune's sure find is the cycle's, not its echo's. ⚠️ No rule
    // reaching it, nothing is drawn.
    if (!failed && !buildTypeId && CycleSavings.rollEcho(id, config.skill)) {
        landOutputs({ ...made, sure: null }, rollMultipliers(id, config, false));
        giveCycleXp(made, heroId);
        EffectFeedback.echo(id, () => SupportLinks.firstSupportOf(id, EFFECT_TYPES.ECHO, config.skill));
    }

    // A theft is said (and a catch's guard set) once its drops and XP are in, a failed one never.
    if (io.steal && !failedRoll) Thefts.afterTheft(instance, io.steal, { heroId, caught: thiefCaught, items: stolen });

    // Pay the plan built at the top of this function: the Token's own operational cost. Anything
    // that hits 0 is destroyed by `commitPlan`, which is also where `null`-means-unlimited is
    // honoured: `null` is the opposite of 0, not a large version of it.
    // ⚠️ Nothing near the Token pays for this cycle: help is free (owner, 2026-10-24). A support or
    // a context Token never wears out, and a gathering node that helps its neighbours spends its
    // charges only on its own gathering (`Charges.planContextCharges`, `wearRule.js`).
    // Can't Run Out (a shrine's blessing, the Motherlode perk): on a hit of its chance nothing is
    // spent, failed or not, and Refresh is not drawn.
    // ⚠️ Not spending is also what keeps a source that ends by chance from drawing its end: that roll
    // lives where a charge is spent (`Charges.applyDelta`) and where a ripe Field is harvested
    // (`Fields.harvested`, which a refreshed cycle leaves before it rolls). So a tree it keeps never
    // falls, and Grove Felling below never hears of it.
    // Refresh: a cycle that succeeded and would spend something may spend nothing. A failed cycle
    // still burns its charge and never rolls, and neither does one with nothing to spend.
    const isField = Fields.isField(def);
    const spends = chargePlan.debits.length > 0 || (isField && Fields.stageOf(instance, def) === Fields.STAGE.RIPE);
    const unending = spends && CycleSavings.neverRunsOut(id, config.skill);
    const refreshed = unending || (!failed && spends
        && CycleSavings.rollRefresh(id, config.skill));
    const ended = refreshed ? [] : Charges.commitPlan(chargePlan, { heroId });
    // Used up just now: its rest began when this cycle ended, `overMs` before the tick's end.
    Respawn.restBeganEarlier(instance, overMs);
    // A tree felled by a cycle that worked may fell the touching trees of its kind (Grove Felling),
    // whose rests begin at the same moment.
    if (!failed && heroId && ended.includes(id)) GroveFelling.afterFall(instance, def, io, heroId, config.skill, overMs);

    // A Field spends one harvest of its load; the last sows its crop again, growing from the moment
    // this cycle ended (`overMs` into the tick), or stops it without a seed (`Fields.js`).
    if (isField) Fields.harvested(instance, def, { overMs, refreshed, heroId });

    // A study wears its node as a gathering cycle there would: its chance to end, a harvest, a spot's move on.
    if (io.study) Studies.wear(io.study, { failed, overMs });

    // The board's universal unit of work. One kill counts as one cycle too, so combat feeds this
    // exactly as production does.
    const finished = {
        instanceId: id,
        typeId: instance.typeId,
        // ⚠️ The cycle that spends a Token's last charge has already taken it off the mat above
        // (`commitPlan`), so a rule on this moment finds the Token, and where it stood, here.
        instance,
        heroId: heroId || null,
        failed,
        // How long before this tick's end the cycle ended: a rule's cooldown counts from then.
        overMs,
        // Which items this completion put on the board. The coarse "a neighbour
        // completed a cycle" trigger has always been able to say *that* one
        // finished; this is what lets a listener care about *what* it made.
        produced
    };
    // A second recipe's cycle is a cycle to every rule; the mat's work bar follows the first alone.
    if (lane === LANE.SECOND) finished.lane = LANE.SECOND;
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, finished);

    // Cheap tally, used by the Token-type statistics surface.
    const counts = GameState.state?.collection?.cyclesByTokenType;
    if (counts) counts[instance.typeId] = (counts[instance.typeId] || 0) + 1;
    if (!failed && io.recipe?.id) noteRecipeMade(io.recipe.id);

    // Last, so every reader above saw the Foundation that did the work. Its hero stays when the
    // building is work they can do (`Flags.followTransform`). A failed build has spent its inputs and stays a Foundation, like any
    // failed cycle.
    if (buildTypeId && !failed) {
        const fromTypeId = instance.typeId;
        const built = Foundations.buildInPlace(instance, buildTypeId, paid);
        if (built) {
            noteTokenBuilt(buildTypeId);
            EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, {
                instanceId: built.id, typeId: buildTypeId, fromTypeId, heroId: heroId || null
            });
        } else {
            logger.warn('BoardRunner', `${def.name}: had room to build ${buildTypeId}, then did not`);
        }
    }

    // ⚠️ After every other draw of the cycle's work: the tool it used may break.
    Breakage.afterWorkCycle(heroId, def, instance);

    // A fishing spot may move on after a catch, last since it takes the Token off the mat.
    if (caught) FishingSpots.afterCatch(instance, def);

    // A Summoned worker spends a charge for the cycle, and at none leaves: last, once it has landed.
    Summons.afterWorkCycle(heroId);
}

/**
 * A Token marked for demolition, for one tick: its hero's Construction work, a fixed time with no
 * recipe, inputs or charges, after which `Demolition.finish` takes it off the mat.
 *
 * ⚠️ No `CYCLE_START` or `CYCLE_COMPLETE`, no output, and a flat {@link Demolition.DEMOLISH_XP} only when it finishes: demolishing is not production, and a
 * rule or lesson counting cycles must not count it.
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
        if (Demolition.finish(instance, { heroId })) {
            SkillSystem.addXP(heroId, config.skill, Demolition.DEMOLISH_XP);
        }
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
 * A Many Hands station's second recipe, for one tick, after its first (`SecondRecipe.js`): it runs
 * only while the hero who worked the first this tick still works the station and holds Second
 * Recipe, on its own clock (`secondElapsedMs`) with its own materials, and its own problem
 * (`secondAlert`, the card's). Its own recipe's level is asked; the hero's other gates were the
 * first lane's. Its progress goes to the card (`SECOND_PROGRESS`), never the mat.
 *
 * ⚠️ After the first lane's cycle, which may have taken the Token off the mat, dismissed a Summoned
 * worker that spent its last charge, or broken a tool: asked again here.
 */
function tickSecondLane(instance, def, heroId, delta, publishProgress) {
    const id = instance.id;
    if (!heroId || !BoardState.getTokenById(id) || BoardState.workerOf(id) !== heroId) return;
    if (!SecondRecipe.runsSecond(instance, def, heroId)) return;

    const config = workConfigOf(def, instance, LANE.SECOND);
    const skillAlert = WorkCheck.heroReason(heroId, config, instance);
    if (skillAlert) {
        setSecondAlert(instance, skillAlert);
        return;
    }
    const check = WorkCheck.fixableReason(id, instance, undefined, LANE.SECOND);
    if (check.reason) {
        // Resting is the whole station's, and its mark the first lane's: no second problem then.
        setSecondAlert(instance, WorkCheck.AWAY.has(check.reason) ? null : check.reason);
        return;
    }
    const io = check.io;
    if (instance.secondAlert === ALERT.NO_ROOM && !hasRoomForTokenOutputs(id, io)) return;
    setSecondAlert(instance, null);

    const owed = carry2In.get(id);
    const running = instance.secondElapsedMs > 0;
    if (!running && owed !== undefined && owed + delta <= 0) return;
    if (!running) {
        EventBus.publish(BOARD_EVENTS.CYCLE_START, { instanceId: id, typeId: instance.typeId, heroId, lane: LANE.SECOND });
        LoadoutMoments.fire(id, heroId, 'CYCLE_START');
    }

    const before = running ? instance.secondElapsedMs : (owed ?? 0);
    instance.secondElapsedMs = before + delta;
    const cycleTime = TileModifiers.workTimeOf(id, io.cycleTimeMs || config.cycleTimeMs || 10000, config.skill);

    if (instance.secondElapsedMs >= cycleTime) {
        const overshoot = before < cycleTime ? instance.secondElapsedMs - cycleTime : 0;
        completeCycle(instance, def, io, heroId, config, overshoot, LANE.SECOND);
        if (overshoot > 0 && instance.secondElapsedMs === 0) carry2Out.set(id, overshoot);
    } else if (publishProgress) {
        EventBus.publish(BOARD_EVENTS.SECOND_PROGRESS, {
            instanceId: id,
            percent: Math.min(100, (instance.secondElapsedMs / cycleTime) * 100),
            elapsedMs: instance.secondElapsedMs,
            cycleTimeMs: cycleTime
        });
    }
}

/**
 * A station's first recipe, for one tick, once every guard on the Token itself has passed: whether
 * the board lets it run (`WorkCheck.fixableReason`), then its cycle's start, progress and end. The
 * Token's red mark is this lane's alone.
 */
function tickFirstLane(instance, def, config, heroId, delta, publishProgress) {
    const id = instance.id;
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
        return;
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
        return;
    }

    if (check.reason === ALERT.CHOOSE_BUILD || check.reason === ALERT.CHOOSE_RECIPE || check.reason === ALERT.BUILD_SITE
        || check.reason === ALERT.CHOOSE_CAMP || check.reason === ALERT.GUARDED
        || check.reason === ALERT.CHOOSE_NODE || check.reason === ALERT.NODE_MASTERED) {
        // A Foundation or a station with nothing picked. Flags do not claim one, so this is
        // only reached by a hero already on it when the pick was cleared. It waits, saying so.
        // Likewise a Foundation whose build may not stand where it is (moved off its Stone),
        // a Hideout whose camp has left its reach or has a guard on it (its thief stays by it),
        // and a Laboratory whose node has left its reach or whose kind is fully mastered.
        setAlert(instance, check.reason);
        return;
    }

    if (check.reason === ALERT.INPUTS) {
        // Waits, keeping whatever progress it had. There are no partial cycles: it does not run
        // slower, it runs later.
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
        return;
    }

    // Charges are a requirement like any other, so they are checked in the same place as the
    // items: before the timer advances, not when it expires. A station that cannot afford a
    // full cycle waits and says so, rather than counting down to a completion it will have to
    // abandon. Nothing is deducted by the check.
    if (check.reason === ALERT.CHARGES) {
        if (setAlert(instance, ALERT.CHARGES)) EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            instanceId: id,
            severity: 'yellow',
            type: 'out_of_charges',
            name: def?.name || tokenName(instance.typeId) || instance.typeId,
            message: `Out of charges: ${def?.name || tokenName(instance.typeId) || instance.typeId}`
        });
        return;
    }

    // A finished build still waiting for room holds its full progress and its mark until the
    // room appears, rather than clearing the mark and raising it again every tick.
    if (instance.alert === ALERT.NO_ROOM && Foundations.isFoundation(def)
        && Foundations.buildTargetOf(io)
        && !Foundations.hasRoomToBuild(instance, Foundations.buildTargetOf(io))) {
        return;
    }
    // Likewise a station whose finished cycle makes a Token with no room beside it or no room
    // under the mat cap.
    if (instance.alert === ALERT.NO_ROOM && !Foundations.isFoundation(def)
        && !hasRoomForTokenOutputs(id, io)) {
        return;
    }

    setAlert(instance,null);

    // Refilled at the very end of this tick, it rested all of it: its cycle begins next tick and
    // is announced once, there. Begun here, its clock would stand at exactly zero and the next
    // tick would announce it a second time.
    const owed = carryIn.get(id);
    if (!(instance.cycleElapsedMs > 0) && owed !== undefined && owed + delta <= 0) return;

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
    // station's flat config. At water it is the catch's own (`Fishing.cycleMsOf`).
    const authoredCycle = io.cycleTimeMs || config.cycleTimeMs || 10000;
    const baseCycle = Fishing.isWater(def) ? Fishing.cycleMsOf(def, heroId, instance, authoredCycle) : authoredCycle;
    const cycleTime = TileModifiers.workTimeOf(id, baseCycle, config.skill);

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

/**
 * Advance every Token on the board.
 *
 * @param {number} delta game milliseconds since the last tick
 */
export function tick(delta) {
    forgetCarryOffItsBoard();
    [carryIn, carryOut] = [carryOut, carryIn];
    carryOut.clear();
    [heroCarryIn, heroCarryOut] = [heroCarryOut, heroCarryIn];
    heroCarryOut.clear();
    [carry2In, carry2Out] = [carry2Out, carry2In];
    carry2Out.clear();

    // An older save's untethered enemies join their nearest camp, and a gone camp's enemies the
    // next camp of their kind, before any camp counts what it spawned below.
    EnemyMotion.attachUntethered();
    EnemyMotion.rehomeOrphans();
    // An older save's trees join the Forest in their reach, before any Forest counts its own.
    Groves.attachUntethered();

    // Timed changes: growths and spawners, on clocks advanced by this tick's
    // `delta`, so a catch-up fast-forwards them with everything else. Before Flags, so a hero
    // whose Token just changed under them lets go and chooses again this same tick, and before any
    // Token ticks, so a cycle on a Token that has gone is never advanced or completed.
    TimedChanges.tick(delta);
    // A Token that came during this tick (refilled, grown into, spawned) works only the part of it
    // after it came: its cycle starts owing the time before (a negative carry, read where a cycle
    // begins), so a big catch-up step and many small live ones end in the same place.
    for (const [id, sinceMs] of TimedChanges.arrivalsThisTick()) {
        if (sinceMs < delta) {
            carryIn.set(id, sinceMs - delta);
            carry2In.set(id, sinceMs - delta);
        }
    }

    // Fishing spots arrive on the water by themselves: after the timed changes, before Flags, so
    // a Fishing Hut's hero sees a new spot this tick. Nothing on a mat with no water.
    FishingSpots.tick(delta);

    // Flags keep, change or find their work: after the timed changes above, so a hero sees any new
    // Token this tick, and before any Token ticks, so `workerOf` below is already settled.
    Flags.assign(delta);

    // Heroes walk toward their work: after Flags has told them where, and before any Token ticks,
    // since a Token's cycle runs only once its hero has arrived and one who arrives this tick
    // starts now.
    HeroMotion.tick(delta);

    // Enemies stand still but for a step to open space before a crowded fight: after the heroes,
    // so a hero arriving this tick has already asked for it.
    EnemyMotion.tick(delta);

    // Buffs whose filters read charges or a worker's effects follow them: after the heroes have
    // settled where they work, before any Token works with its buffs.
    TileModifiers.refreshLiveFilters();

    const onMat = BoardState.tokens();
    if (!onMat.length) return;

    tickCounter++;
    TriggerSystem.beginTick(delta);
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
        // A shrine burns down on the same footing: tended or not, in the hand too. Going out turns
        // its whole blessing off.
        if (Shrines.burn(instance, def, delta)) {
            TileModifiers.rebuildAround([centreOf(instance)]);
        }

        // Triggered Tokens are rate-limited by a cooldown rather than a cycle, and like upkeep this
        // must run before every guard below: a purely triggered Token has no config and no hero at
        // all.
        TriggerSystem.tickCooldowns(instance, delta);

        // A Token in the player's hand is paused: no cycle, no fight, no charge spent, so nothing
        // can take it off the mat mid-drag. Its hero keeps the claim and stands by, and the cycle
        // (any carried-over leftover included) resumes where it stopped once it is put down.
        // ⚠️ A fought enemy is not paused but let go: a paused fight would leave the hero's statuses
        // (Venom, Burn) ticking on their own clock with no swing to eat or win. Lifting it ends the
        // fight as walking away does, so the drop starts a fresh one against a whole enemy.
        if (Hand.isInHand(id)) {
            if (BoardCombat.getFight(id)) BoardCombat.endFight(id);
            if (carryIn.has(id)) carryOut.set(id, carryIn.get(id));
            if (carry2In.has(id)) carry2Out.set(id, carry2In.get(id));
            continue;
        }

        // A station holding a Token it made with nowhere to put it starts nothing new until that
        // Token has landed, hero or no hero, and keeps its mark meanwhile. One marked for
        // demolition goes on to be demolished: the player chose to take it off.
        if (instance.waitingOutput?.length && landWaitingOutput(instance) && !Demolition.isMarked(instance)) {
            setAlert(instance, ALERT.NO_ROOM);
            continue;
        }

        // Enemy Tokens run on the combat engine rather than a work cycle. A tile with no hero on it
        // does nothing here and raises no alert, for the same reason an unstaffed Forest doesn't. A
        // hero is on an enemy only because the player sent them.
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

        // Inert by design — nothing to advance. ⚠️ The one rule for every work-cycle effect (Speed,
        // Failure, Preservation, Efficiency, Lucky, Double Loot...): `completeCycle` runs only past
        // here, so a Token with no work gets none, by what it is and never by its id.
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
            // A hero ordered here without the tool leaves the Token's "!" up too.
            setAlert(instance, WorkCheck.FIXABLE.has(skipped) ? skipped : (Flags.hasToolSkip(instance) ? ALERT.NO_TOOL : null));
            continue;
        }

        if (needsHero) {
            const skillAlert = WorkCheck.heroReason(heroId, config, instance);
            if (skillAlert) {
                setAlert(instance,skillAlert);
                continue;
            }
            // No bait at a water: no cycle and no mark, as a resting Token. Its hero lets go on the
            // next flag pass.
            if (WorkCheck.baitReason(heroId, instance, def)) {
                setAlert(instance, null);
                continue;
            }
        }

        tickFirstLane(instance, def, config, heroId, delta, publishProgress);

        // A Many Hands station's second recipe, after the first whatever the first is doing: one
        // short of materials, the other carries on (`SecondRecipe.js`).
        if (instance.secondRecipeId !== undefined) tickSecondLane(instance, def, heroId, delta, publishProgress);
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
    const at = BoardState.getTokenById(status.instanceId);
    if (!at?.alert) return false;
    // Working, but stuck: unless it is a Many Hands station whose second recipe runs while its first waits.
    return !(at.secondRecipeId !== undefined && !at.secondAlert && SecondRecipe.runsSecond(at, getTokenType(at.typeId), heroId));
}
