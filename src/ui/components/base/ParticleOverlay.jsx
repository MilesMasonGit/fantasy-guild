import { useEffect, useRef } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { GameState } from '../../../state/GameState.js';
import { lootFlightTarget, lootSpriteScreenPx } from '../../utils/lootFlight.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { isDrawn } from '../../dev/perf/drawSwitches.js';
import { bookFlight, fliesToStub, landFlight, placeFlights } from '../notifications/stubLanding.js';

/** Gap between staggered particles from one collection burst. */
const STAGGER_MS = 60;

/** A quiet spell this long starts the burst queue again from zero. */
const STAGGER_RESET_MS = 250;

/**
 * How many particles one burst may draw. A Collect All can take forty sprites
 * at once; forty arcs on one frame reads as noise, not reward. The rest are
 * collected exactly the same — they just do not draw.
 */
const MAX_CONCURRENT = 12;

/** The quickest and slowest an item flight takes, in ms. */
export const FLIGHT_MIN_MS = 280;
export const FLIGHT_MAX_MS = 800;
/** Time added per screen pixel flown, between the two bounds. */
const FLIGHT_MS_PER_PX = 0.45;

/** How long a flight over `distPx` screen pixels takes: a short hop is quick, a long one lingers. */
export function flightDurationMs(distPx) {
    const ms = FLIGHT_MIN_MS + (Number.isFinite(distPx) ? distPx : 0) * FLIGHT_MS_PER_PX;
    return Math.round(Math.min(FLIGHT_MAX_MS, Math.max(FLIGHT_MIN_MS, ms)));
}

/** The radius of the glow drawn around a flying item. */
const GLOW_R = 25;

/**
 * How far past its path a flight can draw, in px, not counting the item itself (half its size,
 * added per flight): the glow, the trail, and the sparkles' drift. A trail sparkle starts up to
 * 5 px off the path and drifts at most 1 px a frame sideways and 2 down for 49 frames; a
 * landing sparkle at most 2 px a frame for 19 frames; each is a 2 px square.
 * ⚠️ Follows the sparkle numbers in `update()`. Change those and this with them:
 * `ParticleCanvasBounds.test.js` fails when something is drawn outside the canvas.
 */
const FLIGHT_REACH = { side: 56, up: 38, down: 105 };
/** Antialiasing past a shape's edge. */
const EDGE_PX = 2;
/** The highest a flight to a stub may arc: its glow stays on screen under the top edge. */
const STUB_ARC_TOP_PX = GLOW_R;

const CANVAS_STYLE = { imageRendering: 'pixelated', display: 'none' };

/**
 * Where a board point (natural board pixels / mat units) is on screen.
 * ⚠️ The board is drawn at its natural size and then CSS-scaled to fit (`useBoardScale`), so
 * its on-screen rect is the SCALED box. A board point has to be multiplied by that scale
 * (`rect.width / data-natural-width`) before it is added to the rect's corner; without it,
 * loot sparkles start further from their Token the smaller the window. A board with no
 * `data-natural-width` reads as unscaled.
 */
export function boardPointToScreen(boardEl, x, y) {
    const r = boardEl.getBoundingClientRect();
    const natural = Number(boardEl.getAttribute?.('data-natural-width'));
    const scale = natural > 0 && r.width > 0 ? r.width / natural : 1;
    return { x: r.left + x * scale, y: r.top + y * scale };
}

/**
 * ParticleOverlay: a Canvas layer for UI-space effects. Visualizes collected loot flying to
 * where it went, with sparkles: its own item stub, or the Guild Hall when the stubs are not drawn.
 * The canvas is only as big as the flights in the air (`ParticleSystem._fit`) and is hidden
 * while nothing flies: a window-sized one was cleared and redrawn whole on every frame of every
 * flight, and stayed a full-window layer in between.
 */
export const ParticleOverlay = ({ disabled }) => {
    const canvasRef = useRef(null);
    const systemRef = useRef(null);
    const frameIdRef = useRef(null);
    const disabledRef = useRef(disabled);
    /** Starts the frame loop if it is asleep (set by the loop effect below). */
    const wakeRef = useRef(null);

    useEffect(() => {
        disabledRef.current = disabled;

        if (disabled && systemRef.current) {
            systemRef.current.dropAll();
            systemRef.current.sleep();
        }
    }, [disabled]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const system = new ParticleSystem(canvas, ctx);
        systemRef.current = system;
        // Flights to a stub are placed a moment after they are booked, once the column has drawn.
        system.onPlaced = () => wakeRef.current?.();

        const handleResize = () => system.setViewport(window.innerWidth, window.innerHeight);

        window.addEventListener('resize', handleResize);
        handleResize();

        /**
         * Loot collected off the board flies to wherever it actually went. This is the only
         * particle source left.
         */
        const onCollected = (data) => {
            if (disabledRef.current || !isDrawn('itemFlight')) return;
            system.spawnCollected(data);
            if (system.particles.length) wakeRef.current?.();
        };
        const subCollected = EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, onCollected, UI_LISTENER);
        // The same flight for the eye only (a hero lifted from the dock).
        const subFly = EventBus.subscribe(UI_EVENTS.UI_PARTICLE_FLY, onCollected, UI_LISTENER);

        return () => {
            window.removeEventListener('resize', handleResize);
            subCollected();
            subFly();
            system.dropAll();
        };
    }, []);

    /**
     * The frame loop.
     * ⚠️ It sleeps when there is nothing to draw: once the last particle has landed and the
     * last sparkle faded, the loop stops asking for frames and hides the canvas, and a new
     * collection wakes it.
     */
    useEffect(() => {
        if (disabled) {
            wakeRef.current = null;
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
                frameIdRef.current = null;
            }
            return;
        }

        const loop = (time) => {
            frameIdRef.current = null;
            const system = systemRef.current;
            if (!system) return;
            system.update(time);
            if (system.particles.length || system.sparkles.length) {
                system.draw();
                frameIdRef.current = requestAnimationFrame(loop);
            } else {
                system.sleep();
            }
        };
        const wake = () => {
            if (frameIdRef.current == null && !disabledRef.current) {
                frameIdRef.current = requestAnimationFrame(loop);
            }
        };
        wakeRef.current = wake;
        const system = systemRef.current;
        if (system && (system.particles.length || system.sparkles.length)) wake();

        return () => {
            wakeRef.current = null;
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
                frameIdRef.current = null;
            }
        };
    }, [disabled]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed left-0 top-0 z-(--z-particles) pointer-events-none"
            style={CANVAS_STYLE}
        />
    );
};

class ParticleSystem {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.sparkles = [];
        /** Flights to a stub booked this burst, waiting to be placed (`_placeBooked`). */
        this._booked = [];
        /** Called once booked flights are in the air. */
        this.onPlaced = null;
        this.spriteCache = new Map();
        // The burst queue (`_nextSlot`): a place for the next particle, and when one was last asked for.
        this._slot = 0;
        this._lastSpawnAt = -Infinity;
        // Screen px: every flight's reach since the loop last slept (`_include`), the window,
        // and the canvas's rect as last set (`_fit`).
        this._bounds = null;
        this._view = { w: 0, h: 0 };
        this._rect = null;
    }

    setViewport(w, h) {
        this._view = { w, h };
    }

    /**
     * Drop every flight, in the air or waiting to be placed. A flight to a stub lets its count
     * through, since it will never land.
     */
    dropAll() {
        for (const p of this.particles) landFlight(p.booking);
        for (const b of this._booked) landFlight(b.booking);
        this.particles = [];
        this._booked = [];
        this.sparkles = [];
    }

    /** Nothing in the air: forget the flights' reach and hide the canvas. */
    sleep() {
        this._bounds = null;
        this._rect = null;
        this.canvas.style.display = 'none';
    }

    /** Widen the canvas's reach over a flight's whole path. */
    _include(path, size) {
        const half = size / 2;
        const side = Math.max(GLOW_R, half, FLIGHT_REACH.side) + EDGE_PX;
        const up = Math.max(GLOW_R, half, FLIGHT_REACH.up) + EDGE_PX;
        const down = Math.max(GLOW_R, half, FLIGHT_REACH.down) + EDGE_PX;
        // A quadratic curve stays inside the box of its three points.
        const box = {
            l: Math.min(path.startX, path.cpX, path.endX) - side,
            t: Math.min(path.startY, path.cpY, path.endY) - up,
            r: Math.max(path.startX, path.cpX, path.endX) + side,
            b: Math.max(path.startY, path.cpY, path.endY) + down
        };
        const a = this._bounds;
        this._bounds = a
            ? { l: Math.min(a.l, box.l), t: Math.min(a.t, box.t), r: Math.max(a.r, box.r), b: Math.max(a.b, box.b) }
            : box;
    }

    /**
     * Place and size the canvas over the flights' reach, cut to the window, in whole pixels so
     * everything draws on the same pixels a window-sized canvas would. The bitmap is only
     * re-made when the size changes.
     * @returns {boolean} whether any of it is on screen
     */
    _fit() {
        const b = this._bounds;
        const left = b ? Math.max(0, Math.floor(b.l)) : 0;
        const top = b ? Math.max(0, Math.floor(b.t)) : 0;
        const w = b ? Math.min(this._view.w, Math.ceil(b.r)) - left : 0;
        const h = b ? Math.min(this._view.h, Math.ceil(b.b)) - top : 0;
        const canvas = this.canvas;
        if (w <= 0 || h <= 0) {
            if (this._rect) {
                this._rect = null;
                canvas.style.display = 'none';
            }
            return false;
        }
        const r = this._rect;
        if (r && r.left === left && r.top === top && r.w === w && r.h === h) return true;
        const s = canvas.style;
        if (!r || r.left !== left) s.left = `${left}px`;
        if (!r || r.top !== top) s.top = `${top}px`;
        if (!r || r.w !== w) { canvas.width = w; s.width = `${w}px`; }
        if (!r || r.h !== h) { canvas.height = h; s.height = `${h}px`; }
        if (!r) s.display = 'block';
        this._rect = { left, top, w, h };
        return true;
    }

    /**
     * One collected sprite, flying from where it lay to where it went.
     * Loot banked from the mat lands on its own item stub, its count held back until it lands
     * (`stubLanding.js`); the flight is booked now and placed a moment later, after the column
     * has drawn a stub this collection made ({@link _placeBooked}). With the stubs not drawn,
     * items land on the Guild Hall Token on the mat, found live by `lootFlightTarget` so a
     * dragged Hall is followed; the Bank bubble is the fallback when the Hall is not on
     * screen. Items fly at the size they lay on the floor.
     * ⚠️ The stagger is global, not per-call. Collection is one call per sprite, so a Collect
     * All over forty sprites would fire forty particles on the same frame. `_nextSlot()`
     * spreads them across a shared queue and refuses beyond `MAX_CONCURRENT`; the loot is
     * still collected, it just stops drawing after a point, because forty simultaneous arcs is
     * noise rather than spectacle.
     */
    spawnCollected({ kind, refId, heroId, quantity, x, y, fromScreenX, fromScreenY, toScreenX, toScreenY, destination, trayX, trayY, instanceId }) {
        if (!SettingsManager.get('ui.itemParticles')) return;
        if (typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        const actualRefId = refId || heroId;
        if (!actualRefId) return;

        if (kind === 'token') return;
        const isHero = kind === 'hero' || destination === 'dock' || destination === 'cursor';

        // Items resolve through the item registry; Heroes have their own
        let template;
        if (isHero) {
            const hero = (GameState.heroes || []).find(h => h.id === actualRefId);
            const heroSpriteRef = hero?.spriteId || hero?.heroSprite || hero?.icon || hero?.classId || actualRefId;
            template = {
                id: actualRefId,
                icon: '🧙',
                color: '#c084fc',
                _src: resolveSpritePath(heroSpriteRef)
            };
        } else {
            template = getItem(actualRefId);
        }
        if (!template) return;

        let fromRect;
        if (fromScreenX != null && fromScreenY != null) {
            fromRect = {
                left: fromScreenX,
                top: fromScreenY,
                width: 0,
                height: 0,
                right: fromScreenX,
                bottom: fromScreenY
            };
        } else {
            fromRect = this._getRect({ boardX: x, boardY: y });
        }

        let toRect;
        let landsOn = null;
        let toStub = false;
        if (toScreenX != null && toScreenY != null) {
            toRect = {
                left: toScreenX,
                top: toScreenY,
                width: 0,
                height: 0,
                right: toScreenX,
                bottom: toScreenY
            };
        } else if (isHero) {
            toRect = this._getRect({ target: 'dock', heroId: actualRefId });
        } else if (destination === 'bank' && fliesToStub(actualRefId)) {
            toStub = true;
        } else {
            const landing = lootFlightTarget(document);
            toRect = landing?.rect;
            landsOn = landing?.target ?? null;
        }
        if (!fromRect || (!toRect && !toStub)) return;
        if (!this._isRectInViewport(fromRect)) return;

        this._preloadSprite(template);

        const startX = fromRect.left + (fromRect.width ? fromRect.width / 2 : 0);
        const startY = fromRect.top + (fromRect.height ? fromRect.height / 2 : 0);
        if (toStub) {
            this._bookStubFlight(template, quantity, startX, startY);
            return;
        }
        const endX = toRect.left + (toRect.width ? toRect.width / 2 : 0);
        const endY = toRect.top + (toRect.height ? toRect.height / 2 : 0);

        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const cpX = (startX + endX) / 2;
        const cpY = ((startY + endY) / 2) - dist * 0.2;

        if (![startX, startY, endX, endY, cpX, cpY].every(Number.isFinite)) return;

        // At most MAX_CONCURRENT from one burst, STAGGER_MS apart. Asked only once this
        // particle would really fly, so a refused one does not use up a place. The loot is
        // collected either way.
        const slot = this._nextSlot();
        if (slot == null) return;

        const particle = {
            itemId: template.id,
            icon: template.icon,
            spriteKey: template.id,
            mode: 'gain',
            destination,
            landsOn,
            booking: null,
            // An item keeps its floor size in flight; a hero keeps 32.
            size: isHero ? 32 : this._floorItemPx(),
            trayX,
            trayY,
            instanceId,
            startTime: performance.now() + slot * STAGGER_MS,
            duration: destination === 'cursor' ? 320 : flightDurationMs(dist),
            path: { startX, startY, endX, endY, cpX, cpY },
            trail: [],
            maxTrail: 15,
            color: template.color || '#4ade80'
        };
        this.particles.push(particle);
        this._include(particle.path, particle.size);
    }

    /**
     * Book a collected item's flight to its stub: its place in the burst now, and the stub's count
     * held back from now (so it never shows the item before it lands). Where it lands is read for
     * the whole burst at once, in a microtask: after React has drawn a stub this collection made,
     * before the next frame, so the flight is placed before it is ever drawn.
     * ⚠️ The order matters: React schedules its draw of the new stub (a microtask) when the hold
     * makes the store announce, and the placing microtask is queued after it.
     */
    _bookStubFlight(template, quantity, startX, startY) {
        if (!Number.isFinite(startX) || !Number.isFinite(startY)) return;
        const slot = this._nextSlot();
        if (slot == null) return;
        const booking = bookFlight(template.id, quantity);
        if (!booking) return;
        this._booked.push({
            booking,
            template,
            startX,
            startY,
            startTime: performance.now() + slot * STAGGER_MS,
            size: this._floorItemPx()
        });
        if (this._booked.length === 1) queueMicrotask(() => this._placeBooked());
    }

    /**
     * Put the burst's booked flights in the air: one batch of reads for every stub they go to.
     * One with no place on the stubs (no column any more, no room for another copy) flies to
     * the Guild Hall instead; its count still ticks when it lands.
     */
    _placeBooked() {
        const booked = this._booked;
        this._booked = [];
        if (!booked.length) return;
        placeFlights(booked.map(b => b.booking));
        let hall;
        for (const b of booked) {
            let end = b.booking.spot;
            let landsOn = 'stub';
            if (!end) {
                if (hall === undefined) hall = lootFlightTarget(document);
                const r = hall?.rect;
                end = r ? { x: r.left + (r.width ? r.width / 2 : 0), y: r.top + (r.height ? r.height / 2 : 0) } : null;
                landsOn = hall?.target ?? null;
            }
            const dx = end ? end.x - b.startX : 0;
            const dy = end ? end.y - b.startY : 0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const cpX = end ? (b.startX + end.x) / 2 : NaN;
            // Arcs as any flight does, but never over the top of the screen: the stubs sit just
            // under it, and an arc there would leave the screen and come back.
            const cpY = end ? Math.max(STUB_ARC_TOP_PX, ((b.startY + end.y) / 2) - dist * 0.2) : NaN;
            if (!end || dist < 1 || ![end.x, end.y, cpX, cpY].every(Number.isFinite)) {
                landFlight(b.booking);
                continue;
            }
            const particle = {
                itemId: b.template.id,
                icon: b.template.icon,
                spriteKey: b.template.id,
                mode: 'gain',
                destination: 'bank',
                landsOn,
                booking: b.booking,
                size: b.size,
                startTime: b.startTime,
                duration: flightDurationMs(dist),
                path: { startX: b.startX, startY: b.startY, endX: end.x, endY: end.y, cpX, cpY },
                trail: [],
                maxTrail: 15,
                color: b.template.color || '#4ade80'
            };
            this.particles.push(particle);
            this._include(particle.path, particle.size);
        }
        if (this.particles.length) this.onPlaced?.();
    }

    /**
     * A place in the shared stagger queue, or null when too many are already
     * queued. Resets once the board has been quiet briefly, so consecutive
     * bursts each start from zero rather than compounding.
     */
    _nextSlot() {
        const now = performance.now();
        if (now - this._lastSpawnAt > STAGGER_RESET_MS) this._slot = 0;
        this._lastSpawnAt = now;
        if (this._slot >= MAX_CONCURRENT) return null;
        return this._slot++;
    }

    /**
     * `source` is either 'bank-bubble-target' (the Bank nav bubble, a fixed landing spot), or
     * an element carrying `data-card-id` or `data-quest-id`.
     */
    _getRect(source) {
        // A point on the board, in board coordinates.
        if (source && typeof source === 'object' && source.boardX != null) {
            const board = document.querySelector('[data-board-origin]');
            if (!board) return null;
            const { x, y } = boardPointToScreen(board, source.boardX, source.boardY);
            return { left: x, top: y, width: 0, height: 0, right: x, bottom: y };
        }
        if (typeof source === 'string' && source.endsWith('-bubble-target')) {
            return document.getElementById(source)?.getBoundingClientRect();
        }
        if (source === 'dock' || (typeof source === 'string' && source.includes('dock')) || (typeof source === 'object' && source.target === 'dock')) {
            const heroId = typeof source === 'object' ? source.heroId : null;
            if (heroId) {
                const heroCard = document.querySelector(`[data-dock-hero-id="${heroId}"]`);
                if (heroCard) return heroCard.getBoundingClientRect();
            }
            const dockEl = document.querySelector('[data-vertical-dock]') || document.getElementById('vertical-dock-recall');
            if (dockEl) return dockEl.getBoundingClientRect();
        }
        if (typeof source === 'string') {
            const byQuest = document.querySelector(`[data-quest-id="${source}"]`);
            if (byQuest) return byQuest.getBoundingClientRect();
        }
        return document.querySelector(`[data-card-id="${source}"]`)?.getBoundingClientRect();
    }

    /** An item's on-screen floor size, from the mat's live fit (`data-board-scale`). */
    _floorItemPx() {
        const board = document.querySelector('[data-board-origin]');
        const fit = Number(board?.getAttribute?.('data-board-scale'));
        return lootSpriteScreenPx(fit > 0 ? fit : 1);
    }

    _isRectInViewport(rect) {
        return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
        );
    }

    /**
     * Takes the full item template, not just its id: `resolveSpritePath` needs the object's
     * own `sprite`/`spriteId` field (e.g. item id `oak_wood` has `sprite: "i_wood_oak"`), the
     * same way `ItemIcon.jsx` resolves it. A bare id used the wrong manifest key and every
     * particle silently fell back to the emoji icon.
     */
    _preloadSprite(template) {
        if (this.spriteCache.has(template.id)) return;
        const img = new Image();
        // `_src` is set for Tokens, whose art lives in the Token registry rather
        // than anywhere `resolveSpritePath` looks.
        img.src = template._src || resolveSpritePath(template);
        this.spriteCache.set(template.id, { img, loaded: false });
        img.onload = () => {
            const data = this.spriteCache.get(template.id);
            if (data) data.loaded = true;
        };
    }

    update(currentTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (currentTime < p.startTime) continue;

            const elapsed = currentTime - p.startTime;
            const t = Math.min(1, elapsed / p.duration);

            const invT = 1 - t;
            const lastX = p.x;
            const lastY = p.y;

            p.x = invT * invT * p.path.startX + 2 * invT * t * p.path.cpX + t * t * p.path.endX;
            p.y = invT * invT * p.path.startY + 2 * invT * t * p.path.cpY + t * t * p.path.endY;

            if (lastX !== undefined && Math.random() > 0.4) {
                this.sparkles.push({
                    x: p.x + (Math.random() - 0.5) * 10,
                    y: p.y + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 2,
                    vy: Math.random() * 2, // Drift down
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.03,
                    color: p.color
                });
            }

            p.trail.unshift({ x: p.x, y: p.y });
            if (p.trail.length > p.maxTrail) p.trail.pop();

            if (t >= 1) {
                // A stub's count ticks as its item lands.
                landFlight(p.booking);
                // Notify that the particle has landed for visual feedback (e.g. a Guild Hall
                // flash).
                EventBus.publish(UI_EVENTS.PARTICLE_LANDED, {
                    itemId: p.itemId,
                    mode: p.mode,
                    destination: p.destination,
                    landsOn: p.landsOn,
                    // Where it landed and how big it was, in screen px (probes).
                    x: p.path.endX,
                    y: p.path.endY,
                    size: p.size,
                    trayX: p.trayX,
                    trayY: p.trayY,
                    instanceId: p.instanceId
                });

                for(let k=0; k<8; k++) {
                    this.sparkles.push({
                        x: p.x, y: p.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4,
                        life: 1.0,
                        decay: 0.05,
                        color: p.color
                    });
                }
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const s = this.sparkles[i];
            s.x += s.vx;
            s.y += s.vy;
            s.life -= s.decay;
            if (s.life <= 0) this.sparkles.splice(i, 1);
        }
    }

    draw() {
        if (!this._fit()) return;
        const ctx = this.ctx;
        const { left, top, w, h } = this._rect;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // Everything below is in screen pixels; the canvas stands at (left, top).
        ctx.setTransform(1, 0, 0, 1, -left, -top);

        // Use Additive Blending for that "Glow" look
        ctx.globalCompositeOperation = 'lighter';

        this.sparkles.forEach(s => {
            ctx.globalAlpha = s.life;
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x, s.y, 2, 2);
        });

        this.particles.forEach(p => {
            if (performance.now() < p.startTime) return;
            if (!isFinite(p.x) || !isFinite(p.y)) return;

            if (p.trail.length > 1) {
                for (let j = 0; j < p.trail.length - 1; j++) {
                    const ratio = 1 - (j / p.trail.length);
                    ctx.beginPath();
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 20 * ratio; // Thicker Tapering
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 0.3 * ratio;
                    ctx.moveTo(p.trail[j].x, p.trail[j].y);
                    ctx.lineTo(p.trail[j+1].x, p.trail[j+1].y);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 6 * ratio; // Thicker Core
                    ctx.globalAlpha = 0.5 * ratio;
                    ctx.moveTo(p.trail[j].x, p.trail[j].y);
                    ctx.lineTo(p.trail[j+1].x, p.trail[j+1].y);
                    ctx.stroke();
                }
            }

            const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, GLOW_R);
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, GLOW_R, 0, Math.PI * 2);
            ctx.fill();

            // 2.3 Draw Sprite (Normal blending for the sprite itself)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            const sprite = this.spriteCache.get(p.spriteKey);
            const size = p.size || 32;
            if (sprite && sprite.loaded) {
                // Whole-multiple pixel art: no smoothing, or 2x art blurs.
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sprite.img, p.x - size / 2, p.y - size / 2, size, size);
            } else {
                ctx.font = `${Math.round(size * 0.75)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.icon, p.x, p.y);
            }
            ctx.globalCompositeOperation = 'lighter';
        });
        
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }
}

export default ParticleOverlay;
