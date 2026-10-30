import { DEFAULT_PERK_LEVELS, normaliseSkillPerks, isPerkLevel } from '../../../src/systems/hero/perkTable.js';
import { normaliseScale } from '../../../src/systems/effects/effectLibrary.js';

/**
 * Milestone perks in the workspace: `skillPerks`, keyed by skill id, each `{ id, perks: [{ level,
 * effectId, scale }] }` (the game's shape, `src/systems/hero/perkTable.js`). Sync writes
 * `data/skillPerks.json` from it, leaving out blank rows and empty tables.
 *
 * ⚠️ Null means this workspace never held any perks (an older workspace, or one restored before any
 * existed): Sync then leaves `data/skillPerks.json` alone, as it does the Starter Camp.
 */

/** The file Sync writes. */
export const PERK_FILE = 'skillPerks.json';

/** The workspace's perk tables in their one shape, or null when there are none to hold. */
export function normaliseWorkspacePerks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [skillId, record] of Object.entries(value)) {
    const rows = Array.isArray(record?.perks) ? record.perks : [];
    out[skillId] = { id: skillId, perks: rows.map(cleanRow) };
  }
  return out;
}

function cleanRow(row) {
  const level = Math.round(Number(row?.level));
  return {
    level: Number.isFinite(level) ? level : DEFAULT_PERK_LEVELS[0],
    effectId: typeof row?.effectId === 'string' ? row.effectId : '',
    scale: normaliseScale(row?.scale ?? 1),
  };
}

/**
 * The rows the Skill Perks page shows for one skill: every authored row (blank ones included, the
 * author's work in progress) plus an empty row at each default level no authored row sits at, in
 * level order. An empty default row is `{ virtual: true }` until an effect is picked for it.
 * Each carries `index`, its place in the stored list (-1 for a virtual one).
 */
export function editorRows(record) {
  const authored = (Array.isArray(record?.perks) ? record.perks : []).map((row, index) => ({ ...cleanRow(row), index }));
  const taken = new Set(authored.map((row) => row.level));
  const virtual = DEFAULT_PERK_LEVELS.filter((level) => !taken.has(level))
    .map((level) => ({ level, effectId: '', scale: 1, index: -1, virtual: true }));
  return [...authored, ...virtual].sort((a, b) => a.level - b.level || (a.virtual ? 1 : 0) - (b.virtual ? 1 : 0));
}

/** One skill's stored rows with `row` set at `index` (-1 adds it). Returns the new collection. */
export function withPerkRow(skillPerks, skillId, index, row) {
  const rows = [...(skillPerks?.[skillId]?.perks || [])];
  const clean = cleanRow(row);
  if (index >= 0 && index < rows.length) rows[index] = clean;
  else rows.push(clean);
  return { ...(skillPerks || {}), [skillId]: { id: skillId, perks: rows } };
}

/** One skill's stored rows without the one at `index`. Returns the new collection. */
export function withoutPerkRow(skillPerks, skillId, index) {
  const rows = (skillPerks?.[skillId]?.perks || []).filter((_, i) => i !== index);
  return { ...(skillPerks || {}), [skillId]: { id: skillId, perks: rows } };
}

/** How many working perks a skill has (a row with an effect, at a level a hero reaches). */
export function perkCount(record) {
  return (Array.isArray(record?.perks) ? record.perks : [])
    .filter((row) => row?.effectId && isPerkLevel(Number(row.level))).length;
}

/** What Sync writes into `data/`: the working rows only. */
export function perksFile(skillPerks) {
  return normaliseSkillPerks(skillPerks);
}

/** The perks a file holds, keyed `skill:level:effect`, for the Sync guard. */
export function keyedPerks(file) {
  const out = new Map();
  for (const [skillId, record] of Object.entries(normaliseSkillPerks(file))) {
    for (const row of record.perks) out.set(`${skillId}:${row.level}:${row.effectId}`, `${skillId} ${row.level}`);
  }
  return out;
}

/** Which skills' perks name an effect, as `{ id, name }` rows for the effect editor's used-by list. */
export function perkUsersOf(effectId, skillPerks, skillName = (id) => id) {
  const users = [];
  for (const [skillId, record] of Object.entries(skillPerks || {})) {
    for (const row of Array.isArray(record?.perks) ? record.perks : []) {
      if (row?.effectId === effectId) users.push({ id: `${skillId}:${row.level}`, name: `${skillName(skillId)} ${row.level} perk` });
    }
  }
  return users;
}
