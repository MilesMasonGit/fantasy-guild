// what a weapon spends an attack: a bow's arrows, a wand's Motes, a Kunai thrown

import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { arrowOf } from '../../config/registries/damageTypes.js';
import { weaponStyleOf, weaponMoteOf, isThrownWeapon } from '../../config/registries/weaponStyles.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';
import { GameState } from '../../state/GameState.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as CycleSavings from '../board/CycleSavings.js';
import { talliesOf } from './FightHooks.js';
import { getHeroWeapon } from './CombatFormulas.js';

/**
 * One rule for a weapon that spends one of something an attack, hit or miss, drawn from the Bank:
 *
 * - **Arrows** (a Ranged weapon): any arrow the hero carries in a consumable cell, the first in grid
 *   order the Bank still holds; the shot deals the bow's part and the arrow's. With none, the bow
 *   does not shoot: the hero leaves the fight and waits by the enemy, which keeps its wounds, and
 *   says "Needs Copper Arrow"; a hero with none never starts one (`WorkCheck.carriedStop`, `Flags`).
 * - **Motes** (a Magic weapon naming one, `weaponStyles.weaponMoteOf`): carried in a consumable cell
 *   and held by the Bank. With none the hero casts on at half damage and says "Needs Fire Mote"
 *   once a fight. A Magic weapon naming no Mote casts free, at full damage.
 * - **Kunai** (a thrown Stealth weapon, `weaponStyles.isThrownWeapon`): the copy in hand is kept,
 *   each throw spends another from the Bank. With none there the hero throws the one in hand at half
 *   damage and says "Needs Iron Kunai" once a fight.
 *
 * Half is `NO_AMMO_DAMAGE_FACTOR` (`CombatFormulas.heroBlow`'s `short`). A Preservation hit shoots,
 * casts or throws and leaves the item in the Bank (`CycleSavings.keepsCarried`, as ammo).
 *
 * ⚠️ The draw order is part of the game's work: spending draws only when a Preservation rule offers
 * the chance, once, before the swing's miss roll; a hero whose weapon spends nothing draws nothing
 * here. Catch-up plays the same ticks, so time away spends exactly what live play does.
 */

/** The kinds of ammo. */
export const AMMO = Object.freeze({ ARROW: 'arrow', MOTE: 'mote', KUNAI: 'kunai' });

/** The hero record, read straight from state (as `Flags` and `Fishing` do), for a hero named by id. */
function heroOf(heroOrId) {
    if (heroOrId && typeof heroOrId === 'object') return heroOrId;
    if (!heroOrId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroOrId) || null;
}

/** Whether `hero` carries `itemId` in a consumable cell. */
function carriesInCell(hero, itemId) {
    return getGrid(hero).some(id => id === itemId && isConsumableCategory(categoryOfItem(id)));
}

/** The arrows a hero carries, in grid order, whatever the Bank holds: item ids, each once. */
export function carriedArrowIds(hero) {
    const out = [];
    for (const itemId of getGrid(hero)) {
        if (!itemId || out.includes(itemId)) continue;
        if (!isConsumableCategory(categoryOfItem(itemId))) continue;
        if (arrowOf(getItem(itemId))) out.push(itemId);
    }
    return out;
}

/** The first arrow the game has, for a hero who carries none ("Needs Copper Arrow"). */
function firstArrowId() {
    for (const [id, item] of Object.entries(getAllItems() || {})) {
        if (arrowOf(item) && isConsumableCategory(item.equipSlot)) return id;
    }
    return null;
}

/**
 * What the weapon a hero swings spends an attack, or null when it spends nothing (a sword, a dagger,
 * a wand naming no Mote, a fist): `{ kind, ids, needs, carried, leaves }`. `ids` are the items an
 * attack may spend, in order (the carried arrows; the Mote, when carried; the Kunai); `needs` the one
 * the hero says they need when none is left; `carried` whether that one must be carried in a
 * consumable cell as well as held by the Bank; `leaves` whether the hero leaves the fight without it
 * (a bow) rather than fighting on at half (a Mote, a Kunai).
 */
export function ammoRuleOf(heroOrId) {
    const hero = heroOf(heroOrId);
    const weapon = hero ? getHeroWeapon(hero) : null;
    if (!weapon) return null;
    const style = weaponStyleOf(weapon);
    if (style === 'ranged') {
        const ids = carriedArrowIds(hero);
        return { kind: AMMO.ARROW, ids, needs: ids[0] || firstArrowId(), carried: true, leaves: true };
    }
    const mote = weaponMoteOf(weapon);
    if (mote) return { kind: AMMO.MOTE, ids: carriesInCell(hero, mote) ? [mote] : [], needs: mote, carried: true, leaves: false };
    if (isThrownWeapon(weapon)) return { kind: AMMO.KUNAI, ids: [weapon.id], needs: weapon.id, carried: false, leaves: false };
    return null;
}

/** The first of `rule`'s items the Bank holds, or null. */
function stocked(rule) {
    for (const itemId of rule?.ids || []) {
        if (InventoryManager.hasItem(itemId, 1)) return itemId;
    }
    return null;
}

/** Whether a hero's style shoots arrows: a Ranged weapon in hand. */
export function shootsArrows(heroOrId) {
    return ammoRuleOf(heroOrId)?.kind === AMMO.ARROW;
}

/**
 * The arrow this hero's next shot spends: the first carried arrow the Bank holds, or null (not a
 * Ranged fighter, none carried, or the Bank is out). Draws nothing and spends nothing.
 */
export function nextArrowOf(heroOrId) {
    const rule = ammoRuleOf(heroOrId);
    return rule?.kind === AMMO.ARROW ? stocked(rule) : null;
}

/**
 * What the hero's next attack would spend, `{ rule, itemId }` (`itemId` null when none is left), or
 * null when their weapon spends nothing. Draws nothing.
 */
export function nextAmmoOf(heroOrId) {
    const rule = ammoRuleOf(heroOrId);
    return rule ? { rule, itemId: stocked(rule) } : null;
}

/**
 * Whether the hero's weapon cannot be used for want of its ammo: a bow with no carried arrow the
 * Bank holds. Such a hero does not shoot, leaves the fight and starts none until given arrows.
 */
export function leavesWithout(heroOrId) {
    const next = nextAmmoOf(heroOrId);
    return !!next && next.rule.leaves && !next.itemId;
}

/**
 * Whether the hero fights on at half damage for want of ammo: a Mote or a Kunai with none left.
 */
export function isShort(heroOrId) {
    const next = nextAmmoOf(heroOrId);
    return !!next && !next.rule.leaves && !next.itemId;
}

/**
 * What the hero says they need when their weapon's ammo is out, `{ itemId, needed, carried }`, or
 * null when it is not out (or the weapon spends nothing).
 */
export function ammoNeedOf(heroOrId) {
    const next = nextAmmoOf(heroOrId);
    if (!next || next.itemId || !next.rule.needs) return null;
    return { itemId: next.rule.needs, needed: 1, carried: next.rule.carried };
}

/**
 * Spend one for an attack, hit or miss. A Preservation hit attacks and leaves the item in the Bank
 * (`kept`), read at `instanceId`, the enemy Token: one draw when a rule offers the chance. Returns
 * null when the weapon spends nothing; otherwise `{ kind, itemId, kept, arrow, short }`: `itemId`
 * the item spent, `arrow` its part of a shot (`damageTypes.arrowOf`), `short` true when none was
 * left and the attack deals half (`itemId` null then). A bow with none left spends nothing and is
 * `short` too: its hero does not shoot ({@link leavesWithout}).
 * @returns {{kind: string, itemId: string|null, kept: boolean, arrow: {damage: number, damageType: string}|null, short: boolean}|null}
 */
export function spendAmmo(heroOrId, instanceId = null) {
    const rule = ammoRuleOf(heroOrId);
    if (!rule) return null;
    const itemId = stocked(rule);
    if (!itemId) return { kind: rule.kind, itemId: null, kept: false, arrow: null, short: true };
    const kept = CycleSavings.keepsCarried(instanceId, itemId, CARRIED_KIND.AMMO);
    if (!kept && !InventoryManager.removeItem(itemId, 1)) return { kind: rule.kind, itemId: null, kept: false, arrow: null, short: true };
    const arrow = rule.kind === AMMO.ARROW ? arrowOf(getItem(itemId)) : null;
    return { kind: rule.kind, itemId, kept, arrow, short: false };
}

/**
 * A hero attacking at half for want of a Mote or a Kunai says what they need, once a fight: the
 * running-out bubble ("Needs Fire Mote", `BOARD_EVENTS.INPUT_NEEDED`), which waits until the Bank
 * holds one again (and the hero carries it, for a Mote).
 */
export function sayShortOnce(fight, heroOrId) {
    const tallies = talliesOf(fight);
    if (tallies.ammoShortSaid) return;
    const hero = heroOf(heroOrId);
    const need = ammoNeedOf(hero);
    if (!need) return;
    tallies.ammoShortSaid = true;
    EventBus.publish(BOARD_EVENTS.INPUT_NEEDED, {
        instanceId: fight?.instanceId ?? null, heroId: hero.id, itemId: need.itemId, needed: need.needed,
        ...(need.carried ? { carried: true } : {})
    });
}

/** Whether item `itemId` is ammo: an arrow, a Mote some Magic weapon names, or a Kunai. */
export function isAmmoItem(itemId) {
    const item = getItem(itemId);
    if (!item) return false;
    if (arrowOf(item) || isThrownWeapon(item)) return true;
    return Object.values(getAllItems() || {}).some(w => weaponMoteOf(w) === itemId);
}
