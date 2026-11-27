import { workspacePace } from './ledgerReport.js';
import { PROFILE, PROFILES } from './ledger/pace.js';
import { tierLabel, isPlanned } from '../../../src/systems/progression/ledger/plan.js';
import { derivedCoinWorth, isCoinWorthPinned, coinsInPlay } from './ledger/coins.js';

/**
 * The ledger's coins over the CMS workspace (brief 870 C3), for the content agent's coin pack
 * (`node cms/changePackTool.mjs coins`): what one hero earns by each stage at each profile and a
 * worker's selling alone, every price that may ask coins with what it asks and what the coin curve
 * proposes on that selling, each enemy's Coin drop beside what its loot sells for and the kills an
 * hour it assumes, each hoarding camp's thefts an hour, and how many items Recalculate gives a coin
 * worth. A preview: nothing here writes to the workspace.
 */

/**
 * The workspace's coins: `{ supply, prices, drops, thefts, worth, ms }`. A supply row's profiles
 * hold every way to earn; its `selling` the Typical worker's selling alone, what a price is set on.
 */
export function workspaceCoins(state = {}) {
    const started = Date.now();
    const pace = workspacePace(state);
    const supply = [];
    const budgets = pace.settings.stages;
    const sourceOf = (s) => (s.work ? pace.workName(s.work) : s.theft ? `thefts from ${s.theft.enemy} at ${s.theft.hideout}` : null);
    const span = (start, end) => ({ start: start.perHour, end: end.perHour, startSource: sourceOf(start), endSource: sourceOf(end) });
    for (let tier = 0; tier <= pace.maxTier; tier++) {
        // From the stage's start to its end on the owner's budgets: the levels the pace curve has by then.
        const startHours = Math.max(0, ...budgets.filter((b) => b.tier < tier).map((b) => b.budgetMinutes)) / 60;
        const own = budgets.find((b) => b.tier === tier);
        const endHours = own ? own.budgetMinutes / 60 : Infinity;
        const row = { tier, label: tierLabel(tier), startHours, endHours };
        for (const p of PROFILES) row[p] = span(pace.coinSupplyOf(p, tier, startHours), pace.coinSupplyOf(p, tier, endHours));
        row.selling = span(pace.sellingSupplyOf(PROFILE.TYPICAL, tier, startHours), pace.sellingSupplyOf(PROFILE.TYPICAL, tier, endHours));
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
    return { supply, prices: pace.coinPrices(), drops: pace.coinDrops(), thefts: pace.coinThefts(), worth: { priced, pinned, inPlay }, ms: Date.now() - started };
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
    const from = (t) => `from ${round(t.start)}${t.startSource ? ` (${t.startSource})` : ''}`;
    const to = (t) => `to ${round(t.end)}${t.endSource ? ` (${t.endSource})` : ''}`;
    for (const s of result.supply) {
        const t = s[PROFILE.TYPICAL];
        lines.push(`- ${s.label}: ${from(t)} at ${when(s.startHours)} ${to(t)} at ${when(s.endHours)} [Bare ${round(s[PROFILE.BARE].start)} to ${round(s[PROFILE.BARE].end)}, Maxed ${round(s[PROFILE.MAXED].start)} to ${round(s[PROFILE.MAXED].end)}]`);
    }
    lines.push('A worker\'s selling an hour at Typical, from each stage\'s start to its end: what the coin curves price on (kills and thefts never set a price):');
    for (const s of result.supply) if (s.selling) lines.push(`- ${s.label}: ${from(s.selling)} ${to(s.selling)}`);
    const asking = result.prices.filter((p) => p.coins > 0);
    lines.push(`Prices: ${result.prices.length}, ${asking.length} asking coins. What the coin curves propose for each (the coins one hero earns selling there in its curve's minutes: everyday for a Shop Token, big for a Guild Hall rank or a ring):`);
    for (const p of result.prices.slice(0, rows)) {
        const what = `${p.name}${p.kind === 'hall' ? ` rank ${p.rank}` : ''}`;
        const now = p.coins > 0 ? `asks ${p.coins}` : 'asks none';
        const at = p.tier === null ? '' : ` at ${tierLabel(p.tier)}`;
        lines.push(`- ${what} (${p.kind}${at}): ${now}; ${p.proposed !== null ? `proposed ${p.proposed} (${p.minutes} min on the ${p.curve} curve of ${round(p.perHour)} an hour)` : `no proposal: ${p.why}`}`);
    }
    if (result.prices.length > rows) lines.push(`- and ${result.prices.length - rows} more`);
    const half = (row, each, word) => `half a worker's selling there (${round(row.sellingPerHour)} an hour) is ${each ?? '—'} a ${word}`;
    lines.push('Enemies: Coin drop now, what one kill\'s loot sells for (proposed), the kills an hour one hero makes at Typical with the coins they drop, and half a worker\'s selling a kill:');
    for (const d of result.drops) {
        const kills = d.killsPerHour !== undefined ? `; ${round(d.killsPerHour)} kills an hour, ${round(d.coinsPerHour)} coins an hour; ${half(d, d.halfSellingPerKill, 'kill')}` : '';
        lines.push(`- ${d.name}${d.level ? ` (level ${d.level})` : ''}: ${d.coinDrop} now, proposed ${d.proposed}${kills}`);
    }
    const thefts = result.thefts || [];
    lines.push(thefts.length
        ? 'Hoarding camps: each Hideout\'s thefts an hour from it (less those caught), the coins a theft and an hour, and half a worker\'s selling a theft:'
        : 'Hoarding camps: no Hideout robs a camp whose steal table takes coins.');
    for (const t of thefts) {
        lines.push(`- ${t.campName} (${t.enemyName}, ${tierLabel(t.tier)}) robbed from ${t.hideoutName} (level ${t.level}): ${round(t.thefts)} thefts an hour at ${t.coins} coins, ${round(t.perHour)} coins an hour; ${half(t, t.halfSellingPerTheft, 'theft')}`);
    }
    lines.push(`Worked out in ${(result.ms / 1000).toFixed(1)} s.`);
    return lines.join('\n');
}
