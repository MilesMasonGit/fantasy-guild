// Fantasy Guild — The board's cycle engine (7×7 Playmat rework, Phase 4)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType, rollOutputQuantity, tokenName } from '../../config/registries/tokenRegistry.js';
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
import * as Managers from './Managers.js';
import * as Restrictions from './Restrictions.js';
import * as StatusApplication from './StatusApplication.js';
import * as TokenBank from './TokenBank.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * Re-exported so `BoardRunner.ALERT` keeps working for the engine suites that
 * read it that way. The definition itself moved to `boardEvents.js` (CR2-060)
 * so that `Managers` — which `BoardRunner` imports, and which publishes
 * `ALERT.UNSTOCKED` — can name the same constant without an import cycle.
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
 * A hero is **a gate, and only a gate**. D-67 gives them three board effects —
 * Speed, Access, Efficiency — and only **Access** is implemented. Hero level
 * does not change cycle time or input cost, so a level 99 hero works a Forest at
 * exactly the speed a level 1 hero does.
 *
 * That is a knowing hole, deferred to the hero rework. **Do not quietly fill it
 * in because it looks missing** — it is in the roadmap's deferred table.
 */

/** Tick counter, so progress events don't fire at full rate. */
let tickCounter = 0;

/** Publish progress every N engine ticks (~3/sec at 10Hz). */
const PROGRESS_EVERY = 3;

/**
 * Why the hero on a Token cannot work it — or `null` if they can.
 *
 * **Two gates, in order: possession, then level.**
 *
 * Possession is checked *even when the Token sets no level requirement*. That
 * ordering is the whole point of the rework and it was previously wrong: the
 * old version returned `true` the moment `skillRequired <= 0`, never
 * consulting the hero's skills, so a hero who did not hold the skill worked
 * the Token anyway. Harmless while every hero held all 15 skills; a hole
 * straight through possession now that they hold 6 of 27.
 *
 * A Token with no `skill` named at all still needs nothing but a body.
 *
 * @returns {'access'|'unskilled'|null} an `ALERT` reason, or null
 */
function heroRequirementAlert(heroId, config) {
    if (!config.skill) return null;
    if (!heroId) return ALERT.UNSKILLED;

    const failure = SkillSystem.requirementFailure(heroId, {
        skill: config.skill,
        level: config.skillRequired || 0
    });

    if (failure === 'POSSESSION') return ALERT.UNSKILLED;
    if (failure === 'LEVEL') return ALERT.ACCESS;
    return null;
}

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
function setAlert(instance, index, reason) {
    const next = reason || null;
    if ((instance.alert || null) === next) return;
    instance.alert = next;
    EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { tile: index, alert: instance.alert });
}

/**
 * One Token finished a cycle.
 *
 * Order matters: **pay first, then produce.** Deciding the whole exchange before
 * any of it happens is what stops a Token handing out output it cannot afford —
 * the bug `CardPreflight` was written for, kept as a rule now that its old home
 * is gone.
 */
function completeCycle(index, instance, def, io, heroId) {
    const config = def.config;

    // INPUT_COST, widened to read the 8 neighbours (G-5). A Tool Rack beside a
    // Forge makes it cheaper to run; before this, only the Token's own
    // aggregator was ever consulted and a neighbour could not touch it.
    const inputs = (io.inputs || []).map(input => ({
        ...input,
        quantity: Math.max(1, Math.round(TileModifiers.resolveAxis(
            index, EFFECT_TYPES.INPUT_COST, input.quantity || 1, config.skill
        )))
    }));

    /**
     * The atomic requirement check (concept §3.3), in the order that makes it
     * atomic: **plan every charge debit first, then spend the items, then
     * commit the charges.** A cycle needs 100% of its inputs — bank items,
     * station charges, and charges on the adjacent context Tokens its recipe
     * draws on — before any of them is touched, and a short cycle deducts
     * nothing of any kind.
     *
     * Charges are planned before the items are spent because `planCycle`
     * mutates nothing: if it comes back short, the return below leaves the Bank
     * exactly as it found it. Committing after production keeps the existing
     * order in which a station that spends its last charge is destroyed only
     * once the cycle it paid for has actually produced.
     */
    const chargePlan = Charges.planCycle(index, instance, io);
    if (!chargePlan.ok) {
        InputAllocator.noteStarved(instance.typeId);
        setAlert(instance, index, ALERT.CHARGES);
        return;
    }

    if (!InputAllocator.consumeInputs(inputs)) {
        // Raced by another Token between the availability check and here.
        // Keep the progress and wait — the cycle is not lost, only delayed.
        InputAllocator.noteStarved(instance.typeId);
        setAlert(instance, index, ALERT.INPUTS);
        return;
    }

    instance.cycleElapsedMs = 0;

    /**
     * FAIL_CHANCE — a probability axis, resolved through the same three-bucket
     * formula as everything else and then rolled once (CMS-25's proc shape).
     *
     * Base 0: nothing fails unless something adjacent says so. A failed cycle
     * still **consumes its inputs, wears adjacent support and burns a charge**
     * — failure costs the cycle, it does not rewind it — but produces no output
     * and grants no XP. That is also what makes `failed: true` real for the
     * triggers Phase 6 adds, which fire on success only (CMS-34).
     */
    const failChance = TileModifiers.resolveAxis(
        index, EFFECT_TYPES.FAIL_CHANCE, 0, config.skill
    );
    const failed = failChance > 0 && Math.random() * 100 < failChance;

    // Output lands on the BOARD, not in the Bank (D-40). It is not banked until
    // collected, and if the Bank is full it simply waits there (D-138).
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
        index, EFFECT_TYPES.LOOT_MULT, 0, config.skill
    );
    const doubled = doubleChance > 0 && Math.random() * 100 < doubleChance;

    // What this cycle actually made, for the `a neighbour produces X` trigger.
    // ⚠️ Only what genuinely landed: an output whose chance roll missed, or
    // whose quantity rounded to nothing, did not happen and must not fire a
    // listener that says it did.
    const produced = [];

    for (const output of failed ? [] : (io.outputs || [])) {
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;

        // Roll the authored range FIRST, then widen it (CMS-41). Order matters:
        // a Sawmill should scale whatever this cycle actually rolled, not the
        // range's midpoint — otherwise a 1–5 output would buff identically on a
        // lucky cycle and an unlucky one.
        const scaled = isGuildHall
            ? rollOutputQuantity(output)
            : Math.max(0, TileModifiers.resolveAxis(
                index, EFFECT_TYPES.YIELD, rollOutputQuantity(output), config.skill
            ));
        const whole = Math.floor(scaled);
        const rolled = whole + (Math.random() < (scaled - whole) ? 1 : 0);
        const quantity = doubled ? rolled * 2 : rolled;
        if (quantity <= 0) continue;

        // A Market is simply a Token whose output is currency (D-141). Gold is
        // credited rather than dropped: it is not an item, has no sprite and no
        // Bank slot, so there is nothing for the floor to hold. Everything else
        // about the Token — inputs, cycle time, adjacency, charges, needing a
        // hero — is completely ordinary, which is the point.
        if (output.currency) {
            CurrencyManager.addCurrency(output.currency, quantity, `Market: ${def.name}`);
        } else {
            SpriteLayer.addSprite('item', output.itemId, quantity, index);
            produced.push(output.itemId);
        }
    }

    /**
     * BONUS_DROP — an adjacent block granting something the Token does not make
     * itself (CMS-27/72). Rolled per entry, after the Token's own outputs, and
     * skipped entirely on a failed cycle: nothing happened, so nothing drops.
     *
     * Lands on the board like any other output (D-40) rather than straight into
     * the Bank, so it reads as part of the same completion.
     */
    if (!failed && !isGuildHall) {
        for (const grant of TileModifiers.collectItemGrants(index, EFFECT_TYPES.BONUS_DROP)) {
            const chance = grant.chance ?? 100;
            if (chance < 100 && Math.random() * 100 > chance) continue;
            const quantity = Math.max(1, grant.quantity || 1);
            SpriteLayer.addSprite('item', grant.itemId, quantity, index);
            produced.push(grant.itemId);
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
        for (const application of TileModifiers.collectStatusApplications(index)) {
            StatusApplication.applyAt(index, application);
        }
    }

    // XP likewise comes from the active recipe when it defines its own (CMS-70):
    // a Feast should teach more than Bread even though both run on a Kitchen.
    // XP_BONUS then widens it the same way YIELD widens output.
    const baseXp = io.xp ?? config.xp;
    const xpAwarded = failed ? 0 : Math.round(TileModifiers.resolveAxis(
        index, EFFECT_TYPES.XP_BONUS, baseXp || 0, config.skill
    ));
    if (xpAwarded > 0 && heroId && config.skill) {
        SkillSystem.addXP(heroId, config.skill, xpAwarded);
    }

    /**
     * Pay the plan built at the top of this function: the station's own
     * operational cost, and any charges the recipe draws off adjacent context
     * Tokens. Anything that hits 0 is destroyed by `commitPlan` (D-118), which
     * is also where `null`-means-unlimited is honoured (R-4, D-176) — `null` is
     * the opposite of 0, not a large version of it.
     */
    const chargedTiles = new Set(chargePlan.debits.map(d => d.tile));
    Charges.commitPlan(chargePlan, { heroId });

    // Context and Buff Tokens wear per cycle they SERVE (D-126). One Tool Rack
    // serving three Forges wears three times as fast, which is what makes
    // shared context a rate trade rather than free value (D-157).
    //
    // Tiles the plan above already charged are excluded: a context Token whose
    // charges the recipe names as an input has been billed once for this cycle
    // already, and D-126's flat wear on top of it would bill it twice.
    RecipeResolver.wearAdjacentSupport(index, (tile, supportInstance) => {
        Charges.destroyToken(tile, supportInstance || BoardState.getToken(tile));
        // The neighbourhood, not just this tile: an aura going dark has to stop
        // applying to everything it reached, which means their aggregators too.
        TileModifiers.rebuildAround(tile);
    }, chargedTiles);

    // The board's universal unit of work. One kill counts as one cycle too
    // (D-129), so combat feeds this exactly as production does.
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        tile: index,
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
}

/**
 * Advance every Token on the board.
 *
 * @param {number} delta milliseconds since the last tick, already time-scaled
 */
export function tick(delta) {
    // Managers run FIRST and outside the tile guard below: a restock happens on
    // an *empty* tile, so it must not be conditional on there being anything on
    // the board to iterate. A board whose last Token just ran dry is exactly
    // when restocking matters most.
    Managers.tick();

    const tiles = BoardState.occupiedTiles();
    if (!tiles.length) return;

    tickCounter++;
    const publishProgress = tickCounter % PROGRESS_EVERY === 0;

    for (const [index, instance] of tiles) {
        const def = getTokenType(instance.typeId);
        const heroId = BoardState.heroOnTile(index);

        // Effect-block upkeep runs on its OWN clock (CMS-60), before every
        // guard below: a Buff Token has no config, no hero and no work cycle,
        // so anything conditional on those would never charge it. When a block
        // switches between paid and unpaid the neighbourhood must be rebuilt —
        // an aura going dark has to actually stop applying, not just be flagged.
        if (BlockUpkeep.tickUpkeep(instance, def, delta)) {
            TileModifiers.rebuildAround(index);
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
            // A hero who holds no combat skill cannot fight (D-249), and that
            // needs saying — a Recruit standing on a Bear with nothing
            // happening is otherwise indistinguishable from a broken game.
            // Still no alert when the tile is unstaffed: an untargeted enemy
            // is not an error, exactly like an unstaffed Forest.
            const unableToFight = heroId && !BoardCombat.canFight(heroId);
            setAlert(instance, index, unableToFight ? ALERT.UNSKILLED : null);

            // Called unconditionally: `tickTile` also owns ENDING a fight when
            // the hero has gone. Guarding on `heroId` here would leave the old
            // fight — and its damaged enemy — alive forever, so a player could
            // chip a boss down across free retreats (`G-4`).
            BoardCombat.tickTile(index, instance, delta, heroId);
            continue;
        }

        const config = def?.config;

        // Inert by design — nothing to advance.
        if (!config) continue;

        const needsHero = def.requiresHero !== false;
        if (needsHero && !heroId) {
            // Quietly idle. NOT an alert: an unstaffed Token is not an error
            // (D-149), and most of the board is unstaffed at any moment.
            setAlert(instance, index, null);
            continue;
        }

        if (needsHero) {
            const skillAlert = heroRequirementAlert(heroId, config);
            if (skillAlert) {
                setAlert(instance, index, skillAlert);
                continue;
            }
        }

        // What is this station making? Whatever the player set it to — see
        // `StationRecipe.js`. This resolves whether the board around it lets
        // that recipe run. A Token with no recipes at all is not a station and
        // resolves straight through with its own outputs.
        const io = RecipeResolver.effectiveIO(index, instance);

        if (io.status === RECIPE.NONE) {
            // Its selected recipe wants context that is not beside it (or the
            // Token's pool is empty and it has nothing to select). Adjacency
            // no longer decides what a station makes, but it still decides
            // whether it can make it.
            const reqs = RecipeResolver.getMissingRequirements(index, instance);
            const missingNames = reqs.items?.length > 0
                ? reqs.items.join(', ')
                : (def?.name || tokenName(instance.typeId) || instance.typeId);

            setAlert(instance, index, ALERT.NO_RECIPE);
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                tile: index,
                severity: 'yellow',
                type: 'out_of_token',
                name: missingNames,
                title: `Missing token: ${missingNames}`,
                message: `Missing token: ${missingNames}`
            });
            continue;
        }

        if (io.inputs?.length) {
            const inputCheck = InputAllocator.checkInputs(io.inputs);
            if (!inputCheck.ok) {
                // Waits, keeping whatever progress it had. There are no partial
                // cycles (D-127) — it does not run slower, it runs later.
                InputAllocator.noteStarved(instance.typeId);
                setAlert(instance, index, ALERT.INPUTS);

                const missingItem = inputCheck.missing?.[0];
                const itemDef = missingItem ? getItem(missingItem.itemId) : null;
                const itemName = itemDef?.name || missingItem?.itemId || 'Item';
                EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                    tile: index,
                    severity: 'yellow',
                    type: 'out_of_item',
                    name: itemName,
                    message: `Out of item: ${itemName}`
                });
                continue;
            }
        }

        /**
         * Charges are a requirement like any other (concept §3.3), so they are
         * checked in the same place as the items — before the timer advances,
         * not when it expires. A station that cannot afford a full cycle waits
         * and says so, rather than counting down to a completion it will have
         * to abandon. Nothing is deducted by the check.
         */
        const chargeCheck = Charges.planCycle(index, instance, io);
        if (!chargeCheck.ok) {
            InputAllocator.noteStarved(instance.typeId);
            setAlert(instance, index, ALERT.CHARGES);
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                tile: index,
                severity: 'yellow',
                type: 'out_of_charges',
                name: def?.name || tokenName(instance.typeId) || instance.typeId,
                message: `Out of charges: ${def?.name || tokenName(instance.typeId) || instance.typeId}`
            });
            continue;
        }

        setAlert(instance, index, null);

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
                index, EFFECT_TYPES.WORK_TIME, io.cycleTimeMs || config.cycleTimeMs || 10000, config.skill
            ) / heroSpeedFactor(heroId, config.skill));

        if (instance.cycleElapsedMs >= cycleTime) {
            completeCycle(index, instance, def, io, heroId);
        } else if (publishProgress) {
            // Ref-based UI updates only — this bypasses React entirely, because
            // 48 tiles re-rendering three times a second is the cascade the
            // deck loop's ref-bar pattern existed to avoid.
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                tile: index,
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
    EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, ({ tile }) => {
        if (tile != null) TileModifiers.rebuildTile(tile);
    });
    EventBus.subscribe('game_loaded', () => {
        TileModifiers.rebuildAll();

        /**
         * The one path a `Cannot` has no last location to fly back to: a save
         * authored before the restriction existed, loading into a board the
         * rule now forbids. The offenders go to the **Vault** — the owner's
         * stated fallback — so nothing is destroyed and the board is legal by
         * the time the player sees it.
         *
         * Almost always a no-op: it costs one pass over the occupied tiles, and
         * only Tokens carrying a `Cannot` are examined at all.
         */
        const lifted = Restrictions.reconcile(instance => TokenBank.deposit(instance));
        for (const { anchor } of lifted) {
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: anchor, typeId: null });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: anchor });
        }
        if (lifted.length) {
            TileModifiers.rebuildAll();
            EventBus.publish('state_changed');
            logger.info('BoardRunner',
                `${lifted.length} Token(s) sat somewhere their rules forbid and were moved to the Vault`);
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

    const tile = BoardState.tileOfHero(heroId);
    if (tile == null) return true;                    // in the Dock, doing nothing

    const instance = BoardState.getToken(tile);
    if (!instance) return true;                       // standing on a bare tile
    const def = getTokenType(instance.typeId);
    if (!def?.config) return true;                    // standing on something inert
    return !!instance.alert;                          // staffed but stuck
}
