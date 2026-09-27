// Fantasy Guild — The board's cycle engine (7×7 Playmat rework, Phase 4)

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
import * as BoardPromotion from './BoardPromotion.js';
import * as Flags from './Flags.js';
import * as HeroMotion from './HeroMotion.js';
import * as TimedChanges from './TimedChanges.js';
import * as WorkCheck from './WorkCheck.js';
import * as Foundations from './Foundations.js';
import { workConfigOf } from './StationRecipe.js';
import * as Restrictions from './Restrictions.js';
import * as Placement from './Placement.js';
import * as MatPlacement from './MatPlacement.js';
import * as StatusApplication from './StatusApplication.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as LoadoutMoments from './LoadoutMoments.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { centreOf } from './nearby.js';
import { logger } from '../../utils/Logger.js';

/**
 * Re-exported so `BoardRunner.ALERT` keeps working for the engine suites that
 * read it that way. The definition itself lives in `boardEvents.js` (CR2-060)
 * so every publisher and reader can name it without an import cycle.
 */
export { ALERT };

/**
 * BoardRunner — every Token on the board, ticking.
 *
 * ## The fast path
 * 99% of ticks only add `delta` to a countdown. The expensive work — paying
 * inputs, granting output, spending a charge — happens only at the rare moment
 * a timer hits zero. With up to 48 live tiles at 10Hz that discipline matters
 * more than it did with 12 areas, not less.
 *
 * Tiles are a sparse map, so an early board with four Tokens iterates four
 * times, not forty-nine.
 *
 * ## A Token runs when four things are true
 *  1. It has a **config** — Context, Buff and Structure Tokens are inert by
 *     design; they work by adjacency (Phase 5), not by running.
 *  2. It has a **hero**, unless it is a Passive Generator (D-53, D-116).
 *  3. That hero meets its **skill requirement** — Access (D-67).
 *  4. Its **inputs are available** (D-127). No partial cycles: full speed or
 *     waiting.
 *
 * Fail 2 and the tile is quietly idle. Fail 3 or 4 *with a hero present* and it
 * raises a **red alert mark** (D-114), because that is a problem the player can
 * act on. Fail 2 alone raises nothing — with ~8 heroes on 48 tiles most of the
 * board is unstaffed at any moment, and flagging all of it would make the mark
 * meaningless (D-149).
 *
 * ## What this pass deliberately does NOT do (roadmap G-1)
 * D-67 gives a hero three board effects — Speed, Access, Efficiency — and
 * **two of the three are implemented**: Access, as the skill gate in rule 3
 * above, and Speed, via `heroSpeedFactor` at the cycle-time line below
 * (`SKILL_SPEED_FACTOR = 0.005` in `FormulaRegistry`, written as one SPEED
 * modifier per held skill by `HeroRehydration.updateHeroSkillModifiers`). A
 * level 10 hero works a Forest ~5% faster than a level 1 hero does.
 *
 * ⚠️ This comment used to claim a hero was "a gate, and only a gate" and that
 * hero level did not affect cycle time. **That was false** — Speed has been
 * live and is corrected here (2026-08-28).
 *
 * **Efficiency is the hole that is genuinely still open.** Input cost is
 * resolved in `completeCycle` through `TileModifiers.resolveAxis(INPUT_COST)`,
 * which reads tile, neighbour and guild-wide effects; heroes contribute
 * nothing to any of them,
 * because `HeroRehydration` writes SPEED modifiers and no others. A level 99
 * hero pays exactly what a level 1 hero pays.
 *
 * That remaining hole is a knowing one, deferred to the hero rework. **Do not
 * quietly fill it in because it looks missing** — it is in the roadmap's
 * deferred table.
 */

/** Tick counter, so progress events don't fire at full rate. */
let tickCounter = 0;

/** Publish progress every N engine ticks (~3/sec at 10Hz). */
const PROGRESS_EVERY = 3;

/*
 * Why the hero on a Token cannot work it (possession, then level) lives in
 * `WorkCheck.heroReason` since Free Playmat 1.4b, shared with the flags that
 * choose which Token to work.
 */

/**
 * How much faster the working hero is than a raw beginner — the SPEED axis
 * read off the HERO, not off the tile (CR2-072).
 *
 * **This is the only consumer of `EFFECT_TYPES.SPEED` on the board, and until
 * 2026-08-25 there was none at all**: `HeroRehydration.updateHeroSkillModifiers`
 * has always registered a SPEED modifier per skill level, and nothing ever read
 * it, so levelling a skill made a hero faster at nothing.
 *
 * Why it sits beside `WORK_TIME` rather than inside it: `TileModifiers` merges
 * the tile and guild scopes only, and a hero's skill is neither — it travels
 * with the person, not the square. So the tile's authored time is resolved
 * first and then DIVIDED by this factor, because SPEED is "how fast" while
 * WORK_TIME is "how long"; they pull in opposite directions.
 *
 * Returns 1 (no change) for an empty tile, an unknown hero, or a Token that
 * names no skill.
 *
 * @returns {number} ≥ 1 in practice; `combinePercentages` clamps at 0.
 */
function heroSpeedFactor(heroId, skill) {
    if (!heroId || !skill) return 1;
    const aggregator = HeroManager.getHero(heroId)?.aggregator;
    if (!aggregator) return 1;
    const factor = aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, skill);
    return factor > 0 ? factor : 1;
}

/**
 * Set or clear a tile's alert, publishing only on an actual change.
 *
 * Both sides are normalised to `null` before comparing (CR2-059). The comparison
 * used to be against the raw `reason`, and a Token that has just been created or
 * loaded has no `alert` field at all — so `undefined === null` was false, and the
 * first clear-alert call announced a change from "no alert" to "no alert". Once
 * per Token, not once per tick, but `alert` is not persisted: it happened again
 * on every load and every reload, as a burst across the whole board, at the
 * moment the UI is already busiest.
 */
function setAlert(instance, reason) {
    const next = reason || null;
    if ((instance.alert || null) === next) return;
    instance.alert = next;
    EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: instance.id, alert: instance.alert });
}

/**
 * The most copies a recipe's Token outputs can make in one cycle: each
 * output's authored maximum, `chance` ignored (TL-8 reserves room for all).
 */
function tokenOutputCount(io) {
    let n = 0;
    for (const output of io?.outputs || []) {
        if (output?.tokenId) n += Math.max(0, outputRange(output).max);
    }
    return n;
}

/**
 * Whether every Token this cycle could make has room beside the station
 * (TL-8). True when the recipe makes no Token.
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
 * A Token output makes exactly what it rolled, beside the station (TL-8):
 * never widened by YIELD or doubled by LOOT_MULT, because room was reserved
 * for the recipe's authored maximum before the cycle paid, and a Token must
 * never be made with nowhere to stand. It is not pushed to `produced`: that
 * list is matched against item ids (`TriggerSystem.producedMatches`).
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
 * Order matters: **pay first, then produce.** Deciding the whole exchange before
 * any of it happens is what stops a Token handing out output it cannot afford —
 * the bug `CardPreflight` was written for, kept as a rule now that its old home
 * is gone.
 *
 * Every reader is asked by the Token's instance id, and every event names it by
 * `instanceId` (Free Playmat 1.6b). There are no tiles.
 */
function completeCycle(instance, def, io, heroId, config = def.config) {
    const id = instance.id;

    /**
     * Building in place (Token Lifecycle 6.1, DP-6): a Foundation's cycle ends
     * with it BECOMING the Token its recipe outputs. Room is checked before
     * anything is paid: with nowhere legal to stand, the Foundation stays, its
     * progress stays full and nothing is spent, so the retry on the next tick
     * cannot charge twice.
     */
    const buildTypeId = Foundations.isFoundation(def) ? Foundations.buildTargetOf(io) : null;
    if (buildTypeId && !Foundations.hasRoomToBuild(instance, buildTypeId)) {
        setAlert(instance, ALERT.NO_ROOM);
        return;
    }

    /**
     * A Token a recipe makes lands on the mat beside this station (TL-8,
     * Token Lifecycle 9.3), as a `placed` Token that counts toward the mat
     * cap. Room is checked here, before anything is paid, exactly as a build
     * checks above: with the mat full or nowhere legal beside the station, the
     * cycle holds at full progress with the `NO_ROOM` mark, nothing is spent
     * and nothing is lost, and it retries every tick.
     */
    if (!buildTypeId && !hasRoomForTokenOutputs(id, io)) {
        setAlert(instance, ALERT.NO_ROOM);
        return;
    }

    // INPUT_COST, widened to read the Token's neighbours (G-5). A Tool Rack
    // beside a Forge makes it cheaper to run; before this, only the Token's own
    // aggregator was ever consulted and a neighbour could not touch it.
    const inputs = (io.inputs || []).map(input => ({
        ...input,
        quantity: Math.max(1, Math.round(TileModifiers.resolveAxis(
            id, EFFECT_TYPES.INPUT_COST, input.quantity || 1, config.skill
        )))
    }));

    /**
     * The atomic requirement check (concept §3.3), in the order that makes it
     * atomic: **plan every charge debit first, then spend the items, then
     * commit the charges.** A cycle needs 100% of its inputs — bank items,
     * station charges, and charges on the nearby context Tokens its recipe
     * draws on — before any of them is touched, and a short cycle deducts
     * nothing of any kind.
     *
     * Charges are planned before the items are spent because `planCycle`
     * mutates nothing: if it comes back short, the return below leaves the Bank
     * exactly as it found it. Committing after production keeps the existing
     * order in which a station that spends its last charge is destroyed only
     * once the cycle it paid for has actually produced.
     */
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

    /**
     * FAIL_CHANCE — a probability axis, resolved through the same three-bucket
     * formula as everything else and then rolled once (CMS-25's proc shape).
     *
     * Base 0: nothing fails unless something nearby says so. A failed cycle
     * still **consumes its inputs, wears nearby support and burns a charge**
     * — failure costs the cycle, it does not rewind it — but produces no output
     * and grants no XP. That is also what makes `failed: true` real for the
     * triggers Phase 6 adds, which fire on success only (CMS-34).
     */
    const failChance = TileModifiers.resolveAxis(
        id, EFFECT_TYPES.FAIL_CHANCE, 0, config.skill
    );
    const failed = failChance > 0 && Math.random() * 100 < failChance;

    // Item output lands on the BOARD, not in the Bank (D-40). It is not banked
    // until collected, and if the Bank is full it simply waits there (D-138).
    // A Token output stands on the mat beside the station (TL-8).
    //
    // YIELD is widened the same way (G-5): a Sawmill beside a Forest nudges what
    // it produces. Fractional results round probabilistically, so a x1.5 yield
    // is "1, plus a 50% chance of a 2nd" rather than silently truncating every
    // small buff to nothing — which is how D-120's deliberately small effects
    // would otherwise vanish entirely.
    /**
     * LOOT_MULT — "chance for double loot" (its own description in
     * `constants.js`). Another probability axis: resolved to a percentage, then
     * rolled ONCE per cycle rather than per output entry, so a lucky cycle
     * doubles everything it made rather than a random subset of it.
     */
    const isGuildHall = instance.typeId === 'token_guild_hall';
    const doubleChance = (failed || isGuildHall) ? 0 : TileModifiers.resolveAxis(
        id, EFFECT_TYPES.LOOT_MULT, 0, config.skill
    );
    const doubled = doubleChance > 0 && Math.random() * 100 < doubleChance;

    // What this cycle actually made, for the `a neighbour produces X` trigger.
    // ⚠️ Only what genuinely landed: an output whose chance roll missed, or
    // whose quantity rounded to nothing, did not happen and must not fire a
    // listener that says it did.
    const produced = [];

    // A build makes its Token by becoming it (below), never as a sprite.
    for (const output of (failed || buildTypeId) ? [] : (io.outputs || [])) {
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;

        if (output.tokenId) {
            placeTokenOutput(instance, output);
            continue;
        }

        // Roll the authored range FIRST, then widen it (CMS-41). Order matters:
        // a Sawmill should scale whatever this cycle actually rolled, not the
        // range's midpoint — otherwise a 1–5 output would buff identically on a
        // lucky cycle and an unlucky one.
        const scaled = isGuildHall
            ? rollOutputQuantity(output)
            : Math.max(0, TileModifiers.resolveAxis(
                id, EFFECT_TYPES.YIELD, rollOutputQuantity(output), config.skill
            ));
        const whole = Math.floor(scaled);
        const rolled = whole + (Math.random() < (scaled - whole) ? 1 : 0);
        const quantity = doubled ? rolled * 2 : rolled;
        if (quantity <= 0) continue;

        // An output names a Token or an item. One that names neither — a
        // Market's old currency output (D-141) — pays nothing: gold is retired
        // (SP-65) and its code deleted (Token Lifecycle 9.4). The cycle still
        // runs and still takes its inputs.
        if (output.itemId) {
            SpriteLayer.addSprite('item', output.itemId, quantity, id);
            produced.push(output.itemId);
        }
    }

    /**
     * BONUS_DROP — a nearby block granting something the Token does not make
     * itself (CMS-27/72). Rolled per entry, after the Token's own outputs, and
     * skipped entirely on a failed cycle: nothing happened, so nothing drops.
     *
     * Lands on the board like any other output (D-40) rather than straight into
     * the Bank, so it reads as part of the same completion.
     */
    if (!failed && !isGuildHall) {
        for (const grant of TileModifiers.collectItemGrants(id, EFFECT_TYPES.BONUS_DROP)) {
            const chance = grant.chance ?? 100;
            if (chance < 100 && Math.random() * 100 > chance) continue;
            // An item-borne grant spends units of the item that granted it
            // (UE-21). Paid AFTER the roll, so a miss costs nothing — the same
            // "charge burns on service, not on luck" rule Tokens follow. A
            // Token's grant carries no `sourceItemIds` and pays nothing here.
            if (!HeroEffects.payLoadoutCost(grant)) continue;
            const quantity = Math.max(1, grant.quantity || 1);
            SpriteLayer.addSprite('item', grant.itemId, quantity, id);
            produced.push(grant.itemId);
            // Announced only once the roll has actually landed — a 5% grant that
            // missed did nothing, and saying its name would teach the player the
            // opposite of how often it works (P3).
            EffectFeedback.announce(id, grant);
        }
    }

    /**
     * `Applies` — a neighbour putting a status on the hero who just worked here.
     *
     * The same moment and the same rules as BONUS_DROP directly above: skipped
     * on a failed cycle, because nothing happened; and it needs a person,
     * because a status has nowhere to live on a tile.
     *
     * ⚠️ Deliberately here rather than on a clock. A status is a stack applied
     * at an instant, not a field that hangs in the air — reapplying one every
     * tick would pin every DoT at maximum and never let a buff decay.
     */
    if (!failed && heroId) {
        for (const application of TileModifiers.collectStatusApplications(id)) {
            // `applyAt` already answers whether it rolled AND found somebody to
            // land on, so the announcement follows the status rather than the
            // attempt.
            // ⚠️ Checked, then applied, then paid. `applyAt` rolls the chance
            // internally, so paying up front would spend a potion on a roll that
            // missed; paying without checking first could apply a status the
            // hero cannot afford. Three steps, in that order.
            if (!HeroEffects.canPayLoadoutCost(application)) continue;
            if (StatusApplication.applyAt(id, application)) {
                HeroEffects.payLoadoutCost(application);
                EffectFeedback.announce(id, application);
            }
        }
    }

    // XP likewise comes from the active recipe when it defines its own (CMS-70):
    // a Feast should teach more than Bread even though both run on a Kitchen.
    // XP_BONUS then widens it the same way YIELD widens output.
    const baseXp = io.xp ?? config.xp;
    const xpAwarded = failed ? 0 : Math.round(TileModifiers.resolveAxis(
        id, EFFECT_TYPES.XP_BONUS, baseXp || 0, config.skill
    ));
    if (xpAwarded > 0 && heroId && config.skill) {
        SkillSystem.addXP(heroId, config.skill, xpAwarded);
    }

    /**
     * Pay the plan built at the top of this function: the station's own
     * operational cost, and any charges the recipe draws off nearby context
     * Tokens. Anything that hits 0 is destroyed by `commitPlan` (D-118), which
     * is also where `null`-means-unlimited is honoured (R-4, D-176) — `null` is
     * the opposite of 0, not a large version of it.
     */
    const chargedIds = new Set(chargePlan.debits.map(d => d.id));
    Charges.commitPlan(chargePlan, { heroId });

    // Context and Buff Tokens wear per cycle they SERVE (D-126). One Tool Rack
    // serving three Forges wears three times as fast, which is what makes
    // shared context a rate trade rather than free value (D-157).
    //
    // Tokens the plan above already charged are excluded: a context Token whose
    // charges the recipe names as an input has been billed once for this cycle
    // already, and D-126's flat wear on top of it would bill it twice.
    RecipeResolver.wearNearbySupport(id, (supportId, supportInstance) => {
        const support = supportInstance || BoardState.getTokenById(supportId);
        const spot = centreOf(support);
        Charges.destroyToken(support);
        // The neighbourhood, not just this Token: an aura going dark has to stop
        // applying to everything it reached, which means their aggregators too.
        TileModifiers.rebuildAround([spot]);
    }, chargedIds);

    // The board's universal unit of work. One kill counts as one cycle too
    // (D-129), so combat feeds this exactly as production does.
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

    // Last, so every reader above saw the Foundation that did the work. Its
    // hero lets go on the next pass and moves on (SP-52). A failed build has
    // spent its inputs and stays a Foundation, like any failed cycle.
    if (buildTypeId && !failed) {
        const fromTypeId = instance.typeId;
        // The paid `inputs` go with it: the built Token remembers its
        // Foundation and build cost for the discard refund (B3.1, TL-13).
        const built = Foundations.buildInPlace(instance, buildTypeId, inputs);
        if (built) {
            EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, {
                instanceId: built.id, typeId: buildTypeId, fromTypeId, heroId: heroId || null
            });
            EventBus.publish('state_changed');
        } else {
            logger.warn('BoardRunner', `${def.name}: had room to build ${buildTypeId}, then did not`);
        }
    }
}

/**
 * Advance every Token on the board.
 *
 * @param {number} delta milliseconds since the last tick, already time-scaled
 */
export function tick(delta) {
    // Timed changes (Token Lifecycle 3.2, DP-2): Saplings grow, Coasts turn
    // and turn back, on clocks advanced by this tick's `delta` — so the time
    // bank fast-forwards them with everything else. Before Flags, so a hero
    // whose Token just changed under them lets go and chooses again this same
    // tick (SP-51, SP-52), and before any Token ticks, so a cycle on a Token
    // that has gone is never advanced or completed.
    TimedChanges.tick(delta);

    // Flags keep, change or find their work (Free Playmat 1.4b) — after the
    // timed changes above, so a hero sees any new Token this tick, and before any Token ticks, so `workerOf` below is already settled.
    Flags.assign(delta);

    // Heroes walk toward their work (Hero Movement M1) — after Flags has told
    // them where, and before any Token ticks: a Token's cycle runs only once
    // its hero has arrived (FP-26), and one who arrives this tick starts now.
    HeroMotion.tick(delta);

    // Every Token on the mat, by instance id, in arrival order (Free Playmat 1.6b).
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

        // Effect-block upkeep runs on its OWN clock (CMS-60), before every
        // guard below: a Buff Token has no config, no hero and no work cycle,
        // so anything conditional on those would never charge it. When a block
        // switches between paid and unpaid the neighbourhood must be rebuilt —
        // an aura going dark has to actually stop applying, not just be flagged.
        if (BlockUpkeep.tickUpkeep(instance, def, delta)) {
            TileModifiers.rebuildAround([centreOf(instance)]);
        }

        // Triggered Tokens are rate-limited by a cooldown rather than a cycle
        // (CMS-29), and like upkeep this must run before every guard below —
        // a purely triggered Token has no config and no hero at all.
        TriggerSystem.tickCooldowns(instance, delta);

        // Enemy Tokens run on the combat engine rather than a work cycle
        // (D-90). They are INERT UNTIL TARGETED (D-14) — never initiating,
        // never aggroing — so a tile with no hero on it does nothing at all,
        // and raises no alert for the same reason an unstaffed Forest doesn't.
        if (BoardCombat.isEnemyToken(instance)) {
            // A hero who holds no combat skill cannot fight (D-249). Under
            // flags that hero never claims an enemy at all: the flag records
            // `unskilled` against it, shown on hover only (FP-60), so an enemy
            // Token never carries a red mark (Free Playmat 1.4c).
            setAlert(instance,null);

            // Called unconditionally: `tickTile` also owns ENDING a fight when
            // the hero has gone. Guarding on `heroId` here would leave the old
            // fight — and its damaged enemy — alive forever, so a player could
            // chip a boss down across free retreats (`G-4`).
            BoardCombat.tickToken(instance, delta, heroId);
            continue;
        }

        // A Token with a Promotes rule runs its own cycle rather than a recipe:
        // what it produces is a different hero, and routing that through
        // `RecipeResolver` would teach recipes about jobs (Promotes rule P3).
        // Called unconditionally for the same reason as combat — `tickTile` also
        // owns STOPPING: resetting a half-finished cycle when the hero leaves,
        // and clearing an offer so the next hero is asked afresh.
        if (BoardPromotion.isPromotionToken(instance)) {
            const { alert } = BoardPromotion.tickToken(instance, delta, heroId);
            setAlert(instance,heroId ? alert : null);
            continue;
        }

        // A Foundation authors no `config`; its skill and the selected
        // recipe's level stand in for one (Token Lifecycle 6.1).
        const config = workConfigOf(def, instance);

        // Inert by design — nothing to advance.
        if (!config) continue;

        const needsHero = def.requiresHero !== false;
        if (needsHero && !heroId) {
            // Quietly idle. NOT an alert: an unstaffed Token is not an error
            // (D-149), and most of the board is unstaffed at any moment.
            //
            // ⚠️ One exception (FP-69, FPP-2): a Token some flag passed over for
            // a reason the player can fix keeps its red badge, re-read live so
            // it clears the moment the problem does. Skill too low, wrong skill
            // and no skill are hover-only (FP-60) and never badge.
            const skipped = Flags.hasFixableSkip(instance)
                ? WorkCheck.fixableReason(id, instance).reason
                : null;
            setAlert(instance,skipped);
            continue;
        }

        if (needsHero) {
            const skillAlert = WorkCheck.heroReason(heroId, config);
            if (skillAlert) {
                setAlert(instance,skillAlert);
                continue;
            }
        }

        // What is this station making? Whatever the player set it to — see
        // `StationRecipe.js`. `WorkCheck` resolves whether the board around it
        // lets that recipe run, whether the inputs are there and whether the
        // charges are affordable — the same check a flag makes before claiming
        // (Free Playmat 1.4b). The side effects stay here: they describe a
        // hero actually standing on the Token.
        const check = WorkCheck.fixableReason(id, instance);
        const io = check.io;

        if (check.reason === ALERT.NO_RECIPE) {
            // Its selected recipe wants context that is not beside it (or the
            // Token's pool is empty and it has nothing to select). Adjacency
            // no longer decides what a station makes, but it still decides
            // whether it can make it.
            const reqs = RecipeResolver.getMissingRequirements(id, instance);
            const missingNames = reqs.items?.length > 0
                ? reqs.items.join(', ')
                : (def?.name || tokenName(instance.typeId) || instance.typeId);

            setAlert(instance,ALERT.NO_RECIPE);
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
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
            // A Foundation (Token Lifecycle 6.1) or a station (TL-15) with
            // nothing picked. Flags do not claim one, so this is only reached
            // by a hero already on it when the pick was cleared. It waits,
            // saying so.
            setAlert(instance, check.reason);
            continue;
        }

        if (check.reason === ALERT.INPUTS) {
            // Waits, keeping whatever progress it had. There are no partial
            // cycles (D-127) — it does not run slower, it runs later.
            InputAllocator.noteStarved(instance.typeId);
            setAlert(instance,ALERT.INPUTS);

            const missingItem = check.inputCheck?.missing?.[0];
            const itemDef = missingItem ? getItem(missingItem.itemId) : null;
            const itemName = itemDef?.name || missingItem?.itemId || 'Item';
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: id,
                severity: 'yellow',
                type: 'out_of_item',
                name: itemName,
                message: `Out of item: ${itemName}`
            });
            continue;
        }

        /**
         * Charges are a requirement like any other (concept §3.3), so they are
         * checked in the same place as the items — before the timer advances,
         * not when it expires. A station that cannot afford a full cycle waits
         * and says so, rather than counting down to a completion it will have
         * to abandon. Nothing is deducted by the check.
         */
        if (check.reason === ALERT.CHARGES) {
            InputAllocator.noteStarved(instance.typeId);
            setAlert(instance,ALERT.CHARGES);
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: id,
                severity: 'yellow',
                type: 'out_of_charges',
                name: def?.name || tokenName(instance.typeId) || instance.typeId,
                message: `Out of charges: ${def?.name || tokenName(instance.typeId) || instance.typeId}`
            });
            continue;
        }

        // A finished build still waiting for room (Token Lifecycle 6.1) holds
        // its full progress and its mark until the room appears, rather than
        // clearing the mark and raising it again every tick.
        if (instance.alert === ALERT.NO_ROOM && Foundations.isFoundation(def)
            && Foundations.buildTargetOf(io)
            && !Foundations.hasRoomToBuild(instance, Foundations.buildTargetOf(io))) {
            continue;
        }
        // Likewise a station whose finished cycle makes a Token with no room
        // beside it or no room under the mat cap (TL-8).
        if (instance.alert === ALERT.NO_ROOM && !Foundations.isFoundation(def)
            && !hasRoomForTokenOutputs(id, io)) {
            continue;
        }

        setAlert(instance,null);

        /**
         * A new cycle begins here (Unified Effects P5).
         *
         * ⚠️ **This position is the whole meaning of the event.** Everything
         * above it is a guard — a hero is present, the recipe resolved, the
         * inputs are in the Bank, the charges are affordable — so a Token that
         * reaches this line is genuinely starting work, not merely being ticked.
         * A Token stalled for want of ore never gets here and never claims to
         * have started; when it finally resumes, it fires once.
         *
         * `cycleElapsedMs` is still zero for exactly one tick per cycle, which
         * is what makes this fire once rather than sixty times a second.
         * `completeCycle` resets it, so the next cycle announces itself too.
         */
        if (!(instance.cycleElapsedMs > 0)) {
            // ⚠️ `heroId` rides along since Effects Grammar v2 V1. It was in
            // scope here all along and simply not passed, which meant a rule
            // reacting to a cycle STARTING could never know who started it —
            // while the same rule on a cycle COMPLETING could. One word of
            // difference between the two moments, for no reason anyone chose.
            EventBus.publish(BOARD_EVENTS.CYCLE_START, { instanceId: id, typeId: instance.typeId, heroId: heroId || null });
            LoadoutMoments.fire(id, heroId, 'CYCLE_START');
        }

        // --- the fast path: everything above is a cheap guard, this is the work
        instance.cycleElapsedMs = (instance.cycleElapsedMs || 0) + delta;

        // WORK_TIME, widened to the 8 neighbours (G-5), floored at 1s so no
        // stack of haste can drive a cycle to nothing (§10's "no absolute
        // mitigation" rule, inherited from EffectAxes).
        // `io.cycleTimeMs` is the active recipe's own timing when it has one
        // (CMS-70), falling back to the station's flat config (CMS-79).
        const isGuildHall = instance.typeId === 'token_guild_hall';
        const cycleTime = isGuildHall
            ? (config.cycleTimeMs || 10000)
            : Math.max(1000, TileModifiers.resolveAxis(
                id, EFFECT_TYPES.WORK_TIME, io.cycleTimeMs || config.cycleTimeMs || 10000, config.skill
            ) / heroSpeedFactor(heroId, config.skill));

        if (instance.cycleElapsedMs >= cycleTime) {
            completeCycle(instance, def, io, heroId, config);
        } else if (publishProgress) {
            // Ref-based UI updates only — this bypasses React entirely, because
            // 48 tiles re-rendering three times a second is the cascade the
            // deck loop's ref-bar pattern existed to avoid.
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                instanceId: id,
                percent: Math.min(100, (instance.cycleElapsedMs / cycleTime) * 100),
                elapsedMs: instance.cycleElapsedMs,
                cycleTimeMs: cycleTime
            });
        }
    }
}

export function init() {
    // Tile aggregators are runtime-only and rebuilt from board state, so they
    // must be refreshed whenever the neighbourhood changes — placement,
    // removal, depletion — and replayed wholesale after a load. A silently
    // empty aggregator after a reload is the classic failure this guards
    // against (`ModifierScopes.test.js` pins the rule).
    //
    // The payload is `points` — the mat points a change touched (where Tokens
    // left AND where they landed); every Token within Near of any of them is
    // rebuilt (Free Playmat 1.6b). A board-reach rule widens it to the whole
    // board (`rebuildTokens`).
    EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, ({ points } = {}) => {
        if (Array.isArray(points)) TileModifiers.rebuildAround(points);
    });
    EventBus.subscribe('game_loaded', () => {
        TileModifiers.rebuildAll();

        /**
         * The one path a `Cannot` has no last location to fly back to: a save
         * authored before the restriction existed, loading into a board the
         * rule now forbids. The offenders are moved to the nearest legal spot
         * on the mat (the Vault that used to take them went in Token Lifecycle
         * 9.3), so nothing is destroyed and the board is legal by the time the
         * player sees it. A Token with no legal spot anywhere near stays put.
         *
         * Almost always a no-op: it costs one pass over the Tokens, and only
         * Tokens carrying a `Cannot` are examined at all.
         */
        const moved = Restrictions.reconcile(relocateOffender);
        for (const { id, typeId, x, y, to } of moved) {
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, x, y, typeId: null });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, ...to, typeId });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [{ x, y }, to] });
        }
        if (moved.length) {
            TileModifiers.rebuildAll();
            EventBus.publish('state_changed');
            logger.info('BoardRunner',
                `${moved.length} Token(s) sat somewhere their rules forbid and were moved to a legal spot`);
        }
    });

    // Triggered Tokens listen on the board's own events (CMS-32/33). Subscribing
    // here keeps every board subscription in one place, and `init` is idempotent
    // so a reload replaces the handlers rather than doubling them.
    TriggerSystem.init();

    logger.info('BoardRunner', 'Board cycle engine ready');
}

/**
 * Whether a hero has nothing to do — the yellow mark (D-172).
 *
 * Deliberately a **hero** fact rather than a tile fact: it lives on the person,
 * so it costs nothing against the tile's three-thing information budget (D-85).
 * It should stand out hard, because **spotting idle people is the main thing a
 * returning player needs to do**.
 */
export function isHeroIdle(heroId) {
    if (!heroId) return false;
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded') return false;

    // Under flags (Free Playmat 1.4b): a hero is idle when their flag found
    // nothing to work, or in the Dock.
    const status = Flags.statusOf(heroId);
    if (status.state === 'docked' || status.state === 'returning' || status.state === 'idle') return true;
    // Walking back to the flag with nothing to do is idle; walking to work is not.
    if (status.state === 'walking') return !status.instanceId;
    return !!BoardState.getTokenById(status.instanceId)?.alert;   // working, but stuck
}
