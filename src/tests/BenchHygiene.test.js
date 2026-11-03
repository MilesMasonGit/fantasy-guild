// The browser benches' leftovers: stale Chrome profiles are cleared at start, and a bench stops
// when the `npm run` that started it is killed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { describe, it, expect, afterEach } from 'vitest';
import { clearStaleProfiles, launcherChain, watchLauncher, killProfileHolders, isAlive, PROFILE_PREFIX } from '../../bench/browser/benchHygiene.mjs';

const DAY = 24 * 3600 * 1000;
let tmp;
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = null; });

function profile(name, ageMs) {
    const dir = path.join(tmp, name);
    fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), '{}');
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(dir, t, t);
    return dir;
}

describe('stale bench profiles', () => {
    it('removes bench profiles older than a day and leaves fresh ones and anything else', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-hygiene-'));
        const old = profile(`${PROFILE_PREFIX}old`, 3 * DAY);
        const fresh = profile(`${PROFILE_PREFIX}fresh`, 60 * 1000);
        const other = profile('someone-elses-old-dir', 9 * DAY);
        const { removed, failed } = clearStaleProfiles({ dir: tmp });
        expect(removed).toEqual([`${PROFILE_PREFIX}old`]);
        expect(failed).toEqual([]);
        expect(fs.existsSync(old)).toBe(false);
        expect(fs.existsSync(fresh)).toBe(true);
        expect(fs.existsSync(other)).toBe(true);
    });
});

describe('what still holds a closed bench profile', () => {
    it.runIf(process.platform === 'win32')('kills every process naming that profile and leaves one naming another', async () => {
        const holds = `${PROFILE_PREFIX}holder${process.pid}`;
        const other = `${PROFILE_PREFIX}other${process.pid}`;
        const hold = (name) => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)', name], { stdio: 'ignore' });
        const holders = [hold(holds), hold(holds)];
        const bystander = hold(other);
        try {
            await new Promise((r) => setTimeout(r, 300));
            const killed = killProfileHolders(path.join(os.tmpdir(), holds), { image: 'node.exe' });
            expect(killed.sort()).toEqual(holders.map((h) => h.pid).sort());
            const t0 = Date.now();
            while (holders.some((h) => isAlive(h.pid)) && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
            expect(holders.some((h) => isAlive(h.pid))).toBe(false);
            expect(isAlive(bystander.pid)).toBe(true);
        } finally {
            holders.forEach((h) => h.kill());
            bystander.kill();
        }
    }, 30_000);
});

describe('the launcher chain', () => {
    const table = [
        { pid: 1, ppid: 0, name: 'explorer.exe' },
        { pid: 10, ppid: 1, name: 'bash.exe' },
        { pid: 20, ppid: 10, name: 'node.exe' },   // npm
        { pid: 30, ppid: 20, name: 'cmd.exe' },    // npm's shell
        { pid: 40, ppid: 30, name: 'node.exe' },   // bench/draw.mjs
        { pid: 50, ppid: 40, name: 'chrome.exe' },
    ];

    it('is npm and its shell, up to the terminal, which is not watched', () => {
        expect(launcherChain(table, 40).map((p) => p.pid)).toEqual([30, 20]);
    });

    it('is empty for a bench started straight from a terminal', () => {
        expect(launcherChain(table, 20)).toEqual([]);
    });

    it('stops the bench once a process of the chain ends', async () => {
        const wrapper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
        try {
            const fake = [{ pid: 7, ppid: 0, name: 'bash.exe' }, { pid: wrapper.pid, ppid: 7, name: 'node.exe' }, { pid: 99, ppid: wrapper.pid, name: 'node.exe' }];
            let gone = null;
            const watched = watchLauncher((p) => { gone = p; }, { table: fake, selfPid: 99, everyMs: 50 });
            expect(watched.map((p) => p.pid)).toEqual([wrapper.pid]);
            await new Promise((r) => setTimeout(r, 200));
            expect(gone).toBeNull();
            wrapper.kill();
            const t0 = Date.now();
            while (!gone && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
            expect(gone).toMatchObject({ pid: wrapper.pid });
            expect(isAlive(wrapper.pid)).toBe(false);
        } finally {
            wrapper.kill();
        }
    });
});
