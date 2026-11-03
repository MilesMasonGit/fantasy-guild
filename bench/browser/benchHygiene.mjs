// Leftovers from benches that did not end cleanly: old Chrome profiles in the temp folder, and a
// bench left running after the `npm run` that started it was killed.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PROFILE_PREFIX = 'fg-bench-chrome-';
const DAY_MS = 24 * 3600 * 1000;

/**
 * Delete `fg-bench-chrome-*` profiles older than `olderThanMs` (a day): a running bench's profile
 * is minutes old, so only a killed bench's is that stale. One a live Chrome still holds stays.
 * @returns {{ removed: string[], failed: string[] }}
 */
export function clearStaleProfiles({ dir = os.tmpdir(), olderThanMs = DAY_MS, now = Date.now() } = {}) {
    const removed = [];
    const failed = [];
    let names;
    try { names = fs.readdirSync(dir); } catch { return { removed, failed }; }
    for (const name of names) {
        if (!name.startsWith(PROFILE_PREFIX)) continue;
        const full = path.join(dir, name);
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (!stat.isDirectory() || now - stat.mtimeMs < olderThanMs) continue;
        try { fs.rmSync(full, { recursive: true, force: true }); } catch { /* checked below */ }
        (fs.existsSync(full) ? failed : removed).push(name);
    }
    return { removed, failed };
}

/** Every process as { pid, ppid, name } (lower-case name), or null when the table cannot be read. */
export function processTable() {
    const r = process.platform === 'win32'
        ? spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.Name }"],
            { encoding: 'utf8', windowsHide: true, timeout: 15000 })
        : spawnSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8', timeout: 15000 });
    if (r.status !== 0 || !r.stdout) return null;
    return r.stdout.split(/\r?\n/).map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean)
        .map(([, pid, ppid, name]) => ({ pid: Number(pid), ppid: Number(ppid), name: path.basename(name.trim()).toLowerCase() }));
}

/**
 * Kill what still runs on a profile. ⚠️ On Windows the Chrome process that was launched exits on
 * Browser.close while other Chrome processes carry on for ten seconds or more, outside its tree and
 * holding the profile, so a clean run left its profile behind. Only a process naming this profile on
 * its command line is touched, so the owner's Chrome and another bench's are safe.
 * @returns {number[]} the pids killed
 */
export function killProfileHolders(profileDir, { image = 'chrome.exe' } = {}) {
    if (process.platform !== 'win32') return [];
    const token = path.basename(profileDir);
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='${image}'" | Where-Object { $_.CommandLine -like '*${token}*' } | ForEach-Object { $_.ProcessId }`],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    const pids = (r.stdout || '').split(/\s+/).map(Number).filter((pid) => pid > 0);
    for (const pid of pids) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return pids;
}

const WRAPPERS = new Set(['node.exe', 'node', 'cmd.exe', 'npm', 'npx', 'sh']);

/**
 * The launcher chain above `selfPid` that a bench lives and dies with: `npm run` is a node process
 * that runs the bench through a shell (cmd.exe on Windows), and killing it leaves the shell and the
 * bench running. Walks up through node and shell wrappers and stops at the first other process (a
 * terminal, an agent's shell), which is not watched.
 */
export function launcherChain(table, selfPid) {
    const byPid = new Map(table.map((p) => [p.pid, p]));
    const chain = [];
    let current = byPid.get(selfPid);
    while (current && current.ppid && !chain.some((p) => p.pid === current.ppid)) {
        const parent = byPid.get(current.ppid);
        if (!parent || !WRAPPERS.has(parent.name)) break;
        chain.push(parent);
        current = parent;
    }
    return chain;
}

export function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

/**
 * Calls `onGone(process)` once, when any process of the launcher chain has ended. Checks every
 * second without keeping the bench alive.
 * @returns {object[]} the processes watched
 */
export function watchLauncher(onGone, { table = processTable(), selfPid = process.pid, everyMs = 1000 } = {}) {
    const chain = table ? launcherChain(table, selfPid) : [];
    if (!chain.length) return chain;
    const timer = setInterval(() => {
        const gone = chain.find((p) => !isAlive(p.pid));
        if (gone) { clearInterval(timer); onGone(gone); }
    }, everyMs);
    timer.unref();
    return chain;
}
