import { BANNER_KINDS, bannerText } from './bannerKinds.js';

/**
 * The banners: what the player must not miss, dropping in at the top centre of the mat. Each stays
 * until clicked.
 *
 * Up to {@link MAX_SHOWN} are on screen, newest on top; the rest wait, counted ("+N"). Problems
 * wait ahead of milestones, and a waiting banner of the same kind as a newer one takes it in
 * ("Aela and Bram knocked out") rather than queueing behind it. Two banners from one moment (the
 * recipes a single level-up unlocks, said over several level events) share a `groupKey` and are
 * always one banner, on screen or waiting.
 *
 * Pure: the sound a banner makes when it comes on screen is a hook ({@link setOnShow}).
 */

export const MAX_SHOWN = 3;

let nextId = 1;
/** On screen, newest first. */
let shown = [];
/** Waiting, in the order they will come on screen. */
let waiting = [];
let version = 0;
const listeners = new Set();
let onShow = null;

/** Called with each banner as it comes on screen. */
export function setOnShow(fn) {
    onShow = fn || null;
}

function emit() {
    version++;
    for (const fn of [...listeners]) fn();
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getVersion() {
    return version;
}

const subjectKey = (s) => `${s.type}:${s.id}`;

function unionSubjects(a = [], b = []) {
    const seen = new Map();
    for (const s of [...a, ...b]) if (s && s.id != null) seen.set(subjectKey(s), s);
    return [...seen.values()];
}

function build({ kind, parts = {}, groupKey = null, sprite = null, subjects = [] }) {
    const def = BANNER_KINDS[kind];
    return {
        id: nextId++,
        kind,
        tone: def.tone,
        parts,
        groupKey,
        sprite,
        subjects: unionSubjects(subjects),
        ...bannerText(kind, parts)
    };
}

function mergeInto(old, incoming) {
    const def = BANNER_KINDS[old.kind];
    const parts = def.merge ? def.merge(old.parts, incoming.parts || {}) : { ...old.parts, ...(incoming.parts || {}) };
    return {
        ...old,
        parts,
        subjects: unionSubjects(old.subjects, incoming.subjects),
        ...bannerText(old.kind, parts)
    };
}

const isProblem = (b) => BANNER_KINDS[b.kind]?.tone === 'problem';

/** Problems first; within a tone, the order they arrived. */
function sortWaiting() {
    waiting = [...waiting.filter(isProblem), ...waiting.filter(b => !isProblem(b))];
}

function replace(list, old, next) {
    return list.map(b => (b === old ? next : b));
}

function show(b) {
    shown = [b, ...shown];
    onShow?.(b);
}

/**
 * Raise a banner, or fold it into one it belongs with.
 * @param {{kind: string, parts?: object, groupKey?: string, sprite?: object,
 *   subjects?: {type: 'hero'|'token', id: string}[]}} input
 * @returns {number|null} the id of the banner that now says it
 */
export function push(input) {
    const def = BANNER_KINDS[input?.kind];
    if (!def) return null;

    const sameGroup = (b) => input.groupKey != null && b.groupKey === input.groupKey;
    const target =
        shown.find(sameGroup) || waiting.find(sameGroup)
        || (def.mergeShown ? shown.find(b => b.kind === input.kind) : null)
        || (def.merge ? waiting.find(b => b.kind === input.kind) : null);

    if (target) {
        const next = mergeInto(target, input);
        if (shown.includes(target)) shown = replace(shown, target, next);
        else waiting = replace(waiting, target, next);
        emit();
        return next.id;
    }

    const b = build(input);
    if (shown.length < MAX_SHOWN) show(b);
    else {
        waiting = [...waiting, b];
        sortWaiting();
    }
    emit();
    return b.id;
}

/** A click: the banner goes, and the next waiting one comes on screen. */
export function dismiss(id) {
    const before = shown.length;
    shown = shown.filter(b => b.id !== id);
    if (shown.length === before) return;
    if (waiting.length && shown.length < MAX_SHOWN) {
        const [next, ...rest] = waiting;
        waiting = rest;
        show(next);
    }
    emit();
}

/**
 * What the stack draws: the banners on screen (newest first), how many wait, and whether a
 * problem is among them.
 */
export function getView() {
    return { shown, waiting: waiting.length, problemWaiting: waiting.some(isProblem) };
}

/** Every banner, on screen and waiting (tests and the dev page). */
export function getAll() {
    return [...shown, ...waiting];
}

/** Forget every banner (a new game or another save loaded). */
export function reset() {
    shown = [];
    waiting = [];
    emit();
}
