// Fantasy Guild — the world tables (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { normaliseWorldTables } from '../worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../worldPlaceholder.js';
import { RETIRED_WATER_TOKENS } from './fishingSpots.js';

/**
 * The tables the world is generated from: `data/world.json` once the CMS syncs one, else the
 * placeholder (`worldPlaceholder.js`). The shape is `worldTablesShape.js`'s.
 *
 * ⚠️ Never hand-edit `data/world.json`: the CMS writes it wholesale.
 */

/**
 * The tables without the retired fixed waters (`fishingSpots.RETIRED_WATER_TOKENS`) as origins or
 * keys, while `data/` still names them: the Token registry never loads them, so a world must never
 * put one on a map. A copy; the module's own record is left as read.
 */
function withoutRetiredWaters(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.lines)) return raw;
    const kept = (list) => (Array.isArray(list)
        ? list.filter(o => !RETIRED_WATER_TOKENS.includes(o && typeof o === 'object' ? o.id : o))
        : list);
    const perRing = (rings) => (rings && typeof rings === 'object'
        ? Object.fromEntries(Object.entries(rings).map(([ring, list]) => [ring, kept(list)]))
        : rings);
    return {
        ...raw,
        lines: raw.lines.map(line => (line && typeof line === 'object' ? { ...line, origins: perRing(line.origins) } : line)),
        ...(raw.keys ? { keys: perRing(raw.keys) } : {})
    };
}

function loadJsonTables() {
    for (const [path, module] of Object.entries(DatabaseManager.worldFilesSingle || {})) {
        const tables = normaliseWorldTables(withoutRetiredWaters(module.default || module));
        if (tables) return tables;
        console.warn(`[World] ${path} is not usable world tables (six lines with distinct ids); the placeholder is used`);
    }
    return null;
}

const fromFile = loadJsonTables();
const placeholder = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
let override;

/** The world tables in force. */
export function worldTables() {
    return override ?? fromFile ?? placeholder;
}

/** Whether the world is generated from the placeholder, not from tables the CMS synced. */
export function isPlaceholderTables() {
    return worldTables() === placeholder;
}

/**
 * Use `raw` as the world tables (null: back to the file's or the placeholder). **For test fixtures
 * and dev checks only**, like `setStarterCampForTests`; nothing in `src/systems` or `src/ui` may
 * call it. Throws on tables that cannot be generated from.
 */
export function setWorldTablesForTests(raw) {
    if (raw == null) {
        override = undefined;
        return;
    }
    const tables = normaliseWorldTables(raw);
    if (!tables) throw new TypeError('Not usable world tables: six lines with distinct ids are needed');
    override = tables;
}

/** Undo {@link setWorldTablesForTests}. */
export function resetWorldTablesForTests() {
    override = undefined;
}
