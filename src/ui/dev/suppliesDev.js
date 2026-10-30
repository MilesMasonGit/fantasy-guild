// the QA panel's supplies check: two heroes fighting Cows, one with two elixirs, one with food and a drink
// ⚠️ DEV BUILDS ONLY: reached from `SuppliesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Two test elixirs, made in memory for this check only (never written to `data/`, gone on reload):
 * Valor (+1 Damage) and Ironskin (+1 Armour), each "When a fight starts, applies … to the hero for
 * the fight", as the combat content pack will author them.
 */
export const QA_ELIXIRS = Object.freeze(['qa_elixir_valor', 'qa_elixir_ironskin']);

function registerQaElixirs() {
    const provides = (type) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value: 1 }, to: null });
    const forTheFight = (effectId) => ({
        ...makeStatement(KEYWORD.APPLIES),
        when: { event: 'COMBAT_ENGAGED', scope: 'self' },
        payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
    });
    registerEffects({
        qa_fx_valor: { id: 'qa_fx_valor', name: 'Valor', statements: [provides('DAMAGE')] },
        qa_fx_ironskin: { id: 'qa_fx_ironskin', name: 'Ironskin', statements: [provides('ARMOR')] },
        qa_fx_elixir_valor: { id: 'qa_fx_elixir_valor', name: 'Elixir of Valor', statements: [forTheFight('qa_fx_valor')] },
        qa_fx_elixir_ironskin: { id: 'qa_fx_elixir_ironskin', name: 'Elixir of Ironskin', statements: [forTheFight('qa_fx_ironskin')] }
    });
    const elixir = (id, name, effectId) => ({
        id, name, type: 'potion', sprite: 'i_potion_shrimp_pink', stackable: true, equipSlot: 'consumable',
        effects: [{ effectId }]
    });
    registerItems({
        qa_elixir_valor: elixir('qa_elixir_valor', 'Valor', 'qa_fx_elixir_valor'),
        qa_elixir_ironskin: elixir('qa_elixir_ironskin', 'Ironskin', 'qa_fx_elixir_ironskin')
    });
}

/** A hero in the Fighter's art at `level` in every skill, full health, nothing equipped. */
function fighterAt(level) {
    const hero = generateHero({ spriteId: 'fighter' });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    return hero;
}

/**
 * Beside the Guild Hall, two Cows and two new Fighters, each flag planted on one:
 * - a level 40 Fighter with Valor and Ironskin (30 of each in the Bank): a bubble names each
 *   elixir as the first fight starts, the Bank drops by one of each, and again after ten Cows;
 * - a level 5 Fighter with Shrimp and Water (20 Shrimp, 5 Water): below 25 % HP they eat, a
 *   "+5 ♥" bubble over them; the Water stays in the Bank (drinks never heal);
 * - a level 5 Fighter with only Water, hurt to 2 HP and standing beside the Hall, out of any
 *   fight: they do not drink (drinks never heal, out of a fight either); the Water stays in the
 *   Bank and only regeneration brings their HP back.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpSuppliesScene() {
    if (!getTokenType('token_cow')) return { ok: false, error: 'No Cow in the content' };
    registerQaElixirs();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const put = (dx, dy) => {
        const inst = BoardState.createTokenInstance('token_cow', getTokenType('token_cow')?.uses ?? null);
        return Placement.placeTokenAt(inst, { x: c.x + dx, y: c.y + dy })?.success ? inst : null;
    };
    const cows = [put(-280, 160), put(280, 160)];
    if (!cows[0] || !cows[1]) return { ok: false, error: 'No room beside the Guild Hall for two Cows' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 3);
    GuildUpgradeManager.recompute();

    InventoryManager.addItem('qa_elixir_valor', 30);
    InventoryManager.addItem('qa_elixir_ironskin', 30);
    if (getItem('item_shrimp')) InventoryManager.addItem('item_shrimp', 20);
    if (getItem('item_water')) InventoryManager.addItem('item_water', 10);

    const loadouts = [
        { level: 40, items: QA_ELIXIRS },
        { level: 5, items: ['item_shrimp', 'item_water'] }
    ];
    loadouts.forEach(({ level, items }, i) => {
        const hero = fighterAt(level);
        if (!HeroManager.addHero(hero)) return;
        for (const itemId of items) if (getItem(itemId)) EquipmentManager.equipItem(hero.id, itemId);
        qaOrder(hero.id, { x: cows[i].x + 40, y: cows[i].y + 40 });
    });
    const thirsty = fighterAt(5);
    if (HeroManager.addHero(thirsty)) {
        if (getItem('item_water')) EquipmentManager.equipItem(thirsty.id, 'item_water');
        thirsty.hp.current = 2;
        qaOrder(thirsty.id, { x: c.x, y: c.y + 200 });
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_supplies_scene' });
    return { ok: true };
}
