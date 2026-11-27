import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { CONSUME_THRESHOLD } from '../../config/loopConstants.js';
import * as HeroEffects from './HeroEffects.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { roundHalfUp } from '../../config/FormulaRegistry.js';
import { doseKindsOf, DOSE, DOSE_LENGTH, isWorkMoment, workSkillMatches, lastingDoseLength, exactDoseLength, doseLengthSpan, poisonAttacksOf } from '../core/consumableRule.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';
import * as BoardState from '../board/BoardState.js';
import * as CycleSavings from '../board/CycleSavings.js';
import { getHeroCombatStyle } from '../combat/CombatFormulas.js';

/**
 * ConsumptionSystem — heroes feed themselves from their own loadout grid.
 *
 * Below the HP threshold a hero eats from the food slot. Drinks never heal, in a fight or out:
 * an equipped drink is left alone (`tryEat`); drinks are work buffs, drunk as a work cycle starts
 * and lasting `DRINK_CYCLES` cycles, and a work potion is drunk as a cycle of its skill starts and
 * lasts `WORK_POTION_CYCLES` of them (`startWorkDoses`).
 * Elixirs are drunk as a fight starts and last `ELIXIR_FIGHTS` fights (`startFightElixirs`).
 * Poisons are taken as a fight starts by a hero with a Stealth weapon and last the attacks their
 * rule names, carried into later fights (`startFightPoisons`, `countPoisonAttack`).
 *
 * Consuming draws one unit from the Guild Bank; an equipped item with no stock
 * is skipped and the hero goes without. In a fight eating has no cooldown or limit (a meal costs a
 * swing); out of one, `RegenSystem` lets a hero eat at most once per `REST_MEAL_GAP_MS`. A Preservation
 * rule reaching the hero's Token or fight may keep the unit in the Bank (`CycleSavings.keepsCarried`):
 * the meal still heals and the dose still starts.
 */

/** Fraction of max HP below which a hero reaches for food. */
export { CONSUME_THRESHOLD };

/** True when a vital has dropped below the threshold. */
function isLow(vital) {
    if (!vital || !vital.max) return false;
    return vital.current / vital.max < CONSUME_THRESHOLD;
}

/**
 * The hero's equipped item of a given category the Bank still holds one of, the first in grid
 * order, or null. With two Foods (the Larder star) the earlier slot's is eaten until the Bank runs
 * out of it, then the next, as arrows and bait are spent.
 */
function stockedOfCategory(hero, categoryId) {
    return getEquippedEntries(hero)
        .find(e => e.category === categoryId && InventoryManager.hasItem(e.itemId, 1)) || null;
}

/**
 * What a meal heals: its restore moved by any Food Healing the hero carries (Burn's -50 %), rounded
 * halves up, never below 0. A status does what it says in a fight or out.
 */
function mealHealing(hero, amount) {
    const factor = hero?.aggregator?.getPercentageBucket
        ? hero.aggregator.getPercentageBucket(EFFECT_TYPES.FOOD_HEALING)
        : 1;
    return factor === 1 ? amount : Math.max(0, roundHalfUp(amount * factor));
}

/**
 * Whether the item a hero is about to use up as a `kind` is kept instead (Preservation), read at
 * Token `instanceId`: one draw when a rule offers the chance, none otherwise.
 */
function kept(instanceId, itemId, kind) {
    return CycleSavings.keepsCarried(instanceId, itemId, kind);
}

/**
 * Spend one unit of an equipped item from the bank and apply its restore: the first of the
 * category in grid order the Bank still holds. Returns null when none is equipped or the Bank is
 * out of every one, in which case the hero simply goes without. A Preservation hit at `instanceId`
 * (the fight's enemy Token, else the Token the hero works) restores as usual and leaves the unit in
 * the Bank.
 */
function consumeEquipped(hero, categoryId, { instanceId } = {}) {
    const entry = stockedOfCategory(hero, categoryId);
    if (!entry) return null;

    const item = getItem(entry.itemId);
    const restore = item?.restoreAmount || 0;
    const amount = mealHealing(hero, restore);
    const at = instanceId !== undefined ? instanceId : BoardState.workTokenOf(hero.id);
    const preserved = kept(at, entry.itemId, CARRIED_KIND.FOOD);
    if (!preserved) InventoryManager.removeItem(entry.itemId, 1);

    if (amount > 0) HeroManager.modifyHeroHp(hero.id, amount);

    EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
        heroId: hero.id, itemId: entry.itemId, category: categoryId, amount, ...(preserved ? { preserved } : {})
    });
    return { itemId: entry.itemId, amount };
}

/**
 * Eat if HP is low: one unit from the food slot. Drinks do not heal, in a fight or out: the drink
 * stays equipped and unspent, and its restore amount is ignored. The combat cost (the swing) is
 * charged by the caller. Food Healing (Burn) moves every meal. `instanceId`: where a
 * Preservation rule is read, the fight's enemy Token; left out, the Token the hero works.
 * @param {{instanceId?: string|null}} [options]
 * @returns {Array<{itemId: string, amount: number}>} what was eaten; empty if nothing.
 */
export function tryEat(heroId, { instanceId } = {}) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !isLow(hero.hp)) return [];
    const meal = consumeEquipped(hero, 'food', { instanceId });
    return meal ? [meal] : [];
}

/**
 * The moment an elixir's rules wait on: a fight starting (each enemy engaged is one fight). The
 * same moment id carried rules on any item use (`LoadoutMoments`).
 */
export const FIGHT_START = 'COMBAT_ENGAGED';

/**
 * Whether an item is a fight elixir: a Consumable carrying at least one rule on the fight-start
 * moment, none of them lasting "for N attacks" (that is a poison, {@link isPoison}). A Consumable
 * without one (a potion for work) is never drunk by a fight.
 */
export function isFightElixir(itemId) {
    const item = getItem(itemId);
    if (!item || !isConsumableCategory(item.equipSlot)) return false;
    const statements = HeroEffects.itemStatements(itemId);
    return statements.some(s => s?.when?.event === FIGHT_START) && poisonAttacksOf(statements) === 0;
}

/**
 * Whether an item is a poison: a Consumable whose fight-start rule lasts "for N attacks"
 * (`consumableRule.poisonAttacksOf`). Taken only by a hero holding a Stealth weapon.
 */
export function isPoison(itemId) {
    const item = getItem(itemId);
    if (!item || !isConsumableCategory(item.equipSlot)) return false;
    return poisonAttacksOf(HeroEffects.itemStatements(itemId)) > 0;
}

/** How many attacks a fresh dose of poison `itemId` lasts, 0 for anything else. */
export function poisonAttacksOfItem(itemId) {
    return isPoison(itemId) ? poisonAttacksOf(HeroEffects.itemStatements(itemId)) : 0;
}

/**
 * How many of its moments a dose of `dose` (`consumableRule.DOSE`) lasts now, on average: its own
 * length (`DOSE_LENGTH`: a drink's work cycles, a work potion's cycles, an elixir's fights) made longer
 * by the guild's Long-lasting Brews for that kind of dose (a Hall star), unrounded, never below one.
 * Draws nothing: what the game shows ({@link doseLengthText}).
 */
export function doseLength(dose) {
    const base = DOSE_LENGTH[dose];
    if (!base) return 0;
    return exactDoseLength(base, resolvedLength(dose, base));
}

/**
 * How many of its moments a fresh dose of `dose` lasts, drawn as a hero starts it: {@link doseLength}
 * made whole by chance (3.6 is 4 three times in five, 3 two times in five), never below one.
 *
 * ⚠️ Draws one `random()` only when the length has a fraction: with no star moving it, nothing.
 * Only a dose starting calls this; anything shown reads {@link doseLength} or {@link doseLengthText}.
 */
export function rollDoseLength(dose, random = Math.random) {
    const base = DOSE_LENGTH[dose];
    if (!base) return 0;
    return lastingDoseLength(base, resolvedLength(dose, base), random);
}

/**
 * How long a dose of `dose` lasts, for a player to read: the number when it is whole, else the two
 * whole numbers a fresh one may last, as "3–4". Draws nothing.
 */
export function doseLengthText(dose) {
    if (!DOSE_LENGTH[dose]) return 0;
    const [low, high] = doseLengthSpan(doseLength(dose));
    return low === high ? low : `${low}–${high}`;
}

function resolvedLength(dose, base) {
    return getGlobalAggregator().resolveAxis(EFFECT_TYPES.LONG_LASTING_BREWS, base, dose);
}

/**
 * How strong a dose of `dose`'s effects are now: 1, moved by the guild's Strong Drink for that kind
 * of dose (+20 % is 1.2), never below 0. The rules a dose fires carry it to the effects they apply
 * (`LoadoutMoments`). Draws nothing.
 */
export function doseStrength(dose) {
    if (!DOSE_LENGTH[dose]) return 1;
    return Math.max(0, getGlobalAggregator().resolveAxis(EFFECT_TYPES.STRONG_DRINK, 1, dose));
}

/**
 * A fight is starting: count it on every equipped elixir type and drink a fresh one of each type
 * whose last dose has run out. One elixir lasts `ELIXIR_FIGHTS` fights, more with Long-lasting
 * Brews ({@link rollDoseLength}), so the count left is stored on the hero (`hero.elixirFights`, saved
 * with them). An elixir with no dose left and none in the Bank sits out this fight. A Preservation
 * hit at `instanceId` (the enemy Token) starts the fresh dose without taking one from the Bank.
 *
 * Draws no random number unless a Preservation rule reaches a fresh dose (one draw for it) or
 * Long-lasting Brews gives a fresh dose a fractional length (one draw for it).
 *
 * Which elixirs work in the fight is noted on the hero (`hero.fightElixirs`, saved with them), so
 * a fight saved mid-way and going on after a load (`resumed`) works with the same ones and counts
 * nothing: an elixir is counted once per enemy. The count left cannot say it, since a dose that
 * has just run out and one that sat out both read 0.
 *
 * @param {{resumed?: boolean}} [options]
 * @returns {string[]} the elixir item ids working in this fight, in grid order
 */
export function startFightElixirs(heroId, instanceId = null, { resumed = false } = {}) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    if (resumed) {
        const noted = hero.fightElixirs;
        if (noted?.at !== instanceId || !Array.isArray(noted.items)) return [];
        const equipped = new Set(getEquippedEntries(hero).map(e => e.itemId));
        return noted.items.filter(id => equipped.has(id) && isFightElixir(id));
    }

    const active = [];
    const seen = new Set();
    for (const entry of getEquippedEntries(hero)) {
        if (!isConsumableCategory(entry.category) || seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        if (!isFightElixir(entry.itemId)) continue;

        let left = Number(hero.elixirFights?.[entry.itemId]) || 0;
        if (left <= 0) {
            if (!InventoryManager.hasItem(entry.itemId, 1)) continue;
            const preserved = kept(instanceId, entry.itemId, CARRIED_KIND.ELIXIR);
            if (!preserved) InventoryManager.removeItem(entry.itemId, 1);
            left = rollDoseLength(DOSE.ELIXIR);
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
                heroId, itemId: entry.itemId, category: entry.category, amount: 0, elixir: true, ...(preserved ? { preserved } : {})
            });
            logger.debug('ConsumptionSystem', `${hero.name} drank ${entry.itemId}`);
        }
        if (!hero.elixirFights) hero.elixirFights = {};
        hero.elixirFights[entry.itemId] = left - 1;
        active.push(entry.itemId);
    }
    if (active.length && instanceId) hero.fightElixirs = { at: instanceId, items: active };
    else delete hero.fightElixirs;
    return active;
}

/**
 * A fight is starting: a hero holding a Stealth weapon takes up every carried poison. One with
 * attacks left from earlier fights works on (`hero.poisonAttacks`, saved with them); one with none
 * left takes a fresh one from the Bank, lasting {@link poisonAttacksOfItem} attacks, and is logged
 * as an elixir is (`HERO_CONSUMED` with `poison`); one with none in the Bank sits out the fight. Any
 * other weapon takes none, and the attacks left wait. A Preservation hit at `instanceId` (the enemy
 * Token) starts the fresh one without taking it from the Bank.
 *
 * Which poisons work in the fight is noted on the hero (`hero.fightPoisons`, saved), so a fight saved
 * mid-way and going on after a load (`resumed`) works with those still holding attacks and takes
 * nothing fresh, as elixirs do.
 *
 * Draws no random number unless a Preservation rule reaches a fresh one (one draw for it).
 *
 * @param {{resumed?: boolean}} [options]
 * @returns {string[]} the poison item ids working in this fight, in grid order
 */
export function startFightPoisons(heroId, instanceId = null, { resumed = false } = {}) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];
    const left = (itemId) => Number(hero.poisonAttacks?.[itemId]) || 0;

    if (resumed) {
        const noted = hero.fightPoisons;
        if (noted?.at !== instanceId || !Array.isArray(noted.items)) return [];
        const equipped = new Set(getEquippedEntries(hero).map(e => e.itemId));
        return noted.items.filter(id => equipped.has(id) && isPoison(id) && left(id) > 0);
    }

    delete hero.fightPoisons;
    if (getHeroCombatStyle(hero) !== 'stealth') return [];
    const active = [];
    const seen = new Set();
    for (const entry of getEquippedEntries(hero)) {
        if (!isConsumableCategory(entry.category) || seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        if (!isPoison(entry.itemId)) continue;
        let attacks = left(entry.itemId);
        if (attacks <= 0) {
            if (!InventoryManager.hasItem(entry.itemId, 1)) continue;
            const preserved = kept(instanceId, entry.itemId, CARRIED_KIND.POISON);
            if (!preserved) InventoryManager.removeItem(entry.itemId, 1);
            attacks = poisonAttacksOfItem(entry.itemId);
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
                heroId, itemId: entry.itemId, category: entry.category, amount: 0, poison: true, ...(preserved ? { preserved } : {})
            });
            logger.debug('ConsumptionSystem', `${hero.name} took ${entry.itemId}`);
        }
        if (!hero.poisonAttacks) hero.poisonAttacks = {};
        hero.poisonAttacks[entry.itemId] = attacks;
        active.push(entry.itemId);
    }
    if (active.length && instanceId) hero.fightPoisons = { at: instanceId, items: active };
    return active;
}

/**
 * The hero has made an attack in the fight against Token `instanceId`, hit or miss: one attack off
 * every poison working in it. Those that reach none stop working for the rest of the fight.
 * @returns {string[]} the poisons that ran out with this attack
 */
export function countPoisonAttack(hero, instanceId) {
    const noted = hero?.fightPoisons;
    if (!noted?.items?.length || noted.at !== instanceId) return [];
    const ended = [];
    for (const itemId of noted.items) {
        const now = Math.max(0, (Number(hero.poisonAttacks?.[itemId]) || 0) - 1);
        if (!hero.poisonAttacks) hero.poisonAttacks = {};
        hero.poisonAttacks[itemId] = now;
        if (now === 0) ended.push(itemId);
    }
    if (ended.length) noted.items = noted.items.filter(id => !ended.includes(id));
    return ended;
}

/**
 * The dose an item starts as its hero starts work: `DOSE.DRINK`, `DOSE.POTION` (a work potion), or
 * null for anything else (`consumableRule.doseKindsOf`).
 */
export function workDoseKindOf(itemId) {
    const item = getItem(itemId);
    if (!item) return null;
    const kinds = doseKindsOf(item.equipSlot, HeroEffects.itemStatements(itemId));
    if (kinds.includes(DOSE.DRINK)) return DOSE.DRINK;
    if (kinds.includes(DOSE.POTION)) return DOSE.POTION;
    return null;
}

/**
 * How many work cycles one of this item lasts when its hero starts work now: a drink's
 * `DRINK_CYCLES`, a work potion's `WORK_POTION_CYCLES`, either made longer by Long-lasting Brews (on average, unrounded:
 * {@link doseLength}); 0 for anything else. Draws nothing.
 */
export function workDoseOf(itemId) {
    const kind = workDoseKindOf(itemId);
    return kind ? doseLength(kind) : 0;
}

/**
 * A work cycle of `skill` is starting: count it on every equipped drink and work potion whose work
 * rules fire on it, and drink a fresh one of each whose dose has run out. A drink lasts
 * `DRINK_CYCLES` cycles and a work potion `WORK_POTION_CYCLES` of its skill, either longer with
 * Long-lasting Brews ({@link rollDoseLength}); the count left is saved on the hero
 * (`hero.drinkCycles`), for a potion only once one lasts more than its cycle. One with no dose left and none in the Bank sits this cycle
 * out. An item whose work rules all name another skill is kept for its own skill's work. A
 * Preservation hit at `instanceId` (the Token whose cycle starts) starts the fresh dose without
 * taking one from the Bank.
 *
 * Draws no random number unless a Preservation rule reaches a fresh dose (one draw for it) or
 * Long-lasting Brews gives a fresh dose a fractional length (one draw for it).
 *
 * @returns {string[]} the item ids working in this cycle, in grid order
 */
export function startWorkDoses(heroId, skill, instanceId = null) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    const active = [];
    const seen = new Set();
    for (const entry of getEquippedEntries(hero)) {
        if (seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        const kind = workDoseKindOf(entry.itemId);
        if (!kind) continue;
        const fires = HeroEffects.itemStatements(entry.itemId)
            .some(s => isWorkMoment(s?.when?.event) && workSkillMatches(s.when, skill));
        if (!fires) continue;

        const counted = hero.drinkCycles?.[entry.itemId] != null;
        let left = Number(hero.drinkCycles?.[entry.itemId]) || 0;
        if (left <= 0) {
            if (!InventoryManager.hasItem(entry.itemId, 1)) continue;
            const preserved = kept(instanceId, entry.itemId, kind === DOSE.DRINK ? CARRIED_KIND.DRINK : CARRIED_KIND.POTION);
            if (!preserved) InventoryManager.removeItem(entry.itemId, 1);
            left = rollDoseLength(kind);
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
                heroId, itemId: entry.itemId, category: entry.category, amount: 0,
                dose: kind, ...(preserved ? { preserved } : {})
            });
            logger.debug('ConsumptionSystem', `${hero.name} drank ${entry.itemId}`);
        }
        // ⚠️ A potion of one cycle keeps no count, as it never has: the save stays as it was
        // until a potion lasts longer, and from then on its count runs down to 0 like a drink's.
        if (kind === DOSE.DRINK || left > 1 || counted) {
            if (!hero.drinkCycles) hero.drinkCycles = {};
            hero.drinkCycles[entry.itemId] = left - 1;
        }
        active.push(entry.itemId);
    }
    return active;
}

/** Whether an item is drunk at a work cycle's start (a drink or a work potion). */
export function isWorkDose(itemId) {
    return workDoseKindOf(itemId) !== null;
}
