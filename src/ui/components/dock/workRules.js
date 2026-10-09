import { SKILL_LAYERS, getSkillIdsByLayer, getSkill } from '../../../config/registries/skillRegistry.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import * as Flags from '../../../systems/board/Flags.js';
import { getHeroCombatSkillEntry } from '../../../utils/CombatFormulas.js';
import { HIGHLIGHT_ATTR } from '../board/tokenHighlight.js';

/**
 * The work rules grid's model: plain functions over the hero records and `Flags.setRule`, so the
 * tests can pin them without rendering. Rows are heroes; columns are every skill, then Fight.
 */

/** The most hero rows the drawer shows before it scrolls. */
export const MAX_ROWS = 8;

/**
 * The column groups, left to right: combat, Starting, specialist (Advanced then Master), then the
 * one Fight column. A combat-skill column is a level tint only; the hero's fighting is the Fight
 * rule.
 */
export function ruleGroups() {
    return [
        { id: 'combat', name: 'Combat', columns: getSkillIdsByLayer(SKILL_LAYERS.COMBAT) },
        { id: 'starting', name: 'Starting', columns: getSkillIdsByLayer(SKILL_LAYERS.STARTING) },
        {
            id: 'specialist',
            name: 'Specialist',
            columns: [...getSkillIdsByLayer(SKILL_LAYERS.ADVANCED), ...getSkillIdsByLayer(SKILL_LAYERS.MASTER)]
        },
        { id: 'fight', name: '', columns: [FlagRules.FIGHT] }
    ];
}

/** Whether a column carries a rule (a work skill or Fight), rather than a combat skill's level only. */
export const isRuleColumn = (columnId) => columnId === FlagRules.FIGHT || getSkill(columnId)?.layer !== SKILL_LAYERS.COMBAT;

/** A column's name, for headers and tooltips. */
export const columnName = (columnId) => (columnId === FlagRules.FIGHT ? 'Fight' : (getSkill(columnId)?.name || columnId));

/**
 * One cell: `held` (the hero holds the skill, or can fight for Fight), the level that tints it
 * (Fight: the hero's combat skill level), and for a rule column the rule itself.
 * @returns {{ held: boolean, level: number|null, rule: boolean, allowed: boolean, priority: number }}
 */
export function cellOf(heroId, columnId) {
    const hero = FlagRules.heroRecord(heroId);
    const rule = isRuleColumn(columnId);
    let held;
    let level = null;
    if (columnId === FlagRules.FIGHT) {
        held = FlagRules.canFight(heroId);
        if (held) level = getHeroCombatSkillEntry(hero).level || 1;
    } else {
        const skill = hero?.skills?.[columnId];
        held = !!skill;
        if (held) level = (typeof skill === 'number' ? skill : skill.level) || 1;
    }
    const { allowed, priority } = rule && held ? FlagRules.ruleOf(heroId, columnId) : { allowed: false, priority: FlagRules.PRIORITY_DEFAULT };
    return { held, level, rule, allowed, priority };
}

/**
 * The rule a click moves a cell to. Ticks: on and off, either way. Priorities: up runs
 * 1→2→3→4→5→off→1, down the reverse. A rule switched on by a tick or by "up" starts at 1.
 * @param {{ allowed: boolean, priority: number }} rule
 * @param {'up'|'down'} direction
 * @param {boolean} priorityMode
 */
export function cycleRule({ allowed, priority }, direction, priorityMode) {
    const { PRIORITY_MIN: MIN, PRIORITY_MAX: MAX } = FlagRules;
    if (!priorityMode) return allowed ? { allowed: false } : { allowed: true, priority: MIN };
    if (direction === 'down') {
        if (!allowed) return { allowed: true, priority: MAX };
        return priority <= MIN ? { allowed: false } : { allowed: true, priority: priority - 1 };
    }
    if (!allowed) return { allowed: true, priority: MIN };
    return priority >= MAX ? { allowed: false } : { allowed: true, priority: priority + 1 };
}

/** Apply a click to one cell through `Flags.setRule`. A cell with no rule to change does nothing. */
export function clickCell(heroId, columnId, direction, priorityMode) {
    const cell = cellOf(heroId, columnId);
    if (!cell.held || !cell.rule) return { success: false };
    return Flags.setRule(heroId, columnId, cycleRule(cell, direction, priorityMode));
}

/**
 * Allow or disallow a set of cells together: if any of them is off, all go on (the ones switched
 * on start at priority 1); if all are on, all go off. Cells the hero cannot have are skipped.
 * @param {{ heroId: string, columnId: string }[]} pairs
 */
export function toggleCells(pairs) {
    const live = pairs
        .map(p => ({ ...p, cell: cellOf(p.heroId, p.columnId) }))
        .filter(p => p.cell.held && p.cell.rule);
    if (live.length === 0) return { allowed: null };
    const allow = live.some(p => !p.cell.allowed);
    for (const { heroId, columnId, cell } of live) {
        if (allow && !cell.allowed) Flags.setRule(heroId, columnId, { allowed: true, priority: FlagRules.PRIORITY_MIN });
        else if (!allow) Flags.setRule(heroId, columnId, { allowed: false });
    }
    return { allowed: allow };
}

/** Every rule column, in grid order. */
export const ruleColumns = () => ruleGroups().flatMap(g => g.columns).filter(isRuleColumn);

/** A row header's click: the whole row. */
export const toggleRow = (heroId) => toggleCells(ruleColumns().map(columnId => ({ heroId, columnId })));

/** A column header's click: the whole column. */
export const toggleColumn = (heroIds, columnId) => toggleCells(heroIds.map(heroId => ({ heroId, columnId })));

/** Lightness of a cell's tint, in percent: dark at level 1, bright at 99. */
export function tintLightness(level) {
    const l = Math.min(99, Math.max(1, Math.floor(level || 1)));
    return Math.round(10 + ((l - 1) / 98) * 34);
}

/** The cell's background for a level. */
export const levelTint = (level) => `hsl(36, 55%, ${tintLightness(level)}%)`;

/**
 * Light one hero (and their flag) on the mat, or none with null. An attribute the Token Summary's
 * highlight rule already draws, set only while a row is hovered, so it costs nothing per frame.
 */
export function highlightHero(heroId) {
    if (typeof document === 'undefined') return;
    for (const el of document.querySelectorAll(`[data-board-hero][${HIGHLIGHT_ATTR}], [data-flag][${HIGHLIGHT_ATTR}]`)) {
        el.removeAttribute(HIGHLIGHT_ATTR);
    }
    if (!heroId) return;
    for (const el of document.querySelectorAll('[data-board-hero], [data-flag]')) {
        const id = el.getAttribute('data-board-hero') ?? el.getAttribute('data-flag');
        if (id === heroId) el.setAttribute(HIGHLIGHT_ATTR, 'true');
    }
}
