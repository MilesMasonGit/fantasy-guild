// The Guild Hall's upgrade ceremony: what a purchase lights up, and the hard-pixel frames it is drawn with.

import {
    CONSTELLATIONS, GUILD_UPGRADES, HALL_NODE, getUpgradeDef, getUpgradeLinks, isUpgradeAccessible
} from '../../../config/guildUpgrades.js';

/** One art pixel of the 2× sky, in screen px. */
export const CEREMONY_PX = 2;
/** How long one burst frame holds (pixel motion: poses held, then a jump). */
export const BURST_FRAME_MS = 70;
/** The sound clips (`AudioSystem`): a star bought, and a constellation finished. */
export const STAR_CHIME = 'hall_star_chime';
export const CONSTELLATION_CHIME = 'hall_constellation_chime';

/**
 * Where the owner's picture of a finished constellation is looked for, drawn at 2× its own size
 * centred on its stars. Missing (no art yet) draws nothing.
 */
export const constellationPictureSrc = (id) => `/assets/playmat/screens/constellation_${id}.png`;

const rankOf = (ranks, id) => ranks?.[id] || 0;

/** The constellations every one of whose stars has a rank, as ids. */
function litConstellations(ranks) {
    return CONSTELLATIONS.filter(c => {
        const stars = GUILD_UPGRADES.filter(u => u.constellation === c.id);
        return stars.length > 0 && stars.every(u => rankOf(ranks, u.id) >= 1);
    }).map(c => c.id);
}

const isLocked = (id, ranks) => rankOf(ranks, id) < 1 && !isUpgradeAccessible(id, ranks);

/**
 * What one purchase lights: the star, the stars it just opened (locked before it, open after),
 * and the constellations it just finished. Null when there is nothing to play: an unknown star,
 * no rank, or a payload with no star (a dev write or a load).
 * @param {string} upgradeId the star bought
 * @param {number} rank its rank now
 * @param {object} ranksAfter every star's rank now
 */
export function ceremonyFor(upgradeId, rank, ranksAfter) {
    if (!upgradeId || !getUpgradeDef(upgradeId) || !(rank >= 1)) return null;
    const after = { ...(ranksAfter || {}), [upgradeId]: rank };
    const before = { ...after, [upgradeId]: rank - 1 };
    const opened = getUpgradeLinks(upgradeId)
        .filter(id => id !== HALL_NODE && isLocked(id, before) && !isLocked(id, after));
    const was = new Set(litConstellations(before));
    const finished = litConstellations(after).filter(id => !was.has(id));
    return { id: upgradeId, rank, opened, finished };
}

/** The stars of a constellation, as ids. */
export const constellationStars = (cid) => GUILD_UPGRADES.filter(u => u.constellation === cid).map(u => u.id);

const DIRS_8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Sixteen headings, rounded to whole art pixels per step. */
const DIRS_16 = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
});

/**
 * A burst's frames: rays of square art pixels thrown out from the star, each frame further out,
 * white then gold then a dark gold as they die. Offsets in art pixels from the star's centre.
 * @param {'star'|'opened'|'constellation'} kind a bought star, a star just opened (a small pop),
 *        or the star that finished a constellation (two rings, sixteen rays)
 * @returns {Array<{colour: string, px: Array<[number, number]>}>}
 */
export function burstFrames(kind = 'star') {
    const plan = BURSTS[kind] || BURSTS.star;
    return plan.map(({ r, len, colour, dirs, every = 1 }) => {
        const px = new Map();
        const list = dirs === 16 ? DIRS_16 : DIRS_8;
        list.forEach(([dx, dy], i) => {
            if (i % every) return;
            for (let s = r; s < r + len; s++) {
                // A diagonal of the 8 steps one art pixel each way, so it reads as a ray, not a gap.
                const x = Math.round(dx * s * (dirs === 16 ? 1 : (dx && dy ? Math.SQRT1_2 : 1)));
                const y = Math.round(dy * s * (dirs === 16 ? 1 : (dx && dy ? Math.SQRT1_2 : 1)));
                px.set(`${x},${y}`, [x, y]);
            }
        });
        return { colour, px: [...px.values()] };
    });
}

const WHITE = '#fffbe8';
const GOLD = '#ffd84a';
const DARK_GOLD = '#b8860b';

// Radii in art pixels from the star's centre: a star with its item outline is drawn 34 art pixels
// across, so the rays start just past it.
const BURSTS = {
    star: [
        { r: 16, len: 3, colour: WHITE },
        { r: 19, len: 5, colour: WHITE },
        { r: 24, len: 4, colour: GOLD },
        { r: 29, len: 2, colour: DARK_GOLD }
    ],
    opened: [
        { r: 15, len: 2, colour: WHITE, every: 2 },
        { r: 18, len: 2, colour: GOLD },
        { r: 21, len: 1, colour: DARK_GOLD, every: 2 }
    ],
    constellation: [
        { r: 16, len: 4, colour: WHITE },
        { r: 19, len: 6, colour: WHITE, dirs: 16 },
        { r: 25, len: 6, colour: GOLD, dirs: 16 },
        { r: 31, len: 5, colour: GOLD, dirs: 16 },
        { r: 37, len: 4, colour: DARK_GOLD, dirs: 16, every: 2 },
        { r: 43, len: 2, colour: DARK_GOLD, dirs: 16 }
    ]
};

/** How long a burst of a kind lasts, in ms. */
export const burstMs = (kind) => (BURSTS[kind] || BURSTS.star).length * BURST_FRAME_MS;

/** The light's length on a line, in art pixels, and how far it hops each step. */
export const RUN_LIGHT_ART_PX = 6;
const RUN_HOP_ART_PX = 6;
const RUN_HOP_MS = { min: 30, max: 60 };
/** The longest a run along a line takes, so a far star is not waited for. */
const RUN_MAX_MS = 900;

/**
 * The light's run along a line `lengthPx` long: it hops a whole number of art pixels at a time,
 * each hop held, from the bought star until it has passed the far end.
 * @returns {{hops: number, ms: number}}
 */
export function runSteps(lengthPx) {
    const travel = Math.max(0, lengthPx) + RUN_LIGHT_ART_PX * CEREMONY_PX;
    const hops = Math.max(1, Math.ceil(travel / (RUN_HOP_ART_PX * CEREMONY_PX)));
    const hopMs = Math.max(RUN_HOP_MS.min, Math.min(RUN_HOP_MS.max, Math.floor(RUN_MAX_MS / hops)));
    return { hops, ms: hops * hopMs };
}

/** Under reduced motion, how long the still version holds. */
export const STILL_MS = 900;
/** A finished constellation's stars sparkle one after another, this far apart. */
export const STAGGER_MS = 90;
/** The finished constellation's lines flash for this long (`.gi-constellation-glow`). */
export const GLOW_MS = 1200;
