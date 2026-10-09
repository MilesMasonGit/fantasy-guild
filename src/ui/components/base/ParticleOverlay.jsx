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
 * where it went, with sparkles.
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
            systemRef.current.particles = [];
            systemRef.current.sparkles = [];
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    }, [disabled]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const system = new ParticleSystem(canvas, ctx);
        systemRef.current = system;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

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
        };
    }, []);

    /**
     * The frame loop.
     * ⚠️ It sleeps when there is nothing to draw: once the last particle has landed and the
     * last sparkle faded, the loop stops asking for frames, and a new collection wakes it. The
     * final frame before sleeping has just run `draw()`, which clears the canvas first, so
     * nothing is left on screen.
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
            system.draw();
            if (system.particles.length || system.sparkles.length) {
                frameIdRef.current = requestAnimationFrame(loop);
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
            className="fixed inset-0 z-[10000] pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
        />
    );
};

class ParticleSystem {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.sparkles = [];
        this.spriteCache = new Map();
        // The burst queue (`_nextSlot`): a place for the next particle, and when one was last asked for.
        this._slot = 0;
        this._lastSpawnAt = -Infinity;
    }

    /**
     * One collected sprite, flying from where it lay to where it went.
     * Items land on the Guild Hall Token on the mat, found live by `lootFlightTarget` so a
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
        } else {
            const landing = lootFlightTarget(document);
            toRect = landing?.rect;
            landsOn = landing?.target ?? null;
        }
        if (!fromRect || !toRect) return;
        if (!this._isRectInViewport(fromRect)) return;

        this._preloadSprite(template);

        const startX = fromRect.left + (fromRect.width ? fromRect.width / 2 : 0);
        const startY = fromRect.top + (fromRect.height ? fromRect.height / 2 : 0);
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

        this.particles.push({
            itemId: template.id,
            icon: template.icon,
            spriteKey: template.id,
            mode: 'gain',
            destination,
            landsOn,
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
        });
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
     * own `sprite`/`spriteId` field (e.g. item id `oak_wood` has `sprite: "wood_oak"`), the
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
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

            const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 25);
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
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
