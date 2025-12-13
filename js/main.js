/**
 * Main application entry point
 * Orchestrates state, data loading, and event binding
 */

import * as calc from './core/calculator.js';
import * as optimizer from './core/optimizer.js';
import { ADDITIVE_CATEGORIES, ADDITIVE_WARNING_TYPES, CSS_CLASSES, DEFAULTS, ELEMENT_IDS, PROPERTY_KEYS, PROPERTY_RANGES, UI_MESSAGES, capitalize } from './lib/constants.js';
import * as validation from './lib/validation.js';
import { addAdditiveToRecipe, addExclusion, addFatToRecipe, clearRecipe, getYoloLockedFats, removeAdditiveFromRecipe, removeExclusion, removeFatFromRecipe, removeYoloFat, restoreState, saveState, setYoloRecipe, state, toggleWeightLock, togglePercentageLock, toggleYoloLock, updateAdditiveWeight, updateFatWeight } from './state/state.js';
import { attachRowEventHandlers, renderItemRow } from './ui/components/itemRow.js';
import { toast } from './ui/components/toast.js';
import { $, enableTabArrowNavigation } from './ui/helpers.js';
import * as ui from './ui/ui.js';

// ============================================
// Data Loading
// ============================================

async function loadData() {
    try {
        const [fatsResponse, glossaryResponse, fattyAcidsResponse, additivesResponse,
               fatsSchemaResponse, glossarySchemaResponse, fattyAcidsSchemaResponse, additivesSchemaResponse] = await Promise.all([
            fetch('./data/fats.json'),
            fetch('./data/glossary.json'),
            fetch('./data/fatty-acids.json'),
            fetch('./data/additives.json'),
            fetch('./data/schemas/fats.schema.json'),
            fetch('./data/schemas/glossary.schema.json'),
            fetch('./data/schemas/fatty-acids.schema.json'),
            fetch('./data/schemas/additives.schema.json')
        ]);

        state.fatsDatabase = await fatsResponse.json();
        state.glossaryData = await glossaryResponse.json();
        state.fattyAcidsData = await fattyAcidsResponse.json();
        state.additivesDatabase = await additivesResponse.json();

        const schemas = {
            fats: await fatsSchemaResponse.json(),
            glossary: await glossarySchemaResponse.json(),
            fattyAcids: await fattyAcidsSchemaResponse.json(),
            additives: await additivesSchemaResponse.json()
        };

        validation.initValidation(schemas);
        validation.validateAllStrict({
            fats: state.fatsDatabase,
            glossary: state.glossaryData,
            fattyAcids: state.fattyAcidsData,
            additives: state.additivesDatabase
        });
    } catch (error) {
        console.error('Error loading or validating data:', error);
        document.body.innerHTML = `
            <div style="color: #ff6b6b; padding: 40px; font-family: monospace; background: #1a1a2e;">
                <h1 style="color: #ff6b6b;">Data Loading Error</h1>
                <pre style="white-space: pre-wrap; margin-top: 20px;">${error.message}</pre>
            </div>
        `;
        throw error;
    }
}

// ============================================
// Calculations
// ============================================

function calculate() {
    const settings = ui.getSettings();
    const recipe = state.recipe;
    const fatsDatabase = state.fatsDatabase;
    const totalFats = recipe.reduce((sum, fat) => sum + fat.weight, 0);

    const lyeAmount = calc.calculateLye(recipe, fatsDatabase, settings.lyeType, settings.superfat);
    const waterAmount = calc.calculateWater(lyeAmount, settings.waterRatio);

    // Calculate additives total
    const additivesResult = calc.calculateAdditivesTotal(
        state.recipeAdditives,
        state.additivesDatabase,
        totalFats,
        settings.unit
    );
    const additivesTotal = additivesResult.totalWeight;

    const totalBatch = totalFats + lyeAmount + waterAmount + additivesTotal;

    // Volume includes additives
    const additiveVolume = calc.calculateAdditiveVolume(
        state.recipeAdditives,
        state.additivesDatabase,
        totalFats,
        settings.unit
    );
    const baseVolume = calc.calculateVolume(recipe, fatsDatabase, lyeAmount, waterAmount, settings.unit);
    const volume = {
        min: baseVolume.min + additiveVolume,
        max: baseVolume.max + additiveVolume
    };

    ui.updateResults({
        totalFats: totalFats,
        lyeAmount,
        waterAmount,
        totalBatch,
        lyeType: settings.lyeType
    });
    ui.updateVolume(volume, settings.unit === 'g' ? 'mL' : 'fl oz');
    ui.updateAdditivesTotal(additivesTotal, settings.unit);

    const fa = calc.calculateFattyAcids(recipe, fatsDatabase);
    const iodine = calc.calculateIodine(recipe, fatsDatabase);
    const ins = calc.calculateINS(recipe, fatsDatabase);
    const properties = calc.calculateProperties(fa);

    ui.updateFattyAcids(fa);

    const allProperties = { ...properties, iodine, ins };
    PROPERTY_KEYS.forEach(key => {
        const range = PROPERTY_RANGES[key];
        ui.updateProperty(capitalize(key), allProperties[key], range.min, range.max);
    });

    // Get base recipe notes and merge additive warnings
    const notes = calc.getRecipeNotes({ ...properties, iodine, ins }, fa, recipe);
    const additiveWarnings = renderAdditivesList();
    const allNotes = mergeAdditiveWarningsIntoNotes(notes, additiveWarnings);
    ui.updateRecipeNotes(allNotes, recipe.length);
    ui.updatePercentages(recipe, settings.unit);
}

function renderRecipeList() {
    const container = $(ELEMENT_IDS.recipeFats);
    const useFatsAction = $(ELEMENT_IDS.useFatsAction);
    const settings = ui.getSettings();

    const locks = {
        weightLocks: state.weightLocks,
        percentageLockIndex: state.percentageLockIndex
    };
    ui.renderRecipe(container, state.recipe, locks, settings.unit, state.fatsDatabase, {
        onWeightChange: handleWeightChange,
        onToggleWeightLock: handleToggleWeightLock,
        onTogglePercentageLock: handleTogglePercentageLock,
        onRemove: handleRemoveFat,
        onFatInfo: (fatId) => ui.showFatInfo(fatId, state.fatsDatabase, state.fattyAcidsData, (acidKey) => {
            ui.showFattyAcidInfo(acidKey, state.fattyAcidsData, state.recipe, state.fatsDatabase);
        })
    });

    // Show/hide "Use these fats" button based on recipe content
    if (useFatsAction) {
        if (state.recipe.length > 0) {
            useFatsAction.classList.remove(CSS_CLASSES.hidden);
        } else {
            useFatsAction.classList.add(CSS_CLASSES.hidden);
        }
    }
}

function renderAdditivesList() {
    const container = $(ELEMENT_IDS.recipeAdditives);
    if (!container) return [];

    const settings = ui.getSettings();
    const totalOilWeight = state.recipe.reduce((sum, fat) => sum + fat.weight, 0);

    return ui.renderAdditives(
        container,
        state.recipeAdditives,
        state.additivesDatabase,
        totalOilWeight,
        settings.unit,
        {
            onWeightChange: handleAdditiveWeightChange,
            onRemove: handleRemoveAdditive,
            onInfo: (additiveId) => ui.showAdditiveInfo(additiveId, state.additivesDatabase)
        }
    );
}

/**
 * Convert additive warnings to recipe note format
 * @param {Array} notes - Existing recipe notes
 * @param {Array} warnings - Additive warnings from renderAdditives
 * @returns {Array} Merged notes array
 */
function mergeAdditiveWarningsIntoNotes(notes, warnings) {
    if (!warnings || warnings.length === 0) return notes;

    const warningNotes = warnings.map(warning => {
        let noteType = 'info';
        let icon = '⚠️';

        if (warning.type === ADDITIVE_WARNING_TYPES.DANGER) {
            noteType = 'warning';
            icon = '🚫';
        } else if (warning.type === ADDITIVE_WARNING_TYPES.WARNING) {
            noteType = 'warning';
            icon = '⚠️';
        }

        return {
            type: noteType,
            icon,
            text: `${warning.additiveName}: ${warning.message}`
        };
    });

    return [...warningNotes, ...notes];
}

// ============================================
// Event Handlers
// ============================================

function handleAddFat() {
    const select = $(ELEMENT_IDS.fatSelect);
    const fatId = select.value;

    if (!fatId) return;
    if (!addFatToRecipe(fatId)) {
        toast.warning(UI_MESSAGES.FAT_ALREADY_EXISTS);
        return;
    }

    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();
}

function handleRemoveFat(index) {
    removeFatFromRecipe(index);
    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();
}

function handleWeightChange(index, weight) {
    const isPercentageLocked = state.percentageLockIndex === index;
    updateFatWeight(index, weight, isPercentageLocked);

    if (isPercentageLocked && state.recipe.length > 1) {
        const container = $(ELEMENT_IDS.recipeFats);
        state.recipe.forEach((fat, i) => {
            if (i !== index) {
                const input = container.querySelector(`input[data-index="${i}"]`);
                if (input) input.value = fat.weight;
            }
        });
    }

    calculate();
}

function handleToggleWeightLock(index) {
    toggleWeightLock(index);
    renderRecipeList();
}

function handleTogglePercentageLock(index) {
    togglePercentageLock(index);
    renderRecipeList();
}

function handleClearRecipe() {
    clearRecipe();
    renderRecipeList();
    calculate();
}

function handleUnitChange() {
    ui.updateUnits(ui.getSettings().unit);
    renderRecipeList();
}

function handleAddExclusion() {
    const select = $(ELEMENT_IDS.excludeFatSelect);
    if (select.value) {
        addExclusion(select.value);
        updateExclusionUI();
    }
}

function handleRemoveExclusion(fatId) {
    removeExclusion(fatId);
    updateExclusionUI();
}

function updateExclusionUI() {
    const excludeSelect = $(ELEMENT_IDS.excludeFatSelect);
    ui.populateExcludeFatSelect(excludeSelect, state.fatsDatabase, state.excludedFats);
    ui.renderExcludedFats(state.excludedFats, state.fatsDatabase, handleRemoveExclusion);
    excludeSelect.value = '';
}

// ============================================
// Additive Event Handlers
// ============================================

let currentAdditiveCategory = ADDITIVE_CATEGORIES.ESSENTIAL_OIL;

function handleAddAdditive() {
    const select = $(ELEMENT_IDS.additiveSelect);
    const additiveId = select.value;

    if (!additiveId) return;
    if (!addAdditiveToRecipe(additiveId)) {
        toast.warning(UI_MESSAGES.ADDITIVE_ALREADY_EXISTS);
        return;
    }

    updateAdditiveSelect();
    calculate();
    select.value = '';
}

function handleRemoveAdditive(index) {
    removeAdditiveFromRecipe(index);
    updateAdditiveSelect();
    calculate();
}

function handleAdditiveWeightChange(index, weight) {
    updateAdditiveWeight(index, weight);
    calculate();
}

function switchAdditiveCategory(category) {
    currentAdditiveCategory = category;
    updateTabStates('.additive-tab', 'category', category);
    updateAdditiveSelect();
}

function updateAdditiveSelect() {
    const select = $(ELEMENT_IDS.additiveSelect);
    if (!select) return;

    const existingIds = state.recipeAdditives.map(a => a.id);
    ui.populateAdditiveSelect(select, state.additivesDatabase, currentAdditiveCategory, existingIds);
}

// ============================================
// Dietary Filters
// ============================================

/**
 * Get the current dietary filter selections from the UI
 * @returns {Object} {animalBased, ethicalConcerns}
 */
function getDietaryFilters() {
    return {
        animalBased: $(ELEMENT_IDS.filterAnimalBased)?.checked || false,
        ethicalConcerns: $(ELEMENT_IDS.filterEthicalConcerns)?.checked || false
    };
}

/**
 * Create a filter function based on current dietary filter settings
 * @returns {Function|null} Filter function or null if no filters active
 */
function createDietaryFilterFn() {
    const filters = getDietaryFilters();
    if (!filters.animalBased && !filters.ethicalConcerns) {
        return null;
    }
    return (_id, data) => {
        const dietary = data.dietary || {};
        if (filters.animalBased && dietary.animalBased === true) return false;
        if (filters.ethicalConcerns && dietary.ethicalConcerns === true) return false;
        return true;
    };
}

/**
 * Repopulate fat select dropdown with current dietary filters applied
 */
function updateFatSelectWithFilters() {
    const filterFn = createDietaryFilterFn();
    const existingIds = state.recipe.map(f => f.id);
    ui.populateFatSelect($(ELEMENT_IDS.fatSelect), state.fatsDatabase, existingIds, filterFn);

    // Also update exclude fat select
    ui.populateExcludeFatSelect($(ELEMENT_IDS.excludeFatSelect), state.fatsDatabase, state.excludedFats);
}

/**
 * Get combined exclusions from manual exclusions and dietary filters
 * @returns {Array} Array of fat IDs to exclude
 */
function getCombinedExclusions() {
    const dietaryFilters = getDietaryFilters();
    const dietaryExclusions = optimizer.getDietaryExclusions(state.fatsDatabase, dietaryFilters);
    return [...state.excludedFats, ...dietaryExclusions];
}

// ============================================
// Profile Builder
// ============================================

function handleGenerateFromProfile() {
    const propertyTargets = ui.getPropertyTargets();

    const validationError = optimizer.validatePropertyTargets(propertyTargets);
    if (validationError) {
        toast.error(validationError);
        return;
    }

    const targetProfile = optimizer.propertiesToFattyAcidTargets(propertyTargets);

    if (Object.keys(targetProfile).length === 0) {
        toast.info(UI_MESSAGES.ENTER_PROPERTY_TARGET);
        return;
    }

    const excludedFats = getCombinedExclusions();
    const options = ui.getProfileBuilderOptions(excludedFats);
    const result = optimizer.findFatsForProfile(targetProfile, state.fatsDatabase, options);

    if (result.recipe.length === 0) {
        toast.warning(UI_MESSAGES.NO_FAT_COMBINATION);
        return;
    }

    ui.renderProfileResults(result, targetProfile, state.fatsDatabase, handleUseGeneratedRecipe, (fatId) => {
        ui.showFatInfo(fatId, state.fatsDatabase, state.fattyAcidsData, (acidKey) => {
            ui.showFattyAcidInfo(acidKey, state.fattyAcidsData, state.recipe, state.fatsDatabase);
        });
    });
}

function handleUseGeneratedRecipe(generatedRecipe) {
    state.recipe = generatedRecipe.map(fat => ({
        id: fat.id,
        weight: Math.round(DEFAULTS.BASE_RECIPE_WEIGHT * fat.percentage / 100)
    }));
    state.weightLocks = new Set();
    state.percentageLockIndex = null;

    switchBuildMode('fats');
    renderRecipeList();
    calculate();

    $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Tab/Mode Switching
// ============================================

function updateTabStates(tabSelector, dataAttr, activeValue) {
    document.querySelectorAll(tabSelector).forEach(tab => {
        const isActive = tab.dataset[dataAttr] === activeValue;
        tab.classList.toggle('active', isActive);
        // Update ARIA selected state for accessibility
        if (tab.hasAttribute('role') && tab.getAttribute('role') === 'tab') {
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    });
}

function switchBuildMode(mode) {
    updateTabStates('.build-mode-tab', 'mode', mode);

    // Show/hide mode panels
    $(ELEMENT_IDS.selectFatsMode).classList.toggle('hidden', mode !== 'fats');
    $(ELEMENT_IDS.specifyPropertiesMode).classList.toggle('hidden', mode !== 'properties');
    $(ELEMENT_IDS.yoloMode)?.classList.toggle('hidden', mode !== 'yolo');

    // Show/hide mode descriptions
    $('fatsDescription')?.classList.toggle('hidden', mode !== 'fats');
    $('propertiesDescription')?.classList.toggle('hidden', mode !== 'properties');
    $('yoloDescription')?.classList.toggle('hidden', mode !== 'yolo');

    // Show exclusions only in properties and yolo modes
    $(ELEMENT_IDS.excludeFatsSection)?.classList.toggle('hidden', mode === 'fats');

    ui.hideProfileResults();
}

// ============================================
// Setup Functions
// ============================================

function setupSettingsListeners() {
    $(ELEMENT_IDS.lyeType).addEventListener('change', calculate);
    $(ELEMENT_IDS.superfat).addEventListener('input', calculate);
    $(ELEMENT_IDS.waterRatio).addEventListener('input', calculate);
    $(ELEMENT_IDS.unit).addEventListener('change', handleUnitChange);

    // Dietary filter checkboxes - update fat select when toggled
    $(ELEMENT_IDS.filterAnimalBased)?.addEventListener('change', updateFatSelectWithFilters);
    $(ELEMENT_IDS.filterEthicalConcerns)?.addEventListener('change', updateFatSelectWithFilters);
}

function setupRecipeListeners() {
    $(ELEMENT_IDS.addFatBtn)?.addEventListener('click', handleAddFat);
    $(ELEMENT_IDS.clearRecipeBtn)?.addEventListener('click', handleClearRecipe);
    $(ELEMENT_IDS.useFatsBtn)?.addEventListener('click', handleUseFats);
}

/**
 * Handle "Use these fats" button in Select fats mode
 * Scrolls to the additives section for the next step
 */
function handleUseFats() {
    if (state.recipe.length === 0) {
        toast.info(UI_MESSAGES.ADD_OIL_FIRST);
        return;
    }
    // Scroll to additives section as the next logical step
    const additivesSection = $(ELEMENT_IDS.additivesSubcontainer);
    if (additivesSection) {
        additivesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setupPanelHandlers() {
    let lastFocusedElement = null;

    const closeAllPanels = () => {
        ui.closeAllInfoPanels();
        // Return focus to the element that opened the panel
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    };

    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', closeAllPanels);
    });
    $(ELEMENT_IDS.panelOverlay).addEventListener('click', closeAllPanels);

    // Close panels with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openPanel = document.querySelector('.info-panel.open');
            if (openPanel) {
                closeAllPanels();
            }
        }
    });

    const showGlossaryTerm = (term, triggerElement) => {
        if (triggerElement) lastFocusedElement = triggerElement;
        ui.showGlossaryInfo(term, state.glossaryData, state.recipe, state.fatsDatabase, showGlossaryTerm);
        // Move focus to the panel
        const panel = $('glossaryPanel');
        if (panel) {
            const closeBtn = panel.querySelector('.close-panel');
            if (closeBtn) closeBtn.focus();
        }
    };

    // Helper for keyboard activation (Enter/Space)
    const handleKeyboardActivation = (e, callback) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callback();
        }
    };

    document.querySelectorAll('.info-link').forEach(link => {
        const handler = () => showGlossaryTerm(link.dataset.term, link);
        link.addEventListener('click', handler);
        link.addEventListener('keydown', (e) => handleKeyboardActivation(e, handler));
    });

    document.querySelectorAll('.fa-link').forEach(link => {
        const handler = () => {
            lastFocusedElement = link;
            ui.showFattyAcidInfo(link.dataset.acid, state.fattyAcidsData, state.recipe, state.fatsDatabase);
            // Move focus to the panel
            const panel = $('fattyAcidPanel');
            if (panel) {
                const closeBtn = panel.querySelector('.close-panel');
                if (closeBtn) closeBtn.focus();
            }
        };
        link.addEventListener('click', handler);
        link.addEventListener('keydown', (e) => handleKeyboardActivation(e, handler));
    });
}

function setupBuildModeHandlers() {
    // Click handlers for build mode tabs
    document.querySelectorAll('.build-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchBuildMode(tab.dataset.mode));
    });

    // Arrow key navigation for build mode tabs (WCAG accessibility)
    const buildModeTablist = document.querySelector('.build-mode-tabs[role="tablist"]');
    if (buildModeTablist) {
        enableTabArrowNavigation(buildModeTablist, (tab) => {
            switchBuildMode(tab.dataset.mode);
        });
    }

    $(ELEMENT_IDS.generateRecipeBtn)?.addEventListener('click', handleGenerateFromProfile);
    $(ELEMENT_IDS.yoloBtn)?.addEventListener('click', handleYoloGenerate);
    $(ELEMENT_IDS.useYoloRecipeBtn)?.addEventListener('click', handleUseYoloRecipe);
}

function handleYoloGenerate() {
    const lockedFats = getYoloLockedFats();
    const excludedFats = getCombinedExclusions();

    const result = optimizer.generateRandomRecipe(state.fatsDatabase, {
        excludeFats: excludedFats,
        lockedFats,
        minFats: DEFAULTS.YOLO_MIN_FATS,
        maxFats: DEFAULTS.YOLO_MAX_FATS
    });

    if (!result) {
        toast.warning(UI_MESSAGES.YOLO_GENERATION_FAILED);
        return;
    }

    // Store in YOLO state - locked fats are at the start of the recipe array
    // Preserve lock on index 0 if there was a locked fat
    const newLockedIndex = lockedFats.length > 0 ? 0 : null;
    setYoloRecipe(result.recipe, newLockedIndex);

    // Render the YOLO recipe list
    renderYoloRecipe();
}

/**
 * Render the YOLO recipe fat list
 */
function renderYoloRecipe() {
    const container = $(ELEMENT_IDS.yoloRecipeFats);
    const useAction = $(ELEMENT_IDS.useYoloRecipeAction);
    if (!container) return;

    if (state.yoloRecipe.length === 0) {
        container.innerHTML = '';
        if (useAction) useAction.classList.add(CSS_CLASSES.hidden);
        return;
    }

    // Show the "Use This Recipe" action
    if (useAction) useAction.classList.remove(CSS_CLASSES.hidden);

    // Render rows using shared component
    container.innerHTML = state.yoloRecipe.map((item, index) => {
        const fat = state.fatsDatabase[item.id];
        return renderItemRow({
            id: item.id,
            name: fat?.name || item.id,
            percentage: item.percentage,
            isPercentageLocked: state.yoloLockedIndex === index
        }, index, {
            showWeightInput: false,
            showLockButton: true,
            showPercentage: true,
            itemType: 'fat'
        });
    }).join('');

    // Attach event handlers using shared utility
    attachRowEventHandlers(container, {
        onTogglePercentageLock: (index) => {
            toggleYoloLock(index);
            renderYoloRecipe();
        },
        onRemove: (index) => {
            removeYoloFat(index);
            renderYoloRecipe();
        },
        onInfo: (fatId) => {
            if (fatId && state.fatsDatabase[fatId]) {
                ui.showFatInfo(fatId, state.fatsDatabase, state.fattyAcidsData, (acidKey) => {
                    ui.showFattyAcidInfo(acidKey, state.fattyAcidsData, state.yoloRecipe, state.fatsDatabase);
                });
            }
        }
    }, 'fat');
}

/**
 * Handle "Use This Recipe" button click from YOLO mode
 */
function handleUseYoloRecipe() {
    if (state.yoloRecipe.length === 0) return;

    // Convert YOLO recipe (percentages) to main recipe (weights)
    state.recipe = state.yoloRecipe.map(fat => ({
        id: fat.id,
        weight: Math.round(DEFAULTS.BASE_RECIPE_WEIGHT * fat.percentage / 100)
    }));
    state.weightLocks = new Set();
    state.percentageLockIndex = null;

    switchBuildMode('fats');
    renderRecipeList();
    calculate();

    $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
}

function setupExclusionHandlers() {
    const excludeSelect = $(ELEMENT_IDS.excludeFatSelect);
    if (excludeSelect) {
        ui.populateExcludeFatSelect(excludeSelect, state.fatsDatabase, state.excludedFats);
        ui.renderExcludedFats(state.excludedFats, state.fatsDatabase, handleRemoveExclusion);
    }

    $(ELEMENT_IDS.addExclusionBtn)?.addEventListener('click', handleAddExclusion);
}

function setupAdditiveHandlers() {
    // Click handlers for additive tabs
    document.querySelectorAll('.additive-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAdditiveCategory(tab.dataset.category));
    });

    // Arrow key navigation for additive tabs (WCAG accessibility)
    const additiveTablist = document.querySelector('.additive-tabs[role="tablist"]');
    if (additiveTablist) {
        enableTabArrowNavigation(additiveTablist, (tab) => {
            switchAdditiveCategory(tab.dataset.category);
        });
    }

    // Add button
    $(ELEMENT_IDS.addAdditiveBtn)?.addEventListener('click', handleAddAdditive);

    // Initialize select with default category
    updateAdditiveSelect();
}

// ============================================
// Final Recipe Handlers
// ============================================

function handleCreateRecipe() {
    // Check if in YOLO mode with a recipe - auto-transfer to main recipe
    const activeTab = document.querySelector('.build-mode-tab.active');
    if (activeTab?.dataset.mode === 'yolo' && state.yoloRecipe.length > 0) {
        // Convert YOLO percentages to weights
        state.recipe = state.yoloRecipe.map(fat => ({
            id: fat.id,
            weight: Math.round(DEFAULTS.BASE_RECIPE_WEIGHT * fat.percentage / 100)
        }));
    }

    if (state.recipe.length === 0) {
        toast.info(UI_MESSAGES.ADD_OIL_FIRST);
        return;
    }

    const settings = ui.getSettings();
    const lyeAmount = calc.calculateLye(state.recipe, state.fatsDatabase, settings.lyeType, settings.superfat);
    const waterAmount = calc.calculateWater(lyeAmount, settings.waterRatio);

    const container = $(ELEMENT_IDS.finalRecipeContent);
    ui.renderFinalRecipe(container, {
        recipe: state.recipe,
        recipeAdditives: state.recipeAdditives,
        fatsDatabase: state.fatsDatabase,
        additivesDatabase: state.additivesDatabase,
        lyeAmount,
        waterAmount,
        lyeType: settings.lyeType,
        superfat: settings.superfat,
        waterRatio: settings.waterRatio,
        unit: settings.unit
    });

    ui.showFinalRecipe();
}

function setupFinalRecipeHandlers() {
    $(ELEMENT_IDS.createRecipeBtn)?.addEventListener('click', handleCreateRecipe);
}

// ============================================
// Initialization
// ============================================

async function init() {
    await loadData();

    // Restore saved state before rendering
    restoreState();

    updateFatSelectWithFilters();
    ui.initGlossaryTooltips(state.glossaryData);
    ui.populatePropertyRanges(PROPERTY_RANGES);

    setupSettingsListeners();
    setupRecipeListeners();
    setupPanelHandlers();
    setupBuildModeHandlers();
    setupExclusionHandlers();
    setupAdditiveHandlers();
    setupFinalRecipeHandlers();

    // Auto-save on state changes
    state.subscribeAll(saveState);

    renderRecipeList();
    calculate();
}

document.addEventListener('DOMContentLoaded', init);
