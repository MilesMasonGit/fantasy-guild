import { currentValue, setValue, proposedValue, entryConflict, fingerprint, canonicalJson, validatePack } from './changePacks.js';
import { compareSnapshots, stageMoveText } from './ledgerCompare.js';
import { declaredStages } from './packIntent.js';
import { PACE_TEXT } from '../../../src/systems/progression/ledger/pace.js';

/**
 * The agent gate: a change pack applied to the workspace in memory, the ledger worked out before
 * and after, and a verdict. A pack is **blocked** when it adds a Block finding, moves a stage
 * beyond the tolerance without declaring the move (`packIntent.js`) or against its declaration,
 * or adds a waiver (only the owner waives). Problems the workspace already had are listed, never
 * blocking. Pure: the report is passed in as `snapshot(workspace)` (`ledgerCompare.snapshotOf`
 * over `workspaceReport`), so the CLI, the review page's Worker and the tests share it.
 */

/** Bumped when the gate's rules change, so a gate stamped by an older tool reads as stale. */
export const GATE_VERSION = 1;

const COLLECTIONS = ['items', 'tokens', 'effects', 'recipePools', 'starterCamp', 'skillPerks', 'planSettings'];

/** A fingerprint of the whole workspace a gate ran against: a pack's gate is stale once it differs. */
export function workspaceFingerprint(workspace = {}) {
    return fingerprint(Object.fromEntries(COLLECTIONS.map((k) => [k, workspace[k] ?? null])));
}

/** Every entry of the pack applied, conflicting ones too (as the pack proposes them): `{ workspace, conflicts }`. */
export function applyPackInMemory(workspace, pack) {
    let ws = Object.fromEntries(COLLECTIONS.map((k) => [k, workspace[k] ?? null]));
    const conflicts = [];
    pack.entries.forEach((entry, index) => {
        const check = entryConflict(ws, entry);
        if (check.conflict) conflicts.push({ index, id: entry.id, reason: check.reason });
        ws = { ...ws, ...setValue(ws, entry.kind, entry.id, proposedValue(entry)) };
    });
    return { workspace: ws, conflicts };
}

/** The waivers an entry adds to its record's plan: any the record did not already carry. */
function addedWaivers(workspace, entry) {
    if (entry.op === 'delete') return [];
    const proposed = entry.value?.plan?.waivers;
    if (!Array.isArray(proposed) || !proposed.length) return [];
    const had = currentValue(workspace, entry.kind, entry.id)?.plan?.waivers;
    const known = new Set((Array.isArray(had) ? had : []).map(canonicalJson));
    return proposed.filter((w) => !known.has(canonicalJson(w)));
}

/**
 * Judge one comparison against the pack's declarations.
 * @returns {{ verdict: 'pass' | 'block', blocks: object[], notes: string[] }}  each block `{ rule, message, key? }`
 */
export function judge(diff, pack, { workspace = null, conflicts = [] } = {}) {
    const blocks = [];
    const notes = [];
    const declared = declaredStages(pack);
    const tol = diff.tolerancePct;

    for (const f of diff.added) {
        if (f.severity !== 'block') continue;
        blocks.push({ rule: 'new-block', key: f.key, message: `A new Block finding${f.name ? ` on ${f.name}` : ''}: ${f.message}` });
    }

    for (const s of diff.stages) {
        const intent = declared.get(s.tier);
        if (!s.beyond) {
            if (intent) notes.push(`${s.label} was declared ${intent.move} but moved within the ±${tol} % tolerance: ${stageMoveText(s)}.`);
            continue;
        }
        if (!intent) {
            blocks.push({ rule: 'stage-undeclared', key: `stage:${s.tier}`, message: `${stageMoveText(s)}: beyond the ±${tol} % tolerance, and the pack does not declare it.` });
            continue;
        }
        if (intent.move !== s.direction) {
            blocks.push({ rule: 'stage-mismatch', key: `stage:${s.tier}`, message: `${stageMoveText(s)}: the pack declares it ${intent.move}.` });
            continue;
        }
        if (intent.toHours !== undefined) {
            const off = s.after === null ? Infinity : Math.abs(s.after / intent.toHours - 1) * 100;
            if (off > tol) {
                blocks.push({ rule: 'stage-mismatch', key: `stage:${s.tier}`, message: `${stageMoveText(s)}: the pack declares it lands near ${PACE_TEXT.hours(intent.toHours)} (±${tol} %).` });
                continue;
            }
        }
        notes.push(`${stageMoveText(s)}, as declared: ${intent.note}`);
    }

    if (workspace) {
        for (const entry of pack.entries) {
            const added = addedWaivers(workspace, entry);
            if (added.length) blocks.push({ rule: 'waiver', key: entry.id, message: `${entry.id} adds ${added.length} waiver${added.length === 1 ? '' : 's'} to its plan: only the owner waives a check.` });
        }
    }

    if (conflicts.length) {
        notes.push(`${conflicts.length} entr${conflicts.length === 1 ? 'y conflicts' : 'ies conflict'} with this workspace (${conflicts.map((c) => c.id).join(', ')}); the gate applied ${conflicts.length === 1 ? 'it' : 'them'} as the pack proposes.`);
    }
    return { verdict: blocks.length ? 'block' : 'pass', blocks, notes };
}

/**
 * Run the gate.
 * @param {object} workspace  the CMS workspace (`{ items, tokens, effects, recipePools, starterCamp, skillPerks, planSettings }`)
 * @param {object} pack       a valid change pack
 * @param {(ws: object) => object} snapshot  the ledger's snapshot of a workspace
 * @returns {{ verdict, blocks, notes, summary, diff, before, after, conflicts, workspaceFingerprint, toolVersion, at, errors? }}
 */
export function runGate(workspace, pack, snapshot, { at = new Date().toISOString() } = {}) {
    const check = validatePack(pack);
    const base = { workspaceFingerprint: workspaceFingerprint(workspace), toolVersion: GATE_VERSION, at };
    if (!check.ok) {
        const blocks = check.errors.map((message) => ({ rule: 'malformed', message }));
        return { ...base, verdict: 'block', blocks, notes: [], errors: check.errors, summary: 'Blocked: the CMS would refuse this pack.', diff: null };
    }
    const before = snapshot(workspace);
    const { workspace: next, conflicts } = applyPackInMemory(workspace, pack);
    const after = snapshot(next);
    const diff = compareSnapshots(before, after);
    const judged = judge(diff, pack, { workspace, conflicts });
    return { ...base, ...judged, conflicts, diff, before, after, summary: summaryOf(judged, diff) };
}

/** The gate in a few plain words, for the top of the review and the CLI. */
export function summaryOf(judged, diff) {
    const parts = [];
    const moved = diff.moved.filter((m) => m.change === 'earlier' || m.change === 'later').length;
    const fresh = diff.moved.filter((m) => m.change === 'new').length;
    const gone = diff.moved.filter((m) => m.change === 'gone').length;
    const stages = diff.stages.filter((s) => s.pct || s.lost);
    parts.push(moved ? `${moved} entr${moved === 1 ? 'y moves' : 'ies move'} on the timeline` : 'nothing already reached moves');
    if (fresh) parts.push(`${fresh} newly reached`);
    if (gone) parts.push(`${gone} no longer reached`);
    if (stages.length) parts.push(`${stages.length} stage time${stages.length === 1 ? '' : 's'} change${stages.length === 1 ? 's' : ''}`);
    const serious = (list) => list.filter((f) => f.severity !== 'info').length;
    parts.push(`${serious(diff.added)} problem${serious(diff.added) === 1 ? '' : 's'} added, ${serious(diff.cleared)} cleared`);
    const head = judged.verdict === 'pass' ? 'Passes' : `Blocked (${judged.blocks.length} reason${judged.blocks.length === 1 ? '' : 's'})`;
    return `${head}: ${parts.join(', ')}.`;
}

/** What a pack carries as `pack.gate` once the CLI's `gate --write` has run: the verdict and the biggest moves, not the snapshots. */
export function gateRecord(result, { moved = 30 } = {}) {
    return {
        workspaceFingerprint: result.workspaceFingerprint,
        toolVersion: result.toolVersion,
        at: result.at,
        verdict: result.verdict,
        summary: result.summary,
        blocks: result.blocks,
        notes: result.notes,
        deltas: result.diff ? {
            stages: result.diff.stages.filter((s) => s.pct || s.lost).map((s) => ({ tier: s.tier, before: s.before, after: s.after, pct: Number.isFinite(s.pct) ? Math.round(s.pct * 1000) / 10 : s.pct > 0 ? 'never' : 'now' })),
            moved: result.diff.moved.slice(0, moved).map((m) => ({ key: m.key, name: m.name, change: m.change, from: m.from?.hours ?? null, to: m.to?.hours ?? null })),
            movedCount: result.diff.moved.length,
            added: result.diff.added.map((f) => ({ check: f.check, key: f.key, severity: f.severity })),
            cleared: result.diff.cleared.length,
        } : null,
    };
}

/**
 * A pack's gate as the inbox lists it: `none` (never gated), `stale` (gated against another
 * workspace or by an older gate), else its verdict, `pass` or `block`.
 */
export function gateStatus(gate, fingerprintNow) {
    if (!gate || typeof gate !== 'object' || !gate.verdict) return 'none';
    if (gate.toolVersion !== GATE_VERSION || (fingerprintNow && gate.workspaceFingerprint !== fingerprintNow)) return 'stale';
    return gate.verdict === 'pass' ? 'pass' : 'block';
}
