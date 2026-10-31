// QA scenes for the Guild Hall's star machinery (brief 320 H1): a fixture sky with a constellation
// per skill and every star kind, and a mat to watch it work on.
// ⚠️ DEV BUILDS ONLY: reached from `GuildHallDevSection`, which TestDashboard renders behind
// `import.meta.env.DEV`. Nothing here is written to `data/`; the fixture sky is gone on reload.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Respawn from '../../systems/board/Respawn.js';
import * as Camps from '../../systems/board/Camps.js';
import * as PassiveProduction from '../../systems/board/PassiveProduction.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { loadoutCapOf } from '../../systems/equipment/loadoutCaps.js';
import { woundTimeMs } from '../../systems/combat/WoundedSystem.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { isGuildHall } from '../../systems/board/MatCap.js';
import { qaOrder } from './qaOrders.js';

const VEIN = 'token_copper_ore_vein';
const MINING_CAMP = 'token_mining_camp';
const PICKAXE = 'item_copper_pickaxe';

let ruleSeq = 0;
/** A standing Provides, as a star's rank holds it. `to` aims it at some Tokens. */
function provides(type, value, { bucket = 'percentage', category, to } = {}) {
    ruleSeq += 1;
    return {
        id: `stm_qa_hall_${ruleSeq}`, keyword: 'provides',
        payload: { type, bucket, value, ...(category ? { category } : {}) },
        chargeDelta: 0, to: to || { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
    };
}

const oak = (n) => [{ itemId: 'item_oak_wood', quantity: n }];
const ore = (n) => [{ itemId: 'item_copper_ore', quantity: n }];

/**
 * The fixture sky: a Mining and a Forestry constellation linked to the Hall, two stars joining the
 * Hearth and two the Well. Every kind the machinery holds, at small numbers so each shows at once:
 * XP, yield and work speed for a skill; a vein's rest and a tree's regrowth (Grow Time aimed at a
 * Token and at a tag); a camp's reach; the Well's Copper Ore and Coal; the Infirmary; a second Food.
 */
export function qaHallSky() {
    ruleSeq = 0;
    const star = (id, constellation, name, description, node, links, ranks, tag) => ({
        id, constellation, name, description, node, links, ...(tag ? { tag } : {}), ranks
    });
    const ranks = (rows) => rows.map(([tier, price, rules, lines = []]) => ({ tier, price, rules, lines }));
    const stars = [
        star('qa_mining_xp', 'qa_mining', 'Miner’s Lore', 'Mining teaches more.', { x: 0.62, y: -0.2 }, ['hall'], ranks([
            [1, ore(10), [provides(EFFECT_TYPES.XP_BONUS, 0.5, { category: 'mining' })]],
            [1, ore(20), [provides(EFFECT_TYPES.XP_BONUS, 1, { category: 'mining' })]],
            [2, ore(40), [provides(EFFECT_TYPES.XP_BONUS, 2, { category: 'mining' })]]
        ])),
        star('qa_mining_yield', 'qa_mining', 'Rich Seams', 'Mining work brings up more.', { x: 0.95, y: -0.38 }, ['qa_mining_xp'], ranks([
            [1, ore(15), [provides(EFFECT_TYPES.YIELD, 0.5, { category: 'mining' })]],
            [2, ore(30), [provides(EFFECT_TYPES.YIELD, 1, { category: 'mining' })]]
        ])),
        star('qa_mining_speed', 'qa_mining', 'Quick Picks', 'Mining work goes faster.', { x: 0.98, y: -0.06 }, ['qa_mining_xp'], ranks([
            [1, ore(15), [provides(EFFECT_TYPES.WORK_TIME, -0.2, { category: 'mining' })]],
            [2, ore(30), [provides(EFFECT_TYPES.WORK_TIME, -0.4, { category: 'mining' })]]
        ])),
        star('qa_vein_rest', 'qa_mining', 'Deep Veins', 'A Copper Ore Vein rests for less time.', { x: 1.3, y: -0.3 }, ['qa_mining_yield'], ranks([
            [1, ore(20), [provides(EFFECT_TYPES.GROW_TIME, -0.25, { to: { mode: 'id', value: VEIN } })]],
            [2, ore(40), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'id', value: VEIN } })]]
        ]), 'right'),
        star('qa_mining_camp_reach', 'qa_mining', 'Long Rails', 'A Mining Camp hands out work further away.', { x: 1.3, y: 0.05 }, ['qa_mining_speed'], ranks([
            [1, ore(20), [provides(EFFECT_TYPES.CAMP_REACH, 0.25, { to: { mode: 'id', value: MINING_CAMP } })]],
            [2, ore(40), [provides(EFFECT_TYPES.CAMP_REACH, 0.5, { to: { mode: 'id', value: MINING_CAMP } })]]
        ]), 'right'),
        star('qa_forestry_xp', 'qa_forestry', 'Woodsman’s Lore', 'Forestry teaches more.', { x: -0.62, y: -0.24 }, ['hall'], ranks([
            [1, oak(10), [provides(EFFECT_TYPES.XP_BONUS, 0.5, { category: 'forestry' })]],
            [2, oak(30), [provides(EFFECT_TYPES.XP_BONUS, 1, { category: 'forestry' })]]
        ])),
        star('qa_oak_regrow', 'qa_forestry', 'Green Thumb', 'Oak regrows faster.', { x: -0.98, y: -0.4 }, ['qa_forestry_xp'], ranks([
            [1, oak(20), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'tag', value: 'Oak' } })]]
        ]), 'left'),
        star('qa_infirmary', 'hearth', 'Infirmary', 'A wounded hero recovers sooner.', { x: 0.36, y: -0.74 }, ['roster_size'], ranks([
            [1, oak(10), [provides(EFFECT_TYPES.WOUND_TIME, -0.2)]],
            [2, oak(20), [provides(EFFECT_TYPES.WOUND_TIME, -0.4)]],
            [3, oak(40), [provides(EFFECT_TYPES.WOUND_TIME, -0.6)]]
        ]), 'right'),
        star('qa_food_slot', 'hearth', 'Larder', 'Every hero may carry a second Food.', { x: -0.36, y: -0.74 }, ['roster_size'], ranks([
            [1, oak(20), [provides(EFFECT_TYPES.LOADOUT_SLOTS, 1, { bucket: 'flat', category: 'food' })]]
        ]), 'left'),
        star('qa_well_copper', 'well', 'Copper Spring', 'The Guild Hall draws Copper Ore every lap. No hero needed.', { x: 0.4, y: 0.74 }, ['wishing_well'], ranks([
            [1, oak(10), [], ore(10)],
            [1, oak(20), [], ore(20)],
            [2, oak(40), [], ore(30)]
        ]), 'right'),
        star('qa_well_coal', 'well', 'Coal Seam', 'The Guild Hall draws Coal every lap. No hero needed.', { x: -0.4, y: 0.74 }, ['wishing_well'], ranks([
            [1, oak(10), [], [{ itemId: 'item_coal', quantity: 5 }]]
        ]), 'left')
    ];
    return {
        constellations: {
            qa_mining: { id: 'qa_mining', name: 'Mining', label: { x: 1.0, y: -0.62 }, skill: 'mining' },
            qa_forestry: { id: 'qa_forestry', name: 'Forestry', label: { x: -0.85, y: -0.64 }, skill: 'forestry' }
        },
        stars: Object.fromEntries(stars.map(s => [s.id, s]))
    };
}

/** Put the fixture sky beside the authored one (the fixture wins an id they share), and redraw. */
export function installQaSky() {
    const authored = authoredHallSky();
    const qa = qaHallSky();
    const put = registerHallSky({
        constellations: { ...authored.constellations, ...qa.constellations },
        stars: { ...authored.stars, ...qa.stars }
    });
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
    return { constellations: put.constellations.length, stars: put.stars.length };
}

/** Enough in the Bank to buy every fixture rank twice over. */
export function stockForQaSky() {
    InventoryManager.addItem('item_copper_ore', 600);
    InventoryManager.addItem('item_oak_wood', 600);
}

function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 300 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** What the scene laid, for the readout. */
let scene = null;

/**
 * The fixture sky, the Bank stocked for it, and right of the Hall a Copper Ore Vein with QA Hall
 * Miner (Mining 1, a Copper Pickaxe) sent to work it, and a Mining Camp below it. ⚠️ Changes the
 * game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, name?: string}}
 */
export function setUpHallScene() {
    if (!getTokenType(VEIN) || !getTokenType(MINING_CAMP)) return { ok: false, error: 'No Copper Ore Vein or Mining Camp in the content' };
    if (!getItem(PICKAXE)) return { ok: false, error: 'No Copper Pickaxe in the content' };
    installQaSky();
    stockForQaSky();
    const c = hallPoint();
    const vein = put(VEIN, { x: c.x + 330, y: c.y - 40 });
    const camp = put(MINING_CAMP, { x: c.x + 330, y: c.y + 200 });
    if (!vein || !camp) return { ok: false, error: 'No room right of the Guild Hall for the scene' };
    TileModifiers.rebuildAll();

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const miner = generateHero({ name: 'QA Hall Miner' });
    if (!HeroManager.addHero(miner)) return { ok: false, error: 'The roster would not take another hero' };
    InventoryManager.addItem(PICKAXE, 1);
    EquipmentManager.equipItem(miner.id, PICKAXE);
    InventoryManager.addItem('item_apple', 5);
    InventoryManager.addItem('item_blueberry', 5);
    qaOrder(miner.id, { x: vein.x, y: vein.y });
    scene = { vein: vein.id, camp: camp.id, miner: miner.id };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_hall_scene' });
    return { ok: true, name: miner.name };
}

/** The scene's miner, else the first hero. */
function sceneHero() {
    return (scene && HeroManager.getHero(scene.miner)) || (HeroManager.getAllHeroes() || [])[0] || null;
}

/**
 * Knock the scene's miner out, as a lost fight does: the wound's clock starts on the next tick at
 * the length the Infirmary's rank gives.
 */
export function woundSceneHero() {
    const hero = sceneHero();
    if (!hero) return { ok: false, error: 'No hero to wound' };
    hero.hp.current = 0;
    hero.woundedRemainingMs = null;
    HeroManager.setHeroStatus(hero.id, 'wounded');
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_hall_wound' });
    return { ok: true, name: hero.name, ms: woundTimeMs() };
}

/** Bring the Hall's Passive Production lap to its last second, so it pays now. */
export function payLapNow() {
    const hall = BoardState.tokens().find(t => isGuildHall(t));
    if (!hall) return { ok: false, error: 'No Guild Hall on the mat' };
    hall.clocks = hall.clocks && typeof hall.clocks === 'object' ? hall.clocks : {};
    hall.clocks.passiveMs = PassiveProduction.PASSIVE_PRODUCTION_MS - 1000;
    return { ok: true, lines: PassiveProduction.linesOf(hall) };
}

const secs = (ms) => `${Math.round(ms / 100) / 10} s`;

/**
 * What the stars do now, read from the engine: Mining XP and work time at the scene's vein, its
 * rest, the camp's reach, a wound's length, the Food cap, and what the Hall pays each lap.
 * @returns {string[]}
 */
export function hallReadout() {
    const out = [];
    const ranks = GameState.state?.progress?.guildUpgrades || {};
    const vein = scene && BoardState.getTokenById(scene.vein);
    if (vein) {
        const def = getTokenType(vein.typeId);
        const xp = def?.config?.xp ?? 0;
        const xpNow = TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.XP_BONUS, xp, 'mining');
        out.push(`Copper Ore Vein: ${xp} XP a cycle before the Hall, ${Math.round(xpNow * 100) / 100} now (Miner’s Lore ${ranks.qa_mining_xp || 0})`);
        const cycle = def?.config?.cycleTimeMs ?? 0;
        out.push(`Its cycle: ${secs(cycle)} authored, ${secs(TileModifiers.workTimeOf(vein.id, cycle, 'mining'))} now (Quick Picks ${ranks.qa_mining_speed || 0})`);
        out.push(`Its rest: ${secs(Respawn.respawnOf(def)?.afterMs ?? 0)} authored, ${secs(Respawn.restMsOf(vein))} now (Deep Veins ${ranks.qa_vein_rest || 0})`);
    }
    const camp = scene && BoardState.getTokenById(scene.camp);
    if (camp) {
        out.push(`Mining Camp reach: ${Camps.campOf(getTokenType(camp.typeId))?.reach} authored, ${Math.round(Camps.campOfInstance(camp)?.reach ?? 0)} now (Long Rails ${ranks.qa_mining_camp_reach || 0})`);
    }
    out.push(`A wound lasts ${secs(woundTimeMs())} (Infirmary ${ranks.qa_infirmary || 0})`);
    out.push(`Food a hero may carry: ${loadoutCapOf('food')} (Larder ${ranks.qa_food_slot || 0})`);
    const hall = BoardState.tokens().find(t => isGuildHall(t));
    if (hall) {
        const lines = PassiveProduction.linesOf(hall).map(l => `${l.quantity} ${getItem(l.itemId)?.name || l.itemId}`);
        out.push(`The Hall pays each lap: ${lines.join(', ') || 'nothing'}`);
    }
    return out;
}
