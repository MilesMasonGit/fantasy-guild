
/**
 * What a hero has up above their head, as plain data: **moments**, events that happened (going
 * idle, a Token the hero used up), each living for `MOMENT_TTL_MS`, then gone by itself. A
 * Token's problem is not a line: its problem mark says it.
 * Everything here is pure, so the rules (cap, replace, expire, order) are tested without a
 * screen.
 */

/** Bubbles above one head at once. */
export const MAX_BUBBLES = 3;

/** How long a moment stays up. */
export const MOMENT_TTL_MS = 5000;

/** How long "{token} Depleted" stays up: a hero chopping tree after tree says it often. */
export const DEPLETED_TTL_MS = 3000;

/**
 * Add a moment. One line per `key`: a repeat (the same Token used up again) replaces its
 * earlier line rather than stacking a second copy. Oldest first.
 *
 * @returns a new list; the input is untouched
 */
export function addMoment(list, { key, text }, now, ttlMs = MOMENT_TTL_MS) {
    const kept = list.filter(m => m.key !== key && m.until > now);
    return [...kept, { key, text, until: now + ttlMs }];
}

/** The moments that have not yet expired. */
export function liveMoments(list, now) {
    return list.filter(m => m.until > now);
}

/**
 * The stack to draw, top to bottom: moments oldest first, the newest nearest the head. Never
 * more than `MAX_BUBBLES`: the oldest moment gives way.
 *
 * @param {{key: string, text: string, until: number}[]} moments
 * @returns {{id: string, text: string, kind: 'moment'}[]}
 */
export function stackOf(moments, now) {
    return liveMoments(moments, now)
        .map(m => ({ id: m.key, text: m.text, kind: 'moment' }))
        .slice(-MAX_BUBBLES);
}

/** The lines for the three moments. Plain and factual. */
export const momentText = {
    arrived: (token) => `Working at ${token}.`,
    idle: () => 'No work in range.',
    // Going idle because the one fight in reach is taken: every fight is one-on-one. Also the
    // Token an order names, which another hero is working.
    waiting: (enemy) => `Waiting for ${enemy}.`,
    // The Token an order named is gone for good: a new order is wanted.
    needsJob: () => 'I need a job.',
    // Said by the hero whose work spent the Token's last charge.
    depleted: (token) => `${token} Depleted`,
    // The same moment for an enemy: the hero who beat it says so.
    beaten: (enemy) => `${enemy} Beaten`,
    // No wording of its own: the blocked sentence for its reason, already built by
    // `heroBubbles.pinRefusedLineFor`, word for word.
    pinRefused: (line) => line
};

/**
 * What a hero says on going idle, given what they wait for (`Flags.waitingOf`), its name and
 * their order (`Flags.statusOf`'s `order` and `needsJob`): `{ kind, key, text }`, or null to say
 * nothing.
 * * their ordered Token is gone for good: "I need a job.";
 * * arrived at a spot they were sent to: nothing (idle by choice);
 * * a fight another hero holds, or their Token another hero works: "Waiting for Goblin.";
 * * a node that is resting or growing back, or an enemy camp's next spawn: nothing. They wait
 * silently and work it when it is back; the pennant's hover and the roster say "Waiting for Copper
 * Vein" ("Waiting for Goblin");
 * * otherwise: "No work in range."
 */
export function idleMomentOf(waiting, name = null, { order = null, needsJob = false } = {}) {
    if (needsJob) return { kind: 'needsJob', key: 'idle', text: momentText.needsJob() };
    if (order === 'spot') return null;
    if (waiting?.kind === 'node' || waiting?.kind === 'spawn') return null;
    if (waiting?.kind === 'fight' || waiting?.kind === 'busy') return { kind: 'waiting', key: 'idle', text: momentText.waiting(name) };
    return { kind: 'idle', key: 'idle', text: momentText.idle() };
}

/**
 * Which moments a hero actually says: bubbles are for unusual events, not the everyday.
 * Arriving at a job happens every few seconds on a busy mat, so it is silent; the wording
 * above stays so it can be turned back on here. The full list of every line, with its status,
 * is `docs/reference/speech_bubble_lines.md`; keep the two in step.
 * * `arrived`: dropped (routine).
 * * `idle`: kept: a hero with nothing to do is worth knowing, but it also fires whenever the
 * last Token in range runs out.
 * A level-up is not a line: it floats over the hero as the skill's icon and number
 * (`levelUpFloats.js`), and the hero bar keeps the lasting alert.
 * * `waiting`: kept: said instead of `idle` when the hero goes idle because the enemy they would
 * fight is another hero's fight (every fight is one-on-one); they take it the moment it is free.
 * A gatherer whose node in reach is resting says nothing at all ({@link idleMomentOf}).
 * * `depleted`: kept: the hero who used a Token up says so.
 * * `beaten`: kept: `depleted` said of an enemy, by the hero who beat it.
 * * `pinRefused`: kept: a flag dropped on a Token its hero can't work plants as an area flag,
 * and the hero says why, once.
 */
export const MOMENT_SPOKEN = Object.freeze({
    arrived: false,
    idle: true,
    waiting: true,
    depleted: true,
    beaten: true,
    needsJob: true,
    pinRefused: true
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
