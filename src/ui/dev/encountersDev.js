// the QA panel's encounters check: a guardian's camp by a rich vein, a boss's den and a Summoning Circle, heroes flagged
// ⚠️ DEV BUILDS ONLY: reached from `EncountersDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerItems } from '../../config/registries/itemRegistry.js';
import { registerRecipePools } from '../../config/registries/recipePoolRegistry.js';
import * as StationRecipe from '../../systems/board/StationRecipe.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test content for the encounters, made in memory for this check only (never written to `data/`,
 * gone on reload: press the button again after a reload, on an empty slot). Existing sprites only.
 * Bosses and guardians come from camps of one (ordinary spawners), and a boss can also be called by
 * a Summoning Circle.
 */
export const QA_ENCOUNTER_TYPES = Object.freeze({
    guardian: 'qa_enc_vein_guardian',
    guardianCamp: 'qa_enc_guardian_camp',
    vein: 'qa_enc_rich_vein',
    boss: 'qa_enc_warlord',
    den: 'qa_enc_den',
    called: 'qa_enc_called_chief',
    circle: 'qa_enc_summoning_circle'
});
export const QA_SUMMON_ITEM = 'qa_enc_summon_horn';
export const QA_SUMMON_RECIPE = 'recipe_qa_enc_summon_chief';

const drops = (itemId) => [{ itemId, chance: 100, minQty: 1, maxQty: 2 }];
const enemyConfig = (itemId) => ({ skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: drops(itemId) });
const mining = { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] };
const campOfOne = (typeId, intervalMs) => ({ spawns: [{ typeId, weight: 1 }], allowance: 1, intervalMs, upkeep: [] });

function registerQaEncounters() {
    registerItems({
        [QA_SUMMON_ITEM]: { id: QA_SUMMON_ITEM, name: 'Summoning Horn', type: 'material', stackable: true, sprite: 'i_bones' }
    });
    const T = QA_ENCOUNTER_TYPES;
    registerTokenTypes({
        // A guardian: a tough enemy whose camp of one stands by a rich vein.
        [T.guardian]: {
            id: T.guardian, name: 'Vein Guardian', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 1,
            sprite: 'e_elemental_thorn', enemy: { level: 3, style: 'melee' }, config: enemyConfig('item_copper_ore')
        },
        [T.guardianCamp]: {
            id: T.guardianCamp, name: 'Guardian’s Hollow', tokenType: 'spawner', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_camp_goblin', spawner: campOfOne(T.guardian, 30000)
        },
        [T.vein]: {
            id: T.vein, name: 'Rich Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_copper', config: mining
        },
        [T.boss]: {
            id: T.boss, name: 'Goblin Warlord', tokenType: 'enemy', rarity: 'rare', theme: 'qa', uses: 1,
            sprite: 'e_goblin_chief', enemy: { level: 5, style: 'melee', boss: true }, config: enemyConfig('item_copper_ingot')
        },
        // A boss's den: a camp of one, every 60 s.
        [T.den]: {
            id: T.den, name: 'Warlord’s Den', tokenType: 'spawner', rarity: 'rare', theme: 'qa', uses: null,
            sprite: 't_mineshaft_copper', spawner: campOfOne(T.boss, 60000)
        },
        [T.called]: {
            id: T.called, name: 'Horn-called Chief', tokenType: 'enemy', rarity: 'rare', theme: 'qa', uses: 1,
            sprite: 'e_goblin_chief', enemy: { level: 4, style: 'melee', boss: true }, config: enemyConfig('item_bones')
        },
        // A Summoning Circle: a station that works as Alchemy (a Starting skill, so any hero may work
        // it) whose recipe uses up a Summoning Horn and calls the Chief beside it.
        [T.circle]: {
            id: T.circle, name: 'Summoning Circle', tokenType: 'station', rarity: 'rare', theme: 'qa', uses: null,
            sprite: 't_shrine_forest',
            config: { skill: 'alchemy', skillRequired: 1, cycleTimeMs: 8000, xp: 0, inputs: [], outputs: [] },
            statements: [{ id: 'stm_qa_enc_circle_station', keyword: 'station', payload: { skill: 'alchemy' } }]
        }
    });
    // ⚠️ A fixture pool takes over its skill (`registerRecipePools`): Alchemy ships no recipes today.
    registerRecipePools({
        alchemy: [{
            id: QA_SUMMON_RECIPE, name: 'Summon the Horn-called Chief', levelRequirement: 1, requiresContext: [],
            inputs: [{ itemId: QA_SUMMON_ITEM, quantity: 1 }],
            outputs: [{ tokenId: T.called, chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 8000, xp: 0
        }]
    });
}

/** A hero in the Fighter's art at `level` in every skill, full health, nothing equipped. */
function fighterAt(level, name) {
    const hero = generateHero({ spriteId: 'fighter', ...(name ? { name } : {}) });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    return hero;
}

/**
 * Around the Guild Hall: below it, left to right, the Guardian's Hollow beside a Rich Copper Vein,
 * and the Warlord's Den; above it, a Summoning Circle. Six new Fighters (level 30), flagged:
 * - "Guard-breaker", sent at the Vein Guardian: they beat it; its Hollow sends another every 30 s,
 *   and they fight that one too;
 * - "Miner", pinned to the rich vein beside the Hollow: they mine, and the guardian never attacks
 *   them (no enemy attacks first);
 * - "Boss-hunter", pinned to the Warlord: fights it; the Den sends another (every 60 s);
 * - "Second in line", pinned to the Warlord too: every fight is one-on-one, so they wait beside it
 *   ("Waiting for Goblin Warlord") until the first lets go;
 * - "Summoner", pinned to the Summoning Circle: uses up a Horn (two in the Bank) and calls a
 *   Horn-called Chief beside it; without Horns the circle waits;
 * - "Chief-hunter", flag beside the circle: fights the Chief it calls.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpEncountersScene() {
    registerQaEncounters();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const T = QA_ENCOUNTER_TYPES;
    const put = (typeId, dx, dy) => {
        const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        return Placement.placeTokenAt(inst, { x: c.x + dx, y: c.y + dy })?.success ? inst : null;
    };
    const hollow = put(T.guardianCamp, -560, 260);
    const vein = put(T.vein, -380, 260);
    const den = put(T.den, 360, 300);
    const circle = put(T.circle, 420, -260);
    if (!hollow || !vein || !den || !circle) return { ok: false, error: 'No room around the Guild Hall for four Tokens' };

    // The Hollow's guardian and the Den's boss stand at once (a camp's first comes after its
    // interval), so the flags below find them.
    if (!SpawnerSystem.attemptSpawn(hollow, getTokenType(hollow.typeId)) || !SpawnerSystem.attemptSpawn(den, getTokenType(den.typeId))) {
        return { ok: false, error: 'No room beside the Hollow or the Den' };
    }
    const boss = BoardState.tokens().find(t => t.typeId === T.boss);
    const guardian = BoardState.tokens().find(t => t.typeId === T.guardian);
    // The circle's one recipe, chosen (a station waits for the player to pick one).
    StationRecipe.setSelectedRecipe(circle, QA_SUMMON_RECIPE);

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 6);
    GuildUpgradeManager.recompute();
    InventoryManager.addItem(QA_SUMMON_ITEM, 2);

    const flagged = [
        { name: 'Guard-breaker', at: { x: guardian.x, y: guardian.y }, pin: true },
        { name: 'Miner', at: { x: vein.x, y: vein.y }, pin: true },
        { name: 'Boss-hunter', at: { x: boss.x, y: boss.y }, pin: true },
        { name: 'Second in line', at: { x: boss.x, y: boss.y }, pin: true },
        { name: 'Summoner', at: { x: circle.x, y: circle.y }, pin: true },
        { name: 'Chief-hunter', at: { x: circle.x + 180, y: circle.y + 40 } }
    ];
    for (const f of flagged) {
        const hero = fighterAt(30, f.name);
        if (!HeroManager.addHero(hero)) return { ok: false, error: 'The roster is full' };
        qaOrder(hero.id, f.at);
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_encounters_scene' });
    return { ok: true };
}
