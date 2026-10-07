// A minimal Chrome DevTools-protocol driver for the drawing and drag benches.
// No packages: Node 24's built-in WebSocket speaks the protocol. Launches the installed Chrome
// headless with its own throwaway profile, and always kills it and deletes the profile, even on
// an error or Ctrl+C (an orphaned headless Chrome keeps the GPU busy and spoils the next run).

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_PATHS = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
].filter(Boolean);

export function findChrome() {
    const found = CHROME_PATHS.find((p) => fs.existsSync(p));
    if (!found) throw new Error(`Chrome not found (tried ${CHROME_PATHS.join(', ')}); set CHROME_PATH`);
    return found;
}

// ---------------------------------------------------------------------------
// Cleanup: one registry, run once, on every way out of the process
// ---------------------------------------------------------------------------

const cleanups = new Set();
let exiting = false;

/** Register a synchronous cleanup; returns a function that unregisters it. */
export function onCleanup(fn) {
    cleanups.add(fn);
    return () => cleanups.delete(fn);
}

export function runCleanups() {
    for (const fn of [...cleanups]) {
        cleanups.delete(fn);
        try { fn(); } catch { /* best effort: keep cleaning */ }
    }
}

process.on('exit', runCleanups);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(sig, () => {
        if (exiting) return;
        exiting = true;
        console.error(`\n${sig}: stopping Chrome and servers…`);
        runCleanups();
        process.exit(3);
    });
}

/** Kill a process and its children. Synchronous, so it works inside an 'exit' handler. */
export function killTree(pid) {
    if (!pid) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
        try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    }
}

function removeDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* reported by the caller */ }
    return !fs.existsSync(dir);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The protocol connection
// ---------------------------------------------------------------------------

export class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();   // `${sessionId}|${method}` → Set
        this.closed = false;
        ws.addEventListener('message', (ev) => this.onMessage(ev.data));
        ws.addEventListener('close', () => {
            this.closed = true;
            for (const { reject, method } of this.pending.values()) reject(new Error(`CDP closed during ${method}`));
            this.pending.clear();
        });
    }

    static connect(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.addEventListener('open', () => resolve(new Cdp(ws)), { once: true });
            ws.addEventListener('error', (e) => reject(new Error(`CDP connect failed: ${e.message || url}`)), { once: true });
        });
    }

    onMessage(data) {
        const msg = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
        if (msg.id) {
            const p = this.pending.get(msg.id);
            if (!p) return;
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}${msg.error.data ? ' — ' + msg.error.data : ''}`));
            else p.resolve(msg.result);
            return;
        }
        const set = this.listeners.get(`${msg.sessionId || ''}|${msg.method}`);
        if (set) for (const fn of [...set]) fn(msg.params);
    }

    send(method, params = {}, sessionId = undefined, timeoutMs = 60000) {
        if (this.closed) return Promise.reject(new Error(`CDP closed (${method})`));
        const id = this.nextId++;
        const msg = { id, method, params };
        if (sessionId) msg.sessionId = sessionId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`${method} timed out after ${timeoutMs} ms`));
            }, timeoutMs);
            this.pending.set(id, {
                method,
                resolve: (v) => { clearTimeout(timer); resolve(v); },
                reject: (e) => { clearTimeout(timer); reject(e); }
            });
            this.ws.send(JSON.stringify(msg));
        });
    }

    on(method, fn, sessionId = '') {
        const key = `${sessionId}|${method}`;
        if (!this.listeners.has(key)) this.listeners.set(key, new Set());
        this.listeners.get(key).add(fn);
        return () => this.listeners.get(key)?.delete(fn);
    }

    close() {
        try { this.ws.close(); } catch { /* already closed */ }
    }
}

// ---------------------------------------------------------------------------
// A page (one tab, attached with a flat session)
// ---------------------------------------------------------------------------

export class Page {
    constructor(cdp, targetId, sessionId) {
        this.cdp = cdp;
        this.targetId = targetId;
        this.sessionId = sessionId;
        this.navigations = 0;
        this.consoleErrors = [];
        cdp.on('Page.frameNavigated', (p) => { if (!p.frame.parentId) this.navigations++; }, sessionId);
        cdp.on('Runtime.exceptionThrown', (p) => {
            this.consoleErrors.push(p.exceptionDetails?.exception?.description?.split('\n')[0] || p.exceptionDetails?.text || 'exception');
        }, sessionId);
    }

    send(method, params, timeoutMs) {
        return this.cdp.send(method, params, this.sessionId, timeoutMs);
    }

    on(method, fn) {
        return this.cdp.on(method, fn, this.sessionId);
    }

    /** Evaluate an expression in the page and return its value (JSON). Throws on a page exception. */
    async evaluate(expression, { awaitPromise = true, timeoutMs = 60000 } = {}) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, timeoutMs);
        if (res.exceptionDetails) {
            const d = res.exceptionDetails;
            throw new Error(`page threw: ${d.exception?.description || d.text}`);
        }
        return res.result?.value;
    }

    /** Poll `expression` until it is truthy. Returns its value. */
    async waitFor(expression, { timeoutMs = 60000, intervalMs = 250, what = expression } = {}) {
        const t0 = Date.now();
        let last;
        while (Date.now() - t0 < timeoutMs) {
            try {
                last = await this.evaluate(expression, { timeoutMs: Math.max(5000, timeoutMs) });
                if (last) return last;
            } catch (err) {
                // A navigation in flight destroys the context; try again.
                if (!/context|navigat|Cannot find/i.test(err.message)) throw err;
            }
            await sleep(intervalMs);
        }
        throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
    }

    async navigate(url) {
        const loaded = new Promise((resolve) => {
            const off = this.on('Page.loadEventFired', () => { off(); resolve(); });
        });
        const res = await this.send('Page.navigate', { url });
        if (res.errorText) throw new Error(`navigate ${url}: ${res.errorText}`);
        await Promise.race([loaded, sleep(60000)]);
    }

    /** Viewport size and DPR, as the window the game runs in. */
    async setViewport(width, height, deviceScaleFactor = 1) {
        await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
    }

    async setCpuThrottling(rate) {
        await this.send('Emulation.setCPUThrottlingRate', { rate });
    }

    /** Real browser input: goes through the browser's own hit-testing, like a mouse. */
    async mouse(type, x, y, { buttons = 0, button = 'none', clickCount = 0 } = {}) {
        await this.send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount, pointerType: 'mouse' });
    }

    async click(x, y) {
        await this.mouse('mouseMoved', x, y);
        await this.mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
        await this.mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
    }

    async key(key, code = key, keyCode = 0) {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
    }

    async close() {
        try { await this.cdp.send('Target.closeTarget', { targetId: this.targetId }, undefined, 10000); } catch { /* browser gone */ }
    }
}

// ---------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------

/**
 * Launch headless Chrome. GPU stays ON: round 3 measured with the real GPU, and the graphics
 * process was the S2 bottleneck, so a software-rendered number would measure something else.
 * @returns {Promise<{ cdp: Cdp, newPage: () => Promise<Page>, info: object, close: () => Promise<object> }>}
 */
export async function launchChrome({ width = 1600, height = 1000, headless = true, extraArgs = [] } = {}) {
    const exe = findChrome();
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-bench-chrome-'));
    const args = [
        `--user-data-dir=${profileDir}`,
        '--remote-debugging-port=0',
        ...(headless ? ['--headless=new'] : []),
        `--window-size=${width},${height}`,
        '--force-device-scale-factor=1',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-sync',
        '--mute-audio',
        '--hide-scrollbars',
        ...extraArgs,
        'about:blank'
    ];
    const child = spawn(exe, args, { stdio: 'ignore', windowsHide: true, detached: process.platform !== 'win32' });
    let exited = false;
    child.on('exit', () => { exited = true; });

    const unregister = onCleanup(() => {
        killTree(child.pid);
        removeDir(profileDir);
    });

    // The browser writes its port and browser-target path here once it listens.
    const portFile = path.join(profileDir, 'DevToolsActivePort');
    const t0 = Date.now();
    let wsUrl = null;
    while (Date.now() - t0 < 30000) {
        if (exited) break;
        if (fs.existsSync(portFile)) {
            const [port, wsPath] = fs.readFileSync(portFile, 'utf8').split('\n').map((s) => s.trim());
            if (port && wsPath) { wsUrl = `ws://127.0.0.1:${port}${wsPath}`; break; }
        }
        await sleep(100);
    }
    if (!wsUrl) {
        unregister();
        killTree(child.pid);
        removeDir(profileDir);
        throw new Error(`Chrome did not start (${exe})`);
    }

    const cdp = await Cdp.connect(wsUrl);
    const version = await cdp.send('Browser.getVersion');
    let gpu;
    try {
        const g = await cdp.send('SystemInfo.getInfo');
        const dev = g.gpu?.devices?.find((d) => d.vendorString || d.deviceString) || g.gpu?.devices?.[0];
        const aux = g.gpu?.auxAttributes || {};
        gpu = {
            device: dev ? `${dev.deviceString || ''}`.trim() || `${dev.vendorId}:${dev.deviceId}` : null,
            driver: dev?.driverVersion || null,
            angle: aux.glRenderer || aux.gl_renderer || null,
            features: g.gpu?.featureStatus ? {
                gpu_compositing: g.gpu.featureStatus.gpu_compositing,
                rasterization: g.gpu.featureStatus.rasterization,
                webgl: g.gpu.featureStatus.webgl
            } : null
        };
    } catch { gpu = null; }

    const info = { exe, product: version.product, userAgent: version.userAgent, gpu, pid: child.pid };

    async function newPage() {
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        const page = new Page(cdp, targetId, sessionId);
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        await page.setViewport(width, height, 1);
        return page;
    }

    let closed = null;
    async function close() {
        if (closed) return closed;
        closed = (async () => {
            try { await cdp.send('Browser.close', {}, undefined, 5000); } catch { /* fall through to kill */ }
            cdp.close();
            const t1 = Date.now();
            while (!exited && Date.now() - t1 < 5000) await sleep(100);
            if (!exited) killTree(child.pid);
            unregister();
            // Chrome's child processes can hold the profile for a moment after the browser exits.
            let removed = false;
            for (let i = 0; i < 10 && !removed; i++) {
                removed = removeDir(profileDir);
                if (!removed) await sleep(300);
            }
            return { exited: exited || !isAlive(child.pid), profileRemoved: removed, profileDir };
        })();
        return closed;
    }

    return { cdp, newPage, info, close, profileDir };
}

function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

export { sleep };
