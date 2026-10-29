// QA scenes for camps (brief 260 O2). DEV BUILDS ONLY: `CampsDevSection` is rendered behind
// `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as Camps from '../../systems/board/Camps.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * The four camps of the change pack (`token_logging_camp` and the rest), as QA test types: the same
 * skill, reach and placeholder art, under `qa_` ids so a save never holds a type the content lacks.
 * Gone on reload.
 */
export const QA_CAMPS = Object.freeze([
    { id: 'qa_camp_logging', name: 'QA Logging Camp', sprite: 't_sawmill', skill: 'forestry', reach: 360 },
    { id: 'qa_camp_mining', name: 'QA Mining Camp', sprite: 't_mineshaft_iron', skill: 'mining', reach: 280 },
    { id: 'qa_camp_fishing', name: 'QA Fishing Hut', sprite: 't_market_fish', skill: 'fishing', reach: 280 },
    { id: 'qa_camp_farmstead', name: 'QA Farmstead', sprite: 't_windmill', skill: 'farming', reach: 320 }
]);

/** What each camp's scene lays in its reach (shipped Tokens), and the tool its hero holds. */
const SCENE = Object.freeze({
    qa_camp_logging: { work: ['token_oak_tree', 'token_oak_tree', 'token_oak_tree'], tool: 'item_copper_woodaxe', heroes: 2 },
    qa_camp_mining: { work: ['token_copper_ore_vein', 'token_copper_ore_vein'], tool: 'item_copper_pickaxe', heroes: 1 },
    qa_camp_fishing: { work: ['token_river'], tool: 'item_fishing_rod', heroes: 1 },
    qa_camp_farmstead: { work: ['token_wild_wheat_patch', 'token_wild_wheat_patch'], tool: 'item_copper_sickle', heroes: 1 }
});

/**
 * Where each camp stands, from the Hall: left and right above it, the Fishing Hut straight above
 * it, the Farmstead on the open ground below it: clear of the Starter Camp's mine and of its Goblin
 * Camp's watch, so no goblin interrupts the look.
 */
const OFFSETS = Object.freeze({
    qa_camp_logging: { x: -600, y: -250 },
    qa_camp_mining: { x: 600, y: -250 },
    qa_camp_fishing: { x: 0, y: -320 },
    qa_camp_farmstead: { x: 120, y: 300 }
});

/** Where a camp's work stands round it, in mat units: inside every camp's reach. */
const AROUND = Object.freeze([{ x: -170, y: 40 }, { x: 170, y: 40 }, { x: 0, y: 190 }]);

const GOBLIN_CAMP = 'token_goblin_camp';

function registerCampTypes() {
    const defs = {};
    for (const c of QA_CAMPS) {
        defs[c.id] = {
            id: c.id, name: c.name, tokenType: 'camp', rarity: 'common', theme: 'fixture', sprite: c.sprite,
            size: 1, uses: null, requiresHero: false, config: null, camp: { skill: c.skill, reach: c.reach }
        };
    }
    registerTokenTypes(defs);
}

function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

/** A Token of `typeId` at the free spot nearest `point` (within `reach`), or null. */
function put(typeId, point, reach = 200) {
    const at = MatPlacement.findSpot(typeId, point, { reach }) || null;
    if (!at) return null;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** A new hero with `skills` at their levels holding `tool` (added to the Bank first); the roster grows to take them. */
function qaHero(name, skills, tool = null) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { ...(hero.skills?.[id] || {}), level, xp: xpForLevel(level) };
    if (!HeroManager.addHero(hero)) return null;
    if (tool && getItem(tool)) {
        if (!InventoryManager.hasItem(tool, 1)) InventoryManager.addItem(tool, 1);
        EquipmentManager.equipItem(hero.id, tool);
    }
    return hero;
}

/** A Fighter with every skill at `level`, on the roster. */
function qaFighter(name, level) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ jobId: 'fighter', spriteId: 'fighter', name });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    hero.name = name;
    return HeroManager.addHero(hero) ? hero : null;
}

/** The QA camps on the mat, by type id. */
function campsOnMat() {
    const out = new Map();
    for (const t of BoardState.tokens()) if (SCENE[t.typeId] && !out.has(t.typeId)) out.set(t.typeId, t);
    return out;
}

/**
 * The four camps round the Guild Hall, each with Tokens of its skill in its reach (three Oak Trees,
 * two Copper Ore Veins, a River, two ripe Wild Wheat Patches) and its heroes, tools in hand, waiting
 * at the Hall (two woodcutters, a miner, a fisher, a farmer). Drag a hero onto a camp, or use Send
 * them. A camp already on the mat is not laid twice.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ ok: boolean, error?: string, placed?: string[], short?: string[] }}
 */
export function placeCamps() {
    registerCampTypes();
    const c = hallPoint();
    const there = campsOnMat();
    const placed = [];
    const short = [];
    for (const def of QA_CAMPS) {
        if (there.has(def.id)) continue;
        const camp = put(def.id, { x: c.x + OFFSETS[def.id].x, y: c.y + OFFSETS[def.id].y }, 320);
        if (!camp) { short.push(def.name); continue; }
        placed.push(def.name);
        SCENE[def.id].work.forEach((typeId, i) => {
            if (!getTokenType(typeId)) return;
            const at = AROUND[i % AROUND.length];
            const t = put(typeId, { x: camp.x + at.x, y: camp.y + at.y }, 120);
            if (!t || !Camps.isCampWork(camp, t)) short.push(`${getTokenType(typeId)?.name || typeId} by ${def.name}`);
        });
        const skill = { [def.skill]: 10 };
        for (let i = 0; i < SCENE[def.id].heroes; i++) {
            if (!qaHero(`QA ${def.name.replace('QA ', '')} hand ${i + 1}`, skill, SCENE[def.id].tool)) {
                return { ok: false, error: 'The roster would not take another hero', placed, short };
            }
        }
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_camps' });
    return { ok: true, placed, short };
}

/**
 * Every QA camp hand still at the Hall sent to their camp, as a drop on it does (`Orders.orderAt`).
 * @returns {{ ok: boolean, sent: number, error?: string }}
 */
export function sendCampHands() {
    const camps = campsOnMat();
    if (!camps.size) return { ok: false, sent: 0, error: 'Place the camps first' };
    let sent = 0;
    for (const hero of GameState.state?.heroes || []) {
        if (BoardState.flagOf(hero.id)) continue;
        const def = QA_CAMPS.find(d => hero.name?.startsWith(`QA ${d.name.replace('QA ', '')} hand`));
        const camp = def ? camps.get(def.id) : null;
        if (camp && Orders.orderAt(hero.id, { x: camp.x, y: camp.y }).success) sent++;
    }
    return { ok: true, sent };
}

/**
 * A QA Hunter (a Fighter at 90 with an Iron Sword, Steak to eat) sent to a Goblin Camp: the one already on the mat nearest the
 * Hall (a new game's Starter Camp has one), else one placed above the Hall with a goblin standing.
 * They fight what it spawned, one at a time, wait for its next goblin, and fight that one too.
 * ⚠️ Using the camp already there matters: Goblin Camps share one cap across the mat (3 goblins a
 * camp), so a second camp's goblins can fill it and keep this one from spawning.
 * ⚠️ Changes the game.
 * @returns {{ ok: boolean, error?: string, name?: string, placed?: boolean }}
 */
export function huntAtGoblinCamp() {
    if (!getTokenType(GOBLIN_CAMP)) return { ok: false, error: 'No Goblin Camp in the content' };
    const c = hallPoint();
    const there = BoardState.tokens().filter(t => t.typeId === GOBLIN_CAMP)
        .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    const camp = there || put(GOBLIN_CAMP, { x: c.x - 120, y: c.y - 330 }, 320);
    if (!camp) return { ok: false, error: 'No room above the Guild Hall for a Goblin Camp' };
    if (!BoardState.tokens().some(t => t.tether === camp.id)) SpawnerSystem.attemptSpawn(camp, getTokenType(GOBLIN_CAMP));
    // Strong enough to beat a goblin well inside the camp's 30 s, so the wait for the next shows.
    const hunter = qaFighter('QA Hunter', 90);
    if (!hunter) return { ok: false, error: 'The roster would not take another hero' };
    const sword = getItem('item_iron_sword') ? 'item_iron_sword' : 'item_copper_sword';
    for (const [itemId, n] of [[sword, 1], ['item_steak', 20]]) {
        if (!getItem(itemId)) continue;
        InventoryManager.addItem(itemId, n);
        EquipmentManager.equipItem(hunter.id, itemId);
    }
    const r = Orders.orderAt(hunter.id, { x: camp.x, y: camp.y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_camps' });
    return r.success ? { ok: true, name: hunter.name, placed: !there } : { ok: false, error: r.reason };
}
