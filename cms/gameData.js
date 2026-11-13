import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { compareSync } from './src/engine/syncGuard.js';
import { mergePlanFile, plannedKeysOf, PLAN_FILE, PLAN_SYNC_KEY } from './src/engine/planFile.js';
import { readWorkspaceFile, writeTemp, replaceWithTemp } from './workspaceFile.js';

/**
 * The game's content files (`data/`) and the plan beside them (`cms/plan/plan.json`), read and
 * written the way the CMS does it. The CMS server's Restore from Game (`/api/load-game-data`) and
 * Sync to Game (`/api/sync-game-data`) and the command line's `restore` and `sync` all call these,
 * so the browser and the command line can never write `data/` two different ways.
 *
 * Node only.
 */

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readIf = (file, fallback) => (fs.existsSync(file) ? readJson(file) : fallback);

/** The plan file, or null when there is none. */
export function readPlanFile(planRoot) {
    const file = path.join(planRoot, PLAN_FILE);
    return fs.existsSync(file) ? readJson(file) : null;
}

/**
 * A workspace rebuilt from `data/` with the plan laid back on (plan blocks and Planned stubs are
 * kept out of `data/`): what Restore from Game loads. Raw, as the files hold it; the CMS store's
 * `hydrate` (or `workspaceFromImport`) brings it to the store's shape.
 */
export function loadGameData({ dataRoot, planRoot }) {
    const tokenRecipes = readIf(path.join(dataRoot, 'tokenRecipes.json'), []);
    // The Guild Hall's sky, as the workspace's two collections (`engine/hallSky.js`).
    const hallSky = readIf(path.join(dataRoot, 'hallStars.json'), null);
    const recipePools = {};
    for (const recipe of tokenRecipes) {
        const skill = recipe.skill || 'general';
        if (!recipePools[skill]) recipePools[skill] = [];
        recipePools[skill].push(recipe);
    }
    return mergePlanFile({
        items: readJson(path.join(dataRoot, 'items.json')),
        tokens: readJson(path.join(dataRoot, 'tokens.json')),
        effects: readIf(path.join(dataRoot, 'effects.json'), {}),
        recipePools,
        starterCamp: readIf(path.join(dataRoot, 'starterCamp.json'), null),
        skillPerks: readIf(path.join(dataRoot, 'skillPerks.json'), null),
        ...(hallSky ? { hallConstellations: hallSky.constellations || {}, hallStars: hallSky.stars || {} } : {}),
        // The world tables, one record (`engine/worldTables.js`); absent until a Sync first writes them.
        world: readIf(path.join(dataRoot, 'world.json'), null),
        // The events table (`engine/events.js`); absent until a Sync first writes one.
        events: readIf(path.join(dataRoot, 'events.json'), null),
    }, readPlanFile(planRoot));
}

/**
 * Commit what a sync just wrote, as its own commit.
 *
 * ## Why the CMS commits at all
 * Sync is a one-way full-file overwrite, so before this the only record that a sync had happened
 * was an anonymous diff in the working tree: a coding session found `data/` dirty with no way to
 * tell live authoring from an abandoned experiment, and the next code commit swept the content in
 * with it. Committing here keeps content and code in separate commits and makes every sync a
 * rollback point.
 *
 * ## Deliberately narrow
 * It stages and commits **only the files the Sync wrote** (`paths`, from the project root), never
 * `-a` and never a whole folder: `data/palettes/` belongs to the Studio, and a palette edit waiting
 * there must not ride along in a content commit. Nothing to commit is a success, not an error.
 *
 * ## Never fails the sync
 * The files are already written by the time this runs. A missing git, a detached HEAD, a hook that
 * rejects the commit: every failure path resolves, and the caller reports what happened.
 */
export function commitSync(projectRoot, counts, paths) {
    const run = (args) =>
        new Promise((resolve) => {
            execFile('git', args, { cwd: projectRoot }, (err, stdout, stderr) =>
                resolve({ ok: !err, out: (stdout || '').trim(), err: (stderr || '').trim() })
            );
        });

    return (async () => {
        if (!paths.length) return { committed: false, reason: 'nothing was written' };
        const staged = await run(['add', '--', ...paths]);
        if (!staged.ok) return { committed: false, reason: 'git add failed: ' + staged.err };

        // `--cached --quiet` exits NON-zero when there IS something staged.
        const diff = await run(['diff', '--cached', '--quiet', '--', ...paths]);
        if (diff.ok) return { committed: false, reason: 'no content changed' };

        const summary = Object.entries(counts)
            .filter(([, n]) => typeof n === 'number' && n > 0)
            .map(([k, n]) => n + ' ' + k)
            .join(', ');

        const message = [
            'CMS sync' + (summary ? ': ' + summary : ''),
            '',
            'Written by "Sync to Game" (one-way full-file write from the',
            'CMS workspace). Content only -- this commit holds only the files the Sync',
            'wrote in `data/` and the plan (`cms/plan/`), so it can be rolled back without touching code.'
        ].join('\n');

        const done = await run(['commit', '-m', message, '--', ...paths]);
        if (!done.ok) return { committed: false, reason: 'git commit failed: ' + done.err };

        const sha = await run(['rev-parse', '--short', 'HEAD']);
        return { committed: true, sha: sha.ok ? sha.out : null };
    })();
}

/** The branch checked out in `projectRoot` (`HEAD` when detached), or null when git cannot say. */
export function readBranch(projectRoot) {
    return new Promise((resolve) => {
        execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectRoot }, (err, stdout) =>
            resolve(err ? null : (stdout || '').trim() || null)
        );
    });
}

/** The one branch content is synced on (the owner's rule): content commits on other branches ride into code merges. */
export const SYNC_BRANCH = 'main';

/** What went in, by kind, so the commit message says what changed rather than just "sync". */
export function syncCounts(files, plan) {
    const size = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);
    return {
        tokens: size(files['tokens.json']),
        items: size(files['items.json']),
        recipes: size(files['tokenRecipes.json']),
        'Starter Camp Tokens': size(files['starterCamp.json']?.tokens),
        perks: Object.values(files['skillPerks.json'] || {}).reduce((n, record) => n + size(record?.perks), 0),
        'Guild Hall stars': size(files['hallStars.json']?.stars),
        'world lines': size(files['world.json']?.lines),
        events: size(files['events.json']),
        'Planned entries': plannedKeysOf(plan).size
    };
}

/**
 * Sync to Game's write, as `{ status, body }`: the files `syncFiles` built go to `dataRoot`, the
 * plan to `planRoot`, and, when `commit` names the project, they are committed. Refused, writing
 * nothing, when:
 * - `commit` is set and the project is not on `main`: 409 with `wrongBranch` when `branchRule` is
 *   'refuse' (the page); with 'warn' (the command line) it writes and the answer carries `warning`;
 * - `baseRevision` is given and the workspace file is at a newer revision (the body came from a tab
 *   that missed a later save): 409 with `staleWorkspace`;
 * - it would remove content the game has: 409 with `needsConfirm` and the diff (removed, changed
 *   and added), unless `confirmRemovals`.
 * Every file goes to a temporary name first and all are renamed at the end, so a write that fails
 * leaves `data/` as it was.
 * @param {{ files: object, plan?: object|null, confirmRemovals?: boolean, dataRoot: string, planRoot: string,
 *           baseRevision?: number|null, workspaceFile?: string|null, branchRule?: 'refuse'|'warn',
 *           commit?: { projectRoot: string } | null, log?: (line: string) => void }} options
 *        `commit` is null when the folders are not the project's own (a sandbox, a test): then nothing is committed.
 */
export async function writeSync({
    files: sent, plan: planSent = null, confirmRemovals = false, dataRoot, planRoot,
    baseRevision = null, workspaceFile = null, branchRule = 'refuse', commit = null, log = () => {},
}) {
    if (!sent || typeof sent !== 'object') return { status: 400, body: { error: 'Missing or invalid files payload' } };
    // ⚠️ The plan never goes into `data/`, even when a caller puts it among the files.
    const { [PLAN_SYNC_KEY]: stray, ...files } = sent;
    let plan = planSent ?? stray ?? null;
    // ⚠️ A workspace that never set the Ledger settings sends none: the file's own are kept, never wiped.
    if (plan && typeof plan === 'object' && !plan.settings) {
        try {
            const onDisk = readPlanFile(planRoot);
            if (onDisk?.settings) plan = { ...plan, settings: onDisk.settings };
        } catch {
            // An unreadable plan file has no settings to keep.
        }
    }

    for (const relPath of Object.keys(files)) {
        // Prevent path traversal attacks
        if (relPath.includes('..') || path.isAbsolute(relPath)) return { status: 400, body: { error: 'Invalid relative path: ' + relPath } };
    }

    let warning = null;
    if (commit) {
        const branch = await readBranch(commit.projectRoot);
        if (branch !== SYNC_BRANCH) {
            // ⚠️ A branch git cannot name is not main either: the page refuses rather than write content it may not be able to commit.
            const said = branch === null
                ? `Git did not say which branch the project is on, so the Sync cannot check it is ${SYNC_BRANCH}`
                : `The project is on branch "${branch}", not ${SYNC_BRANCH}`;
            if (branchRule !== 'warn') {
                return {
                    status: 409,
                    body: { error: `${said}: content is synced on ${SYNC_BRANCH} only. Nothing was written. Switch the project to ${SYNC_BRANCH} and Sync again.`, wrongBranch: true, branch },
                };
            }
            warning = `${said}: content is meant to be synced on ${SYNC_BRANCH} only. The Sync went ahead${branch === null ? '' : ` and its commit is on "${branch}"`}.`;
        }
    }

    if (Number.isInteger(baseRevision) && workspaceFile) {
        let disk;
        try {
            disk = readWorkspaceFile(workspaceFile);
        } catch (err) {
            return { status: 500, body: { error: 'The workspace file on disk cannot be read, so the Sync cannot check it is current. Nothing was written: ' + err.message } };
        }
        if (baseRevision < disk.revision) {
            return {
                status: 409,
                body: {
                    error: `This Sync was made from an out-of-date copy of the workspace (revision ${baseRevision}; the workspace on disk is at revision ${disk.revision}, saved by another tab or the command line). Nothing was written. Reload the page and Sync again.`,
                    staleWorkspace: true, revision: disk.revision, baseRevision,
                },
            };
        }
    }

    // A stale browser workspace once synced over newer content and silently dropped it, so a Sync that would
    // remove anything the game has writes nothing until the author confirms.
    if (confirmRemovals !== true) {
        const current = {};
        for (const name of Object.keys(files)) {
            try {
                current[name] = readJson(path.join(dataRoot, name));
            } catch {
                current[name] = null;
            }
        }
        if (plan) {
            try {
                current[PLAN_SYNC_KEY] = readPlanFile(planRoot);
            } catch {
                current[PLAN_SYNC_KEY] = null;
            }
        }
        const diff = compareSync(current, plan ? { ...files, [PLAN_SYNC_KEY]: plan } : files);
        if (diff.hasRemovals) return { status: 409, body: { error: 'This Sync would remove content the game has', needsConfirm: true, diff } };
    }

    const targets = Object.entries(files).map(([relPath, content]) => ({
        name: relPath,
        file: path.resolve(dataRoot, relPath),
        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    }));
    if (plan) targets.push({ name: PLAN_SYNC_KEY, file: path.join(planRoot, PLAN_FILE), text: JSON.stringify(plan, null, 2) });

    // Every file to a temporary name first; only when all are down does any replace its file.
    const temps = [];
    const dropTemps = (from) => {
        for (const temp of temps.slice(from)) {
            try { fs.unlinkSync(temp); } catch { /* never made, or already renamed */ }
        }
    };
    try {
        for (const t of targets) temps.push(writeTemp(t.file, t.text));
    } catch (err) {
        dropTemps(0);
        return { status: 500, body: { error: 'Failed to sync game data, nothing was written: ' + err.message } };
    }
    const filesWritten = [];
    const written = [];
    for (let i = 0; i < targets.length; i++) {
        try {
            replaceWithTemp(temps[i], targets[i].file, targets[i].text);
        } catch (err) {
            dropTemps(i);
            const left = targets.slice(i).map((t) => t.name).join(', ');
            log(`[CMS Sync] Stopped part-way: wrote ${filesWritten.join(', ') || 'nothing'}; not written: ${left}`);
            return { status: 500, body: { error: `Failed to sync game data part-way (${err.message}): written ${filesWritten.join(', ') || 'nothing'}; not written ${left}. Nothing was committed.`, filesWritten } };
        }
        filesWritten.push(targets[i].name);
        written.push(targets[i].file);
    }
    log(`[CMS Sync] Successfully wrote ${filesWritten.length} file(s): ${filesWritten.join(', ')}`);
    if (warning) log(`[CMS Sync] ${warning}`);

    const result = commit
        ? await commitSync(commit.projectRoot, syncCounts(files, plan), written.map((f) => path.relative(commit.projectRoot, f).split(path.sep).join('/')))
        : { committed: false, reason: 'data folder overridden' };
    log(result.committed ? `[CMS Sync] Committed as ${result.sha}` : `[CMS Sync] Not committed — ${result.reason}`);
    return { status: 200, body: { success: true, filesWritten, commit: result, ...(warning ? { warning } : {}) } };
}
