// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { spriteFxPlugin, runSpriteFxInChild } from '../../scripts/spriteFx.mjs';
import viteConfig from '../../vite.config.js';
import { SPRITE_FX_DIR } from '../config/spriteFx.js';

/**
 * ⭐ The dev server's sprite redraw (the Vite plugin in `scripts/spriteFx.mjs`)
 * must never be able to take the dev server down: it runs in a child process,
 * reacts only to the owner's sprites (never to its own output), and stops when
 * the server closes. The dev watcher skips the other sessions' worktrees.
 */

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

/** A stand-in for the child-process runner: every call is one redraw the test finishes by hand. */
function fakeRunner() {
    const jobs = [];
    const runGenerator = vi.fn((opts) => {
        const d = deferred();
        const job = { opts, done: d.promise, kill: vi.fn(), finish: d.resolve, fail: d.reject };
        jobs.push(job);
        return job;
    });
    return { runGenerator, jobs };
}

function fakeServer() {
    return { watcher: new EventEmitter(), ws: { send: vi.fn() }, middlewares: { use: vi.fn() } };
}

const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('the dev server’s redraw (spriteFxPlugin)', () => {
    const root = path.resolve(os.tmpdir(), 'fg-sprite-fx-plugin');
    const assets = (rel) => path.join(root, 'public', 'assets', rel);
    const own = (rel) => path.join(root, 'public', SPRITE_FX_DIR, rel);
    let logSpy;

    const start = (runner) => {
        const plugin = spriteFxPlugin({ root, runGenerator: runner.runGenerator });
        const server = fakeServer();
        plugin.configResolved({ command: 'serve' });
        plugin.configureServer(server);
        return { plugin, server };
    };

    afterEach(() => { vi.useRealTimers(); logSpy?.mockRestore(); });

    it('redraws once as the server starts, through the child-process runner', () => {
        const runner = fakeRunner();
        start(runner);
        expect(runner.runGenerator).toHaveBeenCalledTimes(1);
        expect(runner.jobs[0].opts.root).toBe(root);
    });

    it('its own output, and anything that is not a sprite PNG under public/assets, never starts a redraw', async () => {
        vi.useFakeTimers();
        const runner = fakeRunner();
        const { server } = start(runner);
        runner.jobs[0].finish({ generated: 0, removed: 0 });
        await settle();
        for (const f of [
            own('sil/assets/tokens/token_a.png'), own('ol-work/assets/tokens/token_a.png'), own('manifest.json'),
            assets('tokens/notes.txt'), path.join(root, 'src', 'x.png'),
            path.join(root, '.claude', 'worktrees', 'a1', 'public', 'assets', 'tokens', 'token_a.png')
        ]) {
            for (const ev of ['add', 'change', 'unlink']) server.watcher.emit(ev, f);
        }
        vi.advanceTimersByTime(1000);
        expect(runner.runGenerator).toHaveBeenCalledTimes(1);

        server.watcher.emit('add', assets('tokens/token_new.png'));
        server.watcher.emit('change', assets('tokens/token_new.png'));
        vi.advanceTimersByTime(1000);
        expect(runner.runGenerator).toHaveBeenCalledTimes(2);
    });

    it('a sprite changed during a redraw queues exactly one more', async () => {
        vi.useFakeTimers();
        const runner = fakeRunner();
        const { server } = start(runner);
        server.watcher.emit('change', assets('a.png'));
        vi.advanceTimersByTime(300);
        server.watcher.emit('change', assets('b.png'));
        vi.advanceTimersByTime(300);
        expect(runner.runGenerator).toHaveBeenCalledTimes(1);
        runner.jobs[0].finish({ generated: 1, removed: 0 });
        await settle();
        expect(runner.runGenerator).toHaveBeenCalledTimes(2);
        runner.jobs[1].finish({ generated: 0, removed: 0 });
        await settle();
        expect(runner.runGenerator).toHaveBeenCalledTimes(2);
    });

    it('tells the page to re-read the manifest only when something was drawn or removed', async () => {
        vi.useFakeTimers();
        const runner = fakeRunner();
        const { server } = start(runner);
        runner.jobs[0].finish({ generated: 0, removed: 0 });
        await settle();
        expect(server.ws.send).not.toHaveBeenCalled();
        server.watcher.emit('add', assets('a.png'));
        vi.advanceTimersByTime(300);
        runner.jobs[1].finish({ generated: 1, removed: 0 });
        await settle();
        expect(server.ws.send).toHaveBeenCalledWith({ type: 'custom', event: 'sprite-fx:update' });
    });

    it('a failed redraw is logged and the server carries on: the next sprite change redraws again', async () => {
        vi.useFakeTimers();
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const runner = fakeRunner();
        const { server } = start(runner);
        runner.jobs[0].fail(new Error('generator exited with code 3221226505'));
        await settle();
        expect(logSpy.mock.calls.flat().join('\n')).toMatch(/sprite-fx: failed \(generator exited with code 3221226505\)/);
        expect(server.ws.send).not.toHaveBeenCalled();
        server.watcher.emit('add', assets('a.png'));
        vi.advanceTimersByTime(300);
        expect(runner.runGenerator).toHaveBeenCalledTimes(2);
    });

    it('closing (or restarting) the server stops the redraw in flight, and nothing redraws after', async () => {
        vi.useFakeTimers();
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const runner = fakeRunner();
        const { plugin, server } = start(runner);
        server.watcher.emit('change', assets('a.png'));
        vi.advanceTimersByTime(300);
        await plugin.closeBundle();
        expect(runner.jobs[0].kill).toHaveBeenCalled();
        runner.jobs[0].fail(new Error('generator stopped (SIGTERM)'));
        await settle();
        server.watcher.emit('change', assets('b.png'));
        vi.advanceTimersByTime(1000);
        expect(runner.runGenerator).toHaveBeenCalledTimes(1);
        expect(server.ws.send).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
    });
});

/**
 * ⭐ A redraw writes its pictures while the dev server is already running. Vite serves a file
 * under `public/` only if it was there when the server started or its file watcher reported it
 * since, and a watcher still making its first scan reports nothing it finds: the outlines drawn
 * as a server started were answered with the game's own page, and no outline drew. The test
 * takes the watcher away, so "never reported" is certain rather than a race.
 */
describe('the dev server serves what a redraw wrote after it started', () => {
    let root, server, http, base;
    const fxFile = (rel) => path.join(root, 'public', SPRITE_FX_DIR, rel);
    const RING = 'ol-hover/assets/tokens/mine/t_drawn_late.png';
    let ringBytes;

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-fx-serve-'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>game</title>');
        fs.mkdirSync(path.join(root, 'public', SPRITE_FX_DIR), { recursive: true });
        fs.writeFileSync(fxFile('manifest.json'), '{"version":0,"sprites":{}}');
        fs.writeFileSync(path.join(root, 'secret.png'), 'not a sprite');
        const px = Buffer.alloc(3 * 3 * 4);
        px[(1 * 3 + 1) * 4 + 3] = 255;
        ringBytes = await sharp(px, { raw: { width: 3, height: 3, channels: 4 } }).png().toBuffer();

        // Draws as the server starts, as the child does: after Vite has listed `public/`.
        const runGenerator = () => {
            fs.mkdirSync(path.dirname(fxFile(RING)), { recursive: true });
            fs.writeFileSync(fxFile(RING), ringBytes);
            return { done: Promise.resolve({ generated: 1, removed: 0 }), kill: () => {} };
        };
        const { createServer } = await import('vite');
        server = await createServer({
            root,
            configFile: false,
            logLevel: 'silent',
            cacheDir: path.join(root, '.vite'),
            appType: 'spa',
            optimizeDeps: { noDiscovery: true, include: [] },
            server: { middlewareMode: true, watch: null, ws: false },
            plugins: [spriteFxPlugin({ root, runGenerator })]
        });
        const { createServer: createHttpServer } = await import('http');
        http = createHttpServer(server.middlewares);
        await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${http.address().port}`;
    }, 60000);

    afterAll(async () => {
        await new Promise((resolve) => (http ? http.close(resolve) : resolve()));
        await server?.close();
        try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* temp */ }
    });

    it('an outline drawn after the server started is served as the picture, not the game page', async () => {
        const res = await fetch(`${base}/${SPRITE_FX_DIR}/${RING}`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/^image\/png/);
        expect(Buffer.from(await res.arrayBuffer()).equals(ringBytes)).toBe(true);
    });

    it('a redrawn picture is fetched again, not kept from before', async () => {
        const res = await fetch(`${base}/${SPRITE_FX_DIR}/${RING}`);
        expect(res.headers.get('content-type')).toMatch(/^image\/png/);
        expect(res.headers.get('cache-control')).toBe('no-cache');
        const etag = res.headers.get('etag');
        expect(etag).toBeTruthy();
        const again = await fetch(`${base}/${SPRITE_FX_DIR}/${RING}`, { headers: { 'if-none-match': etag } });
        expect(again.status).toBe(304);
    });

    it('the manifest is served as JSON', async () => {
        const res = await fetch(`${base}/${SPRITE_FX_DIR}/manifest.json`);
        expect(res.headers.get('content-type')).toMatch(/^application\/json/);
        expect(await res.json()).toEqual({ version: 0, sprites: {} });
    });

    it('a picture that does not exist is a 404, and nothing outside the folder is reachable', async () => {
        const missing = await fetch(`${base}/${SPRITE_FX_DIR}/ol-hover/assets/tokens/none.png`);
        expect(missing.status).toBe(404);
        for (const sep of ['%2f', '%5c']) {
            const out = await fetch(`${base}/${SPRITE_FX_DIR}/..${sep}..${sep}..${sep}secret.png`);
            expect(out.status).toBe(404);
            expect(await out.text()).not.toContain('not a sprite');
        }
    });
});

describe('runSpriteFxInChild — the redraw in its own process', () => {
    let root;
    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-fx-child-'));
        const file = path.join(root, 'public', 'assets', 'tokens', 'token_child.png');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const px = Buffer.alloc(4 * 4 * 4);
        px[(1 * 4 + 1) * 4 + 3] = 255;
        await sharp(px, { raw: { width: 4, height: 4, channels: 4 } }).png().toFile(file);
    });
    afterAll(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* temp */ } });

    it('draws in another process and hands back what it did', async () => {
        const job = runSpriteFxInChild({ root });
        const r = await job.done;
        expect(r.pid).toBeGreaterThan(0);
        expect(r.pid).not.toBe(process.pid);
        expect(r.generated).toBe(1);
        const out = path.join(root, 'public', SPRITE_FX_DIR);
        expect(fs.existsSync(path.join(out, 'sil', 'assets/tokens/token_child.png'))).toBe(true);
        expect(fs.existsSync(path.join(out, 'ol-hover', 'assets/tokens/token_child.png'))).toBe(true);
        expect(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).sprites)
            .toHaveProperty(['assets/tokens/token_child.png']);
    }, 30000);

    it('a child that aborts (a native crash) is a rejected redraw, not a dead server', async () => {
        const script = path.join(root, 'crash.mjs');
        fs.writeFileSync(script, 'process.abort();\n');
        const job = runSpriteFxInChild({ root, script });
        await expect(job.done).rejects.toThrow(/generator (exited with code|stopped)/);
    }, 30000);

    it('kill() stops a child mid-run', async () => {
        const script = path.join(root, 'hang.mjs');
        fs.writeFileSync(script, 'setInterval(() => {}, 1000);\n');
        const job = runSpriteFxInChild({ root, script });
        job.kill();
        await expect(job.done).rejects.toThrow(/generator (exited with code|stopped)/);
    }, 30000);
});

describe('the dev watcher leaves other sessions’ worktrees alone', () => {
    const cfg = viteConfig({ mode: 'development', command: 'serve' });
    const here = fileURLToPath(new URL('../..', import.meta.url));
    const ignored = [].concat(cfg.server?.watch?.ignored || []).filter(f => typeof f === 'function');
    const isIgnored = (p) => ignored.some(f => f(p.split(path.sep).join('/')));

    it('ignores everything under this checkout’s .claude/worktrees', () => {
        expect(ignored.length).toBeGreaterThan(0);
        expect(isIgnored(path.join(here, '.claude', 'worktrees'))).toBe(true);
        expect(isIgnored(path.join(here, '.claude', 'worktrees', 'a1', 'src', 'main.jsx'))).toBe(true);
        expect(isIgnored(path.join(here, '.claude', 'worktrees', 'a1', 'public', 'assets', 'x.png'))).toBe(true);
    });

    it('still watches the project itself, its sprites and its other .claude files', () => {
        expect(isIgnored(path.join(here, 'src', 'main.jsx'))).toBe(false);
        expect(isIgnored(path.join(here, 'public', 'assets', 'tokens', 'token_a.png'))).toBe(false);
        expect(isIgnored(path.join(here, '.claude', 'launch.json'))).toBe(false);
        expect(isIgnored(path.join(here, '.claude', 'worktreesX', 'a.js'))).toBe(false);
    });
});
