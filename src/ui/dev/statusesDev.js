// the QA panel's statuses check: a Venomous enemy, a burning attacker and a boss with all four moves, against fed heroes
// ⚠️ DEV BUILDS ONLY: reached from `StatusesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as BoardCombat from '../../systems/board/BoardCombat.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import * as LiveEffects from '../../systems/effects/LiveEffects.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS, registerEffects } from '../../config/registries/effectRegistry.js';
import { VENOM_EFFECT_ID } from '../../config/registries/enemyKinds.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Everything here is made in memory for this check only (never written to `data/`, gone on
 * reload), in the shapes the combat content pack will author:
 * - Poison (`effect_poison`, the id Venomous names) and Burn, unless the content already has them;
 * - a Venomous goblin, a fire imp whose every 2nd hit burns, and a boss carrying the four moves
 *   (every 4th swing a heavy strike; every 3rd hit a burn; below half health it heals 8 and gains
 *   2 armour; below 30 % it enrages, swinging twice as fast);
 * - a sword for the heroes.
 */
const QA_BURN = 'qa_fx_burn';
const QA_ENEMIES = Object.freeze(['qa_venom_goblin', 'qa_fire_imp', 'qa_boss']);

const rule = (id, keyword, when, role, payload) => ({
    ...makeStatement(keyword), id, when: { scope: 'self', ...when }, target: { role }, payload, chargeDelta: 0
});
const tick = (id) => ({
    ...makeStatement(KEYWORD.DEALS), id, when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF }, payload: { amount: 1, ignoresArmor: true }
});
const provides = (id, type, bucket, value) => ({ ...makeStatement(KEYWORD.PROVIDES), id, to: null, payload: { type, bucket, value } });

/** The Burn this scene lands: the content's own if it has a status by that name, else a test one. */
function burnId() {
    const own = Object.values(EFFECTS).find(e => e?.status && /^burn/i.test(e.name || ''));
    return own?.id || QA_BURN;
}

function registerQaContent() {
    const effects = {};
    if (!EFFECTS[VENOM_EFFECT_ID]) {
        effects[VENOM_EFFECT_ID] = { id: VENOM_EFFECT_ID, name: 'Poison', status: { stacks: 3, ticks: 0 }, statements: [tick('stm_qa_poison')] };
    }
    if (burnId() === QA_BURN) {
        effects[QA_BURN] = {
            id: QA_BURN, name: 'Burn', status: { stacks: 1, ticks: 3 },
            statements: [tick('stm_qa_burn'), provides('stm_qa_burn_food', EFFECT_TYPES.FOOD_HEALING, 'percentage', -0.5)]
        };
    }
    registerEffects(effects);
    const burn = burnId();
    registerEffects({
        qa_fx_heavy_strike: { id: 'qa_fx_heavy_strike', name: 'Heavy Strike', statements: [provides('stm_qa_heavy', EFFECT_TYPES.DAMAGE, 'percentage', 1)] },
        qa_fx_stone_skin: { id: 'qa_fx_stone_skin', name: 'Stone Skin', statements: [provides('stm_qa_skin', EFFECT_TYPES.ARMOR, 'flat', 2)] },
        qa_fx_enrage: { id: 'qa_fx_enrage', name: 'Enrage', statements: [provides('stm_qa_enrage', EFFECT_TYPES.SWING_TIME, 'percentage', -0.5)] },
        qa_fx_burning_touch: { id: 'qa_fx_burning_touch', name: 'Burning Touch', statements: [
            rule('stm_qa_touch', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 2 }, ROLE.ACTOR, { effectId: burn, chance: 100 })] },
        qa_fx_crushing_blow: { id: 'qa_fx_crushing_blow', name: 'Crushing Blow', statements: [
            rule('stm_qa_crush', KEYWORD.APPLIES, { event: 'FIGHT_SWING', every: 4 }, ROLE.OPPONENT, { effectId: 'qa_fx_heavy_strike', forSwing: true, chance: 100 })] },
        qa_fx_searing_bite: { id: 'qa_fx_searing_bite', name: 'Searing Bite', statements: [
            rule('stm_qa_bite', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 3 }, ROLE.ACTOR, { effectId: burn, chance: 100 })] },
        qa_fx_second_wind: { id: 'qa_fx_second_wind', name: 'Second Wind', statements: [
            rule('stm_qa_heal', KEYWORD.HEALS, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, ROLE.SELF, { amount: 8 }),
            rule('stm_qa_harden', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, ROLE.OPPONENT, { effectId: 'qa_fx_stone_skin', forFight: true, chance: 100 })] },
        qa_fx_frenzy: { id: 'qa_fx_frenzy', name: 'Frenzy', statements: [
            rule('stm_qa_frenzy', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 30 }, ROLE.OPPONENT, { effectId: 'qa_fx_enrage', forFight: true, chance: 100 })] }
    });
    const enemy = (id, name, sprite, enemyBlock, effects = []) => ({
        id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite, requiresHero: true,
        enemy: { style: 'melee', ...enemyBlock }, effects,
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
    });
    const goblin = getTokenType('token_goblin');
    const chief = getTokenType('token_goblin_chief');
    registerTokenTypes({
        qa_venom_goblin: enemy('qa_venom_goblin', 'Venomous Goblin', goblin?.sprite || 's_crime', { level: 15, kinds: ['venomous'] }),
        qa_fire_imp: enemy('qa_fire_imp', 'Fire Imp', getTokenType('token_thorn_elemental')?.sprite || goblin?.sprite || 's_crime', { level: 15 }, [{ effectId: 'qa_fx_burning_touch' }]),
        qa_boss: enemy('qa_boss', 'Goblin Warlord', chief?.sprite || goblin?.sprite || 's_crime', { level: 20, hp: 80 }, [
            { effectId: 'qa_fx_crushing_blow' }, { effectId: 'qa_fx_searing_bite' },
            { effectId: 'qa_fx_second_wind' }, { effectId: 'qa_fx_frenzy' }
        ])
    });
    registerItems({
        qa_status_sword: { id: 'qa_status_sword', name: 'Test Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', styles: ['melee'], damage: 3 }
    });
}

/** A hero in the Fighter's art at `level` in every skill, full health. */
function fighterAt(level) {
    const hero = generateHero({ spriteId: 'fighter' });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    return hero;
}

/** The heroes this scene made, by enemy type: the readout's rows. */
let sceneHeroes = [];

/**
 * Beside the Guild Hall, three enemies in a row, and a level 40 Fighter with a Test Sword and
 * Shrimp (40 in the Bank) planted on each: the Venomous Goblin (each hit it lands adds a Poison
 * stack, at most 3), the Fire Imp (every 2nd hit burns) and the Goblin Warlord (all four moves).
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpStatusesScene() {
    registerQaContent();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const spots = [[-320, 220], [0, 260], [320, 220]];
    const placed = QA_ENEMIES.map((typeId, i) => {
        const inst = BoardState.createTokenInstance(typeId, 50);
        return Placement.placeTokenAt(inst, { x: c.x + spots[i][0], y: c.y + spots[i][1] })?.success ? inst : null;
    });
    if (placed.some(p => !p)) return { ok: false, error: 'No room below the Guild Hall for three enemies' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 3);
    GuildUpgradeManager.recompute();

    if (getItem('item_shrimp')) InventoryManager.addItem('item_shrimp', 40);
    InventoryManager.addItem('qa_status_sword', 3);

    sceneHeroes = [];
    placed.forEach((enemy) => {
        const hero = fighterAt(40);
        if (!HeroManager.addHero(hero)) return;
        EquipmentManager.equipItem(hero.id, 'qa_status_sword');
        if (getItem('item_shrimp')) EquipmentManager.equipItem(hero.id, 'item_shrimp');
        qaOrder(hero.id, { x: enemy.x, y: enemy.y });
        sceneHeroes.push({ heroId: hero.id, enemyName: getTokenType(enemy.typeId)?.name || enemy.typeId });
    });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_statuses_scene' });
    return { ok: true };
}

const nameOf = (effectId) => EFFECTS[effectId]?.name || effectId;
const statusWords = (target) => LiveEffects.statusesOf(target)
    .map(s => `${nameOf(s.effectId)}${s.stacks > 1 ? ` ×${s.stacks}` : ''}${s.ticksLeft != null ? ` (${s.ticksLeft} ${s.ticksLeft === 1 ? 'tick' : 'ticks'} left)` : ''}`);
const lingering = (target) => (target?.effects || []).filter(e => e.stacks == null).map(e => nameOf(e.effectId));

/**
 * One line per scene hero: their health and statuses, and their enemy's health, statuses and the
 * moves lingering on it (Stone Skin, Enrage). Statuses are not drawn on the board until the
 * combat panel comes; this is how to see them meanwhile.
 * @returns {string[]}
 */
export function statusesReadout() {
    return sceneHeroes.map(({ heroId, enemyName }) => {
        const hero = HeroManager.getHero(heroId);
        if (!hero) return `${enemyName}: (hero gone)`;
        const fight = BoardCombat.fightOfHero(heroId);
        const heroPart = `${hero.name} ${hero.hp.current}/${hero.hp.max}${hero.status === 'wounded' ? ' (knocked out)' : ''}`;
        const heroStatuses = statusWords(hero);
        if (!fight) return `${heroPart}${heroStatuses.length ? `: ${heroStatuses.join(', ')}` : ''}; not fighting`;
        const hp = fight.combat?.enemyHp;
        const onEnemy = [...statusWords(fight), ...lingering(fight)];
        return `${heroPart}${heroStatuses.length ? `: ${heroStatuses.join(', ')}` : ''} | ${enemyName} ${hp?.current ?? '?'}/${hp?.max ?? '?'}${onEnemy.length ? `: ${onEnemy.join(', ')}` : ''}`;
    });
}
