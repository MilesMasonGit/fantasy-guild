import React, { useEffect, useRef } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { InventoryGroupManager } from '../../../systems/economy/InventoryGroupManager.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';

/**
 * ParticleOverlay - A high-performance Canvas layer for UI-space effects.
 * Visualizes items flying between Cards and the Inventory HUD.
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
            system.spawnFlyingItems(data.cardId, 'inventory-hud-target', data.drops, 'gain');
        });

        const subConsumed = EventBus.subscribe('items_consumed', (data) => {
            if (disabledRef.current) return;
            if (!data.cardId || !data.items) return;
            system.spawnFlyingItems('inventory-hud-target', data.cardId, data.items, 'consume');
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            subLoot();
            subConsumed();
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
    spawnFlyingItems(fromSource, toTarget, items, mode) {
        if (!SettingsManager.get('ui.itemParticles')) return;

        // Spawn a particle for each item type
        items.forEach((item, index) => {
            const template = getItem(item.itemId || item.id);
            if (!template) return;

            // Resolve screen positions per item
            const fromRect = this._getRect(fromSource, template);
            const toRect = this._getRect(toTarget, template);

            if (!fromRect || !toRect) return;

            // Visibility Check
            if (mode === 'gain' && !this._isRectInViewport(fromRect)) return;
            if (mode === 'consume' && !this._isRectInViewport(toRect)) return;

            // Coordinate Calculation
            let startX, startY, endX, endY;

            if (fromSource === 'inventory-hud-target') {
                startX = fromRect.left + 24; 
                startY = fromRect.top + fromRect.height / 2;
            } else {
                startX = fromRect.left + fromRect.width / 2;
                startY = fromRect.top + fromRect.height / 2;
            }

            if (toTarget === 'inventory-hud-target') {
                endX = toRect.left + 24; 
                endY = toRect.top + toRect.height / 2;
            } else {
                endX = toRect.left + toRect.width / 2;
                endY = toRect.top + toRect.height / 2;
            }

            // Load sprite if not cached
            this._preloadSprite(template.id);

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

    _getRect(source, itemTemplate) {
        if (source === 'inventory-hud-target') {
            if (itemTemplate) {
                const itemEl = document.querySelector(`[data-item-id="${itemTemplate.id}"]`);
                if (itemEl) return itemEl.getBoundingClientRect();

                const groupId = InventoryGroupManager.getItemGroupId(itemTemplate.id, itemTemplate.type);
                if (groupId) {
                    const groupEl = document.querySelector(`[data-group-id="${groupId}"]`);
                    if (groupEl) return groupEl.getBoundingClientRect();
                }
            }
            return document.getElementById('inventory-hud-target')?.getBoundingClientRect();
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

    _preloadSprite(itemId) {
        if (this.spriteCache.has(itemId)) return;
        const img = new Image();
        img.src = resolveSpritePath(itemId, 'items');
        this.spriteCache.set(itemId, { img, loaded: false });
        img.onload = () => {
            const data = this.spriteCache.get(itemId);
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
                // Notify that the particle has landed for visual feedback (e.g., Vault flashes)
                EventBus.publish('particle_landed', {
                    itemId: p.itemId,
                    mode: p.mode
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
