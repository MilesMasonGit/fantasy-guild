// the ground's art: every ground and prop sheet decoded once, and muted once

import {
    SHEETS, PROP_SHEETS, sheetPath, propSheetPath
} from '../../../config/registries/terrainRegistry.js';
import { muteTexels } from '../../../systems/board/TerrainSurface.js';
import { tuning } from '../../../config/playmatTuning.js';
import { logger } from '../../../utils/Logger.js';

/**
 * The screen pass reads sheet pixels as numbers, so each sheet is decoded to RGBA bytes once, here,
 * and kept; its muted copy (about `brightness(0.85) saturate(0.7)`, the Playmat Tuner's Colour
 * sliders) is made once per pair of Colour values. ⚠️ The mute is baked into the bytes, never a CSS
 * filter: a filter would make the ground a composited layer of its own (`MatPixelLayers.test.js`).
 *
 * Every sheet is loaded together (eight ground sheets and seven prop sheets, about 60 KB): the
 * ground is drawn once they all have, so a Region never shows half its art.
 */

/** Every sheet the ground can draw, by path. */
export function groundSheetPaths() {
    return [...SHEETS.map(sheetPath), ...PROP_SHEETS.map(propSheetPath)];
}

/** Decoded sheets by path: RGBA bytes, or null for one that would not load. */
const decoded = new Map();
let loading = null;
const listeners = new Set();
const warned = new Set();

/** Muted copies for the Colour values they were made with; dropped when the values move. */
let mutedFor = '';
const muted = new Map();

function notify() {
    for (const fn of [...listeners]) fn();
}

/** Whether every sheet has been decoded (or has failed and will draw nothing). */
export function groundSheetsReady() {
    return groundSheetPaths().every(p => decoded.has(p));
}

/** Called once the sheets have all loaded. Returns an unsubscribe. */
export function onGroundSheetsReady(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function decode(path) {
    return new Promise((resolve) => {
        if (typeof Image === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = path;
    });
}

/**
 * Start decoding every sheet, once. Resolves when all have settled; a sheet that will not load
 * draws nothing (and says so once).
 */
export function loadGroundSheets() {
    if (groundSheetsReady()) return Promise.resolve();
    if (!loading) {
        loading = Promise.all(groundSheetPaths().map(path => decode(path).then((data) => {
            if (!data && !warned.has(path)) {
                warned.add(path);
                logger.warn('Ground', `Could not load ${path}: that ground draws nothing`);
            }
            decoded.set(path, data);
        }))).then(() => {
            loading = null;
            notify();
        });
    }
    return loading;
}

/**
 * A sheet's muted RGBA bytes, with the mute the Colour sliders say now. Null while it is not
 * decoded, or if it would not load.
 *
 * @param {string} path  `sheetPath(id)` or `propSheetPath(id)`
 */
export function mutedSheet(path) {
    const key = `${tuning('muteBrightness')}|${tuning('muteSaturation')}`;
    if (key !== mutedFor) {
        muted.clear();
        mutedFor = key;
    }
    if (muted.has(path)) return muted.get(path);
    const raw = decoded.get(path) || null;
    const out = raw ? muteTexels(raw) : null;
    if (raw) muted.set(path, out);
    return out;
}

/**
 * **Test seam.** Every sheet decoded at once from `texelsOf(path)` (RGBA bytes, or null), as if it
 * had loaded; jsdom loads no images.
 */
export function primeGroundSheets(texelsOf) {
    for (const path of groundSheetPaths()) decoded.set(path, texelsOf(path));
    muted.clear();
    mutedFor = '';
    notify();
}

/** **Test seam.** Back to nothing decoded and no listeners. */
export function resetGroundSheets() {
    decoded.clear();
    muted.clear();
    mutedFor = '';
    loading = null;
    listeners.clear();
    warned.clear();
}
