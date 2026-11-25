// fishing spot kinds: what a Token type's `spot` block says, the water kinds, the retired fixed waters (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`). Pure: no
// imports, so both sides can load it.

/**
 * Water is ground: the mat's water cells are terrain, and fish come from **fishing spots**, Tokens
 * that arrive on water by themselves and leave again (`systems/board/FishingSpots.js`). A **spot
 * kind** is a Token type with a `spot` block:
 *
 * ```js
 * spot: {
 *   water: ['sea', 'fresh'],   // the water kinds it lands on (WATER_KIND); none: it never lands by itself
 *   biomes: ['coast'],         // the Region biomes it lands in; none: any
 *   everyMinutes: 10,          // about how often one arrives on a mat (each wait is drawn from half to one
 *                              // and a half of it); 0: never by itself (an event or the QA panel only)
 *   most: 3,                   // the most of this kind on one mat at once
 *   leaveChance: 5,            // % chance it moves on after each catch (no counter)
 *   unworkedMinutes: 30        // it drifts off after this long with nobody working it; 0: never
 * }
 * ```
 *
 * Its catch is its catch pools (`catchPools.js`), which may name the water and the biomes each pool
 * holds for: the plain spot's catch comes from the water it sits on and the Region's biome, a rare
 * kind's pools name neither and its catch is fixed. A spot kind stands on water (its "Stands on").
 * Spots never count toward the Token cap.
 */

/** The water kinds a spot may land on. River and lake are one water (fresh); a sulphur spring is its own. */
export const WATER_KIND = Object.freeze({ SEA: 'sea', FRESH: 'fresh', SULPHUR: 'sulphur' });

/** The inland water shape that is a sulphur spring (`WaterShapes.WATER_KIND.SULPHUR`): every other is fresh water. */
export const SULPHUR_SHAPE = 'sulphur';

/**
 * The water kinds a place's ground may hold, in {@link WATER_KIND}'s order: the sea when its share
 * of the mat may be above nothing, fresh water for an inland shape other than a sulphur spring, and
 * a sulphur spring for its own (as `GroundRules.waterKindsOf` reads the drawn shapes).
 *
 * @param {number} sea the most of the mat the edge sea may take (0 to 1)
 * @param {string|string[]} inland the inland water shapes it may roll (`biomeTerrain.WATER_SHAPES`)
 */
export function groundWaterKinds(sea, inland) {
    const shapes = (Array.isArray(inland) ? inland : [inland]).filter(s => typeof s === 'string' && s);
    const out = [];
    if (Number(sea) > 0) out.push(WATER_KIND.SEA);
    if (shapes.some(s => s !== SULPHUR_SHAPE)) out.push(WATER_KIND.FRESH);
    if (shapes.includes(SULPHUR_SHAPE)) out.push(WATER_KIND.SULPHUR);
    return out;
}

/** The kinds as the CMS's chips show them, in their order. */
export const WATER_KIND_CHOICES = Object.freeze([
    Object.freeze({ id: WATER_KIND.SEA, label: 'Sea' }),
    Object.freeze({ id: WATER_KIND.FRESH, label: 'Fresh water' }),
    Object.freeze({ id: WATER_KIND.SULPHUR, label: 'Sulphur spring' })
]);

const KNOWN_WATER = Object.values(WATER_KIND);

/** Whether `id` is a water kind the game has. */
export function isWaterKind(id) {
    return KNOWN_WATER.includes(id);
}

/**
 * The fixed water Tokens retired by the fishing spots. The Token registry never loads them, and a
 * loaded save drops them from every board (`SaveMigration.withoutRetiredWaters`), whatever `data/`
 * still holds until the content pack deletes them.
 */
export const RETIRED_WATER_TOKENS = Object.freeze(['token_coast', 'token_river', 'token_lake', 'token_bog_pool']);

/** The shortest wait between arrivals the engine honours: a second. */
export const MIN_EVERY_MS = 1000;

const MINUTE_MS = 60000;
const cache = new WeakMap();

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nonNegative = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** A list of trimmed words, blanks and repeats dropped, kept when `keep` says so. */
function wordList(raw, keep = () => true) {
    const out = [];
    for (const v of Array.isArray(raw) ? raw : []) {
        const word = text(v);
        if (word && keep(word) && !out.includes(word)) out.push(word);
    }
    return out;
}

function normalise(raw) {
    const everyMs = Math.round(nonNegative(raw.everyMinutes) * MINUTE_MS);
    return Object.freeze({
        water: Object.freeze(wordList(raw.water, isWaterKind)),
        biomes: Object.freeze(wordList(raw.biomes)),
        everyMs: everyMs > 0 ? Math.max(MIN_EVERY_MS, everyMs) : 0,
        most: Math.floor(nonNegative(raw.most)),
        leaveChance: Math.min(100, nonNegative(raw.leaveChance)),
        unworkedMs: Math.round(nonNegative(raw.unworkedMinutes) * MINUTE_MS)
    });
}

/**
 * A Token type's spot block in one shape, or null when it is not a spot kind. Kept per definition
 * (the runner and the cap ask it every tick); a content reload registers new objects.
 *
 * @returns {{water: string[], biomes: string[], everyMs: number, most: number, leaveChance: number, unworkedMs: number}|null}
 */
export function spotOf(def) {
    const raw = def && typeof def === 'object' ? def.spot : null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let spot = cache.get(def);
    if (!spot) {
        spot = normalise(raw);
        cache.set(def, spot);
    }
    return spot;
}

/** Whether a Token type is a spot kind. */
export function isSpotKind(def) {
    return spotOf(def) !== null;
}

/** The most a spot-rate block raises the rate by, in percent. */
export const SPOT_RATE_MAX = 1000;

/**
 * How much a Token type raises the spot rate in its reach, in percent (`spotRate: { percent }`,
 * any Token type may carry it): on the water within the one standard reach of its centre, spots
 * arrive that much more often (100: twice as often there). 0 when it carries none.
 */
export function spotRateOf(def) {
    const raw = def && typeof def === 'object' ? def.spotRate : null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0;
    return Math.min(SPOT_RATE_MAX, nonNegative(raw.percent));
}

/** Whether a spot kind arrives on a mat by itself: some water, a rate, and room for at least one. */
export function arrivesByItself(spot) {
    return !!spot && spot.water.length > 0 && spot.everyMs > 0 && spot.most > 0;
}
