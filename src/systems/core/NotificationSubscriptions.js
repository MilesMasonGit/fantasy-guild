import { EventBus } from './EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';
import { GameState } from '../../state/GameState.js';
import * as NotificationSystem from './NotificationSystem.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';

// Get access to the shared queue from NotificationSystem to aggregate and update rates
const queue = NotificationSystem.getQueue();

// === Event Subscriptions for Auto-Notifications ===

EventBus.subscribe('hero_recruited', ({ name, className, traitName }) => {
    NotificationSystem.success(`${name} joined the guild!`, { category: 'hero' });
});

EventBus.subscribe('hero_leveled', ({ heroId, heroName, skillId, skillName, newLevel }) => {
    const key = `levelup_${heroId}_${skillId}`;
    const currentQueue = NotificationSystem.getQueue();
    const existing = currentQueue.find(n => n.aggregationKey === key);
    
    // Determine the starting level for this aggregation cycle
    const startLevel = existing?.meta?.startLevel ?? (newLevel - 1);
    
    NotificationSystem.notify(`Level up! ${heroName} ${skillName} ${startLevel} > ${newLevel}`, 'info', { 
        category: 'hero',
        aggregationKey: key,
        meta: { startLevel }
    });
});

EventBus.subscribe('hero_retired', ({ name }) => {
    NotificationSystem.info(`${name} has retired from the guild.`, { category: 'hero' });
});

// 1. Loot Gain (Inventory Updates)
EventBus.subscribe('inventory_updated', (data) => {
    const item = getItem(data.itemId);
    const itemName = item ? item.name : data.itemId;

    // Gain/Loss Consolidation
    if (data.added > 0 || data.removed > 0) {
        if (data.added > 0) ItemRateTracker.recordGain(data.itemId, data.added);
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

// 2. Currency Changes (Gold, Influence)
EventBus.subscribe('currency_changed', (data) => {
    if (data.delta > 0) {
        const label = data.type === 'gold' ? 'Gold' : 'Influence';
        const emoji = data.type === 'gold' ? '💰' : '✨';
        NotificationSystem.info(`${emoji} ${label}`, {
            category: 'item',
            aggregationKey: `currency_${data.type}`,
            amount: data.delta
        });
    }
});

// 3. Invasion Events (Crisis)
// Invasion notifications are muted under the deck loop rework (Phase 1),
// along with the chaos/invasion systems that publish these events.
if (!USE_DECK_LOOP) {
EventBus.subscribe('spawn_invasion', (data) => {
    NotificationSystem.crisis(`Invasion in progress!\nDefeat the horde to remove debuffs!\n(x1.0 global task time)`, {
        aggregationKey: 'invasion_alert',
        meta: { areaId: data.areaId }
    });
});

EventBus.subscribe('invasion_threat_updated', (data) => {
    const threat = data.threat || 0;
    const threatLevel = Math.floor(threat / 20); // Levels 0 to 5
    const mult = (1.0 + (threatLevel * 0.2)).toFixed(1);
    const msg = `Invasion in progress!\nDefeat the horde to remove debuffs!\n(x${mult} global task time)`;

    const currentQueue = NotificationSystem.getQueue();
    const existing = currentQueue.find(n => n.aggregationKey === 'invasion_alert');
    if (existing) {
        existing.message = msg;
        EventBus.publish('notification_updated', {
            id: existing.id,
            message: msg
        });
    } else {
        NotificationSystem.crisis(msg, {
            aggregationKey: 'invasion_alert',
            meta: { areaId: data.areaId }
        });
    }
});

EventBus.subscribe('invasion_cleared', (data) => {
    NotificationSystem.success(`Invasion clear in ${data.areaId}!`);
    NotificationSystem.dismissByAggregationKey('invasion_alert');
});
}


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
                            EventBus.publish('notification_updated', { 
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
EventBus.subscribe('notification_added', () => checkHeartbeat());
EventBus.subscribe('notification_dismissed', () => checkHeartbeat());
