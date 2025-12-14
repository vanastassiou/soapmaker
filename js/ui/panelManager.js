/**
 * Panel Manager - Unified panel handling with WCAG 2.2 focus management
 *
 * Features:
 * - Tracks focus before opening, restores on close
 * - Focus trap within open panel
 * - Escape key handling
 * - Inert attribute on background content
 */

import { $, setOpen } from './helpers.js';

// Track the element that had focus before panel opened
let previouslyFocusedElement = null;

// Track currently open panel
let currentPanel = null;

// Focusable element selector
const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement[]} Array of focusable elements
 */
function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null); // Visible elements only
}

/**
 * Set up focus trap for a panel
 * @param {HTMLElement} panel - Panel element
 */
function setupFocusTrap(panel) {
    panel.addEventListener('keydown', handleFocusTrap);
}

/**
 * Remove focus trap from a panel
 * @param {HTMLElement} panel - Panel element
 */
function removeFocusTrap(panel) {
    panel.removeEventListener('keydown', handleFocusTrap);
}

/**
 * Handle Tab key to trap focus within panel
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleFocusTrap(e) {
    if (e.key !== 'Tab') return;

    const panel = e.currentTarget;
    const focusable = getFocusableElements(panel);

    if (focusable.length === 0) return;

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
        }
    } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
        }
    }
}

/**
 * Handle Escape key to close panel
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape' && currentPanel) {
        closeCurrentPanel();
    }
}

/**
 * Open a panel with proper focus management
 * @param {string} panelId - Panel element ID
 * @param {string} overlayId - Overlay element ID
 * @param {Object} options - {focusSelector: selector for element to focus}
 */
export function openPanel(panelId, overlayId, options = {}) {
    const panel = $(panelId);
    const overlay = $(overlayId);

    if (!panel) return;

    // Store currently focused element
    previouslyFocusedElement = document.activeElement;

    // Close any existing panel first
    if (currentPanel && currentPanel !== panel) {
        closePanelInternal(currentPanel);
    }

    // Open panel and overlay
    setOpen(panelId, true);
    if (overlay) setOpen(overlayId, true);

    // Make main content inert
    const mainContent = document.querySelector('main, .container');
    if (mainContent) {
        mainContent.setAttribute('inert', '');
    }

    // Set up focus trap
    setupFocusTrap(panel);
    currentPanel = panel;

    // Add escape key handler
    document.addEventListener('keydown', handleEscapeKey);

    // Move focus to panel
    // Default: focus the panel title (first heading) or first focusable element
    requestAnimationFrame(() => {
        let focusTarget = null;

        if (options.focusSelector) {
            focusTarget = panel.querySelector(options.focusSelector);
        }

        if (!focusTarget) {
            // Try panel title first
            focusTarget = panel.querySelector('.panel-title, h3, h2');
        }

        if (focusTarget) {
            // Make title focusable temporarily if it isn't
            const needsTabindex = !focusTarget.hasAttribute('tabindex');
            if (needsTabindex) {
                focusTarget.setAttribute('tabindex', '-1');
            }
            focusTarget.focus();
        } else {
            // Fall back to first focusable element (usually close button)
            const focusable = getFocusableElements(panel);
            if (focusable.length > 0) {
                focusable[0].focus();
            }
        }
    });
}

/**
 * Close a panel without restoring focus (internal use)
 * @param {HTMLElement} panel - Panel element
 */
function closePanelInternal(panel) {
    if (!panel) return;

    removeFocusTrap(panel);
    panel.classList.remove('open');
}

/**
 * Close a panel with focus restoration
 * @param {string} panelId - Panel element ID
 * @param {string} overlayId - Overlay element ID
 */
export function closePanel(panelId, overlayId) {
    const panel = $(panelId);
    const overlay = $(overlayId);

    if (!panel) return;

    // Close panel and overlay
    setOpen(panelId, false);
    if (overlay) setOpen(overlayId, false);

    // Remove inert from main content
    const mainContent = document.querySelector('main, .container');
    if (mainContent) {
        mainContent.removeAttribute('inert');
    }

    // Remove focus trap and escape handler
    removeFocusTrap(panel);
    document.removeEventListener('keydown', handleEscapeKey);

    currentPanel = null;

    // Restore focus to previously focused element
    if (previouslyFocusedElement && document.body.contains(previouslyFocusedElement)) {
        previouslyFocusedElement.focus();
    }
    previouslyFocusedElement = null;
}

/**
 * Close the currently open panel
 */
export function closeCurrentPanel() {
    if (!currentPanel) return;

    const panelId = currentPanel.id;
    closePanel(panelId, 'panelOverlay');
}

/**
 * Check if any panel is currently open
 * @returns {boolean} True if a panel is open
 */
export function isPanelOpen() {
    return currentPanel !== null;
}

/**
 * Get the ID of the currently open panel
 * @returns {string|null} Panel ID or null
 */
export function getCurrentPanelId() {
    return currentPanel?.id || null;
}
