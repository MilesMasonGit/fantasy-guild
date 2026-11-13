/**
 * Which workspace changePackTool reads when it is not told one with --from.
 */
import fs from 'fs';
import path from 'path';
import { workspaceFromDataFiles } from './src/engine/changePacks.js';
import { isWorkspaceFile, WORKSPACE_FILE } from './workspaceFile.js';

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function newestAutosave(root) {
    const dir = path.join(root, 'cms', 'backups');
    if (!fs.existsSync(dir)) return null;
    const saves = fs.readdirSync(dir)
        .filter((f) => f.startsWith('autosave_') && f.endsWith('.json'))
        .map((f) => ({ file: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t || b.file.localeCompare(a.file));
    return saves[0] || null;
}

/** The newest file anywhere under data/ (a Sync rewrites them), as { file, t }. */
function newestDataFile(root) {
    let newest = null;
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else {
                const t = fs.statSync(full).mtimeMs;
                if (!newest || t > newest.t) newest = { file: full, t };
            }
        }
    };
    walk(path.join(root, 'data'));
    return newest;
}

const when = (t) => new Date(t).toLocaleString('en-CA', { hour12: false });

/** The CMS workspace on disk (`cms/workspace/workspace.json`), the owner's authoritative copy. */
export function diskWorkspacePath(root) {
    return path.join(root, 'cms', 'workspace', WORKSPACE_FILE);
}

/**
 * { file, kind: 'from' | 'disk' | 'autosave' | 'data', reason }. The workspace on disk wins whenever
 * it exists: the CMS writes it a second after every edit. Without it (a checkout whose CMS never
 * started since the move to disk), the newest autosave or data/. ⚠️ An autosave older than data/ is
 * stale: the owner has Synced since, so judging a pack against it reports content it cannot see.
 */
export function chooseWorkspace(root, from) {
    if (from) return { file: from, kind: 'from', reason: 'named with --from' };
    const disk = diskWorkspacePath(root);
    if (fs.existsSync(disk)) return { file: disk, kind: 'disk', reason: "it is the CMS workspace on disk, with the owner's unsynced work" };
    const save = newestAutosave(root);
    if (!save) return { file: null, kind: 'data', reason: 'no CMS autosave was found (the owner may have unsynced work)' };
    const data = newestDataFile(root);
    const saveName = path.basename(save.file);
    if (data && data.t > save.t) {
        return {
            file: null, kind: 'data',
            reason: `data/${path.relative(path.join(root, 'data'), data.file).split(path.sep).join('/')} (${when(data.t)}) is newer than the newest autosave, ${saveName} (${when(save.t)})`,
        };
    }
    return { file: save.file, kind: 'autosave', reason: `it (${when(save.t)}) is newer than data/${data ? ` (${when(data.t)})` : ''}, so it holds the owner's unsynced work` };
}

export function loadWorkspace(root, from) {
    const choice = chooseWorkspace(root, from);
    if (choice.file) {
        const read = readJson(choice.file);
        // A workspace file carries its collections under `workspace`; a backup or autosave is the collections themselves.
        return { ...choice, source: `${choice.file}, since ${choice.reason}`, workspace: isWorkspaceFile(read) ? read.workspace : read };
    }
    const data = path.join(root, 'data');
    const opt = (name, fallback) => (fs.existsSync(path.join(data, name)) ? readJson(path.join(data, name)) : fallback);
    const planFile = path.join(root, 'cms', 'plan', 'plan.json');
    return {
        ...choice,
        source: `data/ and cms/plan/plan.json, since ${choice.reason}`,
        workspace: workspaceFromDataFiles({
            items: readJson(path.join(data, 'items.json')),
            tokens: readJson(path.join(data, 'tokens.json')),
            effects: opt('effects.json', {}),
            tokenRecipes: opt('tokenRecipes.json', []),
            starterCamp: opt('starterCamp.json', null),
            skillPerks: opt('skillPerks.json', null),
            hallStars: opt('hallStars.json', null),
            world: opt('world.json', null),
            events: opt('events.json', null),
            // The plan is kept out of data/, beside it.
            plan: fs.existsSync(planFile) ? readJson(planFile) : null,
        }),
    };
}
