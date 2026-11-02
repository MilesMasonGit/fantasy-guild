import { normaliseWorldTables, STRICT_RINGS } from '../../../src/config/worldTablesShape.js';

/**
 * The world tables in the workspace: one record (`world`), in the shape `src/config/worldTablesShape.js`
 * reads, kept as authored. Sync writes it to `data/world.json` as it is; the game generates each new
 * world from that file, and from its placeholder (`src/config/worldPlaceholder.js`) while there is none.
 *
 * ⚠️ Null means this workspace never held tables: Sync then leaves `data/world.json` alone (or absent),
 * as it does the Starter Camp, the perks and the Guild Hall sky. Tables arrive by change pack (`kind: "world"`).
 */

export const WORLD_FILE = 'world.json';

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The workspace's record from a backup or `data/world.json`'s contents, or null when there is none. */
export function workspaceWorldFrom(raw) {
  return isPlainObject(raw) ? raw : null;
}

/** Whether the workspace holds tables to write. */
export function holdsWorld(workspace) {
  return isPlainObject(workspace?.world);
}

/** What Sync writes into `data/`: the record as the workspace holds it. */
export function worldFile(workspace) {
  return workspace.world;
}

/** The tables a record holds, normalised, or null when they cannot be generated from. */
export function usableTables(raw) {
  return isPlainObject(raw) ? normaliseWorldTables(raw) : null;
}

const lineName = (tables, id) => tables?.lines?.find((l) => l.id === id)?.name || id;

/** Each origin a record places and each camp it guarantees, keyed by line and ring, for the Sync guard. */
export function keyedWorld(raw) {
  const out = new Map();
  const tables = usableTables(raw);
  if (!tables) return out;
  for (const line of tables.lines) {
    for (let ring = 1; ring <= STRICT_RINGS; ring++) {
      for (const o of line.origins[ring] || []) out.set(`${line.id} ring ${ring}: ${o.id}`, o.id);
    }
  }
  for (let ring = 1; ring <= STRICT_RINGS; ring++) {
    for (const c of tables.camps[ring] || []) out.set(`camps ring ${ring}: ${c.id}`, c.id);
  }
  return out;
}

/** The parts of a record compared as wholes in a review: changed or not. */
const WHOLE_PARTS = Object.freeze(['kits', 'arrival', 'prices', 'keys', 'extras', 'ringValue', 'specialties', 'heroTokens', 'neighbours', 'wild']);

/**
 * What a world entry changes, for the review page: origins and guaranteed camps in and out per line
 * and ring, by name of line, then each other part that differs as a whole.
 * @returns {{ kind: 'added' | 'removed' | 'changed', text: string }[]}
 */
export function worldDiff(before, after) {
  const was = usableTables(before);
  const now = usableTables(after);
  const out = [];
  const listed = (tables) => {
    const rows = new Map();
    if (!tables) return rows;
    for (const line of tables.lines) {
      for (let ring = 1; ring <= STRICT_RINGS; ring++) {
        for (const o of line.origins[ring] || []) rows.set(`${lineName(tables, line.id)} ring ${ring}: ${o.id}`, true);
      }
    }
    for (let ring = 1; ring <= STRICT_RINGS; ring++) for (const c of tables.camps[ring] || []) rows.set(`Camps ring ${ring}: ${c.id}`, true);
    return rows;
  };
  const a = listed(was);
  const b = listed(now);
  for (const text of b.keys()) if (!a.has(text)) out.push({ kind: 'added', text });
  for (const text of a.keys()) if (!b.has(text)) out.push({ kind: 'removed', text });
  const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  for (const part of WHOLE_PARTS) {
    if (!same(isPlainObject(before) ? before[part] : undefined, isPlainObject(after) ? after[part] : undefined)) {
      out.push({ kind: 'changed', text: `${part} changed` });
    }
  }
  return out;
}
