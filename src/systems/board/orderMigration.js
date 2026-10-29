// an old save's flags and Work Permissions, brought to orders

/**
 * Boards made since orders carry `orders: ORDERS_VERSION` (`StateSchema.createEmptyBoard`). A save
 * from before has none, and is brought over once as it loads (`SaveMigration.migrateState`), every
 * Region's board included:
 * - a flag pinned to a Token is an order on that Token, as it is;
 * - an area flag becomes a spot order where it stood: its hero idles there, working nothing, and
 * the note of work it had reached is dropped;
 * - every hero's rules and priorities (`flagRules`) are dropped.
 *
 * Pure, and imports nothing: the save layer calls it before the game's modules read the state.
 */
export const ORDERS_VERSION = 1;

/** A board brought to orders, or the same board when it already is. */
export function migrateBoardToOrders(board) {
    if (!isPlainObject(board) || board.orders === ORDERS_VERSION) return board;
    const flags = isPlainObject(board.flags) ? { ...board.flags } : {};
    const workClaims = isPlainObject(board.workClaims) ? { ...board.workClaims } : board.workClaims;
    for (const [heroId, flag] of Object.entries(flags)) {
        if (!isPlainObject(flag) || typeof flag.pinnedTo === 'string' || flag.spot === true) continue;
        flags[heroId] = { ...flag, spot: true };
        if (isPlainObject(workClaims)) delete workClaims[heroId];
    }
    return { ...board, flags, ...(workClaims !== undefined ? { workClaims } : {}), orders: ORDERS_VERSION };
}

/** A hero without the retired `flagRules`, or the same hero when it has none. */
export function withoutFlagRules(hero) {
    if (!isPlainObject(hero) || !('flagRules' in hero)) return hero;
    const { flagRules: _dropped, ...rest } = hero;
    return rest;
}

/**
 * A whole saved state brought to orders: the live board, every Region's frozen board and every
 * hero. Returns the same object when nothing needed changing.
 */
export function migrateStateToOrders(state) {
    if (!isPlainObject(state)) return state;
    let out = state;
    const board = migrateBoardToOrders(state.board);
    if (board !== state.board) out = { ...out, board };
    const regions = state.atlas?.regions;
    if (isPlainObject(regions) && Object.values(regions).some(r => isPlainObject(r?.board) && r.board.orders !== ORDERS_VERSION)) {
        const next = {};
        for (const [id, r] of Object.entries(regions)) {
            next[id] = isPlainObject(r?.board) ? { ...r, board: migrateBoardToOrders(r.board) } : r;
        }
        out = { ...out, atlas: { ...state.atlas, regions: next } };
    }
    if (Array.isArray(state.heroes) && state.heroes.some(h => isPlainObject(h) && 'flagRules' in h)) {
        out = { ...out, heroes: state.heroes.map(withoutFlagRules) };
    }
    return out;
}

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
