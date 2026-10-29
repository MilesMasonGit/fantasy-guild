// the QA panel's Farming check (brief 230 S4): Fields that grow themselves (empty, growing, ripe, stopped), a Well, a Composter and a Beehive in reach, a map's ready-planted wild patch
// ⚠️ DEV BUILDS ONLY: reached from `FarmingDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as StationRecipe from '../../systems/board/StationRecipe.js';
import * as Fields from '../../systems/board/Fields.js';
import * as Respawn from '../../systems/board/Respawn.js';
import * as BoardRunner from '../../systems/board/BoardRunner.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { flagStatusLine } from '../components/board/flagText.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName, getTokenType } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { registerRecipePools, getRecipe } from '../../config/registries/recipePoolRegistry.js';
import { cropTermsOf } from '../../config/registries/tokenConstants.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { KEYWORD } from '../../systems/effects/statements.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test content made in memory for this check only (never written to `data/`, gone on reload), with
 * the shapes the S8 content pack will give the real ones:
 * - QA Field and QA Herb Garden: Farming stations of kind Field and Herb Garden, each its own crop
 *   list, drawn empty (farmland), growing (the garden) or ripe (the crop's picture);
 * - QA Wheat (Field): sown for one Wheat Seed, grows 2 minutes (wheat is about an hour in the
 *   game; shortened here to watch), 4 harvests of 3 s, Wheat and a 40 % Wheat Seed each;
 * - QA Sage (Herb Garden): sown for one QA Sage Seed (none in the Bank, so it stops);
 * - QA Wild Wheat: a map's wheat patch, a Field that starts ripe with QA Wheat picked;
 * - QA Well (Grow Time −50 % to QA Fields in reach), QA Composter (+2 to the load of QA Fields in
 *   reach), QA Beehive (a Farming node: 3 QA Honey and some Beeswax Comb, then it rests 90 s and
 *   refills all at once, sooner with Fields in reach; 25 % to double the Wheat of Fields in reach).
 */
export const QA_FARMING = Object.freeze({
    FIELD: 'qa_s4_field',
    HERB_GARDEN: 'qa_s4_herb_garden',
    WILD: 'qa_s4_wild_wheat',
    WELL: 'qa_s4_well',
    COMPOSTER: 'qa_s4_composter',
    BEEHIVE: 'qa_s4_beehive',
    WHEAT: 'recipe_qa_s4_wheat',
    SAGE: 'recipe_qa_s4_sage'
});
const T = QA_FARMING;
const WHEAT_ITEM = 'item_wheat';
const SEED = 'item_wheat_seed';
const WAX = 'item_beeswax_comb';
export const QA_ITEMS = Object.freeze({
    SAGE: 'qa_s4_sage',
    SAGE_SEED: 'qa_s4_sage_seed',
    HONEY: 'qa_s4_honey'
});
const FIELD_TAG = 'QaS4Field';

/** The stand-in pictures until the owner draws them (`owner_art_list.md` §"Skill loops"). */
export const FIELD_ART = Object.freeze({ EMPTY: 't_farmland', GROWING: 't_garden', WHEAT: 't_field_wheat', SAGE: 't_field_lavender' });

const item = (id, name, sprite) => ({
    id, name, type: 'material', sprite, description: 'A QA test item (gone on reload).', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
const works = (id, kind) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: kind } });
const provides = (id, to, payload) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload });
const harvest = { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] };
/** A Field speeds the Beehive's refill when it stands in reach. */
const speedsHive = (id) => provides(`${id}_hive`, { mode: 'id', value: T.BEEHIVE }, { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.2 });
const fieldType = (id, name, sprite, kind, field) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'qa', uses: null, sprite, tags: [FIELD_TAG],
    requiresHero: true, config: harvest, statements: [works(id, kind), speedsHive(id)], field
});

function registerQaContent() {
    registerItems({
        [QA_ITEMS.SAGE]: item(QA_ITEMS.SAGE, 'QA Sage', 'i_wheat'),
        [QA_ITEMS.SAGE_SEED]: item(QA_ITEMS.SAGE_SEED, 'QA Sage Seed', 'i_seed_wheat'),
        [QA_ITEMS.HONEY]: item(QA_ITEMS.HONEY, 'QA Honey', 'i_honey')
    });
    registerRecipePools({
        farming: [{
            id: T.WHEAT, name: 'QA Wheat', levelRequirement: 1, durationMs: 3000, xp: 1, stationKinds: ['field'],
            inputs: [{ itemId: SEED, quantity: 1 }],
            outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }, { itemId: SEED, chance: 40, minQty: 1, maxQty: 1 }],
            crop: { growMs: 120000, load: 4, ripeSprite: FIELD_ART.WHEAT }
        }, {
            id: T.SAGE, name: 'QA Sage', levelRequirement: 1, durationMs: 3000, xp: 1, stationKinds: ['herb_garden'],
            inputs: [{ itemId: QA_ITEMS.SAGE_SEED, quantity: 1 }],
            outputs: [{ itemId: QA_ITEMS.SAGE, chance: 100, minQty: 1, maxQty: 1 }],
            crop: { growMs: 90000, load: 3, ripeSprite: FIELD_ART.SAGE }
        }]
    }, { takeOver: false });
    const sprites = { emptySprite: FIELD_ART.EMPTY, growingSprite: FIELD_ART.GROWING };
    registerTokenTypes({
        [T.FIELD]: fieldType(T.FIELD, 'QA Field', 't_farmland', 'field', sprites),
        [T.HERB_GARDEN]: fieldType(T.HERB_GARDEN, 'QA Herb Garden', 't_greenhouse', 'herb_garden', sprites),
        [T.WILD]: fieldType(T.WILD, 'QA Wild Wheat', 't_field_wheat', 'field', { ...sprites, startsWith: T.WHEAT }),
        [T.WELL]: {
            id: T.WELL, name: 'QA Well', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite: 't_well_wishing', requiresHero: false,
            statements: [provides(T.WELL, { mode: 'id', value: T.FIELD }, { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 })]
        },
        [T.COMPOSTER]: {
            id: T.COMPOSTER, name: 'QA Composter', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite: 't_lumberpile', requiresHero: false,
            statements: [provides(T.COMPOSTER, { mode: 'id', value: T.FIELD }, { type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 2 })]
        },
        [T.BEEHIVE]: {
            id: T.BEEHIVE, name: 'QA Beehive', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: 3, sprite: 't_meadow',
            requiresHero: true, staysPut: true,
            respawn: { mode: 'refill', afterMs: 90000 },
            config: {
                skill: 'farming', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [],
                outputs: [{ itemId: QA_ITEMS.HONEY, chance: 100, minQty: 1, maxQty: 1 }, { itemId: WAX, chance: 50, minQty: 1, maxQty: 1 }]
            },
            statements: [provides(T.BEEHIVE, { mode: 'tag', value: FIELD_TAG }, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 25, category: WHEAT_ITEM })]
        }
    });
}

/**
 * Where the scene stands: the band above the Guild Hall, clear of the Starter Camp's Oak Forest
 * (upper left), the Forestry scene (upper right) and the scenes below the Hall. Supports stand 150
 * or 160 from the Field they serve (within reach, 164) and further from the others.
 */
export const FARMING_SPOTS = Object.freeze({
    wild: { x: 560, y: 140 },
    growing: { x: 710, y: 140 },
    well: { x: 710, y: 300 },
    ripe: { x: 860, y: 140 },
    composter: { x: 860, y: 300 },
    beehive: { x: 1010, y: 140 },
    herbGarden: { x: 1010, y: 300 },
    empty: { x: 1160, y: 140 }
});

function put(typeId, point, uses = tokenStartingUses(typeId)) {
    const inst = BoardState.createTokenInstance(typeId, uses);
    return Placement.placeTokenAt(inst, point)?.success ? inst : null;
}

/** What the scene laid, for the readout. */
let scene = null;

const counted = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

/**
 * The band above the Guild Hall, left to right:
 * - QA Wild Wheat, ripe with QA Wheat as a map lays it (nobody sowed it);
 * - a QA Field picked to QA Wheat, sown at once for a Wheat Seed and growing, its QA Well below
 *   halving the growth (2 min → 1 min);
 * - a QA Field already ripe with QA Wheat, its QA Composter below (6 harvests, not 4), a QA Farmer
 *   flagged on it: they harvest it, collect the QA Beehive, and harvest the other Field when ripe;
 *   its last harvest sows it again;
 * - the QA Beehive: 3 QA Honey and some Beeswax Comb, then it rests and refills all at once
 *   (sooner with Fields in reach); a 25 % chance to double each Wheat of the Fields in reach;
 * - a QA Herb Garden picked to QA Sage, stopped: no QA Sage Seed in the Bank ("Needs QA Sage Seed");
 * - an empty QA Field with nothing picked: its gear asks for a crop.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpFarmingScene() {
    if (!getItem(WHEAT_ITEM) || !getItem(SEED)) return { ok: false, error: 'No Wheat or Wheat Seed in the content' };
    registerQaContent();
    const s = FARMING_SPOTS;
    const laid = {
        wild: put(T.WILD, s.wild),
        growing: put(T.FIELD, s.growing),
        well: put(T.WELL, s.well),
        ripe: put(T.FIELD, s.ripe),
        composter: put(T.COMPOSTER, s.composter),
        beehive: put(T.BEEHIVE, s.beehive),
        herbGarden: put(T.HERB_GARDEN, s.herbGarden),
        empty: put(T.FIELD, s.empty)
    };
    if (Object.values(laid).some(t => !t)) return { ok: false, error: 'No room in the band above the Guild Hall for the scene' };
    TileModifiers.rebuildAll();

    // One Field sows on the next tick (a seed in the Bank); the other starts ripe, as if it had
    // grown (its load read with the Composter beside it); the Herb Garden stops for want of a seed.
    if (counted(SEED) < 2) InventoryManager.addItem(SEED, 2);
    StationRecipe.setSelectedRecipe(laid.growing, T.WHEAT);
    StationRecipe.setSelectedRecipe(laid.ripe, T.WHEAT);
    const fieldDef = getTokenType(T.FIELD);
    const load = Fields.loadAtRipening(laid.ripe, fieldDef, getRecipe(T.WHEAT));
    laid.ripe.field = { cropId: T.WHEAT, load, full: load };
    StationRecipe.setSelectedRecipe(laid.herbGarden, T.SAGE);

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const farmer = generateHero({ name: 'QA Farmer' });
    farmer.skills = { farming: { ...(farmer.skills?.farming || {}), level: 10, xp: xpForLevel(10) } };
    if (!HeroManager.addHero(farmer)) return { ok: false, error: 'The roster would not take another hero' };
    qaOrder(farmer.id, s.ripe);

    scene = {
        ids: Object.fromEntries(Object.entries(laid).map(([k, t]) => [k, t.id])),
        farmer: farmer.id,
        start: { wheat: counted(WHEAT_ITEM), honey: counted(QA_ITEMS.HONEY), wax: counted(WAX) }
    };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_farming_scene' });
    return { ok: true };
}

/** Five QA Sage Seeds into the Bank: the stopped Herb Garden sows on the next tick. */
export function giveSageSeeds() {
    registerQaContent();
    InventoryManager.addItem(QA_ITEMS.SAGE_SEED, 5);
    return { ok: true };
}

/** A duration as m:ss. */
const clock = (ms) => {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** A Field's state as the readout says it. */
function fieldText(t) {
    const name = tokenName(t.typeId);
    const f = Fields.fieldState(t);
    if (!f) return `${name}: not a Field`;
    const crop = (id) => getRecipe(id)?.name || id;
    const drawn = Fields.stateSpriteOf(t) || 'its own art';
    switch (f.stage) {
        case 'growing': {
            const base = cropTermsOf(getRecipe(f.cropId)).growMs;
            return `${name}: growing ${crop(f.cropId)}, ripe in ${clock(f.inMs)} (grows ${clock(f.totalMs)}, authored ${clock(base)}); drawn as ${drawn}`;
        }
        case 'ripe':
            return `${name}: ripe ${crop(f.cropId)}, ${f.load} of ${f.full} harvests left (the crop's load is ${cropTermsOf(getRecipe(f.cropId)).load}); drawn as ${drawn}`;
        default:
            if (f.stopped) return `${name}: stopped, needs ${f.short.map(id => getItem(id)?.name || id).join(', ')} to sow ${crop(f.pickId)}; drawn as ${drawn}`;
            if (f.pickId) return `${name}: sowing ${crop(f.pickId)}`;
            return `${name}: empty, nothing picked (Choose a crop); drawn as ${drawn}`;
    }
}

/** The Beehive as the readout says it. */
function hiveText(t) {
    const rest = Respawn.nextRespawn(t);
    if (rest) return `${tokenName(t.typeId)}: resting, refills in ${clock(rest.inMs)} (rests ${clock(rest.totalMs)}, authored 1:30; Fields in reach speed it)`;
    return `${tokenName(t.typeId)}: ${t.usesRemaining} of ${getTokenType(t.typeId)?.uses} honey left`;
}

/**
 * What the scene shows, read from the engine.
 * @returns {string[]}
 */
export function farmingReadout() {
    if (!scene) return [];
    const lines = [];
    for (const key of ['wild', 'growing', 'ripe', 'herbGarden', 'empty']) {
        const t = BoardState.getTokenById(scene.ids[key]);
        if (t) lines.push(fieldText(t));
    }
    const hive = BoardState.getTokenById(scene.ids.beehive);
    if (hive) lines.push(hiveText(hive));
    const since = (itemId, key) => counted(itemId) - scene.start[key];
    lines.push(`Since the scene: ${since(WHEAT_ITEM, 'wheat')} Wheat, ${since(QA_ITEMS.HONEY, 'honey')} QA Honey, ${since(WAX, 'wax')} Beeswax Comb`);
    if (HeroManager.getHero(scene.farmer)) {
        lines.push(`QA Farmer: ${flagStatusLine(scene.farmer)}${BoardRunner.isHeroIdle(scene.farmer) ? ' (counts as idle)' : ' (not idle)'}`);
    }
    return lines;
}
