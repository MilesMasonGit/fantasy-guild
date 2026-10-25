import { EventBus, UI_LISTENER } from '../../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../../systems/core/engineEvents.js';
import * as BoardState from '../../../../systems/board/BoardState.js';
import { artRadiusOf } from '../../../../config/matGeometry.js';
import { isDrawn } from '../../../dev/perf/drawSwitches.js';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { spriteOf, makeCopy } from './spriteCopy.js';
import { tintUrl } from '../../../utils/spriteFx.js';
import * as HeroMotion from '../../../../systems/board/HeroMotion.js';
import { bubbleAnchorY } from '../bubbleLayout.js';
import { ART_PX } from '../../../../config/matGeometry.js';
import { getItem } from '../../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../../utils/AssetManager.js';
import { itemTintName } from '../../base/itemTint.js';
import { clearOfFight } from '../healthBar.js';
import * as BoardCombat from '../../../../systems/board/BoardCombat.js';
import * as HeroManager from '../../../../systems/hero/HeroManager.js';

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
/** Mat units per plate pixel (`workPlate.plateUnit`): the health bar's and the frames' unit. */
let plateU = 1;

/** The layer's element, the mat's art unit and its plate unit (`MatFxLayer` keeps them current). */
export function attachFxHost(el, artUnit = 1, plateUnit = 1) {
    host = el || null;
    unit = artUnit > 0 ? artUnit : 1;
    plateU = plateUnit > 0 ? plateUnit : 1;
}

/** Mat units per art pixel, as the layer last set it. */
export function fxArtUnit() {
    return unit;
}

/** Put `el` on the mat at (`x`, `y`), play it, take it away at the end. */
export function playAt(el, x, y, keyframes, duration, delay = 0) {
    if (!host || !el || typeof el.animate !== 'function') return null;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // ⚠️ On the main thread: on the compositor it would put the speech bubbles and callouts drawn
    // after it on layers of their own, drawn soft (tailwind.css, at `.gi-token-land`).
    el.style.willChange = 'contents';
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

/** How long a "used" bubble stays over a hero. */
export const USED_BUBBLE_MS = 1500;

/** Most "used" bubbles over one hero at once, as the speech stack (`heroSpeech.MAX_BUBBLES`). */
export const USED_BUBBLE_MAX = 3;

/** Icons in a used bubble are 16 art pixels, like the level-up float's. */
const USED_ICON_ART_PX = 16;

/** The chamfer frame's line colour (`u_frame_chamfer.png`). */
const CHAMFER_LINE = '#977316';

/** Each hero's column of bubbles: `{ el, items: [{ el, anim }] }`, oldest first. */
const usedColumns = new Map();

/** Chamfer pictures by fill colour, made once each. */
const chamferByFill = new Map();

/**
 * The game's chamfer frame (`u_frame_chamfer.png`, 7×7, 3-pixel corners) with `fill` as its
 * centre, so the item's tint fills the whole box. Drawn in code like the gold edition in
 * `tailwind.css`, because the picture's own centre is the panel colour.
 */
function chamferPicture(fill) {
    if (chamferByFill.has(fill)) return chamferByFill.get(fill);
    const rows = ['  LLL  ', ' LFFFL ', 'LFFFFFL', 'LFFFFFL', 'LFFFFFL', ' LFFFL ', '  LLL  '];
    let line = '';
    let body = '';
    rows.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === 'L') line += `M${x} ${y}h1v1h-1z`;
        if (c === 'F') body += `M${x} ${y}h1v1h-1z`;
    }));
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'>` +
        `<path fill='${CHAMFER_LINE}' d='${line}'/><path fill='${fill}' d='${body}'/></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    chamferByFill.set(fill, url);
    return url;
}

/** The colour of an item-tint shade, read from the page's own `--color-item-tint-*`. */
function tintColour(tint) {
    const value = typeof getComputedStyle === 'function'
        ? getComputedStyle(document.documentElement).getPropertyValue(`--color-item-tint-${tint}`).trim()
        : '';
    return value || '#282a30';
}

/**
 * What a "used" bubble says for one `HERO_CONSUMED`: the health a meal gave back ("+5 ♥"), or the
 * name of an elixir, a drink or a work potion as it is drunk (`dose`). Null when there is nothing to
 * say (a meal at full health).
 */
export function usedBubbleText(p) {
    if (!p?.itemId) return null;
    if (p.elixir || p.dose) return getItem(p.itemId)?.name || p.itemId;
    const healed = Math.round(Number(p.amount) || 0);
    return healed > 0 ? `+${healed} ♥` : null;
}

/** The column of bubbles over a hero's head, made when first needed and kept over the head. */
function usedColumn(heroId, x, y) {
    let column = usedColumns.get(heroId);
    if (!column || !column.el.isConnected) {
        const el = document.createElement('div');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-fx-used-column', heroId);
        el.className = 'gi-used-column';
        // ⚠️ On the main thread, like every effect among the Tokens (see `playAt`).
        el.style.willChange = 'contents';
        host.appendChild(el);
        column = { el, items: [] };
        usedColumns.set(heroId, column);
    }
    column.el.style.setProperty('--used-u', `${unit}px`);
    column.el.style.left = `${x}px`;
    column.el.style.top = `${y}px`;
    return column;
}

/** Take one bubble out of its column, and the column with its last bubble. */
function dropUsed(heroId, column, entry) {
    entry.el.remove();
    column.items = column.items.filter(i => i !== entry);
    if (!column.items.length) {
        column.el.remove();
        if (usedColumns.get(heroId) === column) usedColumns.delete(heroId);
    }
}

/**
 * The "used" bubble: the item's icon and what it did in the game's chamfer pixel frame, filled with
 * the tint the item's Bank tile wears (`itemTint.js`), so food, drink and elixirs read by colour,
 * over the hero's head for {@link USED_BUBBLE_MS}. Measured in art pixels, text included, so it
 * scales with the mat like the icon, and sized by its contents. Several at once stack as the
 * speech bubbles do: oldest on top, the newest nearest the head, at most {@link USED_BUBBLE_MAX}
 * (the oldest gives way). Nothing is drawn for a hero who is not on the mat.
 * @returns {Animation|null}
 */
export function usedBubble(heroId, itemId, text) {
    if (!host || !heroId || !text) return null;
    const body = HeroMotion.bodyView(heroId);
    if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return null;

    // A hero whose health bar shows (in a fight, or hurt): above its number, never on it.
    const head = bubbleAnchorY(body.y, ART_PX * unit);
    const hero = HeroManager.getHero(heroId);
    const barShown = !!BoardCombat.fightOfHero(heroId) || (!!hero?.hp && hero.hp.current < hero.hp.max);
    const foot = barShown ? clearOfFight(head, body.y - (ART_PX * unit) / 2, plateU, 2 * plateU) : head;
    const column = usedColumn(heroId, body.x, foot);
    while (column.items.length >= USED_BUBBLE_MAX) {
        const oldest = column.items[0];
        dropUsed(heroId, column, oldest);
        oldest.anim?.cancel?.();
    }

    const el = document.createElement('div');
    el.setAttribute('data-fx-used', heroId);
    el.className = 'gi-used-bubble';
    const item = getItem(itemId);
    const tint = itemTintName(item);
    el.setAttribute('data-fx-used-tint', tint);
    el.style.borderImageSource = chamferPicture(tintColour(tint));
    el.style.visibility = 'hidden';
    const src = resolveSpritePath(item || itemId);
    if (src) {
        const icon = document.createElement('img');
        icon.src = src.startsWith('/') || src.startsWith('http') || src.startsWith('data:') ? src : `/${src}`;
        icon.alt = '';
        icon.draggable = false;
        const px = USED_ICON_ART_PX * unit;
        Object.assign(icon.style, { width: `${px}px`, height: `${px}px`, imageRendering: 'pixelated' });
        el.appendChild(icon);
    }
    const label = document.createElement('span');
    label.textContent = text;
    el.appendChild(label);
    column.el.appendChild(el);

    const rise = [
        { ms: 2 * FX_FRAME_MS, y: 0 },
        { ms: 2 * FX_FRAME_MS, y: -1 },
        { ms: USED_BUBBLE_MS - 4 * FX_FRAME_MS, y: -2 }
    ];
    const { keyframes, duration } = heldPoses(shown(rise), { unit, rest: { visibility: 'hidden' } });
    const anim = typeof el.animate === 'function' ? el.animate(keyframes, { duration, fill: 'none' }) : null;
    const entry = { el, anim };
    column.items.push(entry);
    if (!anim) {
        dropUsed(heroId, column, entry);
        return null;
    }
    const done = () => { if (column.items.includes(entry)) dropUsed(heroId, column, entry); };
    anim.onfinish = done;
    anim.oncancel = done;
    return anim;
}

/**
 * The layer's listeners: a rule's number and its neighbour's spark when a rule fires (a fight's
 * numbers are `fightFloats.js`'), a hero's green flash when food heals them in
 * a fight, the "used" bubble when a hero eats, drinks or drinks an elixir, the knockout when a
 * fight is won.
 * @returns {() => void} unsubscribe
 */
export function watchMatFx() {
    const offs = [
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
        // ⚠️ A UI listener, so a catch-up's meals and elixirs (a quiet bus) draw nothing.
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => {
            if (!p?.heroId || !isDrawn('matFx')) return;
            const text = usedBubbleText(p);
            if (text) usedBubble(p.heroId, p.itemId, text);
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
