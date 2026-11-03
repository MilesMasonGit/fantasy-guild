// What Sync's Recalculate would do to a workspace's derived numbers (XP a cycle, cycle times, prices),
// as useEntityStore.recalculateEconomy does, without the store. Writes the workspace with those numbers.
// Usage (from the worktree root): node docs/active/research/pending_packs/balancing_1/postsync.mjs <in ws.json> <out ws.json>
import fs from 'fs';
import path from 'path';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const { createServer } = await import('vite');
const server = await createServer({ configFile: false, root: path.join(WT, 'cms'), logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
    const { runSim } = await server.ssrLoadModule('/src/engine/sim/simRunner.js');
    const wb = await server.ssrLoadModule('/src/engine/sim/writeBack.js');
    const { splitPlanned } = await server.ssrLoadModule('/src/engine/planFile.js');
    const { expandAll } = await server.ssrLoadModule('/src/utils/constants.js');
    const ws = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const { live } = splitPlanned(ws);
    const state = { ...ws, ...live };
    const migrated = wb.migrateLegacyIntent(state);
    const expanded = expandAll(migrated.tokens, state.effects || {});
    const flatten = (pools) => { const out = {}; for (const [sk, pool] of Object.entries(pools || {})) (pool || []).forEach((r, i) => { const id = r.id || `pooled_${sk}_${i}`; out[id] = { ...r, id, skill: r.skill || sk }; }); return out; };
    const sim = runSim({ items: state.items, tokens: expanded, recipes: flatten(migrated.recipePools) });
    const changes = [];
    const out = JSON.parse(JSON.stringify(ws));
    for (const [id, t] of Object.entries(out.tokens)) {
        if (!t?.config) continue;
        const xp = sim.xp?.get(id); const ct = sim.cycleTimes.get(id);
        if (Number.isFinite(xp) && xp !== t.config.xp) { changes.push(`token ${t.name} xp ${t.config.xp} → ${xp}`); t.config.xp = xp; }
        if (Number.isFinite(ct) && ct !== t.config.cycleTimeMs) { changes.push(`token ${t.name} cycle ${t.config.cycleTimeMs} → ${ct}`); t.config.cycleTimeMs = ct; }
    }
    for (const pool of Object.values(out.recipePools)) for (const r of pool || []) {
        if (!r) continue;
        const xp = sim.xp?.get(r.id); const d = sim.cycleTimes.get(r.id);
        if (Number.isFinite(xp) && xp !== r.xp) { changes.push(`recipe ${r.name || r.id} xp ${r.xp} → ${xp}`); r.xp = xp; }
        if (Number.isFinite(d) && d !== r.durationMs) { changes.push(`recipe ${r.name || r.id} time ${r.durationMs} → ${d}`); r.durationMs = d; }
    }
    for (const [id, it] of Object.entries(out.items)) {
        if (!sim.values.has(id)) continue;
        const v = sim.values.get(id);
        if (v !== it.value) { changes.push(`item ${it.name} value ${it.value} → ${v}`); it.value = v; }
    }
    fs.writeFileSync(process.argv[3], JSON.stringify(out));
    console.log(`${changes.length} derived numbers change:\n` + changes.join('\n'));
} finally { await server.close(); }
process.exit(0);
