// Fantasy Guild - Limes's lessons: where the guild stands in them
//
// The progress lives in the save (`guide.progress`) and counts `QuestManager`'s reports, which it
// makes from the engine's own events: a catch-up counts as live play does (its listeners are the
// engine's), and a load or a travel keeps it. The steps are `lessonPlan.js`; what Limes says and
// where is the UI's. Lessons pay nothing.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { allSteps, reportCounts, LIMES_MOMENTS } from './lessonPlan.js';

const MOMENT_DUE = 'due';
const MOMENT_HEARD = 'heard';

/**
 * The saved progress, or null for a game with no lessons: one made before them (it never gets
 * them) or a run with no new game behind it (a test, the bench).
 * `{ done: [stepId], counts: { stepId: n }, moments: { momentId: 'due' | 'heard' } }`
 */
function progress() {
    const p = GameState.state?.guide?.progress;
    if (!p || typeof p !== 'object') return null;
    if (!Array.isArray(p.done)) p.done = [];
    if (!p.counts || typeof p.counts !== 'object') p.counts = {};
    if (!p.moments || typeof p.moments !== 'object') p.moments = {};
    return p;
}

/** A new game starts the lessons (on or off: the switch only says whether Limes speaks of them). */
export function startLessons() {
    const state = GameState.state;
    if (!state) return;
    if (!state.guide || typeof state.guide !== 'object') state.guide = { limesSpot: null, lessons: true };
    state.guide.progress = { done: [], counts: {}, moments: {} };
}

/** Whether this game has lessons at all. */
export function hasLessons() {
    return !!progress();
}

/** Whether step `id` is done. */
export function isStepDone(id) {
    return !!progress()?.done.includes(id);
}

/** The step Limes is on: the first not done, the goal last; null once all are done or with no lessons. */
export function currentStep() {
    const p = progress();
    if (!p) return null;
    return allSteps().find(s => !p.done.includes(s.id)) || null;
}

/** The first big moment waiting to be said, or null. */
export function dueMoment() {
    const p = progress();
    if (!p) return null;
    return Object.keys(LIMES_MOMENTS).find(id => p.moments[id] === MOMENT_DUE) || null;
}

/** Limes has said moment `id` (the player closed it): it is not said again. */
export function hearMoment(id) {
    const p = progress();
    if (!p || p.moments[id] !== MOMENT_DUE) return;
    p.moments[id] = MOMENT_HEARD;
    announce(currentStep()?.id ?? null, false);
}

function announce(stepId, arrived) {
    EventBus.publish(ENGINE_EVENTS.LIMES_LESSON, { stepId, arrived, moment: dueMoment() });
}

/**
 * Count one report (`QuestManager.reportProgress`) for every step and moment that wants it, done
 * or showing or not. Says so when the step Limes is on changes or a moment comes due.
 */
export function report(targetType, amount = 1, metadata = {}) {
    const p = progress();
    if (!p) return;
    const before = currentStep()?.id ?? null;
    let changed = false;
    for (const s of allSteps()) {
        if (p.done.includes(s.id) || !reportCounts(s, targetType, metadata)) continue;
        const next = Math.min(s.count, (p.counts[s.id] || 0) + Math.max(1, amount));
        if (next >= s.count) {
            p.done.push(s.id);
            delete p.counts[s.id];
        } else {
            p.counts[s.id] = next;
        }
        changed = true;
    }
    for (const [id, moment] of Object.entries(LIMES_MOMENTS)) {
        if (p.moments[id] || !reportCounts(moment, targetType, metadata)) continue;
        p.moments[id] = MOMENT_DUE;
        changed = true;
    }
    if (!changed) return;
    const after = currentStep()?.id ?? null;
    announce(after, after !== before && after !== null);
}
