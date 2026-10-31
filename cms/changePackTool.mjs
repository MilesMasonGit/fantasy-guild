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
 *   node cms/changePackTool.mjs gate <pack.json> [--from <workspace.json>] [--write]
 *       The agent gate (src/engine/packGate.js): applies the pack to the same workspace in memory,
 *       works the ledger out before and after, and says what moves. Exits 1 when the pack is
 *       blocked: it adds a Block finding, moves a stage beyond the tolerance undeclared ("intent"
 *       in the README), or adds a waiver. --write records the verdict in the pack as "gate".
 *
 * Reads only; writes nothing but the pack file it was given (stamp, and gate with --write).
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
            skillPerks: opt('skillPerks.json', null),
            // The plan is kept out of data/, beside it.
            plan: fs.existsSync(path.join(root, 'cms', 'plan', 'plan.json')) ? readJson(path.join(root, 'cms', 'plan', 'plan.json')) : null,
        }),
    };
}

/**
 * The ledger's engines through Vite, as the CMS runs them: they use Vite's own imports (the
 * calibration's bundled sources), which plain Node cannot load.
 */
async function gateEngine() {
    const { createServer } = await import('vite');
    const server = await createServer({
        configFile: false, root: cmsDir, logLevel: 'error', appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    });
    const jobs = await server.ssrLoadModule('/src/engine/ledgerJobs.js');
    const gate = await server.ssrLoadModule('/src/engine/packGate.js');
    const compare = await server.ssrLoadModule('/src/engine/ledgerCompare.js');
    return { server, jobs, gate, compare };
}

const [cmd, file, ...rest] = process.argv.slice(2);
if (!['check', 'stamp', 'gate'].includes(cmd) || !file) {
    console.log('Usage: node cms/changePackTool.mjs check|stamp|gate <pack.json> [--from <workspace.json>] [--write]');
    process.exit(2);
}
const fromIdx = rest.indexOf('--from');
const fromFile = fromIdx !== -1 ? rest[fromIdx + 1] : null;

let pack;
try {
    pack = readJson(file);
} catch (err) {
    console.error('Not valid JSON: ' + err.message);
    process.exit(1);
}

if (cmd === 'stamp') {
    const { source, workspace } = loadWorkspace(fromFile);
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
if (cmd === 'gate') {
    if (!check.ok) {
        console.error('Blocked: the CMS will refuse this pack:\n- ' + check.errors.join('\n- '));
        process.exit(1);
    }
    const { source, workspace } = loadWorkspace(fromFile);
    const engine = await gateEngine();
    let result;
    try {
        result = engine.gate.runGate(workspace, pack, engine.jobs.workspaceSnapshot);
    } finally {
        await engine.server.close();
    }
    const { moveText, stageMoveText } = engine.compare;
    const list = (title, lines) => { if (lines.length) console.log(`${title}\n${lines.map((l) => '- ' + l).join('\n')}`); };
    console.log(`${result.verdict === 'pass' ? 'PASS' : 'BLOCKED'}: ${result.summary}`);
    console.log(`Against ${source} (${result.workspaceFingerprint}).`);
    list('Why it is blocked:', result.blocks.map((b) => b.message));
    list('Stage times:', result.diff.stages.filter((s) => s.pct || s.lost).map(stageMoveText));
    list(`Moved entries (${result.diff.moved.length}, furthest first):`, result.diff.moved.slice(0, 15).map((m) => `${m.name}: ${moveText(m)}`)
        .concat(result.diff.moved.length > 15 ? [`and ${result.diff.moved.length - 15} more`] : []));
    list('Checks added:', result.diff.added.map((f) => `${f.severity}: ${f.name ? f.name + ': ' : ''}${f.message}`));
    list('Checks cleared:', result.diff.cleared.map((f) => `${f.severity}: ${f.name ? f.name + ': ' : ''}${f.message}`));
    list('Notes:', result.notes);
    if (rest.includes('--write')) {
        pack.gate = engine.gate.gateRecord(result);
        fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
        console.log('Written into the pack as "gate".');
    }
    process.exit(result.verdict === 'pass' ? 0 : 1);
}
if (check.ok) {
    console.log(`OK: ${pack.entries.length} entr${pack.entries.length === 1 ? 'y' : 'ies'}, ready for review in the CMS.`);
} else {
    console.error('The CMS will refuse this pack:\n- ' + check.errors.join('\n- '));
    process.exit(1);
}
