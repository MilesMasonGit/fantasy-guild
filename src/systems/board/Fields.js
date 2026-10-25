// a Field grows its own crop: empty, growing, ripe

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { fieldOf, cropTermsOf } from '../../config/registries/tokenConstants.js';
import { recipesForToken, listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../effects/constants.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import * as Growth from './Growth.js';
import { growTimeOf, resolveAxis } from './TileModifiers.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as SupportLinks from './supportLinks.js';

/**
 * A Field is one Token that grows itself (brief 230 S4): a station (Works as Farming, kind `field`
 * or `herb_garden`) with a `field` block (`tokenConstants.fieldOf`). Its recipes are the crops it can
 * sow (`tokenConstants.cropTermsOf`); the player picks one on the Field with the station's recipe
 * picker, and the pick sticks for every sowing after.
 *
 * * **Empty**: nothing in the ground. With a crop picked it sows it on the next tick, paying the
 *   crop's seed (its recipe's `inputs`) from the Bank, then the mat. Without the seed it is
 *   **stopped**: tried again every tick, saying "Needs Wheat Seed" on the growth alert channel
 *   (`Growth.setGrowthAlert`, `GROW_NEEDS_ITEM`). With nothing picked it waits for the player, as
 *   any station does ("Choose a recipe").
 * * **Growing**: its clock (`clocks.fieldMs`, a row of `TimedChanges.HANDLERS`) counts up to the
 *   crop's grow time, shortened by Grow Time from Tokens in reach (a Well) down to the standard
 *   floor (`TileModifiers.growTimeOf`, cached per Token).
 * * **Ripe**: it holds a load, a number of harvest cycles (the crop's `load`, plus Crop Load from
 *   Tokens in reach, a Composter, read once as it ripens). A Farming hero harvests it like any work:
 *   each cycle makes the crop's outputs, and **the last cycle sows again** with the pick
 *   ({@link harvested}, from `BoardRunner`), or stops without a seed.
 *
 * Saved on the instance as `field: { cropId, load, full }`: `cropId` is the crop in the ground
 * (absent: empty), `load` the harvests left (0 or absent while growing), `full` the load it ripened
 * with. A change of pick while a crop grows or stands ripe applies at the next sowing: the crop in
 * the ground is not dug up.
 *
 * A Field that has never been touched has no `field` yet: it reads as empty, or, when its type
 * `startsWith` a crop (a map's wild wheat patch), as ripe with that crop, which is also its pick.
 * The engine writes that state on its first change ({@link settle}); reading never writes.
 *
 * ⚠️ A Field never wears out (it is a station, `wearRule.js`): its load is not its charges.
 */

export const STAGE = Object.freeze({ EMPTY: 'empty', GROWING: 'growing', RIPE: 'ripe' });

/** The clock a growing crop counts on, in `instance.clocks`. */
export const CLOCK = 'fieldMs';

/** Whether a Token type is a Field (it has a `field` block). */
export function isField(def) {
    return fieldOf(def) != null;
}

/**
 * Each Field type's crops by recipe id, for the Token registry's version and the recipe count.
 * ⚠️ A station's pool is a filter over every recipe, and a Field asks for its crop on every tick, so
 * it is looked up once per type, not per ask.
 */
let crops = { version: -1, count: -1, byDef: new WeakMap() };

function cropsOf(def) {
    const version = registryVersion();
    const count = listRecipes().length;
    if (crops.version !== version || crops.count !== count) crops = { version, count, byDef: new WeakMap() };
    let byId = crops.byDef.get(def);
    if (!byId) {
        byId = new Map(recipesForToken(def).map(r => [r.id, r]));
        crops.byDef.set(def, byId);
    }
    return byId;
}

/** A crop this Field type can sow, by recipe id, or null. */
export function cropById(def, recipeId) {
    if (!recipeId || !def) return null;
    return cropsOf(def).get(recipeId) || null;
}

const EMPTY_STATE = Object.freeze({});
const wildStates = new WeakMap();

/** The crop a new copy of this type starts ripe with (`field.startsWith`), or null. */
function wildCrop(def) {
    return cropById(def, fieldOf(def)?.startsWith);
}

/** A Field's state: as saved, or what a copy never yet changed starts with. Never written here. */
function stateOf(instance, def) {
    const saved = instance?.field;
    if (saved && typeof saved === 'object') return saved;
    const wild = wildCrop(def);
    if (!wild) return EMPTY_STATE;
    let state = wildStates.get(wild);
    if (!state) {
        const { load } = cropTermsOf(wild);
        state = Object.freeze({ cropId: wild.id, load, full: load });
        wildStates.set(wild, state);
    }
    return state;
}

/** The crop in the ground (growing or ripe), or null when the Field is empty. */
export function plantedCrop(instance, def = getTokenType(instance?.typeId)) {
    const { cropId } = stateOf(instance, def);
    return cropId ? cropById(def, cropId) : null;
}

/**
 * Where a Field stands: `STAGE.EMPTY`, `GROWING` or `RIPE`, or null for a Token that is not a
 * Field. A crop no longer among the Field's recipes (renamed or deleted in the CMS) reads as empty.
 */
export function stageOf(instance, def = getTokenType(instance?.typeId)) {
    if (!instance || !isField(def)) return null;
    const state = stateOf(instance, def);
    if (!state.cropId || !cropById(def, state.cropId)) return STAGE.EMPTY;
    return state.load > 0 ? STAGE.RIPE : STAGE.GROWING;
}

/**
 * The crop picked for the next sowing: the player's pick (`selectedRecipeId`, set through the
 * station's picker), or a never-changed wild Field's starting crop. Null when nothing (valid) is
 * picked.
 */
export function pickOf(instance, def = getTokenType(instance?.typeId)) {
    const id = instance?.selectedRecipeId;
    if (id) return cropById(def, id);
    return instance && instance.field === undefined ? wildCrop(def) : null;
}

/** What the Field works and shows: the crop in the ground, or else the one picked. */
export function cropOf(instance, def = getTokenType(instance?.typeId)) {
    return plantedCrop(instance, def) || pickOf(instance, def);
}

/** Harvests left on a ripe Field, else 0. */
export function loadLeft(instance, def = getTokenType(instance?.typeId)) {
    return stageOf(instance, def) === STAGE.RIPE ? stateOf(instance, def).load : 0;
}

/** Whether an empty Field is stopped: its pick's seed is not in the Bank (or on the mat). */
export function isStopped(instance) {
    return Growth.growthAlertOf(instance?.id)?.alert === ALERT.GROW_NEEDS_ITEM;
}

/**
 * Why nobody can harvest this Field now, or null when they can (ripe) or when it is not the
 * Field's own business (not a Field, or nothing picked: the station's "Choose a recipe"):
 * * `ALERT.GROWING` while its crop grows, and on an empty Field about to sow its pick: on its way,
 *   so a Farming hero waits for it silently;
 * * `ALERT.GROW_NEEDS_ITEM` while it is stopped for want of a seed: nothing is on its way.
 */
export function workReason(instance, def = getTokenType(instance?.typeId)) {
    const stage = stageOf(instance, def);
    if (stage === null || stage === STAGE.RIPE) return null;
    if (stage === STAGE.GROWING) return ALERT.GROWING;
    if (!pickOf(instance, def)) return null;
    return isStopped(instance) ? ALERT.GROW_NEEDS_ITEM : ALERT.GROWING;
}

/** How long the crop in the ground takes to ripen here: its `growMs` with the Grow Time in reach, floored. */
export function growMsOf(instance, def = getTokenType(instance?.typeId)) {
    return growTimeOf(instance, cropTermsOf(plantedCrop(instance, def)).growMs);
}

/**
 * The harvests a crop ripens with on this Field: its `load` with the Crop Load in reach (a
 * Composter), rounded, never under one. Read once, as it ripens.
 */
export function loadAtRipening(instance, def, crop) {
    const base = cropTermsOf(crop).load;
    const skill = typeof def?.config?.skill === 'string' && def.config.skill ? def.config.skill : TARGET_CATEGORIES.ALL;
    const load = Math.round(resolveAxis(instance.id, EFFECT_TYPES.CROP_LOAD, base, skill));
    return Number.isFinite(load) && load >= 1 ? load : 1;
}

/**
 * The state the engine is about to change, made the instance's own: a never-changed copy takes
 * its starting state (and a wild Field its pick); a crop no longer among the Field's recipes leaves
 * the ground empty.
 */
function settle(instance, def) {
    const saved = instance.field;
    if (saved && typeof saved === 'object') {
        if (saved.cropId && !cropById(def, saved.cropId)) instance.field = {};
        return instance.field;
    }
    const start = stateOf(instance, def);
    instance.field = { ...start };
    if (start.cropId && !instance.selectedRecipeId) instance.selectedRecipeId = start.cropId;
    return instance.field;
}

function announce(instance) {
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
}

/**
 * Sow the pick: pay its seed and start it growing, its clock at `clockMs`. Short of the seed the
 * Field is stopped and says what it lacks; returns null then (and when nothing is picked).
 */
function sow(instance, def, clockMs = 0) {
    const crop = pickOf(instance, def);
    if (!crop) return null;
    const { seeds } = cropTermsOf(crop);
    const short = Growth.shortOfCost(seeds);
    if (short.length) {
        Growth.setGrowthAlert(instance.id, ALERT.GROW_NEEDS_ITEM, short);
        return null;
    }
    Growth.payCost(seeds);
    settle(instance, def);
    instance.field = { cropId: crop.id };
    const clocks = instance.clocks && typeof instance.clocks === 'object' ? instance.clocks : (instance.clocks = {});
    clocks[CLOCK] = Math.max(0, clockMs);
    if (Growth.anyGrowthAlert()) Growth.setGrowthAlert(instance.id, null);
    announce(instance);
    return instance;
}

/** A growing crop ripens: the Field holds its load. */
function ripen(instance, def) {
    const crop = plantedCrop(instance, def);
    if (!crop) return null;
    settle(instance, def);
    const load = loadAtRipening(instance, def, crop);
    instance.field = { cropId: crop.id, load, full: load };
    announce(instance);
    // Harvests a Composter added pop over the Field as it ripens.
    EffectFeedback.popBonus(instance.id, load - cropTermsOf(crop).load,
        () => SupportLinks.firstSupportOf(instance.id, EFFECT_TYPES.CROP_LOAD));
    return instance;
}

/** Whether the Field's clock stands at zero: ripe, or empty with nothing picked to sow. */
export function clockIdle(instance, def) {
    const stage = stageOf(instance, def);
    return stage === STAGE.RIPE || (stage === STAGE.EMPTY && !pickOf(instance, def));
}

/**
 * When the Field's clock falls due: a growing crop at its grow time; an empty Field with a crop
 * picked at once; otherwise never.
 */
export function clockDueMs(instance, def) {
    const stage = stageOf(instance, def);
    if (stage === STAGE.GROWING) return growMsOf(instance, def);
    if (stage === STAGE.EMPTY && pickOf(instance, def)) return 0;
    return Infinity;
}

/**
 * The Field's clock fell due (`TimedChanges`' field row): a growing crop ripens; an empty Field
 * sows its pick. Returns the Field, or null when it could not (stopped for want of a seed: the
 * row holds the clock and tries again next tick).
 */
export function clockFired(instance, def) {
    const stage = stageOf(instance, def);
    if (stage === STAGE.GROWING) return ripen(instance, def);
    if (stage === STAGE.EMPTY) return sow(instance, def);
    return instance;
}

/**
 * A harvest cycle on this Field completed (`BoardRunner.completeCycle`, failed or not: a cycle
 * spent is a harvest spent). One fewer left; the last sows the pick again, its growth counting from
 * the moment the cycle ended (`overMs` of the tick after it), or stops the Field without a seed.
 */
export function harvested(instance, def, { overMs = 0 } = {}) {
    if (stageOf(instance, def) !== STAGE.RIPE) return;
    const state = settle(instance, def);
    state.load = Math.max(0, (Number(state.load) || 0) - 1);
    if (state.load > 0) return;
    instance.field = {};
    if (instance.clocks && CLOCK in instance.clocks) instance.clocks[CLOCK] = 0;
    // The cycle's own outputs have already landed, so a seed it dropped can pay for the sowing.
    if (!sow(instance, def, overMs)) announce(instance);
}

/**
 * The picture the Field is drawn as now, or null for its own art: its type's empty or growing
 * sprite, or the ripe sprite of the crop it holds. Null for a Token that is not a Field.
 */
export function stateSpriteOf(instance, def = getTokenType(instance?.typeId)) {
    const stage = stageOf(instance, def);
    if (!stage) return null;
    const terms = fieldOf(def);
    if (stage === STAGE.RIPE) return cropTermsOf(plantedCrop(instance, def)).ripeSprite;
    if (stage === STAGE.GROWING) return terms.growingSprite || terms.emptySprite;
    return terms.emptySprite;
}

/**
 * When a growing crop ripens, for the timer bubble: `{ inMs, totalMs, cropId }`, `totalMs` the
 * whole growth as sped up. Null unless the Field is growing.
 */
export function nextRipening(instance) {
    const def = getTokenType(instance?.typeId);
    if (stageOf(instance, def) !== STAGE.GROWING) return null;
    const totalMs = growMsOf(instance, def);
    const clockMs = Number(instance.clocks?.[CLOCK]) || 0;
    return { inMs: Math.max(0, totalMs - clockMs), totalMs, cropId: plantedCrop(instance, def).id };
}

/**
 * What the card and the inspection say about a Field, or null for any other Token: `{ stage,
 * cropId, pickId, load, full, inMs, totalMs, stopped, short }`. `cropId` is the crop in the ground,
 * `pickId` the one the next sowing uses (they differ after a change of pick); `inMs`, `totalMs`
 * count down a growing crop; `stopped` and `short` (the item ids it lacks) an empty Field waiting
 * for a seed.
 */
export function fieldState(instance) {
    const def = getTokenType(instance?.typeId);
    const stage = stageOf(instance, def);
    if (!stage) return null;
    const state = stateOf(instance, def);
    const growing = stage === STAGE.GROWING ? nextRipening(instance) : null;
    const stopped = stage === STAGE.EMPTY && isStopped(instance);
    return {
        stage,
        cropId: plantedCrop(instance, def)?.id ?? null,
        pickId: pickOf(instance, def)?.id ?? null,
        load: stage === STAGE.RIPE ? state.load : 0,
        full: stage === STAGE.RIPE ? (state.full || state.load) : 0,
        inMs: growing ? growing.inMs : null,
        totalMs: growing ? growing.totalMs : null,
        stopped,
        short: stopped ? [...(Growth.growthAlertOf(instance.id)?.needs || [])] : []
    };
}
