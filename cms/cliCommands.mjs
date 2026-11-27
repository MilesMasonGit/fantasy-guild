import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { readWorkspaceFile, saveWorkspaceFile, writeBackup, stamp, RevisionConflict, WORKSPACE_FILE } from './workspaceFile.js';
import { loadGameData, writeSync } from './gameData.js';
import { archivePack, packFilePath } from './changePackInbox.js';
import { createRequire } from 'module';
import { validatePack, entryConflict } from './src/engine/changePacks.js';
import { writeNumberPack, writeLiveNumberPack, solverRows, unclearText } from './src/engine/numberPack.js';
import { emptySession, accept, force, finish } from './src/engine/packReview.js';
import { describeSyncDiff, SYNC_COLLECTIONS } from './src/engine/syncGuard.js';
import { PLAN_SYNC_KEY } from './src/engine/planFile.js';
import { RENAMES_SYNC_KEY, settleSyncedRenames } from './src/engine/renames.js';

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
  pack numbers --out=<pack.json> [--rows=<solved.json>] [--dials=<dials.json>] [--unclear=<file>]
                                  The number pack writer: the balance solver's rows onto the plan's
                                  Planned entries, as a change pack written to --out (never into
                                  cms/incoming/). A made item gets a Planned recipe, a gathering
                                  Token its cycle, a crop its numbers: level, seconds (pinned, so
                                  Recalculate keeps them), XP, inputs with counts, what a craft
                                  makes, pinned (a gather's yield stays the content's). Everything stays
                                  Planned. --rows reads
                                  a solver output ({ rows } or a list); without it the solver runs
                                  on docs/active/content_catalogue.json (with --dials). Entries with
                                  no clear recipe or Token cycle are listed for the content session
                                  (and written to --unclear), never guessed. Reads the workspace,
                                  never saves it; a worktree reads the main checkout's.
                                  A gathering Token also gets its uses and rest by the rest rule:
                                  an end chance a cycle for about 30 s of work, a 30 s refill; a
                                  regrowing tree's Stump grows back in 30 s; a refill that needs its
                                  owner gets the chance only, and is listed. A Token's plan.split
                                  gives its outputs, one line each.
  pack numbers --live --out=<pack.json> [--ids=<ids.json>] [--catalogue=<catalogue.json>] ...
                                  The same for the Live recipes and gathering Tokens the id map
                                  (default docs/active/content_cms_ids.json) matches to the
                                  catalogue (default docs/active/content_catalogue.json): edits with
                                  level, time and XP (both pinned, so Recalculate keeps them), input
                                  counts and a craft's count (outputs it writes pinned too), uses
                                  and rest. A build or Dig recipe follows the Token it places and an
                                  offering its shrine (skipped: no timed work); each Bait recipe
                                  unlocks at its fish's level, timed as a prepare step there by the
                                  solver's rule (with --dials). A Live entry with no match, other
                                  ingredients or another output than the catalogue's is listed,
                                  never guessed. Its own pack.
  pack boosts --out=<pack.json> [--unclear=<file>]
                                  The boosts pack writer: every effect statement that moves work
                                  time, XP, yield or doubles, rare finds or regrowth, sized by its
                                  source (BALANCE_RULES section 5): a placed building 5 % speed,
                                  +2.5 % XP, +50 % yield, +12.5 % rare finds, 10 % regrowth (the
                                  coin building +10 %); a station's own upgrade 5 % a step; a
                                  skill's speed perks a quarter of the tier's speed total; a Guild
                                  Hall star 10 % of its kind over its ranks; the one consumable
                                  (a speed drink a quarter of its tier's speed total, an XP one the
                                  tier's XP total, yield +10 to +50 % by tier, rare +100 or +200 %); a
                                  camp variant's own boost and a station's own XP or yield step one
                                  building's worth; a yield perk five times a speed perk's slice.
                                  World events, bonus drops and mastery are left unsized (skipped);
                                  tools, worn gear and XP perks go to <id>-needs-effect.txt. Tier totals are
                                  the ledger's boost budget (Maxed). Only the number moves. What
                                  fits no source or mixes kinds is listed (and written to
                                  --unclear, else <id>-unclear.txt beside the pack), never guessed. Written to --out (never into
                                  cms/incoming/); reads the workspace, never saves it.
  recalc [--all]                  Recalculate (the economic simulator) on the workspace and save it.
  sync [--confirm-removals] [--no-commit]
                                  Recalculate, then write data/ exactly as Sync to Game does, and
                                  commit only the files it wrote.
  restore                         Rebuild the workspace from data/ and cms/plan/plan.json (Restore
                                  from Game); the old one is kept in Backups first.
  ledger [--json=<file>] [--one-layout] [--with-planned]
                                  The ledger's read-out, for the balancer: each skill's pace (levels 1
                                  to 99, hero and guild time) at Maxed (opt), Typical (typ) and Bare
                                  (bare), each entry's numbers and arrival, Planned entries marked,
                                  the boost budget and the ledger's checks. Reads the workspace,
                                  never saves it; a worktree with no workspace of its own reads the
                                  main checkout's. --json writes the whole read-out; a summary
                                  prints either way. Both layouts are timed (a camp's sparse and
                                  dense nodes); --one-layout times only the pace's, about half the time.
                                  --with-planned times Planned work as if it were live (in the
                                  read-out only: every Planned row still marked Planned, nothing
                                  saved); without it the read-out times nothing Planned.

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

    const { [PLAN_SYNC_KEY]: plan, [RENAMES_SYNC_KEY]: renames, ...files } = syncFiles(balancedForSync(workspace, report));
    const commit = paths.ownProject && options['no-commit'] !== true ? { projectRoot: paths.root } : null;
    const { status, body } = await writeSync({
        files, plan: plan ?? null, renames: renames ?? null, confirmRemovals: options['confirm-removals'] === true,
        dataRoot: paths.dataRoot, planRoot: paths.planRoot, commit,
        // The command line reads the disk workspace itself, so it is never stale; off main it warns instead of refusing.
        branchRule: 'warn',
    });
    if (status === 409 && body.needsConfirm) {
        const lines = [`Refused: ${describeSyncDiff(body.diff)}`];
        for (const { key, plural: label } of SYNC_COLLECTIONS) {
            const removed = body.diff.removed[key] || [];
            if (removed.length) lines.push(`Removed ${label}: ${removed.map((r) => `${r.name} (${r.id})`).join(', ')}`);
            const changed = body.diff.changed?.[key] || [];
            if (changed.length) lines.push(`Changed ${label}: ${changed.map((r) => `${r.name} (${r.id})`).join(', ')}`);
            const renamed = body.diff.renamed?.[key] || [];
            if (renamed.length) lines.push(`Renamed ${label}: ${renamed.map((r) => `${r.name} (${r.id}) to ${r.toName} (${r.to})`).join(', ')}`);
        }
        lines.push('Nothing was written to data/. If the removals are meant, run again with --confirm-removals.');
        throw new CliError(lines.join('\n'));
    }
    if (status !== 200) throw new CliError(body.error || `Sync failed (${status})`);
    if (body.warning) out(`Warning: ${body.warning}`);
    out(`Wrote ${plural(body.filesWritten.length, 'file')} to ${shortPath(paths.root, paths.dataRoot)}: ${body.filesWritten.join(', ')}.`);
    out(body.commit.committed ? `Committed as ${body.commit.sha}.` : `Not committed: ${body.commit.reason}.`);
    if (renames) {
        // The renames are the data's now: the workspace's record starts again from the ids just written.
        const settled = save(paths, saved, { ...workspace, renames: settleSyncedRenames(workspace.renames, renames) }, 'cli: sync');
        out(`The workspace's record of renames now starts from this Sync (revision ${settled.revision}).`);
    }
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

/**
 * The main checkout's workspace file for a git worktree (its `.git` a file naming
 * `<main>/.git/worktrees/<name>`), else null. A worktree holds no workspace of its own.
 */
function mainCheckoutWorkspace(root) {
    let text;
    try {
        text = fs.readFileSync(path.join(root, '.git'), 'utf8');
    } catch {
        return null;
    }
    const m = /^gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/][^\\/]+\s*$/m.exec(text);
    return m ? path.join(path.resolve(m[1]), 'cms', 'workspace', WORKSPACE_FILE) : null;
}

async function cmdLedger(paths, options, load, out) {
    if (options.json === true) throw new CliError('Name the file: --json=<file>.', 2);
    // Read-only, so a worktree with no workspace of its own reads the main checkout's (never for a command that writes).
    const asked = typeof options.workspace === 'string' || typeof options.sandbox === 'string';
    let fromMain = false;
    if (!asked && !readDisk(paths).exists) {
        const main = mainCheckoutWorkspace(paths.root);
        if (main && fs.existsSync(main)) {
            paths = { ...paths, workspaceFile: main };
            fromMain = true;
        }
    }
    const disk = requireDisk(paths);
    if (fromMain) out(`This is a worktree with no workspace of its own: reading the main checkout's workspace, ${paths.workspaceFile}.`);
    const { seedStoredWorkspace } = await load('/src/engine/workspaceSeeds.js');
    const { ledgerReadout, readoutText } = await load('/src/engine/ledgerReadout.js');
    // As the page reads it: the stored workspace seeded, nothing recalculated, nothing saved.
    const workspace = { ...disk.workspace, ...seedStoredWorkspace(disk.workspace) };
    const readout = ledgerReadout(workspace, { layouts: options['one-layout'] !== true, withPlanned: options['with-planned'] === true });
    readout.workspace = { file: shortPath(paths.root, paths.workspaceFile), revision: disk.revision, savedAt: disk.savedAt ?? null };
    out(`The ledger of ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}), worked out in ${(readout.ms / 1000).toFixed(1)} s. opt is the ledger's Maxed player (the curve's), typ its Typical, bare its Bare.`);
    for (const line of readoutText(readout)) out(line);
    if (typeof options.json === 'string') {
        const file = path.resolve(options.json);
        fs.writeFileSync(file, JSON.stringify(readout, null, 2) + '\n');
        out(`The whole read-out written to ${shortPath(paths.root, file)}.`);
    }
    return 0;
}

const SOLVER = ['.claude', 'skills', 'balancer', 'balance_solver.cjs'];
const CATALOGUE = ['docs', 'active', 'content_catalogue.json'];
const ID_MAP = ['docs', 'active', 'content_cms_ids.json'];

function readJsonFile(file, what) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        throw new CliError(`The ${what} cannot be read (${shortPath(process.cwd(), file)}): ${err.message}`);
    }
}

/** The solver's own prepare rule (`timeStep` at `'prepare'`) with the dials given (--dials, else its own): what times a Bait recipe. */
function prepareStepFor(paths, options) {
    const solver = createRequire(import.meta.url)(path.join(paths.root, ...SOLVER));
    const dials = typeof options.dials === 'string' ? readJsonFile(path.resolve(options.dials), 'dials file') : {};
    const rules = solver.make(dials);
    return (level, xpLevel) => solver.timeStep(rules, 'prepare', level, xpLevel);
}

/** The solver's rows: a file of them (--rows), or the solver run on the content catalogue with the dials given. */
function rowsFor(paths, options, out) {
    if (typeof options.rows === 'string') {
        const file = path.resolve(options.rows);
        let rows;
        try {
            rows = solverRows(readJsonFile(file, 'solver output'));
        } catch (err) {
            throw err instanceof CliError ? err : new CliError(err.message);
        }
        out(`The solver's rows from ${shortPath(paths.root, file)}: ${plural(rows.length, 'row')}.`);
        return rows;
    }
    const solver = createRequire(import.meta.url)(path.join(paths.root, ...SOLVER));
    const catalogue = readJsonFile(path.join(paths.root, ...CATALOGUE), 'content catalogue');
    const dials = typeof options.dials === 'string' ? readJsonFile(path.resolve(options.dials), 'dials file') : {};
    const rows = solver.solve(catalogue.entries, dials).rows;
    out(`The solver run on ${CATALOGUE.join('/')}${typeof options.dials === 'string' ? ` with the dials in ${shortPath(paths.root, path.resolve(options.dials))}` : ' with its own dials'}: ${plural(rows.length, 'row')}.`);
    return rows;
}

/** The pack a writer is asked for (--out): its file and id, never in the CMS's inbox. */
function packTargetOf(paths, options) {
    if (typeof options.out !== 'string') throw new CliError('Name the pack to write: --out=<pack.json> (a scratch folder; the balancer copies it to cms/incoming/ once it passes).', 2);
    const file = path.resolve(options.out);
    const inbox = path.join(paths.root, 'cms', 'incoming');
    if (same(path.dirname(file), inbox) || same(path.dirname(path.dirname(file)), inbox)) {
        throw new CliError(`Refused: ${shortPath(paths.root, file)} is in the CMS's inbox. Write the pack to a scratch folder, check it, and copy it to cms/incoming/ once it passes.`);
    }
    const id = path.basename(file).replace(/\.json$/i, '');
    if (!/\.json$/i.test(file) || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) {
        throw new CliError(`The pack's file name is its id: letters, digits, _ and -, ending .json (not ${path.basename(file)}).`, 2);
    }
    return { file, id };
}

/** The paths a read-only command reads: a worktree with no workspace of its own reads the main checkout's. */
function readOnlyPaths(paths, options, out) {
    const asked = typeof options.workspace === 'string' || typeof options.sandbox === 'string';
    if (!asked && !readDisk(paths).exists) {
        const main = mainCheckoutWorkspace(paths.root);
        if (main && fs.existsSync(main)) {
            out(`This is a worktree with no workspace of its own: reading the main checkout's workspace, ${main}.`);
            return { ...paths, workspaceFile: main };
        }
    }
    return paths;
}

async function cmdPackNumbers(paths, options, out) {
    const { file, id } = packTargetOf(paths, options);
    paths = readOnlyPaths(paths, options, out);
    const disk = requireDisk(paths);
    const rows = rowsFor(paths, options, out);
    const live = options.live === true;
    let result;
    if (live) {
        const idsFile = typeof options.ids === 'string' ? path.resolve(options.ids) : path.join(paths.root, ...ID_MAP);
        const catalogueFile = typeof options.catalogue === 'string' ? path.resolve(options.catalogue) : path.join(paths.root, ...CATALOGUE);
        try {
            result = writeLiveNumberPack(disk.workspace, rows, { id, ids: readJsonFile(idsFile, 'id map'), catalogue: readJsonFile(catalogueFile, 'content catalogue'), prepareStep: prepareStepFor(paths, options) });
        } catch (err) {
            throw err instanceof CliError ? err : new CliError(err.message);
        }
        out(`Live mode: the Live recipes and gathering Tokens ${shortPath(paths.root, idsFile)} matches to ${shortPath(paths.root, catalogueFile)}.`);
        out(`  Bait recipes are timed as a prepare step by the solver's rule at their fish's level, ${typeof options.dials === 'string' ? `with the dials in ${shortPath(paths.root, path.resolve(options.dials))}` : 'with its own dials'}.`);
    } else {
        result = writeNumberPack(disk.workspace, rows, { id });
    }
    const { pack, filled, unclear, skipped, restUnclear, stumps = [] } = result;
    out(`Against ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}), never saved: ${plural(filled.length, 'entry', 'entries')} written, ${unclear.length} unclear, ${skipped.length} skipped.`);
    const tagged = filled.filter((f) => f.tagged).length;
    if (tagged) out(`  ${plural(tagged, 'edit')} on a record with a Tempo and a Purpose: Recalculate keeps its pinned time and XP.`);
    if (stumps.length) out(`  ${plural(stumps.length, 'Stump')} given its tree's rest, back in ${stumps[0].afterMs / 1000} s: ${stumps.map((x) => x.name).join(', ')}.`);
    const reasons = new Map();
    for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) || 0) + 1);
    for (const [reason, n] of reasons) out(`  skipped ${n}: ${reason}`);
    if (unclear.length) {
        out('Unclear, for the content session (not written):');
        for (const line of unclearText(unclear)) out(line);
    }
    if (restUnclear.length) {
        out(`Uses and rest not written in full (${restUnclear.length}):`);
        for (const line of unclearText(restUnclear)) out(line);
    }
    if (typeof options.unclear === 'string') {
        const listFile = path.resolve(options.unclear);
        const head = live ? 'Live entries with no clear match to the catalogue, for the content session:' : 'Planned entries with no clear recipe or Token cycle, for the content session:';
        fs.writeFileSync(listFile, [head, ...unclearText(unclear), '', 'Gathering Tokens whose uses and rest are not written in full (the rest rule):', ...unclearText(restUnclear), ''].join('\n'));
        out(`The unclear list written to ${shortPath(paths.root, listFile)}.`);
    }
    if (!pack) {
        out(`Nothing to write: no ${live ? 'Live' : 'Planned'} entry has numbers from the solver.`);
        return 0;
    }
    const check = validatePack(pack, { fileName: path.basename(file) });
    if (!check.ok) throw new CliError('The pack came out malformed, so it was not written:\n- ' + check.errors.join('\n- '));
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
    out(`The pack written to ${shortPath(paths.root, file)}: ${plural(pack.entries.length, 'entry', 'entries')} (${pack.entries.filter((e) => e.op === 'create').length} new ${live ? '' : 'Planned '}recipes, ${pack.entries.filter((e) => e.op === 'edit').length} edits). Check it with: npm run cms -- pack check ${shortPath(paths.root, file)}`);
    return 0;
}

async function cmdPackBoosts(paths, options, load, out) {
    const { file, id } = packTargetOf(paths, options);
    paths = readOnlyPaths(paths, options, out);
    const disk = requireDisk(paths);
    const { seedStoredWorkspace } = await load('/src/engine/workspaceSeeds.js');
    const { writeBoostPack, boostLines } = await load('/src/engine/boostPack.js');
    const workspace = { ...disk.workspace, ...seedStoredWorkspace(disk.workspace) };
    // An item whose plan names no tier takes the tier the ledger first reaches it at, as the ledger's budget check does.
    let tierOf = null;
    try {
        const { workspaceLedger } = await load('/src/engine/ledgerReport.js');
        const reach = workspaceLedger(workspace).reach;
        tierOf = (kind, entryId) => reach.get(`${kind}:${entryId}`)?.tier ?? null;
    } catch (err) {
        out(`The ledger could not be built (${err.message}): an item with no plan tier is listed as unclear.`);
    }
    const result = writeBoostPack(workspace, { id, tierOf });
    const { pack, filled, unclear, skipped, needsEffect, notes } = result;
    const moved = filled.filter((f) => f.from !== f.to).length;
    out(`Against ${shortPath(paths.root, paths.workspaceFile)} (revision ${disk.revision}), never saved: ${plural(filled.length, 'statement')} written (${moved} moved, ${filled.length - moved} at the rule already), ${unclear.length} unclear, ${needsEffect.length} needing another effect, ${skipped.length} skipped.`);
    out(`  Tiers: ${result.tierSource}.`);
    const reasons = new Map();
    for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) || 0) + 1);
    for (const [reason, n] of reasons) out(`  skipped ${n}: ${reason}`);
    for (const note of notes) out(`  ${note}`);
    if (moved) {
        out('Written:');
        for (const line of boostLines(filled.filter((f) => f.from !== f.to), { written: true })) out(line);
    }
    if (unclear.length) {
        out('Unclear (not written): mapping doubts for the content session, number doubts for the balancer:');
        for (const line of boostLines(unclear)) out(line);
    }
    {
        // Always written: beside the pack unless --unclear names another file.
        const listFile = typeof options.unclear === 'string' ? path.resolve(options.unclear) : path.join(path.dirname(file), `${id}-unclear.txt`);
        fs.writeFileSync(listFile, ['Boost statements the rule could not size, left as they are:', ...boostLines(unclear), '', 'Skipped:', ...boostLines(skipped), '', ...notes, ''].join('\n'));
        out(`The unclear list written to ${shortPath(paths.root, listFile)}.`);
        const needsFile = path.join(path.dirname(file), `${id}-needs-effect.txt`);
        fs.writeFileSync(needsFile, ['Work boosts on tools, worn gear and XP perks, which have no share of the work budget: each needs another effect (for the content session). Left as they are:', ...boostLines(needsEffect), ''].join('\n'));
        out(`The needs-another-effect list (${needsEffect.length}) written to ${shortPath(paths.root, needsFile)}.`);
    }
    if (!pack) {
        out('Nothing to write: every boost the rule sizes is at its number already.');
        return 0;
    }
    const check = validatePack(pack, { fileName: path.basename(file) });
    if (!check.ok) throw new CliError('The pack came out malformed, so it was not written:\n- ' + check.errors.join('\n- '));
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
    out(`The pack written to ${shortPath(paths.root, file)}: ${plural(pack.entries.length, 'edit')} (${pack.entries.filter((e) => e.kind === 'effect').length} effects, ${pack.entries.filter((e) => e.kind === 'hallStar').length} Guild Hall stars). Check it with: npm run cms -- pack check ${shortPath(paths.root, file)}`);
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
        if (command === 'pack' && sub === 'numbers') return await cmdPackNumbers(paths, options, out);
        if (command === 'pack' && sub === 'boosts') return await cmdPackBoosts(paths, options, load, out);
        if (command === 'recalc') return await cmdRecalc(paths, options, load, out);
        if (command === 'sync') return await cmdSync(paths, options, load, out);
        if (command === 'restore') return await cmdRestore(paths, load, out);
        if (command === 'ledger') return await cmdLedger(paths, options, load, out);
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
