import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { readWorkspaceFile, saveWorkspaceFile, writeBackup, stamp, RevisionConflict, WORKSPACE_FILE } from './workspaceFile.js';
import { loadGameData, writeSync } from './gameData.js';
import { archivePack, packFilePath } from './changePackInbox.js';
import { validatePack, entryConflict } from './src/engine/changePacks.js';
import { emptySession, accept, force, finish } from './src/engine/packReview.js';
import { describeSyncDiff, SYNC_COLLECTIONS } from './src/engine/syncGuard.js';
import { PLAN_SYNC_KEY } from './src/engine/planFile.js';

/**
 * The CMS's command line (`npm run cms -- <command>`, entry `cli.mjs`): what the owner's CMS page
 * does to the workspace, without a browser. Every command reads and writes the same workspace file
 * the page does (`cms/workspace/workspace.json`), with the same revision guard, and runs the same
 * code the page runs: the change-pack review (`packReview.js`), Recalculate (`recalculate.js`) and
 * Sync's write (`gameData.js`).
 *
 * `load(modulePath)` loads a CMS module by its path under `cms/` (`/src/engine/recalculate.js`):
 * through Vite in `cli.mjs`, because the CMS's vocabulary reaches the game's registries, which use
 * Vite's own imports; by a plain import in the tests, which run under Vite already.
 */

export const USAGE = `Usage: npm run cms -- <command> [options]

  validate [--data[=<dir>]]       Check the workspace (or data/) against cms/schemas/. Exit 1 on errors.
  pack check <pack.json>          Will the CMS accept this change pack? Lists entries that conflict.
  pack apply <pack.json> [--yes]  Apply a pack to the workspace as the CMS's review does, and move it
                                  to applied/ beside it. Conflicts refuse it unless --yes.
  recalc [--all]                  Recalculate (the economic simulator) on the workspace and save it.
  sync [--confirm-removals] [--no-commit]
                                  Recalculate, then write data/ exactly as Sync to Game does, and
                                  commit only the files it wrote.
  restore                         Rebuild the workspace from data/ and cms/plan/plan.json (Restore
                                  from Game); the old one is kept in Backups first.

Options (every command):
  --workspace=<file>   the workspace (default cms/workspace/workspace.json)
  --data=<dir>         the game's files (default data/); the plan then sits in <dir>/../plan
  --plan=<dir>         the plan's folder (default cms/plan, or beside --data)
  --backups=<dir>      backups (default cms/backups, or beside --workspace)
  --sandbox=<dir>      a throwaway folder holding data/, plan/, workspace/ and backups/
`;

/** `--key=value` and `--flag` options, and the rest as words. */
export function parseArgs(argv) {
    const options = {};
    const words = [];
    for (const arg of argv) {
        const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
        if (m) options[m[1]] = m[2] === undefined ? true : m[2];
        else words.push(arg);
    }
    return { options, words };
}

const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Every folder and file a command touches, from the options; the project's own unless told otherwise. */
export function pathsFrom(options, root) {
    const sandbox = typeof options.sandbox === 'string' ? path.resolve(options.sandbox) : null;
    const realData = path.join(root, 'data');
    const realPlan = path.join(root, 'cms', 'plan');
    const realWorkspace = path.join(root, 'cms', 'workspace', WORKSPACE_FILE);
    const dataRoot = typeof options.data === 'string' ? path.resolve(options.data) : sandbox ? path.join(sandbox, 'data') : realData;
    const planRoot = typeof options.plan === 'string' ? path.resolve(options.plan)
        : sandbox ? path.join(sandbox, 'plan')
            : same(dataRoot, realData) ? realPlan : path.join(path.dirname(dataRoot), 'plan');
    const workspaceFile = typeof options.workspace === 'string' ? path.resolve(options.workspace) : sandbox ? path.join(sandbox, 'workspace', WORKSPACE_FILE) : realWorkspace;
    const backupsDir = typeof options.backups === 'string' ? path.resolve(options.backups)
        : sandbox ? path.join(sandbox, 'backups')
            : same(workspaceFile, realWorkspace) ? path.join(root, 'cms', 'backups') : path.join(path.dirname(workspaceFile), 'backups');
    // ⚠️ Only the project's own data/ and plan are committed: anything else is outside this repository's history.
    const ownProject = same(dataRoot, realData) && same(planRoot, realPlan);
    return { root, dataRoot, planRoot, workspaceFile, backupsDir, ownProject };
}

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const shortPath = (root, file) => {
    const rel = path.relative(root, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : file;
};

class CliError extends Error {
    constructor(message, code = 1) {
        super(message);
        this.code = code;
    }
}

function readDisk(paths) {
    let disk;
    try {
        disk = readWorkspaceFile(paths.workspaceFile);
    } catch (err) {
        throw new CliError(`The workspace file cannot be read: ${err.message}`);
    }
    return disk;
}

function requireDisk(paths) {
    const disk = readDisk(paths);
    if (!disk.exists) {
        throw new CliError(`No workspace at ${shortPath(paths.root, paths.workspaceFile)}. Start the CMS once (it moves the browser's workspace to disk), or run: npm run cms -- restore`);
    }
    return disk;
}

/** Save as the next revision; a write made meanwhile (the CMS page, another command) refuses it. */
function save(paths, disk, workspace, savedBy) {
    try {
        return saveWorkspaceFile(paths.workspaceFile, workspace, { baseRevision: disk.revision, savedBy });
    } catch (err) {
        if (err instanceof RevisionConflict) {
            throw new CliError(`The workspace changed while this ran (now revision ${err.diskRevision}, read at ${disk.revision}), so nothing was written. Run it again.`);
        }
        throw err;
    }
}

const counts = (ws) => {
    const recipes = Object.values(ws.recipePools || {}).reduce((n, pool) => n + (Array.isArray(pool) ? pool.length : 0), 0);
    return `${plural(Object.keys(ws.items || {}).length, 'item')}, ${plural(Object.keys(ws.tokens || {}).length, 'Token')}, ${plural(recipes, 'recipe')}, ${plural(Object.keys(ws.effects || {}).length, 'effect')}`;
};

/** The workspace's dials as the CMS's globals store holds them: every default, with the stored ones over it. */
async function dialsFor(load, disk) {
    const { DEFAULT_GLOBALS } = await load('/src/utils/constants.js');
    return { ...DEFAULT_GLOBALS.simDials, ...(disk.simDials || {}) };
}

/** Run Recalculate on the stored workspace, as the page would after loading it. */
async function recalculated(load, disk) {
    const { seedStoredWorkspace } = await load('/src/engine/workspaceSeeds.js');
    const { recalculateWorkspace } = await load('/src/engine/recalculate.js');
    const seeded = { ...disk.workspace, ...seedStoredWorkspace(disk.workspace) };
    const { workspace, report } = recalculateWorkspace(seeded, await dialsFor(load, disk));
    return { seeded, workspace, report };
}

function auditLines(report, { all = false } = {}) {
    const by = { Critical: [], Warning: [], Info: [] };
    for (const issue of report.auditIssues || []) (by[issue.severity] || (by[issue.severity] = [])).push(issue);
    const lines = [`Audit: ${by.Critical.length} critical, ${plural(by.Warning.length, 'warning')}, ${by.Info.length} info.`];
    const list = (title, rows, max) => {
        if (!rows.length || max === 0) return;
        lines.push(`${title}:`);
        for (const row of rows.slice(0, max)) lines.push(`- ${row.entityName}: ${row.details}`);
        if (rows.length > max) lines.push(`  and ${rows.length - max} more (--all lists them)`);
    };
    list('Critical', by.Critical, Infinity);
    list('Warnings', by.Warning, all ? Infinity : 30);
    if (all) list('Info', by.Info, Infinity);
    return lines;
}

async function cmdPackCheck(file, paths, out) {
    const pack = readPack(file);
    const check = validatePack(pack, { fileName: path.basename(file) });
    if (!check.ok) throw new CliError('The CMS will refuse this pack:\n- ' + check.errors.join('\n- '));
    out(`OK: ${plural(pack.entries.length, 'entry', 'entries')}, ready for review in the CMS.`);
    const disk = readDisk(paths);
    if (!disk.exists) {
        out(`No workspace at ${shortPath(paths.root, paths.workspaceFile)}, so conflicts were not checked.`);
        return 0;
    }
    const conflicts = conflictsOf(pack, disk.workspace);
    out(conflicts.length
        ? `Against ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}), ${plural(conflicts.length, 'entry conflicts', 'entries conflict')} (the owner decides them in review):\n${conflicts.map((c) => `- ${c}`).join('\n')}`
        : `No entry conflicts with ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}).`);
    return 0;
}

function readPack(file) {
    if (!file) throw new CliError('Name the pack file.', 2);
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        throw new CliError(`Not a readable JSON pack: ${err.message}`);
    }
}

function conflictsOf(pack, workspace) {
    return pack.entries.flatMap((entry, index) => {
        const check = entryConflict(workspace, entry);
        return check.conflict ? [`#${index + 1} ${entry.op} ${entry.kind} ${entry.id}: ${check.reason}`] : [];
    });
}

async function cmdPackApply(file, paths, options, load, out) {
    const pack = readPack(file);
    const check = validatePack(pack, { fileName: path.basename(file) });
    if (!check.ok) throw new CliError('The CMS will refuse this pack, so nothing was applied:\n- ' + check.errors.join('\n- '));
    const inbox = path.dirname(path.resolve(file));
    const name = path.basename(file);
    if (!packFilePath(inbox, name)) throw new CliError(`"${name}" is not a pack file name the archive takes (letters, digits, _ and -, ending .json), so nothing was applied.`);

    const disk = requireDisk(paths);
    const { seedStoredWorkspace } = await load('/src/engine/workspaceSeeds.js');
    const workspace = { ...disk.workspace, ...seedStoredWorkspace(disk.workspace) };

    // The review's own rules: an entry that conflicts stays pending until it is forced.
    let session = emptySession();
    const forced = [];
    const conflicts = [];
    pack.entries.forEach((entry, index) => {
        const conflict = entryConflict(workspace, entry);
        if (conflict.conflict) {
            conflicts.push(`#${index + 1} ${entry.op} ${entry.kind} ${entry.id}: ${conflict.reason}`);
            if (options.yes === true) {
                session = force(session, index);
                forced.push(index);
            }
        } else {
            session = accept(workspace, pack, session, index);
        }
    });
    if (conflicts.length && options.yes !== true) {
        throw new CliError(`Refused: ${plural(conflicts.length, 'entry conflicts', 'entries conflict')} with the workspace (it changed since the pack was made):\n${conflicts.map((c) => `- ${c}`).join('\n')}\nNothing was applied. Review it in the CMS, or run again with --yes to apply them anyway.`);
    }
    const result = finish(workspace, pack, session);
    if (result.blocked) {
        throw new CliError('The review refused to finish:\n' + result.blocked.map((b) => `- #${b.index + 1}: ${b.reason}`).join('\n'));
    }

    const saved = save(paths, disk, { ...workspace, ...result.workspace }, `cli: pack apply ${name}`);
    const archived = archivePack(inbox, name, result.record);
    const appliedCount = result.record.entries.filter((e) => e.applied).length;
    out(`Applied ${plural(appliedCount, 'entry', 'entries')}${forced.length ? ` (${forced.length} forced over a conflict)` : ''} to ${shortPath(paths.root, paths.workspaceFile)}, now revision ${saved.revision}.`);
    if (archived.status !== 200) {
        throw new CliError(`The changes are in the workspace, but the pack could not be moved to applied/: ${archived.body.error}`);
    }
    out(`The pack moved to ${shortPath(paths.root, path.join(inbox, 'applied', name))}, with its review record (undo it from the CMS's Changes page).`);
    return 0;
}

async function cmdRecalc(paths, options, load, out) {
    const disk = requireDisk(paths);
    const { workspace, report } = await recalculated(load, disk);
    const saved = save(paths, disk, workspace, 'cli: recalc');
    out(`Recalculated ${shortPath(paths.root, paths.workspaceFile)}, now revision ${saved.revision}: ${counts(workspace)}.`);
    for (const line of auditLines(report, { all: options.all === true })) out(line);
    return 0;
}

async function cmdSync(paths, options, load, out) {
    const disk = requireDisk(paths);
    const { syncFiles } = await load('/src/engine/recipeSync.js');
    const { balancedForSync } = await load('/src/engine/recalculate.js');
    // As the page does it: Recalculate first, and the workspace keeps the result whatever the Sync then does.
    const { workspace, report } = await recalculated(load, disk);
    const saved = save(paths, disk, workspace, 'cli: sync');
    out(`Recalculated ${shortPath(paths.root, paths.workspaceFile)}, now revision ${saved.revision}: ${counts(workspace)}.`);
    out(auditLines(report)[0]);

    const { [PLAN_SYNC_KEY]: plan, ...files } = syncFiles(balancedForSync(workspace, report));
    const commit = paths.ownProject && options['no-commit'] !== true ? { projectRoot: paths.root } : null;
    const { status, body } = await writeSync({
        files, plan: plan ?? null, confirmRemovals: options['confirm-removals'] === true,
        dataRoot: paths.dataRoot, planRoot: paths.planRoot, commit,
    });
    if (status === 409) {
        const lines = [`Refused: ${describeSyncDiff(body.diff)}`];
        for (const { key, plural: label } of SYNC_COLLECTIONS) {
            const removed = body.diff.removed[key] || [];
            if (removed.length) lines.push(`Removed ${label}: ${removed.map((r) => `${r.name} (${r.id})`).join(', ')}`);
        }
        lines.push('Nothing was written to data/. If the removals are meant, run again with --confirm-removals.');
        throw new CliError(lines.join('\n'));
    }
    if (status !== 200) throw new CliError(body.error || `Sync failed (${status})`);
    out(`Wrote ${plural(body.filesWritten.length, 'file')} to ${shortPath(paths.root, paths.dataRoot)}: ${body.filesWritten.join(', ')}.`);
    out(body.commit.committed ? `Committed as ${body.commit.sha}.` : `Not committed: ${body.commit.reason}.`);
    return 0;
}

async function cmdRestore(paths, load, out) {
    const disk = readDisk(paths);
    let data;
    try {
        data = loadGameData({ dataRoot: paths.dataRoot, planRoot: paths.planRoot });
    } catch (err) {
        throw new CliError(`The game's files cannot be read from ${paths.dataRoot}: ${err.message}`);
    }
    const { workspaceFromImport } = await load('/src/engine/workspaceSeeds.js');
    const workspace = workspaceFromImport(data);
    let backup = null;
    if (disk.exists) backup = writeBackup(paths.backupsDir, `before-restore_${stamp()}`, disk.workspace, disk.simDials);
    const saved = save(paths, disk, workspace, 'cli: restore');
    out(`Restored ${shortPath(paths.root, paths.workspaceFile)} (revision ${saved.revision}) from ${shortPath(paths.root, paths.dataRoot)} and ${shortPath(paths.root, path.join(paths.planRoot, 'plan.json'))}: ${counts(workspace)}.`);
    if (backup) out(`The workspace it replaced is in Backups as ${backup}.`);
    return 0;
}

async function cmdValidate(paths, options, out) {
    const { validateWorkspace, validateDataDir, reportLines } = await import('./schemaCheck.js');
    let result;
    if (options.data !== undefined) {
        result = validateDataDir(paths.dataRoot);
        out(`Checked ${shortPath(paths.root, paths.dataRoot)} against cms/schemas/.`);
    } else {
        const disk = requireDisk(paths);
        result = validateWorkspace(disk.workspace);
        out(`Checked ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}) against cms/schemas/.`);
    }
    for (const line of reportLines(result, { all: options.all === true })) out(line);
    return result.errors.length ? 1 : 0;
}

/**
 * Run one command. Returns the exit code: 0 done, 1 refused or failed (nothing half-written), 2 usage.
 * @param {string[]} argv the words after `cms`
 * @param {{ root: string, load: (p: string) => Promise<object>, out?: (s: string) => void, err?: (s: string) => void }} env
 */
export async function runCli(argv, { root, load, out = (s) => console.log(s), err = (s) => console.error(s) }) {
    const { options, words } = parseArgs(argv);
    const [command, sub, file] = words;
    const paths = pathsFrom(options, root);
    try {
        if (command === 'validate') return await cmdValidate(paths, options, out);
        if (command === 'pack' && sub === 'check') return await cmdPackCheck(file, paths, out);
        if (command === 'pack' && sub === 'apply') return await cmdPackApply(file, paths, options, load, out);
        if (command === 'recalc') return await cmdRecalc(paths, options, load, out);
        if (command === 'sync') return await cmdSync(paths, options, load, out);
        if (command === 'restore') return await cmdRestore(paths, load, out);
        err(USAGE);
        return 2;
    } catch (e) {
        if (e instanceof CliError) {
            err(e.message);
            return e.code;
        }
        throw e;
    }
}
