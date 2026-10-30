import { currentValue, setValue, proposedValue, entryConflict, fingerprint } from './changePacks.js';

/**
 * Reviewing a change pack against the workspace: what each row shows, what Finish applies and
 * records, and what Undo reverts. Pure: takes a workspace (`{ items, tokens, effects, recipePools }`)
 * (and `starterCamp`, `skillPerks`) and returns new collections; the review page writes them to the store.
 *
 * A review session is `{ entries: { [index]: { decision, appliedEarly, before, forced } } }`:
 * - `decision`: 'pending' | 'accepted' | 'rejected'
 * - `appliedEarly`: the entry is already in the workspace (opened in the editor to tweak), with
 *   `before` the value it replaced, so rejecting it puts that back
 * - `forced`: the owner chose to apply a conflicting entry anyway
 */

const COLLECTION_KEYS = ['items', 'tokens', 'effects', 'recipePools', 'starterCamp', 'skillPerks'];

export function emptySession() {
    return { entries: {} };
}

export function entryState(session, index) {
    return { decision: 'pending', appliedEarly: false, before: null, forced: false, ...(session?.entries?.[index] || {}) };
}

function withEntry(session, index, patch) {
    return { ...session, entries: { ...(session?.entries || {}), [index]: { ...entryState(session, index), ...patch } } };
}

function pick(workspace) {
    return Object.fromEntries(COLLECTION_KEYS.map((k) => [k, workspace[k]]));
}

/** What one row shows: the entry's decision plus whether it conflicts with the workspace now. */
export function rowState(workspace, pack, session, index) {
    const entry = pack.entries[index];
    const state = entryState(session, index);
    if (state.appliedEarly) {
        const missing = entry.op !== 'delete' && !currentValue(workspace, entry.kind, entry.id);
        return { ...state, conflict: false, missing };
    }
    const check = entryConflict(workspace, entry);
    return { ...state, conflict: check.conflict, reason: check.reason, missing: false };
}

/** Accept: conflicts stay pending until forced. */
export function accept(workspace, pack, session, index) {
    const state = entryState(session, index);
    if (!state.appliedEarly && !state.forced && entryConflict(workspace, pack.entries[index]).conflict) return session;
    return withEntry(session, index, { decision: 'accepted' });
}

/** Mark a conflicting entry as one to apply anyway (the owner's explicit choice), and accept it. */
export function force(session, index) {
    return withEntry(session, index, { forced: true, decision: 'accepted' });
}

/** Apply one entry now so the normal editor can open it. Returns `{ session, workspace }`, or null on an unforced conflict. */
export function applyEarly(workspace, pack, session, index) {
    const entry = pack.entries[index];
    const state = entryState(session, index);
    if (state.appliedEarly) return { session, workspace: pick(workspace) };
    if (!state.forced && entryConflict(workspace, entry).conflict) return null;
    const before = currentValue(workspace, entry.kind, entry.id);
    const next = { ...pick(workspace), ...setValue(workspace, entry.kind, entry.id, proposedValue(entry)) };
    return { session: withEntry(session, index, { decision: 'accepted', appliedEarly: true, before }), workspace: next };
}

/** Reject: an entry already applied for tweaking is put back as it was. Returns `{ session, workspace }`. */
export function reject(workspace, pack, session, index) {
    const entry = pack.entries[index];
    const state = entryState(session, index);
    let next = pick(workspace);
    if (state.appliedEarly) next = { ...next, ...setValue(workspace, entry.kind, entry.id, state.before) };
    return { session: withEntry(session, index, { decision: 'rejected', appliedEarly: false, before: null }), workspace: next };
}

export function acceptAll(workspace, pack, session) {
    return pack.entries.reduce((s, _, i) => (entryState(s, i).decision === 'pending' ? accept(workspace, pack, s, i) : s), session);
}

export function rejectAll(workspace, pack, session) {
    let ws = pick(workspace);
    let s = session;
    pack.entries.forEach((_, i) => {
        ({ session: s, workspace: ws } = reject(ws, pack, s, i));
    });
    return { session: s, workspace: ws };
}

/**
 * Finish the review: apply every accepted entry not yet applied, and build the record the archive
 * keeps for undo. Refuses (`blocked`) while an accepted entry conflicts and was not forced, or
 * while an entry is still pending.
 * @returns {{ blocked: Array<{ index: number, reason: string }> } | { workspace: object, session: object, record: object }}
 */
export function finish(workspace, pack, session) {
    const blocked = [];
    pack.entries.forEach((entry, index) => {
        const state = entryState(session, index);
        if (state.decision === 'pending') blocked.push({ index, reason: 'Not decided yet: accept or reject it.' });
        else if (state.decision === 'accepted' && !state.appliedEarly && !state.forced) {
            const check = entryConflict(workspace, entry);
            if (check.conflict) blocked.push({ index, reason: check.reason });
        }
    });
    if (blocked.length) return { blocked };

    let ws = pick(workspace);
    let s = session;
    pack.entries.forEach((entry, index) => {
        const state = entryState(s, index);
        if (state.decision !== 'accepted' || state.appliedEarly) return;
        const before = currentValue(ws, entry.kind, entry.id);
        ws = { ...ws, ...setValue(ws, entry.kind, entry.id, proposedValue(entry)) };
        s = withEntry(s, index, { appliedEarly: true, before });
    });

    const entries = pack.entries.map((entry, index) => {
        const state = entryState(s, index);
        const base = { index, op: entry.op, kind: entry.kind, id: entry.id, decision: state.decision };
        if (state.decision !== 'accepted') return { ...base, applied: false };
        const after = currentValue(ws, entry.kind, entry.id);
        return {
            ...base,
            applied: true,
            forced: state.forced || undefined,
            before: state.before,
            after,
            afterFingerprint: fingerprint(after),
            // A tweak that renamed the entity moved it off this id; undo cannot find it.
            ...(entry.op !== 'delete' && !after ? { missingAfter: true } : {}),
        };
    });
    return { workspace: ws, session: s, record: { finishedAt: new Date().toISOString(), entries } };
}

/**
 * What Undo would do to each applied entry of an archived pack: revert it, or flag it because the
 * workspace no longer holds what the pack left there (edited since, or renamed away).
 */
export function planUndo(workspace, archived) {
    return (archived?.review?.entries || [])
        .filter((e) => e.applied)
        .map((e) => {
            const now = currentValue(workspace, e.kind, e.id);
            if (e.missingAfter) return { ...e, flagged: true, reason: 'It was renamed or removed in the editor before the pack was finished; find it by hand.' };
            if (fingerprint(now) !== e.afterFingerprint) {
                return { ...e, flagged: true, reason: now ? 'Edited since the pack was applied.' : 'Deleted since the pack was applied.' };
            }
            return { ...e, flagged: false };
        });
}

/** Put back the `before` value of every planned entry that is not flagged, plus the flagged ones in `alsoIndices`. */
export function undo(workspace, archived, alsoIndices = []) {
    const also = new Set(alsoIndices);
    let ws = pick(workspace);
    const undone = [];
    for (const e of planUndo(workspace, archived)) {
        if (e.flagged && !(also.has(e.index) && !e.missingAfter)) continue;
        ws = { ...ws, ...setValue(ws, e.kind, e.id, e.before) };
        undone.push(e.index);
    }
    return { workspace: ws, undone };
}
