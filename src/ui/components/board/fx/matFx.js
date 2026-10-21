import { EventBus, UI_LISTENER } from '../../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../../systems/core/engineEvents.js';
import * as BoardState from '../../../../systems/board/BoardState.js';
import { artRadiusOf } from '../../../../config/matGeometry.js';
import { isDrawn } from '../../../dev/perf/drawSwitches.js';
import { STRIKE_DELAY_MS } from '../hitAnimations.js';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { spriteOf, makeCopy } from './spriteCopy.js';
import { tintUrl } from '../../../utils/spriteFx.js';

/**
 * The mat's effects that stand on the mat rather than on one Token's art: numbers rising off a
 * Token, a spark hopping between two, a beaten enemy's last blink and its puff. They are drawn in
 * one layer over the Tokens (`MatFxLayer`, `MAT_Z.FX`), in mat units, each element made when its
 * effect starts and taken away when it ends: at rest the layer is an empty box. Written straight
 * to the page; no React state, so an effect costs no render.
 */

let host = null;
/** Mat units per art pixel: the board's art step (`boardScaleAt`), so every move is whole screen pixels. */
let unit = 1;

/** The layer's element and the mat's art unit (`MatFxLayer` keeps them current). */
export function attachFxHost(el, artUnit = 1) {
    host = el || null;
    unit = artUnit > 0 ? artUnit : 1;
}

/** Put `el` on the mat at (`x`, `y`), play it, take it away at the end. */
function playAt(el, x, y, keyframes, duration, delay = 0) {
    if (!host || !el || typeof el.animate !== 'function') return null;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    host.appendChild(el);
    const anim = el.animate(keyframes, { duration, delay, fill: 'none' });
    const done = () => el.remove();
    anim.onfinish = done;
    anim.oncancel = done;
    return anim;
}

function pixel(colour, size = 1) {
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
        width: `${size * unit}px`,
        height: `${size * unit}px`,
        background: colour,
        visibility: 'hidden',
        pointerEvents: 'none'
    });
    return el;
}

const shown = (poses) => poses.map(p => ({ ...p, visibility: 'visible' }));

/** How a number rises: a damage number pops quickly, a rule's number climbs 6 px in three steps. */
const NUMBER_RISE = Object.freeze({
    damage: Object.freeze([
        { ms: FX_FRAME_MS, y: 0 }, { ms: FX_FRAME_MS, y: -3 }, { ms: FX_FRAME_MS, y: -5 }, { ms: 5 * FX_FRAME_MS, y: -6 }
    ]),
    gain: Object.freeze([
        { ms: 3 * FX_FRAME_MS, y: 0 }, { ms: 3 * FX_FRAME_MS, y: -2 }, { ms: 3 * FX_FRAME_MS, y: -4 }, { ms: 6 * FX_FRAME_MS, y: -6 }
    ])
});

/**
 * A number rising off the top of a Token and gone: `tone` `damage` (red, a hit) or `gain` (green, a
 * rule's +1). The pixel font with a hard one-pixel black edge (`.gi-fx-number`), no soft shadow.
 * @returns {Animation|null}
 */
export function floatNumber(instanceId, text, tone = 'gain', { delay = 0 } = {}) {
    const t = BoardState.getTokenById(instanceId);
    if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y) || text == null || text === '') return null;
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-fx-number', tone);
    el.className = `gi-fx-number gi-fx-number-${tone}`;
    el.textContent = String(text);
    el.style.visibility = 'hidden';
    const { keyframes, duration } = heldPoses(shown(NUMBER_RISE[tone] || NUMBER_RISE.gain), { unit, rest: { visibility: 'hidden' } });
    return playAt(el, t.x, t.y - artRadiusOf(t.typeId), keyframes, duration, delay);
}

/** How many hops a neighbour's spark takes from the giving Token to the one it reaches. */
export const SPARK_HOPS = 5;
export const SPARK_MS = SPARK_HOPS * FX_FRAME_MS;
const SPARK_COLOUR = '#ffe27a';

/**
 * Neighbour spark: one pixel hops from Token `fromId` to Token `toId` in {@link SPARK_HOPS} whole
 * art-pixel steps along a low arc, and is gone as it lands.
 * @returns {Animation|null}
 */
export function spark(fromId, toId) {
    const a = BoardState.getTokenById(fromId);
    const b = BoardState.getTokenById(toId);
    if (!a || !b || a === b || ![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
    const dx = (b.x - a.x) / unit;
    const dy = (b.y - a.y) / unit;
    const lift = Math.min(12, Math.max(4, Math.hypot(dx, dy) / 6));
    const poses = [];
    for (let i = 0; i <= SPARK_HOPS; i++) {
        const k = i / SPARK_HOPS;
        poses.push({ ms: FX_FRAME_MS, x: dx * k, y: dy * k - lift * 4 * k * (1 - k), visibility: i === SPARK_HOPS ? 'hidden' : 'visible' });
    }
    const { keyframes, duration } = heldPoses(poses, { unit, rest: { visibility: 'hidden' } });
    return playAt(pixel(SPARK_COLOUR), a.x, a.y - artRadiusOf(a.typeId) / 2, keyframes, duration);
}

const PUFF_COLOUR = '#d6d3d1';
const PUFF_DIRS = Object.freeze([[-1, 0], [1, 0], [-1, -1], [1, -1]]);

/** Four grey pixels puffing out from a point, three steps, then gone. */
export function puff(x, y, { delay = 0 } = {}) {
    for (const [dx, dy] of PUFF_DIRS) {
        const poses = [1, 2, 3].map(n => ({ ms: FX_FRAME_MS, x: dx * n * 2, y: dy * n, visibility: 'visible' }));
        const { keyframes, duration } = heldPoses(poses, { unit, rest: { visibility: 'hidden' } });
        playAt(pixel(PUFF_COLOUR), x, y, keyframes, duration, delay);
    }
}

/**
 * The beaten enemy's last moments, frame by frame: it blinks three times, drops 4 px in two steps,
 * then dissolves (half its pixels, a quarter, gone) while a grey puff rises at its feet.
 */
const KNOCKOUT = Object.freeze({
    art: 'VHVHVHVVHH',
    d50: 'HHHHHHHHVH',
    d25: 'HHHHHHHHHV',
    drop: [0, 0, 0, 0, 0, 0, 2, 4, 4, 4]
});
export const KNOCKOUT_MS = KNOCKOUT.drop.length * FX_FRAME_MS;

/**
 * A knocked-out enemy that is leaving the mat: a copy of its art, read from the page before the
 * mat takes the Token away, plays {@link KNOCKOUT} where it stood.
 * @returns {boolean} whether it played
 */
export function knockoutGhost(instanceId) {
    const t = BoardState.getTokenById(instanceId);
    const wrapper = typeof document !== 'undefined' ? document.querySelector(`[data-hit-art="${instanceId}"]`) : null;
    const sprite = spriteOf(wrapper);
    if (!t || !sprite || !host || ![t.x, t.y].every(Number.isFinite)) return false;
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.setAttribute('data-fx-knockout', instanceId);
    Object.assign(box.style, { width: `${sprite.size}px`, height: `${sprite.size}px`, pointerEvents: 'none' });
    const layers = [['art', null], ['d50', 50], ['d25', 25]];
    const parts = [];
    for (const [key, share] of layers) {
        const copy = makeCopy(sprite, share ? { dither: share } : {});
        if (!copy) continue;
        const poses = [...KNOCKOUT[key]].map(c => ({ ms: FX_FRAME_MS, visibility: c === 'V' ? 'visible' : 'hidden' }));
        const { keyframes, duration } = heldPoses(poses, { rest: { visibility: 'hidden' } });
        box.appendChild(copy);
        parts.push([copy, keyframes, duration]);
    }
    if (!parts.length) return false;
    const drop = KNOCKOUT.drop.map(y => ({ ms: FX_FRAME_MS, y }));
    const fall = heldPoses(drop, { unit });
    if (!playAt(box, t.x - sprite.size / 2, t.y - sprite.size / 2, fall.keyframes, fall.duration)) return false;
    for (const [copy, keyframes, duration] of parts) copy.animate(keyframes, { duration, fill: 'none' });
    puff(t.x, t.y + sprite.size / 2 - 2 * unit, { delay: 6 * FX_FRAME_MS });
    return true;
}

/** A knocked-out enemy that stays (it fights again): it blinks three times where it stands. */
function knockoutInPlace(instanceId) {
    EventBus.publish(UI_EVENTS.UI_TOKEN_FX, { instanceId, fx: 'blink' });
    const t = BoardState.getTokenById(instanceId);
    if (t && [t.x, t.y].every(Number.isFinite)) puff(t.x, t.y + artRadiusOf(t.typeId) / 2);
}

/**
 * Colour flash on a hero on the mat: their sprite, as it stands this frame, in one solid colour for
 * `frames` effect frames (green when they are healed). A copy of the hero's own art holder with the
 * generated tint picture in it, so a sheet keeps its frame and facing.
 * @returns {boolean} whether it played
 */
export function heroFlash(heroId, tint = 'green', { frames = 2 } = {}) {
    if (typeof document === 'undefined' || !heroId) return false;
    const img = document.querySelector(`[data-board-hero="${heroId}"] img`);
    const picture = img ? tintUrl(img.getAttribute('src'), tint) : null;
    if (!picture) return false;
    // A sheet is cropped by the box two levels up; a still sprite sits in its own span.
    const sheet = img.parentElement?.parentElement?.classList.contains('overflow-hidden');
    const holder = sheet ? img.parentElement.parentElement : img.parentElement;
    if (!holder?.parentElement || typeof holder.animate !== 'function') return false;
    const copy = holder.cloneNode(true);
    copy.querySelectorAll('[data-sprite-ring], [data-sprite-shadow]').forEach(el => el.remove());
    copy.querySelector('img').src = picture;
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('data-fx-copy', tint);
    copy.style.pointerEvents = 'none';
    copy.style.visibility = 'hidden';
    holder.parentElement.appendChild(copy);
    const anim = copy.animate([{ visibility: 'visible' }, { visibility: 'visible' }], { duration: frames * FX_FRAME_MS, fill: 'none' });
    const done = () => copy.remove();
    anim.onfinish = done;
    anim.oncancel = done;
    return true;
}

/**
 * The layer's listeners: a damage number on every landed hit (on the strike frame), a rule's
 * number and its neighbour's spark when a rule fires, a hero's green flash when food heals them in
 * a fight, the knockout when a fight is won.
 * @returns {() => void} unsubscribe
 */
export function watchMatFx() {
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
            if (!p?.hit || !isDrawn('matFx')) return;
            const dmg = Math.round(Number(p.damage));
            if (dmg > 0) floatNumber(p.instanceId, dmg, 'damage', { delay: STRIKE_DELAY_MS });
        }, UI_LISTENER),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => {
            if (!p?.instanceId || !isDrawn('matFx')) return;
            const from = p.fromTokenId && p.fromTokenId !== p.instanceId ? p.fromTokenId : null;
            if (from) spark(from, p.instanceId);
            const n = Number(p.amount);
            if (n > 0) floatNumber(p.instanceId, `+${n}`, 'gain', { delay: from ? SPARK_MS : 0 });
        }, UI_LISTENER),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATE, (p) => {
            if (p?.heroId && Number(p.healed) > 0 && isDrawn('matFx')) heroFlash(p.heroId, 'green');
        }, UI_LISTENER),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => {
            if (p?.outcome !== 'victory' || !p.instanceId || !isDrawn('matFx')) return;
            const t = BoardState.getTokenById(p.instanceId);
            const leaving = t && t.usesRemaining != null && t.usesRemaining <= 0;
            if (!(leaving && knockoutGhost(p.instanceId))) knockoutInPlace(p.instanceId);
        }, UI_LISTENER)
    ];
    return () => offs.forEach(off => off());
}
