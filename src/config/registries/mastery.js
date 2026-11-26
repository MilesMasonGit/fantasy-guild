// Science: a Laboratory's block, a node kind's mastery track, and which kind of node a Token is (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (through `cms/src/utils/constants.js`),
// for the Laboratory and mastery blocks and the audit. Pure: it imports only the effect library's
// shape helpers and the Token vocabulary, never a registry that loads `data/`.

import { normaliseScale } from '../../systems/effects/effectLibrary.js';
import { fieldOf } from './tokenConstants.js';

/** The station kind a Laboratory works as: Science's building, which studies a node instead of running recipes. */
export const LABORATORY_KIND = 'laboratory';

/** The ranks a track has, as the CMS says (content_science.md). The engine reads any number. */
export const NEW_TRACK_RANKS = 5;

/** Mastery points one study cycle gives the node kind it studies. */
export const POINTS_PER_STUDY = 1;

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const NO_LAB = Object.freeze({ maxLevel: null });
const labMemo = new WeakMap();

/**
 * A Laboratory Token's terms, `laboratory: { maxLevel }`: the highest gathering level of a node it
 * can study (a variant reaches higher nodes). `maxLevel` null when unwritten: it studies a node of
 * any level, its hero's Science level still deciding.
 */
export function laboratoryOf(def) {
    const block = isPlainObject(def?.laboratory) ? def.laboratory : null;
    if (!block) return NO_LAB;
    let terms = labMemo.get(block);
    if (!terms || terms.src !== block.maxLevel) {
        const n = Math.floor(Number(block.maxLevel));
        terms = { src: block.maxLevel, value: Object.freeze({ maxLevel: block.maxLevel != null && Number.isFinite(n) && n >= 1 ? n : null }) };
        labMemo.set(block, terms);
    }
    return terms.value;
}

const trackMemo = new WeakMap();
const NONE = Symbol('none');

/**
 * A node kind's **mastery track**, from the `mastery` block on the node's Token type (a vein, a tree,
 * a bush, a Fishing Spot) or on a crop's recipe (a Field's crop is its kind):
 *
 * ```jsonc
 * "mastery": { "ranks": [ { "points": 20, "effectId": "effect_quick_felling", "scale": 1 }, ... ] }
 * ```
 *
 * Each rank is reached at its `points` (the kind's total, guild-wide) and gives its library effect,
 * at its scale (1 to 5), to every Token of the kind; a reached rank keeps its effect. Ranks are read
 * in points order and numbered from 1. A row with no effect or no points above 0 is a blank row,
 * dropped (the audit names a bad one).
 *
 * @returns {{ ranks: ReadonlyArray<{ rank: number, points: number, effectId: string, scale: number }> }|null}
 */
export function masteryTrackOf(holder) {
    const block = isPlainObject(holder?.mastery) ? holder.mastery : null;
    if (!block) return null;
    let track = trackMemo.get(block);
    if (!track || track.src !== block.ranks) {
        const rows = [];
        for (const raw of Array.isArray(block.ranks) ? block.ranks : []) {
            const points = Math.floor(Number(raw?.points));
            const effectId = text(raw?.effectId);
            if (!effectId || !(points >= 1)) continue;
            rows.push({ points, effectId, scale: normaliseScale(raw.scale ?? 1) });
        }
        rows.sort((a, b) => a.points - b.points);
        const value = rows.length
            ? Object.freeze({ ranks: Object.freeze(rows.map((r, i) => Object.freeze({ rank: i + 1, ...r }))) })
            : NONE;
        track = { src: block.ranks, value };
        trackMemo.set(block, track);
    }
    return track.value === NONE ? null : track.value;
}

/** The rank a kind holds at `points` on its track: how many ranks it has reached (0 with none). */
export function rankAt(track, points) {
    const p = Number(points) || 0;
    let rank = 0;
    for (const row of track?.ranks || []) {
        if (row.points > p) break;
        rank = row.rank;
    }
    return rank;
}

/** The next rank above `points`, or null when the track is fully mastered (or there is none). */
export function nextRankOf(track, points) {
    const p = Number(points) || 0;
    return (track?.ranks || []).find(row => row.points > p) || null;
}

/** The ranks held at `points`, in order. */
export function heldRanksOf(track, points) {
    const p = Number(points) || 0;
    return (track?.ranks || []).filter(row => row.points <= p);
}

/** Whether a kind at `points` holds every rank of its track. */
export function isMasteredAt(track, points) {
    return !!track && rankAt(track, points) >= track.ranks.length;
}

/** How many `grows` steps a kind is followed through, against a chain that loops. */
const MAX_GROW_STEPS = 8;

/**
 * The node kind a Token type counts as: itself, or, for a stage that grows into something (a Stump,
 * a Sprout, a Sapling), the type at the end of its `grows` chain, so an Oak Stump is Oak mastery.
 * `lookup(typeId)` is the Token registry's. An unknown type is its own kind.
 */
export function kindOfType(typeId, lookup) {
    let kind = typeId || null;
    let def = kind ? lookup(kind) : null;
    for (let step = 0; step < MAX_GROW_STEPS && def; step++) {
        const into = text(def.grows?.into);
        if (!into || into === kind) break;
        const next = lookup(into);
        if (!next) break;
        kind = into;
        def = next;
    }
    return kind;
}

/**
 * The node kind a Token on the mat counts as now: a Field's is the crop in its ground (its recipe id;
 * a wild Field never touched holds the crop it starts with), none while it is empty; any other
 * Token's is its type's ({@link kindOfType}).
 */
export function kindOfToken(instance, def, lookup) {
    if (!instance?.typeId) return null;
    if (fieldOf(def)) {
        const state = instance.field;
        if (isPlainObject(state)) return text(state.cropId) || null;
        return state === undefined ? (fieldOf(def).startsWith || null) : null;
    }
    return kindOfType(instance.typeId, lookup);
}
