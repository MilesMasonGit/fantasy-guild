// Fantasy Guild — Live tuning for the free playmat's rules (developer tool, FP-66).

/**
 * The numbers the Free Playmat rework will need to feel out, adjustable while
 * the game runs — the **Mat Tuner** panel builds itself from this table.
 *
 * ## Not the Playmat Tuner
 * `playmatTuning.js` tunes how the *terrain looks* and is hidden while terrain
 * is dormant (FP-10). This one tunes how the mat *plays*: a value here changes
 * what a Token reaches. It is a separate panel by owner ruling (FP-66).
 *
 * ## Each slice adds its own row
 * Slice 1.2 adds **Near radius**. Later slices add flag radius (1.4), hitbox,
 * overlap and mat size (1.6). The values the owner settles on are written into
 * `def` at slice 1.11.
 *
 * ## ⚠️ Developer tool, persisted per device — like the Playmat Tuner
 * Values live in `localStorage` (same behaviour as `playmatTuning.js`), never in
 * the save. Unlike that panel, **these change gameplay** on this device, so the
 * panel marks a changed value and offers a reset to the shipped default.
 *
 * Read with `matTuning('key')` at the point of use, every time — capturing a
 * value into a module constant would freeze it at import.
 */

/** Tile step in mat units, repeated here so this config file imports nothing. */
const STEP_U = 160;

export const MAT_TUNABLES = Object.freeze([
    {
        key: 'nearRadius',
        group: 'Reach',
        label: 'Near radius',
        hint: 'How far an "adjacent" rule reaches, centre to centre. 272 reproduces today\'s 8-tile ring (diagonal neighbour 226 u, next ring 320 u).',
        min: 100, max: 600, step: 1, def: 272,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    }
]);

const DEFAULTS = Object.freeze(
    Object.fromEntries(MAT_TUNABLES.map(t => [t.key, t.def]))
);

const STORAGE_KEY = 'fantasy_guild_mat_tuning';

/** @type {Record<string, number>} */
let values = { ...DEFAULTS };

try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || 'null');
    if (stored && typeof stored === 'object') {
        for (const t of MAT_TUNABLES) {
            const v = stored[t.key];
            // Clamped rather than trusted, as in playmatTuning.
            if (typeof v === 'number' && Number.isFinite(v)) {
                values[t.key] = Math.max(t.min, Math.min(t.max, v));
            }
        }
    }
} catch {
    // No storage, or corrupt. Defaults are correct.
}

const listeners = new Set();

function persist() {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
        // Not being able to remember a tweak does not stop making it.
    }
}

/** The live value of one tunable. */
export function matTuning(key) {
    return values[key] ?? DEFAULTS[key];
}

/** Set one, clamped to its declared range. Returns true if it changed. */
export function setMatTuning(key, value) {
    const def = MAT_TUNABLES.find(t => t.key === key);
    if (!def || !Number.isFinite(value)) return false;
    const next = Math.max(def.min, Math.min(def.max, value));
    if (next === values[key]) return false;
    values[key] = next;
    persist();
    listeners.forEach(fn => fn(key, next));
    return true;
}

/** Put everything back to how it ships. */
export function resetMatTuning() {
    const changed = isMatTuned();
    values = { ...DEFAULTS };
    persist();
    if (changed) listeners.forEach(fn => fn(null, null));
}

/** Whether anything currently differs from the shipped defaults. */
export function isMatTuned() {
    return MAT_TUNABLES.some(t => values[t.key] !== t.def);
}

/** The shipped default of one tunable. */
export function matTuningDefault(key) {
    return DEFAULTS[key];
}

/** Called whenever any value changes. Returns an unsubscribe. */
export function onMatTuningChanged(fn) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
