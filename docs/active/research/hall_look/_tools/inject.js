// Throwaway (brief 390 G1): evaluated in the running game's page by capture.mjs. It changes the open
// Guild Hall screen's DOM in place to show a mock-up option. Nothing here is game code.
// window.G1.layout({ k, below, ranks })   spacing factor k from the Hall, titles below, rank numbers on/off
// window.G1.stars(treatment)              'A' plain (today), 'B' faint picture behind, 'C' outline over, 'D' dotted figure
// window.G1.frame(kind)                   'E' today, 'F' purple studs, 'G' purple night panel
// window.G1.overlaps()                    pairs of star titles whose boxes overlap (to pick the spacing)
(() => {
    const SKY_SCALE_NOW = () => Number(document.querySelector('[data-guild-hall-board]').dataset.skyScale) || 0.75;
    const TARGET_SCALE = 0.75; // the scale a 1920 x 1080 window shows the sky at today

    // Which item each star shows as an outline: tools for speed, products for yield, a quill for lore,
    // a torch for camp reach, the item itself for the Well. Only a suggestion; in the game it would be content.
    const ITEM = {
        roster_size: '/assets/tokens/upgrade/t_bunk_bed.png',
        bank_tabs: '/assets/items/key/i_key_gold.png',
        wishing_well: '/assets/items/drink/i_water.png',
        star_infirmary: '/assets/items/potion/i_potion_round_red.png',
        star_larder: '/assets/items/food/i_bread.png',
        star_trinket_case: '/assets/items/jewelry/i_ring_gold_ruby.png',
        star_forestry_speed: '/assets/items/tool/i_woodaxe_copper.png',
        star_forestry_yield: '/assets/items/wood/i_wood_oak.png',
        star_forestry_xp: '/assets/items/mat/i_feather.png',
        star_forestry_regrowth: '/assets/items/seed/i_seedling_oak.png',
        star_forestry_camp_reach: '/assets/items/mat/i_torch.png',
        star_mining_speed: '/assets/items/tool/i_pick_copper.png',
        star_mining_yield: '/assets/items/ore/i_ore_copper.png',
        star_mining_xp: '/assets/items/mat/i_feather.png',
        star_mining_vein_rest: '/assets/items/ore/i_ore_iron.png',
        star_mining_camp_reach: '/assets/items/mat/i_torch.png',
        star_smithing_speed: '/assets/items/tool/i_tongs.png',
        star_smithing_yield: '/assets/items/ingot/i_ingot_copper.png',
        star_smithing_xp: '/assets/items/mat/i_feather.png',
        star_fishing_speed: '/assets/items/tool/i_rod_wood.png',
        star_fishing_yield: '/assets/items/fish/i_trout_raw.png',
        star_fishing_xp: '/assets/items/mat/i_feather.png',
        star_fishing_camp_reach: '/assets/items/mat/i_torch.png',
        star_farming_speed: '/assets/items/seed/i_seed_pile.png',
        star_farming_yield: '/assets/items/mat/i_wheat.png',
        star_farming_xp: '/assets/items/mat/i_feather.png',
        star_farming_refill: '/assets/items/food/i_apple.png',
        star_farming_camp_reach: '/assets/items/mat/i_torch.png',
        star_cooking_speed: '/assets/items/ore/i_coal.png',
        star_cooking_yield: '/assets/items/food/i_pie_cherry.png',
        star_cooking_xp: '/assets/items/mat/i_feather.png',
        star_crafting_speed: '/assets/items/tool/i_chisel_copper.png',
        star_crafting_yield: '/assets/items/mat/i_plank_oak.png',
        star_crafting_xp: '/assets/items/mat/i_feather.png',
        star_construction_speed: '/assets/items/mat/i_stone_brick.png',
        star_construction_xp: '/assets/items/mat/i_feather.png',
        star_alchemy_speed: '/assets/items/potion/i_potion_bottle.png',
        star_alchemy_yield: '/assets/items/potion/i_potion_tube_green.png',
        star_alchemy_xp: '/assets/items/mat/i_feather.png',
        star_alchemy_herb_refill: '/assets/items/herb/i_lavender.png',
        star_well_oak_wood: '/assets/items/wood/i_wood_oak.png',
        star_well_copper_ore: '/assets/items/ore/i_ore_copper.png',
        star_well_stone: '/assets/items/mat/i_stone.png',
        star_well_coal: '/assets/items/ore/i_coal.png',
        star_well_raw_shrimp: '/assets/items/fish/i_shrimp_raw.png',
        star_well_iron_ore: '/assets/items/ore/i_ore_iron.png',
        star_well_fir_wood: '/assets/items/wood/i_wood_fir.png'
    };

    const COLOUR = { grey: [170, 178, 200], blue: [138, 180, 255], gold: [255, 216, 74] };
    const ALPHA = { locked: 0.32, buyable: 0.6, bought: 0.85, maxed: 1 };

    const imgCache = new Map();
    const loadImg = (src) => {
        if (!imgCache.has(src)) {
            imgCache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
        }
        return imgCache.get(src);
    };
    const maskCache = new Map();
    // The sprite's silhouette as a 32 x 32 boolean grid (a bigger Token sprite is fitted to 32).
    async function maskOf(src) {
        if (maskCache.has(src)) return maskCache.get(src);
        const img = await loadImg(src);
        const N = 32;
        const c = document.createElement('canvas'); c.width = N; c.height = N;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        if (img) {
            const s = Math.min(N / img.width, N / img.height);
            const w = Math.round(img.width * s), h = Math.round(img.height * s);
            x.drawImage(img, Math.floor((N - w) / 2), Math.floor((N - h) / 2), w, h);
        }
        const d = x.getImageData(0, 0, N, N).data;
        const m = [];
        for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) m.push(d[(y * N + i) * 4 + 3] > 96);
        const res = { N, m };
        maskCache.set(src, res);
        return res;
    }
    const at = (mask, i, y) => i >= 0 && y >= 0 && i < mask.N && y < mask.N && mask.m[y * mask.N + i];
    // The silhouette's edge: filled pixels with an empty 4-neighbour.
    function edgeOf(mask) {
        const out = [];
        for (let y = 0; y < mask.N; y++) for (let i = 0; i < mask.N; i++) {
            if (!at(mask, i, y)) continue;
            if (!at(mask, i - 1, y) || !at(mask, i + 1, y) || !at(mask, i, y - 1) || !at(mask, i, y + 1)) out.push([i, y]);
        }
        return out;
    }
    // A picture of an outline: `px` art pixels drawn at `scale` screen px each, as a canvas element.
    function canvasOf(N, scale, draw) {
        const c = document.createElement('canvas');
        c.width = N; c.height = N;
        const x = c.getContext('2d');
        draw(x);
        c.style.width = `${N * scale}px`;
        c.style.height = `${N * scale}px`;
        c.style.imageRendering = 'pixelated';
        return c;
    }
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    function clearStars() {
        document.querySelectorAll('[data-g1-outline]').forEach(e => e.remove());
        document.querySelectorAll('[data-g1-px]').forEach(e => { delete e.dataset.g1Px; });
        document.querySelectorAll('[data-hall-node] img').forEach(e => { e.style.position = ''; e.style.zIndex = ''; });
    }

    async function stars(t) {
        clearStars();
        if (t === 'A') return;
        const buttons = [...document.querySelectorAll('button[data-hall-node]')].filter(b => b.dataset.hallNode !== 'hall');
        for (const b of buttons) {
            const id = b.dataset.hallNode;
            const src = ITEM[id];
            if (!src) continue;
            const mask = await maskOf(src);
            const edge = edgeOf(mask);
            const state = b.dataset.nodeState;
            const col = COLOUR[b.dataset.starLook] || COLOUR.grey;
            const a = ALPHA[state] ?? 0.5;
            let el;
            if (t === 'B') {
                // A faint picture behind the star: the item's edge, 1 art px, at 3x (96 px), so it rings even a big star.
                el = canvasOf(mask.N, 3, (x) => {
                    x.fillStyle = rgba(col, Math.min(1, a * 0.75));
                    for (const [i, y] of edge) x.fillRect(i, y, 1, 1);
                });
                el.style.zIndex = '0';
            } else if (t === 'C') {
                // The outline over the star, bright, with a dark edge so it reads on the sky.
                const N = mask.N + 2;
                el = canvasOf(N, 2, (x) => {
                    x.fillStyle = 'rgba(8,6,26,0.9)';
                    for (const [i, y] of edge) for (const [dx, dy] of [[0, 1], [1, 0], [2, 1], [1, 2]]) {
                        if (!at(mask, i + dx - 1, y + dy - 1) || true) x.fillRect(i + dx, y + dy, 1, 1);
                    }
                    x.fillStyle = rgba(col, Math.max(0.55, a));
                    for (const [i, y] of edge) x.fillRect(i + 1, y + 1, 1, 1);
                });
                el.style.zIndex = '2';
            } else if (t === 'D') {
                // A dotted figure: every other edge pixel as a dot, the picture at 3x (96 px), like a constellation.
                const pts = edge.filter(([i, y]) => (i + y) % 2 === 0);
                el = canvasOf(mask.N, 3, (x) => {
                    x.fillStyle = rgba(col, Math.min(1, a * 0.9));
                    for (const [i, y] of pts) x.fillRect(i, y, 1, 1);
                });
                el.style.zIndex = '0';
            }
            el.dataset.g1Outline = t;
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.pointerEvents = 'none';
            b.style.position = 'relative';
            const img = b.querySelector('img');
            img.style.position = 'relative';
            img.style.zIndex = '1';
            b.appendChild(el);
            b.dataset.g1Px = String(parseInt(el.style.width, 10));
        }
    }

    // ---------------------------------------------------------------- layout
    let base = null; // positions as the game drew them, read once
    const centreOf = (el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
    function readBase() {
        if (base) return base;
        const board = document.querySelector('[data-guild-hall-board]');
        const hallWrap = board.querySelector('button[data-hall-node="hall"]').parentElement;
        const hall = { x: hallWrap.offsetLeft + hallWrap.offsetWidth / 2, y: hallWrap.offsetTop + hallWrap.querySelector('button').offsetHeight / 2 };
        const s = SKY_SCALE_NOW();
        const rel = (p) => ({ x: (p.x - hall.x) / s, y: (p.y - hall.y) / s }); // in natural web px
        base = {
            board, s, hall, hallWrap,
            w: board.offsetWidth / s, h: board.offsetHeight / s,
            stars: [...board.querySelectorAll('button[data-hall-node]')].filter(b => b.dataset.hallNode !== 'hall').map(b => {
                const wrap = b.parentElement;
                const tag = wrap.querySelector('[data-star-tag]');
                return { b, wrap, tag, side: tag.dataset.starTag, tagStyle: tag.getAttribute('style'), c: rel(centreOf(wrap)), size: wrap.offsetWidth };
            }),
            lines: [...board.querySelectorAll('svg line')].map(l => ({ l, a: rel({ x: +l.getAttribute('x1'), y: +l.getAttribute('y1') }), z: rel({ x: +l.getAttribute('x2'), y: +l.getAttribute('y2') }) })),
            names: [...board.querySelectorAll('[data-constellation]')].map(d => ({ d, c: rel({ x: d.offsetLeft, y: d.offsetTop + 8 }) }))
        };
        return base;
    }

    function layout({ k = 1, below = false, ranks = true, hoverRank = null } = {}) {
        const B = readBase();
        const sc = TARGET_SCALE * k;
        const w = Math.round(B.w * TARGET_SCALE * k), h = Math.round(B.h * TARGET_SCALE * k);
        const hx = Math.round(w / 2), hy = Math.round(h / 2);
        const P = (r) => ({ x: Math.round(hx + r.x * sc), y: Math.round(hy + r.y * sc) });
        B.board.style.width = `${w}px`;
        B.board.style.height = `${h}px`;
        const svg = B.board.querySelector('svg');
        svg.setAttribute('width', w); svg.setAttribute('height', h);
        B.hallWrap.style.left = `${hx - B.hallWrap.offsetWidth / 2}px`;
        B.hallWrap.style.top = `${hy - B.hallWrap.querySelector('button').offsetHeight / 2}px`;
        for (const s of B.stars) {
            const p = P(s.c);
            s.wrap.style.left = `${p.x - s.size / 2}px`;
            s.wrap.style.top = `${p.y - s.size / 2}px`;
            s.tag.setAttribute('style', s.tagStyle);
            if (below) {
                const starPx = s.b.querySelector('img').offsetWidth;
                const mid = s.size / 2;
                const gap = Math.max(starPx, Number(s.b.dataset.g1Px || 0)) / 2 + 2;
                s.tag.setAttribute('style', `left:${mid}px; top:${mid + gap}px; width:0px; justify-content:center;`);
            }
            const r = s.tag.querySelector('[data-node-rank]');
            const showRank = ranks || hoverRank === s.b.dataset.hallNode;
            r.style.display = showRank ? '' : 'none';
        }
        for (const L of B.lines) {
            const a = P(L.a), z = P(L.z);
            L.l.setAttribute('x1', a.x); L.l.setAttribute('y1', a.y); L.l.setAttribute('x2', z.x); L.l.setAttribute('y2', z.y);
        }
        for (const n of B.names) {
            const p = P(n.c);
            n.d.style.left = `${p.x}px`;
            n.d.style.top = `${p.y - 8}px`;
        }
        return { w, h };
    }

    // Star titles (and the Hall's) whose boxes overlap each other or another star.
    function overlaps() {
        const B = readBase();
        const boxes = B.stars.map(s => ({ id: s.b.dataset.hallNode, r: s.tag.querySelector('span').getBoundingClientRect(), star: s.b.querySelector('img').getBoundingClientRect() }));
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const out = [];
        for (let i = 0; i < boxes.length; i++) for (let j = 0; j < boxes.length; j++) {
            if (i === j) continue;
            if (j > i && hit(boxes[i].r, boxes[j].r)) out.push(`${boxes[i].id} title x ${boxes[j].id} title`);
            if (hit(boxes[i].r, boxes[j].star)) out.push(`${boxes[i].id} title x ${boxes[j].id} star`);
        }
        const names = B.names.map(n => ({ id: n.d.dataset.constellation, r: n.d.querySelector('span').getBoundingClientRect() }));
        for (const n of names) for (const b of boxes) {
            if (hit(n.r, b.r)) out.push(`${n.id} name x ${b.id} title`);
            if (hit(n.r, b.star)) out.push(`${n.id} name x ${b.id} star`);
        }
        return out;
    }

    // ---------------------------------------------------------------- frames
    // A 7 x 7 frame picture as an SVG data URL, from a grid of colour keys (like tailwind.css's gold and red editions).
    function frameUrl(rows, pal) {
        let paths = '';
        for (const [key, col] of Object.entries(pal)) {
            let d = '';
            rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === key) d += `M${x} ${y}h1v1h-1z`; }));
            if (d) paths += `<path fill='${col}' d='${d}'/>`;
        }
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'>${paths}</svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
    // The studs frame's shape (o = edge, s = stud light, f = fill), as in .ui-frame-studs-gold.
    const STUDS = ['ooooooo', 'osofoso', 'oofffoo', 'offfffo', 'oofffoo', 'osofoso', 'ooooooo'];
    // A chamfer with a second, lighter line inside: a night-sky panel edge.
    const NIGHT = ['..ooo..', '.oiiio.', 'oifffio', 'oifffio', 'oifffio', '.oiiio.', '..ooo..'];
    let frameStyle = null;
    function frame(kind) {
        frameStyle?.remove();
        frameStyle = null;
        if (kind === 'E') return;
        const panel = document.querySelector('[data-hall-return]')?.closest('.gap-3');
        let css = '';
        if (kind === 'F') {
            const studs = frameUrl(STUDS, { o: '#7c3aed', s: '#ddd6fe', f: '#0d0a08' });
            css = `.g1-panel > [data-pixel-frame] > .ui-frame-studs { border-image-source: ${studs} !important; }
                   .g1-panel > [data-pixel-frame] > .ui-frame-chamfer { border-image-source: ${frameUrl(['..ooo..', '.offfo.', 'offfffo', 'offfffo', 'offfffo', '.offfo.', '..ooo..'], { o: '#7c3aed', f: '#0d0a08' })} !important; }`;
        } else if (kind === 'G') {
            const night = frameUrl(NIGHT, { o: '#4c1d95', i: '#a78bfa', f: '#140c2a' });
            css = `.g1-panel > [data-pixel-frame] > .ui-frame-studs, .g1-panel > [data-pixel-frame] > .ui-frame-chamfer { border-image-source: ${night} !important; }
                   .g1-panel [data-inspection-panel], .g1-panel .bg-black\\/40, .g1-panel .bg-black\\/60 { background-color: transparent !important; }`;
        }
        panel?.classList.add('g1-panel');
        frameStyle = document.createElement('style');
        frameStyle.textContent = css;
        document.head.appendChild(frameStyle);
    }

    window.G1 = { layout, stars, overlaps, frame, readBase, ITEM };
})();
