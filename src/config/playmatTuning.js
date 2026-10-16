// Fantasy Guild — Live tuning for the playmat's look (developer tool).

/**
 * The numbers that decide how the playmat *looks*, in one place, adjustable
 * while the game runs.
 *
 * ## ⚠️ Why this is in `config/` and not `ui/dev/`
 *
 * `src/systems/` is React-agnostic and must not import out of the UI tree,
 * and the ground plan's modules are systems. Config is the one place both
 * they and the panel can reach.
 *
 * ## This is a developer tool, not a player setting
 *
 * Values live in `localStorage`, per device. They are
 * **not** in the save: two players' boards should not differ because one of them
 * moved a slider, and a value here changing must never change what a save means.
 * Everything tunable here is appearance only — nothing reads these to decide
 * what a Token does or where it may stand.
 *
 * ## Adding one
 *
 * Add a row to `TUNABLES` and read it with `tuning('yourKey')`. The panel builds
 * itself from this table, so there is no UI to write.
 */

/**
 * Every adjustable number, with the range that is actually sensible for it.
 *
 * `group` only decides which heading it appears under. `step` should be fine
 * enough to feel continuous but no finer — a slider that reports four decimal
 * places invites false precision on a number whose effect is judged by eye.
 */
export const TUNABLES = Object.freeze([
    {
        key: 'edgeSwing',
        group: 'Terrain boundaries',
        label: 'Coast swing',
        hint: 'How far a boundary wanders from the cell line, as a share of a cell. ⚠️ Becomes a whole number of ground pixels, so it moves in jumps.',
        min: 0.1, max: 0.45, step: 0.0125, def: 0.3125
    },
    {
        key: 'edgeRoughness',
        group: 'Terrain boundaries',
        label: 'Coast roughness',
        hint: 'How spiky the boundary is, as a share of a cell. This is the one that reads as jagged.',
        min: 0, max: 0.16, step: 0.005, def: 0.070
    },
    {
        key: 'beachWidth',
        group: 'Shorelines',
        label: 'Beach width (u)',
        hint: 'How far the sand reaches inland wherever water meets land, in mat units. 0 removes the beach.',
        min: 0, max: 32, step: 2, def: 12
    },
    {
        key: 'shallowsWidth',
        group: 'Shorelines',
        label: 'Shallows width (u)',
        hint: 'How far the pale shallows reach out from the shore, in mat units. 0 turns them off.',
        min: 0, max: 40, step: 2, def: 16
    },
    {
        key: 'wetSandWidth',
        group: 'Shorelines',
        label: 'Wet sand width (u)',
        hint: 'How far the dark wet sand reaches up the beach from the water, in mat units. 0 turns it off.',
        min: 0, max: 24, step: 2, def: 8
    },
    {
        key: 'bandStrength',
        group: 'Shorelines',
        label: 'Band strength',
        hint: 'How strongly the shallows and the wet sand are recoloured. 0 makes them invisible.',
        min: 0, max: 2, step: 0.05, def: 1
    },
    {
        key: 'patchCoverage',
        group: 'Ground wear',
        label: 'Coverage',
        hint: 'Multiplies how much earth (or gravel) wears through. 1 is as authored, 0 hides it entirely.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'wearClump',
        group: 'Ground wear',
        label: 'Clump size (u)',
        hint: 'How big each worn patch is, in mat units. Small values approach dithering; large ones read as a second ground.',
        min: 8, max: 60, step: 2, def: 20
    },
    {
        key: 'propDensity',
        group: 'Scenery',
        label: 'Density',
        hint: 'Multiplies every look’s own scatter density. 1 is as authored.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'propScatter',
        group: 'Scenery',
        label: 'Scatter',
        hint: 'How far props stray from the middle of their cell. 0 plants them all dead centre.',
        min: 0, max: 1, step: 0.05, def: 0.64
    },
    {
        key: 'muteBrightness',
        group: 'Colour',
        label: 'Brightness',
        hint: 'How bright the ground art is drawn: 1 is the art as drawn. Baked into the sheets once, never a filter.',
        min: 0.5, max: 1.2, step: 0.01, def: 0.85
    },
    {
        key: 'muteSaturation',
        group: 'Colour',
        label: 'Saturation',
        hint: 'How colourful the ground art is drawn: 1 is the art as drawn, 0 grey.',
        min: 0, max: 1.2, step: 0.01, def: 0.7
    }
]);

const DEFAULTS = Object.freeze(
    Object.fromEntries(TUNABLES.map(t => [t.key, t.def]))
);

const STORAGE_KEY = 'fantasy_guild_playmat_tuning';

/** @type {Record<string, number>} */
let values = { ...DEFAULTS };

try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || 'null');
    if (stored && typeof stored === 'object') {
        for (const t of TUNABLES) {
            const v = stored[t.key];
            // Clamped rather than trusted: a stored value from an older build
            // may sit outside a range that has since been narrowed, and a
            // silently out-of-range number is worse than a reset one.
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

/**
 * The live value of one tunable.
 *
 * ⚠️ Call this at the point of use, every time. Capturing it into a module
 * constant would freeze it at import and the sliders would appear to do nothing.
 */
export function tuning(key) {
    return values[key] ?? DEFAULTS[key];
}

/** Set one, clamped to its declared range. Returns true if it changed. */
export function setTuning(key, value) {
    const def = TUNABLES.find(t => t.key === key);
    if (!def || !Number.isFinite(value)) return false;
    const next = Math.max(def.min, Math.min(def.max, value));
    if (next === values[key]) return false;
    values[key] = next;
    persist();
    listeners.forEach(fn => fn(key, next));
    return true;
}

/** Put everything back to how it ships. */
export function resetTuning() {
    values = { ...DEFAULTS };
    persist();
    listeners.forEach(fn => fn(null, null));
}

/** Whether anything currently differs from the shipped defaults. */
export function isTuned() {
    return TUNABLES.some(t => values[t.key] !== t.def);
}

/** The defaults, for the panel to show alongside the live value. */
export function tuningDefault(key) {
    return DEFAULTS[key];
}

/** A value as the panel shows it: no trailing zeros. */
function shown(value) {
    return String(Number(value.toFixed(4)));
}

/**
 * Every value as text, for the panel's Copy values: one line per slider (its label, its key, its
 * value, and what it ships at with a `*` when it differs), then the values as one JSON line. The
 * owner pastes it into chat after the eye-check; the look's fix round puts the numbers in code.
 */
export function tuningReport() {
    const moved = TUNABLES.filter(t => values[t.key] !== t.def);
    const lines = [moved.length ? `Playmat Tuner: ${moved.length} moved (*)` : 'Playmat Tuner: as it ships'];
    for (const t of TUNABLES) {
        const v = tuning(t.key);
        lines.push(v === t.def ? `${t.label} [${t.key}]: ${shown(v)}` : `${t.label} [${t.key}]: ${shown(v)} (ships ${shown(t.def)}) *`);
    }
    lines.push(JSON.stringify(Object.fromEntries(TUNABLES.map(t => [t.key, tuning(t.key)]))));
    return lines.join('\n');
}

/** Called whenever any value changes. Returns an unsubscribe. */
export function onTuningChanged(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
