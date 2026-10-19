import { EventBus } from './EventBus.js';
import { ENGINE_EVENTS } from './engineEvents.js';

/**
 * Plain messages: the slot screen's one line ("Slot 2 deleted", "This save is from a previous
 * version"). The slot screen shows the newest.
 *
 * ⚠️ Nothing in the running game draws these. Items gained and spent are item stubs, what must
 * not be missed is a banner (`systems/notifications/`), a refusal is a callout on the mat, and a
 * level-up stays on the hero. A message raised here while a game is being played is unseen.
 */

const queue = [];
let notificationId = 0;

/** While true (a catch-up), nothing is raised. */
let quiet = false;

export function setQuiet(on) {
    quiet = !!on;
}

/** How long a message stays, unless it says otherwise. */
const DEFAULT_DURATION_MS = 8000;

/** The most messages kept; the oldest go first. */
const MAX_KEPT = 10;

/**
 * Raise a message.
 * @param {string} message
 * @param {string} type 'success' | 'info' | 'warning' | 'error' | 'crisis'
 * @param {{duration?: number}} options `duration` 0 keeps it until dismissed
 * @returns {number|null} its id
 */
export function notify(message, type = 'info', options = {}) {
    if (quiet || !message) return null;
    const duration = options.duration ?? (type === 'crisis' ? 0 : DEFAULT_DURATION_MS);
    const id = ++notificationId;
    const notification = { id, message, type, createdAt: Date.now(), duration, timeoutId: null };
    queue.push(notification);

    while (queue.length > MAX_KEPT) {
        const trimmed = queue.shift();
        if (trimmed.timeoutId) clearTimeout(trimmed.timeoutId);
        EventBus.publish(ENGINE_EVENTS.NOTIFICATION_DISMISSED, { id: trimmed.id });
    }

    EventBus.publish(ENGINE_EVENTS.NOTIFICATION_ADDED, notification);
    if (duration > 0) notification.timeoutId = setTimeout(() => dismiss(id), duration);
    return id;
}

export function dismiss(id) {
    const index = queue.findIndex(n => n.id === id);
    if (index === -1) return;
    const [notification] = queue.splice(index, 1);
    if (notification.timeoutId) clearTimeout(notification.timeoutId);
    EventBus.publish(ENGINE_EVENTS.NOTIFICATION_DISMISSED, { id });
}

export function dismissAll() {
    while (queue.length > 0) {
        const notification = queue.pop();
        if (notification.timeoutId) clearTimeout(notification.timeoutId);
        EventBus.publish(ENGINE_EVENTS.NOTIFICATION_DISMISSED, { id: notification.id });
    }
}

/** A copy of the messages, oldest first. */
export function getQueue() {
    return [...queue];
}

export const success = (message, options) => notify(message, 'success', options);
export const info = (message, options) => notify(message, 'info', options);
export const warning = (message, options) => notify(message, 'warning', options);
export const error = (message, options) => notify(message, 'error', options);
export const crisis = (message, options) => notify(message, 'crisis', { ...options, duration: 0 });
