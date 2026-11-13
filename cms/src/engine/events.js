import { EVENTS_FILE, EVENT_KIND } from '../../../src/config/eventTable.js';

/**
 * The events table in the workspace: one collection keyed by id (`events`), each row in the shape
 * the game reads (`src/config/eventTable.js`). Sync writes `data/events.json` from it, every row in
 * one key order, so a Restore followed by a Sync writes the file back byte for byte.
 *
 * ⚠️ Null means this workspace never held a table (an older workspace, or one restored before any
 * existed): Sync then leaves `data/events.json` alone (or absent), as it does the Starter Camp, the
 * perks, the Guild Hall sky and the world tables. The game reads an absent file as no events.
 */

export { EVENTS_FILE };

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const words = (list) => (Array.isArray(list) ? list.filter(w => typeof w === 'string' && w) : []);

/** A new row, ready to edit: a rich node until the kind is changed. */
export function newEventRow(id) {
  return { id, name: '', typeId: '', kind: EVENT_KIND.NODE, weight: 10, ground: [], biomes: [] };
}

/** One row as Sync writes it: its fields in one order; a buff's time only on a buff. */
export function eventRowFile(row, id) {
  const out = {
    id: row.id || id,
    name: typeof row.name === 'string' ? row.name : '',
    typeId: typeof row.typeId === 'string' ? row.typeId : '',
    kind: typeof row.kind === 'string' ? row.kind : '',
    weight: Number.isFinite(Number(row.weight)) ? Number(row.weight) : 0,
    ground: words(row.ground),
    biomes: words(row.biomes),
  };
  if (out.kind === EVENT_KIND.BUFF) out.durationMinutes = Number(row.durationMinutes) > 0 ? Number(row.durationMinutes) : 0;
  return out;
}

/** The workspace's collection from a backup's `events` or `data/events.json`'s contents, or null when there is none. */
export function workspaceEventsFrom(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const [id, row] of Object.entries(raw)) {
    if (isPlainObject(row)) out[id] = { ...row, id: row.id || id };
  }
  return out;
}

/** Whether the workspace holds a table to write (even an empty one). */
export function holdsEvents(workspace) {
  return isPlainObject(workspace?.events);
}

/** What Sync writes into `data/`: every row, keyed by id, in the workspace's order. */
export function eventsFile(workspace) {
  const out = {};
  for (const [id, row] of Object.entries(workspace?.events || {})) {
    if (isPlainObject(row)) out[row.id || id] = eventRowFile(row, id);
  }
  return out;
}

/** The events a file holds, keyed for the Sync guard: id → name. */
export function keyedEvents(file) {
  const out = new Map();
  for (const [id, row] of Object.entries(isPlainObject(file) ? file : {})) {
    if (isPlainObject(row)) out.set(id, row.name || id);
  }
  return out;
}
