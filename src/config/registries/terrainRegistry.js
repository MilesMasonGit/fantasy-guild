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
 * The ground textures that exist as art, in `public/assets/playmat/terrain/`.
 *
 * Each is a 16px seamless noise fill drawn at 32px — a quarter of a 128px tile,
 * which is what makes the board a 29×29 subtile lattice (D-T1). `variants` is
 * how many interchangeable versions of that texture were drawn; the renderer
 * picks between them deterministically so the ground reads as noisy rather than
 * tiled, and the same tile picks the same variant on every load (D-T11).
 *
 * ⚠️ These are **fills only**. There are no edge or corner pieces and no alpha
 * stencils, so nothing here can draw a transition between two terrains. That is
 * why slice one has hard edges (D-T12) — organic blending is blocked on art
 * that does not exist yet, not on code.
 *
 * `water` is listed because the art exists and P3's coastlines will need it.
 * No terrain type uses it yet, which is expected rather than an oversight.
 */
export const SUBSTRATES = Object.freeze({
    dirt: { id: 'dirt', variants: 6 },
    grass: { id: 'grass', variants: 6 },
    sand: { id: 'sand', variants: 6 },
    stone: { id: 'stone', variants: 6 },
    water: { id: 'water', variants: 4 }
});

/** Where a substrate's Nth variant lives. Variants are numbered from 0. */
export function substrateSprite(substrateId, variant = 0) {
    return `/assets/playmat/terrain/ter_${substrateId}${variant}.png`;
}

/**
 * The terrain types a tile can be painted with.
 *
 * `props` is empty on every entry: slice one is the base layer only (D-T12),
 * and the three props that exist are 16px — one subtile, a sixteenth of a tile
 * — which is a very different scale from the landmarks the concept doc's §8
 * describes. That scale question is unresolved, so the field is declared and
 * left empty rather than filled with guesses.
 */
export const TERRAIN_TYPES = Object.freeze({
    meadow: { id: 'meadow', name: 'Meadow', substrate: 'grass', props: [] },
    forest: { id: 'forest', name: 'Forest', substrate: 'grass', props: [] },
    hills: { id: 'hills', name: 'Hills', substrate: 'stone', props: [] },
    mountain: { id: 'mountain', name: 'Mountain', substrate: 'stone', props: [] },
    shore: { id: 'shore', name: 'Shore', substrate: 'sand', props: [] },
    desert: { id: 'desert', name: 'Desert', substrate: 'sand', props: [] },
    farmland: { id: 'farmland', name: 'Farmland', substrate: 'dirt', props: [] },
    hamlet: { id: 'hamlet', name: 'Hamlet', substrate: 'dirt', props: [] }
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
