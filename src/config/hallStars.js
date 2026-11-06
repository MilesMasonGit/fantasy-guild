// Fantasy Guild — the Guild Hall's authored stars, as `data/hallStars.json` holds them
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (its Sync, Restore and change packs).
// Keep it pure: no registry that loads `data/`, no store.

/**
 * The sky's authored part: constellations and their stars, written only by the CMS's Sync to Game.
 * The Hearth's Bunk Beds, the Vault's Bank Tabs and the Well's Wishing Well are built in
 * (`guildUpgrades.js`); everything else is a star here.
 *
 * ```
 * {
 *   constellations: { mining: { id, name, label: { x, y }, skill? } },
 *   stars: {
 *     star_mining_xp: {
 *       id, constellation, name, description, node: { x, y }, tag?, links: ['hall'], sprite?, outline?, opensRing?,
 *       ranks: [{ tier, price: [{ itemId, quantity }], rules: [statement], lines: [{ itemId, quantity }] }]
 *     }
 *   }
 * }
 * ```
 *
 * - `node` and `label` are in the sky's unit space, centred on the Hall (0, 0); +x right, +y down.
 * - `links` name the Hall (`'hall'`) or other stars, built-in ones included; a star opens once any
 *   linked star has a rank (or at once, when it is linked to the Hall).
 * - A star's **rank r is its r-th rank's whole effect**, not an increment: rank 3 of a +10 % a rank
 *   XP star lists +30 %. `rules` are statements in the Rules grammar (GDD §7), held guild-wide while
 *   the rank is held (`hallModifiers.js`); `lines` are Passive Production lines the Guild Hall pays
 *   every lap, beside the Wishing Well's Water.
 * - `outline` picks the item whose outline the sky draws over the star: an item id or a sprite name.
 *   Left out, the sky picks one by the star's kind (`hallStarOutline.js`).
 * - `opensRing` makes it a ring star: once its first rank is bought the guild may settle that ring of
 *   the world map (a whole number from 2; ring 1 is always open). See `systems/world/ringStars.js`.
 * - `tier` is the tier the owner gives the rank (the ledger prices by it); `price` is what the rank
 *   costs, paid from the Bank.
 */

/** The first ring of the world map a star can open: ring 1 is open from the start. */
export const FIRST_STAR_RING = 2;

/** A star's `opensRing`: a whole number from {@link FIRST_STAR_RING}, else null. */
export function opensRingOf(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= FIRST_STAR_RING ? n : null;
}

/** The file Sync writes. */
export const HALL_STARS_FILE = 'hallStars.json';

/** Where a star's tag may sit beside it. */
export const TAG_SIDES = Object.freeze(['below', 'above', 'left', 'right']);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.trim() : '');

function point(raw) {
    const x = Number(raw?.x);
    const y = Number(raw?.y);
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

/** A list of `{ itemId, quantity }` with a whole positive quantity each; anything else dropped. */
export function itemLines(list) {
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
        const itemId = text(entry?.itemId);
        const quantity = Math.floor(Number(entry?.quantity));
        if (itemId && Number.isFinite(quantity) && quantity > 0) out.push({ itemId, quantity });
    }
    return out;
}

/** A rank's tier: a whole number from 0, or null when the owner has not set one. */
export function tierOf(value) {
    // `Number(null)` is 0: a tier written as null is unset, not the Starter Camp.
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

/** One rank as the game reads it. */
export function normaliseRank(raw) {
    const rules = (Array.isArray(raw?.rules) ? raw.rules : []).filter(s => isPlainObject(s) && text(s.keyword));
    return {
        tier: tierOf(raw?.tier),
        price: itemLines(raw?.price),
        rules,
        lines: itemLines(raw?.lines)
    };
}

/** One constellation, or null without an id. */
export function normaliseConstellation(raw, key) {
    const id = text(raw?.id) || text(key);
    if (!id) return null;
    const skill = text(raw?.skill);
    return { id, name: text(raw?.name) || id, label: point(raw?.label), ...(skill ? { skill } : {}) };
}

/** One star, or null: no id, or no rank to buy. */
export function normaliseStar(raw, key) {
    const id = text(raw?.id) || text(key);
    if (!id || !isPlainObject(raw)) return null;
    const ranks = (Array.isArray(raw.ranks) ? raw.ranks : []).map(normaliseRank);
    if (!ranks.length) return null;
    const tag = TAG_SIDES.includes(raw.tag) ? raw.tag : 'below';
    const sprite = text(raw.sprite);
    const outline = text(raw.outline);
    const opensRing = opensRingOf(raw.opensRing);
    return {
        id,
        constellation: text(raw.constellation),
        name: text(raw.name) || id,
        description: typeof raw.description === 'string' ? raw.description : '',
        node: point(raw.node),
        tag,
        links: [...new Set((Array.isArray(raw.links) ? raw.links : []).map(text).filter(Boolean))],
        ...(sprite ? { sprite } : {}),
        ...(outline ? { outline } : {}),
        ...(opensRing !== null ? { opensRing } : {}),
        ranks
    };
}

/** A keyed collection (or a list) as `[key, value]` pairs, in the file's order. */
function entriesOf(collection) {
    if (Array.isArray(collection)) return collection.map(v => [v?.id, v]);
    return isPlainObject(collection) ? Object.entries(collection) : [];
}

/**
 * The whole file as the game runs it: `{ constellations: [...], stars: [...] }`, each in the file's
 * order, a later duplicate id dropped.
 */
export function normaliseHallSky(file) {
    const constellations = [];
    const stars = [];
    const seenC = new Set();
    const seenS = new Set();
    for (const [key, raw] of entriesOf(file?.constellations)) {
        const c = normaliseConstellation(raw, key);
        if (c && !seenC.has(c.id)) { seenC.add(c.id); constellations.push(c); }
    }
    for (const [key, raw] of entriesOf(file?.stars)) {
        const s = normaliseStar(raw, key);
        if (s && !seenS.has(s.id)) { seenS.add(s.id); stars.push(s); }
    }
    return { constellations, stars };
}

/**
 * What Sync writes: both collections keyed by id, normalised, a star with no rank left out.
 * @returns {{constellations: Record<string, object>, stars: Record<string, object>}}
 */
export function hallStarsFile(workspace) {
    const sky = normaliseHallSky({ constellations: workspace?.constellations, stars: workspace?.hallStars ?? workspace?.stars });
    return {
        constellations: Object.fromEntries(sky.constellations.map(c => [c.id, c])),
        stars: Object.fromEntries(sky.stars.map(s => [s.id, s]))
    };
}

/** A star's record at a rank (1 = its first), or null at 0 or past its top. */
export function rankOf(star, rank) {
    const r = Math.floor(Number(rank) || 0);
    return r >= 1 ? star?.ranks?.[r - 1] || null : null;
}
