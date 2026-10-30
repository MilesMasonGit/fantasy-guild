import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { subscribeLevelUps } from './levelUpFeed.js';
import { perksReachedBy } from '../dock/heroPerks.js';

/**
 * The level-up moment on the mat, as data: each hero's levelled skills, floating over their head
 * for `FLOAT_MS` as the skill's icon and a number that rolls from the old level to the new one.
 * One float per skill; several skills sit side by side, each on its own timer. A milestone perk
 * the level-up reached is named under its number, for as long as the float is up. Drawn by
 * `HeroBubbleLayer` (`LevelUpFloat.jsx`), which reads this when it draws.
 * Kept here rather than in the layer so a catch-up's level-ups, which arrive before the mat is
 * back, are waiting for it. A catch-up that shows "While you were away" holds its floats until
 * that summary closes, so the player sees them roll rather than finding them already done.
 * UI memory only: never saved.
 */

/** How long a float stays up, fade included. */
export const FLOAT_MS = 30_000;

/** The gold flash on the old number before it rolls. */
export const FLASH_MS = 600;

/** The fade at the end of a float's time. */
export const FADE_MS = 600;

/** Most numbers a roll passes through, the old and new included. */
export const ROLL_MAX_VALUES = 10;

/** Each number of a roll takes this long, up to `ROLL_MAX_MS` for the whole roll. */
export const ROLL_STEP_MS = 150;
export const ROLL_MAX_MS = 1200;

/**
 * The numbers a roll from `from` to `to` passes through, `from` first and `to` last; a long jump
 * (hours away) passes through a few evenly spaced ones rather than every level.
 */
export function rollValues(from, to) {
    if (!Number.isFinite(from) || from >= to) return [to];
    const span = to - from;
    if (span < ROLL_MAX_VALUES) return Array.from({ length: span + 1 }, (_, i) => from + i);
    const out = [];
    for (let i = 0; i < ROLL_MAX_VALUES; i++) out.push(from + Math.round((span * i) / (ROLL_MAX_VALUES - 1)));
    return out;
}

/** How long the roll through `values` takes. */
export const rollMs = (values) => Math.min(ROLL_MAX_MS, Math.max(0, values.length - 1) * ROLL_STEP_MS);

/**
 * Add a level-up to one hero's floats (left to right). A skill already up keeps its place: if
 * its number has not started rolling yet (several levels in one go) it keeps its old number and
 * rolls to the newest; otherwise it rolls on from the number it shows. Either way its time
 * starts again, and the perks it named stay named beside any this level-up reached.
 *
 * @returns a new list; the input is untouched
 */
export function addFloat(list, { skillId, skillName, oldLevel, newLevel }, now, held = false) {
    const key = skillId || skillName;
    const kept = list.filter(f => f.held || f.at + FLOAT_MS > now);
    const i = kept.findIndex(f => f.key === key);
    const earlier = i === -1 ? null : kept[i];
    const reachedFrom = Number.isFinite(oldLevel) ? oldLevel : newLevel - 1;
    let from = reachedFrom;
    if (earlier) from = (earlier.held || now - earlier.at < FLASH_MS) ? earlier.from : earlier.to;
    const perks = withPerks(earlier?.perks, perksReachedBy(skillId, reachedFrom, newLevel));
    const next = { key, skillId, skillName, from, to: newLevel, at: now, held, perks };
    if (i === -1) return [...kept, next];
    return kept.map((f, j) => (j === i ? next : f));
}

const NO_PERKS = Object.freeze([]);

/** A float's perk titles, the earlier ones first, each once. */
function withPerks(earlier = NO_PERKS, reached = NO_PERKS) {
    if (!reached.length) return earlier;
    const titles = [...earlier];
    for (const { title } of reached) if (!titles.includes(title)) titles.push(title);
    return titles;
}

/** The floats showing at `now`: not held for a summary, not run out. */
export function liveFloats(list, now) {
    return list.filter(f => !f.held && f.at + FLOAT_MS > now);
}

const NONE = Object.freeze([]);
let byHero = new Map();
const listeners = new Set();

function emit() {
    for (const l of listeners) l();
}

/** Called whenever a float is added or released. */
export function subscribeFloats(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** One hero's floats showing at `now`. */
export function floatsOf(heroId, now = Date.now()) {
    const list = byHero.get(heroId);
    return list ? liveFloats(list, now) : NONE;
}

/** Whether any hero has a float showing at `now`. */
export function anyFloats(now = Date.now()) {
    for (const list of byHero.values()) if (liveFloats(list, now).length) return true;
    return false;
}

/** Forget every float. */
export function clearAllFloats() {
    if (byHero.size === 0) return;
    byHero = new Map();
    emit();
}

/** Add level-up rows (`levelUpFeed`'s), held until the catch-up summary closes when `held`. */
export function addFloats(rows, { held = false, now = Date.now() } = {}) {
    byHero = new Map(byHero);
    for (const row of rows) byHero.set(row.heroId, addFloat(byHero.get(row.heroId) || NONE, row, now, held));
    emit();
}

/** Let held floats show, their time starting now. */
export function releaseHeldFloats(now = Date.now()) {
    let any = false;
    const next = new Map();
    for (const [heroId, list] of byHero) {
        next.set(heroId, list.map(f => {
            if (!f.held) return f;
            any = true;
            return { ...f, held: false, at: now };
        }));
    }
    if (!any) return;
    byHero = next;
    emit();
}

const offs = [
    subscribeLevelUps({
        onLevelUps: (rows, { catchUp }) => addFloats(rows, { held: !!catchUp?.show }),
        onReset: clearAllFloats
    }),
    EventBus.subscribe(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED, () => releaseHeldFloats(), UI_LISTENER)
];

if (import.meta.hot) import.meta.hot.dispose(() => offs.forEach(off => off()));
