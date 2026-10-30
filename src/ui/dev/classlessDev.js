// QA scenes for classless heroes (brief 270 K1). DEV BUILDS ONLY: `ClasslessDevSection` is rendered
// behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { getBackupKey } from '../../systems/core/SaveSlotHelper.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getItem, registerItems } from '../../config/registries/itemRegistry.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { STARTING_SKILL_IDS } from '../../config/registries/skillRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';

const GOBLIN = 'token_goblin';
const SWORD = 'item_copper_sword';
const BOW = 'item_copper_bow';
const FOOD = 'item_shrimp';

/** A test item: the shipped Iron Sword asking Melee 15. Gone on reload. */
export const QA_GATED_SWORD = 'qa_k1_iron_sword';

/** The Hall's point, or the mat's middle. */
function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

/** A Token of `typeId` at the free spot nearest `point`, or null. */
function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 300 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** Room on the roster for one more hero. */
function makeRoom() {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
}

/**
 * Right of the Hall, three Goblins in a row. A new hero, QA Novice (every skill at level 1), holds
 * the Copper Sword and Shrimp to eat, and is sent at the first Goblin; the Copper Bow waits in the
 * Bank for the second. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, name?: string}}
 */
export function setUpClasslessScene() {
    if (!getTokenType(GOBLIN)) return { ok: false, error: 'No Goblin in the content' };
    for (const id of [SWORD, BOW]) if (!getItem(id)) return { ok: false, error: `No ${id} in the content` };
    const c = hallPoint();
    const goblins = [0, 1, 2].map(i => put(GOBLIN, { x: c.x + 380 + i * 150, y: c.y + 40 }));
    if (goblins.some(g => !g)) return { ok: false, error: 'No room right of the Guild Hall for three Goblins' };

    makeRoom();
    const hero = generateHero({ name: 'QA Novice' });
    if (!HeroManager.addHero(hero)) return { ok: false, error: 'The roster would not take another hero' };
    InventoryManager.addItem(SWORD, 1);
    InventoryManager.addItem(BOW, 1);
    EquipmentManager.equipItem(hero.id, SWORD);
    if (getItem(FOOD)) {
        InventoryManager.addItem(FOOD, 20);
        EquipmentManager.equipItem(hero.id, FOOD);
    }
    qaOrder(hero.id, { x: goblins[0].x, y: goblins[0].y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_classless_scene' });
    return { ok: true, name: hero.name };
}

/**
 * One QA Iron Sword in the Bank: the shipped Iron Sword asking Melee 15, so a new hero dropping it
 * on themselves is refused with "Needs Melee 15". The item is a test one, gone on reload.
 * @returns {{ok: boolean, error?: string}}
 */
export function giveGatedIronSword() {
    const iron = getItem('item_iron_sword');
    if (!iron) return { ok: false, error: 'No Iron Sword in the content' };
    registerItems({
        [QA_GATED_SWORD]: { ...iron, id: QA_GATED_SWORD, name: 'QA Iron Sword', levelRequired: 15 }
    });
    InventoryManager.addItem(QA_GATED_SWORD, 1);
    return { ok: true };
}

/**
 * A hero record as the class rework saved one: a Knight with a job, class skills (Melee 25,
 * Fletching 18, and the cut Leadership 30 and Armory 9), and skills set aside at an earlier job
 * change (Magic 33, Enchanting 7, the cut Commerce 40); the Starting skills at 12.
 */
export function oldKnightRecord(id) {
    const at = (level, extra = 0) => ({ level, xp: xpForLevel(level) + extra });
    return {
        id, name: 'QA Old Knight', jobId: 'knight', classId: null, traitId: null,
        icon: 'hn_recruit_icon_por', spriteId: 'fighter',
        hp: { current: 35, max: 35 }, status: 'idle', woundedUntil: null, statuses: [], perks: {},
        equipment: Array(9).fill(null), assignedCardId: null, createdAt: 0,
        skills: {
            ...Object.fromEntries(STARTING_SKILL_IDS.map(s => [s, at(12)])),
            melee: at(25), fletching: at(18, 7), leadership: at(30), armory: at(9)
        },
        bankedSkills: { magic: at(33), enchanting: at(7), commerce: at(40) }
    };
}

/**
 * Write this slot as an older save holding QA Old Knight (the game as it stands kept as the slot's
 * backup), then load it the way a player's load does: the Knight arrives with every level kept,
 * Magic and Enchanting back from the bank, Leadership, Armory and Commerce gone, no job.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function loadOldKnightSave() {
    const slot = SaveManager.currentSlot;
    if (slot == null) return { ok: false, error: 'Start or load a game in a slot first' };
    SaveManager.save(false);
    const before = localStorage.getItem(SaveManager.getSlotKey(slot));
    if (before) localStorage.setItem(getBackupKey(slot), before);
    const data = JSON.parse(GameState.serializeJson());
    const saved = data.state || data;
    const id = `hero_qa_old_knight_${Date.now().toString(36)}`;
    saved.heroes = [...(saved.heroes || []), oldKnightRecord(id)];
    const ranks = saved.progress.guildUpgrades || (saved.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, saved.heroes.length);
    saved.progress.rosterLimit = Math.max(saved.progress.rosterLimit || 0, saved.heroes.length);
    localStorage.setItem(SaveManager.getSlotKey(slot), JSON.stringify(data));

    const loaded = await SaveManager.loadSlot(slot, { catchUp: false });
    if (!loaded) return { ok: false, error: 'The old save would not load' };
    return { ok: true, heroId: id };
}
