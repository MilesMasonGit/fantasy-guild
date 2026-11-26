import { workspacePace } from './ledgerReport.js';
import { PROFILE, PROFILES } from './ledger/pace.js';
import { tierLabel, isPlanned } from '../../../src/systems/progression/ledger/plan.js';
import { derivedCoinWorth, isCoinWorthPinned, coinsInPlay } from './ledger/coins.js';

/**
 * The ledger's coins over the CMS workspace (brief 870 C3), for the content agent's coin pack
 * (`node cms/changePackTool.mjs coins`): what one hero earns by each stage at each profile, every
 * price that may ask coins with what it asks and what the coin curve proposes, each enemy's Coin
 * drop beside what its loot sells for, and how many items Recalculate gives a coin worth. A
 * preview: nothing here writes to the workspace.
 */

/** The workspace's coins: `{ supply, prices, drops, worth, ms }`. */
export function workspaceCoins(state = {}) {
    const started = Date.now();
    const pace = workspacePace(state);
    const supply = [];
    const budgets = pace.settings.stages;
    const sourceOf = (s) => (s.work ? pace.workName(s.work) : s.theft ? `thefts from ${s.theft.enemy} at ${s.theft.hideout}` : null);
    for (let tier = 0; tier <= pace.maxTier; tier++) {
        // From the stage's start to its end on the owner's budgets: the levels the pace curve has by then.
        const startHours = Math.max(0, ...budgets.filter((b) => b.tier < tier).map((b) => b.budgetMinutes)) / 60;
        const own = budgets.find((b) => b.tier === tier);
        const endHours = own ? own.budgetMinutes / 60 : Infinity;
        const row = { tier, label: tierLabel(tier), startHours, endHours };
        for (const p of PROFILES) {
            const start = pace.coinSupplyOf(p, tier, startHours);
            const end = pace.coinSupplyOf(p, tier, endHours);
            row[p] = { start: start.perHour, end: end.perHour, startSource: sourceOf(start), endSource: sourceOf(end) };
        }
        supply.push(row);
    }
    let priced = 0;
    let pinned = 0;
    for (const item of Object.values(state.items || {})) {
        if (!item || isPlanned(item)) continue;
        if (derivedCoinWorth(item) !== null) priced++;
        if (isCoinWorthPinned(item)) pinned++;
    }
    const inPlay = coinsInPlay({ tokens: state.tokens, hallStars: state.hallStars, world: state.world });
    return { supply, prices: pace.coinPrices(), drops: pace.coinDrops(), worth: { priced, pinned, inPlay }, ms: Date.now() - started };
}

const round = (n) => (Number.isFinite(n) ? Math.round(n) : n);

/** The coins in plain text, for the change pack tool. */
export function coinsText(result, { rows = 40 } = {}) {
    const lines = [];
    lines.push(result.worth.inPlay
        ? `Coin worth: ${result.worth.priced} items sell for their value in coins (${result.worth.pinned} pinned by hand); Recalculate writes them.`
        : `Coin worth: nothing asks or drops coins yet, so Recalculate writes no sale prices; once something does, ${result.worth.priced} items sell for their value in coins (${result.worth.pinned} pinned by hand).`);
    lines.push('Coins one hero earns an hour from each stage\'s start to its end (its budget; the levels the pace curve has by then), at Typical, Bare and Maxed in brackets:');
    const when = (h) => (Number.isFinite(h) ? `${Math.round(h * 60)} min` : 'any level');
    for (const s of result.supply) {
        const t = s[PROFILE.TYPICAL];
        lines.push(`- ${s.label}: from ${round(t.start)}${t.startSource ? ` (${t.startSource})` : ''} at ${when(s.startHours)} to ${round(t.end)}${t.endSource ? ` (${t.endSource})` : ''} at ${when(s.endHours)} [Bare ${round(s[PROFILE.BARE].start)} to ${round(s[PROFILE.BARE].end)}, Maxed ${round(s[PROFILE.MAXED].start)} to ${round(s[PROFILE.MAXED].end)}]`);
    }
    const asking = result.prices.filter((p) => p.coins > 0);
    lines.push(`Prices: ${result.prices.length}, ${asking.length} asking coins. What the coin curves propose for each (the coins one hero earns there in its curve's minutes: everyday for a Shop Token, big for a Guild Hall rank or a ring):`);
    for (const p of result.prices.slice(0, rows)) {
        const what = `${p.name}${p.kind === 'hall' ? ` rank ${p.rank}` : ''}`;
        const now = p.coins > 0 ? `asks ${p.coins}` : 'asks none';
        const at = p.tier === null ? '' : ` at ${tierLabel(p.tier)}`;
        lines.push(`- ${what} (${p.kind}${at}): ${now}; ${p.proposed !== null ? `proposed ${p.proposed} (${p.minutes} min on the ${p.curve} curve of ${round(p.perHour)} an hour)` : `no proposal: ${p.why}`}`);
    }
    if (result.prices.length > rows) lines.push(`- and ${result.prices.length - rows} more`);
    lines.push('Enemies: Coin drop now, and what one kill\'s loot sells for (proposed):');
    for (const d of result.drops) lines.push(`- ${d.name}${d.level ? ` (level ${d.level})` : ''}: ${d.coinDrop} now, proposed ${d.proposed}`);
    lines.push(`Worked out in ${(result.ms / 1000).toFixed(1)} s.`);
    return lines.join('\n');
}
