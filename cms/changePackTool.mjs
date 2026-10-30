#!/usr/bin/env node
/**
 * The agents' helper for change packs (format: cms/incoming/README.md).
 *
 *   node cms/changePackTool.mjs check <pack.json>
 *       Says whether the CMS will accept the pack, and why not.
 *   node cms/changePackTool.mjs stamp <pack.json> [--from <workspace.json>]
 *       Fills in the "fingerprint" of every edit and delete from the workspace the pack is made
 *       against: by default the newest CMS autosave (cms/backups/autosave_*.json), else data/.
 *       Overwrites the fingerprints already there, so stamp right after reading the values.
 *
 * Reads only; writes nothing but the pack file it was given.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validatePack, fingerprint, currentValue, workspaceFromDataFiles } from './src/engine/changePacks.js';

const cmsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(cmsDir, '..');

function newestAutosave() {
    const dir = path.join(cmsDir, 'backups');
    if (!fs.existsSync(dir)) return null;
    const saves = fs.readdirSync(dir)
        .filter((f) => f.startsWith('autosave_') && f.endsWith('.json'))
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t || b.f.localeCompare(a.f));
    return saves.length ? path.join(dir, saves[0].f) : null;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadWorkspace(from) {
    const file = from || newestAutosave();
    if (file) return { source: file, workspace: readJson(file) };
    const data = path.join(root, 'data');
    const opt = (name, fallback) => (fs.existsSync(path.join(data, name)) ? readJson(path.join(data, name)) : fallback);
    return {
        source: 'data/ (no CMS autosave found; the owner may have unsynced work)',
        workspace: workspaceFromDataFiles({
            items: readJson(path.join(data, 'items.json')),
            tokens: readJson(path.join(data, 'tokens.json')),
            effects: opt('effects.json', {}),
            tokenRecipes: opt('tokenRecipes.json', []),
            starterCamp: opt('starterCamp.json', null),
            // The plan is kept out of data/, beside it.
            plan: fs.existsSync(path.join(root, 'cms', 'plan', 'plan.json')) ? readJson(path.join(root, 'cms', 'plan', 'plan.json')) : null,
        }),
    };
}

const [cmd, file, ...rest] = process.argv.slice(2);
if (!['check', 'stamp'].includes(cmd) || !file) {
    console.log('Usage: node cms/changePackTool.mjs check|stamp <pack.json> [--from <workspace.json>]');
    process.exit(2);
}

let pack;
try {
    pack = readJson(file);
} catch (err) {
    console.error('Not valid JSON: ' + err.message);
    process.exit(1);
}

if (cmd === 'stamp') {
    const fromIdx = rest.indexOf('--from');
    const { source, workspace } = loadWorkspace(fromIdx !== -1 ? rest[fromIdx + 1] : null);
    let stamped = 0;
    for (const entry of pack.entries || []) {
        if (entry?.op !== 'edit' && entry?.op !== 'delete') continue;
        const current = currentValue(workspace, entry.kind, entry.id);
        if (!current) {
            console.warn(`Not in the workspace, left unstamped: ${entry.kind} ${entry.id}`);
            continue;
        }
        entry.fingerprint = fingerprint(current);
        stamped += 1;
    }
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
    console.log(`Stamped ${stamped} entr${stamped === 1 ? 'y' : 'ies'} against ${source}`);
}

const check = validatePack(pack, { fileName: path.basename(file) });
if (check.ok) {
    console.log(`OK: ${pack.entries.length} entr${pack.entries.length === 1 ? 'y' : 'ies'}, ready for review in the CMS.`);
} else {
    console.error('The CMS will refuse this pack:\n- ' + check.errors.join('\n- '));
    process.exit(1);
}
