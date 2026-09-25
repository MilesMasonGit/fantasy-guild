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

/**
 * The mat's fixed width-to-height ratio, repeated here for the same reason.
 * Kept in step with `MAT_ASPECT` in `matGeometry.js` — which imports THIS file,
 * so the dependency may not run the other way.
 */
const ASPECT = 0.64;

/**
 * A small Token's art radius, repeated here for the same reason — this file
 * imports nothing, so the hints below can quote real numbers without dragging
 * `matGeometry` (and the Token registry behind it) into the config layer.
 * Kept in step with `ART_RADIUS_BY_SIZE[1]` in `matGeometry.js`.
 */
const SMALL_ART_R = 64;

export const MAT_TUNABLES = Object.freeze([
    {
        key: 'nearRadius',
        group: 'Reach',
        label: 'Near radius',
        hint: 'How far an "nearby" rule reaches, centre to centre. 164 reaches the four side neighbours (160 u) but not the diagonals (226 u) — FP-75; a 2×2 Token reaches nothing below 253 u. 272 was the old 8-tile ring.',
        min: 100, max: 600, step: 1, def: 164,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    },
    {
        key: 'flagRadius',
        group: 'Flags',
        label: 'Flag radius',
        hint: 'How far from its flag a hero looks for work, centre to centre (FP-65, FP-75). 164 reaches the Token under the flag and its four side neighbours, not the diagonals (226 u). 400 was the old default.',
        min: 100, max: 1000, step: 1, def: 164,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    },
    {
        key: 'walkSpeed',
        group: 'Heroes',
        label: 'Walk speed',
        hint: 'How fast heroes walk, in mat units a second (Hero Movement HMP-4). The mat is 1760 u wide at 11 steps, so 120 crosses it in about 15 s. Walking costs work time (FP-26): a job starts when the hero arrives.',
        min: 20, max: 600, step: 1, def: 120,
        format: (v) => `${Math.round(v)} u/s · ${(1760 / v).toFixed(1)} s across`
    },
    {
        key: 'potterRadius',
        group: 'Heroes',
        label: 'Idle wander',
        hint: 'How far an idle hero strolls from their spot beside the flag, in mat units (Hero Movement HM-1). They pause 2-6 s between strolls and stroll at half walking speed. 0 makes idle heroes stand still.',
        min: 0, max: 240, step: 1, def: 80,
        format: (v) => (Math.round(v) === 0 ? 'off' : `${Math.round(v)} u`)
    },
    {
        key: 'hitboxPct',
        group: 'Crowding',
        label: 'Token hitbox',
        hint: 'How much of a Token’s art actually collides, as a percentage of its radius (FP-63, FP-64). Never drawn — a Token at rest is just its art. 80% makes a small Token’s hitbox 51 u of its 64 u art.',
        min: 40, max: 100, step: 1, def: 80,
        format: (v) => `${Math.round(v)}% · small ${Math.round(SMALL_ART_R * v / 100)} u`
    },
    {
        key: 'overlapPct',
        group: 'Crowding',
        label: 'Overlap allowed',
        hint: 'How far two hitboxes may overlap before a drop is refused (FP-63). At 80% hitbox, 40% overlap lets two small Tokens sit 61 u apart centre to centre — well under a 160 u tile step.',
        min: 0, max: 80, step: 1, def: 40,
        format: (v) => `${Math.round(v)}% · two small ${Math.round(2 * Math.round(SMALL_ART_R * matTuning('hitboxPct') / 100) * (1 - v / 100))} u apart`
    },
    {
        key: 'nudgeReach',
        group: 'Crowding',
        label: 'Nudge reach',
        hint: 'How far a drop with no room may be shifted to find a legal spot before it flies back instead (FP-46, FP-88). 0 makes every crowded drop fly back; 160 is one old tile step.',
        min: 0, max: 400, step: 1, def: 160,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    },
    {
        key: 'matSteps',
        group: 'The mat',
        label: 'Mat size',
        hint: 'How big the playmat itself is, in 160 u steps, at a fixed 0.64 aspect (FP-92). ⚠️ Shrinking it pulls Tokens that no longer fit back inside and spaces them apart (FP-98); flags are only pulled in. Growing it moves nothing.',
        min: 6, max: 20, step: 1, def: 11,
        format: (v) => `${Math.round(v)} steps · ${Math.round(v) * STEP_U} × ${Math.round(Math.round(v) * STEP_U * ASPECT)} u`
    },
    {
        key: 'matCap',
        group: 'The mat',
        label: 'Token cap',
        hint: 'The most Tokens the player may have placed on the mat (SP-10, SP-67). Counts only placed Tokens (spawners, stations, Foundations); spawned trees, veins and enemies are bounded by their own family caps instead. The Guild Hall never counts.',
        min: 1, max: 200, step: 1, def: 40,
        format: (v) => `${Math.round(v)} placed Tokens`
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
