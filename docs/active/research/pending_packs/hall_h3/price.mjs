// Prices the H3 sky from the ledger's proposals (iterated until they settle) and writes sky.json.
import fs from 'fs';
import { engine, plannedWorkspace, dataWorkspace } from './lib.mjs';
import { buildSky } from './build.mjs';
import { WELL } from './spec.mjs';
const which = process.argv[2] || 'planned';
const { server, load } = await engine();
const withId = (o) => Object.fromEntries(Object.entries(o).map(([id, v]) => [id, { ...v, id }]));
try {
    const base = which === 'planned' ? (await plannedWorkspace(load)).workspace : await dataWorkspace(load);
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    const pace0 = workspacePace(base);
    const wellStep = {};
    for (const w of WELL) {
        const s = pace0.supplyOf(w.item, 'bare', pace0.maxTier).perHour;
        wellStep[w.item] = Math.max(1, Math.round(s / 48));
    }
    console.log('well steps', JSON.stringify(wellStep));
    const sky = buildSky(wellStep);
    let rows = null;
    for (let round = 1; round <= 8; round++) {
        const ws = { ...base, hallConstellations: withId(sky.constellations), hallStars: withId(sky.stars) };
        const t0 = Date.now();
        const pace = workspacePace(ws);
        rows = pace.hallPaybacks().filter(r => !r.builtIn);
        const ms = Date.now() - t0;
        let changed = 0;
        // Rate ranks: the ledger's proposal.
        for (const r of rows) {
            if (!r.rate || !r.proposed?.itemId) continue;
            const price = [{ itemId: r.proposed.itemId, quantity: r.proposed.quantity }];
            const rank = sky.stars[r.id].ranks[r.rank - 1];
            if (JSON.stringify(rank.price) !== JSON.stringify(price)) { rank.price = price; changed++; }
        }
        // Rank-less proposals (no rate): priced like a sibling (see below).
        const prop = (id, rank) => rows.find(x => x.id === id && x.rank === rank)?.proposed;
        const skillIds = new Set(Object.keys(sky.constellations));
        const atTier = (tier) => rows.filter(x => x.rate && skillIds.has(sky.stars[x.id].constellation) && x.tier === tier && x.proposed?.itemId && x.proposed.pays).map(x => x.proposed).sort((a, b) => a.priceHours - b.priceHours);
        for (const [id, star] of Object.entries(sky.stars)) {
            star.ranks.forEach((rank, i) => {
                const row = rows.find(x => x.id === id && x.rank === i + 1);
                if (row?.rate) return;
                let p = null;
                if (/_camp_reach$/.test(id)) {
                    const skill = star.constellation;
                    p = prop(`star_${skill}_speed`, i + 1);
                } else {
                    const list = atTier(rank.tier);
                    p = list.length ? list[Math.floor((list.length - 1) / 2)] : null;
                }
                let q = p?.quantity;
                if (p?.itemId && i > 0 && star._hours?.[i - 1] > p.priceHours) q = Math.ceil(q * star._hours[i - 1] / p.priceHours / 10 ** Math.max(0, Math.floor(Math.log10(q * star._hours[i - 1] / p.priceHours)) - 1)) * 10 ** Math.max(0, Math.floor(Math.log10(q * star._hours[i - 1] / p.priceHours)) - 1);
                (star._hours ||= [])[i] = p?.itemId ? p.priceHours * q / p.quantity : 0;
                const price = p?.itemId ? [{ itemId: p.itemId, quantity: q }] : [];
                if (JSON.stringify(rank.price) !== JSON.stringify(price)) { rank.price = price; changed++; }
            });
        }
        console.log(`round ${round}: ${ms} ms, ${changed} prices changed`);
        if (!changed) break;
    }
    for (const st of Object.values(sky.stars)) delete st._hours;
    fs.writeFileSync(`sky_${which}.json`, JSON.stringify(sky, null, 2));
    fs.writeFileSync(`rows_${which}.json`, JSON.stringify(rows.map(r => ({ id: r.id, name: r.name, rank: r.rank, tier: r.tier, cap: r.cap, rate: r.rate, gain: r.gain, work: r.work?.key, payback: r.payback, pays: r.pays, price: r.priceText, priceHours: r.priceHours, proposed: r.proposed && { itemId: r.proposed.itemId, quantity: r.proposed.quantity, payback: r.proposed.payback, pays: r.proposed.pays, raised: r.proposed.raised, why: r.proposed.why } })), null, 2));
    for (const r of rows) console.log(`${r.id} r${r.rank} t${r.tier} ${r.rate ? `gain ${r.gain?.toFixed(4)} on ${r.work?.key?.slice(0, 40)} pay ${Number.isFinite(r.payback) ? r.payback.toFixed(1) + 'h' : r.payback} ${r.pays ? 'ok' : 'RED'}` : 'no rate'} | ${r.priceText}${r.proposed?.raised ? ' (raised)' : ''}${r.proposed?.why ? ' WHY ' + r.proposed.why : ''}`);
} finally { await server.close(); }
