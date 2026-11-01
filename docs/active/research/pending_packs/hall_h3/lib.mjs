// Loads the worktree's CMS ledger engine through Vite, as changePackTool does.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
export const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/b1';
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
export async function dataWorkspace(load) {
    const { workspaceFromDataFiles } = await load('/src/engine/changePacks.js');
    const data = path.join(WT, 'data');
    const opt = (name, fb) => (fs.existsSync(path.join(data, name)) ? readJson(path.join(data, name)) : fb);
    return workspaceFromDataFiles({
        items: readJson(path.join(data, 'items.json')), tokens: readJson(path.join(data, 'tokens.json')),
        effects: opt('effects.json', {}), tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null),
        skillPerks: opt('skillPerks.json', null), hallStars: opt('hallStars.json', null), plan: null,
    });
}
export const MAIN_INCOMING = 'C:/Users/16048/Projects/fantasy_guild_v2/cms/incoming';
export async function plannedWorkspace(load) {
    const { applyPackInMemory } = await load('/src/engine/packGate.js');
    let ws = await dataWorkspace(load);
    const out = { conflicts: [] };
    for (const f of ['2026-10-30-ledger-first-fill.json', '2026-10-30-ledger-fix-pack.json']) {
        const pack = JSON.parse(fs.readFileSync(path.join(MAIN_INCOMING, f), 'utf8'));
        const r = applyPackInMemory(ws, pack);
        ws = { ...ws, ...r.workspace };
        out.conflicts.push([f, r.conflicts.length]);
    }
    out.workspace = ws;
    return out;
}
