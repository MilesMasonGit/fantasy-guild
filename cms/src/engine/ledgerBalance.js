import { proposeBalance, applyProposals, recordOf, LEVER, BALANCE_TEXT, CANT_FIX } from './ledger/balance.js';
import { contentOf } from './ledgerReport.js';
import { currentValue, fingerprint, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { adaptToken, adaptRecipe, isInert, isUntagged } from './sim/fieldAdapter.js';

/**
 * The Ledger's balancing preview over the CMS workspace (`ledger/balance.js`): the numbers the
 * content would need for the Typical player to follow the pace curve, each stage to meet its budget
 * and boosts their targets, and what numbers alone cannot fix. A preview: nothing here writes to the
 * workspace. Slow (the pace is worked out again after each pass), so the page runs it in the ledger's
 * Worker (`ledgerJobs.js`).
 */

export { LEVER, BALANCE_TEXT, CANT_FIX };

/** The preview of a workspace (its content and its Ledger settings), with how long it took (`ms`). */
export function workspaceBalance(state = {}) {
    const started = Date.now();
    const result = proposeBalance(contentOf(state), state.planSettings);
    return { ...result, ms: Date.now() - started };
}

/** How far a proposal moves its number: the larger over the smaller, so a halving and a doubling read alike. */
export function moveSize(p) {
    const a = Math.abs(Number(p.from));
    const b = Math.abs(Number(p.to));
    if (!(a > 0) || !(b > 0)) return Infinity;
    return Math.max(a, b) / Math.min(a, b);
}

/** The proposals, largest move first, then by lever and name. */
export function sortedProposals(proposals = []) {
    const order = Object.values(LEVER);
    return [...proposals].sort((x, y) => moveSize(y) - moveSize(x) || order.indexOf(x.lever) - order.indexOf(y.lever) || x.name.localeCompare(y.name));
}

/** A proposal's change in words: "1 → 12 (12×)", "-0.2 → -0.09". */
export function changeText(p) {
    const size = moveSize(p);
    const times = Number.isFinite(size) && size >= 1.05 ? ` (${size >= 10 ? Math.round(size) : Math.round(size * 10) / 10}× ${Math.abs(p.to) > Math.abs(p.from) ? 'up' : 'down'})` : '';
    return `${p.from} → ${p.to}${times}`;
}

/** The can't-fix list by cause, in the order a reader acts on them: content first, the Hall last. */
export function cantFixGroups(cantFix = []) {
    const order = [CANT_FIX.CONTENT, CANT_FIX.ONE_OFF, CANT_FIX.WORLD, CANT_FIX.CHAIN, CANT_FIX.LIMIT, CANT_FIX.FLOOR, CANT_FIX.UNTIMED, CANT_FIX.RARE, CANT_FIX.LUCK, CANT_FIX.OTHER, CANT_FIX.HALL];
    const groups = new Map();
    for (const c of cantFix) {
        if (!groups.has(c.cause)) groups.set(c.cause, []);
        groups.get(c.cause).push(c);
    }
    return [...groups].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
        .map(([cause, rows]) => ({ cause, label: BALANCE_TEXT.cause[cause] || cause, rows }));
}

const hoursWords = (h) => (h === null || h === undefined ? 'nothing planned' : h === 'Infinity' || h === Infinity ? 'never' : formatHours(h));
function formatHours(h) {
    const m = Math.round(h * 60);
    if (m < 60) return `${m} min`;
    const d = Math.floor(m / 1440);
    const hh = Math.floor((m % 1440) / 60);
    if (d > 0) return hh ? `${d} d ${hh} h` : `${d} d`;
    return m % 60 ? `${hh} h ${m % 60} min` : `${hh} h`;
}
const skillWords = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The preview in plain text, for the change pack tool: stages, walls, the largest moves, what numbers cannot fix. */
export function balanceText(result, { moves = 15 } = {}) {
    const lines = [];
    lines.push('Stages at Typical (before → after, against the budget):');
    for (const a of result.after.stages) {
        const b = result.before.stages.find((s) => s.tier === a.tier) || a;
        const pct = (s) => (s.offPct === null ? '' : ` (${s.offPct >= 0 ? '+' : ''}${Math.round(s.offPct)} %)`);
        lines.push(`- ${a.label}: ${hoursWords(b.hours)}${pct(b)} → ${hoursWords(a.hours)}${pct(a)} against ${formatHours(a.budgetMinutes / 60)}${a.within ? ', within' : ', OUT'}`);
    }
    const wall = (w) => `${skillWords(w.skill)} ${w.from} → ${w.to} (${hoursWords(w.hours)} against ${hoursWords(w.curveHours)}, worst level ${Math.round(w.worst * 10) / 10}×)`;
    lines.push(`Walls at Typical: ${result.before.walls.length} → ${result.after.walls.length}.`);
    for (const w of result.before.walls) lines.push(`- before: ${wall(w)}`);
    for (const w of result.after.walls) lines.push(`- after: ${wall(w)}`);
    lines.push(`Long waits for one unlock: ${result.before.unlockWalls.length} → ${result.after.unlockWalls.length}. Boosts over target (not the Guild Hall): ${result.before.boosts.filter((b) => b.kind !== 'hall').length} → ${result.after.boosts.filter((b) => b.kind !== 'hall').length}.`);
    const by = {};
    for (const p of result.proposals) by[p.lever] = (by[p.lever] || 0) + 1;
    lines.push(`Numbers to change: ${result.proposals.length} (${Object.entries(by).map(([l, n]) => `${BALANCE_TEXT.lever[l]} ${n}`).join(', ') || 'none'}). Largest moves:`);
    for (const p of sortedProposals(result.proposals).slice(0, moves)) lines.push(`- ${p.name} · ${p.label}: ${changeText(p)}. ${p.why}`);
    if (result.proposals.length > moves) lines.push(`- and ${result.proposals.length - moves} more`);
    if (by[LEVER.XP]) lines.push('XP a cycle: a change pack pins these numbers where Recalculate would derive them, so Sync keeps them.');
    lines.push(`What numbers alone cannot fix: ${result.cantFix.length}.`);
    for (const g of cantFixGroups(result.cantFix)) {
        lines.push(`- ${g.label} (${g.rows.length}):`);
        for (const c of g.rows.slice(0, g.cause === CANT_FIX.HALL || g.cause === CANT_FIX.LUCK ? 3 : 20)) lines.push(`  - ${c.message}`);
        if ((g.cause === CANT_FIX.HALL || g.cause === CANT_FIX.LUCK) && g.rows.length > 3) lines.push(`  - and ${g.rows.length - 3} more`);
    }
    return lines.join('\n');
}

/** The skill a recipe's pool is kept under in the workspace. */
function poolOf(state, recipeId) {
    for (const [skill, pool] of Object.entries(state.recipePools || {})) {
        if (Array.isArray(pool) && pool.some((r) => r?.id === recipeId)) return skill;
    }
    return null;
}

/** Whether Recalculate derives a record's XP a cycle: real work with a Tempo and a Purpose (`sim/xpPass.js`). */
function xpIsDerived(kind, record) {
    const entity = kind === 'recipe' ? adaptRecipe(record) : adaptToken(record);
    return !isInert(entity) && !isUntagged(entity);
}

/**
 * The proposals as a change pack (`cms/incoming/README.md`): one edit per entity with its whole new
 * record and the fingerprint of the workspace's record, the stages it moves beyond the tolerance
 * declared as its intent. For an agent to stage in its scratchpad (`changePackTool.mjs balance`);
 * the CMS never writes it.
 * ⚠️ An XP number on a record Recalculate derives is pinned (`sim.xpPinned`): Sync runs Recalculate,
 * so without the pin the number would be put back.
 */
export function balancePack(state, result, { id = null, createdAt = new Date().toISOString() } = {}) {
    const applied = applyProposals(contentOf(state), result.proposals);
    const byEntity = new Map();
    for (const p of result.proposals) {
        const k = `${p.kind}:${p.id}`;
        if (!byEntity.has(k)) byEntity.set(k, { kind: p.kind, id: p.id, list: [] });
        byEntity.get(k).list.push(p);
    }
    const entries = [];
    for (const { kind, id: entityId, list } of byEntity.values()) {
        const current = currentValue(state, kind, entityId);
        let value = recordOf(applied, kind, entityId);
        if (!current || !value) continue;
        if (kind === 'recipe' && !value.skill) value = { ...value, skill: poolOf(state, entityId) };
        const pin = list.some((p) => p.lever === LEVER.XP) && xpIsDerived(kind, value);
        if (pin) value = { ...value, sim: { ...value.sim, xpPinned: true } };
        entries.push({
            op: 'edit', kind, id: entityId, value, fingerprint: fingerprint(current),
            note: list.map((p) => `${p.label} (${p.field}) ${p.from} → ${p.to}: ${p.why}`).join(' ') + (pin ? ' Pinned, so Recalculate and Sync keep it.' : '')
        });
    }
    const tol = state.planSettings?.tolerancePct ?? 25;
    const stages = [];
    for (const after of result.after.stages) {
        const before = result.before.stages.find((s) => s.tier === after.tier);
        if (!before || !(before.hours > 0) || !(after.hours > 0) || !Number.isFinite(before.hours) || !Number.isFinite(after.hours)) continue;
        if (Math.abs(after.hours / before.hours - 1) * 100 <= tol) continue;
        stages.push({
            tier: after.tier, move: after.hours < before.hours ? 'faster' : 'slower', toHours: Math.round(after.hours * 100) / 100,
            note: `The balancing preview brings ${after.label} toward its budget of ${Math.round(after.budgetMinutes)} min.`
        });
    }
    const day = createdAt.slice(0, 10);
    return {
        format: PACK_FORMAT, version: PACK_VERSION, id: id || `${day}-ledger-balancing-preview`, createdAt,
        asked: 'The Ledger balancing preview (brief 290 L9): the numbers the Typical player needs to follow the pace curve, each stage its budget and boosts their targets. A preview to review, not to apply yet.',
        ...(stages.length ? { intent: { stages } } : {}),
        entries
    };
}
