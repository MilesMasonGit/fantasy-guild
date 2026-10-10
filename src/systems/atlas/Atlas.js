// The Atlas: the guild's Regions, and travel between them

import { GameState } from '../../state/GameState.js';
import { createEmptyBoard, createRegionRecord } from '../../state/StateSchema.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { SaveManager } from '../core/SaveManager.js';
import * as CatchUp from '../core/CatchUp.js';
import * as BoardState from '../board/BoardState.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import * as MatPlacement from '../board/MatPlacement.js';
import { isGuildHall } from '../board/MatCap.js';
import { isQuestToken } from '../quests/QuestTokens.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { matW, matH, artRadiusOf } from '../../config/matGeometry.js';
import { logger } from '../../utils/Logger.js';
import { TEXT, FLAVOUR_NAME_MAX, practicalName, flavourName } from './regionNames.js';
import { describe as describeSummary } from './Budget.js';
import {
    recipeOf, preview, grant, held, shortfall, take, regionBoard, rulesOf
} from './Cartography.js';
import { DEV_MAPS, asciiLayout } from './devMaps.js';
import { layOnLiveBoard } from './StarterCamp.js';

export { recipeOf, preview, reroll, held, heldCount } from './Cartography.js';

/**
 * The Atlas: every Region the guild has settled, and moving the guild between them.
 *
 * `state.board` is always the board of the Region the guild is in, so nothing that reads the board
 * knows Regions exist. Every other Region is a record in `state.atlas.regions` keeping its board
 * frozen: nothing ticks it (offline catch-up included), and every Token clock advances only by a
 * tick's delta, so a Region resumes exactly where it stopped.
 *
 * Travel ({@link travel}) banks the floor loot (what the Bank cannot hold stays on that Region's
 * floor), lifts the Guild Hall and the quest Tokens off the mat (they belong to the guild), freezes
 * the board, installs the other one, puts the Hall and the quests down, then announces
 * `BOARD_SWAPPED`, which every system that rebuilds runtime state on a load hears as well. Flags
 * stay with their Region: going back, each hero starts at the flag they left there, with no claim
 * and no fight; a Region the guild has never been to starts with every hero in the Dock.
 *
 * Settling ({@link settle}) writes a Region from maps: the Node Summary and layout the Cartography
 * table previewed (`Cartography.js`) become its board, each node a fixture standing where the
 * layout put it, around a clearing at the centre where the Hall lands on arrival.
 *
 * Nothing here draws from `Math.random`: settling, travelling or naming a Region never changes what
 * the game rolls next.
 */

export const REGION_KIND = Object.freeze({ STARTER: 'starter', SETTLED: 'settled' });

const refuse = (reason) => ({ success: false, reason });
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The `<n>` of `region_<n>`, or 0. */
function regionNumber(id) {
    const m = /^region_(\d+)$/.exec(String(id));
    return m ? Number(m[1]) : 0;
}

/** `state.atlas` as it stands, or null. Reads never repair; commands go through {@link ensureState}. */
function atlasOf() {
    const atlas = GameState.state?.atlas;
    return isPlainObject(atlas) && isPlainObject(atlas.regions) ? atlas : null;
}

/**
 * The Atlas section, repaired. The live board always belongs to a Region: a board with none (one
 * built before the Atlas was first used, as the bench and many tests build theirs) becomes the
 * Starter Camp here.
 *
 * @returns {object|null} `state.atlas`, or null with no game
 */
export function ensureState() {
    const state = GameState.state;
    if (!state) return null;
    if (!isPlainObject(state.atlas)) state.atlas = { activeRegionId: null, nextRegionNumber: 1, regions: {}, seed: null };
    const atlas = state.atlas;
    if (!isPlainObject(atlas.regions)) atlas.regions = {};
    const highest = Math.max(0, ...Object.keys(atlas.regions).map(regionNumber));
    if (!Number.isInteger(atlas.nextRegionNumber) || atlas.nextRegionNumber <= highest) {
        atlas.nextRegionNumber = highest + 1;
    }
    if (!atlas.regions[atlas.activeRegionId]) {
        const first = Object.keys(atlas.regions).length === 0;
        const region = addRecord(atlas, {
            kind: first ? REGION_KIND.STARTER : REGION_KIND.SETTLED,
            practical: first ? TEXT.STARTER_CAMP : TEXT.BLANK_REGION
        });
        atlas.activeRegionId = region.id;
    }
    return atlas;
}

/** The id the next Region written will get. */
function nextRegionId(atlas) {
    return `region_${atlas.nextRegionNumber}`;
}

/** A new record in `atlas.regions`, with the next id. */
function addRecord(atlas, {
    kind, practical, ingredients = [], seed, biome = null, ground = null, terrain = null, rules = [], board = null
}) {
    const id = nextRegionId(atlas);
    const number = atlas.nextRegionNumber++;
    const region = createRegionRecord(id);
    region.kind = kind;
    region.practicalName = practical;
    region.ingredients = [...ingredients];
    region.seed = Number.isFinite(seed) ? seed : number;
    region.flavourName = flavourName(region.seed);
    region.biome = biome;
    region.ground = ground;
    region.terrain = terrain;
    region.rules = Array.isArray(rules) ? [...rules] : [];
    region.settledAt = GameState.state?.time?.gameTimeMs || 0;
    region.board = board;
    atlas.regions[region.id] = region;
    return region;
}

function announce(reason, regionId) {
    EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason, regionId });
}

/** Save now, when a slot is being played. */
function saveNow() {
    if (SaveManager.getCurrentSlot() !== null) SaveManager.save(false);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The Region record `id` (the live one: do not hand it to the screen), or null. */
export function getRegion(id) {
    return atlasOf()?.regions[id] || null;
}

/** The id of the Region the guild is in, or null. */
export function activeRegionId() {
    const atlas = atlasOf();
    return atlas?.regions[atlas.activeRegionId] ? atlas.activeRegionId : null;
}

/** The record of the Region the guild is in, or null. */
export function activeRegion() {
    return getRegion(activeRegionId());
}

/** Tokens that belong to the Region: everything on its board but the Hall and the quests. */
function regionTokenCount(board) {
    return Object.values(board?.tokens || {}).filter(t => t?.typeId && !isGuildHall(t) && !isQuestToken(t)).length;
}

/**
 * The Regions, oldest first, as plain summaries: `{ id, kind, practicalName, flavourName, archived,
 * active, tokens }`. The archive is listed apart.
 *
 * @param {{archived?: boolean}} [options] true lists the archived Regions instead
 */
export function list({ archived = false } = {}) {
    const atlas = atlasOf();
    if (!atlas) return [];
    return Object.values(atlas.regions)
        .filter(r => !!r?.archived === !!archived)
        .sort((x, y) => regionNumber(x.id) - regionNumber(y.id))
        .map(r => {
            const active = r.id === atlas.activeRegionId;
            return {
                id: r.id,
                kind: r.kind,
                practicalName: r.practicalName,
                flavourName: r.flavourName,
                archived: !!r.archived,
                active,
                tokens: regionTokenCount(active ? GameState.state.board : r.board)
            };
        });
}

// ---------------------------------------------------------------------------
// Making Regions
// ---------------------------------------------------------------------------

/**
 * The Region a new game opens in: the live board, the Starter Camp. Given a camp
 * (`StarterCamp.starterCamp()`) and an empty mat, its Tokens are stood on the mat first. Idempotent.
 */
export function createStarterRegion(camp = null) {
    if (camp && GameState.state?.board && BoardState.tokens().length === 0) layOnLiveBoard(camp);
    ensureState();
    return activeRegion();
}

/**
 * How an ingredient reads in a practical name: the item's name without a trailing "Map"; a
 * modifier by its item type.
 */
export function describeIngredient(itemId) {
    const item = getItem(itemId);
    return {
        word: String(item?.name || itemId).replace(/\s+map$/i, '').trim(),
        modifier: item?.type === 'modifier'
    };
}

/**
 * Add a Region to the Atlas. The guild stays where it is.
 *
 * @param {object} [options]
 * @param {string[]} [options.ingredients] the item ids it is written from, in slot order
 * @param {(itemId: string) => {word: string, modifier?: boolean}} [options.describe] how each
 *        ingredient reads in the practical name
 * @param {number} [options.seed] the layout's seed; the flavour name is generated from it
 * @param {object|null} [options.biome] biome weights
 * @param {object|null} [options.ground] the maps' ground (`Budget.budget().ground`)
 * @param {object|null} [options.terrain] the terrain grid, as `TerrainMap.encodeTerrain` stores it
 * @param {object[]} [options.rules] Region-wide rules
 * @param {object} [options.board] its board, built off the mat; empty by default
 * @returns {{success: boolean, reason?: string, region?: object}}
 */
export function createRegion({
    ingredients = [], describe = describeIngredient, seed, biome = null, ground = null, terrain = null,
    rules = [], board = null
} = {}) {
    const atlas = ensureState();
    if (!atlas) return refuse(TEXT.REFUSE_NO_GAME);
    const items = Array.isArray(ingredients) ? ingredients.filter(id => typeof id === 'string' && id) : [];
    const region = addRecord(atlas, {
        kind: REGION_KIND.SETTLED,
        practical: practicalName(items.map(describe)),
        ingredients: items,
        seed, biome, ground, terrain, rules,
        board: isPlainObject(board) ? board : createEmptyBoard()
    });
    announce('created', region.id);
    return { success: true, region };
}

/** Dev console: a Region with an empty mat to travel to (`Game.Atlas.devCreateEmptyRegion()`). */
export function devCreateEmptyRegion() {
    const { region } = createRegion();
    if (region) logger.info('Atlas', `${region.id} (${region.flavourName}) is ready: Game.Atlas.travel('${region.id}')`);
    return region || null;
}

/** How each recipe reads in the practical name: its own `name`, else its item's. */
function describeRecipes(recipes) {
    const byId = new Map(recipes.map(r => [r.id, r]));
    return (id) => {
        const recipe = byId.get(id);
        if (!recipe?.name) return describeIngredient(id);
        return { word: String(recipe.name).replace(/\s+map$/i, '').trim(), modifier: recipe.kind === 'modifier' };
    };
}

const copy = (v) => JSON.parse(JSON.stringify(v));

/**
 * Settle a Region: the layout the Cartography table previewed with this seed becomes a Region in
 * the Atlas, and the ingredients leave the stock. The guild stays where it is; travelling there is
 * the player's next step. Only this takes anything: a refusal takes nothing, and neither does
 * closing the table.
 *
 * Refuses with no game, no ingredients, an ingredient the guild does not hold (two slots of one
 * map need two), or a layout in which some Token found no legal spot (the player rerolls). An
 * ingredient that is not a map recipe throws (`recipeOf`).
 *
 * @param {object} options
 * @param {object[]} options.ingredients the slots' ingredients, in slot order
 * @param {number} [options.seed] the seed of the preview the player saw; else a fresh preview seed
 * @returns {{success: boolean, reason?: string, missing?: object[], unplaced?: object[],
 *          region?: object, preview?: object}} `preview` is the plan the Region was written from
 */
export function settle({ ingredients = [], seed } = {}) {
    const atlas = ensureState();
    if (!atlas) return refuse(TEXT.REFUSE_NO_GAME);
    const slots = Array.isArray(ingredients) ? ingredients : [];
    if (!slots.length) return refuse(TEXT.REFUSE_NO_MAPS);
    const recipes = slots.map(recipeOf);
    const missing = shortfall(recipes);
    if (missing.length) return { ...refuse(TEXT.REFUSE_NOT_HELD), missing };
    const plan = preview(recipes, { seed });
    if (!plan.fits) return { ...refuse(TEXT.REFUSE_NO_ROOM), unplaced: plan.layout.unplaced };

    // Its Tokens are named after the Region they are written into, the id `createRegion` gives next.
    const board = regionBoard(plan.layout, nextRegionId(atlas));
    const { region } = createRegion({
        ingredients: plan.ingredients,
        describe: describeRecipes(recipes),
        seed: plan.seed,
        biome: { ...plan.summary.biomes },
        ground: copy(plan.summary.ground),
        terrain: copy(plan.layout.terrain),
        rules: rulesOf(recipes),
        board
    });
    take(recipes);
    saveNow();
    return { success: true, region, preview: plan };
}

// ---------------------------------------------------------------------------
// Dev console: maps before maps are items
// ---------------------------------------------------------------------------

/** The dev recipes `names` pick out ('forest', 'overgrown', ...). */
function devRecipes(names) {
    return (Array.isArray(names) ? names : [names]).map(name => {
        const recipe = DEV_MAPS[name];
        if (!recipe) throw new TypeError(`No dev map "${name}"; there are ${Object.keys(DEV_MAPS).join(', ')}`);
        return recipe;
    });
}

/**
 * Dev console: put `count` of each placeholder map in the stock (`Game.Atlas.devGrantMaps()`).
 *
 * @returns {string[]} what the stock now holds
 */
export function devGrantMaps(count = 2) {
    grant(Object.values(DEV_MAPS), count);
    const names = Object.fromEntries(Object.entries(DEV_MAPS).map(([name, r]) => [r.id, name]));
    const lines = held().map(({ recipe, count: n }) => `${n} × ${names[recipe.id] || recipe.id}`);
    logger.info('Atlas', `The stock holds ${lines.join(', ')}. Try Game.Atlas.devPreview(['forest', 'overgrown'])`);
    return lines;
}

/**
 * Dev console: what `names` would write, as the Cartography table shows it
 * (`Game.Atlas.devPreview(['mountain', 'goblinCamp'])`): the Node Summary in words and the layout
 * drawn in text. `preview` is the plan for `Game.Atlas.reroll(...)`; `devSettle(names, seed)`
 * settles exactly this layout.
 */
export function devPreview(names = ['forest', 'overgrown'], seed) {
    const plan = preview(devRecipes(names), { seed });
    const summary = describeSummary(plan.summary).text;
    const picture = asciiLayout(plan.layout, { artRadius: artRadiusOf });
    logger.info('Atlas', `Seed ${plan.seed}${plan.fits ? '' : ' (some Tokens found no room: reroll)'}\n${summary}\n${picture}`);
    return { seed: plan.seed, fits: plan.fits, summary, picture, preview: plan };
}

/** Dev console: settle `names` from the stock (`Game.Atlas.devSettle(['forest', 'overgrown'], seed)`). */
export function devSettle(names = ['forest', 'overgrown'], seed) {
    const result = settle({ ingredients: devRecipes(names), seed });
    if (result.success) {
        const { id, practicalName: practical, flavourName: flavour } = result.region;
        logger.info('Atlas', `${id}, ${practical} (${flavour}), is settled: Game.Atlas.travel('${id}')`);
    } else {
        logger.warn('Atlas', `Not settled: ${result.reason}${result.missing ? '. Grant maps first: Game.Atlas.devGrantMaps()' : ''}`);
    }
    return result;
}

// ---------------------------------------------------------------------------
// The Region list
// ---------------------------------------------------------------------------

/** Give Region `id` a new flavour name (trimmed, at most `FLAVOUR_NAME_MAX` characters). */
export function rename(id, name) {
    const region = getRegion(id);
    if (!region) return refuse(TEXT.REFUSE_NO_REGION);
    const clean = String(name ?? '').trim().slice(0, FLAVOUR_NAME_MAX).trim();
    if (!clean) return refuse(TEXT.REFUSE_EMPTY_NAME);
    region.flavourName = clean;
    announce('renamed', id);
    return { success: true, name: clean };
}

/** Hide Region `id` from the list. Not the one the guild is in. */
export function archive(id) {
    const atlas = ensureState();
    const region = atlas?.regions[id];
    if (!region) return refuse(TEXT.REFUSE_NO_REGION);
    if (id === atlas.activeRegionId) return refuse(TEXT.REFUSE_ACTIVE);
    if (!region.archived) {
        region.archived = true;
        announce('archived', id);
    }
    return { success: true };
}

/** Bring Region `id` back from the archive. */
export function restore(id) {
    const region = getRegion(id);
    if (!region) return refuse(TEXT.REFUSE_NO_REGION);
    if (region.archived) {
        region.archived = false;
        announce('restored', id);
    }
    return { success: true };
}

/**
 * Delete Region `id` for good, with everything on its board. Not the one the guild is in, and never
 * the Starter Camp.
 */
export function abandon(id) {
    const atlas = ensureState();
    const region = atlas?.regions[id];
    if (!region) return refuse(TEXT.REFUSE_NO_REGION);
    if (id === atlas.activeRegionId) return refuse(TEXT.REFUSE_ACTIVE);
    if (region.kind === REGION_KIND.STARTER) return refuse(TEXT.REFUSE_STARTER);
    delete atlas.regions[id];
    announce('abandoned', id);
    saveNow();
    return { success: true };
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

/** The middle of the mat, where the Hall stands in a Region it has never been to. */
function matCentre() {
    return { x: Math.round(matW() / 2), y: Math.round(matH() / 2) };
}

/** What a save would write: a board kept this way comes back exactly as a load would bring it. */
function frozenCopy(board) {
    return JSON.parse(JSON.stringify(board));
}

/** Bank the loot on the floor; what the Bank cannot take stays where it lies. */
function bankFloorLoot() {
    const banked = SpriteLayer.getSprites().length ? SpriteLayer.collectAll() : 0;
    return { banked, leftOnFloor: SpriteLayer.getSprites().length };
}

/** Take the Hall and the quest Tokens off the mat, noting where each stood. */
function liftTravellers() {
    const travellers = BoardState.tokens().filter(t => isGuildHall(t) || isQuestToken(t));
    const spots = {};
    for (const t of travellers) {
        spots[t.id] = { x: t.x, y: t.y, placedAt: t.placedAt };
        BoardState.removeToken(t.id);
    }
    return { travellers, spots };
}

/**
 * Put a travelling Token down. Back in a Region it stood in, exactly where it stood and in the same
 * place in the arrival order; anywhere else, at the nearest clear spot to `aim`, arriving last.
 */
function putDown(instance, remembered, aim) {
    if (remembered && Number.isFinite(remembered.x) && Number.isFinite(remembered.y)) {
        if (Number.isInteger(remembered.placedAt)) instance.placedAt = remembered.placedAt;
        BoardState.addToken(instance, remembered.x, remembered.y);
        return;
    }
    const spot = MatPlacement.findSpotAnywhere(instance.typeId, aim, { excludeId: instance.id }) || aim;
    delete instance.placedAt;
    BoardState.addToken(instance, spot.x, spot.y);
}

/** The Hall first (its old spot here, else the middle), then each quest at its old offset from it. */
function landTravellers(travellers, remembered) {
    const hall = travellers.find(t => isGuildHall(t)) || null;
    const hallFrom = hall ? { x: hall.x, y: hall.y } : null;
    for (const t of travellers) {
        if (isGuildHall(t)) putDown(t, remembered[t.id], matCentre());
    }
    for (const t of travellers) {
        if (isGuildHall(t)) continue;
        const aim = hall && hallFrom
            ? { x: hall.x + (t.x - hallFrom.x), y: hall.y + (t.y - hallFrom.y) }
            : matCentre();
        putDown(t, remembered[t.id], aim);
    }
}

/**
 * Move the whole guild to Region `id`.
 *
 * @returns {{success: boolean, reason?: string, fromRegionId?: string, toRegionId?: string,
 *          banked?: number, leftOnFloor?: number}} `banked`: loot piles taken into the Bank on
 *          leaving; `leftOnFloor`: piles the Bank could not take, left on the old Region's floor
 */
export function travel(id) {
    const atlas = ensureState();
    if (!atlas) return refuse(TEXT.REFUSE_NO_GAME);
    const to = atlas.regions[id];
    if (!to) return refuse(TEXT.REFUSE_NO_REGION);
    if (id === atlas.activeRegionId) return refuse(TEXT.REFUSE_ALREADY_HERE);
    if (to.archived) return refuse(TEXT.REFUSE_ARCHIVED);
    if (CatchUp.isRunning()) return refuse(TEXT.REFUSE_CATCHING_UP);
    const from = atlas.regions[atlas.activeRegionId];

    const floor = bankFloorLoot();
    const { travellers, spots } = liftTravellers();
    from.travellers = spots;
    from.board = frozenCopy(GameState.state.board);

    GameState.state.board = isPlainObject(to.board) ? to.board : createEmptyBoard();
    to.board = null;
    atlas.activeRegionId = to.id;
    landTravellers(travellers, isPlainObject(to.travellers) ? to.travellers : {});
    to.travellers = {};

    EventBus.publish(ENGINE_EVENTS.BOARD_SWAPPED, { fromRegionId: from.id, toRegionId: to.id });
    announce('travelled', to.id);
    EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'travel' });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
    saveNow();
    logger.info('Atlas', `The guild travelled from ${from.id} to ${to.id}`);
    return { success: true, fromRegionId: from.id, toRegionId: to.id, ...floor };
}
