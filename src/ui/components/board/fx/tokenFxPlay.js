import { HIT_ANIMATIONS, buildHitKeyframes } from '../hitAnimations.js';
import { flashTint, afterimages, ringBlink, echoRing } from './tokenFx.js';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';

/** A blink: shown and hidden, one effect frame each, three times. */
const BLINK = Object.freeze(['visible', 'hidden', 'visible', 'hidden', 'visible', 'hidden']);

/**
 * The mat's one-off Token effects by name, for `UI_EVENTS.UI_TOKEN_FX` (the QA panel's effect
 * buttons, the Region settle, a knockout). Each plays exactly what the game's own trigger plays.
 * @param {HTMLElement} wrapper the Token's hit wrapper (`TokenHitArt`)
 * @param {{fx: string, tint?: string, dir?: number, ms?: number, frames?: number}} payload
 * @param {{unit: number}} options mat units per art pixel
 */
export function playTokenFx(wrapper, payload, { unit = 1 } = {}) {
    if (!wrapper || !payload?.fx || typeof wrapper.animate !== 'function') return;
    switch (payload.fx) {
        case 'flash':
            flashTint(wrapper, payload.tint || 'white', { frames: payload.frames || 2 });
            break;
        case 'hit': {
            const anim = HIT_ANIMATIONS.knockback;
            const dir = payload.dir === -1 ? -1 : 1;
            flashTint(wrapper, 'white', { frames: 2 });
            const keyframes = buildHitKeyframes(anim, { dir, unit });
            if (keyframes.length) wrapper.animate(keyframes, { duration: anim.ms });
            afterimages(wrapper, anim.poses.map(q => ({ ms: q.ms, x: (q.x || 0) * dir, y: q.y || 0 })), { unit });
            break;
        }
        case 'cycle':
            ringBlink(wrapper, 'hover', { frames: 1 });
            break;
        case 'transform':
            ringBlink(wrapper, 'hover', { frames: 3 });
            break;
        case 'echo':
            echoRing(wrapper, 'hover', { unit });
            break;
        case 'blink': {
            const { keyframes, duration } = heldPoses(BLINK.map(v => ({ ms: FX_FRAME_MS, visibility: v })), { rest: { visibility: 'visible' } });
            wrapper.animate(keyframes, { duration });
            break;
        }
        case 'hide':
            wrapper.animate([{ visibility: 'hidden' }, { visibility: 'hidden' }], { duration: payload.ms || 600 });
            break;
        default:
            break;
    }
}
