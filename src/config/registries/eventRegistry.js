// Fantasy Guild — the events table (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { normaliseEventTable } from '../eventTable.js';

/**
 * The events that may land on the mat, read from `data/events.json` (shape: `eventTable.js`). The
 * file is absent until the CMS first syncs one: the table is then empty and no event ever lands.
 *
 * ⚠️ Never hand-edit `data/events.json`: the CMS writes it wholesale.
 */

function loadAuthored() {
    const authored = {};
    for (const [path, module] of Object.entries(DatabaseManager.eventFilesSingle || {})) {
        try {
            Object.assign(authored, module.default || module);
        } catch (error) {
            console.warn(`[EventRegistry] Error loading events from ${path}:`, error);
        }
    }
    return authored;
}

/** The table as the file holds it, bad rows included, for the boot audit. */
const AUTHORED = loadAuthored();
const fromFile = normaliseEventTable(AUTHORED);
let override = null;
let version = 0;

/** The table as authored (`{ id: row }`), what the audits read. */
export function authoredEvents() {
    return override?.authored ?? AUTHORED;
}

/** Every event, keyed by id, as the game reads it. */
export function eventTable() {
    return override?.table ?? fromFile;
}

/** Every event, in the table's order. */
export function allEvents() {
    return Object.values(eventTable());
}

/** The event `id`, or null. */
export function getEvent(id) {
    return eventTable()[id] || null;
}

/** Bumped whenever the table in force changes (tests), for anything that remembers an answer. */
export function eventsVersion() {
    return version;
}

/**
 * Use `raw` as the events table (null: back to the file's). **For test fixtures and dev checks
 * only**, like `setWorldTablesForTests`; nothing in `src/systems` or `src/ui` may call it.
 */
export function setEventsForTests(raw) {
    version++;
    override = raw == null ? null : { authored: raw, table: normaliseEventTable(raw) };
}

/** Undo {@link setEventsForTests}. */
export function resetEventsForTests() {
    setEventsForTests(null);
}
