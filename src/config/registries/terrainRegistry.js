// Fantasy Guild — how the ground looks: the looks, their rules and the sheets they draw with.

import { TERRAIN } from '../../systems/atlas/TerrainMap.js';
import { STYLE, STYLE_TERRAIN } from '../../systems/atlas/WaterShapes.js';

/**
 * A Region's ground is its Atlas cell map (`TerrainMap.js`): one terrain per cell. This says what
 * each terrain *looks like*: one look per terrain per Region, from the biome that owns that
 * terrain (`regionGround.looksForGround`), so a hybrid's grass is forest grass and its rock
 * mountain rock, and grass no biome owns is meadow.
 *
 * ## Why this lives in code and not the CMS
 *
 * Presentation config, like `sprite-manifest.js` beside it: no balance numbers, nothing a player
 * reads as content. A code table so the look can be iterated on without building an editor.
 *
 * ⚠️ **Art paths live here rather than in `sprite-manifest.js`.** The CMS *writes* that file
 * (`cms/vite-plugin-cms-api.js` POST /api/register-sprite), so it is a CMS-owned artefact; ground
 * art is not CMS content.
 */

/**
 * The ground a transition blend lays between two biomes (`TerrainBlend`): a drawing id only, like
 * the water's `STYLE_TERRAIN`. Nothing stores it, and the cells keep their own terrain.
 */
export const LAWN_TERRAIN = 'grass:lawn';

/** A ground sheet's side in pixels: each is one seamless fill. */
export const SHEET_PX = 64;

/**
 * The ground sheets in `public/assets/playmat/terrain/` (`g_<id>.png`), one per ground. Two are
 * recolours: `grass_dark` is the forest's darker ground; `water_bright`, a much brighter sea, is
 * the lakes' and the sulphur springs'.
 */
export const SHEETS = Object.freeze(['grass', 'grass_dark', 'dirt', 'gravel', 'sand', 'stone', 'water', 'water_bright']);

/** Where a ground sheet lives. */
export function sheetPath(sheetId) {
    return `/assets/playmat/terrain/g_${sheetId}.png`;
}

/** A prop's side in pixels: one prop pixel is one ground pixel, the same size as a Token's. */
export const PROP_PX = 16;

/** Props across (and down) one prop sheet. */
export const PROP_SHEET_CELLS = 4;

/**
 * The owner's prop sheets in `public/assets/playmat/props/`: each a 4 × 4 grid of 16-pixel flat
 * bits, fully opaque or fully clear. `props/sheets/` holds irregular source sheets the game does
 * not read.
 */
export const PROP_SHEETS = Object.freeze([
    'p_bush', 'p_bush_dark', 'p_coast', 'p_flowers', 'p_mushroom', 'p_rock', 'p_rock_sand'
]);

/** Where a prop sheet lives. */
export function propSheetPath(sheetId) {
    return `/assets/playmat/props/${sheetId}.png`;
}

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        for (const v of Object.values(value)) deepFreeze(v);
        Object.freeze(value);
    }
    return value;
}

/** A flower meadow's drifts: the meadow's dry grass with flowers for strokes, in their own patches. */
const FLOWERS = { blades: 0.06, cluster: 4, heights: [1, 2], tips: 0.25, shadow: 0.5, mounds: 18, tone: 2, patch: { cell: 26, cut: 0.5, floor: 0.15 }, sway: true };

/**
 * The looks. Each draws one terrain:
 * - `sheets`: the ground sheet, or its alternates; a Region draws one of them throughout, picked
 *   by its seed (`TerrainSurface.sheetFor`). Never one per cell: two seamless sheets side by side
 *   show a square seam.
 * - `wear`: a second sheet showing through in clumps, `coverage` the share of the ground it takes
 *   (calibrated, `TerrainPatches`); with `rim`, each clump gets a darker rim and the ground round
 *   it a lighter fringe (`TerrainShade`), so it reads as worn into the ground.
 * - `band`: how the look shades its own edge where `against` (any other ground when absent)
 *   touches it: a `tint` mixed in by `amount`, as wide as the `widthTuning` slider (mat units).
 * - `fringe`: a different terrain written onto the neighbours, `widthTuning` wide: the beach the
 *   sea cuts into whatever land it meets, except the terrains in `except`.
 * - `props`: the prop sheets it scatters from, by weight; `propDensity` how many props it carries,
 *   as a share of its cells (they stand in groups, `TerrainProps`).
 * - `generated`: the look is drawn by rules instead of its sheet and wear (`TerrainGrass`), from
 *   one of the owner's settled rule sets (`docs/active/research/ground_gen/`, named beside each).
 *   The sheet, wear and band stay for when the "Generated ground" switch is off.
 * - `ambient`: the life over it (`ambientSky.js`): the one light colour of the small birds that
 *   land on Tokens standing on it, and the `particles` that drift over it (leaves, petals or
 *   embers), if any.
 *
 * A generated land look: colours are hue-shifted 5-colour ramps `[hue, lightness, saturation]`,
 * `grass` the body (each kind may have its own), `earth` the bare ground (null for none).
 * `earthShare` is how much wears bare before the grass reaches back in (about 58 % of it stays
 * bare at the meadow's `encroach`); `soft` how close the body's darker clumps come to its lighter
 * ones; `tint` the prototype's shade-pattern strength (the meadow's 0.06 is the slider's own).
 * `zones` lay its `kinds` along a noise of `cell` Token pixels, `stretch`ed along x and y: with
 * `sliders` the Tall and Dry sliders share three kinds out; else band `b` of the noise, cut at the
 * raw `cuts` (evenly, one band per `order` entry, when absent), is kind `order[b]`, and a `gap`
 * hands band `band` to kind `to` where a second noise of `cell` is under `cut` (a seam broken into
 * pieces). Each kind: how many stroke centres (`blades`, a chance per pixel) of `cluster` strokes,
 * their `heights`, the chance of a lit `tips` and of a `shadow` pixel, the `mounds` noise cell (0
 * none) and how often a mound shows its lit top (`moundLight`), the body's two tones (`body`, steps
 * of its ramp), the stroke colour (step `tone` of its own `strokes` ramp, or of its body ramp
 * without one), and the `patch`es its strokes gather in; a kind that is grass (`sway`) has its
 * blades and tufts lean in a passing gust, and one that `glow`s (the lava) pulses
 * (`ambientGround.js`): cracks, ripples, petals, litter and moss lie still. An `overlay` lays one
 * kind over the zones where its own noise is above `cut`, its blades reaching over the top edge
 * and a shadow under the
 * bottom; `pools` are the sulphur lakes, `perFrame` of them in the prototype's 320 × 200 pixels;
 * `shore` the wet sand (up to `wet` pixels from the water) and the dithered waterline (up to
 * `line`) drawn where the look meets water, in the prototype's pixels.
 *
 * A generated water look (`water`): the sea by distance from the shore, in the prototype's pixels
 * (its shore fractions × 320): foam, shallows, deeper water, and waves as strokes growing longer
 * with distance (`waveLengths`, from each distance on), `waveGap` pixels apart. With `field`, the
 * distance is the water's shape (`WaterShapes`) rather than measured on the drawn shore, as the
 * prototype's `water_field` drew it, and the land round it takes a `bank` (`at`: up to how many
 * pixels out from the waterline each step reaches, and its colour); a `rings` water is coloured
 * by its depth alone, ring `k` from `ringAt[k - 1]` pixels in.
 *
 * ⚠️ First values, retuned at the eye-check with the Playmat Tuner. The shoreline widths (the
 * tuning sliders) carry over from the 8-pixel ground set, where an art pixel was 4 units; the
 * gravel share and the scatter are guesses.
 */
export const LOOKS = deepFreeze({
    meadow: {
        id: 'meadow', name: 'Meadow', terrain: TERRAIN.GRASS, sheets: ['grass'],
        wear: { sheet: 'dirt', coverage: 0.10, rim: true },
        // `final_spec.json`: tall, lawn and dry grass.
        generated: {
            grass: [0.26, 0.44, 0.60], earth: [0.06, 0.38, 0.32], earthShare: 0.175, tint: 0.06,
            zones: { cell: 55, sliders: true },
            kinds: [
                { id: 'tall', blades: 0.036, cluster: 5, heights: [3, 3, 4], tips: 0.15, shadow: 0.55, mounds: 12, strokes: [0.30, 0.36, 0.58], tone: 2, sway: true },
                { id: 'lawn', blades: 0.02975, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3, sway: true },
                { id: 'dry', blades: 0.054, cluster: 3, heights: [1, 2, 2], tips: 0.2, shadow: 0.5, mounds: 18, strokes: [0.16, 0.50, 0.62], tone: 2, sway: true }
            ]
        },
        props: [{ sheet: 'p_flowers', weight: 2 }, { sheet: 'p_bush', weight: 1 }],
        propDensity: 0.06,
        ambient: { bird: '#f2ecd6' }
    },
    forest: {
        id: 'forest', name: 'Forest', terrain: TERRAIN.GRASS, sheets: ['grass_dark'],
        // Less than the meadow: leaf litter and shade, not footfall.
        wear: { sheet: 'dirt', coverage: 0.08, rim: true },
        // `forest_spec.json`: ferns, lawn and leaf litter, twice the meadow's dappled shade.
        generated: {
            grass: [0.31, 0.36, 0.50], earth: [0.05, 0.30, 0.28], earthShare: 0.205, tint: 0.12,
            zones: { cell: 75, sliders: true },
            kinds: [
                { id: 'fern', blades: 0.03, cluster: 6, heights: [3, 4, 4], tips: 0.15, shadow: 0.55, mounds: 12, strokes: [0.36, 0.30, 0.55], tone: 2, sway: true },
                { id: 'lawn', blades: 0.02, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3, sway: true },
                { id: 'litter', blades: 0.08, cluster: 3, heights: [1, 1, 2], tips: 0.15, shadow: 0.5, mounds: 18, strokes: [0.085, 0.38, 0.45], tone: 2 }
            ]
        },
        props: [
            { sheet: 'p_bush_dark', weight: 2 }, { sheet: 'p_mushroom', weight: 1 }, { sheet: 'p_flowers', weight: 1 }
        ],
        propDensity: 0.1,
        ambient: { bird: '#efe4c4', particles: 'leaves' }
    },
    mountain: {
        id: 'mountain', name: 'Mountain', terrain: TERRAIN.ROCK, sheets: ['stone'],
        wear: { sheet: 'gravel', coverage: 0.15 },
        // `mountain_spec.json`, `mountain3.py` C: calm grey rock, alpine grass in broken seams
        // along stretched bands, clumped scree, gravel for earth.
        generated: {
            grass: [0.60, 0.46, 0.10], earth: [0.60, 0.52, 0.06], earthShare: 0.148, encroach: 0.6, tint: 0.07,
            zones: { cell: 60, stretch: [3, 1], cuts: [0.45, 0.55, 0.70], order: [0, 1, 0, 2], gap: { band: 1, cell: 9, cut: 0.45, to: 0 } },
            kinds: [
                { id: 'rock', blades: 0.012, cluster: 2, heights: [1, 2], tips: 0, shadow: 0, mounds: 12, moundLight: 0.7, strokes: [0.60, 0.36, 0.14], tone: 1 },
                { id: 'alpine', grass: [0.27, 0.42, 0.50], blades: 0.05, cluster: 4, heights: [2, 3, 3], tips: 0.15, shadow: 0.55, mounds: 12, strokes: [0.27, 0.36, 0.55], tone: 2, sway: true },
                { id: 'scree', blades: 0.05, cluster: 7, heights: [1], tips: 0, shadow: 0.8, mounds: 18, strokes: [0.60, 0.50, 0.06], tone: 3, patch: { cell: 14, cut: 0.55, floor: 0.05 } }
            ]
        },
        props: [{ sheet: 'p_rock', weight: 1 }],
        propDensity: 0.05,
        ambient: { bird: '#e2e9ef' }
    },
    coast: {
        id: 'coast', name: 'Coast', terrain: TERRAIN.SAND, sheets: ['sand'],
        // Wet sand where the water reaches: caused by the water, not by having an edge, or the
        // beach comes out wet where it meets the grass.
        band: { widthTuning: 'wetSandWidth', tint: '#6b4a25', amount: 0.3, against: [TERRAIN.WATER] },
        // `coast_spec.json`, `coast4.py` C: golden sand with dune grass, ripples and shells, wet
        // sand and a waterline at the water.
        generated: {
            grass: [0.11, 0.58, 0.42], earth: null, earthShare: 0, soft: 0.7, tint: 0.05,
            zones: { cell: 60 },
            kinds: [
                { id: 'dune', blades: 0.05, cluster: 5, heights: [2, 3, 3], tips: 0.15, shadow: 0.55, mounds: 20, moundLight: 0.4, strokes: [0.22, 0.42, 0.45], tone: 2, sway: true },
                { id: 'ripples', blades: 0.03, cluster: 3, heights: [1], tips: 0, shadow: 0, mounds: 20, moundLight: 0.4, strokes: [0.11, 0.50, 0.42], tone: 1 },
                { id: 'shells', blades: 0.04, cluster: 2, heights: [1], tips: 0, shadow: 0.6, mounds: 20, moundLight: 0.4, strokes: [0.05, 0.62, 0.35], tone: 3, patch: { cell: 20, cut: 0.6, floor: 0 } }
            ],
            shore: { sand: [0.11, 0.58, 0.42], wet: 11.2, line: 3.2 }
        },
        props: [{ sheet: 'p_coast', weight: 2 }, { sheet: 'p_rock_sand', weight: 1 }],
        propDensity: 0.05,
        ambient: { bird: '#fcfcfa' }
    },
    sea: {
        id: 'sea', name: 'Sea', terrain: TERRAIN.WATER, sheets: ['water'],
        // Shallows: the sea going pale wherever it meets land.
        band: { widthTuning: 'shallowsWidth', tint: '#a8e8ff', amount: 0.45 },
        // A beach wherever it comes ashore, so water never meets grass or rock directly. Written
        // onto the land as real sand, so it takes the wet-sand band, no wear and no forest scatter.
        // Never onto a lake or a spring beside it.
        fringe: { terrain: TERRAIN.SAND, widthTuning: 'beachWidth', except: [STYLE_TERRAIN[STYLE.LAKE], STYLE_TERRAIN[STYLE.SULPHUR]] },
        // `coast_spec.json`, `coast4.py` C with `gen.coast2`: calm water in depth steps, a broken
        // foam line with flecks, the fewest and widest-spaced waves, rolling swells far out.
        generated: {
            water: {
                sea: [0.47, 0.46, 0.55], foam: 5.12, foamLight: 1.35, foam2Light: 1.12, shallow: 19.2, deep: 70.4,
                flecks: 0.004, waves: 0.007, waveMask: 0.4, wavePatchCell: 30, waveGap: 5, farThick: 76.8,
                waveLengths: [[19.2, [1, 1, 2]], [38.4, [2, 3]], [64, [4, 5, 6, 7]], [89.6, [6, 7, 8, 9]]]
            }
        }
    },
    lake: {
        id: 'lake', name: 'Lake', terrain: TERRAIN.WATER, sheets: ['water_bright'],
        // `gen.water_field` with `world6.py`'s colours: a wet bank on the land, a broken foam line,
        // shallows, water and deep water by the depth, waves longer the deeper.
        generated: {
            water: {
                field: true, sea: [0.50, 0.44, 0.52], foam: 1.2, solidFoam: false, foamLight: 1.30, foam2Light: 1.1,
                trough: 1, shallow: 5, deep: 14, flecks: 0, waves: 0.004, waveMask: 0, wavePatchCell: 30, waveGap: 3,
                farThick: null, waveLengths: [[5, [2]], [9, [3, 4, 5]], [18, [5, 6, 7, 8]]],
                bank: { ramp: [0.08, 0.34, 0.30], at: [[1, 0], [2.5, 1]] }
            }
        }
    },
    sulphur: {
        id: 'sulphur', name: 'Sulphur spring', terrain: TERRAIN.WATER, sheets: ['water_bright'],
        // Yellowstone's springs (`gen.pools`): pale cyan at the rim, blue, a milky middle, ringed on
        // the land by a pale yellow crust. The rings fall where the prototype's did on a spring of
        // 100 mat units: its 0.74 of the radius is the waterline, 0.62 and 0.42 the rings inside.
        generated: {
            water: {
                field: true, rings: [[176, 222, 226], [122, 196, 214], [150, 214, 228]], ringAt: [6, 16],
                bank: { colours: [[226, 214, 120], [200, 186, 96]], at: [[4, 0], [7, 1]] }
            }
        }
    },
    flower_meadow: {
        id: 'flower_meadow', name: 'Flower meadow', terrain: TERRAIN.GRASS, sheets: ['grass'],
        wear: { sheet: 'dirt', coverage: 0.10, rim: true },
        // `flower_volcano_spec.json`, `refine_fv.py` FB: a bright lawn, drifts of pink, purple
        // and white flowers between calm lawn.
        generated: {
            grass: [0.25, 0.47, 0.62], earth: [0.06, 0.38, 0.32], earthShare: 0.175, tint: 0.06,
            zones: { cell: 55, order: [0, 1, 2, 1, 3, 1] },
            kinds: [
                { id: 'pink', ...FLOWERS, strokes: [0.92, 0.66, 0.55] },
                { id: 'lawn', blades: 0.02975, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3, sway: true },
                { id: 'purple', ...FLOWERS, strokes: [0.78, 0.62, 0.5] },
                { id: 'white', ...FLOWERS, strokes: [0.12, 0.85, 0.15] }
            ]
        },
        props: [{ sheet: 'p_flowers', weight: 3 }, { sheet: 'p_bush', weight: 1 }],
        propDensity: 0.06,
        ambient: { bird: '#dceaf8' }
    },
    cherry_grove: {
        id: 'cherry_grove', name: 'Cherry grove', terrain: TERRAIN.GRASS, sheets: ['grass'],
        // `cherry_spec.json`, `cherry4.py`: pink-lavender moss with magenta and white petals, no
        // earth, patches of green grass whose blades reach over their top edge.
        generated: {
            grass: [0.88, 0.62, 0.38], earth: null, earthShare: 0, tint: 0.06,
            zones: { cell: 55 },
            kinds: [
                { id: 'magenta', blades: 0.06, cluster: 3, heights: [1, 1, 2], tips: 0.35, shadow: 0.5, mounds: 18, strokes: [0.92, 0.55, 0.75], tone: 2 },
                { id: 'moss', blades: 0.03, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: [0.86, 0.70, 0.35], tone: 3 },
                { id: 'white', blades: 0.05, cluster: 3, heights: [1, 1, 2], tips: 0.35, shadow: 0.5, mounds: 18, strokes: [0.0, 0.92, 0.20], tone: 2 },
                { id: 'green', grass: [0.30, 0.45, 0.55], blades: 0.045, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3, sway: true }
            ],
            overlay: { kind: 3, cell: 40, fineCell: 10, fine: 0.2, jagCell: 4, jag: 0.06, cut: 0.64, blades: 0.55, heights: [1, 2, 2, 3], shadow: 0.7, dim: 0.88 }
        },
        props: [{ sheet: 'p_flowers', weight: 1 }],
        propDensity: 0.04,
        ambient: { bird: '#fbfaf4', particles: 'petals' }
    },
    yellowstone: {
        id: 'yellowstone', name: 'Yellowstone', terrain: TERRAIN.GRASS, sheets: ['grass_dark'],
        wear: { sheet: 'dirt', coverage: 0.08, rim: true },
        // `yellowstone_spec.json`, `biomes_new2.py` YB: a dark forest floor of ferns, moss and
        // needles, with big milky blue sulphur lakes ringed pale yellow (drawn as ground).
        generated: {
            grass: [0.40, 0.28, 0.40], earth: [0.06, 0.26, 0.25], earthShare: 0.122, tint: 0.10,
            zones: { cell: 60 },
            kinds: [
                { id: 'fern', blades: 0.03, cluster: 6, heights: [3, 4, 4], tips: 0.15, shadow: 0.55, mounds: 12, strokes: [0.44, 0.22, 0.50], tone: 2, sway: true },
                { id: 'moss', blades: 0.015, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3 },
                { id: 'needles', blades: 0.07, cluster: 3, heights: [1, 2], tips: 0.1, shadow: 0.5, mounds: 18, strokes: [0.07, 0.26, 0.35], tone: 2 }
            ],
            pools: {
                perFrame: 2, radius: [40, 60],
                rings: [[0.42, [150, 214, 228]], [0.62, [122, 196, 214]], [0.74, [176, 222, 226]], [0.82, [226, 214, 120]], [0.88, [200, 186, 96]]]
            }
        },
        props: [{ sheet: 'p_bush_dark', weight: 2 }, { sheet: 'p_mushroom', weight: 1 }],
        propDensity: 0.08,
        ambient: { bird: '#e8ecef' }
    },
    volcano: {
        id: 'volcano', name: 'Volcano', terrain: TERRAIN.ROCK, sheets: ['stone'],
        // `flower_volcano_spec.json`, `refine_fv.py` VA: dark warm basalt, ash, a yellow-orange
        // lava glow in broken seams along stretched bands, few cracks. ⚠️ Below the brightness band
        // the rest of the ground keeps to, on purpose; the lava stays clear of the alert red.
        generated: {
            grass: [0.04, 0.24, 0.10], earth: null, earthShare: 0, tint: 0.06,
            zones: { cell: 50, stretch: [2.2, 1], cuts: [0.475, 0.525, 0.68], order: [0, 1, 0, 2], gap: { band: 1, cell: 7, cut: 0.45, to: 0 } },
            kinds: [
                { id: 'basalt', blades: 0.012, cluster: 2, heights: [1, 2], tips: 0, shadow: 0, mounds: 12, moundLight: 0.7, strokes: [0.04, 0.14, 0.10], tone: 1 },
                { id: 'lava', grass: [0.09, 0.50, 0.95], body: [2, 3], blades: 0.08, cluster: 2, heights: [1, 2], tips: 0, shadow: 0, mounds: 0, strokes: [0.13, 0.62, 1.0], tone: 3, glow: true },
                { id: 'ash', grass: [0.06, 0.38, 0.05], blades: 0.03, cluster: 4, heights: [1], tips: 0, shadow: 0, mounds: 12, moundLight: 0.7, strokes: [0.06, 0.48, 0.05], tone: 3 }
            ]
        },
        props: [{ sheet: 'p_rock', weight: 1 }],
        propDensity: 0.04,
        ambient: { bird: '#e3ddd4', particles: 'embers' }
    },
    lawn: {
        id: 'lawn', name: 'Lawn', terrain: TERRAIN.GRASS, sheets: ['grass'],
        // `world3.py` B: the meadow's lawn with no earth, the strip a transition blend lays between
        // a wood and the rock or sand beside it (`TerrainBlend`). Drawn only, at `LAWN_TERRAIN`.
        generated: {
            grass: [0.26, 0.44, 0.60], earth: null, earthShare: 0, tint: 0.06,
            zones: { cell: 55 },
            kinds: [
                { id: 'lawn', blades: 0.02975, cluster: 4, heights: [2, 2, 3], tips: 0.15, shadow: 0.5, mounds: 16, strokes: null, tone: 3, sway: true }
            ]
        },
        props: [{ sheet: 'p_flowers', weight: 1 }],
        propDensity: 0.03,
        ambient: { bird: '#f2ecd6' }
    }
});

/** The look a terrain takes when no biome in the Region owns it. */
export const DEFAULT_LOOK = Object.freeze({
    [TERRAIN.GRASS]: 'meadow',
    [TERRAIN.ROCK]: 'mountain',
    [TERRAIN.SAND]: 'coast',
    [TERRAIN.WATER]: 'sea',
    [STYLE_TERRAIN[STYLE.LAKE]]: 'lake',
    [STYLE_TERRAIN[STYLE.SULPHUR]]: 'sulphur',
    [LAWN_TERRAIN]: 'lawn'
});

/** A look by id, or null. */
export function getLook(lookId) {
    return Object.prototype.hasOwnProperty.call(LOOKS, lookId) ? LOOKS[lookId] : null;
}

/** How a look shades its own edge, or null. */
export function bandOf(lookId) {
    return getLook(lookId)?.band || null;
}

/** The terrain a look writes onto its neighbours, or null. */
export function fringeOf(lookId) {
    return getLook(lookId)?.fringe || null;
}

/** The sheet worn through a look, and how much of it shows, or null. */
export function wearOf(lookId) {
    return getLook(lookId)?.wear || null;
}

/** The colours a look's generated ground is drawn in, or null for a look drawn from its sheet. */
export function generatedOf(lookId) {
    return getLook(lookId)?.generated || null;
}

/** The props a look scatters and how thickly, or null. */
export function propsOf(lookId) {
    const look = getLook(lookId);
    if (!look?.props?.length) return null;
    return { props: look.props, density: look.propDensity || 0 };
}
