// settling the world map's places: what each cell is now, what it asks, and paying for it

import { InventoryManager } from '../inventory/InventoryManager.js';
import { getCoins, spendCoins } from '../inventory/Coins.js';
import * as HeroManager from '../hero/HeroManager.js';
import { getSkillLevel } from '../hero/SkillSystem.js';
import { guildHeroes } from '../hero/summoned.js';
import * as CatchUp from '../core/CatchUp.js';
import { SaveManager } from '../core/SaveManager.js';
import * as Atlas from '../atlas/Atlas.js';
import { nextSeed } from '../atlas/seededRandom.js';
import { TEXT as REGION_TEXT, flavourName } from '../atlas/regionNames.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { worldTables } from '../../config/registries/worldTablesRegistry.js';
// Loads the authored stars into the sky (`data/hallStars.json`) before a ring is read.
import '../../config/registries/hallStarRegistry.js';
import { authoredStars } from '../../config/guildUpgrades.js';
import { GameState } from '../../state/GameState.js';
import { lineById, placePriceFactor } from '../../config/worldTablesShape.js';
import { materialsFromTokens } from './materials.js';
import { currentWorld } from './worldState.js';
import { HALL_CELL, CELL_STATE, settledIds, cellStates, settledInRing, priceRows, cellOutputs } from './frontier.js';
import { recipesOfCell } from './cellRegion.js';
import { priceTemplateOf } from './generate.js';
import { ringLock } from './ringStars.js';
import * as Arrival from './Arrival.js';
import * as HeroMotion from '../board/HeroMotion.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { logger } from '../../utils/Logger.js';

/**
 * The world map's places, as the guild stands now (`frontier.js` reads them): which cells are
 * settled (the Hall's, and each one a Region was settled on), which can be settled next, and what
 * each asks against the Bank and the heroes' levels.
 *
 * {@link settleCell} pays a cell's whole price at once, writes its Region from the cell (its mat:
 * `cellMat.js`, through `cellRegion.js`), moves the guild there and puts the place's arrival on it
 * (`Arrival.js`): the mat is held until those enemies are beaten. The heroes walk in from the mat's
 * foot to stand idle by the Hall (`HeroMotion.walkIn`), and `ATLAS_CHANGED` says `'arrived'`, for
 * the screen's ceremony; no fight starts until the player sends a hero. Travel between settled
 * places is the Atlas's, free and instant, as before, with neither.
 */

/** Player-facing refusals, kept together for translation. */
export const SETTLE_TEXT = Object.freeze({
    NO_WORLD: 'This game has no world map: it began before the world was drawn',
    NO_CELL: 'There is no such place',
    SETTLED: 'The guild has settled there already',
    BEYOND: 'Settle a place beside it first',
    SHORT: 'The guild cannot pay for it yet',
    RING_LOCKED: 'Light its Guild Hall star first',
    CATCHING_UP: 'Wait until the time away has played',
    NOT_WRITTEN: 'The place could not be written'
});

/** How many seeds the writing tries for a layout in which every Token fits. */
const LAYOUT_TRIES = 8;

const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

const materialsOf = materialsFromTokens(getTokenType);

/** Every Region the Atlas holds. */
function allRegions() {
    return Atlas.list().map(r => Atlas.getRegion(r.id)).filter(Boolean);
}

/** The best level any hero has reached in `skill`, 0 with none. A Summoned worker's is not the guild's. */
export function guildSkillLevel(skill) {
    let best = 0;
    for (const hero of guildHeroes(HeroManager.getAllHeroes())) {
        const level = getSkillLevel(hero.id, skill);
        if (Number.isFinite(level) && level > best) best = level;
    }
    return best;
}

/** The coins the world tables ask now for settling a cell of this ring (`prices[ring].coins`). */
function coinsAsked(cell) {
    return cell?.ring >= 1 ? priceTemplateOf(worldTables(), cell.ring)?.coins || 0 : 0;
}

/** How far a cell's price has grown: by the places the guild has settled in its ring so far (`placePriceGrowth`). */
function priceFactor(cell) {
    const world = currentWorld();
    if (!world || !(cell?.ring >= 1)) return 1;
    return placePriceFactor(worldTables(), settledInRing(world, settledCellIds(world), cell.ring, cell.id));
}

const guild = () => ({
    itemCount: (itemId) => InventoryManager.getItemCount(itemId),
    itemKnown: (itemId) => getItem(itemId) != null,
    skillLevel: guildSkillLevel,
    coinsAsked,
    coinCount: getCoins,
    priceFactor
});

/** The settled cells' ids, the Hall's always among them; empty with no world. */
export function settledCellIds(world = currentWorld()) {
    return world ? settledIds(world, allRegions()) : new Set();
}

/** Each cell's state by id (`frontier.CELL_STATE`); empty with no world. */
export function cellStatesNow(world = currentWorld()) {
    return world ? cellStates(world, settledCellIds(world)) : new Map();
}

/** A cell's price against the Bank and the heroes now, grown by its ring's places settled so far (`frontier.priceRows`). */
export function priceOf(cell) {
    return priceRows(cell, guild());
}

/** The guild's rank in a Guild Hall star now. */
const hallRank = (id) => GameState.state?.progress?.guildUpgrades?.[id] || 0;

/**
 * Why the guild may not settle a cell's ring yet: `{ ring, stars: [{ id, name }] }`, the Guild Hall
 * stars that would open it, or null when its ring is open (`ringStars.js`).
 */
export function ringLockOf(cell) {
    return cell ? ringLock(cell.ring, authoredStars(), hallRank) : null;
}

/** The materials a cell shows on the map (`frontier.cellOutputs`). */
export function outputsOf(cell) {
    return cellOutputs(cell, materialsOf);
}

/** The id of the Region settled on cell `id`, or null: the Starter Camp for the Hall's cell. */
export function regionIdOfCell(id) {
    const regions = allRegions();
    if (id === HALL_CELL) return regions.find(r => r.kind === Atlas.REGION_KIND.STARTER)?.id ?? null;
    return regions.find(r => r.cellId === id)?.id ?? null;
}

/** The cell the guild is in, or null (a dev Region off the map, or no world). */
export function activeCellId() {
    const region = Atlas.activeRegion();
    if (!region || !currentWorld()) return null;
    if (region.kind === Atlas.REGION_KIND.STARTER) return HALL_CELL;
    return region.cellId || null;
}

/** What the map calls a cell: its kit and its line ("Highland Ores"); the Hall's cell is the Starter Camp. */
export function cellName(cell, tables = worldTables()) {
    if (!cell || cell.ring === 0) return REGION_TEXT.STARTER_CAMP;
    const kit = tables.kits.find(k => k.id === cell.kit)?.name || '';
    const line = lineById(tables, cell.wedge)?.name || '';
    return [kit, line].filter(Boolean).join(' ');
}

/**
 * What a place is called before and after it is settled ("Elderfield"): a name from its own seed,
 * so the world map can show it before the guild has been there. Its Region takes the same name.
 */
export function placeName(cell) {
    if (!cell || cell.ring === 0) return REGION_TEXT.STARTER_CAMP;
    return flavourName(cell.seed >>> 0);
}

/** The layout a place is written with: the first of a few seeds in which every Token fits, else the first. */
function seedFor(cell, recipes) {
    let seed = cell.seed >>> 0;
    for (let i = 0; i < LAYOUT_TRIES; i++) {
        if (Atlas.preview(recipes, { seed }).fits) return seed;
        seed = nextSeed(seed);
    }
    return cell.seed >>> 0;
}

/** Save now, when a slot is being played. */
function saveNow() {
    if (SaveManager.getCurrentSlot() !== null) SaveManager.save(false);
}

/** A Token type's work skill, or null. */
const skillOf = (typeId) => getTokenType(typeId)?.config?.skill || null;

/**
 * Write the Region of `cell` (a world cell, or the QA panel's fixture): its mat (`cellMat.js`) laid
 * out by the Atlas. The guild stays where it is.
 *
 * @param {object} cell
 * @param {{cellId?: string|null, save?: boolean}} [options] the world cell the Region is settled on
 * (null: none); `save: false` leaves the save to the caller's end
 * @returns {{success: boolean, reason?: string, region?: object, mat?: object, written?: object}}
 */
export function writePlace(cell, { cellId = null, save = true } = {}) {
    const tables = worldTables();
    const hall = currentWorld()?.cells.find(c => c.ring === 0);
    const { mat, recipes } = recipesOfCell(cell, {
        tables, skillOf, hallOrigins: (hall?.origins || []).map(o => o.id), name: cellName(cell, tables)
    });
    const describe = () => ({ word: recipes[0].name });
    const written = Atlas.settle({ ingredients: recipes, seed: seedFor(cell, recipes), describe, cellId, allowUnplaced: true, save: false });
    if (!written.success) return refuse(SETTLE_TEXT.NOT_WRITTEN, { written });
    // ⚠️ The Atlas names a Region from its layout's seed, which moves on when a layout does not
    // fit: the place keeps the name the map showed.
    const name = placeName(cell);
    if (cellId && written.region.flavourName !== name) Atlas.rename(written.region.id, name);
    if (save) saveNow();
    return { success: true, region: written.region, mat };
}

/**
 * Take the guild to a place just written, put its arrival on the mat, walk the heroes in and say
 * `'arrived'`; then save, unless `save` is false (the caller saves at its end).
 *
 * @returns {{travel: object, arrival: {ids: string[], unplaced: string[]}, walkIn: string[]}}
 */
export function arriveAt(region, mat, { save = true } = {}) {
    // ⚠️ One save after the arrival is down: travel's own save would write a settled place
    // with no enemies, which a crash before the next save would keep for good.
    const travel = Atlas.travel(region.id, { save: false });
    if (!travel.success) return { travel, arrival: { ids: [], unplaced: [] }, walkIn: [] };
    const arrival = Arrival.occupy(mat?.arrival, { seed: region.seed });
    const walkIn = HeroMotion.walkIn();
    EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'arrived', regionId: region.id, cellId: region.cellId ?? null });
    if (save) saveNow();
    return { travel, arrival, walkIn };
}

/**
 * Settle cell `id`: pay its whole price from the Bank (and its coins, `frontier.priceRows`), write its Region, take the guild there and
 * put the place's arrival on its mat. Refuses, taking nothing, with no world, a cell that is not on
 * the frontier, while the time away is still playing, a ring whose Guild Hall star the guild does
 * not hold (with `lock`), or a price the guild cannot meet.
 *
 * @returns {{success: boolean, reason?: string, lock?: object, price?: object, region?: object, mat?: object,
 *   travel?: object, arrival?: object, walkIn?: string[]}}
 */
export function settleCell(id) {
    const world = currentWorld();
    if (!world) return refuse(SETTLE_TEXT.NO_WORLD);
    const cell = world.cells.find(c => c.id === id);
    if (!cell) return refuse(SETTLE_TEXT.NO_CELL);
    const state = cellStatesNow(world).get(id);
    if (state === CELL_STATE.SETTLED) return refuse(SETTLE_TEXT.SETTLED);
    if (state !== CELL_STATE.FRONTIER) return refuse(SETTLE_TEXT.BEYOND);
    if (CatchUp.isRunning()) return refuse(SETTLE_TEXT.CATCHING_UP);
    const lock = ringLockOf(cell);
    if (lock) return refuse(SETTLE_TEXT.RING_LOCKED, { lock });
    const price = priceOf(cell);
    if (!price.met) return refuse(SETTLE_TEXT.SHORT, { price });

    // ⚠️ One save, at the very end: a save part-way (written, not paid; paid, no enemies yet)
    // is what a crash before the next save would keep.
    const written = writePlace(cell, { cellId: id, save: false });
    if (!written.success) return written;

    for (const row of price.items) InventoryManager.removeItem(row.itemId, row.need);
    if (price.coins) spendCoins(price.coins.need);
    const { travel, arrival, walkIn } = arriveAt(written.region, written.mat, { save: false });
    saveNow();
    logger.info('World', `Settled ${id} as ${written.region.id}${travel.success ? `, and the guild moved there to ${arrival.ids.length} enemies` : ''}`);
    return { success: true, price, region: written.region, mat: written.mat, travel, arrival, walkIn };
}
