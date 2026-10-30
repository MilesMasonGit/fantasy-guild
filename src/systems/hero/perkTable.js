// Fantasy Guild - milestone perks: the shape of a skill's perk table
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (its Skill Perks page, Sync and the
// change packs). Keep it pure: no registry that loads `data/`, no store.

import { normaliseScale } from '../effects/effectLibrary.js';
import { MAX_SKILL_LEVEL } from '../../utils/XPCurve.js';

/**
 * Every skill may carry a perk table: fixed perks at set levels, each a library effect a hero gains
 * on reaching the level and keeps. No choices, no saved state: what a hero holds is read off their
 * levels, so a load, a catch-up and a live level-up all agree, and nothing can be granted twice.
 *
 * `data/skillPerks.json`, written only by the CMS's Sync to Game:
 * `{ forestry: { id: 'forestry', perks: [{ level: 10, effectId: 'effect_x', scale: 1 }] } }`.
 * `scale` (1 to 5, default 1) is the reference's strength, as on a Token or item.
 */

/** The levels a new perk table offers, before the owner moves them. */
export const DEFAULT_PERK_LEVELS = Object.freeze([10, 25, 50, 75, 99]);

/** The lowest level a perk may sit at: every hero holds level 1 from the start, so it is never reached. */
export const MIN_PERK_LEVEL = 2;

const NONE = Object.freeze([]);

/** Whether `level` is somewhere a perk can sit: a whole level from 2 to 99. */
export function isPerkLevel(level) {
    return Number.isInteger(level) && level >= MIN_PERK_LEVEL && level <= MAX_SKILL_LEVEL;
}

/**
 * One skill's rows as the game runs them: a whole level from 2 to 99, an effect named, the scale
 * pulled into 1 to 5, in level order (rows at one level keep their authored order). A row naming no
 * effect, or at a level no hero can reach, is dropped: a blank row is the editor's, and the audit
 * names a bad level.
 * @param {{ perks?: Array<{ level: number, effectId: string, scale?: number }> }|null} record
 * @returns {ReadonlyArray<{ level: number, effectId: string, scale: number }>}
 */
export function perkRowsOf(record) {
    const raw = Array.isArray(record?.perks) ? record.perks : NONE;
    const rows = [];
    for (const row of raw) {
        const level = Number(row?.level);
        const effectId = typeof row?.effectId === 'string' ? row.effectId.trim() : '';
        if (!effectId || !isPerkLevel(level)) continue;
        rows.push({ level, effectId, scale: normaliseScale(row.scale ?? 1) });
    }
    // A stable sort, so rows sharing a level keep their order.
    return rows.length ? rows.sort((a, b) => a.level - b.level) : NONE;
}

/**
 * The whole collection as Sync writes it: every skill with at least one working row, its rows
 * normalised. A workspace's blank rows and empty tables stay out of `data/`.
 * @returns {Record<string, { id: string, perks: Array<{ level: number, effectId: string, scale: number }> }>}
 */
export function normaliseSkillPerks(collection) {
    const out = {};
    for (const [skillId, record] of Object.entries(collection || {})) {
        const perks = perkRowsOf(record);
        if (perks.length) out[skillId] = { id: skillId, perks: perks.map(row => ({ ...row })) };
    }
    return out;
}

/** The rows a hero at `level` holds: every one at or below it. */
export function perksEarnedAt(rows, level) {
    const out = [];
    for (const row of rows || NONE) {
        if (row.level > level) break;
        out.push(row);
    }
    return out;
}

/** The rows a level-up from `fromLevel` to `toLevel` reaches: above the old level, at or below the new. */
export function perksReached(rows, fromLevel, toLevel) {
    const from = Number(fromLevel) || 0;
    const to = Number(toLevel) || 0;
    if (!(to > from)) return NONE;
    return (rows || NONE).filter(row => row.level > from && row.level <= to);
}

/** The rows at the next perk level above `level` (several when two perks share it), or none at the top. */
export function nextPerksAfter(rows, level) {
    const next = (rows || NONE).find(row => row.level > level);
    return next ? rows.filter(row => row.level === next.level) : NONE;
}
