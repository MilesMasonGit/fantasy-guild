// QA scenes for hero orders (brief 260 O1). DEV BUILDS ONLY: `OrdersDevSection` is rendered behind
// `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
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
import { TUTORIAL_QUESTS } from '../../systems/quests/tutorialQuests.js';
import * as QuestTokens from '../../systems/quests/QuestTokens.js';

/** The QA Tokens these scenes lay: test types, gone on reload. */
export const QA_ORDER_TYPES = Object.freeze({
    OAK: 'qa_orders_oak',
    BUSH: 'qa_orders_bush'
});

const GOBLIN_CAMP = 'token_goblin_camp';
const FOOD = 'item_steak';
const OAK_WOOD = 'item_oak_wood';

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

const ALERT_TYPES = Object.freeze({
    AXE_OAK: 'qa_alerts_axe_oak',
    ANVIL: 'qa_alerts_anvil',
    BERRY: 'qa_alerts_berry'
});

/**
 * One hero for each thing the hero bar's alerts tell apart, all on test Tokens around the Hall:
 * QA Worker (none), QA No Axe (yellow: their tool is gone), QA No Wood (yellow: ingredients), QA
 * Waiter (none: a bush that comes back in ten minutes), QA No Job (yellow: no order), QA Hurt (red).
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpHeroAlertsScene() {
    registerQaTypes();
    const quick = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 500, xp: 1, inputs: [],
        outputs: [{ itemId: OAK_WOOD, chance: 100, minQty: 1, maxQty: 1 }] };
    const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', requiresHero: true, uses: null, config: quick, ...extra });
    registerTokenTypes({
        [ALERT_TYPES.AXE_OAK]: plain(ALERT_TYPES.AXE_OAK, 'QA Axe Oak'),
        [ALERT_TYPES.ANVIL]: plain(ALERT_TYPES.ANVIL, 'QA Hungry Anvil', { config: { ...quick, inputs: [{ itemId: OAK_WOOD, quantity: 999999 }] } }),
        [ALERT_TYPES.BERRY]: plain(ALERT_TYPES.BERRY, 'QA Slow Bush', { uses: 1, staysPut: true, respawn: { mode: 'refill', afterMs: 600000 } })
    });
    const c = hallPoint();
    const oak = put(QA_ORDER_TYPES.OAK, { x: c.x - 360, y: c.y + 200 });
    const axeOak = put(ALERT_TYPES.AXE_OAK, { x: c.x - 180, y: c.y + 260 });
    const anvil = put(ALERT_TYPES.ANVIL, { x: c.x + 180, y: c.y + 260 });
    const berry = put(ALERT_TYPES.BERRY, { x: c.x + 360, y: c.y + 200 });
    if (!oak || !axeOak || !anvil || !berry) return { ok: false, error: 'No room around the Guild Hall for the scene' };

    const hire = (name) => qaHero(name, { forestry: 30 });
    const [worker, noAxe, noWood, waiter, , hurt] = ['QA Worker', 'QA No Axe', 'QA No Wood', 'QA Waiter', 'QA No Job', 'QA Hurt'].map(hire);
    if (!worker || !noAxe || !noWood || !waiter || !hurt) return { ok: false, error: 'The roster would not take the heroes' };
    Flags.orderToken(worker.id, oak);
    // An order is refused without the tool, so the Token only asks for one once they hold the
    // order: as if their axe had just broken.
    Flags.orderToken(noAxe.id, axeOak);
    registerTokenTypes({
        [ALERT_TYPES.AXE_OAK]: plain(ALERT_TYPES.AXE_OAK, 'QA Axe Oak', { needsTool: { kind: 'woodaxe', minTier: 1 } })
    });
    Flags.orderToken(noWood.id, anvil);
    Flags.orderToken(waiter.id, berry);
    HeroManager.getHero(hurt.id).hp.current = 0;
    BoardCombat.resolveStatusDefeat(hurt.id);
    Flags.markDirty();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_alerts_scene' });
    return { ok: true };
}

/** The scene for the drag hints: real Tokens, and heroes holding each kind of tool and weapon. */
const HINT_TOKENS = Object.freeze([
    ['token_silver_ore_vein', -420, -220], ['token_mythril_ore_vein', -220, -300], ['token_oak_tree', 0, -320],
    ['token_redberry_bush', 220, -300], ['token_coast', 420, -220], ['token_goblin', 460, 120]
]);
const HINT_HEROES = Object.freeze([
    { name: 'QA Copper Miner', skills: { mining: 40 }, gear: ['item_copper_pickaxe'] },
    { name: 'QA Iron Miner', skills: { mining: 60 }, gear: ['item_iron_pickaxe', 'item_copper_sword'] },
    { name: 'QA Forester', skills: { forestry: 30 }, gear: ['item_copper_woodaxe', 'item_fishing_rod'] },
    { name: 'QA Greatsword', skills: { melee: 30 }, gear: ['item_copper_greatsword'] },
    { name: 'QA Bare Hands', skills: {}, gear: [] }
]);

/**
 * Drag hints (brief 490): above the Hall, a Silver Vein (an Iron Pickaxe or better, Mining 30), a
 * Mythril Vein (Mining 60), an Oak Tree, a Redberry Bush (no tool) and the Coast (water); a Goblin to
 * the right. Five QA heroes: a Copper Miner (Mining 40, copper pickaxe: the silver vein's tool is
 * red), an Iron Miner (Mining 60, iron pickaxe and a sword), a Forester (woodaxe and fishing rod), a
 * Greatsword (a two-handed weapon) and Bare Hands. Drag any of them over each Token.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpDragHintsScene() {
    const c = hallPoint();
    for (const [typeId, dx, dy] of HINT_TOKENS) {
        if (getTokenType(typeId)) put(typeId, { x: c.x + dx, y: c.y + dy });
    }
    for (const { name, skills, gear } of HINT_HEROES) {
        const hero = qaHero(name, skills);
        if (!hero) return { ok: false, error: 'The roster would not take the heroes' };
        for (const itemId of gear) {
            if (!getItem(itemId)) continue;
            InventoryManager.addItem(itemId, 1);
            EquipmentManager.equipItem(hero.id, itemId);
        }
    }
    Flags.markDirty();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_drag_hints_scene' });
    return { ok: true };
}

/** A level-up bubble on the first hero the alerts scene would show working, else the first hero. */
export function levelUpAHero() {
    const heroes = GameState.state?.heroes || [];
    const hero = heroes.find(h => h.name === 'QA Worker') || heroes[0];
    if (!hero) return { ok: false, error: 'No hero' };
    qaLevelUps += 1;
    EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: hero.id, heroName: hero.name, skillId: 'forestry', skillName: QA_LEVEL_SKILLS[qaLevelUps % QA_LEVEL_SKILLS.length], oldLevel: qaLevelUps, newLevel: qaLevelUps + 1 });
    return { ok: true, name: hero.name };
}
const QA_LEVEL_SKILLS = Object.freeze(['Forestry', 'Mining', 'Fishing', 'Cooking']);
let qaLevelUps = 0;

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

/** The tutorial steps the QA panel can jump to: the two hero orders changed (brief 260 O3). */
export const TUTORIAL_JUMPS = Object.freeze({ tree: 'cart_flag', camp: 'cart_camp' });

const WOODAXE = 'item_copper_woodaxe';

/**
 * Jump the tutorial to `stepId`: every earlier step counted as claimed, the step on the mat now. The
 * first hero is recruited if there is none, and holds the Woodaxe (the step before the tree asks for
 * it); the camp step also puts 60 Oak Wood in the Bank (a Wood Foundation and a Logging Camp).
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, title?: string}}
 */
export function jumpTutorialTo(stepId) {
    const index = TUTORIAL_QUESTS.findIndex(t => t.id === stepId);
    const q = GameState.state?.quests;
    if (index < 0 || !q) return { ok: false, error: 'No such tutorial step, or no game' };
    if (!(HeroManager.getAllHeroes() || []).length && !GuildUpgradeManager.purchase('roster_size')?.success) {
        return { ok: false, error: 'Could not recruit the first hero' };
    }
    const hero = (GameState.state.heroes || [])[0];
    if (getItem(WOODAXE) && !(hero.equipment || []).includes(WOODAXE)) {
        if (!InventoryManager.hasItem(WOODAXE, 1)) InventoryManager.addItem(WOODAXE, 1);
        EquipmentManager.equipItem(hero.id, WOODAXE);
    }
    if (stepId === TUTORIAL_JUMPS.camp) InventoryManager.addItem(OAK_WOOD, 60);
    for (const token of QuestTokens.tutorialTokens()) {
        BoardState.removeToken(token.id);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: token.id, x: token.x, y: token.y, typeId: null });
    }
    q.active = (q.active || []).filter(a => !a?.isTutorial);
    q.completedTutorials = TUTORIAL_QUESTS.slice(0, index).map(t => t.id);
    QuestTokens.ensure();
    EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, {});
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_tutorial_jump' });
    return { ok: true, title: TUTORIAL_QUESTS[index].title };
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
