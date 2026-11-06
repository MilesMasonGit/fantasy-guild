// Loads the m4 worktree's CMS ledger engine through Vite, as changePackTool does.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
export const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/m4';
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
        skillPerks: opt('skillPerks.json', null), hallStars: opt('hallStars.json', null), world: opt('world.json', null),
        plan: readJson(path.join(WT, 'cms/plan/plan.json')),
    });
}
