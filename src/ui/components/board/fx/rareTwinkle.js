import { EventBus, UI_LISTENER } from '../../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../../systems/board/boardEvents.js';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { spriteOf, makeCopy } from './spriteCopy.js';
import { playIn } from './tokenFx.js';

/**
 * A rare find (effect 10): once the item has landed, it flashes gold for two frames and a
 * plus-shaped star, five art pixels across, flickers twice on its corner.
 * The drop is announced as the engine lands it, before the floor has drawn it
 * (`BOARD_EVENTS.RARE_DROP`), so it is remembered here and the floor's sprite asks once, as it
 * appears ({@link takeRareDrop}), as a spawn's pop-out does.
 */

/** A rare drop nobody drew within this long is forgotten. */
const STALE_MS = 2000;
const pending = new Map();

export function recordRareDrop(payload, now = Date.now()) {
    if (!payload?.spriteId) return;
    for (const [id, at] of pending) if (now - at > STALE_MS) pending.delete(id);
    pending.set(payload.spriteId, now);
}

/** Whether loot `spriteId`, just drawn, was a rare drop. Once. */
export function takeRareDrop(spriteId, now = Date.now()) {
    const at = pending.get(spriteId);
    if (at == null) return false;
    pending.delete(spriteId);
    return now - at <= STALE_MS;
}

/** Listen for rare drops (the floor calls this once). Returns the unsubscribe. */
export function watchRareDrops() {
    return EventBus.subscribe(BOARD_EVENTS.RARE_DROP, (p) => recordRareDrop(p), UI_LISTENER);
}

const STAR_COLOUR = '#fff3b0';
/** The star's flicker, one effect frame a letter: shown twice, then gone. */
const FLICKER = 'VVHVVH';

function bar(w, h, unit) {
    const el = document.createElement('span');
    Object.assign(el.style, {
        position: 'absolute',
        left: `${-Math.floor(w / 2) * unit}px`,
        top: `${-Math.floor(h / 2) * unit}px`,
        width: `${w * unit}px`,
        height: `${h * unit}px`,
        background: STAR_COLOUR
    });
    return el;
}

/**
 * The twinkle on one loot sprite's element, `delay` ms from now (when its hop has landed).
 * @param {HTMLElement} element the loot sprite's own element
 * @param {{unit?: number, delay?: number}} [options] mat units per art pixel
 */
export function playRareTwinkle(element, { unit = 1, delay = 0 } = {}) {
    const art = element?.querySelector?.('img')?.parentElement;
    const sprite = spriteOf(art);
    if (!art || !sprite) return;
    const gold = makeCopy(sprite, { tint: 'gold' });
    if (gold) playIn(art, gold, [{ visibility: 'visible' }, { visibility: 'visible' }], { duration: 2 * FX_FRAME_MS, delay });
    const star = document.createElement('span');
    star.setAttribute('aria-hidden', 'true');
    star.setAttribute('data-fx-star', 'rare');
    Object.assign(star.style, {
        position: 'absolute',
        left: `${Math.round(sprite.size * 0.8)}px`,
        top: `${Math.round(sprite.size * 0.2)}px`,
        width: '0px',
        height: '0px',
        pointerEvents: 'none',
        visibility: 'hidden'
    });
    star.appendChild(bar(5, 1, unit));
    star.appendChild(bar(1, 5, unit));
    const { keyframes, duration } = heldPoses([...FLICKER].map(c => ({ ms: FX_FRAME_MS, visibility: c === 'V' ? 'visible' : 'hidden' })), { rest: { visibility: 'hidden' } });
    playIn(art, star, keyframes, { duration, delay: delay + 2 * FX_FRAME_MS });
}
