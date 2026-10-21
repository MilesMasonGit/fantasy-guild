
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { isCombatSkill } from '../../../config/registries/skillRegistry.js';
import { heldPoses } from './fx/pixelSteps.js';

/**
 * The Token reacts each time its hero strikes it, one animation per skill.
 * - **Work** has no per-strike engine signal (only cycles), so a worked Token plays its
 * reaction once per loop of the hero's attack animation, timed to {@link STRIKE_FRAME}. Both
 * clocks are pure functions of the time and the hero's id ({@link heroFrameAt}, {@link
 * strikeStartTime}), so they cannot drift apart and need no shared state.
 * - **Combat** has a real signal: `combat_hero_attack`. A landed hit knocks the enemy back,
 * away from the hero (and flashes it white, `tokenFx.js`); a miss does nothing. A fighting hero
 * idles and plays its attack row once per attack, and the knockback waits for that
 * play-through's strike frame ({@link STRIKE_DELAY_MS}).
 * {@link HIT_ANIMATIONS} is data: a skill names an animation, and an animation is a list of held
 * poses, `x`/`y` in whole art pixels, each held for its `ms` and then jumped from
 * (`fx/pixelSteps.js`), the way the landing hop moves.
 * ⚠️ No scale and no rotation: either resamples the pixel art and blurs it (the rule in
 * `tailwind.css` above the landing keyframes). A squash, a sway or a pulse is sold by whole-pixel
 * movement alone.
 * {@link buildHitKeyframes} turns one into Web Animations keyframes.
 * Only the Token's art moves (a wrapper inside the art box), so its point, round hit area,
 * badges and drag are untouched.
 */

export const HERO_FRAMES = 8;
export const HERO_FRAME_MS = 125;

export const HIT_PERIOD_MS = HERO_FRAMES * HERO_FRAME_MS;

/**
 * The frame of the attack row where the blow lands: the swing is at full extension on frame 5
 * of the shipped sheets, which share one layout.
 */
export const STRIKE_FRAME = 5;

export const COMBAT = 'combat';

/** An animation from its poses: `ms` is how long the movement lasts, the rest of a loop is still. */
const moves = (poses, extra = {}) => Object.freeze({
    ms: poses.reduce((sum, p) => sum + p.ms, 0),
    poses: Object.freeze(poses.map(p => Object.freeze(p))),
    ...extra
});

/**
 * skill to animation, in art pixels. `directional` animations point their `x` away from the hero.
 */
export const HIT_ANIMATIONS = Object.freeze({
    shake: moves([
        { ms: 60, x: -2 }, { ms: 60, x: 2 }, { ms: 60, x: -2 }, { ms: 60, x: 1 }, { ms: 60, x: -1 }
    ]),
    jitter: moves([
        { ms: 50, x: -1, y: 1 }, { ms: 50, x: 1, y: -1 }, { ms: 50, x: -1, y: -1 },
        { ms: 50, x: 1, y: 1 }, { ms: 50, x: -1, y: 0 }, { ms: 50, x: 1, y: 0 }
    ]),
    bob: moves([
        { ms: 125, y: -1 }, { ms: 250, y: -2 }, { ms: 125, y: -1 }, { ms: 125, y: 0 },
        { ms: 125, y: 1 }, { ms: 125, y: 0 }
    ]),
    sway: moves([
        { ms: 100, x: 1 }, { ms: 150, x: 2 }, { ms: 100, x: 1 }, { ms: 100, x: -1 },
        { ms: 150, x: -2 }, { ms: 100, x: -1 }
    ]),
    squash: moves([
        { ms: 40, y: 1 }, { ms: 80, y: 2 }, { ms: 80, y: -1 }
    ]),
    hop: moves([
        { ms: 40, y: -1 }, { ms: 40, y: -2 }, { ms: 60, y: -4 }, { ms: 40, y: -3 },
        { ms: 40, y: -1 }, { ms: 60, y: 1 }
    ]),
    pulse: moves([
        { ms: 90, y: -1 }, { ms: 90, y: 0 }, { ms: 90, y: -1 }
    ]),
    thump: moves([
        { ms: 55, y: 1 }, { ms: 55, y: 2 }, { ms: 80, y: 1 }, { ms: 80, y: -1 }
    ]),
    rustle: moves([
        { ms: 150, x: -1 }, { ms: 150, x: 1 }, { ms: 150, x: -1 }, { ms: 150, x: 0 }
    ]),
    knockback: moves([
        { ms: 60, x: 3 }, { ms: 60, x: 5 }, { ms: 60, x: 4 }, { ms: 60, x: 2 }, { ms: 60, x: 1 }
    ], { directional: true })
});

/** Which animation each skill plays. A skill not listed plays nothing. */
export const SKILL_HIT = Object.freeze({
    forestry: 'shake',
    mining: 'jitter',
    fishing: 'bob',
    farming: 'sway',
    smithing: 'squash',
    crafting: 'hop',
    cooking: 'pulse',
    construction: 'thump',
    [COMBAT]: 'knockback'
});

/** Every combat style plays the combat animation; the registry says which skills those are. */
const isCombatKey = (key) => key === COMBAT || isCombatSkill(key);

/**
 * The skill a hero uses on a Token of type `def`: combat for an enemy, a Foundation's build
 * skill, a gathering Token's `config.skill`, or the skill a station names (`stationSkillOf`).
 * Null when it names none.
 */
export function hitSkillOf(def) {
    if (!def) return null;
    if (def.enemy) return COMBAT;
    return def.foundation?.skill || def.config?.skill || stationSkillOf(def) || null;
}

export function hitAnimationNameFor(skill) {
    if (!skill) return null;
    const key = String(skill).toLowerCase();
    return SKILL_HIT[isCombatKey(key) ? COMBAT : key] || null;
}

export function hitAnimationFor(skill) {
    const name = hitAnimationNameFor(skill);
    return name ? { name, ...HIT_ANIMATIONS[name] } : null;
}

export function hitsOnAttack(skill) {
    return hitAnimationNameFor(skill) === SKILL_HIT[COMBAT];
}

/**
 * Which way a knockback goes along x: away from the hero (+1 right, -1 left). Read from where
 * the hero stands; if that says nothing, from the side they work it from (as `HeroMotion`
 * records it); else right.
 */
export function knockbackDir(tokenX, heroX, heroSide = null) {
    if (Number.isFinite(tokenX) && Number.isFinite(heroX) && tokenX !== heroX) {
        return tokenX > heroX ? 1 : -1;
    }
    if (heroSide === 1 || heroSide === -1) return -heroSide;
    return 1;
}

/**
 * Web Animations keyframes for one animation.
 * @param {object} anim an entry of {@link HIT_ANIMATIONS} (or {@link hitAnimationFor})
 * @param {object} [options]
 * @param {number} [options.dir] +1 / -1, for a directional animation
 * @param {number} [options.periodMs] the movement at the start of a loop this long (work),
 * holding still for the rest; omit for a one-shot
 * @param {boolean} [options.reducedMotion] no movement, so nothing to play
 * @param {number} [options.unit] mat units (CSS px) per art pixel
 * @returns {Array<object>} keyframes (empty when there is nothing to play)
 */
export function buildHitKeyframes(anim, { dir = 1, periodMs = null, reducedMotion = false, unit = 1 } = {}) {
    if (!anim?.poses?.length || reducedMotion) return [];
    const d = anim.directional ? (dir < 0 ? -1 : 1) : 1;
    const poses = anim.poses.map(p => ({ ms: p.ms, x: (p.x || 0) * d, y: p.y || 0 }));
    if (periodMs && periodMs > anim.ms) poses.push({ ms: periodMs - anim.ms, x: 0, y: 0 });
    return heldPoses(poses, { unit }).keyframes;
}


/**
 * A hero's own phase in the loop, from their id, so two heroes side by side do not swing in
 * lockstep. Deterministic: the sprite and the Token both ask.
 */
export function heroPhaseMs(heroId) {
    if (!heroId) return 0;
    let h = 0;
    const s = String(heroId);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % HIT_PERIOD_MS;
}

const mod = (a, n) => ((a % n) + n) % n;

/**
 * The frame a hero's sprite shows at time `now` (ms, `performance.now()`): a function of the
 * time, not a counter, so it never drifts from the Token.
 */
export function heroFrameAt(now, heroId, frameMs = HERO_FRAME_MS, frames = HERO_FRAMES) {
    return Math.floor(mod(now + heroPhaseMs(heroId), frameMs * frames) / frameMs);
}

/**
 * The `startTime` for a Token's looping hit animation, so each loop begins on the hero's
 * strike frame: the most recent strike at or before `now`.
 */
export function strikeStartTime(now, heroId) {
    const strikeAt = STRIKE_FRAME * HERO_FRAME_MS;
    return now - mod(now + heroPhaseMs(heroId) - strikeAt, HIT_PERIOD_MS);
}


/**
 * Is the hero really striking this Token? One test, asked by both sides so they can never
 * disagree: the Token's hit reaction (`TokenHitArt`'s `active`) and the hero's swing
 * (`MatBoard`). A Token with an alert on it is not being worked, so it does not react and its
 * hero stands idle instead of swinging at nothing.
 * @param {string|null} heroId who holds the Token
 * @param {string|null} alert  the Token's own alert (`instance.alert`)
 */
export function strikesLive(heroId, alert) {
    return !!heroId && !alert;
}

/**
 * The hero's animation state:
 * - `walk`: moving;
 * - `attack`: working a Token that is being worked, the 1 s swing loop;
 * - `combat`: fighting, idle with ONE attack play-through per real attack ({@link
 * heroSpriteFrame});
 * - `idle`: anything else, including a hero stuck on a Token.
 */
export function heroAnimationState({ moving = false, working = false, stuck = false, combat = false } = {}) {
    if (moving) return 'walk';
    if (!working || stuck) return 'idle';
    return combat ? 'combat' : 'attack';
}

/**
 * The knockback waits for the blow. A real attack (`combat_hero_attack`) starts the hero's
 * attack row at frame 0; the blade reaches full extension on {@link STRIKE_FRAME}, this long
 * later, and that is when the enemy's knockback plays. Both start from the same event, so they
 * line up without sharing any state.
 */
export const STRIKE_DELAY_MS = STRIKE_FRAME * HERO_FRAME_MS;

export const ATTACK_ONCE_MS = HIT_PERIOD_MS;

/**
 * Whether a `combat_hero_attack` is an attack the hero actually made: a stunned hero's attempt
 * is not.
 */
export function isRealAttack(payload) {
    return !!payload && !payload.stunned;
}

const ROW_OF = { idle: 'idle', walk: 'walk', attack: 'attack' };

/**
 * What a hero's sprite shows at time `now`, and when it next changes.
 * - `combat`: the attack row once, from `attackAt` (the time of the last real attack, same
 * clock as `now`), at the standard frame rate so the strike frame lands {@link
 * STRIKE_DELAY_MS} after it; otherwise idle.
 * - everything else: its own row, looping on the hero's clock ({@link heroFrameAt}).
 * @returns {{row: ('idle'|'walk'|'attack'), frame: number, nextInMs: number}}
 */
export function heroSpriteFrame(state, now, { heroId = null, frameMs = HERO_FRAME_MS, attackAt = null } = {}) {
    if (state === 'combat') {
        const since = attackAt == null ? -1 : now - attackAt;
        if (since >= 0 && since < ATTACK_ONCE_MS) {
            return {
                row: 'attack',
                frame: Math.floor(since / HERO_FRAME_MS),
                nextInMs: HERO_FRAME_MS - (since % HERO_FRAME_MS)
            };
        }
        state = 'idle';
    }
    const into = mod(now + heroPhaseMs(heroId), frameMs);
    return {
        row: ROW_OF[state] || 'idle',
        frame: heroFrameAt(now, heroId, frameMs),
        nextInMs: frameMs - into
    };
}
