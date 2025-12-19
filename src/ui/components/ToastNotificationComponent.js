// Fantasy Guild - Toast Notification Component
// Phase 10: Notification System

import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { logger } from '../../utils/Logger.js';

/**
 * ToastNotificationComponent - Renders toast notifications
 * 
 * This component manages a toast container that displays
 * notifications from the NotificationSystem.
 * 
 * Design: Subscribes to events at module load time and always
 * queries the DOM for the container element to avoid timing issues.
 */

/**
 * Get or create the toast container
 * Always queries the DOM to ensure we get the current element
 */
function getOrCreateContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Handle new notification
 */
function handleNotificationAdded(notification) {
    const container = getOrCreateContainer();
    const toast = createToastElement(notification);
    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });
}

/**
 * Handle notification update (count increased)
 */
function handleNotificationUpdated({ id, count }) {
    const toast = document.querySelector(`[data-toast-id="${id}"]`);
    if (!toast) return;

    const countEl = toast.querySelector('.toast__count');
    if (countEl) {
        countEl.textContent = `×${count} `;
        countEl.classList.remove('toast__count--hidden');
    }

    // Flash animation
    toast.classList.add('toast--flash');
    setTimeout(() => toast.classList.remove('toast--flash'), 200);
}

/**
 * Handle notification dismissed
 */
function handleNotificationDismissed({ id }) {
    const toast = document.querySelector(`[data-toast-id="${id}"]`);
    if (!toast) return;

    // Trigger exit animation
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--exiting');

    // Remove after animation
    setTimeout(() => {
        toast.remove();
    }, 300);
}

/**
 * Create a toast DOM element
 */
function createToastElement(notification) {
    const { id, message, type, count } = notification;
    const icon = NotificationSystem.getIcon(type);

    const toast = document.createElement('div');
    toast.className = `toast toast--${type} `;
    toast.dataset.toastId = id;

    toast.innerHTML = `
        <span class="toast__icon">${icon}</span>
        <span class="toast__message">${message}</span>
        <span class="toast__count ${count <= 1 ? 'toast__count--hidden' : ''}">×${count}</span>
        <button class="toast__close" aria-label="Dismiss">×</button>
`;

    // Bind close button
    toast.querySelector('.toast__close').addEventListener('click', () => {
        NotificationSystem.dismiss(id);
    });

    return toast;
}

/**
 * Initialize the toast container (creates it if needed)
 * This is now optional - can be called to pre-create the container
 */
export function init() {
    getOrCreateContainer();
    logger.info('ToastNotificationComponent', 'Initialized');
}

/**
 * Render existing notifications (for late initialization)
 */
export function renderExisting() {
    const queue = NotificationSystem.getQueue();
    queue.forEach(notification => {
        handleNotificationAdded(notification);
    });
}

// === Subscribe to notification events at module load time ===
// This ensures we never miss events regardless of when init() is called
EventBus.subscribe('notification_added', handleNotificationAdded);
EventBus.subscribe('notification_updated', handleNotificationUpdated);
EventBus.subscribe('notification_dismissed', handleNotificationDismissed);
