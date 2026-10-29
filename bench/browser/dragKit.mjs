// The drag bench's in-page half. `installDragKit` is injected into the game page as SOURCE
// (`installDragKit.toString()`), so it must stay self-contained: no imports, no outside names.
// It only reads the game and does set-up (resources, room on the mat, unequipping before an
// equip); every drag itself is real browser input sent from Node.

/* global window, document, MutationObserver, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */
export function installDragKit() {
    const G = window.__perf.game;
    const kit = {};
    window.__dragKit = kit;

    // ---- Frame timing: every frame's interval (rAF to rAF), kept for the last ~25 s ----
    // A stall anywhere on the main thread (a React commit, a forced layout) delays the next
    // animation frame, so it shows here as one long interval: what the player sees as a hitch.
    const RING = 4096;
    const frameEnd = new Float64Array(RING);
    const frameGap = new Float64Array(RING);
    let frameCount = 0;
    let lastFrameTs = 0;
    const onFrame = (ts) => {
        if (lastFrameTs) {
            const i = frameCount % RING;
            frameEnd[i] = ts;
            frameGap[i] = ts - lastFrameTs;
            frameCount++;
        }
        lastFrameTs = ts;
        requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);
    /** Frames whose interval [end − gap, end] passes `keep(start, end)`: count, longest, over 16.7 ms. */
    const framesWhere = (keep) => {
        let n = 0, maxMs = 0, over = 0;
        for (let k = Math.max(0, frameCount - RING); k < frameCount; k++) {
            const i = k % RING;
            const end = frameEnd[i], gap = frameGap[i];
            if (!keep(end - gap, end)) continue;
            n++;
            if (gap > maxMs) maxMs = gap;
            if (gap > 16.7) over++;
        }
        return n ? { frames: n, maxMs: Math.round(maxMs * 10) / 10, over16: over } : null;
    };
    // How long after the drag starts still counts as the pickup: its commits and the ghost's mount.
    const PICKUP_TAIL_MS = 100;
    // How long after the release counts as the drop: the drop's commits and the landing.
    const DROP_TAIL_MS = 300;

    // ---- Pickup probe: press time, the move that crossed the 8 px threshold, drag start ----
    const probe = { downAt: null, downPt: null, activateAt: null, startAt: null, upAt: null, carryEndAt: null, notes: [], sounds: [] };
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
        probe.downAt = null; probe.downPt = null; probe.activateAt = null; probe.startAt = null; probe.upAt = null; probe.carryEndAt = null; probe.notes = []; probe.sounds = [];
    };
    /**
     * The frames of one drag, in three phases that share no frame:
     * - **pickup**: from the press to `PICKUP_TAIL_MS` after the drag started (a frame that
     * starts inside that and runs on past it is the pickup's);
     * - **carry**: every whole frame after that, up to the moment the bench first reads the
     * page before the release (`inHand`), so the bench's own reads are never counted;
     * - **drop**: from the frame the release lands in to `DROP_TAIL_MS` after it. The bench holds
     * still for a few frames between its reads and the release, so this frame is the game's.
     */
    const dragFrames = () => {
        const { downAt, startAt, upAt, carryEndAt } = probe;
        if (downAt == null || startAt == null) return null;
        const pickupEnd = startAt + PICKUP_TAIL_MS;
        return {
            pickup: framesWhere((s, e) => e > downAt && s < pickupEnd),
            carry: carryEndAt == null ? null : framesWhere((s, e) => s >= pickupEnd && e <= carryEndAt),
            drop: upAt == null ? null : framesWhere((s, e) => e > upAt && s < upAt + DROP_TAIL_MS)
        };
    };
    kit.readProbe = () => ({
        pickedUp: probe.startAt != null,
        frames: dragFrames(),
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
        // The carry's frames end here: from now on the bench is reading the page.
        if (probe.carryEndAt == null) probe.carryEndAt = performance.now();
        if (!document.body.classList.contains('gi-dnd-active')) return null;
        const g = document.querySelector('[data-flag-ghost]');
        if (g) return `flag ${g.getAttribute('data-flag-ghost')}`;
        const t = [...document.querySelectorAll('[data-token-art][data-token-id]')].find(e => e.style.visibility === 'hidden');
        if (t) return `Token ${t.getAttribute('data-token-id')}`;
        const d = document.querySelector('[data-dock-hero].opacity-30');
        if (d) return `dock hero ${d.getAttribute('data-dock-hero')}`;
        const r = document.querySelector('[data-shop-row].opacity-30');
        if (r) return `Shop row ${r.getAttribute('data-shop-row')}`;
        const i = document.querySelector('button.opacity-40[data-bank-item]');
        if (i) return `Bank item ${i.getAttribute('data-bank-item')}`;
        return 'something unidentified';
    };

    // ---- Naming what is under the pointer ----
    const IDENT = ['data-token-id', 'data-board-hero', 'data-flag', 'data-flag-gear', 'data-dock-hero', 'data-shop-row',
        'data-ring-row', 'data-ring', 'data-callouts', 'data-callout', 'data-hero-bubbles',
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
    /** `heroId`: a flag is pressed there; its press scene is read too (`pressScene`). */
    kit.describeAt = (x, y, heroId = null) => {
        const el = document.elementFromPoint(x, y);
        const press = heroId ? kit.pressScene(x, y, heroId) : undefined;
        if (!el) return { tag: null, identity: '(nothing: off the page)', press };
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
            react: reactNames(el),
            // Everything at the point that takes the pointer, top first, by identity.
            stack: stackAt(x, y),
            press
        };
    };
    function identityOf(el) {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
            const a = IDENT.find(k => n.hasAttribute?.(k));
            if (a) return `[${a}${n.getAttribute(a) ? '=' + String(n.getAttribute(a)).slice(0, 40) : ''}]`;
        }
        return el.tagName.toLowerCase();
    }
    function stackAt(x, y) {
        const out = [];
        for (const el of document.elementsFromPoint(x, y)) {
            const id = identityOf(el);
            if (!out.includes(id)) out.push(id);
            if (out.length >= 5) break;
        }
        return out;
    }

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
        return typeIds.length;
    };
    kit.equippables = () => {
        const heroes = (G.GameState.state.heroes || []).map(h => h.id);
        return Object.values(G.getAllItems()).filter(i => i?.id && G.EquipmentValidator.canEquipToSlot(i.id) && heroes.some(h => G.EquipmentValidator.canHeroEquip(h, i.id).canEquip)).map(i => i.id);
    };
    // Up to six items of each sort: gear (one copy per hero, taken out of the Bank by equipping and
    // put back by unequipping) and shared food, drink and potions (the Bank's stack stays). Which
    // sort an item is, is read from the game: one trial equip each, then unequipped.
    kit.copyItems = new Set();
    kit.ensureEquipStock = () => {
        const heroes = (G.GameState.state.heroes || []).map(h => h.id);
        const gear = [], shared = [];
        for (const id of kit.equippables()) {
            if (gear.length >= 6 && shared.length >= 6) break;
            const heroId = heroes.find(h => G.EquipmentValidator.canHeroEquip(h, id).canEquip);
            if (G.InventoryManager.getItemCount(id) < 5) G.InventoryManager.addItem(id, 50);
            kit.clearHeroGear(heroId);
            if (!G.EquipmentManager.equipItem(heroId, id).success) continue;
            const hero = G.HeroManager.getHero(heroId);
            const copy = hero.heldCopies?.[hero.equipment.indexOf(id)] === true;
            kit.clearHeroGear(heroId);
            const list = copy ? gear : shared;
            if (list.length < 6) list.push(id);
            if (copy) kit.copyItems.add(id);
        }
        G.EventBus.publish('inventory_updated');
        kit.equipStock = new Set([...gear, ...shared]);
        return { gear, shared };
    };
    kit.clearHeroGear = (heroId) => {
        const hero = G.HeroManager.getHero(heroId);
        (hero?.equipment || []).forEach((item, slot) => { if (item) G.EquipmentManager.unequipItem(heroId, slot); });
    };

    // ---- Pickers: a source to press, a target to drop on, and what should be true after ----
    // A fixed Token (a fixture, a landmark, a planted Sapling and what it grows into) refuses every
    // drag by design. A build from before `__perf.game` carried `FixedTokens` (an A/B against an
    // older branch) is read from what its Token draws.
    const isFixed = (t, el) => (G.FixedTokens ? G.FixedTokens.isFixed(t) : el.hasAttribute('data-token-fixed'));
    const draggableTokens = () => G.BoardState.tokens().filter(t => {
        const el = document.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        // An enemy in a fight can be killed before the drop, and then nothing lands: not a press
        // fault, so it is passed over (an owner question: should a Token in the hand be safe?).
        return el && !el.hasAttribute('data-guild-hall') && !t.quest?.tutorial && !G.BoardPlacement.isPermanentToken(t.typeId, t)
            && !isFixed(t, el) && !G.BoardCombat?.getFight?.(t.id);
    });
    // ---- Where the game gives a press: the bench's own copy of the rules, read from the page ----
    // A flag's cloth inside its drawn box, as shares of its size (the flag art, `flagGeometry.js`).
    // The small job markers (the Mat Tuner's Job marker row, `data-flag-look`) are their drawn flag.
    const CLOTH = { left: 12 / 64, top: 11 / 64, right: 62 / 64, bottom: 36 / 64 };
    const SMALL_CLOTH = { left: 2 / 12, top: 2 / 12, right: 10 / 12, bottom: 10 / 12 };
    const zOf = (el) => Number(el?.style?.zIndex) || 0;
    const onCloth = (flagEl, p) => {
        const r = flagEl.getBoundingClientRect();
        const u = (p.x - r.left) / r.width, v = (p.y - r.top) / r.height;
        const look = flagEl.getAttribute('data-flag-look');
        const c = look === 'lucide' || look === 'pixel' ? SMALL_CLOTH : CLOTH;
        return u >= c.left && u <= c.right && v >= c.top && v <= c.bottom;
    };
    /** A flag whose cloth is drawn in front of a Token at `p` (over a Token, only a cloth keeps a press). */
    const clothInFront = (p, tokenZ) => [...document.querySelectorAll('button[data-flag]')]
        .some(f => zOf(f) > tokenZ && onCloth(f, p));
    /** How far a clear flag press keeps from hero figures and Token bodies, in screen px. */
    const CLEAR_PX = 8;
    /** Token hit circles on screen: each Token's own round body, the only part that takes a press. */
    const tokenCircles = () => [...document.querySelectorAll('[data-token-hit]')].map(e => {
        const r = e.getBoundingClientRect();
        return { id: e.getAttribute('data-token-hit'), x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 };
    });
    const onScreen = (p) => p.x >= 0 && p.y >= 0 && p.x < innerWidth && p.y < innerHeight;

    /**
     * Where to press a Token, as the game's rules give a press to it: its centre, or another
     * point of its own round body, where the game says the pointer is on THIS Token (where circles
     * overlap, the nearest centre: `Flags.tokenAtPoint`) and no flag's cloth is drawn in front.
     * The point must be on the mat as drawn, not under the screen's own furniture outside it (the
     * hero bar's figures, a drawer), nor under a hero figure. Anything else on the mat drawn on
     * top (a ring, a callout, a bubble) is kept: that is what the bench is looking for.
     */
    const tokenPress = (id) => {
        const hit = document.querySelector(`[data-token-hit="${id}"]`);
        const art = document.querySelector(`[data-token-art][data-token-id="${id}"]`);
        if (!hit || !art) return null;
        const r = hit.getBoundingClientRect();
        if (r.width < 2) return null;
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const rad = r.width / 2;
        const board = document.querySelector('[data-mat-board]');
        const pts = [c];
        for (let k = 0; k < 8; k++) pts.push({ x: c.x + Math.cos(k * Math.PI / 4) * rad * 0.45, y: c.y + Math.sin(k * Math.PI / 4) * rad * 0.45 });
        for (const q of pts) {
            const p = { x: Math.round(q.x), y: Math.round(q.y) };
            if (!onScreen(p)) continue;
            if (G.Flags.tokenAtPoint(kit.screenToMat(p))?.id !== id) continue;
            if (clothInFront(p, zOf(art))) continue;
            const top = document.elementFromPoint(p.x, p.y);
            if (!top || !board?.contains(top)) continue;
            // A hero figure in front takes the press where it is drawn solid, by design, and which
            // of its pixels are solid changes frame by frame: the bench presses beside it.
            if (top.closest('[data-board-hero]')) continue;
            return p;
        }
        return null;
    };
    /**
     * Whether a press at `p` lands on this flag as drawn: past the flag's own hero (a press on the
     * hero drags the same flag), the first thing the browser finds there is the flag. Anything
     * else drawn on top there (a Token's bubble, another flag or hero, the mat's top bar over a
     * clipped edge) is what the player would be pressing instead.
     */
    const flagOnTop = (el, heroId, p) => {
        for (const top of document.elementsFromPoint(p.x, p.y)) {
            if (top.closest(`[data-board-hero="${heroId}"]`)) continue;
            return el.contains(top);
        }
        return false;
    };
    /** For a report: what is drawn on top of a flag's cloth, at its middle and four corners. */
    const coverOf = (el) => {
        const heroId = el.getAttribute('data-flag');
        const r = el.getBoundingClientRect();
        const at = (u, v) => ({ x: Math.round(r.left + u * r.width), y: Math.round(r.top + v * r.height) });
        return [at(0.58, 0.37), at(0.25, 0.2), at(0.94, 0.2), at(0.25, 0.54), at(0.94, 0.54)].map(p => {
            const top = document.elementsFromPoint(p.x, p.y).find(e => !e.closest(`[data-board-hero="${heroId}"]`));
            const art = top?.closest?.('[data-token-art]');
            return { p, top: top ? identityOf(top) : null, tokenZ: art ? zOf(art) : null, flagZ: zOf(el), worked: art ? art.getAttribute('data-tile-staffed') === 'true' : null };
        });
    };
    /**
     * Where to press a flag, as the game's rules give a press to it: over bare mat, any point of
     * its round area; over a Token's round body, only its cloth where it is drawn in front of that
     * Token. So: the highest point of the flag clear of every Token's body where the flag is what
     * is drawn on top; else a point of its cloth drawn on top; else its centre (reported).
     */
    const flagPress = (el) => {
        const heroId = el.getAttribute('data-flag');
        const r = el.getBoundingClientRect();
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const rad = Math.min(r.width, r.height) / 2;
        const circles = tokenCircles();
        const grid = [];
        for (let gy = -0.7; gy <= 0.71; gy += 0.175) {
            for (let gx = -0.7; gx <= 0.71; gx += 0.175) {
                if (gx * gx + gy * gy > 0.5) continue;
                grid.push({ x: Math.round(c.x + gx * rad), y: Math.round(c.y + gy * rad) });
            }
        }
        // First choice, a clear point: away from every hero figure's box and bar (its own hero's too) and
        // from every Token's body by a margin, and on no Token the game has there. The scene moves
        // on between the pick and the press (the bench's own reads, the rest before the press): a
        // hero walking in, or a Token sliding or arriving, would take a press the pick saw free.
        const heroBoxes = [...document.querySelectorAll('[data-board-hero], [data-board-hero] [data-health-bar]')].map(e => e.getBoundingClientRect());
        for (const p of grid) {
            if (!onScreen(p) || circles.some(t => Math.hypot(t.x - p.x, t.y - p.y) <= t.r + CLEAR_PX)) continue;
            if (heroBoxes.some(b => inRect(p, b, CLEAR_PX)) || G.Flags.tokenAtPoint(kit.screenToMat(p))) continue;
            if (flagOnTop(el, heroId, p)) return { ...p, bare: true, clear: true };
        }
        for (const p of grid) {
            if (!onScreen(p) || circles.some(t => Math.hypot(t.x - p.x, t.y - p.y) <= t.r)) continue;
            if (flagOnTop(el, heroId, p)) return { ...p, bare: true };
        }
        for (const p of grid) {
            if (onScreen(p) && onCloth(el, p) && flagOnTop(el, heroId, p)) return { ...p, bare: false, cloth: true };
        }
        return { x: Math.round(c.x), y: Math.round(c.y), bare: false };
    };
    // ---- What decides a press on a flag, read at a point: for telling a game fault from a scene ----
    // that changed between the pick and the press (a hero walking in, a Token arriving).
    const sheetAlpha = new Map();
    const alphaOf = (img) => {
        const src = img.currentSrc || img.src;
        if (!sheetAlpha.has(src)) {
            let m;
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                m = { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
            } catch { m = null; }
            sheetAlpha.set(src, m);
        }
        return sheetAlpha.get(src);
    };
    /**
     * A hero figure's art alpha at a client point, read as the game's hit test reads it (the frame
     * showing, mirrored when the hero faces left; solid from 25, `alphaHitTest.js`), 255 on its
     * health bar, null off both, -1 when the picture cannot be read.
     */
    const heroAlphaAt = (heroEl, p) => {
        // A hero's health bar is the hero's wherever it is pressed (`alphaHitTest.onFigurePart`).
        const bar = heroEl.querySelector('[data-health-bar]')?.getBoundingClientRect();
        if (bar && inRect(p, bar)) return 255;
        const box = heroEl.getBoundingClientRect();
        if (p.x < box.left || p.x > box.right || p.y < box.top || p.y > box.bottom) return null;
        const img = heroEl.querySelector('img');
        if (!img?.complete || !img.naturalWidth) return -1;
        const r = img.getBoundingClientRect();
        if (!r.width || p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) return 0;
        const across = (p.x - r.left) / r.width;
        const u = heroEl.getAttribute('data-alpha-flip') === 'x' ? 1 - across : across;
        const v = (p.y - r.top) / r.height;
        const m = alphaOf(img);
        if (!m) return -1;
        const px = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)));
        const py = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h)));
        return m.data[(py * m.w + px) * 4 + 3];
    };
    /**
     * At a press point on a flag: every hero figure whose box holds it (its alpha there and its z),
     * the flag's z, whether the flags are letting the pointer through to a Token (`yieldToTokens`),
     * whether the flag is what the browser finds first past its own hero, the Token the game says
     * is there and the Tokens whose drawn hit circle holds the point.
     */
    kit.pressScene = (x, y, heroId) => {
        const p = { x, y };
        const flag = document.querySelector(`button[data-flag="${heroId}"]`);
        const heroes = [...document.querySelectorAll('[data-board-hero]')]
            .map(el => ({ id: el.getAttribute('data-board-hero'), alpha: heroAlphaAt(el, p), z: zOf(el) }))
            .filter(hh => hh.alpha !== null);
        const drawnTokens = [...document.querySelectorAll('[data-token-art] > [data-token-hit]')].filter(e => {
            const r = e.getBoundingClientRect();
            return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) <= Math.min(r.width, r.height) / 2;
        }).map(e => e.getAttribute('data-token-hit'));
        return {
            flagZ: flag ? zOf(flag) : null,
            flagYields: !!flag && getComputedStyle(flag).pointerEvents === 'none',
            flagOnTop: !!flag && flagOnTop(flag, heroId, p),
            own: heroes.find(hh => hh.id === heroId) || null,
            others: heroes.filter(hh => hh.id !== heroId),
            engineToken: G.Flags.tokenAtPoint(kit.screenToMat(p))?.id ?? null,
            drawnTokens
        };
    };

    const flagAt = (heroId) => {
        const f = G.BoardState.flagOf(heroId);
        return f ? { x: f.x, y: f.y, pinnedTo: f.pinnedTo ?? null, plantedAt: f.plantedAt ?? null } : null;
    };
    /** For a failure report: what the flag's own button looks like on screen, and the mat's box. */
    const flagScene = (el, heroId) => {
        const r = el.getBoundingClientRect();
        const m = matEl().getBoundingClientRect();
        const bar = document.querySelector('[data-mat-top-bar]')?.getBoundingClientRect();
        const cell = matEl().parentElement?.parentElement?.getBoundingClientRect();
        // Whether any part of the flag is clear of every Token's own hit circle (not its art box).
        const hits = [...document.querySelectorAll('[data-token-hit]')].map(e => {
            const b = e.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
        });
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const rad = Math.min(r.width, r.height) / 2;
        let bareOfHitCircles = false;
        for (let gy = -0.7; gy <= 0.71 && !bareOfHitCircles; gy += 0.175) {
            for (let gx = -0.7; gx <= 0.71; gx += 0.175) {
                if (gx * gx + gy * gy > 0.5) continue;
                const p = { x: c.x + gx * rad, y: c.y + gy * rad };
                if (!hits.some(t => Math.hypot(t.x - p.x, t.y - p.y) <= t.r)) { bareOfHitCircles = true; break; }
            }
        }
        return {
            flag: flagAt(heroId),
            box: { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width) },
            matTop: Math.round(m.top),
            cellTop: cell ? Math.round(cell.top) : null,
            barBottom: bar ? Math.round(bar.bottom) : null,
            bareOfHitCircles
        };
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
            // A flag with no part a press could reach (all of it lies under Tokens, flags or heroes
            // drawn in front of it) cannot be picked up on the mat by anyone: the player moves it
            // by its hero or from the hero bar. Such flags are passed over, and named in the scene.
            const pressable = [];
            const hidden = [];
            for (const f of els) {
                const p = flagPress(f);
                (p.bare || p.cloth ? pressable : hidden).push({ el: f, at: p });
            }
            if (!pressable.length) return { skip: `every flag is hidden under things drawn in front of it (${hidden.length})` };
            const { el, at } = pickRandom(pressable);
            const heroId = el.getAttribute('data-flag');
            const to = kit.freeSpot();
            if (!to) return { skip: 'no free spot' };
            const scene = {
                ...flagScene(el, heroId),
                hiddenFlags: hidden.map(h => ({ heroId: h.el.getAttribute('data-flag'), coveredBy: coverOf(h.el) })),
                // As at the pick; the bench reads it again just before the press (`describeAt`).
                atPick: kit.pressScene(at.x, at.y, heroId)
            };
            return {
                source: { x: at.x, y: at.y, heroId, what: `flag ${heroId}${at.bare ? '' : ' (by its cloth, over a Token)'}`, hand: `flag ${heroId}`, scene },
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
            const pressMat = kit.screenToMat(at);
            const drawn = kit.screenToMat(visibleCentre(document.querySelector(`[data-token-art][data-token-id="${t.id}"]`)));
            const scene = {
                token: { x: Math.round(t.x), y: Math.round(t.y) }, pressMat: { x: Math.round(pressMat.x), y: Math.round(pressMat.y) },
                gameSays: G.Flags.tokenAtPoint(pressMat)?.id ?? null,
                // How far the drawn Token is from where the game has it (a slide or a spawn pop-out still playing).
                drawnOffU: Math.round(Math.hypot(drawn.x - t.x, drawn.y - t.y))
            };
            return { source: { ...at, what: `Token ${t.typeId} ${t.id}`, hand: `Token ${t.id}`, scene }, target: to.screen, expect: { kind: 'token', id: t.id, before: { x: t.x, y: t.y }, mat: to.mat } };
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
            const heroes = (G.GameState.state.heroes || []).map(h => h.id);
            const tiles = [...document.querySelectorAll('button[data-bank-item]')]
                .map(el => ({ el, itemId: el.getAttribute('data-bank-item') }))
                .filter(t => kit.equipStock?.has(t.itemId) && visibleCentre(t.el));
            // A hero takes an item on their figure in the hero bar or on their portrait tab beside the Bank.
            const targetsOf = (h) => [
                { on: 'dock figure', el: document.querySelector(`[data-dock-hero="${h}"]`) },
                { on: 'Bank hero tab', el: document.querySelector(`[data-dock-hero-id="${h}"] [data-hero-tab-face]`) }
            ].filter(t => visibleCentre(t.el));
            const pairs = [];
            for (const t of tiles) for (const h of heroes) {
                if (!G.EquipmentValidator.canHeroEquip(h, t.itemId).canEquip) continue;
                for (const on of targetsOf(h)) pairs.push({ ...t, heroId: h, on });
            }
            if (!pairs.length) return { skip: `no stocked equippable item tile visible (${tiles.length} tiles)` };
            const p = pickRandom(pairs);
            kit.clearHeroGear(p.heroId);
            p.el.scrollIntoView({ block: 'center' });
            return {
                source: { ...visibleCentre(p.el), what: `Bank item ${p.itemId}`, hand: `Bank item ${p.itemId}` },
                target: { ...visibleCentre(p.on.el), what: `${p.on.on} ${p.heroId}` },
                // One item, one hero: the equipped copy leaves the Bank.
                expect: { kind: 'equip', heroId: p.heroId, itemId: p.itemId, on: p.on.on, copy: kit.copyItems.has(p.itemId), bankBefore: G.InventoryManager.getItemCount(p.itemId) }
            };
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
                const slot = (hero?.equipment || []).indexOf(e.itemId);
                if (slot < 0) return { ok: false, detail: `not equipped on the ${e.on}` };
                // One item, one hero: a gear copy leaves the Bank with the hero; a shared stack stays.
                // ⚠️ A shared stack's count is not checked: working heroes eat and drink from it meanwhile.
                const held = hero.heldCopies?.[slot] === true;
                const bank = G.InventoryManager.getItemCount(e.itemId);
                const ok = held === e.copy && (!e.copy || bank === e.bankBefore - 1);
                return { ok, detail: `equipped on the ${e.on}, ${held ? 'a copy held' : 'shared'} (${e.copy ? 'gear' : 'shared'} expected), Bank ${e.bankBefore} → ${bank}` };
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
            alerts: document.querySelectorAll('[data-callout]').length
        };
    };
    kit.overlayCounts = () => ({
        bubbles: document.querySelector('[data-hero-bubbles]')?.childElementCount ?? 0,
        alerts: document.querySelectorAll('[data-callout]').length
    });
    kit.stopOverlays = () => { if (kit.overlayTimer) clearInterval(kit.overlayTimer); kit.overlayTimer = null; kit.lastBurstAt = null; };

    return true;
}
