import { useEffect, useState } from 'react';
import { HERO_SHEET_GRID } from '../../../config/spriteFx.js';

/**
 * A hero's portrait for the hero bar: the head and shoulders of the first idle frame of the
 * hero's own class sheet, mirrored to face left. Cut once per sheet into a small picture and
 * kept; the bar only ever shows that picture, so a portrait costs nothing per frame.
 */

/** The idle row of a hero sheet (attack, walk, idle). */
export const PORTRAIT_ROW = 2;
/** The portrait's side in art pixels: head and shoulders of a 64 px frame. */
export const PORTRAIT_ART_PX = 24;
/** Its whole-number scale on screen. */
export const PORTRAIT_SCALE = 2;
/** Its side on screen. */
export const PORTRAIT_PX = PORTRAIT_ART_PX * PORTRAIT_SCALE;
/** Art pixels of headroom kept above the topmost drawn pixel. */
const HEADROOM = 2;
/** Rows from the top of the head that find its middle (below that, arms and weapons widen it). */
const HEAD_ROWS = 8;

/**
 * Where to cut the portrait from one frame. `alphaAt(x, y)` reads the frame's alpha.
 * The window's top sits just above the topmost drawn pixel; it is centred on the head (the
 * middle of the drawn pixels in the head's first rows), and never leaves the frame.
 * @returns {{ x: number, y: number, size: number }}
 */
export function portraitCrop(alphaAt, frameW, frameH, size = PORTRAIT_ART_PX) {
    let top = -1;
    for (let y = 0; y < frameH && top < 0; y++) {
        for (let x = 0; x < frameW; x++) {
            if (alphaAt(x, y) > 0) { top = y; break; }
        }
    }
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    if (top < 0) return { x: clamp(Math.round((frameW - size) / 2), frameW - size), y: 0, size };
    let sum = 0;
    let rows = 0;
    for (let y = top; y < Math.min(frameH, top + HEAD_ROWS); y++) {
        let min = -1;
        let max = -1;
        for (let x = 0; x < frameW; x++) {
            if (alphaAt(x, y) > 0) {
                if (min < 0) min = x;
                max = x;
            }
        }
        if (min < 0) continue;
        sum += (min + max + 1) / 2;
        rows++;
    }
    const middle = sum / rows;
    return {
        x: clamp(Math.round(middle - size / 2), frameW - size),
        y: clamp(top - HEADROOM, frameH - size),
        size
    };
}

/** The browser's way of making the picture: load the sheet, cut, mirror, encode. */
function browserCutter(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const frameW = Math.floor(img.naturalWidth / HERO_SHEET_GRID.cols);
                const frameH = Math.floor(img.naturalHeight / HERO_SHEET_GRID.rows);
                const read = document.createElement('canvas');
                read.width = frameW;
                read.height = frameH;
                const rg = read.getContext('2d', { willReadFrequently: true });
                if (!rg) return resolve(null);
                rg.drawImage(img, 0, PORTRAIT_ROW * frameH, frameW, frameH, 0, 0, frameW, frameH);
                const data = rg.getImageData(0, 0, frameW, frameH).data;
                const crop = portraitCrop((x, y) => data[(y * frameW + x) * 4 + 3], frameW, frameH);
                const out = document.createElement('canvas');
                out.width = crop.size;
                out.height = crop.size;
                const og = out.getContext('2d');
                og.imageSmoothingEnabled = false;
                // The sheets face right; the bar's heroes face left, into the mat.
                og.translate(crop.size, 0);
                og.scale(-1, 1);
                og.drawImage(read, crop.x, crop.y, crop.size, crop.size, 0, 0, crop.size, crop.size);
                resolve(out.toDataURL('image/png'));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/** sheet path → { url, promise }. One cut per sheet for the whole session. */
const cache = new Map();
let cutter = browserCutter;

/** Tests swap the cutter (jsdom has no canvas) and clear the cache; null restores the browser's. */
export function setPortraitCutter(fn) {
    cutter = fn || browserCutter;
    cache.clear();
}

/**
 * The portrait picture for a hero sheet: a data URL, or null if the sheet cannot be read.
 * Every caller for one sheet shares one cut.
 * @returns {Promise<string|null>}
 */
export function heroPortraitUrl(sheetPath) {
    if (!sheetPath) return Promise.resolve(null);
    let entry = cache.get(sheetPath);
    if (!entry) {
        entry = { url: undefined, promise: null };
        const src = sheetPath.startsWith('/') || sheetPath.startsWith('data:') ? sheetPath : `/${sheetPath}`;
        entry.promise = Promise.resolve(cutter(src)).then((url) => {
            entry.url = url || null;
            return entry.url;
        }, () => {
            entry.url = null;
            return null;
        });
        cache.set(sheetPath, entry);
    }
    return entry.promise;
}

/** The portrait already cut for a sheet (a URL or null), or undefined while it is being cut. */
export function cachedHeroPortrait(sheetPath) {
    return cache.get(sheetPath)?.url;
}

/** The portrait picture for a sheet, once it is cut (null until then, or if it cannot be). */
export function useHeroPortrait(sheetPath) {
    const [url, setUrl] = useState(() => cachedHeroPortrait(sheetPath) ?? null);
    useEffect(() => {
        let live = true;
        const ready = cachedHeroPortrait(sheetPath);
        if (ready !== undefined) {
            setUrl(ready);
            return undefined;
        }
        setUrl(null);
        heroPortraitUrl(sheetPath).then((u) => { if (live) setUrl(u); });
        return () => { live = false; };
    }, [sheetPath]);
    return url;
}
