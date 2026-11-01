import fs from 'fs';
import { engine } from './lib.mjs';
const { server, load } = await engine();
try {
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    const { applyPackInMemory } = await load('/src/engine/packGate.js');
    const pack = JSON.parse(fs.readFileSync('pack/2026-10-30-hall-first-stars.json', 'utf8'));
    const before = JSON.parse(fs.readFileSync('ws_planned.json', 'utf8'));
    const pa = workspacePace({ ...before, ...applyPackInMemory(before, pack).workspace });
    const row = pa.hallPaybacks().find(r => r.id === 'star_mining_xp');
    console.log('row', row.priceHours, row.gain, row.payback, row.work.key);
    for (const tok of ['token_stone_outcrop', 'token_copper_ore_vein']) {
        const w = pa.works.find(x => x.target.token === tok);
        const p = pa.profiles.profileOf(w.target, 'typical', 0);
        console.log(tok, 'chosen:', p.chosen.map(c => `${c.kind}:${c.id} pb=${c.payback?.toFixed?.(1)}`).join(' | '));
        console.log('  offers', pa.profiles.offers(p.context, 0).filter(o => o.kind === 'hall').map(o => o.id + ' ' + JSON.stringify(o.price)).join(' '));
        const bare = pa.profiles.profileOf(w.target, 'bare', 0).rate;
        const baseXp = Object.values(bare.xp || {}).reduce((a, b) => a + b, 0);
        const r0 = pa.book.rateOf(w.target, p.setup);
        const r1 = pa.book.rateOf(w.target, { ...p.setup, hallRanks: { ...(p.setup.hallRanks || {}), star_mining_xp: 1 } });
        const v0 = pa.profiles.valueOf(r0, 0, baseXp, { gross: true, profile: 'typical' });
        const v1 = pa.profiles.valueOf(r1, 0, baseXp, { gross: true, profile: 'typical' });
        console.log('  v0', v0, 'v1', v1, 'saves', v1 / v0 - 1, 'baseXp', baseXp, 'setup', JSON.stringify(p.setup.hallRanks));
    }
} finally { await server.close(); }
