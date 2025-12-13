/**
 * Toast notification system
 * Replaces disruptive alert() calls with styled, accessible notifications
 */

const TOAST_DURATION = 4000; // Default duration in ms
const TOAST_CONTAINER_ID = 'toast-container';

/** @type {HTMLElement|null} */
let container = null;

/**
 * Toast types with corresponding styles
 */
export const TOAST_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * Initialize the toast container
 */
function ensureContainer() {
    if (container) return container;

    container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Toast type (info, success, warning, error)
 * @param {number} [duration=4000] - Duration in ms (0 for persistent)
 * @returns {HTMLElement} The toast element
 */
export function showToast(message, type = TOAST_TYPES.INFO, duration = TOAST_DURATION) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');

    // Icon based on type
    const icons = {
        [TOAST_TYPES.INFO]: 'ℹ️',
        [TOAST_TYPES.SUCCESS]: '✓',
        [TOAST_TYPES.WARNING]: '⚠️',
        [TOAST_TYPES.ERROR]: '✕'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Dismiss notification">×</button>
    `;

    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    // Auto-dismiss
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

/**
 * Remove a toast with animation
 * @param {HTMLElement} toast - Toast element to remove
 */
function removeToast(toast) {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');

    // Remove after animation
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 200);
}

/**
 * Convenience methods for common toast types
 */
export const toast = {
    info: (msg, duration) => showToast(msg, TOAST_TYPES.INFO, duration),
    success: (msg, duration) => showToast(msg, TOAST_TYPES.SUCCESS, duration),
    warning: (msg, duration) => showToast(msg, TOAST_TYPES.WARNING, duration),
    error: (msg, duration) => showToast(msg, TOAST_TYPES.ERROR, duration)
};
