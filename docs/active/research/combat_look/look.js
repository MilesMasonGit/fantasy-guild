// The mock-ups, drawn into the running game's page: the game's own frame classes, font, sprites and
// glyphs, nothing in the game changes. Numbers in the windows are samples. Loaded by capture_c1.mjs.
(async () => {
const { glyphSrc, GLYPH_COLOUR: GC, damageTypeGlyph: dtg } = await import('/src/ui/components/combat/combatGlyphs.js');
const FRAME = '#977316', FILL = '#0d0a08', GOLD = 'var(--color-ui-gold)', MUTED = '#8a8a8a';
const st = document.createElement('style');
st.textContent = `
.cl-after [data-fight-plate-slot], .cl-after [data-fight-chip-slot], .cl-after [data-health-bar], .cl-after [data-fight-float],
.cl-after [data-callout], .cl-after [data-fx-used] { visibility: hidden !important; }
.cl-root { position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 100000; pointer-events: none; color: #fff; line-height: 1.15; }
.cl-root * { box-sizing: border-box; }
.cl-abs { position: absolute; }
.cl-pix { image-rendering: pixelated; display: block; max-width: none; }
.cl-row { display: flex; align-items: center; gap: 6px; }
.cl-b { font-weight: 700; }
.cl-muted { color: ${MUTED}; }
.cl-line { height: 2px; background: rgba(255,255,255,.1); }
.cl-nw { white-space: nowrap; }
.cl-num { font-variant-numeric: tabular-nums; }
.cl-root .gi-ff-number { font-size: var(--font-size-lg); }
.cl-root .gi-ff-word { font-size: var(--font-size-sm); }
.cl-out { text-shadow: 2px 0 0 #000,-2px 0 0 #000,0 2px 0 #000,0 -2px 0 #000,2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000; }
`;
document.head.appendChild(st);
const root = document.createElement('div');
root.className = 'cl-root';
document.body.appendChild(root);

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const glyph = (name, colour = GC.text, k = 2) => `<img class="cl-pix" src="${glyphSrc(name, colour)}" style="width:${8 * k}px;height:${8 * k}px;flex:none">`;
const edge = 'text-shadow:2px 0 0 #000,-2px 0 0 #000,0 2px 0 #000,0 -2px 0 #000,2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000;';

/** The stylized bar, a stand-in for the pick in the hero bar brief: three reds in hard bands, notched every quarter, the number on it. */
function bar(cur, max, w, h, cls = 'ui-text-small') {
    const fill = Math.round((cur / max) * (w / 2)) * 2;
    const notches = [1, 2, 3].map(i => `<span class="cl-abs" style="left:${Math.round(w * i / 8) * 2}px;top:0;bottom:0;width:2px;background:rgba(13,10,8,.45)"></span>`).join('');
    return `<span style="position:relative;display:block;width:${w}px;height:${h}px;background:#2a1414;box-shadow:0 0 0 2px ${FILL};flex:none">
        <span class="cl-abs" style="left:0;top:0;bottom:0;width:${fill}px;background:#d8434c">
            <span class="cl-abs" style="left:0;right:0;top:0;height:2px;background:#f09595"></span>
            <span class="cl-abs" style="left:0;right:0;bottom:0;height:2px;background:#9c2733"></span>
        </span>${notches}
        <span class="cl-abs" style="left:-2px;top:0;bottom:0;width:2px;background:${FRAME}"></span>
        <span class="cl-abs" style="right:-2px;top:0;bottom:0;width:2px;background:${FRAME}"></span>
        <span class="cl-abs ${cls} cl-b cl-num cl-nw" style="left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;line-height:1;${edge}">${cur}/${max}</span>
    </span>`;
}

const frame = (inner, w, tone = '', pad = 0) => `<div style="position:relative;width:${w ? w + 'px' : 'auto'};padding:${6 + pad}px">
    <span class="ui-frame-shadow-chamfer cl-abs" style="inset:0"></span>
    <span class="ui-frame-chamfer ${tone} cl-abs" style="inset:0"></span>
    <div style="position:relative">${inner}</div></div>`;

/** The speech frame with its stepped tail, as `SpeechFrame.jsx` draws it. */
function bubble(text, tone = 'plain') {
    const line = { plain: '#977316', attention: '#facc15' }[tone];
    const px = (x, y, w = 1) => `M${x} ${y}h${w}v1h-${w}z`;
    const rows = [[0, 7], [1, 5], [2, 3], [3, 1]];
    const shadow = rows.map(([x, w], y) => px(x + 2, y + 2, w)).join('');
    const edgeP = rows.map(([x, w], y) => (w === 1 ? px(x, y) : px(x, y) + px(x + w - 1, y))).join('');
    const fill = rows.filter(([, w]) => w > 2).map(([x, w], y) => px(x + 1, y, w - 2)).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6' shape-rendering='crispEdges'><path fill='%23000' d='${shadow}'/><path fill='${line.replace('#', '%23')}' d='${edgeP}'/><path fill='%230d0a08' d='${fill}'/></svg>`;
    return `<div class="ui-text-small cl-b cl-nw" style="position:relative;padding:6px 8px;color:#fff;line-height:1.1">
        <span class="ui-frame-shadow-chamfer cl-abs" style="inset:0"></span>
        <span class="ui-frame-chamfer ${tone === 'attention' ? 'ui-frame-chamfer-gold' : ''} cl-abs" style="inset:0"></span>
        <span style="position:relative">${text}</span>
        <span class="cl-abs" style="left:50%;top:calc(100% - 2px);width:18px;height:12px;margin-left:-7px;background-image:url(&quot;data:image/svg+xml,${svg}&quot;);background-size:100% 100%;image-rendering:pixelated"></span>
    </div>`;
}

const heroArt = (k, col = 0, row = 2) => `<div class="cl-pix" style="width:${64 * k}px;height:${64 * k}px;background-image:url(/assets/heroes/hn_fighter_sheet.png);background-size:${512 * k}px ${192 * k}px;background-position:${-col * 64 * k}px ${-row * 64 * k}px"></div>`;
const enemyArt = (src, k) => `<img class="cl-pix" src="${src}" style="width:${64 * k}px;height:${64 * k}px">`;

const closeX = `<img class="cl-pix" src="/assets/ui/u_cancel_red.png" style="width:32px;height:32px">`;
/** Minimize: a stand-in drawn in code, the close X's size. */
const minBtn = `<span style="position:relative;display:block;width:32px;height:32px"><span class="cl-abs" style="left:6px;right:6px;bottom:6px;height:6px;background:#000"></span><span class="cl-abs" style="left:8px;right:8px;bottom:8px;height:2px;background:${GC.gold}"></span></span>`;
const titleBar = (f) => `<div class="cl-row" style="padding:0 2px 4px 4px;justify-content:space-between">
    <span class="ui-text-title cl-b cl-nw">${f.hero} <span class="cl-muted">vs</span> ${f.enemy}</span>
    <span class="cl-row" style="gap:2px">${minBtn}${closeX}</span></div>`;

/** The battle: the owner's battlefield at a whole scale, both fighters on it, the hero facing right. */
function arena(f, w, h, k, bgK, bars) {
    const off = bgK === 3 ? [-120, h - 768] : (h > 220 ? [-60, h - 420] : [-60, h - 512]);
    const bw = bars?.w ?? 0;
    const heroX = Math.round(w / 4 - 32 * k + (k === 3 ? 8 : 4));
    const enemyX = Math.round(3 * w / 4 - 32 * k - (k === 3 ? 8 : 4));
    const floatHero = f.floatHero ? `<span class="cl-abs gi-ff-red cl-b" style="font-size:var(--font-size-lg);line-height:1;left:${heroX + 32 * k}px;bottom:${64 * k - 40 - 6 * k}px;transform:translateX(-50%);${edge}">${f.floatHero}</span>` : '';
    const say = f.say ? `<div class="cl-abs" style="left:${enemyX + 32 * k}px;bottom:${64 * k + (bars ? bars.h + 18 : 16)}px;transform:translateX(-50%)">${bubble(f.say)}</div>` : '';
    const barsHtml = bars ? `<div class="cl-abs" style="left:${heroX + 32 * k - bw / 2}px;bottom:${64 * k + 4}px">${bar(f.hp[0], f.hp[1], bw, bars.h)}</div>
        <div class="cl-abs" style="left:${enemyX + 32 * k - bw / 2}px;bottom:${64 * k + 4}px">${bar(f.ehp[0], f.ehp[1], bw, bars.h)}</div>` : '';
    return `<div data-cl-arena style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#1a1512">
        <img class="cl-pix cl-abs" src="/assets/backgrounds/invasion/b_invasion_battlefield.png" style="left:${off[0]}px;top:${off[1]}px;width:${256 * bgK}px;height:${256 * bgK}px">
        <div class="cl-abs" style="left:${heroX}px;bottom:2px">${heroArt(k, 3, 0)}</div>
        <div class="cl-abs" style="left:${enemyX}px;bottom:2px">${enemyArt(f.sprite, k)}</div>
        ${barsHtml}${floatHero}${say}
    </div>`;
}

const hitVal = (h) => `<span class="cl-row" style="gap:6px">${h[0]} ${glyph(dtg(h[1]))}</span>`;
const skill = (s) => `<img class="cl-pix" src="/assets/skills/s_${s}.png" style="width:16px;height:16px;flex:none">`;

/** A side's stat block: one line each, icon, short name, the value at the right end. */
function stats(s) {
    const row = (icon, name, val) => `<div class="cl-row ui-text-small" style="justify-content:space-between;min-height:20px"><span class="cl-row">${icon}<span class="cl-muted">${name}</span></span><span class="cl-b cl-num cl-nw ui-text-body">${val}</span></div>`;
    return `<div style="display:flex;flex-direction:column;gap:2px">
        ${row(skill(s.style), s.styleName, s.lv)}
        ${row(glyph('hit'), 'Hit', hitVal(s.hit))}
        ${row(glyph('clock'), 'Swing', s.swing)}
        ${row(glyph('shield'), 'Resist', s.resist)}
    </div>`;
}

/** The versus form: one shared icon column between the two sides' numbers. */
function versus(f) {
    const row = (icon, a, b) => `<div style="display:grid;grid-template-columns:1fr 20px 1fr;gap:10px;align-items:center;min-height:21px" class="ui-text-body cl-b cl-num">
        <span class="cl-row cl-nw" style="justify-content:flex-end">${a}</span><span style="display:flex;justify-content:center">${icon}</span><span class="cl-row cl-nw">${b}</span></div>`;
    return `<div style="display:flex;flex-direction:column;gap:1px">
        ${row(skill(f.heroS.style), f.heroS.lv, f.enemyS.lv)}
        ${row(glyph('hit'), hitVal(f.heroS.hit), hitVal(f.enemyS.hit))}
        ${row(glyph('clock'), f.heroS.swing, f.enemyS.swing)}
        ${row(glyph('shield'), f.heroS.resist, f.enemyS.resist)}
    </div>`;
}

/** An enemy attack: its type in a small dark tile, the name large, the type named, the last one marked. */
function attack(m, wide = true) {
    return `<div class="cl-row cl-nw" style="gap:8px;min-height:26px">
        <span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:#241a12;box-shadow:inset 0 0 0 2px ${m.last ? GC.gold : FRAME};flex:none">${glyph(dtg(m.type), m.last ? GC.gold : GC.text)}</span>
        <span class="ui-text-body cl-b" style="color:${m.last ? '#fff' : '#cfcfcf'}">${m.name}</span>
        <span class="ui-text-small cl-muted">${m.typeName}</span>
        ${m.last && wide ? `<span class="ui-text-small" style="color:${GOLD};margin-left:auto">just used</span>` : ''}
    </div>`;
}
const attacks = (f, wide = true) => `<div>
    <div class="ui-text-small cl-muted" style="padding-bottom:2px">${f.enemy}'s attacks</div>
    <div style="display:flex;flex-direction:column;gap:2px">${f.moves.map(m => attack(m, wide)).join('')}</div></div>`;
const attacksRow = (f) => `<div>
    <div class="ui-text-small cl-muted" style="padding-bottom:2px">${f.enemy}'s attacks</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">${f.moves.map(m => attack(m, false)).join('')}</div></div>`;

const fxRow = (x) => `<div class="cl-row ui-text-small cl-nw" style="min-height:20px">
    ${glyph(x.icon, x.colour === 'gold' ? GC.gold : x.colour === 'green' ? GC.green : GC.red)}
    <span class="cl-b">${x.name}</span>${x.n ? `<span class="cl-b cl-num">${x.n}</span>` : ''}${x.note ? `<span class="cl-muted">${x.note}</span>` : ''}</div>`;
const fxCol = (head, list) => `<div><div class="ui-text-small cl-muted" style="padding-bottom:2px">${head}</div>${list.length ? list.map(fxRow).join('') : '<div class="ui-text-small cl-muted">None</div>'}</div>`;
const fx2 = (f, gap = 20) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}px">${fxCol(`On ${f.hero}`, f.heroFx)}${fxCol(`On ${f.enemy}`, f.enemyFx)}</div>`;
const elixirs = (f) => (f.elixirs.length ? `<div class="cl-row" style="gap:10px"><span class="cl-row" style="gap:10px">${f.elixirs.map(e => `<span class="cl-row" style="gap:2px"><img class="cl-pix" src="/assets/items/potion/${e[0]}.png" style="width:32px;height:32px"><span class="ui-text-small cl-b cl-num">${e[1]}</span></span>`).join('')}</span><span class="ui-text-small cl-muted cl-nw">fights left</span></div>` : '<span class="ui-text-small cl-muted">No elixirs</span>');
const logBtn = `<span class="ui-text-small cl-b cl-nw" style="position:relative;display:inline-block;padding:6px 10px;color:${MUTED}"><span class="ui-frame-shadow-chamfer cl-abs" style="inset:0"></span><span class="ui-frame-chamfer cl-abs" style="inset:0"></span><span style="position:relative">Log</span></span>`;
const line = '<div class="cl-line"></div>';

const LOOKS = {
    /** A: the battle is the window. Fighters at three times their art, the numbers under them. */
    A: (f) => frame(`${titleBar(f)}
        ${arena(f, 560, 268, 3, 3, { w: 148, h: 16 })}
        <div style="display:flex;flex-direction:column;gap:6px;padding:6px 6px 2px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">${stats(f.heroS)}${stats(f.enemyS)}</div>
            ${line}${attacksRow(f)}${line}${fx2(f)}${line}
            <div class="cl-row" style="justify-content:space-between">${elixirs(f)}${logBtn}</div>
        </div>`, 572),
    /** B: the slim card. Fighters at twice their art, the versus card kept, everything in one narrow column. */
    B: (f) => frame(`${titleBar(f)}
        ${arena(f, 344, 216, 2, 2, { w: 112, h: 14 })}
        <div style="display:flex;flex-direction:column;gap:5px;padding:6px 4px 2px">
            ${versus(f)}${line}${attacks(f)}${line}${fx2(f, 8)}${line}
            <div class="cl-row" style="justify-content:space-between">${elixirs(f)}${logBtn}</div>
        </div>`, 356),
    /** C: ringside. The battle in the middle, each side's numbers and effects standing beside its own fighter. */
    C: (f) => frame(`${titleBar(f)}
        <div style="display:grid;grid-template-columns:216px 344px 216px;gap:10px;align-items:start">
            <div style="display:flex;flex-direction:column;gap:6px;padding:2px 2px 0 4px">
                <div style="padding:2px">${bar(f.hp[0], f.hp[1], 204, 18)}</div>
                ${stats(f.heroS)}${line}${fxCol('Effects', f.heroFx)}${line}${elixirs(f)}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
                ${arena(f, 344, 256, 2, 2, null)}
                <div style="display:flex;justify-content:center">${logBtn}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;padding:2px 4px 0 2px">
                <div style="padding:2px">${bar(f.ehp[0], f.ehp[1], 204, 18)}</div>
                ${stats(f.enemyS)}${line}${attacks(f, false)}${line}${fxCol('Effects', f.enemyFx)}
            </div>
        </div>`, 808)
};

const place = (html, x, y, attrs = '') => { const n = el(`<div class="cl-abs" ${attrs} style="left:${Math.round(x)}px;top:${Math.round(y)}px">${html}</div>`); root.appendChild(n); return n; };

/** Tab D: both fighters' heads, a bar under each name. Tab E: the words and two bars, no art. */
const head = (inner) => `<span style="display:block;width:44px;height:44px;overflow:hidden;position:relative;background:#241a12;flex:none"><span class="cl-abs" style="left:-10px;top:-6px">${inner}</span></span>`;
const won = (f) => (f.result ? `<span style="color:var(--color-ui-green)">${f.result}</span>` : f.enemy);
const TABS = {
    D: (f) => frame(`<div class="cl-row" style="gap:6px">
        ${head(heroArt(1, 0, 2))}
        <div style="display:flex;flex-direction:column;gap:6px;padding:0 2px">
            <span class="ui-text-small cl-b cl-nw" style="line-height:1;display:flex;justify-content:space-between;gap:12px"><span>${f.hero}</span><span>${won(f)}</span></span>
            <div class="cl-row" style="gap:6px">${bar(f.hp[0], f.hp[1], 70, 14)}${bar(f.ehp[0], f.ehp[1], 70, 14)}</div>
        </div>
        ${head(enemyArt(f.sprite, 1))}
    </div>`),
    E: (f) => frame(`<div class="cl-row" style="gap:8px;padding:2px">
        <span class="ui-text-small cl-b cl-nw">${f.hero}</span>${bar(f.hp[0], f.hp[1], 60, 14)}
        <span class="ui-text-small cl-muted">vs</span>
        ${bar(f.ehp[0], f.ehp[1], 60, 14)}<span class="ui-text-small cl-b cl-nw">${won(f)}</span>
    </div>`)
};

window.CL = {
    clear() { root.innerHTML = ''; },
    after(on) { document.documentElement.classList.toggle('cl-after', on); },
    /** The window `look` for fight `f` at x, y; returns its box. */
    win(look, f, x, y) { const n = place(LOOKS[look](f), x, y, 'data-cl-win'); const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, width: Math.ceil(r.width) + 4, height: Math.ceil(r.height) + 4 }; },
    /** A strip of tabs, its foot at `bottom`, from `left`, gap 8 px; returns its box. */
    strip(look, fights, left, bottom) {
        const n = el(`<div class="cl-abs" data-cl-strip style="left:${left}px;top:0;display:flex;gap:8px;align-items:flex-end;width:max-content">${fights.map(TABS[look]).join('')}</div>`);
        root.appendChild(n);
        const r = n.getBoundingClientRect();
        n.style.top = `${bottom - r.height}px`;
        const b = n.getBoundingClientRect();
        return { x: b.left, y: b.top, width: b.width, height: b.height };
    },
    /** A mat's fight, redrawn: the new bars, and the button where the plate stood. */
    matFight(q) {
        const barAt = (box, cur, max) => {
            const w = 76, h = 14;
            const cx = Math.round(box.x + box.w / 2);
            const foot = Math.round(box.y + box.h);
            place(bar(cur, max, w, h), cx - w / 2, foot - h);
            return { cx, top: foot - h - 2, foot };
        };
        const cur = (t) => +(/([\d,]+)/.exec(t || '')?.[1] || '1').replace(/,/g, '');
        const hc = cur(q.heroText), ec = cur(q.enemyText), hm = q.heroMax || hc, em = q.enemyMax || ec;
        const he = barAt(q.heroBar, hc, hm); const en = barAt(q.enemyBar, ec, em);
        if (q.plate) {
            const cx = Math.round(q.plate.x + q.plate.w / 2);
            place(`<div style="position:relative;width:32px;height:32px"><span class="ui-frame-shadow-chamfer cl-abs" style="inset:0"></span><span class="ui-frame-chamfer cl-abs" style="inset:0"></span><span class="cl-abs" style="left:8px;top:8px">${glyph('fight', GC.gold)}</span></div>`, cx - 16, q.plate.y + 2);
        }
        return { he, en };
    },
    /** What floats over a fighter: `kind` hit, crit, miss or heal. */
    float(at, kind, amount, onHero, artDrop = 30) {
        const tone = kind === 'heal' ? 'gi-ff-green' : onHero ? 'gi-ff-red' : 'gi-ff-white';
        const inner = kind === 'crit'
            ? `<span class="gi-ff-crit-word">Crit!</span><span class="gi-ff-crit-number">${amount}</span>`
            : kind === 'miss' ? `<span class="gi-ff-word">Miss</span>` : `<span class="gi-ff-number">${kind === 'heal' ? '+' : ''}${amount}</span>`;
        const cls = `gi-fight-float ${tone}${kind === 'crit' ? ' gi-fight-float-crit' : ''}${kind === 'miss' ? ' gi-fight-float-miss' : ''}`;
        const n = el(`<div class="${cls}" style="position:absolute;left:${at.cx}px;top:${at.foot + artDrop}px;--fx-scale:1;--ff-e:2px">${inner}</div>`);
        root.appendChild(n);
    },
    /** A named move or effect in a speech bubble, the tail on the bar, never on its number. */
    say(at, text, tone = 'plain') {
        const n = el(`<div class="cl-abs" style="left:${at.cx}px;top:0">${bubble(text, tone)}</div>`);
        root.appendChild(n);
        const r = n.getBoundingClientRect();
        n.style.left = `${Math.round(at.cx - r.width / 2)}px`;
        n.style.top = `${Math.round(at.top - 12 - r.height)}px`;
    },
    label(text, x, y) { place(`<span class="ui-text-small cl-b cl-nw cl-out">${text}</span>`, x, y); },
    /** Put away what isn't about combat: toasts, the FPS counter, the QA button. */
    tidy() {
        const hideUp = (node) => {
            let e = node;
            for (;;) {
                const up = e.parentElement;
                if (!up || up === document.body || up.closest('.cl-root')) break;
                const r = up.getBoundingClientRect();
                if (r.width === 0 || r.height === 0 || r.width > 1000 || r.height > 700 || up.querySelector('[data-board-origin], [data-fight], [data-board-hero], canvas')) break;
                e = up;
            }
            e.setAttribute('data-cl-hidden', '');
        };
        for (const e of document.querySelectorAll('body *')) {
            if (e.closest('.cl-root') || e.closest('[data-cl-hidden]') || e.closest('[data-mat-board]')) continue;
            const s = (e.textContent || '').trim();
            if ((e.children.length === 0 && /joined the guild|^clear all$|^\d+ FPS$|^New!/i.test(s)) || e.matches('button[title="Open QA Dashboard"]')) hideUp(e);
        }
        if (!document.getElementById('cl-hide')) { const h = document.createElement('style'); h.id = 'cl-hide'; h.textContent = '[data-cl-hidden]{visibility:hidden!important}'; document.head.appendChild(h); }
    },
    /** One fight drawn still on open grass, for the close-ups; returns where its bars stand. */
    stage(x, y) {
        const f = { hp: [19, 24], ehp: [9, 25] };
        place(heroArt(2, 0, 2), x, y);
        place(enemyArt('/assets/enemies/goblin/e_goblin.png', 2), x + 100, y);
        const barAt = (cx, c, m) => { place(bar(c, m, 76, 14), cx - 38, y - 12); return { cx, top: y - 14, foot: y + 2 }; };
        const he = barAt(x + 64, f.hp[0], f.hp[1]);
        const en = barAt(x + 164, f.ehp[0], f.ehp[1]);
        place(`<div style="position:relative;width:32px;height:32px"><span class="ui-frame-shadow-chamfer cl-abs" style="inset:0"></span><span class="ui-frame-chamfer cl-abs" style="inset:0"></span><span class="cl-abs" style="left:8px;top:8px">${glyph('fight', GC.gold)}</span></div>`, x + 98, y + 130);
        return { he, en };
    }
};
return true;
})()
