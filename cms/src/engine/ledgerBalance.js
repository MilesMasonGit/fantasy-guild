import { proposeBalance, applyProposals, recordOf, LEVER, BALANCE_TEXT, CANT_FIX } from './ledger/balance.js';
import { contentOf } from './ledgerReport.js';
import { currentValue, fingerprint, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { adaptToken, adaptRecipe, isInert, isUntagged } from './sim/fieldAdapter.js';
import { tierLabel } from '../../../src/systems/progression/ledger/plan.js';

/**
 * The Ledger's balancing preview over the CMS workspace (`ledger/balance.js`): the numbers the
 * content would need for the Maxed player (the curve's) to follow the pace curve and boosts their
 * targets, each stage's way out before and after, and what numbers alone cannot fix (a way out off
 * its budget, for the world tables to move). A preview: nothing here writes to the
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

/** What a stage's way out asks, in words: "Trees ring 1: Forestry 5 + 30 coins". */
export function wayOutText(s) {
    const asks = [...s.asks.map((a) => `${skillWords(a.skill)} ${a.level}`), ...(s.coins > 0 ? [`${s.coins} coins`] : [])].join(' + ') || 'nothing';
    return `${s.name}: ${asks}`;
}

/** Why a stage has no way out, in words. */
export const noWayOutText = (s) => (s.why === 'last' ? 'the last stage' : `no place of ${tierLabel(s.next)} to settle`);

/** The preview in plain text, for the change pack tool: stages, walls, the largest moves, what numbers cannot fix. */
export function balanceText(result, { moves = 15 } = {}) {
    const lines = [];
    lines.push('Way out of each stage at Maxed (before → after, against the budget; its full content after, information only):');
    for (const a of result.after.stages) {
        const b = result.before.stages.find((s) => s.tier === a.tier) || a;
        const pct = (s) => (s.offPct === null ? '' : ` (${s.offPct >= 0 ? '+' : ''}${Math.round(s.offPct)} %)`);
        const content = a.content.entries ? `; full content ${hoursWords(a.content.hours)}` : '';
        if (!a.place) {
            lines.push(`- ${a.label}: ${noWayOutText(a)}${content}`);
            continue;
        }
        const floor = a.floor.length ? ', a floor' : '';
        lines.push(`- ${a.label}: ${hoursWords(b.hours)}${pct(b)} → ${hoursWords(a.hours)}${pct(a)} against ${formatHours(a.budgetMinutes / 60)}${a.within ? ', within' : ', OUT'} (${wayOutText(a)}${floor})${content}`);
    }
    const wall = (w) => `${skillWords(w.skill)} ${w.from} → ${w.to} (${hoursWords(w.hours)} against ${hoursWords(w.curveHours)}, worst level ${Math.round(w.worst * 10) / 10}×)`;
    lines.push(`Walls at Maxed: ${result.before.walls.length} → ${result.after.walls.length}.`);
    for (const w of result.before.walls) lines.push(`- before: ${wall(w)}`);
    for (const w of result.after.walls) lines.push(`- after: ${wall(w)}`);
    lines.push(`Long waits for one unlock: ${result.before.unlockWalls.length} → ${result.after.unlockWalls.length}. Boosts over target (not the Guild Hall): ${result.before.boosts.filter((b) => b.kind !== 'hall').length} → ${result.after.boosts.filter((b) => b.kind !== 'hall').length}.`);
    const by = {};
    for (const p of result.proposals) by[p.lever] = (by[p.lever] || 0) + 1;
    lines.push(`Numbers to change: ${result.proposals.length} (${Object.entries(by).map(([l, n]) => `${BALANCE_TEXT.lever[l]} ${n}`).join(', ') || 'none'}). Largest moves:`);
    for (const p of sortedProposals(result.proposals).slice(0, moves)) lines.push(`- ${p.name} · ${p.label}: ${changeText(p)}. ${p.why}`);
    if (result.proposals.length > moves) lines.push(`- and ${result.proposals.length - moves} more`);
    if (by[LEVER.XP]) lines.push('XP a cycle: a change pack pins these numbers where Recalculate would derive them, so Sync keeps them.');
    if (by[LEVER.COINS]) lines.push('Coins: only prices that already ask coins are set to the coin curve (node cms/changePackTool.mjs coins lists every price).');
    lines.push(`What numbers alone cannot fix: ${result.cantFix.length}.`);
    for (const g of cantFixGroups(result.cantFix)) {
        lines.push(`- ${g.label} (${g.rows.length}):`);
        for (const c of g.rows.slice(0, g.cause === CANT_FIX.HALL || g.cause === CANT_FIX.LUCK ? 3 : 20)) lines.push(`  - ${c.message}`);
        if ((g.cause === CANT_FIX.HALL || g.cause === CANT_FIX.LUCK) && g.rows.length > 3) lines.push(`  - and ${g.rows.length - 3} more`);
    }
    return lines.join('\n');
}

/** A copy of a record with each proposal's field set to its number (`prices.2.coins`). */
function withFields(record, proposals) {
    if (!record) return null;
    const out = structuredClone(record);
    for (const p of proposals) {
        const parts = p.field.split('.');
        let at = out;
        for (const part of parts.slice(0, -1)) {
            if (at[part] === null || typeof at[part] !== 'object') at[part] = {};
            at = at[part];
        }
        at[parts[parts.length - 1]] = p.to;
    }
    return out;
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
        // The ledger reads the world tables normalised; the pack carries the workspace's own record, changed.
        let value = kind === 'world' ? withFields(current, list) : recordOf(applied, kind, entityId);
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
    // ⚠️ The pack gate measures a stage by its full content: the stages the numbers move are declared by it, not by the way out.
    const stages = [];
    for (const after of result.after.stages) {
        const was = result.before.stages.find((s) => s.tier === after.tier)?.content.hours;
        const now = after.content.hours;
        if (!(was > 0) || !(now > 0) || !Number.isFinite(was) || !Number.isFinite(now)) continue;
        if (Math.abs(now / was - 1) * 100 <= tol) continue;
        stages.push({
            tier: after.tier, move: now < was ? 'faster' : 'slower', toHours: Math.round(now * 100) / 100,
            note: `The balancing preview's numbers move ${after.label}'s full content, which is information and held to no budget.`
        });
    }
    const day = createdAt.slice(0, 10);
    return {
        format: PACK_FORMAT, version: PACK_VERSION, id: id || `${day}-ledger-balancing-preview`, createdAt,
        asked: 'The Ledger balancing preview (brief 290 L9): the numbers the Maxed player, the curve player, needs to follow the pace curve and boosts their targets. A preview to review, not to apply yet.',
        ...(stages.length ? { intent: { stages } } : {}),
        entries
    };
}
