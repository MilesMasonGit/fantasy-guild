// Servers for the drawing and drag benches: a Vite dev server, or the perf build
// (`vite build --mode perf` → dist-perf/) served by Vite's preview, each on a port of its own.
// Both run inside the bench process, so they cannot outlive it.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onCleanup } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A port nothing is listening on right now. Never 5173/5174 (the owner's dev and CMS). */
export function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, () => {
            const { port } = srv.address();
            srv.close(() => (port === 5173 || port === 5174 ? resolve(freePort()) : resolve(port)));
        });
    });
}

async function waitForHttp(url, timeoutMs = 120000) {
    const t0 = Date.now();
    let lastErr = null;
    while (Date.now() - t0 < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
            lastErr = new Error(`HTTP ${res.status}`);
        } catch (err) { lastErr = err; }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`${url} did not answer: ${lastErr?.message}`);
}

/**
 * The dev server. ⚠️ Its own dependency cache: two Vite servers sharing `node_modules/.vite`
 * rewrite each other's pre-bundled dependencies and the owner's server starts answering
 * 504 "Outdated Optimize Dep".
 */
export async function startDevServer({ port } = {}) {
    const { createServer } = await import('vite');
    port = port || await freePort();
    const server = await createServer({
        root,
        configFile: path.join(root, 'vite.config.js'),
        cacheDir: path.join(root, 'node_modules', '.vite-bench'),
        server: { port, strictPort: true, host: 'localhost', open: false },
        logLevel: 'warn',
        clearScreen: false
    });
    await server.listen();
    const close = () => server.close().catch(() => {});
    const unregister = onCleanup(() => { server.close(); });
    const url = `http://localhost:${port}`;
    await waitForHttp(url);
    return { url, build: 'dev', close: async () => { unregister(); await close(); } };
}

/** `vite build --mode perf` into dist-perf/. Returns how long it took. */
export function buildPerf() {
    const t0 = Date.now();
    const res = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'perf', '--logLevel', 'warn'], {
        cwd: root, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true
    });
    if (res.status !== 0) throw new Error(`vite build --mode perf failed (exit ${res.status})`);
    return (Date.now() - t0) / 1000;
}

/** How old dist-perf/ is, for `--no-build`. */
export function perfBuildInfo() {
    const index = path.join(root, 'dist-perf', 'index.html');
    if (!fs.existsSync(index)) return null;
    return { builtAt: fs.statSync(index).mtime };
}

/** Serve dist-perf/ (the production build plus the measuring harness). */
export async function startPerfServer({ port } = {}) {
    if (!perfBuildInfo()) throw new Error('dist-perf/ is missing: run without --no-build (or npm run build:perf)');
    const { preview } = await import('vite');
    port = port || await freePort();
    const server = await preview({
        root,
        configFile: path.join(root, 'vite.config.js'),
        mode: 'perf',
        build: { outDir: 'dist-perf' },
        preview: { port, strictPort: true, host: 'localhost', open: false },
        logLevel: 'warn',
        clearScreen: false
    });
    const httpServer = server.httpServer;
    const closeSync = () => { try { httpServer.closeAllConnections?.(); httpServer.close(); } catch { /* closed */ } };
    const unregister = onCleanup(closeSync);
    const url = `http://localhost:${port}`;
    await waitForHttp(url);
    return {
        url,
        build: 'perf',
        close: async () => {
            unregister();
            await new Promise((r) => { try { httpServer.closeAllConnections?.(); httpServer.close(() => r()); } catch { r(); } });
        }
    };
}
