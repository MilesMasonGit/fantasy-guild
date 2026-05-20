// Fantasy Guild - Notification System
// Phase 10: Notification System

import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ItemRateTracker } from '../inventory/ItemRateTracker.js';

/**
 * NotificationSystem - Manages toast notifications
 * 
 * Features:
 * - Queue-based with auto-dismiss (configurable)
 * - Types: success, info, warning, error
 * - Max 5 visible toasts, older ones dismissed
 * - Message grouping for repeated notifications
 */

// Notification queue
const queue = [];
let notificationId = 0;

// Configuration
const config = {
    groupingWindow: 5000     // Group matching items within 5 seconds (to catch separate card loops)
};

// Type icons
const TYPE_ICONS = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
};

/**
 * Show a notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'info', 'warning', 'error', 'crisis'
 * @param {Object} options - Additional options
 * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {boolean} options.groupable - Can be grouped with same message
 * @param {string} options.aggregationKey - Unique key for additive aggregation
 * @param {number} options.amount - Initial amount (default 1)
 * @returns {number} Notification ID
 */
export function notify(message, type = 'info', options = {}) {
    const maxVisible = SettingsManager.get('notifications.maxVisible') ?? 10;

    const {
        category = 'system',
        groupable = true,
        aggregationKey = null,
        amount = 1,
        added = 0,
        removed = 0
    } = options;

    // Determine duration based on category + setting fallback
    let duration = options.duration;
    if (duration === undefined) {
        if (type === 'crisis') {
            duration = 0;
        } else {
            const categoryDuration = SettingsManager.get(`notifications.${category}Duration`);
            duration = categoryDuration ?? SettingsManager.get('notifications.defaultDuration') ?? 5000;
        }
    }

    // Check settings before adding to queue
    if (!SettingsManager.get('notifications.masterToggle')) {
        return null;
    }
    // Backward compatibility for old simple category toggles
    const categoryKey = category === 'hero' ? 'heroEvents' : (category === 'item' ? 'inventoryEvents' : category);
    if (categoryKey && SettingsManager.get(`notifications.${categoryKey}`) === false) {
        return null;
    }

    // Check for grouping with recent same message or aggregation key
    if (groupable) {
        const recent = findRecentSame(message, type, aggregationKey);
        if (recent) {
            recent.count += amount;
            recent.added = (recent.added || 0) + added;
            recent.removed = (recent.removed || 0) + removed;
            recent.createdAt = Date.now(); // Refresh timestamp for grouping window
            
            // Allow updating the message (e.g. for Level Up ranges)
            if (message && message !== recent.message) {
                recent.message = message;
            }

            // REFRESH Duration Timer
            if (recent.timeoutId) {
                clearTimeout(recent.timeoutId);
                recent.timeoutId = null;
            }
            if (recent.duration > 0) {
                recent.timeoutId = setTimeout(() => dismiss(recent.id), recent.duration);
            }

            EventBus.publish('notification_updated', { 
                id: recent.id, 
                count: recent.count,
                added: recent.added,
                removed: recent.removed,
                message: recent.message 
            });
            return recent.id;
        }
    }

    // Create new notification
    const id = ++notificationId;
    const notification = {
        id,
        message,
        type,
        count: amount,
        createdAt: Date.now(),
        duration,
        aggregationKey,
        timeoutId: null,
        category,
        isLoss: options.isLoss || false,
        added: added || (options.isLoss ? 0 : amount),
        removed: removed || (options.isLoss ? amount : 0),
        rate: options.rate || 0,
        itemId: options.itemId || null,
        meta: options.meta || {}
    };

    queue.push(notification);

    // Trim if over max (respect dynamic setting)
    while (queue.length > maxVisible) {
        const removed = queue.shift();
        if (removed.timeoutId) clearTimeout(removed.timeoutId);
        EventBus.publish('notification_dismissed', { id: removed.id });
    }

    EventBus.publish('notification_added', notification);

    // Auto-dismiss if duration is > 0
    if (duration > 0) {
        notification.timeoutId = setTimeout(() => dismiss(id), duration);
    }

    return id;
}

/**
 * Dismiss a notification by ID
 * @param {number} id 
 */
export function dismiss(id) {
    const index = queue.findIndex(n => n.id === id);
    if (index === -1) return;

    const notification = queue[index];
    if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
    }

    queue.splice(index, 1);
    EventBus.publish('notification_dismissed', { id });
}

/**
 * Dismiss all notifications
 */
export function dismissAll() {
    while (queue.length > 0) {
        const notification = queue.pop();
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }
        EventBus.publish('notification_dismissed', { id: notification.id });
    }
}

/**
 * Get current notification queue
 * @returns {Array}
 */
export function getQueue() {
    return [...queue];
}

/**
 * Find a recent notification with same message or aggregation key
 */
function findRecentSame(message, type, aggregationKey = null) {
    const now = Date.now();
    for (const n of queue) {
        // 1. If aggregationKey matches, that is the strongest match (ignore message and grouping window)
        // If it's in the queue, it's visible. If it's visible, we should aggregate into it.
        if (aggregationKey && n.aggregationKey === aggregationKey) {
            return n;
        }

        // 2. Otherwise fallback to message/type match (respect grouping window)
        if (!aggregationKey && 
            n.message === message &&
            n.type === type &&
            now - n.createdAt < config.groupingWindow) {
            return n;
        }
    }
    return null;
}

/**
 * Shorthand for success notification
 */
export function success(message, options) {
    return notify(message, 'success', options);
}

/**
 * Shorthand for info notification
 */
export function info(message, options) {
    return notify(message, 'info', options);
}

/**
 * Shorthand for warning notification
 */
export function warning(message, options) {
    return notify(message, 'warning', options);
}

/**
 * Shorthand for error notification
 */
export function error(message, options) {
    return notify(message, 'error', options);
}

/**
 * Shorthand for crisis (persistent) notification
 */
export function crisis(message, options) {
    return notify(message, 'crisis', { ...options, duration: 0 });
}

/**
 * Get icon for notification type
 * @param {string} type 
 * @returns {string}
 */
export function getIcon(type) {
    if (type === 'crisis') return '🚨';
    return TYPE_ICONS[type] || TYPE_ICONS.info;
}

// === Event Subscriptions for Auto-Notifications ===

EventBus.subscribe('hero_recruited', ({ name, className, traitName }) => {
    success(`${name} joined the guild!`, { category: 'hero' });
});

EventBus.subscribe('hero_leveled', ({ heroId, heroName, skillId, skillName, newLevel }) => {
    const key = `levelup_${heroId}_${skillId}`;
    const existing = queue.find(n => n.aggregationKey === key);
    
    // Determine the starting level for this aggregation cycle
    const startLevel = existing?.meta?.startLevel ?? (newLevel - 1);
    
    notify(`Level up! ${heroName} ${skillName} ${startLevel} > ${newLevel}`, 'info', { 
        category: 'hero',
        aggregationKey: key,
        meta: { startLevel }
    });
});

EventBus.subscribe('hero_retired', ({ name }) => {
    info(`${name} has retired from the guild.`, { category: 'hero' });
});

// --- Global Gameplay Integration (Phase 3) ---

/**
 * Dismiss by aggregation key
 */
export function dismissByAggregationKey(key) {
    const toDismiss = queue.filter(n => n.aggregationKey === key);
    for (const n of toDismiss) {
        dismiss(n.id);
    }
}

// 1. Loot Gain (Inventory Updates)
EventBus.subscribe('inventory_updated', (data) => {
    const item = getItem(data.itemId);
    const itemName = item ? item.name : data.itemId;

    // Gain/Loss Consolidation
    if (data.added > 0 || data.removed > 0) {
        if (data.added > 0) ItemRateTracker.recordGain(data.itemId, data.added);
        if (data.removed > 0) ItemRateTracker.recordLoss(data.itemId, data.removed);
        const currentRate = ItemRateTracker.getRate(data.itemId);

        info(itemName, {
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
        info(`${emoji} ${label}`, {
            category: 'item',
            aggregationKey: `currency_${data.type}`,
            amount: data.delta
        });
    }
});

// 3. Invasion Events (Crisis)
EventBus.subscribe('spawn_invasion', (data) => {
    const areaName = data.areaId.charAt(0).toUpperCase() + data.areaId.slice(1);
    crisis(`🚨 INVASION IN ${areaName.toUpperCase()}! 🚨`, {
        aggregationKey: 'invasion_alert'
    });
});

EventBus.subscribe('invasion_cleared', (data) => {
    success(`Invasion clear in ${data.areaId}!`);
    dismissByAggregationKey('invasion_alert');
});

// --- PERFORMANCE OPTIMIZED HEARTBEAT (10s) ---
// Only recalculates rates for items that are currently on screen.
setInterval(() => {
    if (queue.length === 0) return;

    for (const n of queue) {
        // Only target active item gain notifications
        if (n.category === 'item' && n.itemId) {
            const newRate = ItemRateTracker.getRate(n.itemId);
            
            // Only publish update if rate has shifted by > 1% to avoid minor jitter
            if (Math.abs(n.rate - newRate) > (Math.abs(n.rate) * 0.01) || (n.rate === 0 && newRate !== 0)) {
                n.rate = newRate;
                EventBus.publish('notification_updated', { 
                    id: n.id, 
                    rate: n.rate,
                    count: n.count // Ensure count is preserved in update payload
                });
            }
        }
    }
}, 10000);
