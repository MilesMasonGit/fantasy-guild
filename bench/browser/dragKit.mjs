// The drag bench's in-page half. `installDragKit` is injected into the game page as SOURCE
// (`installDragKit.toString()`), so it must stay self-contained: no imports, no outside names.
// It only reads the game and does set-up (resources, room on the mat, unequipping before an
// equip); every drag itself is real browser input sent from Node.

/* global window, document, MutationObserver, getComputedStyle, innerWidth, innerHeight */
export function installDragKit() {
    const G = window.__perf.game;
    const kit = {};
    window.__dragKit = kit;

    // ---- Pickup probe: press time, the move that crossed the 8 px threshold, drag start ----
    const probe = { downAt: null, downPt: null, activateAt: null, startAt: null, upAt: null, notes: [], sounds: [] };
    kit.probe = probe;
    window.addEventListener('pointerdown', (e) => {
        probe.downAt = performance.now();
        probe.downPt = { x: e.clientX, y: e.clientY };
    }, true);
    window.addEventListener('pointerup', () => { if (probe.downAt != null) probe.upAt = performance.now(); }, true);
    window.addEventListener('pointermove', (e) => {
        if (probe.downPt && probe.activateAt == null && probe.startAt == null
            && Math.hypot(e.clientX - probe.downPt.x, e.clientY - probe.downPt.y) >= 8) probe.activateAt = performance.now();
    }, true);
    // The drag provider adds this class on dnd-kit's drag start (DndKit.jsx).
    new MutationObserver(() => {
        if (probe.downAt != null && probe.startAt == null && document.body.classList.contains('gi-dnd-active')) probe.startAt = performance.now();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    G.EventBus.subscribe('notification_added', (n) => { probe.notes.push(`${n?.type || '?'}: ${n?.message || ''}`.slice(0, 160)); });
    // The drop's sound says how the drag system judged it (DndKit.jsx, DRAG_SFX): `unassign` =
    // no target took it; `drop` = flown back; a kind's own clip = a target accepted it.
    G.EventBus.subscribe('audio:play', (p) => { if (probe.downAt != null) probe.sounds.push(p?.clip); });
    kit.resetProbe = () => {
        probe.downAt = null; probe.downPt = null; probe.activateAt = null; probe.startAt = null; probe.upAt = null; probe.notes = []; probe.sounds = [];
    };
    kit.readProbe = () => ({
        pickedUp: probe.startAt != null,
        pressToStartMs: probe.startAt != null && probe.downAt != null ? probe.startAt - probe.downAt : null,
        thresholdToStartMs: probe.startAt != null && probe.activateAt != null ? Math.max(0, probe.startAt - probe.activateAt) : null,
        stillDragging: document.body.classList.contains('gi-dnd-active'),
        dropSound: probe.sounds.filter(c => c !== 'drag').pop() ?? null,
        // Overlay pass: how long before the release the last burst of level-ups went out.
        msSinceOverlayBurst: kit.lastBurstAt != null && probe.upAt != null ? Math.round(probe.upAt - kit.lastBurstAt) : null,
        // Refusals first: in the overlay pass the level-up notifications would crowd them out.
        notes: [...probe.notes.filter(n => /^(warning|error)/.test(n)), ...probe.notes.filter(n => !/^(warning|error)/.test(n))].slice(0, 5)
    });

    /** What is in the hand right now, read from what each source draws while it is carried. */
    kit.inHand = () => {
        if (!document.body.classList.contains('gi-dnd-active')) return null;
        const g = document.querySelector('[data-flag-ghost]');
        if (g) return `flag ${g.getAttribute('data-flag-ghost')}`;
        const t = [...document.querySelectorAll('[data-token-art][data-token-id]')].find(e => e.style.visibility === 'hidden');
        if (t) return `Token ${t.getAttribute('data-token-id')}`;
        const d = document.querySelector('[data-dock-hero].opacity-30');
        if (d) return `dock hero ${d.getAttribute('data-dock-hero')}`;
        const r = document.querySelector('[data-shop-row].opacity-30');
        if (r) return `Shop row ${r.getAttribute('data-shop-row')}`;
        const b = document.querySelector('[data-bin-slot].opacity-30');
        if (b) return `bin ${b.getAttribute('data-bin-slot')}`;
        const i = document.querySelector('button.opacity-40[title*=" — drag to sort"]');
        if (i) return `Bank item ${i.getAttribute('title').split(' ×')[0]}`;
        return 'something unidentified';
    };

    // ---- Naming what is under the pointer ----
    const IDENT = ['data-token-id', 'data-board-hero', 'data-flag', 'data-flag-gear', 'data-dock-hero', 'data-shop-row',
        'data-bin-slot', 'data-discard-bin', 'data-ring-row', 'data-ring', 'data-token-notice', 'data-alert-kind', 'data-hero-bubbles',
        'data-perf-hud', 'data-mat-top-bar', 'data-bottom-hero-dock', 'data-shop-drawer', 'data-board-origin', 'data-dnd-region'];
    function reactNames(el) {
        const key = el && Object.keys(el).find(k => k.startsWith('__reactFiber$'));
        let f = key ? el[key] : null;
        const names = [];
        while (f && names.length < 3) {
            const t = f.type;
            const n = typeof t === 'function' ? (t.displayName || t.name)
                : t && typeof t === 'object' ? (t.displayName || t.render?.name || t.type?.name) : null;
            if (n && n.length > 2 && !names.includes(n)) names.push(n);
            f = f.return;
        }
        return names;
    }
    function attrs(el) {
        return [...(el?.attributes || [])]
            .filter(a => a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'role')
            .slice(0, 8).map(a => `${a.name}=${String(a.value).slice(0, 40)}`);
    }
    kit.describeAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { tag: null, identity: '(nothing: off the page)' };
        let owner = el;
        let identity = null;
        while (owner && owner !== document.body) {
            const a = IDENT.find(n => owner.hasAttribute?.(n));
            if (a) { identity = `[${a}${owner.getAttribute(a) ? '=' + String(owner.getAttribute(a)).slice(0, 40) : ''}]`; break; }
            owner = owner.parentElement;
        }
        return {
            tag: el.tagName.toLowerCase(),
            classes: [...el.classList].slice(0, 6).join(' '),
            attrs: attrs(el),
            identity: identity || `${el.tagName.toLowerCase()} (no identified ancestor)`,
            ownerAttrs: owner && owner !== el ? attrs(owner) : [],
            react: reactNames(el)
        };
    };

    /**
     * Every registered drop target whose box contains the point, other than the mat itself, with
     * whether it can be seen. dnd-kit picks targets by box, not by what is drawn on top, and ranks
     * drawer-surface targets first (`smallestWithin`), so an invisible one can take a drop.
     */
    kit.droppablesAt = (x, y) => [...document.querySelectorAll('[data-dnd-droppable-id]')]
        .filter(el => el.getAttribute('data-dnd-droppable-id') !== 'mat')
        .filter(el => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; })
        .map(el => {
            let seen = true;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const cs = getComputedStyle(n);
                if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') { seen = false; break; }
            }
            return `${el.getAttribute('data-dnd-droppable-id')}${seen ? '' : ' (invisible)'}`;
        });

    // ---- Geometry ----
    const matEl = () => document.querySelector('[data-board-origin]');
    kit.matToScreen = (p) => {
        const el = matEl();
        const r = el.getBoundingClientRect();
        const s = r.width / Number(el.dataset.naturalWidth);
        return { x: Math.round(r.left + p.x * s), y: Math.round(r.top + p.y * s) };
    };
    kit.screenToMat = (p) => {
        const el = matEl();
        const r = el.getBoundingClientRect();
        const s = r.width / Number(el.dataset.naturalWidth);
        return { x: (p.x - r.left) / s, y: (p.y - r.top) / s };
    };
    const visibleCentre = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
        const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
        if (right - left < 2 || bottom - top < 2) return null;
        return { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) };
    };
    const drawerRects = () => [...document.querySelectorAll('[data-dnd-region="drawer"]')]
        .filter(el => !el.hasAttribute('data-bottom-hero-dock'))
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.right > 0);
    const inRect = (p, r, pad = 0) => p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad;

    /**
     * An open spot on the mat (mat units), varied: the best-cleared of 40 random points, kept clear
     * of every open drawer (a drop over a drawer is a cancel by design).
     */
    kit.freeSpot = () => {
        const el = matEl();
        const w = Number(el.dataset.naturalWidth);
        const h = el.getBoundingClientRect().height / Number(el.dataset.boardScale);
        const others = G.BoardState.tokens().map(t => ({ x: t.x, y: t.y }));
        for (const f of Object.values(G.BoardState.getFlags())) if (f) others.push({ x: f.x, y: f.y });
        const drawers = drawerRects();
        let best = null;
        for (let i = 0; i < 40; i++) {
            const p = { x: w * (0.08 + 0.84 * Math.random()), y: h * (0.1 + 0.8 * Math.random()) };
            const sp = kit.matToScreen(p);
            if (drawers.some(r => inRect(sp, r, 24))) continue;
            let clear = Infinity;
            for (const o of others) clear = Math.min(clear, Math.hypot(o.x - p.x, o.y - p.y));
            if (!best || clear > best.clear) best = { p, clear };
        }
        if (!best) return null;
        return { mat: { x: Math.round(best.p.x), y: Math.round(best.p.y) }, screen: kit.matToScreen(best.p), clearance: Math.round(best.clear) };
    };

    const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // ---- Set-up ----
    kit.ensureShopFunds = () => {
        const rows = G.Shop.catalogue?.() || [];
        const typeIds = [];
        for (const group of rows) for (const item of group.items || []) typeIds.push(item.typeId);
        for (const t of typeIds) for (const { itemId, quantity } of G.Shop.priceOf(t)) {
            if (G.InventoryManager.getItemCount(itemId) < quantity * 60) G.InventoryManager.addItem(itemId, quantity * 60);
        }
        G.EventBus.publish('state_changed');
        return typeIds.length;
    };
    kit.equippables = () => {
        const heroes = (G.GameState.state.heroes || []).map(h => h.id);
        return Object.values(G.getAllItems()).filter(i => i?.id && G.EquipmentValidator.canEquipToSlot(i.id) && heroes.some(h => G.EquipmentValidator.canHeroEquip(h, i.id).canEquip)).map(i => i.id);
    };
    kit.ensureEquipStock = () => {
        const ids = kit.equippables().slice(0, 12);
        for (const id of ids) if (G.InventoryManager.getItemCount(id) < 5) G.InventoryManager.addItem(id, 50);
        G.EventBus.publish('inventory_updated');
        G.EventBus.publish('state_changed');
        return ids;
    };
    kit.clearHeroGear = (heroId) => {
        const hero = G.HeroManager.getHero(heroId);
        (hero?.equipment || []).forEach((item, slot) => { if (item) G.EquipmentManager.unequipItem(heroId, slot); });
    };

    // ---- Pickers: a source to press, a target to drop on, and what should be true after ----
    const draggableTokens = () => G.BoardState.tokens().filter(t => {
        const el = document.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        return el && !el.hasAttribute('data-guild-hall') && !t.quest?.tutorial && !G.BoardPlacement.isPermanentToken(t.typeId, t);
    });
    /**
     * Where to press a Token: its centre, or another point of its art circle when a DIFFERENT
     * Token's art lies on top there (overlapping Tokens: the player sees and grabs the top one).
     * Anything else on top (a ring, an alert, a bubble, a flag) is kept: that is what the bench
     * is looking for.
     */
    const tokenPress = (id) => {
        const el = document.querySelector(`[data-token-art][data-token-id="${id}"]`);
        const c = visibleCentre(el);
        if (!c) return null;
        const r = el.getBoundingClientRect();
        const rad = Math.min(r.width, r.height) / 2;
        const pts = [c];
        for (let k = 0; k < 8; k++) pts.push({ x: Math.round(c.x + Math.cos(k * Math.PI / 4) * rad * 0.45), y: Math.round(c.y + Math.sin(k * Math.PI / 4) * rad * 0.45) });
        for (const p of pts) {
            const art = document.elementFromPoint(p.x, p.y)?.closest?.('[data-token-art]');
            if (!art || art === el) return p;
        }
        return null;
    };
    /** Token art circles on screen, for "is this point over a Token?". */
    const tokenCircles = () => [...document.querySelectorAll('[data-token-art][data-token-id]')].map(e => {
        const r = e.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 };
    });
    /**
     * Where to press a flag. By design a flag is grabbed by the part of it over bare mat: over a
     * Token's art circle the pointer goes to the Token. So: the highest point of the flag's
     * circle that is clear of every Token circle, or its centre when none is (reported).
     */
    const flagPress = (el) => {
        const r = el.getBoundingClientRect();
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const rad = Math.min(r.width, r.height) / 2;
        const circles = tokenCircles();
        for (let gy = -0.7; gy <= 0.71; gy += 0.175) {
            for (let gx = -0.7; gx <= 0.71; gx += 0.175) {
                if (gx * gx + gy * gy > 0.5) continue;
                const p = { x: Math.round(c.x + gx * rad), y: Math.round(c.y + gy * rad) };
                if (p.x < 0 || p.y < 0 || p.x >= innerWidth || p.y >= innerHeight) continue;
                if (!circles.some(t => Math.hypot(t.x - p.x, t.y - p.y) <= t.r)) return { ...p, bare: true };
            }
        }
        return { x: Math.round(c.x), y: Math.round(c.y), bare: false };
    };
    const flagAt = (heroId) => {
        const f = G.BoardState.flagOf(heroId);
        return f ? { x: f.x, y: f.y, pinnedTo: f.pinnedTo ?? null, plantedAt: f.plantedAt ?? null } : null;
    };

    kit.pick = {
        dockHero() {
            const els = [...document.querySelectorAll('[data-dock-hero]')].filter(visibleCentre);
            if (!els.length) return { skip: 'no dock hero visible' };
            const el = pickRandom(els);
            const heroId = el.getAttribute('data-dock-hero');
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            return { source: { ...visibleCentre(el), what: `dock hero ${heroId}`, hand: `dock hero ${heroId}` }, target: to.screen, expect: { kind: 'flag', heroId, before: flagAt(heroId), mat: to.mat } };
        },
        flag() {
            const els = [...document.querySelectorAll('button[data-flag]')].filter(visibleCentre);
            if (!els.length) return { skip: 'no flag visible' };
            const el = pickRandom(els);
            const heroId = el.getAttribute('data-flag');
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            const at = flagPress(el);
            return {
                source: { x: at.x, y: at.y, what: `flag ${heroId}${at.bare ? '' : ' (no part of it over bare mat)'}`, hand: `flag ${heroId}` },
                target: to.screen, expect: { kind: 'flag', heroId, before: flagAt(heroId), mat: to.mat }
            };
        },
        token() {
            const list = draggableTokens().filter(t => !G.BoardState.workerOf?.(t.id) || Math.random() < 0.5);
            if (!list.length) return { skip: 'no Token to move' };
            const t = pickRandom(list);
            const at = tokenPress(t.id);
            if (!at) return { skip: 'Token off screen or under other Tokens' };
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            return { source: { ...at, what: `Token ${t.typeId} ${t.id}`, hand: `Token ${t.id}` }, target: to.screen, expect: { kind: 'token', id: t.id, before: { x: t.x, y: t.y }, mat: to.mat } };
        },
        shop() {
            const rows = [...document.querySelectorAll('[data-shop-row][data-shop-affordable="true"]')];
            if (!rows.length) return { skip: 'no affordable Shop row' };
            const row = pickRandom(rows);
            row.scrollIntoView({ block: 'center' });
            const at = visibleCentre(row);
            if (!at) return { skip: 'Shop row off screen' };
            const typeId = row.getAttribute('data-shop-row');
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            const ids = G.BoardState.tokens().filter(t => t.typeId === typeId).map(t => t.id);
            return { source: { ...at, what: `Shop row ${typeId}`, hand: `Shop row ${typeId}` }, target: to.screen, expect: { kind: 'shop', typeId, beforeIds: ids, mat: to.mat } };
        },
        equip() {
            const byName = new Map(Object.values(G.getAllItems()).filter(i => i?.name && G.EquipmentValidator.canEquipToSlot(i.id)).map(i => [i.name, i.id]));
            const heroes = (G.GameState.state.heroes || []).map(h => h.id);
            const tiles = [...document.querySelectorAll('button[title*=" — drag to sort"]')].map(el => {
                const name = el.getAttribute('title').split(' ×')[0];
                return { el, itemId: byName.get(name) };
            }).filter(t => t.itemId && visibleCentre(t.el));
            const pairs = [];
            for (const t of tiles) for (const h of heroes) {
                if (G.EquipmentValidator.canHeroEquip(h, t.itemId).canEquip && document.querySelector(`[data-dock-hero="${h}"]`)) pairs.push({ ...t, heroId: h });
            }
            if (!pairs.length) return { skip: `no equippable item tile visible (${tiles.length} tiles)` };
            const p = pickRandom(pairs);
            kit.clearHeroGear(p.heroId);
            const dock = document.querySelector(`[data-dock-hero="${p.heroId}"]`);
            p.el.scrollIntoView({ block: 'center' });
            return {
                source: { ...visibleCentre(p.el), what: `Bank item ${p.itemId}`, hand: `Bank item ${p.el.getAttribute('title').split(' ×')[0]}` },
                target: visibleCentre(dock),
                expect: { kind: 'equip', heroId: p.heroId, itemId: p.itemId }
            };
        },
        tokenToBin() {
            if (G.BoardState.binTokens().length >= G.DiscardBin.BIN_SIZE - 1) {
                for (const b of [...G.BoardState.binTokens()]) G.DiscardBin.unbinToken(b.id, kit.freeSpot()?.mat || { x: 400, y: 400 });
            }
            const list = draggableTokens().filter(t => G.DiscardBin.canBin(t.id).success);
            if (!list.length) return { skip: 'no Token the bin takes' };
            const t = pickRandom(list);
            const at = tokenPress(t.id);
            const bin = visibleCentre(document.querySelector('[data-discard-bin]'));
            if (!at || !bin) return { skip: 'Token or bin off screen' };
            return { source: { ...at, what: `Token ${t.typeId} ${t.id}`, hand: `Token ${t.id}` }, target: bin, expect: { kind: 'binned', id: t.id } };
        },
        binToMat() {
            if (!G.BoardState.binTokens().length) {
                // The previous step emptied the bin: put one there (set-up, not a drag), and pick
                // again once the bin panel has drawn its slot.
                const t = draggableTokens().find(x => G.DiscardBin.canBin(x.id).success);
                if (!t) return { skip: 'bin empty and nothing to put in it' };
                G.DiscardBin.binToken(t.id);
                return new Promise(resolve => setTimeout(() => resolve(kit.pick.binToMat()), 400));
            }
            const bin = G.BoardState.binTokens();
            if (!bin.length) return { skip: 'bin empty' };
            const inst = bin[bin.length - 1];
            const at = visibleCentre(document.querySelector(`[data-bin-slot="${inst.id}"]`));
            if (!at) return { skip: 'bin slot not drawn' };
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            return { source: { ...at, what: `bin slot ${inst.typeId} ${inst.id}`, hand: `bin ${inst.id}` }, target: to.screen, expect: { kind: 'unbinned', id: inst.id, mat: to.mat } };
        }
    };

    // ---- Checks: did the game state change as intended? ----
    kit.check = (e) => {
        switch (e.kind) {
            case 'flag': {
                const f = flagAt(e.heroId);
                if (!f) return { ok: false, detail: 'the hero has no flag' };
                const moved = !e.before || f.x !== e.before.x || f.y !== e.before.y || f.pinnedTo !== e.before.pinnedTo || f.plantedAt !== e.before.plantedAt;
                const d = dist(f, e.mat);
                const ok = moved && (d <= 60 || !!f.pinnedTo);
                return { ok, detail: ok ? `planted ${Math.round(d)} u from the aim${f.pinnedTo ? ', pinned' : ''}` : moved ? `planted ${Math.round(d)} u from the aim` : 'the flag did not move' };
            }
            case 'token': {
                const t = G.BoardState.getTokenById(e.id);
                if (!t) return { ok: false, detail: 'the Token is gone from the mat (restocked into a copy?)' };
                const d = dist(t, e.mat);
                const moved = dist(t, e.before) > 1;
                const ok = moved && d <= 150;
                return { ok, detail: ok ? `landed ${Math.round(d)} u from the aim` : moved ? `landed ${Math.round(d)} u from the aim` : 'the Token did not move' };
            }
            case 'shop': {
                const fresh = G.BoardState.tokens().filter(t => t.typeId === e.typeId && !e.beforeIds.includes(t.id));
                if (!fresh.length) return { ok: false, detail: 'nothing was bought' };
                const t = fresh[0];
                const d = dist(t, e.mat);
                // Set-up for the next buy: the mat cap would otherwise fill up.
                G.BoardPlacement.removePlacedToken(t.id);
                return { ok: d <= 150, detail: `bought, landed ${Math.round(d)} u from the aim` };
            }
            case 'equip': {
                const hero = G.HeroManager.getHero(e.heroId);
                const ok = (hero?.equipment || []).includes(e.itemId);
                return { ok, detail: ok ? 'equipped' : 'not equipped' };
            }
            case 'binned': {
                const ok = G.DiscardBin.isBinned(e.id);
                return { ok, detail: ok ? 'in the bin' : G.BoardState.getTokenById(e.id) ? 'still on the mat' : 'gone' };
            }
            case 'unbinned': {
                const t = G.BoardState.getTokenById(e.id);
                const ok = !!t && !G.DiscardBin.isBinned(e.id);
                return { ok, detail: ok ? `back on the mat ${Math.round(dist(t, e.mat))} u from the aim` : 'still in the bin' };
            }
            default: return { ok: false, detail: `unknown check ${e.kind}` };
        }
    };

    // ---- The overlay pass: speech bubbles over every hero, again and again ----
    kit.startOverlays = () => {
        kit.stopOverlays();
        const say = () => {
            kit.lastBurstAt = performance.now();
            for (const h of G.GameState.state.heroes || []) {
                G.EventBus.publish('hero_leveled', { heroId: h.id, heroName: h.name, skillId: 'mining', skillName: 'Mining', newLevel: 2 + Math.floor(Math.random() * 50), oldLevel: 1 });
            }
        };
        say();
        kit.overlayTimer = setInterval(say, 2500);
        return {
            bubbles: document.querySelectorAll('[data-hero-bubbles] *').length,
            alerts: document.querySelectorAll('[data-token-notice]').length
        };
    };
    kit.overlayCounts = () => ({
        bubbles: document.querySelector('[data-hero-bubbles]')?.childElementCount ?? 0,
        alerts: document.querySelectorAll('[data-token-notice]').length
    });
    kit.stopOverlays = () => { if (kit.overlayTimer) clearInterval(kit.overlayTimer); kit.overlayTimer = null; kit.lastBurstAt = null; };

    return true;
}
