import React, { useEffect, useRef } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';

/** Gap between staggered particles from one collection burst. */
const STAGGER_RESET_MS = 250;

/**
 * How many particles one burst may draw. A Collect All can take forty sprites
 * at once; forty arcs on one frame reads as noise, not reward. The rest are
 * collected exactly the same — they just do not draw.
 */
const MAX_CONCURRENT = 12;

/**
 * ParticleOverlay - A high-performance Canvas layer for UI-space effects.
 * Visualizes items flying between Cards and the Bank nav bubble.
 */
export const ParticleOverlay = ({ disabled }) => {
    const canvasRef = useRef(null);
    const systemRef = useRef(null);
    const frameIdRef = useRef(null);
    const disabledRef = useRef(disabled);

    // Sync ref
    useEffect(() => {
        disabledRef.current = disabled;
        
        // If we are disabling, clear active particles for a clean look
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

        // Subscribe to item events
        const subLoot = EventBus.subscribe('loot_generated', (data) => {
            if (disabledRef.current) return;
            if (!data.cardId || !data.drops) return;
            system.spawnFlyingItems(data.cardId, 'bank-bubble-target', data.drops, 'gain');
        });

        const subConsumed = EventBus.subscribe('items_consumed', (data) => {
            if (disabledRef.current) return;
            if (!data.cardId || !data.items) return;
            system.spawnFlyingItems('bank-bubble-target', data.cardId, data.items, 'consume');
        });

        const subMapTossed = EventBus.subscribe('map_tossed', (data) => {
            if (disabledRef.current) return;
            if (!data.sourceCardId) return;
            system.spawnMapToss(data.sourceCardId, { boardX: data.targetX, boardY: data.targetY }, data.mapId, data.tokenTypeId);
        });

        /**
         * Loot collected off the board flies to wherever it actually went
         * (D-236).
         *
         * ⚠️ This deliberately does **not** reuse the `loot_generated`
         * subscription above. That one bails on `!data.cardId`, and board loot
         * has no card — which is the whole reason the particle system has been
         * silent on the board since the rework. It also fires when loot is
         * *created*, not when it is *taken*, so it would have flown things that
         * were still lying on the floor.
         */
        const subCollected = EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, (data) => {
            if (disabledRef.current) return;
            system.spawnCollected(data);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            subLoot();
            subConsumed();
            subMapTossed();
            subCollected();
        };
    }, []);

    // Dedicated Animation Loop Effect
    useEffect(() => {
        if (disabled) {
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
                frameIdRef.current = null;
            }
            return;
        }

        const loop = (time) => {
            if (systemRef.current) {
                systemRef.current.update(time);
                systemRef.current.draw();
            }
            frameIdRef.current = requestAnimationFrame(loop);
        };
        frameIdRef.current = requestAnimationFrame(loop);

        return () => {
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
    }

    /**
     * Spawn flying item particles between two DOM targets
     */
    /**
     * One collected sprite, flying from where it lay to where it went (D-236).
     *
     * Items land on the **Bank** bubble, Tokens on the **Token Vault** bubble
     * (D-232) — each aims at the door its contents actually went through, so the
     * particle teaches the routing rather than just decorating it.
     *
     * ⚠️ **The stagger is global, not per-call.** `spawnFlyingItems` staggers by
     * array index, which works for one card dropping five things. Collection is
     * one call per sprite, so a Collect All over forty sprites would have fired
     * forty particles on the same frame. `_nextSlot()` spreads them across a
     * shared queue and refuses beyond `MAX_CONCURRENT` — the loot is still
     * collected, it just stops drawing after a point, because forty simultaneous
     * arcs is noise rather than spectacle.
     */
    spawnCollected({ kind, refId, quantity, x, y, fromScreenX, fromScreenY, destination, trayX, trayY, instanceId }) {
        if (!SettingsManager.get('ui.itemParticles')) return;
        if (typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        if (!refId) return;

        const isToken = kind === 'token';
        let target;
        if (isToken) {
            target = destination === 'tray' ? 'tray-bubble-target' : 'vault-bubble-target';
        } else {
            target = 'bank-bubble-target';
        }

        // Items resolve through the item registry; Tokens have their own, and
        // `resolveSpritePath` knows nothing about them.
        const template = isToken
            ? { id: refId, color: '#60a5fa', _src: tokenSpritePath(refId) }
            : getItem(refId);
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

        const toRect = this._getRect(target);
        if (!fromRect || !toRect) return;
        if (!this._isRectInViewport(fromRect)) return;

        this._preloadSprite(template);

        const startX = fromRect.left;
        const startY = fromRect.top;
        let endX = toRect.left + toRect.width / 2;
        let endY = toRect.top + toRect.height / 2;

        if (isToken && destination === 'tray' && trayX != null && trayY != null) {
            const tokenPx = 48;
            endX = toRect.left + trayX * Math.max(0, toRect.width - tokenPx) + tokenPx / 2;
            endY = toRect.top + trayY * Math.max(0, toRect.height - tokenPx) + tokenPx / 2;
        }

        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const cpX = (startX + endX) / 2;
        const cpY = ((startY + endY) / 2) - dist * 0.2;

        if (![startX, startY, endX, endY, cpX, cpY].every(Number.isFinite)) return;

        this.particles.push({
            itemId: template.id,
            icon: template.icon,
            spriteKey: template.id,
            mode: 'gain',
            destination,
            trayX,
            trayY,
            instanceId,
            startTime: performance.now(),
            duration: 650 + Math.random() * 150,
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
        if (now - (this._lastSpawnAt || 0) > STAGGER_RESET_MS) this._slot = 0;
        this._lastSpawnAt = now;
        if (this._slot >= MAX_CONCURRENT) return null;
        return this._slot++;
    }

    spawnFlyingItems(fromSource, toTarget, items, mode) {
        if (!SettingsManager.get('ui.itemParticles')) return;

        // Spawn a particle for each item type
        items.forEach((item, index) => {
            const template = getItem(item.itemId || item.id);
            if (!template) return;

            // Resolve screen positions (center of whichever DOM node each side is)
            const fromRect = this._getRect(fromSource);
            const toRect = this._getRect(toTarget);

            if (!fromRect || !toRect) return;

            // Visibility Check
            if (mode === 'gain' && !this._isRectInViewport(fromRect)) return;
            if (mode === 'consume' && !this._isRectInViewport(toRect)) return;

            // Coordinate Calculation — center of the source/target rect either way
            // (the Bank bubble is a small circle now, not a wide bar, so there's
            // no special-cased offset to aim at within it).
            const startX = fromRect.left + fromRect.width / 2;
            const startY = fromRect.top + fromRect.height / 2;
            const endX = toRect.left + toRect.width / 2;
            const endY = toRect.top + toRect.height / 2;

            // Load sprite if not cached
            this._preloadSprite(template);

            // Stagger spawn times for multiple items
            const delay = index * 80;
            
            const dx = endX - startX;
            const dy = endY - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 1) return;
            
            // Moderate Rainbow Arc
            const cpX = (startX + endX) / 2;
            const height = dist * 0.2; 
            const cpY = ((startY + endY) / 2) - height;

            if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY) || !isFinite(cpX) || !isFinite(cpY)) {
                return;
            }

            this.particles.push({
                itemId: template.id,
                icon: template.icon,
                spriteKey: template.id,
                mode: mode, // 'gain' or 'consume'
                startTime: performance.now() + delay,
                duration: 700 + Math.random() * 300,
                path: { startX, startY, endX, endY, cpX, cpY },
                trail: [],
                maxTrail: 15,
                color: template.color || '#4ade80' // Default to a nice green
            });
        });
    }

    spawnMapToss(source, target, mapId, tokenTypeId) {
        const startRect = this._getRect(source);
        const endRect = this._getRect(target);
        if (!startRect || !endRect) return;

        const startX = startRect.left + startRect.width / 2;
        const startY = startRect.top + startRect.height / 2;
        const endX = endRect.left;
        const endY = endRect.top;

        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        // Big dramatic high toss arc upwards from quest card to playmat
        const cpX = (startX + endX) / 2;
        const height = Math.max(120, dist * 0.35);
        const cpY = Math.min(startY, endY) - height;

        const template = {
            id: tokenTypeId || 'token_map',
            icon: '🗺️',
            color: '#f59e0b',
            _src: '/assets/playmat/tokens/pm_token_map.png'
        };
        this._preloadSprite(template);

        this.particles.push({
            itemId: template.id,
            icon: template.icon,
            spriteKey: template.id,
            mode: 'toss',
            startTime: performance.now(),
            duration: 750,
            path: { startX, startY, endX, endY, cpX, cpY },
            trail: [],
            maxTrail: 20,
            color: '#fbbf24'
        });
    }

    /** `source` is either 'bank-bubble-target' (the Bank nav bubble, a fixed
     *  landing spot — owner design 2026-08-01, replacing the old per-item
     *  bank-tile targeting that nothing in the current UI renders anymore)
     *  or a card instance id (`data-card-id`, set by GICard) or quest id (`data-quest-id`). */
    _getRect(source) {
        // A point on the board, in board coordinates (D-236). Previously there
        // was **no way to express "from tile 31"** — a source could only be the
        // Bank bubble or a card — which is half of why board loot never flew.
        if (source && typeof source === 'object' && source.boardX != null) {
            const board = document.querySelector('[data-board-origin]');
            if (!board) return null;
            const r = board.getBoundingClientRect();
            return {
                left: r.left + source.boardX, top: r.top + source.boardY,
                width: 0, height: 0,
                right: r.left + source.boardX, bottom: r.top + source.boardY
            };
        }
        if (typeof source === 'string' && source.endsWith('-bubble-target')) {
            return document.getElementById(source)?.getBoundingClientRect();
        }
        if (typeof source === 'string') {
            const byQuest = document.querySelector(`[data-quest-id="${source}"]`);
            if (byQuest) return byQuest.getBoundingClientRect();
        }
        return document.querySelector(`[data-card-id="${source}"]`)?.getBoundingClientRect();
    }

    _isRectInViewport(rect) {
        return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
        );
    }

    /** Takes the full item template, not just its id — `resolveSpritePath`
     *  needs the object's own `sprite`/`spriteId` field (e.g. item id
     *  `oak_wood` has `sprite: "wood_oak"`; they're rarely the same string),
     *  the same way `ItemIcon.jsx` resolves it. Passing the bare id here
     *  before meant the manifest lookup used the wrong key and the image
     *  never loaded, so every particle silently fell back to the emoji icon. */
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
        // 1. Update Particles
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

            // Spawn Sparkles along the path
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
                // Notify that the particle has landed for visual feedback (e.g., Vault flashes, Tray landings)
                EventBus.publish('particle_landed', {
                    itemId: p.itemId,
                    mode: p.mode,
                    destination: p.destination,
                    trayX: p.trayX,
                    trayY: p.trayY,
                    instanceId: p.instanceId
                });

                // Spawn a little burst of sparkles at the end
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

        // 2. Update Sparkles
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

        // 1. Draw Sparkles
        this.sparkles.forEach(s => {
            ctx.globalAlpha = s.life;
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x, s.y, 2, 2);
        });

        // 2. Draw Particles
        this.particles.forEach(p => {
            if (performance.now() < p.startTime) return;
            if (!isFinite(p.x) || !isFinite(p.y)) return;

            // 2.1 Draw Tapered Energy Trail
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

                    // Inner bright core
                    ctx.beginPath();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 6 * ratio; // Thicker Core
                    ctx.globalAlpha = 0.5 * ratio;
                    ctx.moveTo(p.trail[j].x, p.trail[j].y);
                    ctx.lineTo(p.trail[j+1].x, p.trail[j+1].y);
                    ctx.stroke();
                }
            }

            // 2.2 Draw Aura Glow
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
            if (sprite && sprite.loaded) {
                ctx.drawImage(sprite.img, p.x - 16, p.y - 16, 32, 32);
            } else {
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.icon, p.x, p.y);
            }
            // Switch back to lighter for the next particle's trails/glow
            ctx.globalCompositeOperation = 'lighter';
        });
        
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }
}

export default ParticleOverlay;
