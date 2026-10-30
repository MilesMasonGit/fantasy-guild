// QA scenes for milestone perks. DEV BUILDS ONLY: `PerksDevSection` is rendered behind
// `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { EFFECTS, registerEffects } from '../../config/registries/effectRegistry.js';
import { perkRowsFor, registerSkillPerks } from '../../config/registries/perkRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';

const TREE = 'token_oak_tree';
const AXE = 'item_copper_woodaxe';
const SKILL = 'forestry';

/**
 * The example pack's Forestry perk (Clean Felling: a 5% chance of double loot on Forestry work) at
 * 10, and a QA one at 25 so the sheet has a next perk to name. Installed only while Forestry has no
 * authored perks; gone on reload.
 */
const STAND_INS = {
    effect_clean_felling: {
        id: 'effect_clean_felling', name: 'Clean Felling',
        statements: [{
            id: 'stm_k4_clean_felling', keyword: 'provides',
            payload: { type: 'LOOT_MULT', bucket: 'flat', value: 5, category: SKILL },
            chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
        }]
    },
    qa_effect_woodsmans_stride: {
        id: 'qa_effect_woodsmans_stride', name: 'QA Woodsman’s Stride',
        statements: [{
            id: 'stm_qa_woodsmans_stride', keyword: 'provides',
            payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05, category: SKILL },
            chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
        }]
    }
};

/** Forestry's perks: the authored ones, else the QA stand-ins. @returns {boolean} whether stand-ins were installed */
export function ensureForestryPerks() {
    if (perkRowsFor(SKILL).length) return false;
    registerEffects(Object.fromEntries(Object.entries(STAND_INS).filter(([id]) => !EFFECTS[id])));
    registerSkillPerks({ [SKILL]: { perks: [
        { level: 10, effectId: 'effect_clean_felling', scale: 1 },
        { level: 25, effectId: 'qa_effect_woodsmans_stride', scale: 1 }
    ] } });
    return true;
}

function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 300 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

function makeRoom(extra = 1) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + extra);
    GuildUpgradeManager.recompute();
}

/**
 * Right of the Hall, an Oak Tree, and QA Woodcutter (every skill at 1, Forestry 9 one XP short of
 * 10, a Copper Woodaxe in hand) sent to fell it: the first log lifts them to Forestry 10, and the level-up float and the hero
 * bar name the perk. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, name?: string, standIns?: boolean, perk?: string}}
 */
export function setUpForestryTen() {
    if (!getTokenType(TREE)) return { ok: false, error: 'No Oak Tree in the content' };
    if (!getItem(AXE)) return { ok: false, error: 'No Copper Woodaxe in the content' };
    const standIns = ensureForestryPerks();
    const c = hallPoint();
    const tree = put(TREE, { x: c.x + 360, y: c.y + 40 });
    if (!tree) return { ok: false, error: 'No room right of the Guild Hall for an Oak Tree' };

    makeRoom();
    const hero = generateHero({ name: 'QA Woodcutter' });
    hero.skills[SKILL] = { level: 9, xp: xpForLevel(10) - 1 };
    if (!HeroManager.addHero(hero)) return { ok: false, error: 'The roster would not take another hero' };
    InventoryManager.addItem(AXE, 1);
    EquipmentManager.equipItem(hero.id, AXE);
    qaOrder(hero.id, { x: tree.x, y: tree.y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_perks_scene' });
    const perk = EFFECTS[perkRowsFor(SKILL)[0]?.effectId]?.name || perkRowsFor(SKILL)[0]?.effectId;
    return { ok: true, name: hero.name, standIns, perk };
}

/**
 * Add QA Old Forester (Forestry 30) and save, then load this slot the way a player's load does: the
 * forester arrives holding every Forestry perk up to 30, read off their level, with no level-up
 * alert. The Forestry perks must be authored, or the QA stand-ins installed this page life.
 * @returns {Promise<{ok: boolean, error?: string, standIns?: boolean}>}
 */
export async function loadForesterAtThirty() {
    const slot = SaveManager.currentSlot;
    if (slot == null) return { ok: false, error: 'Start or load a game in a slot first' };
    const standIns = ensureForestryPerks();
    makeRoom();
    const hero = generateHero({ name: 'QA Old Forester' });
    hero.skills[SKILL] = { level: 30, xp: xpForLevel(30) };
    if (!HeroManager.addHero(hero)) return { ok: false, error: 'The roster would not take another hero' };
    SaveManager.save(false);
    const loaded = await SaveManager.loadSlot(slot, { catchUp: false });
    if (!loaded) return { ok: false, error: 'The save would not load' };
    return { ok: true, standIns, heroId: hero.id };
}
