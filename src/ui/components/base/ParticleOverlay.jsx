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
import { LOOT_FLIGHT_SPARKLES } from '../../utils/lootEffects.js';
import { isDrawingPaused } from '../board/frameClock.js';

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

/**
 * The trail: hard 2×2 pixels on the path behind the item, this far back in its flight each. Read
 * from the path itself, so it is the same at any frame rate.
 */
const TRAIL_BACK_MS = Object.freeze([35, 70, 105]);
const TRAIL_PX = 2;

/**
 * The plink on arrival: four pixels jumping out from where the item landed, up, down, left and
 * right, this far (px) on each step, a step this long; then gone.
 */
const PLINK_STEPS_PX = Object.freeze([3, 6, 9]);
const PLINK_STEP_MS = 50;

/** The trail's colour where an item names none. */
const TRAIL_COLOUR = '#ffe27a';

/**
 * How far past its path a flight can draw, in px, not counting the item itself (half its size,
 * added per flight): the plink's reach and its pixel. The trail lies on the path.
 * ⚠️ Follows the plink numbers above: `ParticleCanvasBounds.test.js` fails when something is
 * drawn outside the canvas.
 */
const FLIGHT_REACH = { side: 12, up: 12, down: 12 };
const EDGE_PX = 0;
/** The highest a flight to a stub may arc: the item stays on screen under the top edge. */
const STUB_ARC_TOP_PX = 25;

const CANVAS_STYLE = { imageRendering: 'pixelated', display: 'none' };

/** Over the mat, under the drawers, the hero panel and the nav (tailwind.css). */
const CANVAS_CLASS = 'fixed left-0 top-0 z-(--z-mat-flights) pointer-events-none';

/**
 * Where a board point (natural board pixels / mat units) is on screen.
 * ⚠️ The board is drawn at its natural size and then CSS-scaled to fit (`useBoardScale`), so
 * its on-screen rect is the SCALED box. A board point has to be multiplied by that scale
 * (`rect.width / data-natural-width`) before it is added to the rect's corner; without it,
 * loot sparkles start further from their Token the smaller the window. A board with no
 * `data-natural-width` reads as unscaled.
 */
export function boardPointToScreen(boardEl, x, y) {
    return boardToScreen(boardEl)(x, y);
}

/** {@link boardPointToScreen} for many points from one read of the board's box. */
function boardToScreen(boardEl) {
    const r = boardEl.getBoundingClientRect();
    const natural = Number(boardEl.getAttribute?.('data-natural-width'));
    const scale = natural > 0 && r.width > 0 ? r.width / natural : 1;
    return (x, y) => ({ x: r.left + x * scale, y: r.top + y * scale });
}

/**
 * ParticleOverlay: a Canvas layer for UI-space effects. Visualizes collected loot flying to
 * where it went (effect 5, crisp): its own item stub, or the Guild Hall when the stubs are not
 * drawn. A short trail of hard 2×2 pixels behind it and a four-pixel plink where it lands draw
 * for loot only with `LOOT_FLIGHT_SPARKLES` on; a recalled hero keeps its trail.
 * Nothing random: every flight with the same path draws the same pixels.
 * ⚠️ A collection reads no box. Auto-collect runs inside the engine's tick, where one box read lays
 * the page out in the middle of the tick and again for the frame. A flight is booked when it is
 * collected and placed by the frame loop (`ParticleSystem.placeBooked`), before it draws for the
 * first time, with one read of the board's box for the whole batch: the layout the frame was
 * about to do anyway. A collection while drawing is paused (a hidden window) books nothing: no
 * frame would place it, so its count shows at once.
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

        const handleResize = () => system.setViewport(window.innerWidth, window.innerHeight);

        window.addEventListener('resize', handleResize);
        handleResize();

        /**
         * Loot collected off the board flies to wherever it actually went.
         */
        const onCollected = (data) => {
            if (disabledRef.current || !isDrawn('itemFlight')) return;
            system.spawnCollected(data);
            if (system.booked.length || system.particles.length) wakeRef.current?.();
        };
        const unsubscribe = EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, onCollected, UI_LISTENER);

        return () => {
            window.removeEventListener('resize', handleResize);
            unsubscribe();
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
            // ⚠️ Before anything this frame writes: `draw` moves and sizes the canvas.
            system.placeBooked();
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
            className={CANVAS_CLASS}
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
        /** Flights collected since the last frame, waiting to be placed ({@link placeBooked}). */
        this.booked = [];
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
        for (const b of this.booked) landFlight(b.booking);
        this.particles = [];
        this.booked = [];
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
        const side = Math.max(half, FLIGHT_REACH.side) + EDGE_PX;
        const up = Math.max(half, FLIGHT_REACH.up) + EDGE_PX;
        const down = Math.max(half, FLIGHT_REACH.down) + EDGE_PX;
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
     * Loot banked from the mat lands on its own item stub, its count held back from now until it
     * lands (`stubLanding.js`). With the stubs not drawn, items land on the Guild Hall Token on the
     * mat, found live by `lootFlightTarget` so a dragged Hall is followed; the Bank bubble is the
     * fallback when the Hall is not on screen. Items fly at the size they lay on the floor.
     * ⚠️ The stagger is global, not per-call. Collection is one call per sprite, so a Collect
     * All over forty sprites would fire forty particles on the same frame. `_nextSlot()`
     * spreads them across a shared queue and refuses beyond `MAX_CONCURRENT`; the loot is
     * still collected, it just stops drawing after a point, because forty simultaneous arcs is
     * noise rather than spectacle. A refused one holds nothing back: its count shows at once.
     */
    spawnCollected({ kind, refId, heroId, quantity, x, y, fromScreenX, fromScreenY, toScreenX, toScreenY, destination, instanceId }) {
        if (!SettingsManager.get('ui.itemParticles')) return;
        // ⚠️ No frames while drawing is paused: a booking would hold its stub's count back until the
        // window came back, and then every one would land at once.
        if (isDrawingPaused()) return;
        if (typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        const actualRefId = refId || heroId;
        if (!actualRefId) return;

        if (kind === 'token') return;
        const isHero = kind === 'hero' || destination === 'dock';

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

        const to = toScreenX != null && toScreenY != null ? { x: toScreenX, y: toScreenY } : null;
        const toStub = !to && !isHero && destination === 'bank' && fliesToStub(actualRefId);

        const slot = this._nextSlot();
        if (slot == null) return;
        // The hold now, in the same tick as the Bank's change, so the stub never shows the item early.
        const booking = toStub ? bookFlight(template.id, quantity) : null;
        if (toStub && !booking) return;

        this._preloadSprite(template);
        this.booked.push({
            template,
            booking,
            heroId: isHero ? actualRefId : null,
            destination,
            instanceId,
            from: fromScreenX != null && fromScreenY != null ? { x: fromScreenX, y: fromScreenY } : null,
            boardPoint: { x, y },
            to,
            // An item keeps its floor size in flight; a hero keeps 32.
            size: isHero ? 32 : this._floorItemPx(),
            startTime: performance.now() + slot * STAGGER_MS
        });
    }

    /**
     * Put the flights collected since the last frame in the air: one batch of reads for all of them,
     * after React has drawn any stub a collection made. A flight that turns out to have nowhere to
     * go (a point off the screen, a landing it already stands on) lets its count through.
     */
    placeBooked() {
        const booked = this.booked;
        if (!booked.length) return;
        this.booked = [];
        const toStubs = booked.filter(b => b.booking).map(b => b.booking);
        if (toStubs.length) placeFlights(toStubs);
        let hall;
        const hallLanding = () => {
            if (hall === undefined) hall = lootFlightTarget(document);
            return hall;
        };
        let toScreen;
        const boardPoint = (p) => {
            if (toScreen === undefined) {
                const board = document.querySelector('[data-board-origin]');
                toScreen = board ? boardToScreen(board) : null;
            }
            return toScreen ? toScreen(p.x, p.y) : null;
        };
        for (const b of booked) {
            const particle = this._flightOf(b, hallLanding, boardPoint);
            if (!particle) {
                landFlight(b.booking);
                continue;
            }
            this.particles.push(particle);
            this._include(particle.path, particle.size);
        }
    }

    /** A booked flight with its path worked out from the boxes as they stand now, or null. */
    _flightOf(b, hallLanding, boardPoint) {
        const from = b.from || boardPoint(b.boardPoint);
        if (!from || !this._isPointInViewport(from)) return null;

        // A flight to a stub with no place on the stubs (no column any more, no room for another
        // copy) flies to the Guild Hall instead; its count still ticks when it lands.
        let end = b.to || b.booking?.spot || null;
        let landsOn = b.booking?.spot ? 'stub' : null;
        if (!end) {
            const landing = b.heroId ? { rect: this._dockRect(b.heroId) } : hallLanding();
            const r = landing?.rect;
            end = r ? { x: r.left + (r.width ? r.width / 2 : 0), y: r.top + (r.height ? r.height / 2 : 0) } : null;
            landsOn = landing?.target ?? null;
        }
        if (!end) return null;

        const dx = end.x - from.x;
        const dy = end.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return null;

        const cpX = (from.x + end.x) / 2;
        const arc = ((from.y + end.y) / 2) - dist * 0.2;
        // Booked for a stub, it arcs as any flight does, but never over the top of the screen: the
        // stubs sit just under it, and an arc there would leave the screen and come back.
        const cpY = b.booking ? Math.max(STUB_ARC_TOP_PX, arc) : arc;
        if (![from.x, from.y, end.x, end.y, cpX, cpY].every(Number.isFinite)) return null;

        return {
            itemId: b.template.id,
            icon: b.template.icon,
            spriteKey: b.template.id,
            mode: 'gain',
            destination: b.destination,
            landsOn,
            booking: b.booking,
            size: b.size,
            instanceId: b.instanceId,
            startTime: b.startTime,
            duration: flightDurationMs(dist),
            path: { startX: from.x, startY: from.y, endX: end.x, endY: end.y, cpX, cpY },
            color: b.template.color || TRAIL_COLOUR,
            trail: !!b.heroId || LOOT_FLIGHT_SPARKLES
        };
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

    /** The box of a hero in the dock, or of the dock. */
    _dockRect(heroId) {
        const heroCard = document.querySelector(`[data-dock-hero-id="${heroId}"]`);
        if (heroCard) return heroCard.getBoundingClientRect();
        const dockEl = document.querySelector('[data-vertical-dock]') || document.getElementById('vertical-dock-recall');
        return dockEl ? dockEl.getBoundingClientRect() : null;
    }

    /** An item's on-screen floor size, from the mat's live fit (`data-board-scale`). */
    _floorItemPx() {
        const board = document.querySelector('[data-board-origin]');
        const fit = Number(board?.getAttribute?.('data-board-scale'));
        return lootSpriteScreenPx(fit > 0 ? fit : 1);
    }

    _isPointInViewport({ x, y }) {
        return y >= 0 && x >= 0 && y <= window.innerHeight && x <= window.innerWidth;
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

    /** Where a flight is at `t` (0 to 1) along its arc. */
    static pointAt(path, t) {
        const k = Math.max(0, Math.min(1, t));
        const inv = 1 - k;
        return {
            x: inv * inv * path.startX + 2 * inv * k * path.cpX + k * k * path.endX,
            y: inv * inv * path.startY + 2 * inv * k * path.cpY + k * k * path.endY
        };
    }

    update(currentTime) {
        this._now = currentTime;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (currentTime < p.startTime) continue;

            const t = Math.min(1, (currentTime - p.startTime) / p.duration);
            const at = ParticleSystem.pointAt(p.path, t);
            p.x = at.x;
            p.y = at.y;

            if (t >= 1) {
                // A stub's count ticks as its item lands.
                landFlight(p.booking);
                // Notify that the particle has landed for visual feedback (the Guild Hall's dip).
                EventBus.publish(UI_EVENTS.PARTICLE_LANDED, {
                    itemId: p.itemId,
                    mode: p.mode,
                    destination: p.destination,
                    landsOn: p.landsOn,
                    // Where it landed and how big it was, in screen px (probes).
                    x: p.path.endX,
                    y: p.path.endY,
                    size: p.size,
                    instanceId: p.instanceId
                });
                if (p.trail) this.sparkles.push({ x: p.path.endX, y: p.path.endY, born: currentTime, color: p.color });
                this.particles.splice(i, 1);
            }
        }

        // The plinks: gone once their last step has shown.
        const plinkMs = PLINK_STEPS_PX.length * PLINK_STEP_MS;
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            if (currentTime - this.sparkles[i].born >= plinkMs) this.sparkles.splice(i, 1);
        }
    }

    /**
     * Hard pixels only: no glow, no blending, no soft trail. Every square and the item land on
     * whole pixels, and the item is drawn with no smoothing.
     */
    draw() {
        if (!this._fit()) return;
        const ctx = this.ctx;
        const { left, top, w, h } = this._rect;
        const now = this._now ?? performance.now();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // Everything below is in screen pixels; the canvas stands at (left, top).
        ctx.setTransform(1, 0, 0, 1, -left, -top);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const half = TRAIL_PX / 2;

        for (const s of this.sparkles) {
            const step = Math.min(PLINK_STEPS_PX.length - 1, Math.floor((now - s.born) / PLINK_STEP_MS));
            const d = PLINK_STEPS_PX[Math.max(0, step)];
            const x = Math.round(s.x);
            const y = Math.round(s.y);
            ctx.fillStyle = s.color;
            for (const [dx, dy] of [[0, -d], [d, 0], [0, d], [-d, 0]]) {
                ctx.fillRect(x + dx - half, y + dy - half, TRAIL_PX, TRAIL_PX);
            }
        }

        for (const p of this.particles) {
            if (now < p.startTime) continue;
            if (!isFinite(p.x) || !isFinite(p.y)) continue;
            const t = (now - p.startTime) / p.duration;
            ctx.fillStyle = p.color;
            if (p.trail) {
                for (const back of TRAIL_BACK_MS) {
                    const k = t - back / p.duration;
                    if (k <= 0) continue;
                    const at = ParticleSystem.pointAt(p.path, k);
                    ctx.fillRect(Math.round(at.x) - half, Math.round(at.y) - half, TRAIL_PX, TRAIL_PX);
                }
            }

            const sprite = this.spriteCache.get(p.spriteKey);
            const size = p.size || 32;
            const x = Math.round(p.x - size / 2);
            const y = Math.round(p.y - size / 2);
            if (sprite && sprite.loaded) {
                // Whole-multiple pixel art at whole pixels: no smoothing, or 2x art blurs.
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sprite.img, x, y, size, size);
            } else {
                ctx.font = `${Math.round(size * 0.75)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.icon, Math.round(p.x), Math.round(p.y));
            }
        }
    }
}

export default ParticleOverlay;
