/**
 * Reusable item row component for fats and additives
 * Eliminates duplication between renderRecipe, renderYoloRecipe, and renderAdditives
 */

import { CSS_CLASSES, UI_ICONS } from '../../lib/constants.js';
import { delegate, onActivate } from '../helpers.js';

/**
 * @typedef {Object} RowConfig
 * @property {string} id - Item ID (fat-id or additive-id)
 * @property {string} name - Display name
 * @property {number} [weight] - Weight value (for input mode)
 * @property {number} [percentage] - Percentage value
 * @property {boolean} [isWeightLocked] - Whether weight is locked (prevents editing)
 * @property {boolean} [isPercentageLocked] - Whether percentage is locked (scales other fats)
 * @property {boolean} [hasWarning] - Whether to show warning icon
 * @property {string} [warningClass] - CSS class for warning styling
 */

/**
 * @typedef {Object} RowOptions
 * @property {boolean} [showWeightInput=true] - Show weight input field
 * @property {boolean} [showLockButton=true] - Show lock/unlock button
 * @property {boolean} [showPercentage=true] - Show percentage display
 * @property {string} [unit='g'] - Unit for weight input aria-label
 * @property {string} [itemType='fat'] - Type for data attributes ('fat' or 'additive')
 * @property {string} [gridTemplate] - Custom grid template columns
 */

/**
 * Render a single item row
 * @param {RowConfig} config - Row configuration
 * @param {number} index - Row index
 * @param {RowOptions} options - Rendering options
 * @returns {string} HTML string for the row
 */
export function renderItemRow(config, index, options = {}) {
    const {
        showWeightInput = true,
        showLockButton = true,
        showPercentage = true,
        unit = 'g',
        itemType = 'fat'
    } = options;

    const {
        id,
        name,
        weight = 0,
        percentage = 0,
        isWeightLocked = false,
        isPercentageLocked = false,
        hasWarning = false,
        warningClass = ''
    } = config;

    const rowLockedClass = isPercentageLocked ? CSS_CLASSES.locked : '';
    const warningIcon = hasWarning ? '<span class="item-warning-icon" title="See recipe notes">⚠️</span>' : '';
    const dataAttr = itemType === 'fat' ? 'data-fat' : 'data-additive';

    // Build row content based on options
    const nameCell = `
        <span class="${itemType}-name clickable" data-action="info" ${dataAttr}="${id}" role="button" tabindex="0">
            ${name}${warningIcon}
        </span>
    `;

    const weightLockedClass = isWeightLocked ? CSS_CLASSES.locked : '';
    const disabledAttr = isWeightLocked ? 'disabled' : '';
    const weightCell = showWeightInput
        ? `<div class="weight-cell">
               <input type="number" value="${weight}" min="0" step="1" data-action="weight" data-index="${index}" aria-label="${name} weight in ${unit}" ${disabledAttr}>
               <button class="lock-weight ${weightLockedClass}" data-action="lock-weight" data-index="${index}"
                   title="${isWeightLocked ? 'Unlock weight' : 'Lock weight'}"
                   aria-label="${isWeightLocked ? 'Unlock ' + name + ' weight' : 'Lock ' + name + ' weight'}"
                   aria-pressed="${isWeightLocked}">
                   ${isWeightLocked ? UI_ICONS.LOCK : UI_ICONS.UNLOCK}
               </button>
           </div>`
        : '';

    const percentageLockedClass = isPercentageLocked ? CSS_CLASSES.locked : '';
    const percentageCell = showPercentage
        ? `<div class="percentage-cell">
               <span class="${itemType}-percentage" aria-label="${name} percentage">${percentage}%</span>
               ${showLockButton ? `<button class="lock-percentage ${percentageLockedClass}" data-action="lock-percentage" data-index="${index}"
                   title="${isPercentageLocked ? 'Unlock percentage' : 'Lock percentage'}"
                   aria-label="${isPercentageLocked ? 'Unlock ' + name + ' percentage' : 'Lock ' + name + ' percentage'}"
                   aria-pressed="${isPercentageLocked}">
                   ${isPercentageLocked ? UI_ICONS.LOCK : UI_ICONS.UNLOCK}
               </button>` : ''}
           </div>`
        : '';

    const removeCell = `
        <button class="remove-${itemType}" data-action="remove" data-index="${index}" aria-label="Remove ${name}">
            ${UI_ICONS.REMOVE}
        </button>
    `;

    return `
        <div class="${itemType}-row ${rowLockedClass} ${warningClass}" data-index="${index}">
            ${nameCell}
            ${weightCell}
            ${percentageCell}
            ${removeCell}
        </div>
    `;
}

/**
 * Render a totals row
 * @param {string} label - Row label (e.g., "Total Fats")
 * @param {number} total - Total value
 * @param {string} unit - Unit string
 * @param {number} [emptyCells=2] - Number of empty cells to add
 * @param {string} [className=''] - Additional CSS class
 * @returns {string} HTML string for totals row
 */
export function renderTotalsRow(label, total, unit, emptyCells = 2, className = '') {
    const empty = '<span></span>'.repeat(emptyCells);
    return `
        <div class="totals-row ${className}">
            <span>${label}</span>
            <span>${total.toFixed(2)} ${unit}</span>
            <span>100%</span>
            ${empty}
        </div>
    `;
}

/**
 * Render an empty state message
 * @param {string} message - Primary message
 * @param {string} [subMessage] - Secondary message
 * @param {string} [className=''] - Additional CSS class
 * @returns {string} HTML string for empty state
 */
export function renderEmptyState(message, subMessage = '', className = '') {
    return `
        <div class="empty-state ${className}">
            <p>${message}</p>
            ${subMessage ? `<p>${subMessage}</p>` : ''}
        </div>
    `;
}

/**
 * Attach event handlers to a container with item rows
 * @param {HTMLElement} container - Container element
 * @param {Object} callbacks - Event callbacks
 * @param {Function} [callbacks.onWeightChange] - Weight input handler (index, value)
 * @param {Function} [callbacks.onToggleWeightLock] - Weight lock toggle handler (index)
 * @param {Function} [callbacks.onTogglePercentageLock] - Percentage lock toggle handler (index)
 * @param {Function} [callbacks.onRemove] - Remove handler (index)
 * @param {Function} [callbacks.onInfo] - Info click handler (id)
 * @param {string} [itemType='fat'] - Item type for selectors
 */
export function attachRowEventHandlers(container, callbacks, itemType = 'fat') {
    const dataAttr = itemType === 'fat' ? 'data-fat' : 'data-additive';
    const nameSelector = `.${itemType}-name[data-action="info"]`;

    if (callbacks.onWeightChange) {
        delegate(container, 'input[data-action="weight"]', 'input', (_e, el) => {
            callbacks.onWeightChange(parseInt(el.dataset.index, 10), el.value);
        });
    }

    if (callbacks.onToggleWeightLock) {
        delegate(container, 'button[data-action="lock-weight"]', 'click', (_e, el) => {
            callbacks.onToggleWeightLock(parseInt(el.dataset.index, 10));
        });
    }

    if (callbacks.onTogglePercentageLock) {
        delegate(container, 'button[data-action="lock-percentage"]', 'click', (_e, el) => {
            callbacks.onTogglePercentageLock(parseInt(el.dataset.index, 10));
        });
    }

    if (callbacks.onRemove) {
        delegate(container, 'button[data-action="remove"]', 'click', (_e, el) => {
            callbacks.onRemove(parseInt(el.dataset.index, 10));
        });
    }

    if (callbacks.onInfo) {
        delegate(container, nameSelector, 'click', (_e, el) => {
            const id = el.dataset[itemType] || el.dataset.fat || el.dataset.additive;
            callbacks.onInfo(id);
        });

        delegate(container, nameSelector, 'keydown', onActivate((e) => {
            const el = e.target.closest(nameSelector);
            if (el) {
                const id = el.dataset[itemType] || el.dataset.fat || el.dataset.additive;
                callbacks.onInfo(id);
            }
        }));
    }
}
