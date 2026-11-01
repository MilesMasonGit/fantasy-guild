// the QA panel's enemy moves check: the owner's chicken (Peck, Scratch, Flutter) on a hero in Physical-resistant gear
// ⚠️ DEV BUILDS ONLY: reached from `EnemyMovesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt, placeBesideHall } from './combatScreenDev.js';

/**
 * The scene, everything made in memory for this check only (never written to `data/`, gone on
 * reload), one fight below the Guild Hall: **Dara** (Melee 30, a sword, a Plate Chestplate and a
 * Kite Shield: Physical 35 %) on the owner's **Chicken**, whose every swing makes one of three moves
 * at random: **Peck** (a Stab hit), **Scratch** (a Slash hit), **Flutter** (no hit; +50 % Physical
 * resistance for Dara's next swing). Her plate turns every Peck and Scratch that lands "Resisted"; her
 * swing after a Flutter says "Resisted" too, and the one after it does not. The float names each move,
 * the log says "Chicken's Peck hits Dara", the panel lists the three with the last one bright, and the
 * enemy card shows them. She carries Shrimp when the content has them, so the fight lasts.
 */
export const QA_V3 = Object.freeze({
    CHICKEN: 'qa_v3_chicken',
    FLUTTER: 'qa_v3_flutter',
    SWORD: 'qa_v3_sword',
    PLATE: 'qa_v3_plate_chestplate',
    SHIELD: 'qa_v3_kite_shield'
});

function registerQaContent() {
    registerEffects({
        [QA_V3.FLUTTER]: {
            id: QA_V3.FLUTTER, name: 'Flutter',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_qa_v3_flutter', to: null, payload: { type: EFFECT_TYPES.TYPE_RESIST, bucket: 'flat', value: 50, category: 'physical' } }]
        }
    });
    registerItems({
        [QA_V3.SWORD]: {
            id: QA_V3.SWORD, name: 'Test Sword', type: 'weapon', equipSlot: 'hand', stackable: true,
            sprite: getItem('item_copper_sword')?.sprite || 'i_pick_copper', styles: ['melee'], damage: 2
        },
        [QA_V3.PLATE]: {
            id: QA_V3.PLATE, name: 'Plate Chestplate', type: 'armor', equipSlot: 'chest', stackable: true,
            sprite: getItem('item_iron_chestplate')?.sprite || 'i_pick_copper',
            resistances: { physical: 20 }, damageCut: { magic: 30, stealth: 15 },
            description: 'Test armour: a metal piece resisting Physical.'
        },
        [QA_V3.SHIELD]: {
            id: QA_V3.SHIELD, name: 'Kite Shield', type: 'armor', equipSlot: 'hand', stackable: true, offHand: true,
            sprite: getItem('item_copper_helmet')?.sprite || 'i_pick_copper', resistances: { physical: 15 },
            description: 'Test off-hand item: held beside a weapon, it lends like a piece of armour.'
        }
    });
    registerTokenTypes({
        [QA_V3.CHICKEN]: {
            id: QA_V3.CHICKEN, name: 'Chicken', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50,
            sprite: 'e_chicken', requiresHero: true,
            enemy: {
                level: 10, style: 'melee', hp: 400, hit: 3,
                moves: [
                    { name: 'Peck', damageType: 'stab' },
                    { name: 'Scratch', damageType: 'slash' },
                    { name: 'Flutter', hits: false, effectId: QA_V3.FLUTTER, target: 'self', lasts: 'attack' }
                ]
            },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
        }
    });
}

/**
 * The scene: the chicken below the Guild Hall, Dara on it. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpEnemyMovesScene() {
    registerQaContent();
    const chicken = placeBesideHall(QA_V3.CHICKEN, 0, 300);
    if (!chicken) return { ok: false, error: 'No room below the Guild Hall for the scene' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();

    const hero = fighterAt(30, 'Dara');
    if (!HeroManager.addHero(hero)) return { ok: false, error: 'No room on the roster' };
    for (const id of [QA_V3.SWORD, QA_V3.PLATE, QA_V3.SHIELD]) {
        InventoryManager.addItem(id, 1);
        EquipmentManager.equipItem(hero.id, id);
    }
    const food = getItem('item_shrimp') ? 'item_shrimp' : null;
    if (food) {
        InventoryManager.addItem(food, 80);
        EquipmentManager.equipItem(hero.id, food);
    }
    qaOrder(hero.id, { x: chicken.x, y: chicken.y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_enemy_moves_scene' });
    return { ok: true };
}
