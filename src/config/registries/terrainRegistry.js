// Fantasy Guild — Terrain types and their substrate art.

/**
 * What terrain a playmat tile can be painted with.
 *
 * This is the vocabulary half of the dynamic terrain system (roadmap P0). It
 * says what a "forest" or a "shore" *is*; `terrainAssignments.js` says which
 * Maps and Tokens paint which one. Nothing renders from this yet — the base
 * layer lands in P2.
 *
 * ## A terrain type is a substrate plus a prop table (D-T8)
 *
 * Deliberately flatter than `concept_dynamic_playmat_terrain.md` §10C, which
 * splits terrain into geographical *substrates* and civilisation *overlays*
 * that preserve the ground beneath them, so that "village on coast" and
 * "village on mountain" emerge from combining two things. The owner ruled
 * against that on 2026-09-06: a terrain type is one flat thing, and two terrain
 * types may simply share a substrate. `farmland` and `hamlet` are both dirt
 * with different props; `forest` and `meadow` are both grass. Every terrain's
 * look is decided rather than computed, and there is no override hierarchy.
 *
 * ## Why this lives in code and not the CMS (D-T9)
 *
 * Terrain is presentation config, like `sprite-manifest.js` beside it. It
 * carries no balance numbers, no economy, nothing a player reads as content.
 * The owner chose a code registry over a CMS surface so the look can be
 * iterated on without building an editor first.
 *
 * ⚠️ **Art paths live here rather than in `sprite-manifest.js`**, even though
 * that is where sprite paths usually go. The CMS *writes* to that file
 * (`cms/vite-plugin-cms-api.js` POST /api/register-sprite), so it is a
 * CMS-owned artefact; terrain art is not CMS content and has no business
 * being managed there.
 */

/**
 * ⚠️ **Which set of ground art the playmat draws with — the experiment switch.**
 *
 * Two complete sets exist and they differ in how coarse the pixels are:
 *
 * | Set | File            | Art size | Shown at | One art pixel is |
 * | :-- | :-------------- | :------- | :------- | :--------------- |
 * | `a` | `ter_grass0`    | 16px     | 2×       | 2 screen pixels  |
 * | `b` | `ter_grassb0`   | 8px      | 4×       | 4 screen pixels  |
 *
 * Both fill the same 32px subtile, so **nothing about the board's geometry
 * changes** when this is flipped — the lattice is still 29×29 and the board is
 * still 928px. What changes is how chunky the ground reads.
 *
 * ⚠️ Flipping this **must** be accompanied by matching the frontier's step size
 * to it: `SUBTILE_ART_PX` and `EDGE_AMPLITUDE` in `TerrainLattice.js` decide how
 * finely a coastline is cut, and a finely-cut edge through chunky ground reads
 * as a mistake rather than a style. `src/tests/TerrainRegistry.test.js` fails if
 * the two disagree.
 */
export const DEFAULT_ART_SET = 'b';

/** The pixel size of the art in each set — what one sprite really is. */
export const ART_PX_FOR_SET = Object.freeze({ a: 16, b: 8 });

/**
 * Which set is live right now.
 *
 * ⚠️ Mutable, and read through `artSet()` rather than imported as a value,
 * because the QA panel switches it at runtime so the two can be compared
 * side by side. Anything that captures it into a module-level constant at
 * import time will keep drawing the old set after a switch — which is exactly
 * what `SUBTILE_ART_PX` used to do before it became a function.
 *
 * Remembered per device, like the rest of the developer settings, so a reload
 * mid-comparison does not silently put you back on the default.
 */
let activeArtSet = DEFAULT_ART_SET;

const STORAGE_KEY = 'fantasy_guild_terrain_art_set';
try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored && ART_PX_FOR_SET[stored]) activeArtSet = stored;
} catch {
    // Private browsing, or no storage at all. The default is fine.
}

/** The art set currently drawing. */
export function artSet() {
    return activeArtSet;
}

/** How big one art pixel's sprite really is, in the set currently drawing. */
export function substrateArtPx() {
    return ART_PX_FOR_SET[activeArtSet];
}

/**
 * Switch art sets. Returns true if anything actually changed.
 *
 * ⚠️ Callers must trigger a redraw themselves — this module knows nothing about
 * the canvas. `TestDashboard` publishes `terrain_art_set_changed` for that.
 */
export function setArtSet(set) {
    if (!ART_PX_FOR_SET[set] || set === activeArtSet) return false;
    activeArtSet = set;
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, set);
    } catch {
        // Not being able to remember the choice does not stop making it.
    }
    return true;
}

/**
 * The ground textures that exist as art, in `public/assets/playmat/terrain/`.
 *
 * Each is a seamless noise fill drawn to exactly fill a 32px subtile — a quarter
 * of a 128px tile, which is what makes the board a 29×29 subtile lattice (D-T1).
 * `variants` is how many interchangeable versions were drawn **per art set**,
 * because the two sets were not drawn to the same count; the renderer picks
 * between them deterministically, so the ground reads as noisy rather than tiled
 * and the same subtile picks the same variant on every load (D-T11).
 *
 * ⚠️ These are **fills only**. There are no edge or corner pieces and no alpha
 * stencils, and there will not be: edges are computed (D-T13).
 */
export const SUBSTRATES = Object.freeze({
    // ⚠️ No terrain has dirt as its *base* any more — it is only ever patched
    // through something else. It stays declared because a patch substrate is
    // still a substrate: it needs art, variants and a size like any other.
    dirt: { id: 'dirt', variants: { a: 6, b: 4 } },
    grass: { id: 'grass', variants: { a: 6, b: 8 } },
    sand: { id: 'sand', variants: { a: 6, b: 4 } },
    stone: { id: 'stone', variants: { a: 6, b: 8 } },
    water: { id: 'water', variants: { a: 4, b: 8 } }
});

/** How many variants a substrate has in the art set currently selected. */
export function substrateVariants(substrateId, set = activeArtSet) {
    return SUBSTRATES[substrateId]?.variants?.[set] || 0;
}

/** Where a substrate's Nth variant lives. Variants are numbered from 0. */
export function substrateSprite(substrateId, variant = 0, set = activeArtSet) {
    const infix = set === 'a' ? '' : set;
    return `/assets/playmat/terrain/ter_${substrateId}${infix}${variant}.png`;
}

/**
 * The terrain types a tile can be painted with.
 *
 * `props` names the scenery scattered over that ground, and `propDensity` is
 * roughly what fraction of its subtiles carry one. A tile is sixteen subtiles,
 * so 0.22 is between three and four trees on a tile — dense enough to read as
 * woodland without becoming a wall.
 *
 * ⚠️ Only the grass terrains carry props so far. Everything else is declared
 * empty rather than guessed at: rocks on stone and reeds on water are obvious
 * enough, but there is no art for them and half-authored scenery is worse than
 * none. Adding some is two fields here and no code.
 */
/** The scenery that exists as art, in `public/assets/playmat/props/`. */
const BROADLEAF = Object.freeze(['prop_tree_oak', 'prop_tree_maple']);
const CONIFER = Object.freeze(['prop_tree_fir']);

/** Where a prop's art lives. Props are 16px whichever ground art set is live. */
export function propSprite(propId) {
    return `/assets/playmat/props/${propId}.png`;
}

/**
 * A terrain's overall colouring, if it has one.
 *
 * ⚠️ Not a band. A band shades a terrain's *rim*; a tone colours the whole of
 * it, and exists so that two terrains on the same substrate can look different
 * at all. A fir wood and an oak wood are both grass — without a tone they are
 * the same picture.
 *
 * Tones fade into each other across a boundary rather than meeting at one; see
 * `TerrainTones`. Keep them gentle. This is a wash over the art, not a repaint
 * of it, and a strong one will flatten the texture underneath into a colour.
 */
export function toneOf(terrainId) {
    return getTerrain(terrainId)?.tone || null;
}

/**
 * The terrain a terrain pushes out onto its *neighbours* — the beach around the
 * sea.
 *
 * ⚠️ The opposite direction to a band. A band shades this terrain's own edge; a
 * fringe writes a different terrain onto the ground beside it. Sand cannot be a
 * band on the water, because the sand is not in the water.
 *
 * `except` spares neighbours that should meet it directly — a cliff dropping
 * into the sea rather than shelving into a beach.
 */
export function fringeOf(terrainId) {
    return getTerrain(terrainId)?.fringe || null;
}

/**
 * How a terrain shades its own outer edge, if it does — concept §6B.
 *
 * `width` is how far in from a triggering neighbour, in art pixels. `tint` and
 * `amount` say how the terrain's own substrate is recoloured there: a light
 * cyan wash on water reads as shallows, a dark wash on sand reads as wet.
 *
 * ⚠️ `against` lists which neighbours cause the band. Omit it and *any* painted
 * neighbour does. That default is right for shallows — the sea shelves wherever
 * it meets land — and wrong for wet sand, which is caused by water and not by
 * having an edge. Without it a beach came out wet where it met the forest.
 *
 * Deliberately a property of one terrain rather than of a *pair* of them.
 * Ocean shading its edge and sand shading its edge produce deep → shallow → wet
 * → dry between them without either knowing the other is there, and the same
 * declaration works against any neighbour.
 */
export function bandOf(terrainId) {
    const terrain = getTerrain(terrainId);
    return terrain?.band || null;
}

/**
 * The substrate worn through a terrain in clumps, and how much of it shows.
 *
 * A *second* substrate inside one terrain, not a boundary between two: bare
 * earth scuffed into grass. Null for terrain that is all one thing.
 */
export function patchOf(terrainId) {
    const terrain = getTerrain(terrainId);
    if (!terrain?.patch?.substrate) return null;
    return terrain.patch;
}

/** The props a terrain scatters, and how thickly. Empty for most terrains. */
export function propsOf(terrainId) {
    const terrain = getTerrain(terrainId);
    if (!terrain?.props?.length) return null;
    return { props: terrain.props, density: terrain.propDensity || 0 };
}

export const TERRAIN_TYPES = Object.freeze({
    meadow: {
        id: 'meadow', name: 'Meadow', substrate: 'grass',
        // Open ground with the odd tree standing in it, and bare earth worn
        // through where it has been walked over.
        props: BROADLEAF, propDensity: 0.05,
        patch: { substrate: 'dirt', coverage: 0.18 }
    },
    // ⚠️ The two forests are the same substrate and differ by **tone alone**.
    // That is the point of tones: a ragged boundary is invisible between two
    // terrains drawn on identical ground, so the only thing separating an oak
    // wood from a fir wood is colour — and it has to fade, or it is a line.
    forest: {
        id: 'forest', name: 'Oak Forest', substrate: 'grass',
        props: BROADLEAF, propDensity: 0.22,
        // Less than the meadow: leaf litter and shade, not footfall.
        patch: { substrate: 'dirt', coverage: 0.12 },
        // Warm and open — a shade brighter than plain grass.
        tone: { tint: '#b9d46a', amount: 0.16 }
    },
    fir_forest: {
        id: 'fir_forest', name: 'Fir Forest', substrate: 'grass',
        props: CONIFER, propDensity: 0.30,
        patch: { substrate: 'dirt', coverage: 0.08 },
        // Colder and darker, and denser with it.
        tone: { tint: '#1d3a2a', amount: 0.34 }
    },
    hills: { id: 'hills', name: 'Hills', substrate: 'stone', props: [] },
    mountain: { id: 'mountain', name: 'Mountain', substrate: 'stone', props: [] },
    shore: {
        id: 'shore', name: 'Shore', substrate: 'sand', props: [],
        // Wet sand where the water reaches. Narrower than the shallows, because
        // a tideline is a sharper thing than a shelf of shallow water.
        band: { width: 2, tint: '#6b4a25', amount: 0.30, against: ['ocean'] }
    },
    desert: { id: 'desert', name: 'Desert', substrate: 'sand', props: [] },
    // ⚠️ These three used to sit on a dirt substrate. Dirt is now only ever a
    // patch (owner ruling, 2026-09-07): they are grass worn through heavily
    // rather than bare earth with nothing under it. Tilled ground with grass
    // surviving between the rows, paths worn across a green, churned-up
    // diggings — the same mechanism as a scuffed meadow, turned up.
    farmland: {
        id: 'farmland', name: 'Farmland', substrate: 'grass', props: [],
        patch: { substrate: 'dirt', coverage: 0.72 }
    },
    hamlet: {
        id: 'hamlet', name: 'Hamlet', substrate: 'grass', props: [],
        patch: { substrate: 'dirt', coverage: 0.45 }
    },
    diggings: {
        id: 'diggings', name: 'Diggings', substrate: 'grass', props: [],
        patch: { substrate: 'dirt', coverage: 0.8 }
    },
    // Open water. The only terrain on the water substrate, and the one that
    // makes a shore a shore — sand with nothing wet beside it is just desert.
    ocean: {
        id: 'ocean', name: 'Ocean', substrate: 'water', props: [],
        // Shallows: the sea going pale where it runs out of depth.
        band: { width: 4, tint: '#a8e8ff', amount: 0.45 },
        // And a beach wherever it comes ashore, so water never meets grass
        // directly. Written onto the neighbour as real shore, so it picks up
        // the wet-sand band and refuses to grow trees like any other beach.
        fringe: { terrain: 'shore', width: 3, except: [] }
    }
});

/** Look up a terrain type. Returns null for an unknown id rather than throwing. */
export function getTerrain(terrainId) {
    return TERRAIN_TYPES[terrainId] || null;
}

/** Whether `terrainId` names a real terrain type. */
export function isTerrainId(terrainId) {
    return Object.prototype.hasOwnProperty.call(TERRAIN_TYPES, terrainId);
}

/** The substrate a terrain sits on, as a substrate record. Null if unknown. */
export function substrateOf(terrainId) {
    const terrain = getTerrain(terrainId);
    return terrain ? SUBSTRATES[terrain.substrate] || null : null;
}
