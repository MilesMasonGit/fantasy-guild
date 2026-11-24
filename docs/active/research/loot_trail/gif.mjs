// A small GIF encoder (Node): RGBA frames of one size, each with its own delay, looped forever. Only
// what changed since the last frame is written, the rest left transparent, so a still background
// costs almost nothing. Up to 255 colours exactly; past that, the rest go to the nearest of the most
// used 255.

/** @param {Uint8Array[]} frames RGBA, w*h*4 each  @param {number[]} delaysCs per frame, hundredths of a second */
export function encodeGif(frames, w, h, delaysCs) {
    const px = frames.map(f => new Uint32Array(f.buffer, f.byteOffset, w * h));
    const counts = new Map();
    for (const f of px) for (let i = 0; i < f.length; i++) counts.set(f[i], (counts.get(f[i]) || 0) + 1);
    let colours = [...counts.keys()];
    if (colours.length > 255) colours = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(e => e[0]);
    const index = new Map(colours.map((c, i) => [c, i + 1]));
    const rgb = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
    const idx = (c) => {
        let v = index.get(c);
        if (v !== undefined) return v;
        const [r, g, b] = rgb(c);
        let bd = Infinity;
        colours.forEach((k, i) => { const [r2, g2, b2] = rgb(k); const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (d < bd) { bd = d; v = i + 1; } });
        index.set(c, v);
        return v;
    };

    const out = [];
    const u8 = (v) => out.push(v & 255);
    const u16 = (v) => { u8(v); u8(v >> 8); };
    for (const ch of 'GIF89a') u8(ch.charCodeAt(0));
    u16(w); u16(h);
    u8(0xF7); u8(0); u8(0);
    for (let i = 0; i < 256; i++) { const c = i === 0 || i > colours.length ? [0, 0, 0] : rgb(colours[i - 1]); u8(c[0]); u8(c[1]); u8(c[2]); }
    u8(0x21); u8(0xFF); u8(11); for (const ch of 'NETSCAPE2.0') u8(ch.charCodeAt(0)); u8(3); u8(1); u16(0); u8(0);

    let prev = null;
    px.forEach((f, n) => {
        let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
        if (prev) {
            x0 = w; y0 = h; x1 = -1; y1 = -1;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (f[i] !== prev[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            }
            if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
        }
        const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
        const data = new Uint8Array(fw * fh);
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
            const i = (y + y0) * w + (x + x0);
            data[y * fw + x] = prev && f[i] === prev[i] ? 0 : idx(f[i]);
        }
        u8(0x21); u8(0xF9); u8(4); u8(0x05); u16(Math.max(2, delaysCs[n] | 0)); u8(0); u8(0);
        u8(0x2C); u16(x0); u16(y0); u16(fw); u16(fh); u8(0);
        u8(8);
        const z = lzw(data, 8);
        for (let i = 0; i < z.length; i += 255) { const k = Math.min(255, z.length - i); u8(k); for (let j = 0; j < k; j++) out.push(z[i + j]); }
        u8(0);
        prev = f;
    });
    u8(0x3B);
    return Buffer.from(out);
}

function lzw(px, minSize) {
    const clear = 1 << minSize, eoi = clear + 1;
    let size = minSize + 1, next = eoi + 1;
    let table = new Map();
    const out = [];
    let acc = 0, bits = 0;
    const emit = (code) => { acc |= code << bits; bits += size; while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; } };
    emit(clear);
    let cur = px[0];
    for (let i = 1; i < px.length; i++) {
        const k = px[i];
        const key = (cur << 8) | k;
        const hit = table.get(key);
        if (hit !== undefined) { cur = hit; continue; }
        emit(cur);
        if (next === 4096) { emit(clear); next = eoi + 1; size = minSize + 1; table = new Map(); }
        else { if (next >= (1 << size)) size++; table.set(key, next++); }
        cur = k;
    }
    emit(cur);
    emit(eoi);
    if (bits > 0) out.push(acc & 255);
    return out;
}
