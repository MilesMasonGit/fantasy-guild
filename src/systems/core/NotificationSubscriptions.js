import { EventBus } from './EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import * as NotificationSystem from './NotificationSystem.js';
import * as BoardState from '../board/BoardState.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { ENGINE_EVENTS } from './engineEvents.js';

// (CR-017) There is no module-level queue snapshot here: getQueue() returns a
// COPY, so a cached one goes stale immediately. Handlers below re-fetch.

// === Event Subscriptions for Auto-Notifications ===

EventBus.subscribe(ENGINE_EVENTS.HERO_RECRUITED, ({ name }) => {
    NotificationSystem.success(`${name} joined the guild!`, { category: 'hero' });
});

EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, heroName, skillId, skillName, newLevel, oldLevel, startLevel: pStartLevel }) => {
    const key = `levelup_${heroId}_${skillId}`;
    const currentQueue = NotificationSystem.getQueue();
    const existing = currentQueue.find(n => n.aggregationKey === key);
    
    // Determine the starting level for this aggregation cycle
    const startLevel = existing?.meta?.startLevel ?? pStartLevel ?? oldLevel ?? (newLevel - 1);
    
    NotificationSystem.notify(`Level up! ${heroName} ${skillName} ${startLevel} > ${newLevel}`, 'info', { 
        category: 'hero',
        aggregationKey: key,
        meta: { startLevel }
    });

    // Where the hero is drawn: the Token they work (by instance id) and the mat
    // point (slice 1.6b). A hero in the Dock has neither.
    const point = BoardState.displayPointOf(heroId);
    if (point) {
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            instanceId: BoardState.workTokenOf(heroId),
            x: point.x,
            y: point.y,
            heroId,
            skillId,
            severity: 'upgrade',
            type: 'hero_level_up',
            name: heroName,
            heroName,
            skillName,
            startLevel,
            newLevel,
            title: `${heroName} leveled up ${skillName} ${startLevel}>${newLevel}!`,
            message: `${heroName} leveled up ${skillName} ${startLevel}>${newLevel}!`
        });
    }
});

// 1. Loot Gain (Inventory Updates)
EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (data) => {
    const item = getItem(data.itemId);
    const itemName = item ? item.name : data.itemId;

    // Gain/Loss Consolidation
    if (data.added > 0 || data.removed > 0) {
        // Gains are tracked at production time (SpriteLayer.addSprite) to reflect true steady-state output.
        // Losses are tracked here when items are consumed from inventory.
        if (data.removed > 0) ItemRateTracker.recordLoss(data.itemId, data.removed);
        const currentRate = ItemRateTracker.getRate(data.itemId);

        NotificationSystem.info(itemName, {
            category: 'item',
            itemId: data.itemId,
            rate: currentRate,
            aggregationKey: `item_${data.itemId}`,
            added: data.added || 0,
            removed: data.removed || 0
        });
    }
});

// 2. Currency changes: gone with gold (Token Lifecycle 9.4, SP-65).

// --- PERFORMANCE OPTIMIZED HEARTBEAT (10s) ---
let heartbeatIntervalId = null;

export function checkHeartbeat() {
    const currentQueue = NotificationSystem.getQueue();
    const hasItemNotification = currentQueue.some(n => n.category === 'item' && n.itemId);
    
    if (hasItemNotification) {
        if (!heartbeatIntervalId) {
            heartbeatIntervalId = setInterval(() => {
                const innerQueue = NotificationSystem.getQueue();
                if (innerQueue.length === 0) {
                    checkHeartbeat();
                    return;
                }

                for (const n of innerQueue) {
                    if (n.category === 'item' && n.itemId) {
                        const newRate = ItemRateTracker.getRate(n.itemId);
                        if (Math.abs(n.rate - newRate) > (Math.abs(n.rate) * 0.01) || (n.rate === 0 && newRate !== 0)) {
                            n.rate = newRate;
                            EventBus.publish(ENGINE_EVENTS.NOTIFICATION_UPDATED, { 
                                id: n.id, 
                                rate: n.rate,
                                count: n.count
                            });
                        }
                    }
                }
            }, 10000);
        }
    } else {
        if (heartbeatIntervalId) {
            clearInterval(heartbeatIntervalId);
            heartbeatIntervalId = null;
        }
    }
}

// Decoupled triggers for heartbeat checks to prevent circular imports
EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_ADDED, () => checkHeartbeat());
EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_DISMISSED, () => checkHeartbeat());
