import * as BoardState from '../../../../systems/board/BoardState.js';
import * as HeroMotion from '../../../../systems/board/HeroMotion.js';
import { isDrawn } from '../../../dev/perf/drawSwitches.js';
import { STRIKE_DELAY_MS } from '../hitAnimations.js';
import { tokenSizeFor, TOKEN_SURFACE } from '../../base/TokenSprite.jsx';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { playAt, fxArtUnit } from './matFx.js';
import { isDrawingPaused } from '../frameClock.js';
import { startFightWatch, subscribeMoments, MOMENT, statusIcon } from '../../combat/fightWatch.js';
import { glyphSrc, GLYPH_COLOUR } from '../../combat/combatGlyphs.js';
import { t } from '../../../../i18n/index.js';

/**
 * A fight's floats on the mat (owner's pick, 2026-11-05, "fewer floats"): every hit both ways, a
 * gold "Crit!" over a big number, "Miss", green heals and the red poison and burn ticks with their
 * drop or flame. Each rises over its fighter, just under the health bar, a hero's blow on the strike
 * frame of their swing, and is gone in half a second. White on the enemy, red on the hero. A
 * hit's damage types, "Weak!" and "Resisted" are the fight window's and the log's; an enemy's move
 * by name is said in a bubble over its bar (`CalloutLayer`). Built from the fight watch's moments
 * (`fightWatch.js`), drawn in the mat's effect layer (`MatFxLayer`), sized in its `--fx-scale` (one
 * screen pixel at the mat's 2×).
 */

/** How a float rises: a quick pop of 6 art pixels in three steps, held, then gone. */
const RISE = Object.freeze([
    { ms: FX_FRAME_MS, y: 0 }, { ms: FX_FRAME_MS, y: -3 }, { ms: FX_FRAME_MS, y: -5 }, { ms: 5 * FX_FRAME_MS, y: -6 }
]);

/** How far under the top of its fighter's art a float starts, and how far a second one at once stands below, in art pixels. */
const UNDER_ART_TOP_PX = 9;
const LANE_ART_PX = 12;
/** Floats on one fighter less than this apart take the next lane down, so they never sit on each other. */
const LANE_MS = 400;
const LANES = 3;

/** The moments that float: an enemy's move alone (`MOVE`) is a bubble, not a float. */
const FLOATS = new Set([MOMENT.HIT, MOMENT.CRIT, MOMENT.MISS, MOMENT.HEAL, MOMENT.TICK]);

/** `instanceId|side` → `{ at, lane }`: the last float's start on that fighter. */
const lanes = new Map();

/** The element of one float: what it says and its colours, nothing placed yet. Null for a moment that does not float. */
export function buildFloat(m) {
    if (!FLOATS.has(m?.kind)) return null;
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-fight-float', m.kind);
    el.setAttribute('data-fight-float-on', m.on);
    const onHero = m.on === 'hero';
    const span = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        return s;
    };
    const tone = onHero ? 'gi-ff-red' : 'gi-ff-white';
    switch (m.kind) {
        case MOMENT.CRIT:
            el.className = `gi-fight-float gi-fight-float-crit ${tone}`;
            el.append(span('gi-ff-crit-word', t('fight.float.crit')), span('gi-ff-crit-number', String(m.amount)));
            break;
        case MOMENT.MISS:
            el.className = `gi-fight-float gi-fight-float-miss ${tone}`;
            el.appendChild(span('gi-ff-word', t('fight.float.miss')));
            break;
        case MOMENT.HEAL:
            el.className = 'gi-fight-float gi-ff-green';
            el.appendChild(span('gi-ff-number', `+${m.amount}`));
            break;
        case MOMENT.TICK: {
            el.className = 'gi-fight-float gi-ff-red';
            const icon = document.createElement('img');
            const name = statusIcon(m.statusId);
            icon.src = glyphSrc(name, GLYPH_COLOUR.red, true);
            icon.alt = '';
            icon.draggable = false;
            icon.className = 'gi-ff-icon';
            icon.setAttribute('data-glyph', name);
            el.appendChild(icon);
            el.appendChild(span('gi-ff-number', String(m.amount)));
            break;
        }
        default:
            el.className = `gi-fight-float ${tone}`;
            el.appendChild(span('gi-ff-number', String(m.amount)));
    }
    el.style.visibility = 'hidden';
    return el;
}

/**
 * Where a float about `m` starts, in mat units: over the middle of its fighter, its top just under
 * the top of their art (under the health bar). Null when either fighter is not on the mat.
 */
export function floatPoint(m, unit = fxArtUnit()) {
    const enemy = BoardState.getTokenById(m.instanceId);
    const body = HeroMotion.bodyView(m.heroId);
    if (!enemy || !body || ![enemy.x, enemy.y, body.x, body.y].every(Number.isFinite)) return null;
    const drop = UNDER_ART_TOP_PX * unit;
    if (m.on === 'enemy') {
        const half = tokenSizeFor(TOKEN_SURFACE.BOARD, enemy.typeId, unit) / 2;
        return { x: enemy.x, y: enemy.y - half + drop };
    }
    const half = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, unit) / 2;
    return { x: body.x, y: body.y - half + drop };
}

/** Play one moment's float. @returns {Animation|null} */
export function playFloat(m, now = performance.now()) {
    if (!m || !FLOATS.has(m.kind) || (m.amount == null && m.kind !== MOMENT.MISS)) return null;
    const unit = fxArtUnit();
    const at = floatPoint(m, unit);
    if (!at) return null;
    // A hero's blow lands on the strike frame of their swing; everything else at once.
    const delay = m.by === 'hero' && m.on === 'enemy' ? STRIKE_DELAY_MS : 0;
    const key = `${m.instanceId}|${m.on}`;
    const start = now + delay;
    const prev = lanes.get(key);
    const lane = prev && start - prev.at < LANE_MS ? (prev.lane + 1) % LANES : 0;
    lanes.set(key, { at: start, lane });
    const el = buildFloat(m);
    // Hung by its top, so a two-line crit grows down, away from the bar.
    el.style.translate = '-50% 0';
    const { keyframes, duration } = heldPoses(
        RISE.map(p => ({ ...p, visibility: 'visible' })),
        { unit, rest: { visibility: 'hidden' } }
    );
    return playAt(el, at.x, at.y + lane * LANE_ART_PX * unit, keyframes, duration, delay);
}

/**
 * Draw every fight's floats from now on.
 * @returns {() => void} stop
 */
export function watchFightFloats() {
    const stopWatch = startFightWatch();
    const off = subscribeMoments((m) => {
        // ⚠️ None while drawing is paused: each would stay on the page until the window came back.
        if (isDrawn('matFx') && !isDrawingPaused()) playFloat(m);
    });
    return () => {
        off();
        stopWatch();
        lanes.clear();
    };
}
