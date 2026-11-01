// Before/after the pack: walls per skill, each skill's track total at Typical, and the Hall ranks Typical buys per stage.
import fs from 'fs';
import { engine } from './lib.mjs';
const { server, load } = await engine();
const fmt = (h) => (h == null ? '-' : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);
try {
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    const { applyPackInMemory } = await load('/src/engine/packGate.js');
    const pack = JSON.parse(fs.readFileSync('pack/2026-10-30-hall-first-stars.json', 'utf8'));
    for (const which of ['planned', 'data']) {
        const before = JSON.parse(fs.readFileSync(`ws_${which}.json`, 'utf8'));
        const after = { ...before, ...applyPackInMemory(before, pack).workspace };
        const pb = workspacePace(before), pa = workspacePace(after);
        console.log(`\n===== ${which} =====`);
        for (const t of [0, 1, 2]) console.log(`stage ${t}: ${fmt(pb.stageOf(t).hours)} -> ${fmt(pa.stageOf(t).hours)}`);
        for (const skill of pa.skills()) {
            const wb = pb.walls(skill), wa = pa.walls(skill);
            const tb = pb.trackOf(skill), ta = pa.trackOf(skill);
            const last = (tr) => tr.levels.length ? tr.levels[tr.levels.length - 1].cumulative : null;
            const lb = last(tb), la = last(ta);
            console.log(`${skill.padEnd(12)} to L${tb.levels.length + 1}: typical ${fmt(lb?.typical)} -> ${fmt(la?.typical)} (maxed ${fmt(lb?.maxed)} -> ${fmt(la?.maxed)}) | walls ${wb.map(w => `L${w.from}-${w.to + 1} t${w.tier} ${fmt(w.hours)} x${w.worst.toFixed(1)}`).join(', ') || 'none'} -> ${wa.map(w => `L${w.from}-${w.to + 1} t${w.tier} ${fmt(w.hours)} x${w.worst.toFixed(1)}`).join(', ') || 'none'}`);
        }
        // Typical's Hall picks, per stage, over every work with a skill at or below that stage.
        for (const cap of [0, 1, 2]) {
            const picks = new Map();
            for (const w of pa.works) {
                if (w.tier === null || w.tier > cap) continue;
                const p = pa.profiles.profileOf(w.target, 'typical', cap);
                for (const [id, rank] of Object.entries(p.setup.hallRanks || {})) {
                    if (!id.startsWith('star_') || !(rank > 0)) continue;
                    picks.set(id, Math.max(picks.get(id) || 0, Number(rank)));
                }
            }
            const all = pa.hallPaybacks().filter(r => !r.builtIn && r.tier !== null && r.tier <= cap && r.rate);
            const offered = new Map(); for (const r of all) offered.set(r.id, Math.max(offered.get(r.id) || 0, r.rank));
            const missed = [...offered].filter(([id, r]) => (picks.get(id) || 0) < r).map(([id, r]) => `${id.replace('star_', '')} ${picks.get(id) || 0}/${r}`);
            console.log(`stage ${cap}: Typical holds ${[...picks].filter(([id]) => id.startsWith('star_')).length} authored stars: ${[...picks].map(([id, r]) => `${id.replace('star_', '')}:${r}`).join(' ')}`);
            console.log(`   offered but not taken (rate ranks): ${missed.join(', ') || 'none'}`);
        }
    }
} finally { await server.close(); }
