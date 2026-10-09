// @vitest-environment node
// The drag bench's pure parts (bench/browser/dragLib.mjs): options, the pointer path, the per-kind
// summary, the failure causes and the exit code. The bench itself drives Chrome and is not run here.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseArgs, dragPath, summarise, failureCause, exitCode, KINDS, EXIT, PHASES, STALL_MS, stallCells } from '../../bench/browser/dragLib.mjs';
import { benchCacheDir } from '../../bench/browser/servers.mjs';

describe('drag bench options', () => {
    it('defaults to 50 drags per kind on the perf build at CPU 1x, with the overlay pass', () => {
        expect(parseArgs([])).toMatchObject({ n: 50, build: 'perf', cpu: 1, overlays: true, kinds: null });
    });

    it('takes --n, --kinds, --dev, --no-overlays and refuses nonsense', () => {
        const a = parseArgs(['--n=7', '--kinds=token,flag', '--dev', '--no-overlays']);
        expect(a).toMatchObject({ n: 7, kinds: ['token', 'flag'], build: 'dev', overlays: false });
        expect(() => parseArgs(['--n=0'])).toThrow();
        expect(() => parseArgs(['--kinds=teleport'])).toThrow(/unknown kind/);
        expect(() => parseArgs(['--wat'])).toThrow(/unknown option/);
    });

    it('runs on S2 unless --board=S3 asks for the torture board', () => {
        expect(parseArgs([]).board).toBe('S2');
        expect(parseArgs(['--board=S3']).board).toBe('S3');
        expect(() => parseArgs(['--board=S9'])).toThrow(/--board/);
    });

    it('covers the six drags the plan names (the bin round trip as two)', () => {
        expect(KINDS.map(k => k.id)).toEqual(['dockHero', 'flag', 'token', 'tokenToBin', 'binToMat', 'shop', 'equip']);
    });
});

describe('the pointer path', () => {
    it('stays under the 8 px activation distance for one move, then crosses it, then ends on the target', () => {
        const from = { x: 100, y: 100 };
        const to = { x: 400, y: 300 };
        const path = dragPath(from, to);
        const d = (p) => Math.hypot(p.x - from.x, p.y - from.y);
        expect(d(path[0])).toBeLessThan(8);
        expect(d(path[1])).toBeGreaterThanOrEqual(8);
        expect(path.at(-1)).toEqual(to);
        // Intermediate positions, not a jump.
        expect(path.length).toBeGreaterThan(8);
        for (let i = 1; i < path.length; i++) expect(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)).toBeLessThan(120);
    });
});

describe('summarising attempts', () => {
    const ok = (ms) => ({ ok: true, pickedUp: true, pressToStartMs: ms, thresholdToStartMs: 1 });
    const blocked = { ok: false, pickedUp: false, under: { identity: '[data-callout]' }, source: { what: 'Token a' } };

    it('counts successes, skips apart, and pickup delay quantiles', () => {
        const s = summarise([ok(50), ok(60), ok(70), blocked, { skipped: 'no Token to move' }]);
        expect(s.attempts).toBe(4);
        expect(s.skipped).toBe(1);
        expect(s.successes).toBe(3);
        expect(s.successPct).toBe(75);
        expect(s.pickupP50).toBe(60);
        expect(s.pickupP95).toBe(70);
    });

    it('groups failures by cause and names what was under the pointer', () => {
        const s = summarise([blocked, blocked, ok(50)]);
        expect(s.failures).toHaveLength(1);
        expect(s.failures[0].count).toBe(2);
        expect(s.failures[0].cause).toBe('never picked up · under the pointer: [data-callout]');
    });

    it('tells a wrong pickup, a refusal, a drop nothing took and a silent miss apart', () => {
        expect(failureCause({ pickedUp: true, wrongThing: true, inHand: 'Token t1', under: { identity: '[data-token-id=t1]' } }))
            .toMatch(/^picked up the wrong thing \(Token\)/);
        expect(failureCause({ pickedUp: true, notes: ['info: Bones', 'warning: The mat is full'] }))
            .toBe('dropped, refused by the game: The mat is full');
        expect(failureCause({ pickedUp: true, dropSound: 'unassign', underTarget: { identity: '[data-board-origin=true]' } }))
            .toMatch(/^dropped, no target took it/);
        expect(failureCause({ pickedUp: true, detail: 'the flag did not move' })).toMatch(/state not as intended: the flag did not move/);
    });
});

describe('frame stalls per drag phase', () => {
    const drag = (pickup, carry, drop) => ({ ok: true, pickedUp: true, frames: { pickup, carry, drop } });
    const f = (frames, maxMs, over16) => ({ frames, maxMs, over16 });

    it('takes the longest frame of all, the median drag\'s longest, and counts frames and drags over 16.7 ms', () => {
        const s = summarise([
            drag(f(10, 90, 2), f(40, 8, 0), f(30, 60, 1)),
            drag(f(12, 20, 1), f(38, 7, 0), f(31, 9, 0)),
            drag(f(11, 6, 0), f(41, 30, 1), null),
            { ok: false, pickedUp: false, frames: null }
        ]);
        expect(s.stalls.pickup).toEqual({ drags: 3, frames: 33, worstMs: 90, medianMaxMs: 20, over16: 3, dragsWithStall: 2 });
        expect(s.stalls.carry).toMatchObject({ drags: 3, frames: 119, worstMs: 30, over16: 1, dragsWithStall: 1 });
        // A drag with no drop frames (it never let go) is left out of the drop, not counted as smooth.
        expect(s.stalls.drop).toMatchObject({ drags: 2, frames: 61, worstMs: 60, over16: 1, dragsWithStall: 1 });
    });

    it('prints a phase as two cells, and a dash for a phase no drag reached', () => {
        expect(stallCells({ drags: 3, frames: 33, worstMs: 90.4, medianMaxMs: 20, over16: 3, dragsWithStall: 2 })).toEqual(['90 / 20', '3 / 33 (2)']);
        expect(stallCells({ drags: 0 })).toEqual(['—', '—']);
        expect(PHASES).toEqual(['pickup', 'carry', 'drop']);
        expect(STALL_MS).toBe(16.7);
    });
});

describe('the bench dev server\'s dependency cache', () => {
    it('is one per checkout: worktrees share node_modules through a junction, so the name carries the path', () => {
        const main = benchCacheDir('C:/Users/x/Projects/fantasy_guild_v2');
        const wt = benchCacheDir('C:/Users/x/Projects/fantasy_guild_v2/.claude/worktrees/d');
        expect(main).not.toBe(wt);
        expect(path.basename(wt)).toMatch(/^\.vite-bench-d-[0-9a-f]{8}$/);
        expect(path.dirname(wt)).toBe(path.join('C:/Users/x/Projects/fantasy_guild_v2/.claude/worktrees/d', 'node_modules'));
        // The same checkout always gets the same cache, however its path is spelled.
        expect(benchCacheDir('c:/users/x/projects/fantasy_guild_v2')).toBe(path.join('c:/users/x/projects/fantasy_guild_v2', 'node_modules', path.basename(main)));
    });
});

describe('the exit code', () => {
    it('is 0 only when every kind is at 100 %, 1 otherwise, 3 when the bench failed', () => {
        expect(exitCode({ a: { attempts: 5, successes: 5 } })).toBe(EXIT.OK);
        expect(exitCode({ a: { attempts: 5, successes: 5 }, b: { attempts: 5, successes: 4 } })).toBe(EXIT.BELOW_100);
        expect(exitCode({ a: { attempts: 0, successes: 0 } })).toBe(EXIT.BELOW_100);
        expect(exitCode({ a: { attempts: 5, successes: 5 } }, true)).toBe(EXIT.BENCH_FAILED);
    });
});
