import { FLAG_CLOTH } from './flagGeometry.js';

/** Whether a client point is on a flag's cloth, measured on the flag's own drawn box. */
export function onFlagCloth(flagEl, clientX, clientY) {
    const r = flagEl?.getBoundingClientRect?.();
    if (!r || !(r.width > 0) || !(r.height > 0)) return false;
    const u = (clientX - r.left) / r.width;
    const v = (clientY - r.top) / r.height;
    return u >= FLAG_CLOTH.left && u <= FLAG_CLOTH.right && v >= FLAG_CLOTH.top && v <= FLAG_CLOTH.bottom;
}

/**
 * The flag whose cloth is drawn in front of Token `tokenId` at a client point, or null.
 * Over a Token's round body a flag lets the pointer through to the Token, except on its cloth
 * where the flag is drawn in front of that Token: a flag standing among Tokens can always be
 * picked up by its banner. Its pole, its grass and its empty corners still let the Token have it.
 * @param {HTMLElement} matEl the mat (`data-mat-board`)
 * @returns {HTMLElement|null} the flag's button
 */
export function flagClothOver(matEl, clientX, clientY, tokenId) {
    if (!matEl || !tokenId) return null;
    const art = [...matEl.querySelectorAll('[data-token-art]')].find(el => el.getAttribute('data-token-id') === tokenId);
    const tokenZ = Number(art?.style.zIndex) || 0;
    let best = null;
    let bestZ = -Infinity;
    for (const flag of matEl.querySelectorAll('button[data-flag]')) {
        const z = Number(flag.style.zIndex) || 0;
        if (z <= tokenZ || z <= bestZ) continue;
        if (!onFlagCloth(flag, clientX, clientY)) continue;
        best = flag;
        bestZ = z;
    }
    return best;
}
