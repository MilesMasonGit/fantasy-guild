// bench:crisp's art-pixel check: does every art pixel of every Token on the mat get the same whole
// number of screen pixels? (A sprite box rounded to whole mat units before the mat's scale came out
// a pixel narrow or wide, so one row of its art pixels was drawn a pixel thin or thick.)
//
// How: each Token's picture is swapped, in place, for a 64 × 64 test picture in which every pixel
// says where it is (red = 4·column + 2, green = 4·row + 2) and the blue says which Token it is.
// Everything else on the mat is hidden meanwhile (`visibility`, so nothing moves and the page keeps
// its layers), so no badge, outline or hero lies over the art; a pixel of the screen counts only
// where it and its four neighbours are all this Token's test picture, so what the page draws over
// the mat (the top bar, the hero bar's names) cannot read as art. The screenshot is read back along every screen row and
// column of each sprite: a run of one art pixel bounded by its own neighbours on both sides must
// be exactly the sprite's whole step long (its drawn width / 64).

/** Blue values per batch: Tokens beyond this many are judged in another batch. */
export const ART_BATCH = 120;

/**
 * In the page: hide the mat but for its Tokens' art, and give Tokens [from, from + ART_BATCH) of
 * the square pictures their test pictures. Resolves to their boxes once the pictures are decoded.
 */
export const ART_PICTURES_ON = (from) => `(async () => {
    if (!document.getElementById('crisp-art-only')) {
        const st = document.createElement('style');
        st.id = 'crisp-art-only';
        st.textContent = '[data-board-origin] * { visibility: hidden !important; } [data-board-origin] img[data-crisp-art] { visibility: visible !important; }';
        document.head.appendChild(st);
    }
    const make = (b) => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d'); const d = g.createImageData(64, 64);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const q = (y * 64 + x) * 4; d.data[q] = 4 * x + 2; d.data[q + 1] = 4 * y + 2; d.data[q + 2] = b; d.data[q + 3] = 255; }
        g.putImageData(d, 0, 0);
        return c.toDataURL('image/png');
    };
    window.__crispArtWas = window.__crispArtWas || new Map();
    for (const [img, src] of window.__crispArtWas) { img.setAttribute('src', src); img.removeAttribute('data-crisp-art'); }
    window.__crispArtWas.clear();
    const all = [...document.querySelectorAll('[data-board-origin] [data-token-art="true"] img:not([data-sprite-shadow])')]
        .filter(img => img.naturalWidth > 0 && img.naturalWidth === img.naturalHeight && !img.closest('[aria-hidden="true"]'));
    const batch = all.slice(${from}, ${from} + ${ART_BATCH});
    batch.forEach((img, k) => {
        window.__crispArtWas.set(img, img.getAttribute('src'));
        img.setAttribute('src', make(8 + 2 * k));
        img.setAttribute('data-crisp-art', String(8 + 2 * k));
    });
    await Promise.all(batch.map(img => img.decode().catch(() => null)));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
        total: all.length,
        boxes: batch.map(img => {
            const r = img.getBoundingClientRect();
            return { id: img.closest('[data-token-art]').dataset.tokenId, b: Number(img.dataset.crispArt), left: r.left, top: r.top, width: r.width, height: r.height };
        })
    };
})()`;

/** In the page: every picture back, the mat shown again. */
export const ART_PICTURES_OFF = `(() => {
    for (const [img, src] of (window.__crispArtWas || new Map())) { img.setAttribute('src', src); img.removeAttribute('data-crisp-art'); }
    window.__crispArtWas = new Map();
    document.getElementById('crisp-art-only')?.remove();
    return true;
})()`;

/**
 * How one test-pictured Token is drawn on a screenshot (`{ raw, width, height }`, RGBA).
 * Returns `{ verdict: 'exact' | 'uneven' | 'blended' | 'unseen', step, faults }`: `uneven` when an
 * art pixel bounded by its own neighbours is drawn other than `step` screen pixels (a thin or thick
 * row or column; 0 when one is dropped), `blended` when the picture is resampled rather than drawn
 * pixel for pixel. `faults` names them: `r59:1` is art row 59 drawn 1 px high.
 */
export function judgeArtPixels(shot, box) {
    const step = Math.max(1, Math.round(box.width / 64));
    // The box's outer screen row and column are left out: there Chrome blends the edge with
    // what is behind it.
    const x0 = Math.max(0, Math.ceil(box.left) + 1), x1 = Math.min(shot.width - 1, Math.floor(box.left + box.width) - 2);
    const y0 = Math.max(0, Math.ceil(box.top) + 1), y1 = Math.min(shot.height - 1, Math.floor(box.top + box.height) - 2);
    const at = (x, y) => {
        const p = (y * shot.width + x) * 4;
        if (shot.raw[p + 2] !== box.b) return null;
        const r = shot.raw[p], g = shot.raw[p + 1];
        if ((r - 2) % 4 || (g - 2) % 4) return { blend: true };
        return { tx: (r - 2) / 4, ty: (g - 2) / 4 };
    };
    let clean = 0, blend = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = at(x, y); if (v) { if (v.blend) blend++; else clean++; } }
    if (clean + blend < 200) return { verdict: 'unseen', step, faults: [] };
    if (blend > (clean + blend) * 0.05) return { verdict: 'blended', step, faults: [] };
    const bad = new Map();
    const note = (k, len) => { if (!bad.has(k)) bad.set(k, new Set()); bad.get(k).add(len); };
    // One screen line: the art pixels it crosses, in order. Along a line the other coordinate is one
    // texel all the way (nearest sampling); a pixel that disagrees is another Token's colour that
    // happens to decode, and counts as covered.
    // A pixel is trusted when it and its four neighbours are all this picture, drawn pixel for texel:
    // left and right one texel column apart at most on the same row, up and down the other way.
    const W = x1 - x0 + 1, H = y1 - y0 + 1;
    const grid = new Array(W * H);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = at(x, y); grid[(y - y0) * W + (x - x0)] = v && !v.blend ? v : null; }
    const cell = (x, y) => (x < x0 || y < y0 || x > x1 || y > y1 ? undefined : grid[(y - y0) * W + (x - x0)]);
    const near = (a, b, along) => b && (along === 'x' ? b.ty === a.ty && Math.abs(b.tx - a.tx) <= 1 : b.tx === a.tx && Math.abs(b.ty - a.ty) <= 1);
    const trusted = (x, y) => {
        const v = cell(x, y);
        if (!v) return null;
        for (const [dx, dy, along] of [[-1, 0, 'x'], [1, 0, 'x'], [0, -1, 'y'], [0, 1, 'y']]) {
            const n = cell(x + dx, y + dy);
            if (n === undefined) continue;   // the scan's own edge
            if (!near(v, n, along)) return null;
        }
        return v;
    };
    const line = (n, get, key, tag) => {
        const other = key === 'tx' ? 'ty' : 'tx';
        const vals = [];
        const count = new Map();
        for (let i = 0; i < n; i++) { const v = get(i); vals.push(v); if (v) count.set(v[other], (count.get(v[other]) || 0) + 1); }
        let mode = null, most = 0;
        for (const [k, c] of count) if (c > most) { most = c; mode = k; }
        let runT = null, runLen = 0, before = null;
        for (let i = 0; i <= n; i++) {
            const v = i < n ? vals[i] : null;
            const t = v && v[other] === mode ? v[key] : null;
            if (t !== null && t === runT) { runLen++; continue; }
            if (runT !== null && t === runT + 2 && before === runT - 1) note(`${tag}${runT + 1}`, 0);
            if (runT !== null && before === runT - 1 && t === runT + 1 && runLen !== step) note(`${tag}${runT}`, runLen);
            before = t === null ? null : runT;
            runT = t;
            runLen = t === null ? 0 : 1;
        }
    };
    for (let y = y0; y <= y1; y++) line(W, (i) => trusted(x0 + i, y), 'tx', 'c');
    for (let x = x0; x <= x1; x++) line(H, (i) => trusted(x, y0 + i), 'ty', 'r');
    const faults = [...bad.entries()].map(([k, lens]) => `${k}:${[...lens].join('/')}`);
    return { verdict: faults.length ? 'uneven' : 'exact', step, faults };
}
