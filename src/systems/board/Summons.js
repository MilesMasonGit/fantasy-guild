// Summoned workers: called and charged by a Summoning Circle, a charge spent a cycle, gone at none

import { nanoid } from 'nanoid';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isSummonType, summonSkillSheet, circleChargesAt, SUMMONING_SKILL } from '../../config/registries/summonRules.js';
import { createEmptyEquipment } from '../../config/registries/equipmentConstants.js';
import { artRadiusOf, clampToMat } from '../../config/matGeometry.js';
import { isSummoned } from '../hero/summoned.js';
import { rehydrateHero } from '../hero/HeroManager.js';
import { ensureFlagColour } from './FlagColours.js';
import * as BoardState from './BoardState.js';
import * as Flags from './Flags.js';
import * as HeroMotion from './HeroMotion.js';
import { selectedRecipe } from './StationRecipe.js';

/**
 * A Summoned worker is a record on the roster (`state.heroes`) carrying a `summon` block:
 * `{ typeId, circleId, charges }`, its kind (a summon Token type, `summonRules.js`), the Circle that
 * called it and the charges it has left. It is ordered like a hero: the flag, the hero bar, the
 * order rules, its walking, its save. What makes it no hero is asked once on each hero-only path
 * (`hero/summoned.js`): its skills are its kind's, at fixed levels, and never gain XP; it holds its
 * kind's one trait and no perks; it wears nothing and needs no tool; it never fights; it has no
 * hero sheet; it is not counted on the roster.
 *
 * - **Called and charged** ({@link chargeFromCircle}): a Summoning Circle's recipe names a summon
 *   Token as its output. Each finished cycle adds charges to the Circle's own Summoned worker (the
 *   Circle's `summonCircle` setting at its hero's Summoning level), first calling one beside the
 *   Circle, idle on a spot order, when none stands. One per Circle: it is the one whose `circleId`
 *   names the Circle.
 * - **Spent** ({@link afterWorkCycle}): every work cycle it finishes, failed or not, spends one
 *   charge, after everything the cycle made has landed. At none it leaves.
 * - **Leaving** ({@link dismiss}): its order is let go (the Token it worked loses its progress, as
 *   any hero leaving does), its body is gone at once (no walk home), every board forgets it, and the
 *   record leaves the roster.
 * - **Replaced**: a Circle set to another recipe dismisses its Summoned worker at once (the
 *   Circle's card warns first, {@link dismissWarning}); a cycle calling another kind does the same.
 *   A Circle taken off the mat leaves its Summoned worker to spend what it holds.
 *
 * ⚠️ Draws no `Math.random`: a record's id comes from `nanoid` (crypto), so calling a Summoned worker
 * moves no roll anywhere else.
 */

/** How far below its Circle's art a new Summoned worker's spot order stands, in mat units. */
const STAND_GAP = 72;

/** The roster record `heroId`, read straight from state (never rehydrated). */
function recordOf(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** Every Summoned worker on the roster, in roster order. */
export function summonedWorkers() {
    return (GameState.state?.heroes || []).filter(isSummoned);
}

/** The Summoned worker Circle `circleId` called and charges, or null. */
export function summonOfCircle(circleId) {
    if (!circleId) return null;
    return summonedWorkers().find(h => h.summon.circleId === circleId) || null;
}

/** The charges Summoned worker `heroId` has left, or null for anyone else. */
export function chargesOf(heroId) {
    const record = recordOf(heroId);
    return isSummoned(record) ? Math.max(0, Number(record.summon.charges) || 0) : null;
}

/** Whether a recipe output line names a summon Token: a Summoning Circle's call. */
export function isSummonOutput(output) {
    return typeof output?.tokenId === 'string' && isSummonType(getTokenType(output.tokenId));
}

/** The summon Token type a recipe calls (its first output naming one), or null. */
export function summonTypeOfRecipe(recipe) {
    for (const output of recipe?.outputs || []) {
        if (isSummonOutput(output)) return output.tokenId;
    }
    return null;
}

function announce(record, change, extra = {}) {
    EventBus.publish(BOARD_EVENTS.SUMMON_CHANGED, {
        heroId: record.id,
        typeId: record.summon.typeId,
        circleId: record.summon.circleId ?? null,
        charges: Math.max(0, Number(record.summon.charges) || 0),
        change,
        ...extra
    });
}

/** Where a Circle's new Summoned worker is ordered to idle: just below the Circle. */
function standBy(circle) {
    return clampToMat({ x: circle.x, y: circle.y + artRadiusOf(circle.typeId) + STAND_GAP });
}

/**
 * A new Summoned worker of `typeId` for `circle`, on the roster and idle beside the Circle, with no
 * charges yet.
 */
function call(circle, typeId, def) {
    const record = {
        id: `summon_${nanoid(8)}`,
        name: def.name || typeId,
        icon: def.sprite || null,
        spriteId: def.sprite || null,
        status: 'idle',
        skills: summonSkillSheet(def),
        statuses: [],
        equipment: createEmptyEquipment(),
        summon: { typeId, circleId: circle.id, charges: 0 }
    };
    rehydrateHero(record);
    GameState.state.heroes.push(record);
    ensureFlagColour(record.id);
    const at = standBy(circle);
    HeroMotion.appearFor(record.id, { x: at.x, y: at.y, spot: true });
    Flags.orderSpot(record.id, at);
    return record;
}

/** `heroId`'s level in `skillId`, 0 when they hold none. */
function levelOf(heroId, skillId) {
    return Number(recordOf(heroId)?.skills?.[skillId]?.level) || 0;
}

/**
 * Circle `circle` finished a cycle calling `typeId` (a summon Token), worked by `heroId` in
 * `skillId` (the Circle's work skill, Summoning): its Summoned worker gains the charges the Circle
 * adds at that hero's level, called first beside the Circle when it has none standing. One of another
 * kind is dismissed first. Returns the record, or null when `typeId` is no summon.
 */
export function chargeFromCircle(circle, typeId, heroId, skillId = SUMMONING_SKILL) {
    const def = getTokenType(typeId);
    if (!circle?.id || !isSummonType(def) || !GameState.state) return null;
    let record = summonOfCircle(circle.id);
    if (record && record.summon.typeId !== typeId) {
        dismiss(record.id, 'replaced');
        record = null;
    }
    const called = !record;
    if (called) record = call(circle, typeId, def);
    const added = circleChargesAt(getTokenType(circle.typeId), levelOf(heroId, skillId || SUMMONING_SKILL));
    record.summon.charges = Math.max(0, Number(record.summon.charges) || 0) + added;
    announce(record, called ? 'called' : 'charged', { added });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'summon', heroId: record.id });
    return record;
}

/**
 * `heroId` finished a work cycle (`BoardRunner.completeCycle`, last): a Summoned worker spends a
 * charge, and at none leaves. Anyone else: nothing.
 */
export function afterWorkCycle(heroId) {
    const record = recordOf(heroId);
    if (!isSummoned(record)) return;
    record.summon.charges = Math.max(0, (Number(record.summon.charges) || 0) - 1);
    announce(record, 'spent');
    if (record.summon.charges <= 0) dismiss(record.id, 'spent');
    else EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'summon', heroId: record.id });
}

/**
 * Summoned worker `heroId` leaves: its order let go (the Token it worked loses its progress), its
 * body gone at once, every board forgetting it, the record off the roster.
 * @returns {boolean} whether there was one to dismiss
 */
export function dismiss(heroId, reason = 'replaced') {
    const record = recordOf(heroId);
    if (!isSummoned(record)) return false;
    Flags.furl(heroId, 'summon_left');
    BoardState.setHeroBody(heroId, null);
    BoardState.forgetHeroOn(GameState.state?.board, heroId);
    for (const region of Object.values(GameState.state?.atlas?.regions || {})) {
        BoardState.forgetHeroOn(region?.board, heroId);
    }
    const heroes = GameState.state.heroes;
    const at = heroes.indexOf(record);
    if (at !== -1) heroes.splice(at, 1);
    announce(record, 'left', { reason });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'summon', heroId });
    return true;
}

/**
 * What setting Circle `circle` to recipe `recipeId` would dismiss, for the card's warning:
 * `{ heroId, name, charges }` of its Summoned worker when the recipe calls another kind (or none),
 * else null (nothing standing, or the same kind).
 */
export function dismissWarning(circle, recipeId) {
    const record = summonOfCircle(circle?.id);
    if (!record) return null;
    const def = getTokenType(circle.typeId);
    const recipe = (recipeId && circle) ? recipeFor(circle, def, recipeId) : null;
    if (recipe && summonTypeOfRecipe(recipe) === record.summon.typeId) return null;
    return { heroId: record.id, name: record.name, charges: chargesOf(record.id) };
}

/** Recipe `recipeId` as Circle `circle`'s pool holds it, or null. */
function recipeFor(circle, def, recipeId) {
    return selectedRecipe({ ...circle, selectedRecipeId: recipeId }, def);
}

/**
 * A Token changed (`TILE_CHANGED`): when it is a Circle whose Summoned worker its newly picked recipe
 * no longer calls, that Summoned worker leaves. A Circle with nothing picked, or gone, keeps it.
 */
function onTileChanged({ instanceId } = {}) {
    const record = summonOfCircle(instanceId);
    if (!record) return;
    const circle = BoardState.getTokenById(instanceId);
    const recipe = circle ? selectedRecipe(circle) : null;
    if (!recipe || summonTypeOfRecipe(recipe) === record.summon.typeId) return;
    dismiss(record.id, 'replaced');
}

let unsubscribers = [];

export function teardown() {
    unsubscribers.forEach(off => off?.());
    unsubscribers = [];
}

export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, onTileChanged));
}
