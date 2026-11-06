// Prices the ring stars from the ledger's proposals (iterated until they settle), and reports the
// rings and stages before (no ring stars) and after. Writes prices.json.
import fs from 'fs';
import { engine, dataWorkspace } from './lib.mjs';
import { skyWith, RINGS, CONSTELLATION } from './spec.mjs';

const { server, load } = await engine();
const fmt = (h) => (Number.isFinite(h) ? (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(2)} h` : `${(h / 24).toFixed(2)} d`) : 'never');
try {
    const base = await dataWorkspace(load);
    const { workspacePace, workspaceLedger } = await load('/src/engine/ledgerReport.js');
    const withSky = (sky) => ({
        ...base,
        hallConstellations: { ...(base.hallConstellations || {}), ...sky.constellations },
        hallStars: { ...(base.hallStars || {}), ...sky.stars },
    });
    const report = (label, ws) => {
        const t0 = Date.now();
        const pace = workspacePace(ws);
        const ms = Date.now() - t0;
        console.log(`\n== ${label} (pace ${ms} ms)`);
        for (const ring of [2, 3]) for (const line of ["arcane","crops","herbs","ores","trees","waters"]) { const k = `wedge:${line}:${ring}`; const r = pace.pathOf(k, "typical"); console.log(`   ${k} ${fmt(r.hours)}${r.complete ? "" : " (floor)"}`); }
        for (const ring of [1, 2, 3]) {
            const o = pace.ringOpensAt(ring);
            const steps = o.key ? pace.pathOf(o.key, 'typical').steps.slice(0, 4).map(s => `${s.key}@${fmt(s.hours)}${s.waitsOn?.skill ? `(waits ${s.waitsOn.skill} ${s.waitsOn.level})` : s.waitsOn?.need ? `(waits ${s.waitsOn.need})` : ''}`).join(' <- ') : '';
            console.log(`ring ${ring} first settled ${fmt(o.hours)} via ${o.key}   ${steps}`);
        }
        for (const t of [0, 1, 2, 3]) {
            const s = pace.stageOf(t);
            console.log(`stage ${t}: ${fmt(s.hours)} budget ${s.budgetMinutes ?? '-'} min; slowest ${s.slowest.slice(0, 3).map(x => `${x.key} ${fmt(x.hours)}`).join(' | ')}`);
        }
        const f = pace.findings().filter(x => x.check === 'ring-open' || x.check === 'stage-budget');
        for (const x of f) console.log(`  [${x.check}] ${x.message}`);
        return pace;
    };

    report('before: today, no ring stars', base);

    let prices = {};
    let rows = null;
    for (let round = 1; round <= 6; round++) {
        const ws = withSky(skyWith(prices));
        const pace = workspacePace(ws);
        rows = pace.hallPaybacks().filter(r => r.ring);
        let changed = 0;
        for (const r of rows) {
            const p = r.proposed;
            if (!p?.itemId) continue;
            const price = [{ itemId: p.itemId, quantity: p.quantity }];
            if (JSON.stringify(prices[r.id]) !== JSON.stringify(price)) { prices[r.id] = price; changed++; }
        }
        console.log(`round ${round}: ${changed} changed`);
        if (!changed) break;
    }
    for (const r of rows) {
        console.log(`${r.id} ring ${r.ring} tier ${r.tier}: lit ${fmt(r.litAt)}, ring opens ${fmt(r.opensAt)}, budget ${fmt(r.budgetHours ?? NaN)} | price ${r.priceText} (${fmt(r.priceHours)}) | proposed ${r.proposed.why || `${r.proposed.priceText}, start ${fmt(r.proposed.start)}, lit ${fmt(r.proposed.litAt)}`}`);
    }
    fs.writeFileSync('prices.json', JSON.stringify(prices, null, 2));
    report('after: the ring stars at the proposed prices (wild rings unpriced)', withSky(skyWith(prices)));
} finally { await server.close(); }
