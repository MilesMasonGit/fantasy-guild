// The Starter Camp file's shape: one reader for the game's loader, the dev save and the CMS

/**
 * The Starter Camp, as `data/starterCamp.json` holds it (written only by the CMS's Sync to Game):
 *
 * ```
 * { version: 1, savedAt: '2026-10-09T14:02:00.000Z', mat: { w: 1760, h: 1126 },
 *   hall: { x: 880, y: 563 },
 *   tokens: [{ typeId: 'token_oak_forest', x: 560, y: 563 }, ...],
 *   bank: { item_oak_seed: 3, item_oak_wood: 10 } }
 * ```
 *
 * Points are mat units on the mat it was saved from (`mat`); the game moves the whole layout so its
 * centre lands on the centre of the mat it opens on. `tokens` never holds the Guild Hall (that is
 * `hall`) or a quest Token.
 *
 * Pure and import-free: the CMS reads it too.
 */

export const STARTER_CAMP_VERSION = 1;

const GUILD_HALL = 'token_guild_hall';
const QUEST_TOKEN = 'token_quest';

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function pointOf(raw) {
    return isObject(raw) && finite(raw.x) && finite(raw.y) ? { x: Math.round(raw.x), y: Math.round(raw.y) } : null;
}

/**
 * A Starter Camp in its one shape, or null when `raw` is not one. Malformed entries are dropped
 * rather than refused: a Token with no type or point, a Bank line that is not a whole number above
 * zero. A Guild Hall listed among the Tokens becomes `hall` when there is none.
 *
 * @returns {{version: number, savedAt: string|null, mat: {w: number, h: number}|null,
 *          hall: {x: number, y: number}|null, tokens: {typeId: string, x: number, y: number}[],
 *          bank: Record<string, number>}|null}
 */
export function normaliseStarterCamp(raw) {
    if (!isObject(raw)) return null;
    let hall = pointOf(raw.hall);
    const tokens = [];
    for (const entry of Array.isArray(raw.tokens) ? raw.tokens : []) {
        const typeId = isObject(entry) && typeof entry.typeId === 'string' ? entry.typeId.trim() : '';
        const at = pointOf(entry);
        if (!typeId || !at || typeId === QUEST_TOKEN) continue;
        if (typeId === GUILD_HALL) {
            if (!hall) hall = at;
            continue;
        }
        tokens.push({ typeId, x: at.x, y: at.y });
    }
    const bank = {};
    for (const [itemId, count] of Object.entries(isObject(raw.bank) ? raw.bank : {})) {
        const n = Math.floor(Number(count));
        if (itemId && Number.isFinite(n) && n > 0) bank[itemId] = n;
    }
    const mat = isObject(raw.mat) && finite(raw.mat.w) && finite(raw.mat.h) && raw.mat.w > 0 && raw.mat.h > 0
        ? { w: Math.round(raw.mat.w), h: Math.round(raw.mat.h) }
        : null;
    return {
        version: STARTER_CAMP_VERSION,
        savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null,
        mat,
        hall,
        tokens,
        bank
    };
}

/** Whether a camp holds nothing to open a game with: no Tokens and an empty Bank. */
export function isEmptyStarterCamp(camp) {
    return !camp || (!(camp.tokens || []).length && !Object.keys(camp.bank || {}).length);
}

/** An empty camp: what the CMS's Clear leaves, and what the game reads as "use the built-in opening". */
export function emptyStarterCamp() {
    return normaliseStarterCamp({ tokens: [], bank: {} });
}
