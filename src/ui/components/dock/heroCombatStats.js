import * as CombatFormulas from '../../../systems/combat/CombatFormulas.js';
import { loadoutRefs, itemStatements } from '../../../systems/hero/HeroEffects.js';
import { effectTitle, statementsFromEntry, strengthenStatement } from '../../../systems/effects/effectLibrary.js';
import { renderStatement } from '../../../systems/effects/statementText.js';
import { KEYWORD } from '../../../systems/effects/statements.js';
import { doseLength, doseStrength, FIGHT_START } from '../../../systems/hero/ConsumptionSystem.js';
import { doseKindsOf, isWorkMoment, DOSE, DOSE_LENGTH } from '../../../systems/core/consumableRule.js';
import { t } from '../../../i18n/index.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { COMBAT_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { heroSide } from '../combat/fightView.js';
import { carriedRuleNames } from './heroPerks.js';

/**
 * The hero drawer's Combat view, as plain values: every number is read from the fight's own code
 * (`CombatFormulas`, and the fight panel's `heroSide`, which reads it too), never worked out again
 * here, so the drawer always says what a fight would do.
 *
 * - `style`, `level`, `armed`: the style the weapon in hand fights in (barehanded is Melee).
 * - `hit`, `hitParts`, `hitLines`: a landed hit before the matchup and the enemy's resistances,
 *   with the fight panel's own breakdown for the tooltip.
 * - `range`: what one landed hit deals against an enemy of each style (`CombatFormulas.heroBlow`,
 *   the matchup included), lowest and highest, and a critical hit's highest.
 * - `swingMs`, `accuracy`, `dodge`, `critChance`: the swing and the miss and crit chances' parts.
 * - `resists`: what the hero resists, from gear and elixirs (the fight panel's lines).
 * - `cuts`: what worn gear cuts from the hero's damage in each style (`styleDamageCut`).
 * - `effects`: what the loadout lends, one per effect as the game merges them (`loadoutRefs`).
 *
 * @returns {object|null} null without a hero
 */
export function heroCombatStats(hero) {
    const side = heroSide(hero);
    if (!side) return null;
    const arrow = side.arrows?.arrow || null;
    const vs = COMBAT_SKILL_IDS.map(style => {
        // An enemy of this style with nothing on it: no resistances, no effects.
        const enemy = { combatType: style };
        return {
            style,
            hit: CombatFormulas.heroBlow(hero, enemy, { arrow }).exact,
            crit: CombatFormulas.heroBlow(hero, enemy, { crit: true, arrow }).exact
        };
    });
    const hits = vs.map(v => v.hit);
    return {
        style: side.style,
        level: side.level,
        armed: side.armed,
        hit: side.hit,
        hitParts: side.hitParts,
        hitLines: side.hitLines,
        range: { low: Math.min(...hits), high: Math.max(...hits), crit: Math.max(...vs.map(v => v.crit)), vs },
        swingMs: side.swingMs,
        accuracy: CombatFormulas.heroAccuracy(hero),
        dodge: CombatFormulas.heroDodge(hero),
        critChance: CombatFormulas.heroCritChance(hero),
        resists: side.resists,
        cuts: COMBAT_SKILL_IDS
            .map(style => ({ style, n: CombatFormulas.styleDamageCut(hero, style) }))
            .filter(c => c.n > 0),
        effects: gearEffects(hero)
    };
}

/**
 * What a hero's loadout lends, one entry per effect as the game merges them (two items naming one
 * effect add their scales): its title, its rules in the grammar's words, and the items it comes
 * from. Milestone perks are not here: the Skills view lists them. A drink, potion or fight elixir
 * the guild's Long-lasting Brews or Strong Drink moves says so under its rules ({@link doseLines}).
 * @returns {Array<{ id: string, title: string, lines: string[], items: string[] }>}
 */
export function gearEffects(hero) {
    const out = [];
    const names = carriedRuleNames();
    for (const [effectId, ref] of loadoutRefs(hero)) {
        const entry = EFFECTS[effectId];
        if (!entry) continue;
        const statements = statementsFromEntry(entry, { effectId, scale: ref.scale });
        out.push({
            id: effectId,
            title: effectTitle(entry.name || effectId, ref.scale),
            lines: [...statements.map(s => renderStatement(s, names)), ...doseLines(ref.itemIds, statements, names)],
            items: ref.itemIds.map(id => getItem(id)?.name || id)
        });
    }
    return out;
}

/** The kinds of dose (`consumableRule.DOSE`) the items lending an effect are drunk as. */
function doseKindsOfItems(itemIds) {
    const kinds = new Set();
    for (const id of itemIds) {
        for (const kind of doseKindsOf(getItem(id)?.equipSlot, itemStatements(id))) kinds.add(kind);
    }
    return kinds;
}

/** The kind of dose a rule fires from: a fight-start rule an elixir's, a work rule a drink's or potion's. */
function doseOfRule(statement, kinds) {
    const event = statement?.when?.event;
    if (event === FIGHT_START) return kinds.has(DOSE.ELIXIR) ? DOSE.ELIXIR : null;
    if (!isWorkMoment(event)) return null;
    if (kinds.has(DOSE.DRINK)) return DOSE.DRINK;
    return kinds.has(DOSE.POTION) ? DOSE.POTION : null;
}

/**
 * Lines a dose's effect adds while the guild's stars move it: how long one lasts now (Long-lasting
 * Brews), and each number an effect it applies provides, at its strength (Strong Drink). None while
 * nothing moves them, so the tooltip reads as it always has.
 */
function doseLines(itemIds, statements, names) {
    const kinds = doseKindsOfItems(itemIds);
    if (!kinds.size) return [];
    const lines = [];
    for (const kind of [DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR]) {
        if (!kinds.has(kind)) continue;
        const count = doseLength(kind);
        if (count === DOSE_LENGTH[kind]) continue;
        lines.push(t(kind === DOSE.ELIXIR ? 'heroPanel.combat.doseFights' : 'heroPanel.combat.doseCycles', { count }));
    }
    for (const statement of statements) {
        const applied = statement.keyword === KEYWORD.APPLIES ? EFFECTS[statement.payload?.effectId] : null;
        const dose = applied ? doseOfRule(statement, kinds) : null;
        const strength = dose ? doseStrength(dose) : 1;
        if (strength === 1) continue;
        const n = Math.round(Math.abs(strength - 1) * 1000) / 10;
        for (const rule of statementsFromEntry(applied, { effectId: statement.payload.effectId, scale: statement.payload.scale })) {
            const stronger = strengthenStatement(rule, strength);
            if (stronger === rule) continue;
            lines.push(t(strength > 1 ? 'heroPanel.combat.doseStronger' : 'heroPanel.combat.doseWeaker', {
                effect: applied.name || statement.payload.effectId, n, rule: renderStatement(stronger, names)
            }));
        }
    }
    return [...new Set(lines)];
}
