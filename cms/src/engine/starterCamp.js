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
