// the events table: its file, its shape and its checks (pure: the game and the CMS share it)

/**
 * An **event** is a special Token that lands on the mat now and then (`systems/events/EventClock.js`):
 * a rich node (a big pool of charges, gone when worked out) or a buff Token (one effect in reach
 * for a set time). The table says which events there are, keyed by id:
 *
 * ```js
 * {
 *   id, name,
 *   typeId,            // the Token type that lands
 *   kind,              // 'node' | 'buff'
 *   weight,            // its share of the draw among the events that fit the place (0: never)
 *   ground: [],        // "Stands on" words it may land on; empty: wherever its Token may stand
 *   biomes: [],        // Region biomes it may land in; empty: any Region
 *   durationMinutes    // a buff's time on the mat
 * }
 * ```
 *
 * ⚠️ The ground narrows where the event lands; the Token type's own "Stands on" still applies, so a
 * fish shoal's Token must itself stand on water.
 *
 * The CMS writes `data/events.json` wholesale on Sync. A missing file is an empty table: no events.
 */

/** The file the CMS writes and the game reads. */
export const EVENTS_FILE = 'events.json';

/** The two kinds of event. */
export const EVENT_KIND = Object.freeze({ NODE: 'node', BUFF: 'buff' });

/** The kinds as the CMS's select shows them, in order. */
export const EVENT_KIND_CHOICES = Object.freeze([
    Object.freeze({ id: EVENT_KIND.NODE, label: 'Rich node' }),
    Object.freeze({ id: EVENT_KIND.BUFF, label: 'Buff' })
]);

/** ⭐ Game value: a buff with no usable time stays this long (the audit names it). */
export const DEFAULT_BUFF_MINUTES = 20;

/** ⭐ Game value: the weight a row with none written gets. */
export const DEFAULT_EVENT_WEIGHT = 10;

const isKind = (kind) => kind === EVENT_KIND.NODE || kind === EVENT_KIND.BUFF;

function words(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const w of list) {
        const word = typeof w === 'string' ? w.trim().toLowerCase() : '';
        if (word && !out.includes(word)) out.push(word);
    }
    return out;
}

/** One row as the game reads it, from whatever the file holds under `id`; null when unusable. */
export function normaliseEvent(id, raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const key = String(raw.id || id || '').trim();
    if (!key) return null;
    const weight = Number(raw.weight);
    const minutes = Number(raw.durationMinutes);
    return {
        id: key,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : key,
        typeId: typeof raw.typeId === 'string' ? raw.typeId.trim() : '',
        kind: isKind(raw.kind) ? raw.kind : null,
        weight: Number.isFinite(weight) ? Math.max(0, weight) : DEFAULT_EVENT_WEIGHT,
        ground: words(raw.ground),
        biomes: words(raw.biomes),
        durationMinutes: minutes > 0 ? minutes : DEFAULT_BUFF_MINUTES
    };
}

/** The whole table as the game reads it, keyed by id: every row {@link normaliseEvent} can read. */
export function normaliseEventTable(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, row] of Object.entries(raw)) {
        const event = normaliseEvent(id, row);
        if (event) out[event.id] = event;
    }
    return out;
}

/** Whether a row can ever land: a kind, a Token type and a weight above zero. */
export function isRunnable(event) {
    return !!event && isKind(event.kind) && !!event.typeId && event.weight > 0;
}

/**
 * What is wrong with the table as authored, one `{ id, message }` per problem, for the boot audit
 * and the CMS. The lookups come from the caller so this stays pure.
 *
 * @param {object} raw the table as the file (or the CMS workspace) holds it
 * @param {object} lookups
 * @param {(typeId: string) => boolean} [lookups.hasTokenType]
 * @param {readonly string[]} [lookups.groundWords] the "Stands on" words
 * @param {readonly string[]} [lookups.biomes] the Region biomes the world knows
 */
export function eventProblems(raw, { hasTokenType = null, groundWords = null, biomes = null } = {}) {
    const problems = [];
    if (raw == null) return problems;
    if (typeof raw !== 'object' || Array.isArray(raw)) return [{ id: '', message: 'The events table is not a table of rows keyed by id.' }];
    for (const [key, row] of Object.entries(raw)) {
        const say = (message) => problems.push({ id: key, message });
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            say(`Event "${key}" is not a row.`);
            continue;
        }
        if (row.id != null && row.id !== key) say(`Event "${key}" says its id is "${row.id}".`);
        if (!isKind(row.kind)) say(`Event "${key}" has no kind (Rich node or Buff), so it never lands.`);
        const typeId = typeof row.typeId === 'string' ? row.typeId.trim() : '';
        if (!typeId) say(`Event "${key}" names no Token, so it never lands.`);
        else if (hasTokenType && !hasTokenType(typeId)) say(`Event "${key}" lands the Token "${typeId}", which does not exist.`);
        const weight = Number(row.weight);
        if (row.weight != null && !(weight > 0)) say(`Event "${key}" has a weight of ${row.weight}, so it never lands.`);
        if (row.kind === EVENT_KIND.BUFF && !(Number(row.durationMinutes) > 0)) {
            say(`Buff "${key}" has no time on the mat; it stays ${DEFAULT_BUFF_MINUTES} minutes.`);
        }
        if (groundWords) {
            for (const word of words(row.ground)) {
                if (!groundWords.includes(word)) say(`Event "${key}" lands on "${word}", which is not ground the game knows.`);
            }
        }
        if (biomes) {
            for (const biome of words(row.biomes)) {
                if (!biomes.includes(biome)) say(`Event "${key}" lands in the biome "${biome}", which the world does not have.`);
            }
        }
    }
    return problems;
}
