import { BANNER_KINDS, bannerText } from './bannerKinds.js';

/**
 * The banners: what the player must not miss. A milestone stays until clicked; a problem goes
 * when clicked or once its owner finds it fixed ({@link revise}). Every banner up is in one list,
 * newest first, with no limit: the corner (`BannerStack.jsx`) lists them all or tucks them away.
 *
 * Two banners from one moment (the recipes a single level-up unlocks, said over several level
 * events) share a `groupKey` and are always one banner; a lasting condition (`mergeShown`, the
 * Bank full) folds into the one up. A moment kind (a knock-out) raised while one is up is a banner
 * of its own, as two on screen always were.
 *
 * Pure: the sound a banner makes as it is raised is a hook ({@link setOnShow}).
 */

let nextId = 1;
/** Every banner up, newest first. */
let shown = [];
let version = 0;
const listeners = new Set();
let onShow = null;

/** Called with each banner as it is raised (not for one put back silently). */
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

/** `quiet`: put back, not news, so the corner does not pop it out. */
function build({ kind, parts = {}, groupKey = null, sprite = null, subjects = [] }, quiet = false) {
    const def = BANNER_KINDS[kind];
    return {
        id: nextId++,
        kind,
        tone: def.tone,
        parts,
        groupKey,
        sprite,
        subjects: unionSubjects(subjects),
        quiet,
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

function show(b, silent = false) {
    shown = [b, ...shown];
    if (!silent) onShow?.(b);
}

/**
 * Raise a banner, or fold it into one it belongs with.
 * @param {{kind: string, parts?: object, groupKey?: string, sprite?: object,
 *   subjects?: {type: 'hero'|'token', id: string}[]}} input
 * @param {{silent?: boolean}} [options] `silent`: no sound and no pop-out (a banner put back, not
 *   news)
 * @returns {number|null} the id of the banner that now says it
 */
export function push(input, { silent = false } = {}) {
    const def = BANNER_KINDS[input?.kind];
    if (!def) return null;

    const sameGroup = (b) => input.groupKey != null && b.groupKey === input.groupKey;
    const target = shown.find(sameGroup) || (def.mergeShown ? shown.find(b => b.kind === input.kind) : null);

    if (target) {
        const next = mergeInto(target, input);
        shown = shown.map(b => (b === target ? next : b));
        emit();
        return next.id;
    }

    const b = build(input, silent);
    show(b, silent);
    emit();
    return b.id;
}

/** A click: the banner goes. */
export function dismiss(id) {
    const before = shown.length;
    shown = shown.filter(b => b.id !== id);
    if (shown.length !== before) emit();
}

/**
 * Take back the banner of `groupKey` as if it had been clicked: an event's, once its Token has
 * left the mat. Nothing when there is none.
 */
export function withdraw(groupKey) {
    if (groupKey == null) return;
    const before = shown.length;
    shown = shown.filter(b => b.groupKey !== groupKey);
    if (shown.length !== before) emit();
}

/** Whether any banner of `kind` is up. */
export function hasKind(kind) {
    return shown.some(b => b.kind === kind);
}

/**
 * Rewrite every banner of `kind` from what still stands: `fn(parts)` returns the parts to keep
 * (the same object when nothing changed), or null when nothing is left to say, and that banner
 * goes as if clicked.
 */
export function revise(kind, fn) {
    let changed = false;
    const next = [];
    for (const b of shown) {
        if (b.kind !== kind) {
            next.push(b);
            continue;
        }
        const parts = fn(b.parts);
        if (parts === b.parts) {
            next.push(b);
            continue;
        }
        changed = true;
        if (parts != null) next.push({ ...b, parts, ...bannerText(kind, parts) });
    }
    if (!changed) return;
    shown = next;
    emit();
}

/** What the corner draws: every banner up (newest first), and whether a problem is among them. */
export function getView() {
    return { shown, problem: shown.some(isProblem) };
}

/** Every banner up (tests and the dev page). */
export function getAll() {
    return [...shown];
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The unclicked banners a save keeps (kinds marked `kept`), oldest first:
 * `[{ kind, parts, sprite, subjects }]`, copies. A banner's `groupKey` is not kept: it joins
 * banners of one moment, and a later run's keys start again.
 */
export function serializeKept() {
    return [...shown].reverse()
        .filter(b => BANNER_KINDS[b.kind]?.kept)
        .map(b => JSON.parse(JSON.stringify({ kind: b.kind, parts: b.parts, sprite: b.sprite, subjects: b.subjects })));
}

/**
 * Put a save's kept banners back, silently, in the order they stood. Malformed
 * entries are skipped: a banner is never a reason for a load to fail.
 */
export function restore(list) {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
        if (!isPlainObject(entry) || !BANNER_KINDS[entry.kind]?.kept) continue;
        let b;
        try {
            b = build({
                kind: entry.kind,
                parts: isPlainObject(entry.parts) ? entry.parts : {},
                sprite: isPlainObject(entry.sprite) ? entry.sprite : null,
                subjects: Array.isArray(entry.subjects) ? entry.subjects.filter(isPlainObject) : []
            }, true);
        } catch {
            continue;
        }
        show(b, true);
    }
    emit();
}

/** Forget every banner (a new game or another save loaded). */
export function reset() {
    shown = [];
    emit();
}
