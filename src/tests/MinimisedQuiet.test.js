// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { installDrawingPause, WINDOW_MINIMISED_EVENT, PAUSED_ATTRIBUTE } from '../ui/drawingPause.js';
import { setDrawingPaused, isDrawingPaused } from '../ui/components/board/frameClock.js';
import { areCommitsHeld, setCommitsHeld } from '../ui/hooks/commitHold.js';
import { useGameState } from '../ui/hooks/useGameState.js';
import { useTokenState } from '../ui/components/board/tokenEvents.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameLoop } from '../systems/core/GameLoop.js';

/**
 * ⭐ **A minimised desktop app goes quiet, and is current the moment it is back.** WebView2 never
 * tells the page it is minimised, so the page kept everything a visible page does: the looping CSS
 * animations and a React commit on every tick, painted to a window nobody sees. Minimised
 * (`fg-window-minimised`), the body carries `data-paused`, which pauses every looping animation, and
 * the stores (`useGameState`, `useTokenState`) hold their commits; restored, each store that heard
 * something reads once, together. The engine keeps ticking (and saving) throughout. A hidden browser
 * tab is not touched: the browser already stops its animations.
 */

const h = React.createElement;
const ROOT = path.resolve(__dirname, '..');
const TICK_EVENT = 'minimised_quiet_test_tick';

let uninstall;
let hidden;
const store = { n: 0 };

function setMinimised(m) {
    window.dispatchEvent(new CustomEvent(WINDOW_MINIMISED_EVENT, { detail: m }));
}
function setHidden(v) {
    hidden = v;
    document.dispatchEvent(new Event('visibilitychange'));
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

/** The rules of a stylesheet, comments out: `[selector, body]` of every innermost block. */
function rulesOf(file) {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]]);
}
const STYLESHEETS = ['tailwind.css', ...fs.readdirSync(path.join(ROOT, 'styles')).filter(f => f.endsWith('.css')).map(f => `styles/${f}`)];

beforeEach(() => {
    hidden = false;
    store.n = 0;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    uninstall = installDrawingPause();
});

afterEach(() => {
    cleanup();
    uninstall();
    setDrawingPaused(false);
    setCommitsHeld(false);
    GameLoop.stop();
    GameLoop.offTick('minimisedQuietTest');
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('⭐ the body says when the desktop app is minimised', () => {
    it('data-paused is on the body while minimised, and off once restored', () => {
        expect(document.body.hasAttribute(PAUSED_ATTRIBUTE)).toBe(false);
        setMinimised(true);
        expect(document.body.hasAttribute(PAUSED_ATTRIBUTE)).toBe(true);
        expect(areCommitsHeld()).toBe(true);
        setMinimised(false);
        expect(document.body.hasAttribute(PAUSED_ATTRIBUTE)).toBe(false);
        expect(areCommitsHeld()).toBe(false);
    });

    it('a hidden browser tab pauses drawing only: no attribute, no held commits', () => {
        setHidden(true);
        expect(isDrawingPaused()).toBe(true);
        expect(document.body.hasAttribute(PAUSED_ATTRIBUTE)).toBe(false);
        expect(areCommitsHeld()).toBe(false);
    });

    it('uninstalling while minimised leaves the page loud again', () => {
        setMinimised(true);
        uninstall();
        expect(document.body.hasAttribute(PAUSED_ATTRIBUTE)).toBe(false);
        expect(areCommitsHeld()).toBe(false);
        uninstall = installDrawingPause();
    });
});

describe('⭐ every looping CSS animation pauses under data-paused', () => {
    const paused = STYLESHEETS.flatMap(file => rulesOf(file))
        .filter(([sel, body]) => sel.includes('[data-paused]') && /animation-play-state:\s*paused/.test(body))
        .flatMap(([sel]) => sel.split(',').map(s => s.trim()));

    const looping = STYLESHEETS.flatMap(file => rulesOf(file).map(r => [file, ...r]))
        .filter(([, , body]) => /animation(-iteration-count)?\s*:[^;]*\binfinite\b/.test(body));

    it('the game has looping animations, and a paused rule', () => {
        expect(looping.length).toBeGreaterThanOrEqual(4);
        expect(paused.length).toBeGreaterThanOrEqual(4);
    });

    it('each looping animation\'s selector has its paused twin', () => {
        const missing = looping.flatMap(([file, sel]) => sel.split(',').map(s => s.trim())
            .filter(s => !paused.includes(`body[data-paused] ${s}`)).map(s => `${file}: ${s}`));
        expect(missing).toEqual([]);
    });

    it('the gear alert computes as paused under the attribute, and running without it', () => {
        const css = rulesOf('tailwind.css')
            .filter(([sel]) => sel === '.gi-gear-alert' || sel.includes('[data-paused]'))
            .map(([sel, body]) => `${sel} { ${body} }`).join('\n');
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        const gear = document.createElement('div');
        gear.className = 'gi-gear-alert';
        document.body.appendChild(gear);
        try {
            expect(getComputedStyle(gear).animationPlayState).not.toBe('paused');
            setMinimised(true);
            expect(getComputedStyle(gear).animationPlayState).toBe('paused');
            setMinimised(false);
            expect(getComputedStyle(gear).animationPlayState).not.toBe('paused');
        } finally {
            gear.remove();
            style.remove();
        }
    });
});

describe('⭐ per-tick commits stop while minimised, and one commit brings everything back', () => {
    /** Ten ticks a second: each one changes the store and says so, as the engine's do. */
    function startTicking() {
        GameLoop.onTick('minimisedQuietTest', () => {
            store.n++;
            EventBus.publish(TICK_EVENT, { instanceId: 'tok1' });
        });
        GameLoop.start();
    }
    async function tick(ms) {
        for (let t = 0; t < ms; t += 100) {
            vi.advanceTimersByTime(100);
            await flush();
        }
    }

    it('useGameState and useTokenState: no commit for 3 s minimised, one on restore, current at once', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        const drawn = { game: [], token: [] };
        let commits = 0;
        function Game() {
            const n = useGameState(() => store.n, [TICK_EVENT]);
            drawn.game.push(n);
            return h('i', null, n);
        }
        function Token() {
            const s = useTokenState('tok1', () => ({ n: store.n }), () => ({ byId: [TICK_EVENT] }));
            drawn.token.push(s.n);
            return h('b', null, s.n);
        }
        render(h(React.Profiler, { id: 'quiet', onRender: () => { commits++; } }, h(Game), h(Token)));
        startTicking();

        await tick(500);
        expect(store.n).toBe(5);
        expect(drawn.game.at(-1)).toBe(5);
        expect(drawn.token.at(-1)).toBe(5);

        setMinimised(true);
        const before = { commits, game: drawn.game.length, token: drawn.token.length };
        await tick(3000);
        expect(store.n).toBe(35);
        expect(commits).toBe(before.commits);
        expect(drawn.game.length).toBe(before.game);
        expect(drawn.token.length).toBe(before.token);

        await act(async () => { setMinimised(false); await Promise.resolve(); await Promise.resolve(); });
        expect(commits).toBe(before.commits + 1);
        expect(drawn.game.at(-1)).toBe(35);
        expect(drawn.token.at(-1)).toBe(35);

        await tick(200);
        expect(drawn.game.at(-1)).toBe(37);
        expect(drawn.token.at(-1)).toBe(37);
    });

    it('a store that heard nothing while minimised draws nothing on restore', async () => {
        let renders = 0;
        function Quiet() {
            renders++;
            return h('i', null, useGameState(() => store.n, ['minimised_quiet_test_never']));
        }
        render(h(Quiet));
        const before = renders;
        setMinimised(true);
        store.n = 9;
        await act(async () => { setMinimised(false); await Promise.resolve(); });
        expect(renders).toBe(before);
    });

    it('a store unmounted while minimised is not read on restore', async () => {
        const reads = vi.fn(() => store.n);
        function Gone() {
            return h('i', null, useGameState(reads, [TICK_EVENT]));
        }
        const { unmount } = render(h(Gone));
        setMinimised(true);
        EventBus.publish(TICK_EVENT, {});
        await flush();
        unmount();
        reads.mockClear();
        await act(async () => { setMinimised(false); await Promise.resolve(); });
        expect(reads).not.toHaveBeenCalled();
    });

    it('the engine keeps ticking while minimised: ten ticks a second', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        startTicking();
        setMinimised(true);
        vi.advanceTimersByTime(2000);
        expect(areCommitsHeld()).toBe(true);
        expect(store.n).toBe(20);
    });
});
