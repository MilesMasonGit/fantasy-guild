// The QA panel's Starter Camp tools: lay out the mat, then save it to the CMS
// ⚠️ DEV BUILDS ONLY: TestDashboard renders the section behind `import.meta.env.DEV`.

import { getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as StarterCamp from '../../systems/atlas/StarterCamp.js';

/** Where the CMS runs when started with `npm --prefix cms run dev`. */
export const DEFAULT_CMS_URL = 'http://localhost:5174';

/** The CMS route that keeps a saved camp for its Starter Camp page (`cms/vite-plugin-cms-api.js`). */
const ROUTE = '/api/starter-camp';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Put a Token of any type on the mat, beside the Guild Hall (`Placement.placeArrivalNear`), fresh
 * and `placed`: how the owner brings Tokens the Shop does not sell (the endgame sites) onto the mat
 * to lay out the Starter Camp. It ignores the Token cap.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function devPlaceToken(typeId) {
    const id = String(typeId || '').trim();
    if (!getTokenType(id)) return { success: false, reason: `No Token type "${id}"` };
    const instance = BoardState.createTokenInstance(id, tokenStartingUses(id));
    const res = Placement.placeArrivalNear(instance, Placement.centreOfBoard());
    return res?.success ? { ...res, instance } : res;
}

/**
 * Save the live mat as the Starter Camp: post it (`StarterCamp.campFromLiveMat`) to the CMS, which
 * keeps it until its Starter Camp page takes it into the workspace. Nothing is written to `data/`:
 * that is Sync to Game's job, after the owner has reviewed it.
 *
 * @param {object} options
 * @param {string} options.cmsUrl where the CMS runs
 * @param {string} [options.savedAt] when, as an ISO time
 * @param {typeof fetch} [options.fetchFn]
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function saveLiveMatToCms({ cmsUrl = DEFAULT_CMS_URL, savedAt = null, fetchFn = fetch } = {}) {
    const { camp, skipped } = StarterCamp.campFromLiveMat({ savedAt });
    const base = String(cmsUrl || DEFAULT_CMS_URL).trim().replace(/\/+$/, '');
    let res;
    try {
        res = await fetchFn(`${base}${ROUTE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ camp })
        });
    } catch {
        return { ok: false, message: `Could not reach the CMS at ${base}. Start it (npm --prefix cms run dev) and press again.` };
    }
    if (!res?.ok) {
        const body = await res?.json?.().catch(() => null);
        return { ok: false, message: `The CMS refused it: ${body?.error || `error ${res?.status}`}` };
    }
    const left = [
        skipped.spawned ? `${plural(skipped.spawned, 'spawned Token')} (the camp's spawners make them)` : '',
        skipped.quests ? plural(skipped.quests, 'quest') : ''
    ].filter(Boolean).join(' and ');
    return {
        ok: true,
        message: `Saved ${plural(camp.tokens.length, 'Token')}, the Guild Hall and ${plural(Object.keys(camp.bank).length, 'Bank item')} to the CMS` +
            `${left ? `, leaving out ${left}` : ''}. Open its Starter Camp page to review it, then Sync to Game.`
    };
}

/** Every Token type, by name, for the Place Token picker. */
export function placeableTypes(allTypes) {
    return Object.keys(allTypes || {})
        .map(id => ({ id, name: tokenName(id), landmark: allTypes[id]?.landmark === true }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
