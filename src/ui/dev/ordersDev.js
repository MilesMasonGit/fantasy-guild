// QA scenes for hero orders (brief 260 O1). DEV BUILDS ONLY: `OrdersDevSection` is rendered behind
// `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { getBackupKey } from '../../systems/core/SaveSlotHelper.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as BoardCombat from '../../systems/board/BoardCombat.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as Flags from '../../systems/board/Flags.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { WoundedSystem } from '../../systems/combat/WoundedSystem.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/** The QA Tokens these scenes lay: test types, gone on reload. */
export const QA_ORDER_TYPES = Object.freeze({
    OAK: 'qa_orders_oak',
    BUSH: 'qa_orders_bush'
});

const GOBLIN_CAMP = 'token_goblin_camp';
const FOOD = 'item_steak';

function registerQaTypes() {
    const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', ...extra });
    registerTokenTypes({
        [QA_ORDER_TYPES.OAK]: plain(QA_ORDER_TYPES.OAK, 'QA Old Oak', {
            uses: null, requiresHero: true,
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [],
                outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
        }),
        [QA_ORDER_TYPES.BUSH]: plain(QA_ORDER_TYPES.BUSH, 'QA Berry Bush', {
            uses: 3, requiresHero: true,
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
                outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
        })
    });
}

/** The Hall's point, or the mat's middle. */
function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

/** A Token of `typeId` at the free spot nearest `point`, or null. */
function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 400 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** A new hero for a scene, with `skills` at their levels; the roster grows to take them. */
function qaHero(name, skills) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { ...(hero.skills?.[id] || {}), level, xp: xpForLevel(level) };
    return HeroManager.addHero(hero) ? hero : null;
}

/**
 * Left of the Hall: a Goblin Camp with a goblin standing, a QA Old Oak beside it (inside the camp's
 * watch, never used up); clear of every camp, a QA Berry Bush (three charges, nothing comes back). A
 * QA Fighter (Forestry and Melee 30, Steak to eat) waits at the Hall. Drag them onto the Old Oak:
 * the goblin attacks, they fight back and go back to chopping. Onto the Bush: three cycles, then it
 * is gone and they need a job.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpOrdersScene() {
    if (!getTokenType(GOBLIN_CAMP)) return { ok: false, error: 'No Goblin Camp in the content' };
    registerQaTypes();
    const c = hallPoint();
    const camp = put(GOBLIN_CAMP, { x: c.x - 520, y: c.y - 200 });
    const oak = camp ? put(QA_ORDER_TYPES.OAK, { x: camp.x + 160, y: camp.y }) : null;
    // The Bush well clear of every goblin camp, so nothing ambushes whoever is sent to it.
    const camps = BoardState.tokens().filter(t => t.typeId === GOBLIN_CAMP);
    const clear = [{ x: c.x + 360, y: c.y + 260 }, { x: c.x, y: c.y - 300 }, { x: c.x + 420, y: c.y - 260 }, { x: c.x - 360, y: c.y + 220 }]
        .find(p => camps.every(k => Math.hypot(k.x - p.x, k.y - p.y) > 420));
    const bush = put(QA_ORDER_TYPES.BUSH, clear || { x: c.x + 360, y: c.y + 260 });
    if (!camp || !oak || !bush) return { ok: false, error: 'No room left of the Guild Hall for the scene' };
    SpawnerSystem.attemptSpawn(camp, getTokenType(GOBLIN_CAMP));

    const fighter = qaHero('QA Fighter', { forestry: 30, melee: 30 });
    if (!fighter) return { ok: false, error: 'The roster would not take another hero' };
    if (getItem(FOOD)) {
        InventoryManager.addItem(FOOD, 20);
        EquipmentManager.equipItem(fighter.id, FOOD);
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_orders_scene' });
    return { ok: true };
}

/** The first hero with an order, else the first on the roster. */
function someHero() {
    const heroes = GameState.state?.heroes || [];
    return heroes.find(h => BoardState.flagOf(h.id) && h.status !== 'wounded') || heroes.find(h => h.status !== 'wounded') || null;
}

/**
 * Knock a hero out, as a fight lost does (the one way of dying, `BoardCombat.resolveStatusDefeat`):
 * their order cleared, they limp home and heal, then wait at the Hall. Gear and food are lost as
 * in any defeat.
 */
export function knockOutAHero() {
    const hero = someHero();
    if (!hero) return { ok: false, error: 'No hero to knock out' };
    HeroManager.getHero(hero.id).hp.current = 0;
    BoardCombat.resolveStatusDefeat(hero.id);
    return { ok: true, name: hero.name };
}

/** Every healing hero healed now, as their wound time running out does. */
export function healEveryone() {
    const healing = (GameState.state?.heroes || []).filter(h => h.status === 'wounded');
    for (const h of healing) WoundedSystem.recoverHero(h.id);
    return { ok: true, count: healing.length };
}

/**
 * An old save, made from this game as `main` saved it before hero orders: the first hero's flag
 * pinned to a QA Old Oak, the second's an area flag beside another (an Old Oak in its reach), Work
 * Permissions on the first, and the board unmarked. Written to this slot (the save before it kept
 * as the slot's backup) and loaded: the pinned hero comes back working their Oak; the area hero
 * idles where their flag stood and works nothing; nobody has rules.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function loadOldFlagsSave() {
    const slot = SaveManager.currentSlot;
    if (slot == null) return { ok: false, error: 'Start or load a game in a slot first' };
    registerQaTypes();
    const heroes = GameState.state.heroes || [];
    while (heroes.length < 2) {
        if (!qaHero(`QA Woodcutter ${heroes.length + 1}`, { forestry: 10 })) return { ok: false, error: 'The roster would not take two heroes' };
    }
    const [pinned, area] = GameState.state.heroes;
    const c = hallPoint();
    const a = put(QA_ORDER_TYPES.OAK, { x: c.x + 360, y: c.y - 200 });
    const b = put(QA_ORDER_TYPES.OAK, { x: c.x + 360, y: c.y + 220 });
    if (!a || !b) return { ok: false, error: 'No room right of the Guild Hall for two Old Oaks' };

    // Keep the game as it stands as the slot's backup.
    SaveManager.save(false);
    const before = localStorage.getItem(SaveManager.getSlotKey(slot));
    if (before) localStorage.setItem(getBackupKey(slot), before);
    // A copy of the save, written as main wrote it: the live board is never touched here.
    const data = JSON.parse(GameState.serializeJson());
    const saved = data.state || data;
    const savedBoard = saved.board;
    savedBoard.flags = {
        [pinned.id]: { x: a.x, y: a.y, plantedAt: 0, pinnedTo: a.id },
        [area.id]: { x: b.x + 60, y: b.y + 90, plantedAt: 1 }
    };
    savedBoard.nextFlagOrder = 2;
    savedBoard.workClaims = {};
    delete savedBoard.orders;
    const record = saved.heroes.find(h => h.id === pinned.id);
    record.flagRules = { combat: { allowed: false, priority: 3 }, forestry: { allowed: true, priority: 1 } };
    localStorage.setItem(SaveManager.getSlotKey(slot), JSON.stringify(data));

    const loaded = await SaveManager.loadSlot(slot, { catchUp: false });
    if (!loaded) return { ok: false, error: 'The old save would not load' };
    return { ok: true, pinned: pinned.name, area: area.name, flags: Flags.statusOf(area.id).order };
}
