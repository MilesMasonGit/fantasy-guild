/**
 * What a hero has up above their head, as plain data: **moments**, events that happened (going
 * idle, an enemy the hero beat), each living for `MOMENT_TTL_MS`, then gone by itself, and the
 * **waiting bubbles** of `speechBubbles.js` (gear that broke), which stay until hovered, clicked
 * or no longer needed. A Token's problem is not a line: its problem mark says it.
 * Everything here is pure, so the rules (cap, replace, expire, order) are tested without a
 * screen.
 */

import { calloutText } from './callouts.js';

/** Bubbles above one head at once. */
export const MAX_BUBBLES = 3;

/** How long a moment stays up. */
export const MOMENT_TTL_MS = 5000;

/** How long "{enemy} Beaten" stays up: a hero at a camp says it after every kill. */
export const BEATEN_TTL_MS = 3000;

/**
 * Add a moment. One line per `key`: a repeat (the same Token used up again) replaces its
 * earlier line rather than stacking a second copy. Oldest first.
 *
 * @returns a new list; the input is untouched
 */
export function addMoment(list, { key, text }, now, ttlMs = MOMENT_TTL_MS) {
    const kept = list.filter(m => m.key !== key && m.until > now);
    return [...kept, { key, text, at: now, until: now + ttlMs }];
}

/** The moments that have not yet expired. */
export function liveMoments(list, now) {
    return list.filter(m => m.until > now);
}

/**
 * The stack to draw, top to bottom, oldest first, the newest nearest the head: the waiting bubbles
 * (`speechBubbles.bubblesOf`) and the live moments. Never more than `MAX_BUBBLES`: a waiting bubble
 * never gives way to a moment, so moments fill only the rows the waiting ones leave, newest first;
 * past the cap the oldest give way within each kind.
 *
 * @param {{key: string, text: string, at?: number, until: number}[]} moments
 * @param {{key: string, text: string, at: number, tone?: string}[]} waiting
 * @returns {{id: string, text: string, kind: 'moment'|'waiting', at: number, tone?: string}[]}
 */
export function stackOf(moments, now, waiting = []) {
    const kept = waiting.slice(-MAX_BUBBLES).map(b => ({ id: b.key, text: b.text, kind: 'waiting', at: b.at, tone: b.tone ?? null }));
    const room = MAX_BUBBLES - kept.length;
    const said = room > 0
        ? liveMoments(moments, now).slice(-room).map(m => ({ id: m.key, text: m.text, kind: 'moment', at: m.at ?? (m.until - MOMENT_TTL_MS) }))
        : [];
    return [...kept, ...said].sort((a, b) => a.at - b.at);
}

/** The lines for each moment. Plain and factual. */
export const momentText = {
    arrived: (token) => `Working at ${token}.`,
    // At a War Camp (`fights`), whose work is fights, the same moment in its own words.
    idle: (fights = false) => (fights ? 'Nothing to fight here.' : 'Nothing to work here.'),
    // Going idle because the fight they were sent to is taken: every fight is one-on-one. Also the
    // Token an order names, which another hero is working.
    waiting: (enemy) => `Waiting for ${enemy}.`,
    // The Token an order named is gone for good: a new order is wanted.
    needsJob: () => 'I need a job.',
    // An enemy leaving: the hero who beat it says so. A Token used up is a popup over it instead.
    beaten: (enemy) => `${enemy} Beaten`,
    // A status landing on the hero in a fight, said as a callout over an enemy is: "Venom!".
    statusLands: (statusId) => calloutText.statusLands(statusId)
};

/**
 * What a hero says on going idle, given what they wait for (`Flags.waitingOf`), its name and
 * their order (`Flags.statusOf`'s `order` and `needsJob`): `{ kind, key, text }`, or null to say
 * nothing.
 * * their ordered Token is gone for good: "I need a job.";
 * * arrived at a spot they were sent to: nothing (idle by choice);
 * * a fight another hero holds, or their Token another hero works: "Waiting for Goblin.";
 * * a node that is resting or growing back, or an enemy camp's next spawn: nothing. They wait
 * silently and work it when it is back; the flag's hover and the roster say "Waiting for Copper
 * Vein" ("Waiting for Goblin");
 * * a camp of Fishing (`waitsForSpot`) with no spot in its reach: nothing. They wait for the next
 * spot to arrive, the idle mark still showing;
 * * otherwise: "Nothing to work here.", or at a War Camp (`fights`) "Nothing to fight here."
 */
export function idleMomentOf(waiting, name = null, { order = null, needsJob = false, fights = false, waitsForSpot = false } = {}) {
    if (needsJob) return { kind: 'needsJob', key: 'idle', text: momentText.needsJob() };
    if (order === 'spot') return null;
    if (waiting?.kind === 'node' || waiting?.kind === 'spawn') return null;
    if (waitsForSpot && !waiting) return null;
    if (waiting?.kind === 'fight' || waiting?.kind === 'busy') return { kind: 'waiting', key: 'idle', text: momentText.waiting(name) };
    return { kind: 'idle', key: 'idle', text: momentText.idle(fights) };
}

/**
 * Which moments a hero actually says: bubbles are for unusual events, not the everyday.
 * Arriving at a job happens every few seconds on a busy mat, so it is silent; the wording
 * above stays so it can be turned back on here. The full list of every line, with its status,
 * is `docs/reference/speech_bubble_lines.md`; keep the two in step.
 * * `arrived`: dropped (routine).
 * * `idle`: kept: a hero with nothing to do is worth knowing, but it also fires whenever the
 * last Token in a camp's reach runs out.
 * A level-up is not a line: it floats over the hero as the skill's icon and number
 * (`levelUpFloats.js`), and the hero bar keeps the lasting alert.
 * * `waiting`: kept: said instead of `idle` when the hero goes idle because the enemy they would
 * fight is another hero's fight (every fight is one-on-one); they take it the moment it is free.
 * A gatherer whose node is resting says nothing at all ({@link idleMomentOf}).
 * * `beaten`: kept: the hero who beat an enemy says so.
 * * `statusLands`: kept: a status landing on a fighting hero ("Venom!"), over their health bar.
 * A Token used up is not a line: it is a popup over the Token (`CalloutLayer`). Gear that broke
 * is a waiting bubble (`heroNeeds.js`), not a moment.
 */
export const MOMENT_SPOKEN = Object.freeze({
    arrived: false,
    idle: true,
    waiting: true,
    beaten: true,
    needsJob: true,
    statusLands: true
});

/** Whether a moment of this kind (`momentText`'s key) is spoken at all. */
export function speaksMoment(kind) {
    return MOMENT_SPOKEN[kind] === true;
}

/**
 * A bubble's text cut into words and numbers, so the numbers can be drawn in their own colour:
 * `50 Melee!` gives `50` as a number.
 * @returns {{text: string, num: boolean}[]}
 */
export function splitNumbers(text) {
    return String(text ?? '')
        .split(/(\(\+\d[\d,]*\)|\d[\d,]*)/)
        .filter(part => part !== '')
        .map(part => ({ text: part, num: /\d/.test(part) }));
}
