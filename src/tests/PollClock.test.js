// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { onPoll, setDrawingPaused, isDrawingPaused } from '../ui/components/board/frameClock.js';
import { installDrawingPause, WINDOW_MINIMISED_EVENT } from '../ui/drawingPause.js';

/**
 * ⭐ **The readouts that re-read the game on a clock share one timer, and it stops with the
 * drawing.** Tooltips, the open Token card, the bubble timers, the stubs' live rates and the
 * fight-window check each ran a `setInterval` of their own, hidden or not. They now poll on
 * `frameClock.onPoll`: one timer for whoever is due soonest, none while the window is hidden or
 * minimised, and on the way back every poller runs once at once, so nothing on screen is stale.
 */

let offs;
const poll = (fn, ms) => { const off = onPoll(fn, ms); offs.push(off); return off; };
const advance = (ms) => vi.advanceTimersByTime(ms);

beforeEach(() => {
    offs = [];
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(100000);
});

afterEach(() => {
    offs.forEach(off => off());
    setDrawingPaused(false);
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('⭐ onPoll: one timer for every poller', () => {
    it('calls each poller at its own period', () => {
        const fast = vi.fn();
        const slow = vi.fn();
        poll(fast, 500);
        poll(slow, 2000);
        advance(2000);
        expect(fast).toHaveBeenCalledTimes(4);
        expect(slow).toHaveBeenCalledTimes(1);
        advance(2000);
        expect(fast).toHaveBeenCalledTimes(8);
        expect(slow).toHaveBeenCalledTimes(2);
    });

    it('holds one timer however many poll, at whatever periods', () => {
        for (let i = 0; i < 15; i++) poll(() => {}, [250, 500, 1000, 2000, 30000][i % 5]);
        expect(vi.getTimerCount()).toBe(1);
        advance(5000);
        expect(vi.getTimerCount()).toBe(1);
    });

    it('pollers of one period are called together, with one now, whenever they subscribed', () => {
        const seen = [];
        poll((now) => seen.push(['a', now]), 1000);
        advance(300);
        poll((now) => seen.push(['b', now]), 1000);
        advance(1700);
        expect(seen).toEqual([['a', 101000], ['b', 101000], ['a', 102000], ['b', 102000]]);
    });

    it('the first call is within one period of subscribing, never before the next grid line', () => {
        const fn = vi.fn();
        advance(400);           // now 100400
        poll(fn, 1000);
        advance(599);
        expect(fn).not.toHaveBeenCalled();
        advance(1);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing stops the calls, and the last one leaves no timer', () => {
        const a = vi.fn();
        const b = vi.fn();
        const offA = poll(a, 500);
        const offB = poll(b, 1000);
        advance(1000);
        offA();
        advance(2000);
        expect(a).toHaveBeenCalledTimes(2);
        expect(b).toHaveBeenCalledTimes(3);
        offB();
        expect(vi.getTimerCount()).toBe(0);
        offB();                 // twice is harmless
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a poller may unsubscribe another mid-poll: that one is not called', () => {
        const b = vi.fn();
        let offB;
        poll(() => offB(), 1000);
        offB = poll(b, 1000);
        advance(1000);
        expect(b).not.toHaveBeenCalled();
    });

    it('subscribing the same function twice is one subscription, the later period winning', () => {
        const fn = vi.fn();
        poll(fn, 500);
        poll(fn, 1000);
        advance(3000);
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('a poller that throws does not stop the others', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const after = vi.fn();
        poll(() => { throw new Error('boom'); }, 1000);
        poll(after, 1000);
        advance(2000);
        expect(after).toHaveBeenCalledTimes(2);
        expect(err).toHaveBeenCalled();
    });
});

describe('⭐ onPoll and the drawing pause', () => {
    it('paused, nobody is called and no timer is held; subscribing while paused sets none', () => {
        const fn = vi.fn();
        poll(fn, 500);
        setDrawingPaused(true);
        expect(vi.getTimerCount()).toBe(0);
        const late = vi.fn();
        poll(late, 1000);
        expect(vi.getTimerCount()).toBe(0);
        advance(60000);
        expect(fn).not.toHaveBeenCalled();
        expect(late).not.toHaveBeenCalled();
    });

    it('on resume every poller runs once at once, then on its period again', () => {
        const fast = vi.fn();
        const slow = vi.fn();
        poll(fast, 500);
        poll(slow, 30000);
        setDrawingPaused(true);
        advance(120000);
        setDrawingPaused(false);
        expect(fast).toHaveBeenCalledTimes(1);
        expect(slow).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(1);
        advance(500);
        expect(fast).toHaveBeenCalledTimes(2);
        expect(slow).toHaveBeenCalledTimes(1);
    });

    it('the desktop app minimising and restoring pauses and resumes it (fg-window-minimised)', () => {
        vi.spyOn(document, 'hidden', 'get').mockImplementation(() => false);
        const uninstall = installDrawingPause();
        try {
            const fn = vi.fn();
            poll(fn, 1000);
            window.dispatchEvent(new CustomEvent(WINDOW_MINIMISED_EVENT, { detail: true }));
            expect(isDrawingPaused()).toBe(true);
            advance(10000);
            expect(fn).not.toHaveBeenCalled();
            window.dispatchEvent(new CustomEvent(WINDOW_MINIMISED_EVENT, { detail: false }));
            expect(fn).toHaveBeenCalledTimes(1);
        } finally {
            uninstall();
        }
    });
});

describe('⚠️ the game\'s pollers are on the poll clock', () => {
    /** The only `setInterval`s allowed under `src/ui`: dev tools, and a held arrow button's repeat. */
    const ALLOWED = [/[\\/]ui[\\/]dev[\\/]/, /[\\/]components[\\/]dev[\\/]/, /ArrowScrollList\.jsx$/];
    const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
        const p = path.join(dir, d.name);
        return d.isDirectory() ? files(p) : (/\.(jsx?|tsx?)$/.test(d.name) ? [p] : []);
    });

    it('no setInterval in the game\'s UI outside the allowed ones', () => {
        const ui = path.resolve(__dirname, '../ui');
        const offenders = files(ui)
            .filter(f => !ALLOWED.some(re => re.test(f)))
            .filter(f => /\bsetInterval\s*\(/.test(fs.readFileSync(f, 'utf8')))
            .map(f => path.relative(ui, f));
        expect(offenders).toEqual([]);
    });
});
