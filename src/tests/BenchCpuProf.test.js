// @vitest-environment node
// `npm run bench -- --cpu-prof` keeps the main thread's profile (bench/lib/cpuprof.mjs):
// on Node 24 the module loader's thread writes a second file, and a fixed name let it
// overwrite the engine's.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mainThreadProfile, cpuProfFlags, keepMainThreadProfile } from '../../bench/lib/cpuprof.mjs';

const MAIN = 'CPU.20261020.204555.25012.0.001.cpuprofile';
const LOADER = 'CPU.20261020.204555.25012.1.002.cpuprofile';

describe('bench --cpu-prof', () => {
    let dir = null;
    afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); dir = null; });

    it('picks thread 0 among Node default profile names, whatever the order', () => {
        expect(mainThreadProfile([LOADER, MAIN])).toBe(MAIN);
        expect(mainThreadProfile([MAIN, LOADER])).toBe(MAIN);
        expect(mainThreadProfile([LOADER])).toBeNull();
        expect(mainThreadProfile(['S1-timing-0.cpuprofile'])).toBeNull();
    });

    it('never passes a fixed profile name to Node', () => {
        const flags = cpuProfFlags('x');
        expect(flags).toContain('--cpu-prof');
        expect(flags.some(f => f.startsWith('--cpu-prof-name'))).toBe(false);
    });

    it('moves the main profile to its target and drops the run folder', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cpuprof-'));
        const tmp = path.join(dir, '.tmp-run');
        fs.mkdirSync(tmp);
        fs.writeFileSync(path.join(tmp, MAIN), 'main');
        fs.writeFileSync(path.join(tmp, LOADER), 'loader');
        const target = path.join(dir, 'S1-timing-0.cpuprofile');
        expect(keepMainThreadProfile(tmp, target)).toBe(target);
        expect(fs.readFileSync(target, 'utf8')).toBe('main');
        expect(fs.existsSync(tmp)).toBe(false);
    });

    it('returns null when no main-thread profile was written', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cpuprof-'));
        const tmp = path.join(dir, '.tmp-run');
        fs.mkdirSync(tmp);
        fs.writeFileSync(path.join(tmp, LOADER), 'loader');
        expect(keepMainThreadProfile(tmp, path.join(dir, 't.cpuprofile'))).toBeNull();
        expect(fs.existsSync(tmp)).toBe(false);
    });
});
