// Loads the worktree's CMS ledger engine through Vite, as changePackTool does (scratch, never committed).
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
export const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/g5';
const cmsDir = path.join(WT, 'cms');
export async function engine() {
    const { createServer } = await import(pathToFileURL(path.join(WT, 'node_modules/vite/dist/node/index.js')).href);
    const server = await createServer({
        configFile: false, root: cmsDir, logLevel: 'error', appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    });
    const load = (p) => server.ssrLoadModule(p);
    return { server, load };
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** data/ with the plan, as changePackTool reads it when there is no newer autosave. */
export async function dataWorkspace(load) {
    const { workspaceFromDataFiles } = await load('/src/engine/changePacks.js');
    const data = path.join(WT, 'data');
    const opt = (name, fb) => (fs.existsSync(path.join(data, name)) ? readJson(path.join(data, name)) : fb);
    return workspaceFromDataFiles({
        items: readJson(path.join(data, 'items.json')), tokens: readJson(path.join(data, 'tokens.json')),
        effects: opt('effects.json', {}), tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null),
        skillPerks: opt('skillPerks.json', null), hallStars: opt('hallStars.json', null), world: opt('world.json', null),
        plan: readJson(path.join(WT, 'cms/plan/plan.json')),
    });
}
export async function withPack(load, ws, packFile) {
    const { applyPackInMemory } = await load('/src/engine/packGate.js');
    const r = applyPackInMemory(ws, readJson(packFile));
    return { ...ws, ...r.workspace };
}
const fmt = (h) => {
    if (h === null || h === undefined || !Number.isFinite(h)) return '—';
    const m = h * 60;
    if (m < 60) return `${Math.round(m)} min`;
    if (h < 48) return `${Math.floor(h)} h ${Math.round(m % 60)} min`;
    return `${(h / 24).toFixed(1)} d`;
};
export { fmt };
/** Stage times at Typical against budgets, the slowest of each, the Water supply and the Hall rows. */
export async function stagesOf(load, ws) {
    const { workspaceReport, workspacePace } = await load('/src/engine/ledgerReport.js');
    const { snapshotOf } = await load('/src/engine/ledgerCompare.js');
    const t0 = Date.now();
    const report = workspaceReport(ws);
    const snap = snapshotOf(report);
    const pace = report.pace;
    const rows = snap.stages.map((s) => {
        const st = pace.stageOf(s.tier);
        const off = s.hours === null ? null : (s.hours * 60) / (s.budgetHours * 60) - 1;
        return {
            tier: s.tier, label: s.label, hours: s.hours, budgetHours: s.budgetHours, offPct: off === null ? null : Math.round(off * 100),
            red: off !== null && Math.abs(off) > snap.tolerancePct / 100, entries: s.entries, untimed: s.untimed,
            slowest: st.slowest.map((x) => `${report.ledger.world.names.get(x.key) ?? x.key} ${fmt(x.hours)}`),
        };
    });
    return { rows, ms: Date.now() - t0, report, snap, pace };
}
