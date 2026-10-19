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
 * itself from this table, so there is no UI to write. A row marked `toggle`
 * (0 off, 1 on) shows as a checkbox rather than a slider.
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
        key: 'blendOn',
        group: 'Biome borders',
        label: 'Blended borders',
        hint: 'Where two biomes’ ground meet, blend them in one of the owner’s styles: a mixed band, islands, fingers, a lawn between, or a fade. Off draws the plain border the cells give.',
        toggle: true,
        min: 0, max: 1, step: 1, def: 1
    },
    {
        key: 'blendWidth',
        group: 'Biome borders',
        label: 'Blend width (u)',
        hint: 'How wide the band across a border is, in mat units (a Token is 128). Islands and fingers reach half as far again.',
        min: 16, max: 256, step: 8, def: 160
    },
    {
        key: 'blendStyle',
        group: 'Biome borders',
        label: 'Blend style',
        hint: '0 lets each Region pick by its seed. 1 mixed band, 2 islands, 3 fingers, 4 a lawn between (a wood beside rock or sand only), 5 fade.',
        min: 0, max: 5, step: 1, def: 0
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
        key: 'patternOn',
        group: 'Ground pattern',
        label: 'Shade pattern',
        hint: 'Large areas of each ground drawn a little lighter or darker, several Tokens wide, with hard edges. Off draws every sheet as it is.',
        toggle: true,
        min: 0, max: 1, step: 1, def: 1
    },
    {
        key: 'patternScale',
        group: 'Ground pattern',
        label: 'Pattern scale (u)',
        hint: 'How big the lighter and darker areas are, in mat units: a Token is 128.',
        min: 128, max: 768, step: 16, def: 384
    },
    {
        key: 'patternStrength',
        group: 'Ground pattern',
        label: 'Pattern strength',
        hint: 'How much lighter and darker those areas are than the sheet as drawn: 0.08 is 8 % each way. 0 turns them off. Each generated look takes its own share of it, as its rules say: the meadow all of it, the forest twice, the sand a little less, the sea none.',
        min: 0, max: 0.2, step: 0.01, def: 0.08
    },
    {
        key: 'patchCoverage',
        group: 'Ground wear',
        label: 'Coverage',
        hint: 'Multiplies how much gravel wears through rock, and earth through grass while Generated ground is off (the generated ground has its own Earth amount). 1 is as authored, 0 hides it entirely.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'wearClump',
        group: 'Ground wear',
        label: 'Clump size (u)',
        hint: 'How big each worn patch of gravel (and of earth, while Generated ground is off) is, in mat units: at the same coverage, bigger patches are fewer. Small values approach dithering.',
        min: 8, max: 120, step: 2, def: 60
    },
    {
        key: 'wearEdgeWidth',
        group: 'Ground wear',
        label: 'Edge width (u)',
        hint: 'Sheets only (Generated ground off): how wide the darker rim inside a worn patch and the lighter fringe round it are, in mat units; 2 is one ground pixel at full size. 0 turns both off.',
        min: 0, max: 8, step: 2, def: 2
    },
    {
        key: 'wearRim',
        group: 'Ground wear',
        label: 'Rim darkness',
        hint: 'Sheets only (Generated ground off): how much darker the earth is along the edge of a worn patch. 0 turns the rim off.',
        min: 0, max: 0.6, step: 0.02, def: 0.3
    },
    {
        key: 'wearFringe',
        group: 'Ground wear',
        label: 'Fringe lightness',
        hint: 'Sheets only (Generated ground off): how much lighter the grass is round a worn patch. 0 turns the fringe off.',
        min: 0, max: 0.4, step: 0.02, def: 0.12
    },
    {
        key: 'wearMiddle',
        group: 'Ground wear',
        label: 'Wear in the middle',
        hint: 'More wear toward the middle of the mat, where the Hall and the Tokens gather, and less toward its edges; the total stays the same. 0 spreads it evenly.',
        min: 0, max: 1, step: 0.05, def: 0
    },
    {
        key: 'grassOn',
        group: 'Generated ground',
        label: 'Generated ground',
        hint: 'Every ground drawn by rules: clumps, mounds, blades, kinds of ground in zones, earth the grass reaches into, the sea with its foam and waves. Off draws the old sheets.',
        toggle: true,
        min: 0, max: 1, step: 1, def: 1
    },
    {
        key: 'grassStrokes',
        group: 'Generated ground',
        label: 'Stroke density',
        hint: 'Multiplies how many blade strokes every kind of ground carries (grass, flowers, cracks, ripples). 1 is the prototype; 0 leaves only the clumps and mounds.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'grassPatch',
        group: 'Generated ground',
        label: 'Texture patches',
        hint: 'How much of the ground lies outside the patches where the strokes gather: 0 spreads them evenly; higher leaves calmer ground between fewer patches. Moves every kind’s own patches by as much.',
        min: 0, max: 1, step: 0.05, def: 0.55
    },
    {
        key: 'grassPatchFloor',
        group: 'Generated ground',
        label: 'Strokes between patches',
        hint: 'The share of strokes kept outside the patches: 1 keeps them all (no patches), 0 leaves bare ground between. Moves every kind’s own share by as much.',
        min: 0, max: 1, step: 0.05, def: 0.6
    },
    {
        key: 'grassZoneScale',
        group: 'Generated ground',
        label: 'Zone scale',
        hint: 'Multiplies how big the zones of each kind of grass are. 1 is the settled rules: in the meadow about a Token across, a little more in the forest.',
        min: 0.4, max: 3, step: 0.05, def: 1
    },
    {
        key: 'grassTall',
        group: 'Generated ground',
        label: 'Tall grass / ferns',
        hint: 'The share of the grass that is the meadow’s tall grass (long dark strokes), or the forest’s ferns. The meadow and the forest only: the other looks lay their kinds where their rules say.',
        min: 0, max: 0.6, step: 0.01, def: 0.23
    },
    {
        key: 'grassDry',
        group: 'Generated ground',
        label: 'Dry grass / leaf litter',
        hint: 'The share of the grass that is the meadow’s dry grass (short yellow strokes, flower-like tips), or the forest’s leaf litter. The meadow and the forest only.',
        min: 0, max: 0.6, step: 0.01, def: 0.27
    },
    {
        key: 'grassEarth',
        group: 'Generated ground',
        label: 'Earth amount',
        hint: 'Multiplies how much bare earth each look has. 1 is the settled rules: about a tenth of the meadow bare once the grass has reached back in, a little more of the forest.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'grassEncroach',
        group: 'Generated ground',
        label: 'Grass into earth',
        hint: 'How far grass fingers and islands reach into the earth from its edge. 0 gives earth with clean, round edges. Moves every look’s own amount by as much (the mountain reaches in less).',
        min: 0, max: 1, step: 0.05, def: 0.85
    },
    {
        key: 'grassBodySoft',
        group: 'Generated ground',
        label: 'Clump softness',
        hint: 'How close the darker clumps are to the lighter ones (the rounds’ body_soft): 0 is full contrast, 1 one flat tone. Moves every look’s own softness by as much (the sand is softer).',
        min: 0, max: 1, step: 0.05, def: 0.55
    },
    {
        key: 'grassClump',
        group: 'Generated ground',
        label: 'Grass clump size (u)',
        hint: 'How big the light and dark clumps of the grass are, in mat units: 32 is the prototype’s 16 Token pixels.',
        min: 8, max: 96, step: 2, def: 32
    },
    {
        key: 'grassMounds',
        group: 'Generated ground',
        label: 'Mound strength',
        hint: 'How often a mound shows its lit top and its shadowed bottom edge. 1 is the prototype; 0 removes the mounds.',
        min: 0, max: 2, step: 0.05, def: 1
    },
    {
        key: 'groundLakes',
        group: 'Generated ground',
        label: 'Sulphur lakes',
        hint: 'Multiplies how many sulphur lakes Yellowstone has: 1 is the prototype’s two in every piece of the mat its size (about fifteen on a full mat). 0 removes them.',
        min: 0, max: 2, step: 0.05, def: 1
    },
    {
        key: 'groundStrength',
        group: 'Generated ground',
        label: 'Ground strength',
        hint: 'Pulls every generated look’s colours toward its middle tone: less saturated and less contrast at once. 1 is as the rules draw them; 0.85 a little softer.',
        min: 0.5, max: 1.2, step: 0.01, def: 1
    },
    {
        key: 'propDensity',
        group: 'Scenery',
        label: 'Density',
        hint: 'Multiplies every look’s own scatter density: how many props there are. 1 is as authored.',
        min: 0, max: 3, step: 0.05, def: 1
    },
    {
        key: 'propGroupSize',
        group: 'Scenery',
        label: 'Group size',
        hint: 'The most props in one group, all of one kind; a group has between half that and that many. 1 scatters them singly.',
        min: 1, max: 8, step: 1, def: 6
    },
    {
        key: 'propGroupSpread',
        group: 'Scenery',
        label: 'Group spread (u)',
        hint: 'How far apart the props of one group stand, in mat units.',
        min: 4, max: 32, step: 2, def: 16
    },
    {
        key: 'propScatter',
        group: 'Scenery',
        label: 'Scatter',
        hint: 'How far a group strays from the middle of its patch of ground (a Token square). 0 plants every group dead centre.',
        min: 0, max: 1, step: 0.05, def: 0.64
    },
    {
        key: 'muteBrightness',
        group: 'Colour',
        label: 'Brightness',
        hint: 'How bright the ground sheets and their scatter are drawn: 1 is the art as drawn. Baked into the sheets once, never a filter. The generated ground and its scatter are drawn as they are (see Ground strength).',
        min: 0.5, max: 1.2, step: 0.01, def: 0.85
    },
    {
        key: 'muteSaturation',
        group: 'Colour',
        label: 'Saturation',
        hint: 'How colourful the ground sheets and their scatter are drawn: 1 is the art as drawn, 0 grey. The generated ground and its scatter are drawn as they are (see Ground strength).',
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
