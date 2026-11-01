// QA scenes for the Guild Hall's star machinery: a fixture sky with a constellation
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
import { qaHallSky, QA_VEIN, QA_MINING_CAMP } from './qaHallSky.js';
import { applyXpBonus } from '../../systems/hero/xpBonus.js';
import { isGuildHall } from '../../systems/board/MatCap.js';
import { qaOrder } from './qaOrders.js';

const VEIN = QA_VEIN;
const MINING_CAMP = QA_MINING_CAMP;
const PICKAXE = 'item_copper_pickaxe';

export { qaHallSky };

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
        const xpNow = applyXpBonus(xp, TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.XP_BONUS, xp, 'mining'));
        out.push(`Copper Ore Vein: ${xp} Mining XP a cycle before the Hall, ${xpNow} now (Miner’s Lore ${ranks.qa_mining_xp || 0})`);
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
