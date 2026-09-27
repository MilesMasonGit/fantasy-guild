// Fantasy Guild — hit animations on a worked Token (Token Lifecycle feedback Q4: FB-10)

import { stationSkillOf } from '../../../systems/effects/statements.js';

/**
 * ⭐ **The Token reacts each time its hero strikes it** (FB-10), one animation
 * per skill (owner-approved list, feedback v1 §2).
 *
 * ## What "a hit" is
 * * **Work** has no per-strike engine signal: the engine only knows cycles
 *   (`CYCLE_START` / `CYCLE_COMPLETE`, one per ~16 s). What the player sees
 *   striking is the hero's **attack animation** — 8 frames at 125 ms, a 1 s
 *   loop, the tool landing at frame {@link STRIKE_FRAME}. So a worked Token
 *   plays its reaction once per loop, timed to that frame. Both clocks are
 *   pure functions of the time and the hero's id ({@link heroFrameAt},
 *   {@link strikeStartTime}), so they cannot drift apart and need no shared
 *   state.
 * * **Combat** has a real one: `combat_hero_attack`, one per actual attack
 *   (every ~2.5 s). A landed hit knocks the enemy back, away from the hero,
 *   with a red flash; a miss does nothing. Since feedback Q6 (FB-49) a
 *   fighting hero idles and plays its attack row **once** per attack, and the
 *   knockback waits for that play-through's strike frame
 *   ({@link STRIKE_DELAY_MS}).
 *
 * ## The table
 * {@link HIT_ANIMATIONS} is data: a skill names an animation, and an animation
 * is a list of frames of plain numbers (`x`/`y` in % of the art, `rotate` in
 * degrees, `sx`/`sy` scale). {@link buildHitKeyframes} turns one into Web
 * Animations keyframes. A richer, per-Token animation can be added later as
 * one more entry.
 *
 * Only the Token's **art** moves (a wrapper inside the art box), so its point,
 * its round hit area, its badges and its drag are untouched.
 */

/** Frames in a hero's attack loop, and how long each is shown (AnimatedHeroSprite). */
export const HERO_FRAMES = 8;
export const HERO_FRAME_MS = 125;

/** One strike of the hero's working animation, in ms. */
export const HIT_PERIOD_MS = HERO_FRAMES * HERO_FRAME_MS;

/**
 * The frame of the attack row where the blow lands: the swing is at full
 * extension on frame 5 of the shipped sheets (recruit, fighter, rogue, ranger,
 * wizard — they share one layout).
 */
export const STRIKE_FRAME = 5;

/** The work skills whose Tokens are fought rather than worked. */
export const COMBAT = 'combat';

const ease = 'ease-out';

/**
 * ⭐ skill → animation. `ms` is how long the movement lasts inside the 1 s
 * strike loop (work) or on its own (combat); the rest of the loop is still.
 * `origin` is the CSS transform-origin; `directional` animations point their
 * `x` away from the hero; `flash` is a filter played alongside.
 */
export const HIT_ANIMATIONS = Object.freeze({
    /** Side-to-side shake. */
    shake: {
        ms: 380,
        origin: '50% 50%',
        frames: [
            { offset: 0, x: 0 },
            { offset: 0.15, x: -4 },
            { offset: 0.35, x: 4 },
            { offset: 0.55, x: -3 },
            { offset: 0.75, x: 1.5 },
            { offset: 1, x: 0 }
        ]
    },
    /** Jitter in all directions. */
    jitter: {
        ms: 340,
        origin: '50% 50%',
        frames: [
            { offset: 0, x: 0, y: 0 },
            { offset: 0.14, x: -3, y: 2 },
            { offset: 0.28, x: 3, y: -2 },
            { offset: 0.42, x: -2, y: -3 },
            { offset: 0.57, x: 2, y: 3 },
            { offset: 0.71, x: -2, y: 1 },
            { offset: 0.85, x: 1, y: -1 },
            { offset: 1, x: 0, y: 0 }
        ]
    },
    /** Slow bob up and down, the whole loop long. */
    bob: {
        ms: HIT_PERIOD_MS,
        origin: '50% 50%',
        easing: 'ease-in-out',
        frames: [
            { offset: 0, y: 0 },
            { offset: 0.3, y: -3.5 },
            { offset: 0.7, y: 1.5 },
            { offset: 1, y: 0 }
        ]
    },
    /** Sway from the base, like wind. */
    sway: {
        ms: 800,
        origin: '50% 100%',
        easing: 'ease-in-out',
        frames: [
            { offset: 0, rotate: 0 },
            { offset: 0.25, rotate: 5 },
            { offset: 0.55, rotate: -3 },
            { offset: 0.8, rotate: 1.5 },
            { offset: 1, rotate: 0 }
        ]
    },
    /** A sharp downward squash: a hammer blow. */
    squash: {
        ms: 280,
        origin: '50% 100%',
        frames: [
            { offset: 0, sx: 1, sy: 1 },
            { offset: 0.12, sx: 1.1, sy: 0.82 },
            { offset: 0.5, sx: 0.97, sy: 1.04 },
            { offset: 1, sx: 1, sy: 1 }
        ]
    },
    /** A small hop. */
    hop: {
        ms: 340,
        origin: '50% 100%',
        frames: [
            { offset: 0, y: 0, sx: 1, sy: 1 },
            { offset: 0.4, y: -7, sx: 0.97, sy: 1.03 },
            { offset: 0.8, y: 0, sx: 1.04, sy: 0.96 },
            { offset: 1, y: 0, sx: 1, sy: 1 }
        ]
    },
    /** A quick double pulse: bubbling. */
    pulse: {
        ms: 440,
        origin: '50% 70%',
        frames: [
            { offset: 0, sx: 1, sy: 1 },
            { offset: 0.2, sx: 1.06, sy: 1.06 },
            { offset: 0.4, sx: 1, sy: 1 },
            { offset: 0.6, sx: 1.05, sy: 1.05 },
            { offset: 1, sx: 1, sy: 1 }
        ]
    },
    /** Drop and settle: a thump. */
    thump: {
        ms: 360,
        origin: '50% 100%',
        frames: [
            { offset: 0, y: 0, sx: 1, sy: 1 },
            { offset: 0.15, y: 4, sx: 1.06, sy: 0.92 },
            { offset: 0.45, y: -1.5, sx: 0.99, sy: 1.02 },
            { offset: 1, y: 0, sx: 1, sy: 1 }
        ]
    },
    /** A slow rustle / tilt. */
    rustle: {
        ms: 900,
        origin: '50% 90%',
        easing: 'ease-in-out',
        frames: [
            { offset: 0, rotate: 0, x: 0 },
            { offset: 0.2, rotate: -2.5, x: -1 },
            { offset: 0.45, rotate: 2.5, x: 1 },
            { offset: 0.7, rotate: -1.2, x: -0.5 },
            { offset: 1, rotate: 0, x: 0 }
        ]
    },
    /** Knocked back away from the hero, with a brief red flash. */
    knockback: {
        ms: 380,
        origin: '50% 100%',
        directional: true,
        frames: [
            { offset: 0, x: 0, rotate: 0, flash: 0 },
            { offset: 0.18, x: 10, rotate: 6, flash: 1 },
            { offset: 0.5, x: 4, rotate: 2, flash: 0.4 },
            { offset: 1, x: 0, rotate: 0, flash: 0 }
        ]
    }
});

/**
 * ⭐ Which animation each skill plays (owner, feedback v1 §2 "FB-10 hit
 * animations"). A skill not listed plays nothing.
 */
export const SKILL_HIT = Object.freeze({
    logging: 'shake',
    mining: 'jitter',
    fishing: 'bob',
    farming: 'sway',
    smithing: 'squash',
    crafting: 'hop',
    cooking: 'pulse',
    construction: 'thump',
    explore: 'rustle',
    [COMBAT]: 'knockback'
});

/** The skills a hero fights with — all three knock an enemy back. */
const COMBAT_SKILLS = new Set([COMBAT, 'melee', 'ranged', 'magic']);

/**
 * The skill a hero uses on a Token of type `def`: combat for an enemy, a
 * Foundation's build skill, a gathering Token's `config.skill`, or the skill
 * a station names (`stationSkillOf`). Null when it names none.
 */
export function hitSkillOf(def) {
    if (!def) return null;
    if (def.enemy) return COMBAT;
    return def.foundation?.skill || def.config?.skill || stationSkillOf(def) || null;
}

/** The animation name a skill plays, or null. */
export function hitAnimationNameFor(skill) {
    if (!skill) return null;
    const key = String(skill).toLowerCase();
    return SKILL_HIT[COMBAT_SKILLS.has(key) ? COMBAT : key] || null;
}

/** The animation a skill plays, or null. */
export function hitAnimationFor(skill) {
    const name = hitAnimationNameFor(skill);
    return name ? { name, ...HIT_ANIMATIONS[name] } : null;
}

/** Whether a Token's hits come from the engine's attacks (combat) rather than the strike loop. */
export function hitsOnAttack(skill) {
    return hitAnimationNameFor(skill) === SKILL_HIT[COMBAT];
}

/**
 * Which way a knockback goes along x: **away from the hero** (+1 right, −1
 * left). Read from where the hero stands; if that says nothing, from the side
 * they work it from (−1 left, 1 right, as `HeroMotion` records it); else right.
 */
export function knockbackDir(tokenX, heroX, heroSide = null) {
    if (Number.isFinite(tokenX) && Number.isFinite(heroX) && tokenX !== heroX) {
        return tokenX > heroX ? 1 : -1;
    }
    if (heroSide === 1 || heroSide === -1) return -heroSide;
    return 1;
}

/** A red tint of strength `t` (0–1), as a filter; `none` at 0. */
export function redFlash(t) {
    const s = Math.max(0, Math.min(1, Number(t) || 0));
    if (!s) return 'none';
    return `sepia(${s}) saturate(${1 + 5 * s}) hue-rotate(${-45 * s}deg)`;
}

function transformOf(f, dir) {
    const x = (f.x || 0) * dir;
    const y = f.y || 0;
    const rotate = (f.rotate || 0) * dir;
    const sx = f.sx ?? 1;
    const sy = f.sy ?? 1;
    return `translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${sx}, ${sy})`;
}

/**
 * Web Animations keyframes for one animation.
 *
 * @param {object} anim an entry of {@link HIT_ANIMATIONS} (or {@link hitAnimationFor})
 * @param {object} [options]
 * @param {number} [options.dir] +1 / −1, for a directional animation
 * @param {number} [options.periodMs] squeeze the movement into the start of a
 *        loop this long (work), holding still for the rest; omit for a one-shot
 * @param {boolean} [options.reducedMotion] no movement: only a flash, if any
 * @returns {Array<object>} keyframes (empty when there is nothing to play)
 */
export function buildHitKeyframes(anim, { dir = 1, periodMs = null, reducedMotion = false } = {}) {
    if (!anim?.frames?.length) return [];
    const d = anim.directional ? (dir < 0 ? -1 : 1) : 1;
    const hasFlash = anim.frames.some(f => f.flash);
    if (reducedMotion && !hasFlash) return [];
    const squeeze = periodMs ? Math.min(1, anim.ms / periodMs) : 1;

    const out = anim.frames.map(f => {
        const k = { offset: f.offset * squeeze };
        k.transform = reducedMotion ? 'none' : transformOf(f, d);
        if (hasFlash) k.filter = redFlash(f.flash);
        k.easing = anim.easing || ease;
        return k;
    });
    if (squeeze < 1) {
        const rest = { offset: 1, transform: reducedMotion ? 'none' : transformOf({}, d) };
        if (hasFlash) rest.filter = 'none';
        out.push(rest);
    }
    return out;
}

// ---------------------------------------------------------------------------
// The strike clock, shared by the hero's sprite and the Token it works
// ---------------------------------------------------------------------------

/**
 * A hero's own phase in the loop, from their id, so two heroes side by side
 * do not swing in lockstep. Deterministic: the sprite and the Token both ask.
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
 * The frame a hero's sprite shows at time `now` (ms, `performance.now()`):
 * a function of the time, not a counter, so it never drifts from the Token.
 */
export function heroFrameAt(now, heroId, frameMs = HERO_FRAME_MS, frames = HERO_FRAMES) {
    return Math.floor(mod(now + heroPhaseMs(heroId), frameMs * frames) / frameMs);
}

/**
 * The `startTime` for a Token's looping hit animation, so each loop begins on
 * the hero's strike frame: the most recent strike at or before `now`.
 */
export function strikeStartTime(now, heroId) {
    const strikeAt = STRIKE_FRAME * HERO_FRAME_MS;
    return now - mod(now + heroPhaseMs(heroId) - strikeAt, HIT_PERIOD_MS);
}

// ---------------------------------------------------------------------------
// Which row the hero plays (feedback Q6: FB-49, FB-50)
// ---------------------------------------------------------------------------

/**
 * ⭐ **Is the hero really striking this Token?** (FB-50) One test, asked by
 * both sides so they can never disagree: the Token's hit reaction
 * (`TokenHitArt`'s `active`, Q4) and the hero's swing (`MatBoard`). A
 * Token with an alert on it is not being worked, so it does not react and its
 * hero stands idle instead of swinging at nothing.
 *
 * @param {string|null} heroId who holds the Token
 * @param {string|null} alert  the Token's own alert (`instance.alert`)
 */
export function strikesLive(heroId, alert) {
    return !!heroId && !alert;
}

/**
 * The hero's animation state:
 * * `walk` — moving;
 * * `attack` — working a Token that is being worked: the 1 s swing loop
 *   (FB-10's strike clock);
 * * `combat` — fighting: idle, with ONE attack play-through per real attack
 *   (FB-49, {@link heroSpriteFrame});
 * * `idle` — anything else, including a hero stuck on a Token (FB-50).
 */
export function heroAnimationState({ moving = false, working = false, stuck = false, combat = false } = {}) {
    if (moving) return 'walk';
    if (!working || stuck) return 'idle';
    return combat ? 'combat' : 'attack';
}

/**
 * ⭐ **The knockback waits for the blow** (FB-49). A real attack
 * (`combat_hero_attack`) starts the hero's attack row at frame 0; the blade
 * reaches full extension on {@link STRIKE_FRAME}, this long later, and that is
 * when the enemy's knockback plays. Both start from the same event, so they
 * line up without sharing any state.
 */
export const STRIKE_DELAY_MS = STRIKE_FRAME * HERO_FRAME_MS;

/** How long one attack play-through lasts: every frame of the row, once. */
export const ATTACK_ONCE_MS = HIT_PERIOD_MS;

/** Whether a `combat_hero_attack` is an attack the hero actually made: a stunned hero's attempt is not. */
export function isRealAttack(payload) {
    return !!payload && !payload.stunned;
}

const ROW_OF = { idle: 'idle', walk: 'walk', attack: 'attack' };

/**
 * ⭐ What a hero's sprite shows at time `now`, and when it next changes.
 *
 * * `combat`: the attack row once, from `attackAt` (the time of the last
 *   real attack, same clock as `now`), at the standard frame rate so the
 *   strike frame lands {@link STRIKE_DELAY_MS} after it; otherwise idle.
 * * everything else: its own row, looping on the hero's clock
 *   ({@link heroFrameAt}).
 *
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
