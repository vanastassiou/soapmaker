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
            // Handle Sets specially since JSON.stringify(Set) returns "{}"
            let hasChanged;
            if (value instanceof Set && oldValue instanceof Set) {
                hasChanged = value.size !== oldValue.size ||
                    [...value].some(v => !oldValue.has(v));
            } else {
                const oldJson = JSON.stringify(oldValue);
                const newJson = JSON.stringify(value);
                hasChanged = oldJson !== newJson;
            }

            if (hasChanged) {
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
    percentageLocks: new Set(), // Set of indices with locked percentages
    recipeAdditives: [],     // Array of {id, weight}

    // YOLO mode state
    yoloRecipe: [],          // Array of {id, percentage}
    yoloLockedIndices: new Set(),  // Set of locked fat indices in YOLO mode

    // Properties mode state
    propertiesRecipe: [],    // Array of {id, percentage} from profile builder
    propertiesLockedIndices: new Set(),  // Set of locked fat indices in properties mode

    // Data (loaded from JSON)
    fatsDatabase: {},        // Fat data with SAP values, fatty acids
    glossaryData: {},        // Educational definitions
    fattyAcidsData: {},      // Fatty acid information
    additivesDatabase: {},   // Additive data (EOs, colourants, functional)

    // UI state
    excludedFats: [],        // Fats excluded from profile builder

    // Cupboard cleaner state
    cupboardFats: [],              // Array of {id, weight}
    cupboardFatLocks: new Set(),   // Indices of locked cupboard fats
    cupboardSuggestions: [],       // Array of {id, weight, percentage}
    cupboardLockedIndices: new Set(), // Indices of locked suggestions
    allowRatioMode: false          // If true, optimizer can suggest ratio changes
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

    // Adjust percentage locks - rebuild set with adjusted indices
    const newPercentageLocks = new Set();
    for (const lockedIndex of state.percentageLocks) {
        if (lockedIndex < index) {
            newPercentageLocks.add(lockedIndex);
        } else if (lockedIndex > index) {
            newPercentageLocks.add(lockedIndex - 1);
        }
        // If lockedIndex === index, it's removed (not added to new set)
    }
    state.percentageLocks = newPercentageLocks;
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

    if (scaleOthers && state.percentageLocks.has(index) && newRecipe.length > 1) {
        const oldWeight = newRecipe[index].weight;
        if (oldWeight > 0 && newWeight > 0) {
            const scaleFactor = newWeight / oldWeight;
            newRecipe.forEach((fat, i) => {
                if (i !== index && !state.percentageLocks.has(i)) {
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
 * Toggle percentage lock on a fat (keeps percentage constant when other fats change)
 * @param {number} index - Fat index
 */
export function togglePercentageLock(index) {
    const newLocks = new Set(state.percentageLocks);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.percentageLocks = newLocks;
}

/**
 * Clear the entire recipe
 */
export function clearRecipe() {
    state.recipe = [];
    state.weightLocks = new Set();
    state.percentageLocks = new Set();
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
 * @param {Set|null} preserveLockedIndices - Set of locked indices to preserve (null to reset)
 */
export function setYoloRecipe(recipe, preserveLockedIndices = null) {
    state.yoloRecipe = recipe;
    state.yoloLockedIndices = preserveLockedIndices || new Set();
}

/**
 * Toggle lock on a YOLO fat
 * @param {number} index - Fat index
 */
export function toggleYoloLock(index) {
    const newLocks = new Set(state.yoloLockedIndices);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.yoloLockedIndices = newLocks;
}

/**
 * Remove a fat from the YOLO recipe by index
 * @param {number} index - Index to remove
 */
export function removeYoloFat(index) {
    const newRecipe = [...state.yoloRecipe];
    newRecipe.splice(index, 1);
    state.yoloRecipe = newRecipe;

    // Adjust locked indices
    const newLocks = new Set();
    for (const lockedIndex of state.yoloLockedIndices) {
        if (lockedIndex < index) {
            newLocks.add(lockedIndex);
        } else if (lockedIndex > index) {
            newLocks.add(lockedIndex - 1);
        }
        // If lockedIndex === index, it's removed (not added to new set)
    }
    state.yoloLockedIndices = newLocks;
}

/**
 * Get locked fats from YOLO recipe
 * @returns {Array} Array of {id, percentage} for locked fats
 */
export function getYoloLockedFats() {
    return state.yoloRecipe.filter((_, i) => state.yoloLockedIndices.has(i));
}

/**
 * Clear the YOLO recipe
 */
export function clearYoloRecipe() {
    state.yoloRecipe = [];
    state.yoloLockedIndices = new Set();
}

// ============================================
// Properties Mode Methods
// ============================================

/**
 * Set properties recipe from profile builder
 * @param {Array} recipe - Array of {id, percentage}
 * @param {Set} preserveLockedIndices - Optional locked indices to preserve
 */
export function setPropertiesRecipe(recipe, preserveLockedIndices = null) {
    state.propertiesRecipe = recipe;
    state.propertiesLockedIndices = preserveLockedIndices || new Set();
}

/**
 * Toggle lock on a properties mode fat
 * @param {number} index - Fat index
 */
export function togglePropertiesLock(index) {
    const newLocks = new Set(state.propertiesLockedIndices);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.propertiesLockedIndices = newLocks;
}

/**
 * Get locked fats from properties recipe
 * @returns {Array} Array of {id, percentage} for locked fats
 */
export function getPropertiesLockedFats() {
    return [...state.propertiesLockedIndices]
        .filter(i => i < state.propertiesRecipe.length)
        .map(i => state.propertiesRecipe[i]);
}

/**
 * Clear properties recipe
 */
export function clearPropertiesRecipe() {
    state.propertiesRecipe = [];
    state.propertiesLockedIndices = new Set();
}

// ============================================
// Cupboard Cleaner Methods
// ============================================

/**
 * Add a fat to the cupboard
 * @param {string} id - Fat id (kebab-case key)
 * @param {number} weight - Weight in grams
 * @returns {boolean} True if added, false if already exists
 */
export function addCupboardFat(id, weight = DEFAULTS.FAT_WEIGHT) {
    if (state.cupboardFats.some(fat => fat.id === id)) {
        return false;
    }
    state.cupboardFats = [...state.cupboardFats, { id, weight }];
    return true;
}

/**
 * Remove a fat from the cupboard by index
 * @param {number} index - Index to remove
 */
export function removeCupboardFat(index) {
    const newFats = [...state.cupboardFats];
    newFats.splice(index, 1);
    state.cupboardFats = newFats;

    // Adjust locked indices
    const newLocks = new Set();
    for (const lockedIndex of state.cupboardFatLocks) {
        if (lockedIndex < index) {
            newLocks.add(lockedIndex);
        } else if (lockedIndex > index) {
            newLocks.add(lockedIndex - 1);
        }
    }
    state.cupboardFatLocks = newLocks;
}

/**
 * Update a cupboard fat's weight
 * @param {number} index - Fat index
 * @param {number} weight - New weight
 */
export function updateCupboardFatWeight(index, weight) {
    const newFats = [...state.cupboardFats];
    newFats[index] = { ...newFats[index], weight: parseFloat(weight) || 0 };
    state.cupboardFats = newFats;
}

/**
 * Clear all cupboard fats
 */
export function clearCupboardFats() {
    state.cupboardFats = [];
    state.cupboardFatLocks = new Set();
    state.cupboardSuggestions = [];
    state.cupboardLockedIndices = new Set();
}

/**
 * Toggle lock on a cupboard fat
 * @param {number} index - Fat index
 */
export function toggleCupboardFatLock(index) {
    const newLocks = new Set(state.cupboardFatLocks);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.cupboardFatLocks = newLocks;
}

/**
 * Set cupboard suggestions from optimizer
 * @param {Array} suggestions - Array of {id, weight, percentage}
 */
export function setCupboardSuggestions(suggestions) {
    state.cupboardSuggestions = suggestions;
    state.cupboardLockedIndices = new Set();
}

/**
 * Toggle lock on a cupboard suggestion
 * @param {number} index - Suggestion index
 */
export function toggleCupboardSuggestionLock(index) {
    const newLocks = new Set(state.cupboardLockedIndices);
    if (newLocks.has(index)) {
        newLocks.delete(index);
    } else {
        newLocks.add(index);
    }
    state.cupboardLockedIndices = newLocks;
}

/**
 * Remove a suggestion from the cupboard suggestions by index
 * @param {number} index - Index to remove
 */
export function removeCupboardSuggestion(index) {
    const newSuggestions = [...state.cupboardSuggestions];
    newSuggestions.splice(index, 1);
    state.cupboardSuggestions = newSuggestions;

    // Adjust locked indices
    const newLocks = new Set();
    for (const lockedIndex of state.cupboardLockedIndices) {
        if (lockedIndex < index) {
            newLocks.add(lockedIndex);
        } else if (lockedIndex > index) {
            newLocks.add(lockedIndex - 1);
        }
    }
    state.cupboardLockedIndices = newLocks;
}

/**
 * Get locked suggestions from cupboard
 * @returns {Array} Array of {id, weight, percentage} for locked suggestions
 */
export function getCupboardLockedSuggestions() {
    return state.cupboardSuggestions.filter((_, i) => state.cupboardLockedIndices.has(i));
}

/**
 * Update a cupboard suggestion's weight
 * @param {number} index - Suggestion index
 * @param {number} weight - New weight
 */
export function updateCupboardSuggestionWeight(index, weight) {
    const newSuggestions = [...state.cupboardSuggestions];
    const newWeight = parseFloat(weight) || 0;
    newSuggestions[index] = { ...newSuggestions[index], weight: newWeight };
    state.cupboardSuggestions = newSuggestions;
}

/**
 * Set whether ratio mode is allowed
 * @param {boolean} allow - Whether to allow ratio adjustments
 */
export function setAllowRatioMode(allow) {
    state.allowRatioMode = allow;
}

/**
 * Get the total weight of cupboard fats
 * @returns {number} Total weight
 */
export function getCupboardTotalWeight() {
    return state.cupboardFats.reduce((sum, fat) => sum + fat.weight, 0);
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
            percentageLocks: Array.from(state.percentageLocks),
            excludedFats: state.excludedFats,
            recipeAdditives: state.recipeAdditives,
            // Cupboard cleaner state
            cupboardFats: state.cupboardFats,
            cupboardFatLocks: Array.from(state.cupboardFatLocks),
            cupboardSuggestions: state.cupboardSuggestions,
            cupboardLockedIndices: Array.from(state.cupboardLockedIndices),
            allowRatioMode: state.allowRatioMode
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
            if (Array.isArray(data.percentageLocks)) {
                state.percentageLocks = new Set(data.percentageLocks);
            }
            if (Array.isArray(data.excludedFats)) {
                state.excludedFats = data.excludedFats;
            }
            if (Array.isArray(data.recipeAdditives)) {
                state.recipeAdditives = data.recipeAdditives;
            }
            // Cupboard cleaner state
            if (Array.isArray(data.cupboardFats)) {
                state.cupboardFats = data.cupboardFats;
            }
            if (Array.isArray(data.cupboardFatLocks)) {
                state.cupboardFatLocks = new Set(data.cupboardFatLocks);
            }
            if (Array.isArray(data.cupboardSuggestions)) {
                state.cupboardSuggestions = data.cupboardSuggestions;
            }
            if (Array.isArray(data.cupboardLockedIndices)) {
                state.cupboardLockedIndices = new Set(data.cupboardLockedIndices);
            }
            if (typeof data.allowRatioMode === 'boolean') {
                state.allowRatioMode = data.allowRatioMode;
            }
            return true;
        }
    } catch (_e) {
        // Invalid or unavailable localStorage
    }
    return false;
}
