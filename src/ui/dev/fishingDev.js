// the QA panel's fishing check (brief 230 S5): a lake, a river and a sea, each fished its own way, and a Dock
// ⚠️ DEV BUILDS ONLY: reached from `FishingDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Fishing from '../../systems/board/Fishing.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem, registerItems } from '../../config/registries/itemRegistry.js';
import { toolKindLabel } from '../../config/registries/toolKinds.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens and items made in memory for this check only (never written to `data/`, gone on
 * reload). Stand-in art; the content pack (S8) brings the real waters, fish and bait.
 * - a QA Lake, a QA River and a QA Sea: water (catch pools), each with a rod pool, a rod-and-worm
 *   pool and a net pool of its own;
 * - a QA Dock: Work Time −30 % to the water within reach;
 * - QA fish, a QA Worm (bait, a Consumable) and a QA Net (a Fishing Net tool).
 */
export const QA_FISHING = Object.freeze({
    LAKE: 'qa_s5_lake',
    RIVER: 'qa_s5_river',
    SEA: 'qa_s5_sea',
    DOCK: 'qa_s5_dock',
    WORM: 'qa_s5_worm',
    NET: 'qa_s5_net'
});
const ROD = 'item_fishing_rod';
const SHRIMP = 'item_raw_shrimp';
const FISH = Object.freeze({
    TROUT: 'qa_s5_trout', SALMON: 'qa_s5_salmon', TROPICAL: 'qa_s5_tropical_fish', SHARK: 'qa_s5_shark', LOBSTER: 'qa_s5_lobster'
});
const TAG = 'qa_water';
const BASE_MS = 10000;

const fish = (id, name, sprite) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite, value: 1 });
const pool = (tool, bait, catches) => ({ tool, ...(bait ? { bait } : {}), catches: catches.map(([itemId, weight]) => ({ itemId, weight })) });
const water = (id, name, sprite, pools) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: true, tags: [TAG],
    config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: BASE_MS, xp: 1, inputs: [], outputs: [] },
    catchPools: pools
});

let registered = false;
function registerQa() {
    if (registered) return;
    registerItems({
        [FISH.TROUT]: fish(FISH.TROUT, 'QA Trout', 'i_trout_raw'),
        [FISH.SALMON]: fish(FISH.SALMON, 'QA Salmon', 'i_salmon_raw'),
        [FISH.TROPICAL]: fish(FISH.TROPICAL, 'QA Tropical Fish', 'i_tropical_fish_raw'),
        [FISH.SHARK]: fish(FISH.SHARK, 'QA Shark', 'i_shark_raw'),
        [FISH.LOBSTER]: fish(FISH.LOBSTER, 'QA Lobster', 'i_lobster_raw'),
        [QA_FISHING.WORM]: { id: QA_FISHING.WORM, name: 'QA Worm', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', value: 1 },
        [QA_FISHING.NET]: { id: QA_FISHING.NET, name: 'QA Net', type: 'tool', stackable: true, equipSlot: 'hand', sprite: 'i_fish_trap', tool: { kind: 'fishing_net', tier: 1 } }
    });
    registerTokenTypes({
        [QA_FISHING.LAKE]: water(QA_FISHING.LAKE, 'QA Lake', 't_lake_small', [
            pool('fishing_rod', null, [[FISH.TROUT, 60], [FISH.SALMON, 30], [FISH.SHARK, 10]]),
            pool('fishing_rod', QA_FISHING.WORM, [[FISH.SALMON, 70], [FISH.TROUT, 20], [FISH.SHARK, 10]]),
            pool('fishing_net', null, [[SHRIMP, 1]])
        ]),
        [QA_FISHING.RIVER]: water(QA_FISHING.RIVER, 'QA River', 't_fish_spot', [
            pool('fishing_rod', null, [[FISH.TROUT, 50], [FISH.SALMON, 50]]),
            pool('fishing_rod', QA_FISHING.WORM, [[FISH.SALMON, 1]]),
            pool('fishing_net', null, [[SHRIMP, 1]])
        ]),
        [QA_FISHING.SEA]: water(QA_FISHING.SEA, 'QA Sea', 't_coast', [
            pool('fishing_rod', null, [[FISH.TROPICAL, 90], [FISH.SHARK, 10]]),
            pool('fishing_rod', QA_FISHING.WORM, [[FISH.TROPICAL, 50], [FISH.SHARK, 50]]),
            pool('fishing_net', null, [[SHRIMP, 80], [FISH.LOBSTER, 20]])
        ]),
        [QA_FISHING.DOCK]: {
            id: QA_FISHING.DOCK, name: 'QA Dock', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_foundation_wood', requiresHero: false,
            statements: [{ id: `stm_${QA_FISHING.DOCK}`, keyword: 'provides', to: { mode: 'tag', value: TAG },
                payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.3 } }]
        }
    });
    registered = true;
}

/** Ids of what the scene laid, and the last catches per water, for the readout. */
let scene = null;
let offCatches = null;

function put(typeId, point) {
    const spot = MatPlacement.findSpot(typeId, point, { reach: 320 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, { x: spot.x, y: spot.y })?.success ? inst : null;
}

/** A new Fishing 10 hero with room made in the roster, holding `items` (tools and bait) from the Bank. */
function qaFisher(name, items) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { fishing: { ...(hero.skills?.fishing || {}), level: 10, xp: xpForLevel(10) } };
    if (!HeroManager.addHero(hero)) return null;
    for (const itemId of items) {
        if (!InventoryManager.hasItem(itemId, 1)) InventoryManager.addItem(itemId, 1);
        EquipmentManager.equipItem(hero.id, itemId);
    }
    return hero;
}

/**
 * Below the Guild Hall, three waters in a row, each with its fisher:
 * - left, the QA Lake with a QA Dock beside it (10 s becomes 7 s): QA Angler, a Fishing Rod and
 *   QA Worms (5 in the Bank). The worm pool (mostly Salmon) until the worms run out, then the
 *   lake's basic pool (mostly Trout);
 * - middle, the QA River: QA Plain Angler, a Fishing Rod and no bait: the basic pool (Trout and
 *   Salmon);
 * - right, the QA Sea: QA Netter, a QA Net: the net pool (Shrimp, sometimes a Lobster).
 * Catches drop beside each water like any loot.
 * ⚠️ Changes the game, like Spawn Party: it adds three heroes and puts worms, rods and a net in
 * the Bank.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpFishingScene() {
    if (!getItem(ROD) || !getItem(SHRIMP)) return { ok: false, error: 'No Fishing Rod or Raw Shrimp in the content' };
    registerQa();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };

    const lake = put(QA_FISHING.LAKE, { x: c.x - 480, y: c.y + 290 });
    const dock = lake ? put(QA_FISHING.DOCK, { x: lake.x - 150, y: lake.y }) : null;
    const river = put(QA_FISHING.RIVER, { x: c.x - 120, y: c.y + 290 });
    const sea = put(QA_FISHING.SEA, { x: c.x + 240, y: c.y + 290 });
    if (!lake || !dock || !river || !sea) return { ok: false, error: 'No room below the Guild Hall for the scene' };
    // The Dock must stand within reach of the lake (164 u): a nudge could carry it out.
    if (Math.hypot(dock.x - lake.x, dock.y - lake.y) > 160) return { ok: false, error: 'The QA Dock landed out of the lake’s reach' };
    TileModifiers.rebuildAll();

    InventoryManager.addItem(QA_FISHING.WORM, 5);
    const angler = qaFisher('QA Angler', [ROD, QA_FISHING.WORM]);
    const plain = qaFisher('QA Plain Angler', [ROD]);
    const netter = qaFisher('QA Netter', [QA_FISHING.NET]);
    if (!angler || !plain || !netter) return { ok: false, error: 'The roster would not take three more heroes' };
    Placement.plantFlagAt(angler.id, { x: lake.x, y: lake.y });
    Placement.plantFlagAt(plain.id, { x: river.x, y: river.y });
    Placement.plantFlagAt(netter.id, { x: sea.x, y: sea.y });

    scene = {
        waters: [
            { id: lake.id, hero: angler.id },
            { id: river.id, hero: plain.id },
            { id: sea.id, hero: netter.id }
        ],
        dock: dock.id,
        caught: { [lake.id]: [], [river.id]: [], [sea.id]: [] }
    };
    offCatches?.();
    offCatches = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
        const list = scene?.caught?.[p?.instanceId];
        if (!list) return;
        list.push(p.produced?.[0] || null);
        if (list.length > 6) list.shift();
    }, UI_LISTENER);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_fishing_scene' });
    return { ok: true };
}

const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
const itemName = (id) => getItem(id)?.name || id;

/**
 * What the scene shows, read from the engine (`Fishing.fishingOf`, the cycle the runner uses),
 * refreshed while the panel is open.
 * @returns {string[]}
 */
export function fishingReadout() {
    if (!scene) return [];
    const lines = [];
    for (const { id, hero } of scene.waters) {
        const token = BoardState.getTokenById(id);
        if (!token) continue;
        const def = getTokenType(token.typeId);
        const name = tokenName(token.typeId);
        const plan = Fishing.fishingOf(def, hero);
        const heroName = HeroManager.getHero(hero)?.name || 'its fisher';
        const how = plan
            ? `${toolKindLabel(plan.tool.kind)}${plan.bait ? ` and ${itemName(plan.bait)} (${InventoryManager.getItemCount(plan.bait)} left)` : ', no bait: the basic pool'}`
            : 'nothing it can fish with';
        const rules = TileModifiers.resolveAxis(id, EFFECT_TYPES.WORK_TIME, BASE_MS, 'fishing');
        const cycle = Math.max(1000, TileModifiers.floorSpeedUp(BASE_MS, rules));
        const sped = cycle < BASE_MS
            ? ` (${secs(BASE_MS)} authored, sped by the Dock; never under ${secs(BASE_MS - BASE_MS * MAX_SPEED_UP_CUT)})`
            : '';
        lines.push(`${name}: ${heroName}, ${how}; a catch every ${secs(cycle)}${sped}; never runs out`);
        const last = (scene.caught[id] || []).map(i => (i ? itemName(i) : 'nothing'));
        if (last.length) lines.push(`  last catches: ${last.join(', ')}`);
    }
    return lines;
}
