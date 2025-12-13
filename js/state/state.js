/**
 * Proxy-based reactive state management
 * Provides centralized state with automatic change notifications
 */

import { DEFAULTS } from '../lib/constants.js';

/**
 * Create a reactive state object that notifies subscribers on changes
 * @param {Object} initialState - Initial state values
 * @returns {Object} Reactive state proxy with subscribe/unsubscribe methods
 */
function createReactiveState(initialState) {
    const subscribers = new Map(); // key -> Set of callbacks
    const state = { ...initialState };

    /**
     * Subscribe to changes on a specific key
     * @param {string} key - State key to watch
     * @param {Function} callback - Called with (newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }
        subscribers.get(key).add(callback);

        // Return unsubscribe function
        return () => subscribers.get(key)?.delete(callback);
    }

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Called with (newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribeAll(callback) {
        return subscribe('*', callback);
    }

    /**
     * Notify subscribers of a change
     * @param {string} key - Changed key
     * @param {*} newValue - New value
     * @param {*} oldValue - Previous value
     */
    function notify(key, newValue, oldValue) {
        // Notify key-specific subscribers
        subscribers.get(key)?.forEach(cb => cb(newValue, oldValue, key));
        // Notify wildcard subscribers
        subscribers.get('*')?.forEach(cb => cb(newValue, oldValue, key));
    }

    // Create proxy for reactive access
    const proxy = new Proxy(state, {
        get(target, prop) {
            // Expose subscribe methods
            if (prop === 'subscribe') return subscribe;
            if (prop === 'subscribeAll') return subscribeAll;
            if (prop === '_state') return { ...target }; // Snapshot for debugging

            return target[prop];
        },

        set(target, prop, value) {
            const oldValue = target[prop];

            // Only notify if value actually changed
            // Use JSON comparison for arrays/objects
            const oldJson = JSON.stringify(oldValue);
            const newJson = JSON.stringify(value);

            if (oldJson !== newJson) {
                target[prop] = value;
                notify(prop, value, oldValue);
            }

            return true;
        }
    });

    return proxy;
}

// ============================================
// Application State
// ============================================

export const state = createReactiveState({
    // Recipe state
    recipe: [],              // Array of {id, weight}
    weightLocks: new Set(),  // Set of indices with locked weights
    percentageLockIndex: null, // Index of fat locked for percentage scaling
    recipeAdditives: [],     // Array of {id, weight}

    // YOLO mode state
    yoloRecipe: [],          // Array of {id, percentage}
    yoloLockedIndex: null,   // Index of locked fat in YOLO mode

    // Data (loaded from JSON)
    fatsDatabase: {},        // Fat data with SAP values, fatty acids
    glossaryData: {},        // Educational definitions
    fattyAcidsData: {},      // Fatty acid information
    additivesDatabase: {},   // Additive data (EOs, colourants, functional)

    // UI state
    excludedFats: []         // Fats excluded from profile builder
});

// ============================================
// Convenience Methods
// ============================================

/**
 * Add a fat to the recipe
 * @param {string} id - Fat id (kebab-case key)
 * @param {number} weight - Initial weight (default from DEFAULTS.FAT_WEIGHT)
 * @returns {boolean} True if added, false if already exists
 */
export function addFatToRecipe(id, weight = DEFAULTS.FAT_WEIGHT) {
    if (state.recipe.some(fat => fat.id === id)) {
        return false;
    }
    state.recipe = [...state.recipe, { id, weight }];
    return true;
}

/**
 * Remove a fat from the recipe by index
 * @param {number} index - Index to remove
 */
export function removeFatFromRecipe(index) {
    const newRecipe = [...state.recipe];
    newRecipe.splice(index, 1);
    state.recipe = newRecipe;

    // Adjust weight locks - rebuild set with adjusted indices
    const newWeightLocks = new Set();
    for (const lockedIndex of state.weightLocks) {
        if (lockedIndex < index) {
            newWeightLocks.add(lockedIndex);
        } else if (lockedIndex > index) {
            newWeightLocks.add(lockedIndex - 1);
        }
        // If lockedIndex === index, it's removed (not added to new set)
    }
    state.weightLocks = newWeightLocks;

    // Adjust percentage lock index if needed
    if (state.percentageLockIndex === index) {
        state.percentageLockIndex = null;
    } else if (state.percentageLockIndex !== null && index < state.percentageLockIndex) {
        state.percentageLockIndex = state.percentageLockIndex - 1;
    }
}

/**
 * Update a fat's weight in the recipe
 * @param {number} index - Fat index
 * @param {number} weight - New weight
 * @param {boolean} scaleOthers - If true and this fat has percentage locked, scale other fats
 */
export function updateFatWeight(index, weight, scaleOthers = false) {
    const newRecipe = [...state.recipe];
    const newWeight = parseFloat(weight) || 0;

    if (scaleOthers && state.percentageLockIndex === index && newRecipe.length > 1) {
        const oldWeight = newRecipe[index].weight;
        if (oldWeight > 0 && newWeight > 0) {
            const scaleFactor = newWeight / oldWeight;
            newRecipe.forEach((fat, i) => {
                if (i !== index) {
                    fat.weight = Math.round(fat.weight * scaleFactor * 10) / 10;
                }
            });
        }
    }

    newRecipe[index] = { ...newRecipe[index], weight: newWeight };
    state.recipe = newRecipe;
}

/**
 * Toggle weight lock on a fat (prevents editing weight)
 * @param {number} index - Fat index
 */
export function toggleWeightLock(index) {
    const newLocks = new Set(state.weightLocks);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.weightLocks = newLocks;
}

/**
 * Toggle percentage lock on a fat (for proportional scaling)
 * Only one fat can have percentage locked at a time
 * @param {number} index - Fat index
 */
export function togglePercentageLock(index) {
    state.percentageLockIndex = state.percentageLockIndex === index ? null : index;
}

/**
 * Clear the entire recipe
 */
export function clearRecipe() {
    state.recipe = [];
    state.weightLocks = new Set();
    state.percentageLockIndex = null;
}

/**
 * Add a fat to the exclusion list
 * @param {string} id - Fat id (kebab-case key)
 */
export function addExclusion(id) {
    if (!id || state.excludedFats.includes(id)) return;
    state.excludedFats = [...state.excludedFats, id];
}

/**
 * Remove a fat from the exclusion list
 * @param {string} id - Fat id (kebab-case key)
 */
export function removeExclusion(id) {
    state.excludedFats = state.excludedFats.filter(fat => fat !== id);
}

/**
 * Get total weight of all fats in recipe
 * @returns {number} Total weight
 */
export function getTotalWeight() {
    return state.recipe.reduce((sum, fat) => sum + fat.weight, 0);
}

// ============================================
// Additive Methods
// ============================================

/**
 * Add an additive to the recipe
 * @param {string} id - Additive id (kebab-case key)
 * @param {number} weight - Weight in current unit (default from DEFAULTS.ADDITIVE_WEIGHT)
 * @returns {boolean} True if added, false if already exists
 */
export function addAdditiveToRecipe(id, weight = DEFAULTS.ADDITIVE_WEIGHT) {
    if (state.recipeAdditives.some(a => a.id === id)) {
        return false;
    }
    state.recipeAdditives = [...state.recipeAdditives, { id, weight }];
    return true;
}

/**
 * Remove an additive from the recipe by index
 * @param {number} index - Index to remove
 */
export function removeAdditiveFromRecipe(index) {
    const newAdditives = [...state.recipeAdditives];
    newAdditives.splice(index, 1);
    state.recipeAdditives = newAdditives;
}

/**
 * Update an additive's weight in the recipe
 * @param {number} index - Additive index
 * @param {number} weight - New weight
 */
export function updateAdditiveWeight(index, weight) {
    const newAdditives = [...state.recipeAdditives];
    newAdditives[index] = { ...newAdditives[index], weight: parseFloat(weight) || 0 };
    state.recipeAdditives = newAdditives;
}

// ============================================
// YOLO Methods
// ============================================

/**
 * Set the YOLO recipe
 * @param {Array} recipe - Array of {id, percentage}
 * @param {number|null} preserveLockedIndex - Index of locked fat to preserve (null to reset)
 */
export function setYoloRecipe(recipe, preserveLockedIndex = null) {
    state.yoloRecipe = recipe;
    state.yoloLockedIndex = preserveLockedIndex;
}

/**
 * Toggle lock on a YOLO fat
 * @param {number} index - Fat index
 */
export function toggleYoloLock(index) {
    state.yoloLockedIndex = state.yoloLockedIndex === index ? null : index;
}

/**
 * Remove a fat from the YOLO recipe by index
 * @param {number} index - Index to remove
 */
export function removeYoloFat(index) {
    const newRecipe = [...state.yoloRecipe];
    newRecipe.splice(index, 1);
    state.yoloRecipe = newRecipe;

    // Adjust locked index if needed
    if (state.yoloLockedIndex === index) {
        state.yoloLockedIndex = null;
    } else if (state.yoloLockedIndex !== null && index < state.yoloLockedIndex) {
        state.yoloLockedIndex = state.yoloLockedIndex - 1;
    }
}

/**
 * Get locked fats from YOLO recipe
 * @returns {Array} Array of {id, percentage} for locked fats
 */
export function getYoloLockedFats() {
    if (state.yoloLockedIndex === null) return [];
    return [state.yoloRecipe[state.yoloLockedIndex]];
}

/**
 * Clear the YOLO recipe
 */
export function clearYoloRecipe() {
    state.yoloRecipe = [];
    state.yoloLockedIndex = null;
}

// ============================================
// Persistence
// ============================================

const STORAGE_KEY = 'soapCalculatorState';

/**
 * Save current recipe state to localStorage
 */
export function saveState() {
    try {
        const dataToSave = {
            recipe: state.recipe,
            weightLocks: Array.from(state.weightLocks),
            percentageLockIndex: state.percentageLockIndex,
            excludedFats: state.excludedFats,
            recipeAdditives: state.recipeAdditives
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (_e) {
        // localStorage not available or full
    }
}

/**
 * Restore recipe state from localStorage
 * @returns {boolean} True if state was restored
 */
export function restoreState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (Array.isArray(data.recipe)) {
                state.recipe = data.recipe;
            }
            if (Array.isArray(data.weightLocks)) {
                state.weightLocks = new Set(data.weightLocks);
            }
            if (data.percentageLockIndex !== undefined) {
                state.percentageLockIndex = data.percentageLockIndex;
            }
            if (Array.isArray(data.excludedFats)) {
                state.excludedFats = data.excludedFats;
            }
            if (Array.isArray(data.recipeAdditives)) {
                state.recipeAdditives = data.recipeAdditives;
            }
            return true;
        }
    } catch (_e) {
        // Invalid or unavailable localStorage
    }
    return false;
}
