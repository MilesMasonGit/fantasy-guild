// Fantasy Guild - Notification System
// Phase 10: Notification System

import { EventBus } from './EventBus.js';

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
    maxVisible: 5,
    defaultDuration: 3000,  // 3 seconds
    groupingWindow: 500     // Group same messages within 500ms
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
 * @param {string} type - 'success', 'info', 'warning', 'error'
 * @param {Object} options - Additional options
 * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {boolean} options.groupable - Can be grouped with same message
 * @returns {number} Notification ID
 */
export function notify(message, type = 'info', options = {}) {
    const {
        duration = config.defaultDuration,
        groupable = true
    } = options;

    // Check for grouping with recent same message
    if (groupable) {
        const recent = findRecentSame(message, type);
        if (recent) {
            recent.count++;
            EventBus.publish('notification_updated', { id: recent.id, count: recent.count });
            return recent.id;
        }
    }

    // Create new notification
    const id = ++notificationId;
    const notification = {
        id,
        message,
        type,
        count: 1,
        createdAt: Date.now(),
        duration
    };

    queue.push(notification);

    // Trim if over max
    while (queue.length > config.maxVisible) {
        const removed = queue.shift();
        EventBus.publish('notification_dismissed', { id: removed.id });
    }

    EventBus.publish('notification_added', notification);

    // Auto-dismiss
    if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
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

    queue.splice(index, 1);
    EventBus.publish('notification_dismissed', { id });
}

/**
 * Dismiss all notifications
 */
export function dismissAll() {
    while (queue.length > 0) {
        const notification = queue.pop();
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
 * Find a recent notification with same message (for grouping)
 */
function findRecentSame(message, type) {
    const now = Date.now();
    for (const n of queue) {
        if (n.message === message &&
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
 * Get icon for notification type
 * @param {string} type 
 * @returns {string}
 */
export function getIcon(type) {
    return TYPE_ICONS[type] || TYPE_ICONS.info;
}

// === Event Subscriptions for Auto-Notifications ===

EventBus.subscribe('hero_recruited', ({ name, className, traitName }) => {
    success(`${name} joined the guild!`);
});

EventBus.subscribe('hero_leveled', ({ skillName, newLevel }) => {
    info(`Level up! ${skillName} is now level ${newLevel}`);
});

EventBus.subscribe('hero_retired', ({ name }) => {
    info(`${name} has retired from the guild.`);
});
