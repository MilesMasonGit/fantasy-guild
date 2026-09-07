// Fantasy Guild — Live tuning for the playmat's look (developer tool).

/**
 * The numbers that decide how the playmat *looks*, in one place, adjustable
 * while the game runs.
 *
 * The terrain has a lot of small constants — how far a coastline wanders, how
 * spiky it is, how thickly trees grow — and every one of them was tuned by
 * editing a file, reloading, and squinting. That is a slow way to find a look,
 * and it means only whoever can edit the code can find it. This makes them
 * sliders instead.
 *
 * ## ⚠️ Why this is in `config/` and not `ui/dev/`
 *
 * `src/systems/` is React-agnostic and must not import out of the UI tree
 * (CR2-051), and `TerrainLattice` and `TerrainProps` are both systems. Config is
 * the one place both they and the panel can reach. It follows the precedent set
 * by the art-set switch in `terrainRegistry`.
 *
 * ## This is a developer tool, not a player setting
 *
 * Values live in `localStorage`, per device, exactly like the art set. They are
 * **not** in the save: two players' boards should not differ because one of them
 * moved a slider, and a value here changing must never change what a save means.
 * Everything tunable here is appearance only — nothing reads these to decide
 * what a Token does or what a tile holds.
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
        hint: 'How far a boundary wanders from the grid. ⚠️ Becomes a whole number of art pixels, so it moves in jumps.',
        min: 0.1, max: 0.45, step: 0.0125, def: 0.3125
    },
    {
        key: 'edgeRoughness',
        group: 'Terrain boundaries',
        label: 'Coast roughness',
        hint: 'How spiky the boundary is. This is the one that reads as jagged.',
        min: 0, max: 0.16, step: 0.005, def: 0.070
    },
    {
        key: 'ownerJitter',
        group: 'Terrain boundaries',
        label: 'Tile bleed',
        hint: 'How far one tile’s terrain reaches into its neighbours. Above ~3 the board turns to soup.',
        min: 0, max: 4, step: 0.1, def: 3.0
    },
    {
        key: 'ownerCoarseShare',
        group: 'Terrain boundaries',
        label: 'Bleed smoothness',
        hint: 'High values make boundaries meander in runs; low values make them fizz like dithering.',
        min: 0, max: 1, step: 0.05, def: 0.65
    },
    {
        key: 'bandWidth',
        group: 'Shorelines',
        label: 'Band width',
        hint: 'How far shallows and wet sand reach in from an edge. 0 turns the banding off.',
        min: 0, max: 3, step: 0.1, def: 1
    },
    {
        key: 'bandStrength',
        group: 'Shorelines',
        label: 'Band strength',
        hint: 'How strongly the band is recoloured against its own terrain. 0 makes it invisible.',
        min: 0, max: 2, step: 0.05, def: 1
    },
    {
        key: 'patchCoverage',
        group: 'Ground patches',
        label: 'Coverage',
        hint: 'Multiplies how much bare earth wears through. 1 is as authored, 0 hides it entirely.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'patchScale',
        group: 'Ground patches',
        label: 'Clump size',
        hint: 'How big each patch is. Low values approach per-pixel dithering; high ones read as a second terrain.',
        min: 0.4, max: 3, step: 0.1, def: 1
    },
    {
        key: 'propDensity',
        group: 'Scenery',
        label: 'Density',
        hint: 'Multiplies every terrain’s own prop density. 1 is as authored.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'propScatter',
        group: 'Scenery',
        label: 'Scatter',
        hint: 'How far props stray from the middle of their subtile. 0 plants them all dead centre.',
        min: 0, max: 1, step: 0.05, def: 0.64
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
 * constant would freeze it at import and the sliders would appear to do nothing
 * — the same trap the art set fell into.
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

/** Called whenever any value changes. Returns an unsubscribe. */
export function onTuningChanged(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
