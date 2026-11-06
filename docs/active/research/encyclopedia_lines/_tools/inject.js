// Throwaway (brief 470 E1): evaluated in the running game's page by capture.mjs, with the encyclopedia
// open on a chart. It works out what kind of relationship each drawn line is (from the chart's own
// code, the same nodes the screen grew) and restyles the lines in place for one mock-up option.
// Nothing here is game code.
//   await window.E1.apply('A' | 'B' | 'C' | 'D')   A today, B line styles, C words on the line, D styles in colour
//   window.E1.kinds()                              each drawn line's id, family and word (after apply)
(() => {
    const INK = '#3b2614';
    const PARCHMENT = '#e1d3a2';
    const BAND_PAGE = '#d4c597';
    const SVGNS = 'http://www.w3.org/2000/svg';
    // Option D's inks. Deep tones that read on the parchment; not the UI's meaning colours.
    const D_INK = { used: INK, kept: '#1d4f86', gives: '#2f6a1f', world: INK };

    let kinds = new Map();

    // ── what each line is ──────────────────────────────────────────────────────────────────────
    // A family the player reads (used up, needed and kept, comes out of) and the word option C writes.
    const LEFT_FROM = {
        craft: (w, book) => ({ fam: 'kept', word: book.entryOf(w.recipe)?.def?.skill === 'construction' ? 'built on' : 'made at' }),
        member: () => ({ fam: 'kept', word: 'one of' }),
        work: (w, book) => ({ fam: 'gives', word: /chest/i.test(book.nameOf(w.from)) ? 'opens' : 'gives' }),
        drop: () => ({ fam: 'gives', word: 'drops' }),
        bonus: () => ({ fam: 'gives', word: 'bonus' }),
        catch: () => ({ fam: 'gives', word: 'catch' }),
        spawn: () => ({ fam: 'gives', word: 'spawns' }),
        regrow: () => ({ fam: 'gives', word: 'leaves' }),
        grow: () => ({ fam: 'gives', word: 'grows' }),
        turn: () => ({ fam: 'gives', word: 'turns' }),
        trickle: () => ({ fam: 'gives', word: 'gives' }),
        upgrade: () => ({ fam: 'gives', word: 'gives' })
    };
    const RIGHT_USE = {
        craft: () => ({ fam: 'used', word: null }),
        hold: () => ({ fam: 'kept', word: 'tool for' }),
        growNearby: () => ({ fam: 'kept', word: 'beside' }),
        shop: () => ({ fam: 'used', word: null }),
        catch: () => ({ fam: 'used', word: null }),
        spawn: () => ({ fam: 'used', word: null }),
        grow: () => ({ fam: 'used', word: null }),
        work: () => ({ fam: 'used', word: null })
    };
    const RIGHT_GIVE = {
        station: () => ({ fam: 'kept', word: 'makes' }),
        build: () => ({ fam: 'kept', word: 'builds' }),
        work: () => ({ fam: 'gives', word: 'gives' }),
        catch: () => ({ fam: 'gives', word: 'catch' }),
        drop: () => ({ fam: 'gives', word: 'drops' }),
        bonus: () => ({ fam: 'gives', word: 'bonus' }),
        spawn: () => ({ fam: 'gives', word: 'spawns' }),
        grow: () => ({ fam: 'gives', word: 'grows' }),
        regrow: () => ({ fam: 'gives', word: 'leaves' }),
        trickle: () => ({ fam: 'gives', word: 'gives' }),
        upgrade: () => ({ fam: 'gives', word: 'gives' }),
        craft: () => ({ fam: 'gives', word: 'makes' })
    };
    // The shared stretch into the box: plain when anything along it is used up, else the kind of its one source.
    const trunkFam = (way) => (way.inputs.length || way.how === 'craft' || way.how === 'shop' ? 'used'
        : way.how === 'member' ? 'kept' : way.how === 'world' ? 'world' : 'gives');

    async function classify() {
        const M = await import('/src/ui/components/encyclopedia/encyclopediaModel.js');
        const C = await import('/src/ui/components/encyclopedia/encyclopediaChart.js');
        const book = M.encyclopedia();
        const start = document.querySelector('[data-codex-node="s"]').dataset.codexKey;
        const ids = (attr) => new Set([...document.querySelectorAll(`[data-codex-node][${attr}="true"]`)].map(e => e.dataset.codexNode));
        const chart = C.chartOf(book, start, { grown: ids('data-grown'), far: ids('data-far-open') });
        const map = new Map();
        const walk = (node) => {
            for (const b of node.ins || []) {
                const how = b.way.how;
                map.set(`${b.id}>`, { fam: trunkFam(b.way), word: null, how, part: 'trunk' });
                map.set(`${b.id}~`, { fam: 'world', word: null, how, part: 'caption' });
                if (b.from) {
                    const k = (LEFT_FROM[how] || (() => ({ fam: 'gives', word: how })))(b.way, book);
                    map.set(`${b.from.id}>`, { ...k, how, part: 'from' });
                }
                b.inputs.forEach((it) => map.set(`${it.id}>`, { fam: 'used', word: null, how, part: 'input' }));
                for (const c of [b.from, ...b.inputs]) if (c && !c.pass) walk(c);
            }
            for (const u of node.outs || []) {
                const how = u.way.how;
                const table = u.way.gives ? RIGHT_GIVE : RIGHT_USE;
                const k = (table[how] || (() => ({ fam: u.way.gives ? 'gives' : 'used', word: how })))(u.way, book);
                map.set(`${u.id}>`, { ...k, how: `${u.way.gives ? 'gives:' : 'used:'}${how}`, part: 'use' });
                if (!u.node.pass) walk(u.node);
            }
            if (node.passBand) map.set(`${node.passBand.id}>`, { fam: 'used', word: null, how: 'pass', part: 'pass' });
        };
        walk(chart);
        return map;
    }

    // ── drawing ────────────────────────────────────────────────────────────────────────────────
    function reset() {
        document.querySelectorAll('[data-e1]').forEach(e => e.remove());
        for (const g of document.querySelectorAll('g[data-codex-link]')) {
            const line = g.querySelector('polyline');
            const arrow = g.querySelector('polygon');
            for (const el of [line, arrow]) {
                if (!el || !el.dataset.e1orig) continue;
                const o = JSON.parse(el.dataset.e1orig);
                for (const [k, v] of Object.entries(o)) (v == null ? el.removeAttribute(k) : el.setAttribute(k, v));
                delete el.dataset.e1orig;
            }
        }
    }
    const remember = (el, attrs) => {
        if (!el || el.dataset.e1orig) return;
        el.dataset.e1orig = JSON.stringify(Object.fromEntries(attrs.map(a => [a, el.getAttribute(a)])));
    };
    const ATTRS = ['stroke', 'stroke-width', 'stroke-dasharray', 'fill', 'stroke-linejoin'];

    // Whether a point of the chart sits on a way's faint band (the page there is a shade darker).
    const onBand = (x, y) => [...document.querySelectorAll('rect[data-codex-band]')].some(r => {
        const bx = +r.getAttribute('x'), by = +r.getAttribute('y');
        return x >= bx && x <= bx + +r.getAttribute('width') && y >= by && y <= by + +r.getAttribute('height');
    });

    function styleLine(g, k, palette) {
        const line = g.querySelector('polyline');
        const arrow = g.querySelector('polygon');
        remember(line, ATTRS);
        remember(arrow, ATTRS);
        const ink = palette[k.fam] || INK;
        line.setAttribute('stroke', ink);
        if (arrow) arrow.setAttribute('fill', ink);
        if (k.fam === 'kept') {
            // Needed but kept: a dashed line, a hollow arrow (nothing flows along it).
            line.setAttribute('stroke-dasharray', '6 4');
            if (arrow) {
                const pts = arrow.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
                const [, tip] = pts;
                arrow.setAttribute('fill', onBand(tip[0] - 12, tip[1]) ? BAND_PAGE : PARCHMENT);
                arrow.setAttribute('stroke', ink);
                arrow.setAttribute('stroke-width', '2');
                arrow.setAttribute('stroke-linejoin', 'miter');
            }
        } else if (k.fam === 'gives') {
            // Comes out of it: a doubled line, two 2 px strokes with the page between.
            line.setAttribute('stroke-width', '6');
            const inner = line.cloneNode();
            inner.removeAttribute('data-e1orig');
            inner.setAttribute('data-e1', '');
            inner.setAttribute('stroke-width', '2');
            const [x, y] = line.getAttribute('points').split(' ')[0].split(',').map(Number);
            inner.setAttribute('stroke', onBand(x + 2, y) ? BAND_PAGE : PARCHMENT);
            line.after(inner);
        }
    }

    // Option C: the kind in a small ink word on the line, near the box it starts from (left) or reaches (right).
    function wordOn(g, k, canvas) {
        if (!k.word) return;
        const pts = g.querySelector('polyline').getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        const span = document.createElement('span');
        span.setAttribute('data-e1', 'word');
        span.className = 'absolute whitespace-nowrap ui-text-ink ui-text-small font-bold pointer-events-none';
        span.textContent = k.word;
        span.style.lineHeight = '1';
        canvas.appendChild(span);
        const w = span.offsetWidth, h = span.offsetHeight;
        let x, y;
        if (k.part === 'use') {
            // On the line itself, just past its skill mark (the line breaks round it, like the mark).
            const [lx, ly] = pts[pts.length - 1];
            const base = canvas.getBoundingClientRect();
            const mark = canvas.querySelector(`[data-codex-line-label="${g.dataset.codexLink.slice(0, -1)}@"]`);
            x = mark ? mark.getBoundingClientRect().right - base.left + 4 : pts[1][0] + 10;
            y = ly - h / 2;
            // No room on the line beside the mark (today's gap between columns): over the mark instead.
            if (x + w > lx - 10) { x = lx - 12 - w; y = mark ? mark.getBoundingClientRect().top - base.top - h - 1 : ly - 4 - h; }
            else span.style.background = onBand(x, ly) ? BAND_PAGE : PARCHMENT;
            span.style.padding = '0 2px';
        } else {
            const [sx, sy] = pts[0];
            const joinY = pts.length > 2 ? pts[2][1] : sy;
            x = sx + 4;
            y = joinY < sy ? sy + 4 : sy - 4 - h;
        }
        span.style.left = `${Math.round(x)}px`;
        span.style.top = `${Math.round(y)}px`;
    }

    function legend(palette) {
        const chart = document.querySelector('[data-codex-chart]');
        const box = document.createElement('div');
        box.setAttribute('data-e1', 'legend');
        box.className = 'absolute flex flex-col gap-1 ui-text-ink ui-text-small font-bold pointer-events-none';
        box.style.cssText += `right:12px;bottom:12px;padding:6px 10px;background:${PARCHMENT};border:2px solid ${INK};`;
        const row = (fam, words) => {
            const ink = palette[fam];
            const line = fam === 'kept'
                ? `<line x1="0" y1="7" x2="30" y2="7" stroke="${ink}" stroke-width="2" stroke-dasharray="6 4"/><polygon points="30,2 38,7 30,12" fill="${PARCHMENT}" stroke="${ink}" stroke-width="2"/>`
                : fam === 'gives'
                    ? `<line x1="0" y1="7" x2="32" y2="7" stroke="${ink}" stroke-width="6"/><line x1="0" y1="7" x2="32" y2="7" stroke="${PARCHMENT}" stroke-width="2"/><polygon points="30,2 38,7 30,12" fill="${ink}"/>`
                    : `<line x1="0" y1="7" x2="32" y2="7" stroke="${ink}" stroke-width="2"/><polygon points="30,2 38,7 30,12" fill="${ink}"/>`;
            return `<div class="flex items-center gap-2"><svg width="40" height="14" shape-rendering="crispEdges">${line}</svg><span class="ui-text-ink ui-text-small font-bold" style="color:${ink}">${words}</span></div>`;
        };
        box.innerHTML = row('used', 'used up') + row('kept', 'needed, kept') + row('gives', 'comes out of');
        chart.appendChild(box);
    }

    async function apply(opt) {
        reset();
        kinds = await classify();
        if (opt === 'A') return report();
        const canvas = document.querySelector('[data-codex-canvas]');
        const palette = opt === 'D' ? D_INK : { used: INK, kept: INK, gives: INK, world: INK };
        for (const g of document.querySelectorAll('g[data-codex-link]')) {
            const k = kinds.get(g.dataset.codexLink);
            if (!k) continue;
            if (opt === 'B' || opt === 'D') styleLine(g, k, palette);
            if (opt === 'C') wordOn(g, k, canvas);
        }
        if (opt === 'B' || opt === 'D') legend(palette);
        return report();
    }

    function report() {
        const drawn = [...document.querySelectorAll('g[data-codex-link]')].map(g => g.dataset.codexLink);
        const missing = drawn.filter(id => !kinds.has(id));
        const fams = {};
        for (const id of drawn) { const k = kinds.get(id); if (k) fams[`${k.fam}/${k.how}/${k.part}`] = (fams[`${k.fam}/${k.how}/${k.part}`] || 0) + 1; }
        return { drawn: drawn.length, missing, fams };
    }

    window.E1 = { apply, reset, kinds: () => [...kinds.entries()] };
})();
