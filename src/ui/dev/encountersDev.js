// the QA panel's encounters check: a guarded vein, an ambush node, a boss lair and a summon, with heroes flagged
// ⚠️ DEV BUILDS ONLY: reached from `EncountersDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as Guardians from '../../systems/board/Guardians.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerItems } from '../../config/registries/itemRegistry.js';
import { SUMMON_SHOP_SECTION } from '../../config/registries/tokenConstants.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test content for the encounters, made in memory for this check only (never written to `data/`,
 * gone on reload: press the button again after a reload, on an empty slot). Existing sprites only.
 */
export const QA_ENCOUNTER_TYPES = Object.freeze({
    guardian: 'qa_enc_vein_guardian',
    vein: 'qa_enc_rich_vein',
    ambusher: 'qa_enc_ambusher',
    ambushNode: 'qa_enc_ambush_vein',
    boss: 'qa_enc_warlord',
    lair: 'qa_enc_lair',
    summoned: 'qa_enc_called_chief'
});
export const QA_SUMMON_ITEM = 'qa_enc_summon_horn';

const drops = (itemId) => [{ itemId, chance: 100, minQty: 1, maxQty: 2 }];
const enemyConfig = (itemId) => ({ skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: drops(itemId) });
const mining = { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] };

function registerQaEncounters() {
    registerItems({
        [QA_SUMMON_ITEM]: { id: QA_SUMMON_ITEM, name: 'Summoning Horn', type: 'material', stackable: true, sprite: 'i_bones' }
    });
    const T = QA_ENCOUNTER_TYPES;
    registerTokenTypes({
        [T.guardian]: {
            id: T.guardian, name: 'Vein Guardian', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 1,
            sprite: 'e_elemental_thorn', enemy: { level: 3, style: 'melee' }, config: enemyConfig('item_copper_ore')
        },
        // Guarded: nobody mines it until its guardian is beaten; back 30 s after (short, to watch).
        [T.vein]: {
            id: T.vein, name: 'Rich Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_copper', config: mining, guardian: { typeId: T.guardian, returnMs: 30000 }
        },
        [T.ambusher]: {
            id: T.ambusher, name: 'Vein Goblin', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 1,
            sprite: 'e_goblin', enemy: { level: 1, style: 'melee' }, config: enemyConfig('item_bones')
        },
        // An ambush rule, at 20% a cycle so it shows within a minute (content would use about 5%).
        [T.ambushNode]: {
            id: T.ambushNode, name: 'Goblin-haunted Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_iron', config: mining,
            statements: [{
                ...makeStatement(KEYWORD.SPAWNS),
                id: 'stm_qa_enc_ambush',
                payload: { typeId: T.ambusher, placement: PLACEMENT.NEAREST_FREE, chance: 20 },
                when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 },
                chargeDelta: 0
            }]
        },
        [T.boss]: {
            id: T.boss, name: 'Goblin Warlord', tokenType: 'enemy', rarity: 'rare', theme: 'qa', uses: 1,
            sprite: 'e_goblin_chief', enemy: { level: 5, style: 'melee', boss: true }, config: enemyConfig('item_copper_ingot')
        },
        // A lair: no work of its own; its boss comes back on the boss default (2 minutes).
        [T.lair]: {
            id: T.lair, name: 'Warlord’s Den', tokenType: 'resource', rarity: 'rare', theme: 'qa', uses: null,
            sprite: 't_mineshaft_copper', guardian: { typeId: T.boss }
        },
        // Summoned: sold in the Shop's Summons section for one Summoning Horn.
        [T.summoned]: {
            id: T.summoned, name: 'Horn-called Chief', tokenType: 'enemy', rarity: 'rare', theme: 'qa', uses: 1,
            sprite: 'e_goblin_chief', enemy: { level: 4, style: 'melee', boss: true }, config: enemyConfig('item_bones'),
            shop: { price: [{ itemId: QA_SUMMON_ITEM, quantity: 1 }], section: SUMMON_SHOP_SECTION }
        }
    });
}

/** A promoted Fighter at `level`, full health, nothing equipped. */
function fighterAt(level, name) {
    const hero = generateHero({ jobId: 'fighter', spriteId: 'fighter', ...(name ? { name } : {}) });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    return hero;
}

/**
 * Below the Guild Hall, left to right: a Rich Copper Vein with its Vein Guardian, a Goblin-haunted
 * Vein, and the Warlord's Den with its boss; four new Fighters (level 30) flagged at them:
 * - "Guard-breaker", flag by the vein: fights the guardian first, then mines the vein; the guardian
 *   is back 30 s after it falls, and the vein is blocked again;
 * - "Miner", pinned to the haunted vein: about one cycle in five a Vein Goblin jumps out and attacks
 *   them; they fight it and go back to mining;
 * - "Boss-hunter", pinned to the Warlord: fights it; the Warlord is back 2 minutes after it falls;
 * - "Second in line", pinned to the Warlord too: every fight is one-on-one, so they wait beside it
 *   ("Waiting for Goblin Warlord") until the first lets go.
 * Two Summoning Horns go in the Bank: Shop → Summons → drag the Horn-called Chief onto the mat.
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
    const vein = put(T.vein, -420, 260);
    const haunted = put(T.ambushNode, 0, 300);
    const lair = put(T.lair, 420, 260);
    if (!vein || !haunted || !lair) return { ok: false, error: 'No room below the Guild Hall for three Tokens' };

    // The guardian and the boss stand at once (the engine would bring them on the next tick), so
    // the flags below find them.
    if (!Guardians.bringBack(vein, getTokenType(vein.typeId)) || !Guardians.bringBack(lair, getTokenType(lair.typeId))) {
        return { ok: false, error: 'No room beside the vein or the den' };
    }
    const boss = Guardians.standingGuardianOf(lair);

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 4);
    GuildUpgradeManager.recompute();
    InventoryManager.addItem(QA_SUMMON_ITEM, 2);

    const flagged = [
        { name: 'Guard-breaker', at: { x: vein.x - 60, y: vein.y + 40 } },
        { name: 'Miner', at: { x: haunted.x, y: haunted.y }, pin: true },
        { name: 'Boss-hunter', at: { x: boss.x, y: boss.y }, pin: true },
        { name: 'Second in line', at: { x: boss.x, y: boss.y }, pin: true }
    ];
    for (const f of flagged) {
        const hero = fighterAt(30, f.name);
        if (!HeroManager.addHero(hero)) return { ok: false, error: 'The roster is full' };
        Placement.plantFlagAt(hero.id, f.at, { pin: !!f.pin });
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_encounters_scene' });
    return { ok: true };
}
