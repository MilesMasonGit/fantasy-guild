import * as BoardState from '../../../../systems/board/BoardState.js';
import * as HeroMotion from '../../../../systems/board/HeroMotion.js';
import { isDrawn } from '../../../dev/perf/drawSwitches.js';
import { STRIKE_DELAY_MS } from '../hitAnimations.js';
import { tokenSizeFor, TOKEN_SURFACE } from '../../base/TokenSprite.jsx';
import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { playAt, fxArtUnit } from './matFx.js';
import { startFightWatch, subscribeMoments, MOMENT, statusIcon } from '../../combat/fightWatch.js';
import { glyphSrc, GLYPH_COLOUR } from '../../combat/combatGlyphs.js';
import { t } from '../../../../i18n/index.js';

/**
 * A fight's floating numbers on the mat (owner, 2026-10-25): every hit both ways, "Miss", a big
 * "Crit!", green heals and the red poison and burn ticks with their drop or flame. Each rises at
 * its fighter's OUTER side (away from the other fighter, clear of the flag over the enemy), a
 * hero's blow on the strike frame of their swing, and is gone in half a second. White on the
 * enemy, red on the hero. Built from the fight watch's moments (`fightWatch.js`), drawn in the
 * mat's effect layer (`MatFxLayer`), sized in its `--fx-scale` (one screen pixel at the mat's 2×).
 */

/** How a float rises: a quick pop of 6 art pixels in three steps, held, then gone. */
const RISE = Object.freeze([
    { ms: FX_FRAME_MS, y: 0 }, { ms: FX_FRAME_MS, y: -3 }, { ms: FX_FRAME_MS, y: -5 }, { ms: 5 * FX_FRAME_MS, y: -6 }
]);

/** How long a float shows. */
export const FLOAT_MS = RISE.reduce((sum, p) => sum + p.ms, 0);

/** How far outside a fighter's art a float stands, and how far a second one at once stands above, in art pixels. */
const OUTSIDE_ART_PX = 4;
const LANE_ART_PX = 12;
/** Floats on one side less than this apart take the next lane up, so they never sit on each other. */
const LANE_MS = 400;
const LANES = 3;

/** `instanceId|side` → `{ at, lane }`: the last float's start on that side of a fight. */
const lanes = new Map();

/** The element of one float: what it says and its colours, nothing placed yet. */
export function buildFloat(m) {
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
    switch (m.kind) {
        case MOMENT.CRIT:
            el.className = `gi-fight-float gi-fight-float-crit ${onHero ? 'gi-ff-red' : 'gi-ff-white'}`;
            el.appendChild(span('gi-ff-crit-word', t('fight.float.crit')));
            el.appendChild(span('gi-ff-crit-number', String(m.amount)));
            break;
        case MOMENT.MISS:
            el.className = 'gi-fight-float gi-fight-float-miss gi-ff-white';
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
            el.className = `gi-fight-float ${onHero ? 'gi-ff-red' : 'gi-ff-white'}`;
            el.appendChild(span('gi-ff-number', String(m.amount)));
    }
    el.style.visibility = 'hidden';
    return el;
}

/**
 * Where a float about `m` rises, in mat units: beside its fighter on the side away from the other
 * one, at the middle of their art. Null when either fighter is not on the mat.
 */
export function floatPoint(m, unit = fxArtUnit()) {
    const enemy = BoardState.getTokenById(m.instanceId);
    const body = HeroMotion.bodyView(m.heroId);
    if (!enemy || !body || ![enemy.x, enemy.y, body.x, body.y].every(Number.isFinite)) return null;
    // Which side of the enemy the hero stands on.
    const side = body.x >= enemy.x ? 1 : -1;
    const gap = OUTSIDE_ART_PX * unit;
    if (m.on === 'enemy') {
        const half = tokenSizeFor(TOKEN_SURFACE.BOARD, enemy.typeId, unit) / 2;
        return { x: enemy.x - side * (half + gap), y: enemy.y };
    }
    const half = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, unit) / 2;
    return { x: body.x + side * (half + gap), y: body.y };
}

/** Play one moment's float. @returns {Animation|null} */
export function playFloat(m, now = performance.now()) {
    if (!m || (m.amount == null && m.kind !== MOMENT.MISS)) return null;
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
    const { keyframes, duration } = heldPoses(
        RISE.map(p => ({ ...p, visibility: 'visible' })),
        { unit, rest: { visibility: 'hidden' } }
    );
    return playAt(el, at.x, at.y - lane * LANE_ART_PX * unit, keyframes, duration, delay);
}

/**
 * Draw every fight's floats from now on.
 * @returns {() => void} stop
 */
export function watchFightFloats() {
    const stopWatch = startFightWatch();
    const off = subscribeMoments((m) => {
        if (isDrawn('matFx')) playFloat(m);
    });
    return () => {
        off();
        stopWatch();
        lanes.clear();
    };
}
