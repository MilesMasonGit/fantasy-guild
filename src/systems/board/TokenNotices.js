// Fantasy Guild — green notices on a Token (Token Lifecycle feedback Q2: FB-48, TL-14)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * ⭐ **A notice is news that is not a problem** (TL-14).
 *
 * Problem alerts (red, yellow) stay on a Token until the problem is fixed. A
 * notice — a Token a spawner has just made, a Token that was restocked — is
 * drawn in green at the Token's centre and goes on its own after
 * {@link NOTICE_MS}.
 *
 * ## Why a store and not just an event
 * A spawned Token is announced in the same tick that creates it, before React
 * has drawn it, so an event would reach nobody. The notice is kept here, by
 * instance id, and the Token reads it when it mounts.
 *
 * ## Which clock
 * **Wall clock** (`Date.now()`), like every other alert timer on the mat
 * (`useEventAlert`'s read-then-fade, the charge floaters, the landing beat).
 * A notice is presentation, not game state: it is not saved, and it does not
 * speed up with the time bank — ten seconds on screen is ten seconds.
 *
 * Nothing is kept once a notice has run out: expired entries are dropped the
 * next time any notice is read or raised.
 */

/** How long a notice stays up, in ms (FB-48: "about 10 seconds"). */
export const NOTICE_MS = 10000;

/** instanceId → `{ type, title, rulesText, raisedAt }`. */
const notices = new Map();

const now = () => Date.now();

function prune(at) {
    for (const [id, n] of notices) if (at - n.raisedAt >= NOTICE_MS) notices.delete(id);
}

/**
 * Put a green notice on a Token. A second notice on the same Token replaces the
 * first and starts the ten seconds again.
 *
 * @param {string} instanceId
 * @param {{type?: string, title: string, rulesText?: string|null}} notice
 * @param {number} [at] the wall-clock time it was raised (tests)
 */
export function raiseNotice(instanceId, { type = 'notice', title, rulesText = null } = {}, at = now()) {
    if (!instanceId || !title) return;
    prune(at);
    notices.set(instanceId, { type, title, rulesText, raisedAt: at });
    EventBus.publish(BOARD_EVENTS.NOTICE_CHANGED, { instanceId });
}

/**
 * The notice up on a Token right now, with how long it has left, or null.
 *
 * @returns {{type: string, title: string, rulesText: string|null, raisedAt: number, remainingMs: number}|null}
 */
export function noticeOf(instanceId, at = now()) {
    const n = notices.get(instanceId);
    if (!n) return null;
    const remainingMs = NOTICE_MS - (at - n.raisedAt);
    if (remainingMs <= 0) {
        notices.delete(instanceId);
        return null;
    }
    return { ...n, remainingMs };
}

/** Take a Token's notice down early. */
export function clearNotice(instanceId) {
    if (!notices.delete(instanceId)) return;
    EventBus.publish(BOARD_EVENTS.NOTICE_CHANGED, { instanceId });
}

/** Forget every notice (a new game, a load, tests). */
export function resetNotices() {
    notices.clear();
}
