// node stages.mjs [label] [pack.json]: stage times at Typical vs budgets, written to stages_<label>.json
import fs from 'fs';
import { engine, dataWorkspace, withPack, stagesOf, fmt } from './lib.mjs';
const [label = 'now', packFile] = process.argv.slice(2);
const { server, load } = await engine();
try {
    let ws = await dataWorkspace(load);
    if (packFile) ws = await withPack(load, ws, packFile);
    const { rows, ms, pace, report } = await stagesOf(load, ws);
    console.log(`${label}: worked out in ${ms} ms`);
    for (const r of rows) {
        console.log(`${r.label} (tier ${r.tier}): ${fmt(r.hours)} vs budget ${fmt(r.budgetHours)} → ${r.offPct === null ? '—' : (r.offPct > 0 ? '+' : '') + r.offPct + ' %'}${r.red ? ' RED' : ''} | ${r.entries} entries, ${r.untimed} untimed | slowest: ${r.slowest.join('; ')}`);
    }
    // The Water and the Hall's other lines at each profile, per hour, at the last stage.
    const out = { label, rows, supply: {} };
    for (const item of ['item_water', 'item_oak_seedling', 'item_wheat_seed', 'item_apple_seed']) {
        out.supply[item] = {};
        for (const tier of [0, 1, 2]) {
            out.supply[item][tier] = Object.fromEntries(['bare', 'typical', 'maxed'].map((p) => [p, Math.round((pace.supplyOf(item, p, tier)?.perHour ?? 0) * 10) / 10]));
        }
        console.log(item, JSON.stringify(out.supply[item]));
    }
    const hall = pace.hallPaybacks().filter((r) => /lap|wishing/.test(r.id));
    for (const r of hall) console.log(`${r.id} r${r.rank} t${r.tier} rate=${r.rate} gain=${r.gain?.toFixed?.(4)} payback=${Number.isFinite(r.payback) ? r.payback.toFixed(2) + ' h' : r.payback} pays=${r.pays} price=${r.priceText} proposed=${r.proposed ? `${r.proposed.quantity} ${r.proposed.itemId} (${Number.isFinite(r.proposed.payback) ? r.proposed.payback.toFixed(2) + ' h' : r.proposed.payback}${r.proposed.raised ? ', raised' : ''}${r.proposed.why ? ', ' + r.proposed.why : ''})` : '—'}`);
    out.hall = hall.map((r) => ({ id: r.id, rank: r.rank, tier: r.tier, rate: r.rate, gain: r.gain, payback: r.payback, pays: r.pays, price: r.priceText, proposed: r.proposed && { itemId: r.proposed.itemId, quantity: r.proposed.quantity, payback: r.proposed.payback, raised: r.proposed.raised, why: r.proposed.why } }));
    out.findings = report.findings.filter((f) => ['stage-budget', 'hall-payback', 'boost-target', 'wall', 'profile-bounds'].includes(f.check)).map((f) => `${f.severity} ${f.check} ${f.key}: ${f.message}`);
    for (const f of out.findings) console.log(f);
    const { snap } = await stagesOf(load, ws);
    out.dots = Object.fromEntries(Object.entries(snap.dots).map(([k, d]) => [k, { name: d.name, hours: d.hours }]));
    fs.writeFileSync(`stages_${label}.json`, JSON.stringify(out, null, 2));
} finally {
    await server.close();
}
