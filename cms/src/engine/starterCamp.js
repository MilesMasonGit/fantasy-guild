import { normaliseStarterCamp, emptyStarterCamp, isEmptyStarterCamp } from '../../../src/config/starterCampShape.js';

/**
 * The Starter Camp in the CMS: the layout the game's dev button saved ("Save this mat as the
 * Starter Camp"), reviewed on the Starter Camp page and written to `data/starterCamp.json` by Sync
 * to Game. The shape is the game's own (`src/config/starterCampShape.js`).
 *
 * In the workspace it is `starterCamp`: null while this workspace has never held one (Sync then
 * leaves `data/starterCamp.json` alone), an empty camp after Clear (Sync writes it, and the game
 * opens on its built-in camp).
 */

export { normaliseStarterCamp, emptyStarterCamp, isEmptyStarterCamp };

/** The route the game posts to and the page reads (`vite-plugin-cms-api.js`). */
export const STARTER_CAMP_ROUTE = '/api/starter-camp';

/** `camp` with its Bank line for `itemId` set to `count`; zero or less removes the line. */
export function withBankCount(camp, itemId, count) {
    const base = normaliseStarterCamp(camp) || emptyStarterCamp();
    const n = Math.floor(Number(count));
    const bank = { ...base.bank };
    if (Number.isFinite(n) && n > 0) bank[itemId] = n;
    else delete bank[itemId];
    return { ...base, bank };
}

/** `camp` without its `index`th Token. */
export function withoutToken(camp, index) {
    const base = normaliseStarterCamp(camp) || emptyStarterCamp();
    return { ...base, tokens: base.tokens.filter((_, i) => i !== index) };
}

/** The layout the game saved and the page has not taken yet: `{ camp, receivedAt }`, or null. */
export async function fetchPendingFromGame() {
    const res = await fetch(STARTER_CAMP_ROUTE);
    if (!res.ok) return null;
    const body = await res.json();
    const camp = normaliseStarterCamp(body?.camp);
    return camp ? { camp, receivedAt: body.receivedAt || null } : null;
}

/** Throw away the layout the game saved (after taking it, or to discard it). */
export async function clearPendingFromGame() {
    await fetch(STARTER_CAMP_ROUTE, { method: 'DELETE' });
}

const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * What changes between two camps, for a change pack's review: Tokens paired by type (a Token at
 * the same point is unchanged; the rest of a type pair nearest first and count as moved; what is
 * left over was added or removed), every Bank line whose count differs (0 for none), and the Hall,
 * mat and banner when they differ. Either camp may be null (none yet).
 *
 * @returns {{ added: object[], removed: object[], moved: {typeId, from, to}[], unchanged: number,
 *          bank: {itemId, before, after}[], hall: {from, to}|null, mat: {from, to}|null,
 *          banner: {from, to}|null }}
 */
export function starterCampDiff(before, after) {
    const a = normaliseStarterCamp(before) || emptyStarterCamp();
    const b = normaliseStarterCamp(after) || emptyStarterCamp();
    const types = [...new Set([...a.tokens, ...b.tokens].map((t) => t.typeId))].sort();
    const added = [];
    const removed = [];
    const moved = [];
    let unchanged = 0;
    for (const typeId of types) {
        let was = a.tokens.filter((t) => t.typeId === typeId);
        let now = b.tokens.filter((t) => t.typeId === typeId);
        const stayed = now.filter((t) => was.some((w) => samePoint(w, t)));
        for (const t of stayed) {
            const i = was.findIndex((w) => samePoint(w, t));
            was = was.filter((_, k) => k !== i);
            now = now.filter((n) => n !== t);
            unchanged += 1;
        }
        const pairs = [];
        was.forEach((w, i) => now.forEach((n, j) => pairs.push({ i, j, d: distance2(w, n) })));
        pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
        const usedWas = new Set();
        const usedNow = new Set();
        const pairedMoves = [];
        for (const { i, j } of pairs) {
            if (usedWas.has(i) || usedNow.has(j)) continue;
            usedWas.add(i);
            usedNow.add(j);
            pairedMoves.push({ i, typeId, from: { x: was[i].x, y: was[i].y }, to: { x: now[j].x, y: now[j].y } });
        }
        moved.push(...pairedMoves.sort((p, q) => p.i - q.i).map(({ i, ...m }) => m));
        was.forEach((w, i) => { if (!usedWas.has(i)) removed.push({ ...w }); });
        now.forEach((n, j) => { if (!usedNow.has(j)) added.push({ ...n }); });
    }
    const bank = [...new Set([...Object.keys(a.bank), ...Object.keys(b.bank)])].sort()
        .map((itemId) => ({ itemId, before: a.bank[itemId] || 0, after: b.bank[itemId] || 0 }))
        .filter((line) => line.before !== line.after);
    const pointChange = (from, to) => (JSON.stringify(from) === JSON.stringify(to) ? null : { from, to });
    return {
        added, removed, moved, unchanged, bank,
        hall: pointChange(a.hall, b.hall),
        mat: pointChange(a.mat, b.mat),
        banner: (a.banner || null) === (b.banner || null) ? null : { from: a.banner || null, to: b.banner || null },
    };
}
