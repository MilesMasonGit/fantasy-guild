// what is on the mat, one row per Token type

/** The section a Token without a skill section falls under (the Shop's). */
const GENERAL_SECTION = 'general';

/** What a Token is doing, for the Token Summary's status counts. */
export const TOKEN_STATUS = Object.freeze({
    WORKING: 'working',
    IDLE: 'idle',
    BLOCKED: 'blocked',
    OFF: 'off'
});

/**
 * The Token Summary: every Token that counts toward the cap, placed or spawned, as one row per
 * type with how many copies are working, idle, blocked and disallowed.
 *
 * Rows with a Token missing items (`missing`) come first; the rest are grouped by skill section
 * the way the Shop is (sections by name, General last), a spawner placed right before the Tokens
 * it spawns. Binned Tokens still count in `MatCap` until Discard all, so they get their own count.
 *
 * Pure: the caller hands in the Tokens and every reader. Ties sort by name then type id, so the
 * list never shuffles between refreshes.
 *
 * @param {object[]} tokens  Token instances on the mat
 * @param {{
 *   nameOf: (typeId: string) => string,
 *   isExcluded?: (instance: object) => boolean,
 *   statusOf?: (instance: object) => { status: string, missing?: boolean },
 *   layoutOf?: (typeId: string) => { section: string, anchor: string, rank: number },
 *   sectionName?: (section: string) => string,
 *   binned?: object[]
 * }} readers  `layoutOf`: the section a type is listed under, the name it sorts beside (a spawned
 *   type sorts under its spawner's name) and `rank` (0 spawner or alone, 1 spawned).
 * @returns {{
 *   total: number,
 *   pinned: Row[],
 *   sections: { section: string, name: string, rows: Row[] }[],
 *   binned: { count: number }
 * }} where Row is `{ typeId, name, count, working, idle, blocked, off, missing }`
 */
export function summariseMat(tokens = [], {
    nameOf, isExcluded, statusOf = () => ({ status: TOKEN_STATUS.IDLE }),
    layoutOf = () => ({ section: GENERAL_SECTION, anchor: '', rank: 0 }),
    sectionName = (s) => s, binned = []
} = {}) {
    const byType = new Map();
    for (const t of tokens) {
        if (!t?.typeId || isExcluded?.(t)) continue;
        let row = byType.get(t.typeId);
        if (!row) {
            row = { typeId: t.typeId, name: nameOf ? nameOf(t.typeId) : t.typeId, count: 0, working: 0, idle: 0, blocked: 0, off: 0, missing: 0 };
            byType.set(t.typeId, row);
        }
        row.count++;
        const { status, missing } = statusOf(t) || {};
        if (status === TOKEN_STATUS.WORKING) row.working++;
        else if (status === TOKEN_STATUS.BLOCKED) row.blocked++;
        else if (status === TOKEN_STATUS.OFF) row.off++;
        else row.idle++;
        if (missing && status === TOKEN_STATUS.BLOCKED) row.missing++;
    }

    const byName = (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.typeId.localeCompare(b.typeId);
    const rows = [...byType.values()];
    const pinned = rows.filter(r => r.missing > 0).sort(byName);

    const sections = new Map();
    for (const row of rows) {
        if (row.missing > 0) continue;
        const layout = layoutOf(row.typeId) || {};
        const section = layout.section || GENERAL_SECTION;
        if (!sections.has(section)) sections.set(section, []);
        sections.get(section).push({ row, anchor: layout.anchor || row.name, rank: layout.rank || 0 });
    }
    const sectionList = [...sections.entries()].map(([section, items]) => ({
        section,
        name: sectionName(section),
        rows: items
            .sort((a, b) => a.anchor.localeCompare(b.anchor) || a.rank - b.rank || byName(a.row, b.row))
            .map(i => i.row)
    })).sort((a, b) => {
        if (a.section === GENERAL_SECTION) return 1;
        if (b.section === GENERAL_SECTION) return -1;
        return a.name.localeCompare(b.name);
    });

    return {
        total: rows.reduce((n, r) => n + r.count, 0),
        pinned,
        sections: sectionList,
        binned: { count: (binned || []).filter(t => t?.typeId && !isExcluded?.(t)).length }
    };
}

/** One type with its count, as the Token Summary writes it: `Oak Forest ×2`. */
export function rowLabel(row) {
    return `${row.name} ×${row.count}`;
}
