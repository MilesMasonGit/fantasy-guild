import { brightenHex, DEFAULT_OUTLINE } from './artBrightenColor.js';

/**
 * Brightening the Material Library (`data/palettes/custom_palettes.json`) with the
 * art bake's setting, so recolours made from it match the baked sprites. Pure:
 * the Studio's Recolor tab plans and writes through `/api/custom-palettes`.
 *
 * The saved library carries a marker under `BAKE_KEY` once the bake is applied,
 * so it is never brightened twice. ⚠️ Every reader of the library must skip
 * this key: it is not a palette (`splitLibrary`).
 */

/** The library key that records the bake. Not a palette name. */
export const BAKE_KEY = '_brightened';

/** The setting baked into the sprite art (the script's `drag` preset, outline 40). */
export const ART_BAKE = Object.freeze({ brightness: 1.15, saturation: 1.25, threshold: DEFAULT_OUTLINE });

/** `{ palettes, marker }`: the library's palettes without the bake marker, and the marker (or null). */
export function splitLibrary(library) {
  const palettes = { ...(library && typeof library === 'object' ? library : {}) };
  const marker = palettes[BAKE_KEY] ?? null;
  delete palettes[BAKE_KEY];
  return { palettes, marker };
}

/** The library to save: `palettes` with `marker` attached (when there is one). */
export function joinLibrary(palettes, marker) {
  const out = { ...palettes };
  delete out[BAKE_KEY];
  if (marker) out[BAKE_KEY] = marker;
  return out;
}

/**
 * What the bake would do to `library` (a saved library, marker and all):
 * `{ applied, marker, palettes, colors, changedPalettes, changedColors, next }`,
 * where `next` is the library to save (brightened, with the marker), or null when
 * the marker is already there.
 */
export function planBrighten(library, bake = ART_BAKE) {
  const { palettes, marker } = splitLibrary(library);
  const names = Object.keys(palettes);
  const colors = names.reduce((n, k) => n + (Array.isArray(palettes[k]) ? palettes[k].length : 0), 0);
  if (marker) return { applied: true, marker, palettes: names.length, colors, changedPalettes: 0, changedColors: 0, next: null };

  const settings = { brightness: bake.brightness, saturation: bake.saturation, outline: bake.threshold };
  const brightened = {};
  let changedPalettes = 0;
  let changedColors = 0;
  for (const name of names) {
    const list = palettes[name];
    if (!Array.isArray(list)) { brightened[name] = list; continue; }
    let changed = 0;
    brightened[name] = list.map((c) => {
      const out = brightenHex(c, settings);
      if (out !== c) changed++;
      return out;
    });
    if (changed) changedPalettes++;
    changedColors += changed;
  }
  const newMarker = { brightness: bake.brightness, saturation: bake.saturation, threshold: bake.threshold };
  return { applied: false, marker: null, palettes: names.length, colors, changedPalettes, changedColors, next: joinLibrary(brightened, newMarker) };
}
