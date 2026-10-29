// the QA panel's combat screen check: two fights with elixirs and a status, an enemy nobody has fought, and time away
// ⚠️ DEV BUILDS ONLY: reached from `CombatScreenDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import * as CatchUp from '../../systems/core/CatchUp.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS, registerEffects } from '../../config/registries/effectRegistry.js';
import { VENOM_EFFECT_ID } from '../../config/registries/enemyKinds.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * The combat screen's scene, everything made in memory for this check only (never written to
 * `data/`, gone on reload). The content's own items where it has them (Copper Sword, Leather Chest,
 * the Valor and Ironskin elixirs, Shrimp, Poison), test stand-ins where it does not:
 * - **Aela**, a Melee 20 Fighter with the sword, the chest, both elixirs and Shrimp, pinned on a
 *   **Goblin Warlord** (level 20, Brute and Venomous: big hits every 4 s, each landing a stack of
 *   Poison), 40 health: a long duel with hits both ways, misses, crits, poison ticks and meals;
 * - **Bram**, a Melee 40 Fighter with both elixirs, pinned on a **Cow** (the one enemy with an
 *   animation sheet, so it moves in the panel's strip);
 * - a **Goblin Scout** (Swift) nobody has fought, standing alone: its card says "? fight one to learn".
 */
export const QA_ENEMIES = Object.freeze({ WARLORD: 'qa_c6_warlord', SCOUT: 'qa_c6_scout' });

const tick = (id) => ({
    ...makeStatement(KEYWORD.DEALS), id, when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF }, payload: { amount: 1, ignoresArmor: true }
});

/** The stand-ins the content lacks, and the two fixture enemies. */
function registerQaContent() {
    if (!EFFECTS[VENOM_EFFECT_ID]) {
        registerEffects({ [VENOM_EFFECT_ID]: { id: VENOM_EFFECT_ID, name: 'Poison', status: { stacks: 3, ticks: 0 }, statements: [tick('stm_qa_c6_poison')] } });
    }
    const provides = (type) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value: 1 }, to: null });
    const forTheFight = (effectId) => ({
        ...makeStatement(KEYWORD.APPLIES),
        when: { event: 'COMBAT_ENGAGED', scope: 'self' },
        target: { role: ROLE.ACTOR },
        payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
    });
    if (!getItem('item_elixir_of_valor') || !getItem('item_elixir_of_ironskin')) {
        registerEffects({
            qa_c6_fx_valor: { id: 'qa_c6_fx_valor', name: 'Valor', statements: [provides('DAMAGE')] },
            qa_c6_fx_ironskin: { id: 'qa_c6_fx_ironskin', name: 'Ironskin', statements: [provides('ARMOR')] },
            qa_c6_fx_elixir_valor: { id: 'qa_c6_fx_elixir_valor', name: 'Elixir of Valor', statements: [forTheFight('qa_c6_fx_valor')] },
            qa_c6_fx_elixir_ironskin: { id: 'qa_c6_fx_elixir_ironskin', name: 'Elixir of Ironskin', statements: [forTheFight('qa_c6_fx_ironskin')] }
        });
        const elixir = (id, name, effectId, sprite) => ({ id, name, type: 'potion', sprite, stackable: true, equipSlot: 'consumable', effects: [{ effectId }] });
        registerItems({
            item_elixir_of_valor: elixir('item_elixir_of_valor', 'Elixir of Valor', 'qa_c6_fx_elixir_valor', 'i_potion_sun_red'),
            item_elixir_of_ironskin: elixir('item_elixir_of_ironskin', 'Elixir of Ironskin', 'qa_c6_fx_elixir_ironskin', 'i_potion_hammer_grey')
        });
    }
    if (!getItem('item_copper_sword')) {
        registerItems({
            item_copper_sword: { id: 'item_copper_sword', name: 'Copper Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', styles: ['melee'], damage: 2 }
        });
    }
    const goblin = getTokenType('token_goblin');
    const chief = getTokenType('token_goblin_chief');
    const enemy = (id, name, sprite, enemyBlock, uses) => ({
        id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses, sprite, requiresHero: true,
        enemy: { style: 'melee', ...enemyBlock },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
    });
    registerTokenTypes({
        [QA_ENEMIES.WARLORD]: enemy(QA_ENEMIES.WARLORD, 'Goblin Warlord', chief?.sprite || goblin?.sprite || 's_crime', { level: 20, kinds: ['brute', 'venomous'] }, 50),
        [QA_ENEMIES.SCOUT]: enemy(QA_ENEMIES.SCOUT, 'Goblin Scout', goblin?.sprite || 's_crime', { level: 5, kinds: ['swift'] }, 5)
    });
}

/** A promoted Fighter at `level`, full health, named. */
function fighterAt(level, name) {
    const hero = generateHero({ jobId: 'fighter', spriteId: 'fighter' });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    if (name) hero.name = name;
    return hero;
}

/** Place a Token of `typeId` at a point beside the Guild Hall. */
function placeBesideHall(typeId, dx, dy) {
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const inst = BoardState.createTokenInstance(typeId, getTokenType(typeId)?.uses ?? null);
    return Placement.placeTokenAt(inst, { x: c.x + dx, y: c.y + dy })?.success ? inst : null;
}

/**
 * The scene: the Warlord below-left of the Guild Hall with Aela pinned on it, a Cow below-right
 * with Bram, and the Scout alone below the Hall. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpCombatScreenScene() {
    registerQaContent();
    const warlord = placeBesideHall(QA_ENEMIES.WARLORD, -300, 230);
    const cow = getTokenType('token_cow') ? placeBesideHall('token_cow', 320, 230) : null;
    const scout = placeBesideHall(QA_ENEMIES.SCOUT, 20, 330);
    if (!warlord || !scout) return { ok: false, error: 'No room below the Guild Hall for the scene' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 2);
    GuildUpgradeManager.recompute();

    InventoryManager.addItem('item_elixir_of_valor', 30);
    InventoryManager.addItem('item_elixir_of_ironskin', 30);
    InventoryManager.addItem('item_copper_sword', 2);
    if (getItem('item_leather_chest')) InventoryManager.addItem('item_leather_chest', 1);
    if (getItem('item_shrimp')) InventoryManager.addItem('item_shrimp', 40);

    const aela = fighterAt(20, 'Aela');
    if (HeroManager.addHero(aela)) {
        for (const id of ['item_copper_sword', 'item_leather_chest', 'item_elixir_of_valor', 'item_elixir_of_ironskin', 'item_shrimp']) {
            if (getItem(id)) EquipmentManager.equipItem(aela.id, id);
        }
        qaOrder(aela.id, { x: warlord.x, y: warlord.y });
    }
    if (cow) {
        const bram = fighterAt(40, 'Bram');
        if (HeroManager.addHero(bram)) {
            for (const id of ['item_copper_sword', 'item_elixir_of_valor', 'item_elixir_of_ironskin']) EquipmentManager.equipItem(bram.id, id);
            qaOrder(bram.id, { x: cow.x, y: cow.y });
        }
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_combat_screen_scene' });
    return { ok: true };
}

/** How long "time away" plays. */
export const AWAY_MS = 20 * 60 * 1000;

/**
 * Play `AWAY_MS` of time away now, as a closed game coming back would: the loading bar, then "While
 * you were away" with its fights block. Not saved (the catch-up's own save is off).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function playTimeAway(ms = AWAY_MS) {
    if (CatchUp.isRunning()) return { ok: false, error: 'A catch-up is already playing' };
    const now = Date.now();
    await CatchUp.run({ savedAt: now - ms, now, save: false });
    return { ok: true };
}
