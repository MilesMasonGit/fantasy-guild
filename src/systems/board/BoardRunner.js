// Fantasy Guild — The board's cycle engine (7×7 Playmat rework, Phase 4)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, rollOutputQuantity } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import * as TileModifiers from './TileModifiers.js';
import * as RecipeResolver from './RecipeResolver.js';
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

/** Why a staffed Token cannot work. Drives the tile's single alert mark (D-85). */
export const ALERT = {
    INPUTS: 'inputs',
    /** The hero holds the skill but is not high enough level yet. */
    ACCESS: 'access',
    /**
     * The hero does not hold the required skill at all, so no amount of
     * levelling fixes it. A different hero, or a promotion, is the answer.
     */
    UNSKILLED: 'unskilled',
    /** Two context Tokens want different things from this station (D-20). */
    CONFLICT: 'conflict',
    /** A station with no context beside it makes nothing at all (D-18). */
    NO_RECIPE: 'no_recipe'
};

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

/** Set or clear a tile's alert, publishing only on an actual change. */
function setAlert(instance, index, reason) {
    if (instance.alert === reason) return;
    instance.alert = reason || null;
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
    const doubleChance = failed ? 0 : TileModifiers.resolveAxis(
        index, EFFECT_TYPES.LOOT_MULT, 0, config.skill
    );
    const doubled = doubleChance > 0 && Math.random() * 100 < doubleChance;

    for (const output of failed ? [] : (io.outputs || [])) {
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;

        // Roll the authored range FIRST, then widen it (CMS-41). Order matters:
        // a Sawmill should scale whatever this cycle actually rolled, not the
        // range's midpoint — otherwise a 1–5 output would buff identically on a
        // lucky cycle and an unlucky one.
        const scaled = Math.max(0, TileModifiers.resolveAxis(
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
    if (!failed) {
        for (const grant of TileModifiers.collectItemGrants(index, EFFECT_TYPES.BONUS_DROP)) {
            const chance = grant.chance ?? 100;
            if (chance < 100 && Math.random() * 100 > chance) continue;
            const quantity = Math.max(1, grant.quantity || 1);
            SpriteLayer.addSprite('item', grant.itemId, quantity, index);
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

    // Charges. `null` means unlimited (D-176) and must never be decremented —
    // it is the opposite of 0, not a large version of it.
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
        if (instance.usesRemaining <= 0) {
            // **Token depletion is the only wear mechanic in the game** (D-118).
            // The Token is gone; the tile is empty and any hero on it **stands
            // there, idle**, until the player returns or a Manager restocks
            // underneath them (D-60, D-151). The hero is untouched here — since
            // Phase 7 they are not a field on the thing that just vanished.
            BoardState.setToken(index, null);
            // Remember what ran dry, so a type-specific Manager knows what this
            // tile is owed (D-35). Set AFTER setToken, which clears vacancies.
            BoardState.setVacancy(index, instance.typeId);
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: index, typeId: instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: null });
            if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: index, heroId });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: index });
        }
    }

    // Context and Buff Tokens wear per cycle they SERVE (D-126). One Tool Rack
    // serving three Forges wears three times as fast, which is what makes
    // shared context a rate trade rather than free value (D-157).
    RecipeResolver.wearAdjacentSupport(index, (tile) => {
        BoardState.setToken(tile, null);
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile, typeId: null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: null });
        TileModifiers.rebuildAround(tile);
    });

    // The board's universal unit of work. One kill counts as one cycle too
    // (D-129), so combat feeds this exactly as production does.
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        tile: index,
        typeId: instance.typeId,
        heroId: heroId || null,
        failed
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

        // What is this station making? Decided entirely by what sits beside it
        // (D-18) — no menu, no dropdown. A Token with no `recipes` is not
        // context-driven and resolves straight through with its own outputs.
        const io = RecipeResolver.effectiveIO(index, instance);

        if (io.status === RECIPE.CONFLICT) {
            // Two schematics beside one Forge. Deliberately an error rather
            // than a silent priority order (D-20): the player made an ambiguous
            // arrangement and the board should say so.
            setAlert(instance, index, ALERT.CONFLICT);
            continue;
        }

        if (io.status === RECIPE.NONE) {
            // "A Forge with nothing beside it makes nothing at all." This is
            // the binary, decisive half of adjacency — and the reason placement
            // matters more than any buff number does.
            setAlert(instance, index, ALERT.NO_RECIPE);
            continue;
        }

        if (io.inputs?.length && !InputAllocator.checkInputs(io.inputs).ok) {
            // Waits, keeping whatever progress it had. There are no partial
            // cycles (D-127) — it does not run slower, it runs later.
            InputAllocator.noteStarved(instance.typeId);
            setAlert(instance, index, ALERT.INPUTS);
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
        const cycleTime = Math.max(1000, TileModifiers.resolveAxis(
            index, EFFECT_TYPES.WORK_TIME, io.cycleTimeMs || config.cycleTimeMs || 10000, config.skill
        ));

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
