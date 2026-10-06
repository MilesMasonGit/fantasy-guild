// The Perf HUD overlay.
// ⚠️ DEV BUILDS ONLY (reached only through perfHarness.js).
// Not React, on purpose: the HUD must not become what it measures. It is a handful of plain
// DOM nodes appended to <body>, outside the React tree, so it adds no React commits to the
// numbers it shows. The harness calls `render()` at most twice a second and each call writes
// `textContent` into fixed nodes: no nodes are created per update, no layout is read.

import { HUD_ROOT_ID, HUD_SHOWN_EVENT } from './perfFlags.js';

const ROOT_ID = HUD_ROOT_ID;

/** Tell the React side the HUD came or went (it hides the FPS counter). */
function announceShown(on) {
    try { globalThis.dispatchEvent?.(new CustomEvent(HUD_SHOWN_EVENT, { detail: { on } })); } catch { /* ignore */ }
}

let root = null;
let body = null;
let status = null;
let handlers = null;

const fmt = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));
const int = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));

function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'font:inherit;padding:1px 6px;margin-right:4px;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:3px;cursor:pointer';
    b.addEventListener('click', onClick);
    return b;
}

/** Create the overlay (idempotent). `on` = { copy, reset, close }. */
export function mountHud(on) {
    handlers = on;
    if (root) return;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-perf-hud', '');
    root.style.cssText = [
        'position:fixed', 'left:8px', 'bottom:40px', 'z-index:10001',
        'min-width:330px', 'max-width:420px', 'padding:6px 8px',
        'background:rgba(0,0,0,0.82)', 'color:#d1fae5', 'border:1px solid #065f46', 'border-radius:6px',
        'font:11px/1.35 ui-monospace,Consolas,monospace', 'pointer-events:auto',
        'text-transform:none', 'letter-spacing:0', 'contain:content'
    ].join(';');

    body = document.createElement('pre');
    body.style.cssText = 'margin:0 0 4px 0;white-space:pre;font:inherit';
    body.textContent = 'Perf HUD — waiting for the first sample…';

    const bar = document.createElement('div');
    bar.appendChild(button('Copy report', () => handlers?.copy?.()));
    bar.appendChild(button('Reset', () => handlers?.reset?.()));
    bar.appendChild(button('Hide', () => handlers?.close?.()));
    status = document.createElement('span');
    status.style.cssText = 'color:#fcd34d;margin-left:4px';
    bar.appendChild(status);

    root.appendChild(body);
    root.appendChild(bar);
    document.body.appendChild(root);
    announceShown(true);
}

export function unmountHud() {
    const was = !!root;
    root?.remove();
    root = body = status = handlers = null;
    if (was) announceShown(false);
}

export function hudMounted() {
    return !!root;
}

/** How many DOM nodes the HUD itself adds (subtracted from the DOM count). */
export function hudNodeCount() {
    return root ? root.getElementsByTagName('*').length + 1 : 0;
}

/** A short message beside the buttons ("Copied", errors). Cleared after 3 s. */
let statusTimer = null;
export function hudStatus(text) {
    if (!status) return;
    status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { if (status) status.textContent = ''; }, 3000);
}

/** Write one snapshot (from `perfHarness.snapshot()`). */
export function renderHud(s) {
    if (!body) return;
    const f = s.frames;
    const w = s.frameWork;
    const r = s.react;
    const lines = [
        `PERF HUD  ${s.scenario ? s.scenario.id + ' ' + s.scenario.name : 'live game'}  ·  ${fmt(s.windowSeconds, 0)} s${s.hiddenMs > 0 ? '  ·  ⚠ hidden ' + fmt(s.hiddenMs / 1000, 0) + ' s' : ''}`,
        `frame Δ   p50 ${fmt(f.p50)}  p95 ${fmt(f.p95)}  p99 ${fmt(f.p99)}  max ${fmt(f.max, 1)} ms  ~${fmt(s.refreshHz, 0)} Hz`,
        `  over 6.06: ${int(f.over['6.06ms'])}  8.33: ${int(f.over['8.33ms'])}  16.7: ${int(f.over['16.7ms'])}  of ${int(f.count)}  (${fmt(f.pctAtOrUnder['6.06ms'], 1)}% ≤ 6.06)`,
        `frame work p50 ${fmt(w.p50)}  p95 ${fmt(w.p95)}  p99 ${fmt(w.p99)}  max ${fmt(w.max, 1)} ms (est.)`,
        `LoAF ${s.loaf.supported ? int(s.loaf.count) + '  max ' + fmt(s.loaf.maxMs, 0) + ' ms' : 'unsupported'}${s.loaf.top ? '  top: ' + s.loaf.top : ''}`,
        `tick p50 ${fmt(s.tick.p50)}  p99 ${fmt(s.tick.p99)}  max ${fmt(s.tick.max)} ms  · ${fmt(s.tick.perSecond, 1)}/s`,
        s.reactArmed
            ? `react/s  mat subtree commits ${fmt(r.MatBoard, 1)} (MatBoard itself ${fmt(s.ownRenders?.MatBoard, 1)})  dock ${fmt(r.HeroDock, 1)}  drawer ${fmt(r.Drawer, 1)}  bar ${fmt(r.TopBar, 1)}`
            : 'react/s  off — reload with the HUD on to count commits',
        `events/s ${int(s.eventsPerSecond)}  listeners ${int(s.listeners)}  DOM ${int(s.domNodes)}  heap ${s.heapMb === null ? 'n/a' : fmt(s.heapMb, 0) + ' MB'}`
    ];
    body.textContent = lines.join('\n');
}
