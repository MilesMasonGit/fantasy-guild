// @vitest-environment node
// The drag bench's pure parts (bench/browser/dragLib.mjs): options, the pointer path, the per-kind
// summary, the failure causes and the exit code. The bench itself drives Chrome and is not run here.
import { describe, it, expect } from 'vitest';
import { parseArgs, dragPath, summarise, failureCause, exitCode, KINDS, EXIT } from '../../bench/browser/dragLib.mjs';

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

describe('the exit code', () => {
    it('is 0 only when every kind is at 100 %, 1 otherwise, 3 when the bench failed', () => {
        expect(exitCode({ a: { attempts: 5, successes: 5 } })).toBe(EXIT.OK);
        expect(exitCode({ a: { attempts: 5, successes: 5 }, b: { attempts: 5, successes: 4 } })).toBe(EXIT.BELOW_100);
        expect(exitCode({ a: { attempts: 0, successes: 0 } })).toBe(EXIT.BELOW_100);
        expect(exitCode({ a: { attempts: 5, successes: 5 } }, true)).toBe(EXIT.BENCH_FAILED);
    });
});
