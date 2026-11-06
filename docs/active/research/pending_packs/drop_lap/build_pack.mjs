// Prices the drop lap's star by the ledger's proposals (iterated until they settle) and writes the pack.
// node build_pack.mjs   (scratch: never committed)
import fs from 'fs';
import { engine, dataWorkspace } from './lib.mjs';

const ID = 'star_well_lap';
const PACK_ID = '2026-11-06-drop-lap';
const lapRule = (rank, value) => ({
    id: `stm_${ID}_${rank}`, keyword: 'provides',
    payload: { type: 'PASSIVE_LAP', bucket: 'percentage', value },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
});
const star = (prices) => ({
    constellation: 'well',
    name: 'Swift Laps',
    description: 'The Guild Hall\'s outputs come round sooner: its lap runs 8 minutes, then 6, then 5, from 10.',
    node: { x: 0.45, y: 0.62 },
    links: ['wishing_well'],
    ranks: [
        { tier: 0, price: prices[0], rules: [lapRule(1, -0.2)], lines: [] },
        { tier: 1, price: prices[1], rules: [lapRule(2, -0.4)], lines: [] },
        { tier: 2, price: prices[2], rules: [lapRule(3, -0.5)], lines: [] }
    ]
});

const { server, load } = await engine();
try {
    const base = await dataWorkspace(load);
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    // Start from a token price in each tier's usual material; the proposals replace it.
    let prices = [[{ itemId: 'item_oak_wood', quantity: 10 }], [{ itemId: 'item_cherry', quantity: 10 }], [{ itemId: 'item_trout', quantity: 10 }]];
    let rows = null;
    for (let round = 1; round <= 8; round++) {
        const ws = { ...base, hallStars: { ...base.hallStars, [ID]: { id: ID, ...star(prices) } } };
        const t0 = Date.now();
        rows = workspacePace(ws).hallPaybacks().filter(r => r.id === ID);
        const next = rows.map((r, i) => (r.proposed?.itemId ? [{ itemId: r.proposed.itemId, quantity: r.proposed.quantity }] : prices[i]));
        const changed = JSON.stringify(next) !== JSON.stringify(prices);
        console.log(`round ${round} (${Date.now() - t0} ms): ${rows.map(r => `r${r.rank} gain ${r.gain?.toFixed?.(4)} on ${r.work?.key ?? '—'} payback ${Number.isFinite(r.payback) ? r.payback.toFixed(2) + ' h' : r.payback} | proposed ${r.proposed ? `${r.proposed.quantity} ${r.proposed.itemId} (${Number.isFinite(r.proposed.payback) ? r.proposed.payback.toFixed(2) + ' h' : r.proposed.payback}${r.proposed.raised ? ', raised' : ''}${r.proposed.why ? ', ' + r.proposed.why : ''})` : '—'}`).join(' || ')}`);
        prices = next;
        if (!changed) break;
    }
    const value = star(prices);
    const words = ['Starter Camp', 'Plane 1', 'Plane 2'];
    const note = `Swift Laps, the drop lap's star at the Well, beside the Wishing Well: the Guild Hall's one lap (10 minutes from brief 390) runs 8, 6, then 5 minutes. ${rows.map((r, i) => `Rank ${r.rank} (${words[i]}): ${prices[i].map(p => `${p.quantity} ${p.itemId.replace(/^item_/, '').replace(/_/g, ' ')}`).join(', ')}, paying back in ${Number.isFinite(r.proposed?.payback) ? (r.proposed.payback < 1 ? `${Math.round(r.proposed.payback * 60)} min` : `${r.proposed.payback.toFixed(1)} h`) : '—'} on the Hall's outputs`).join('; ')}. Prices are the ledger's proposals (a preview, brief 290's rule).`;
    const pack = {
        format: 'fantasy-guild-change-pack',
        version: 1,
        id: PACK_ID,
        createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        asked: 'Brief 390 G5 (owner, 2026-11-03, detail pass item 10): drops run on one lap, 10 minutes by default, reduced to 5 by Guild Hall upgrades. The star: ranks 10, 8, 6, 5 minutes, in the Hall\'s own constellation, priced by the algorithm.',
        entries: [{ op: 'create', kind: 'hallStar', id: ID, value, note }]
    };
    fs.writeFileSync(`${PACK_ID}.json`, JSON.stringify(pack, null, 2) + '\n');
    console.log('written', `${PACK_ID}.json`, JSON.stringify(prices));
} finally {
    await server.close();
}
