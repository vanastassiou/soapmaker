/**
 * UI rendering functions for the soap calculator
 * Handles all DOM manipulation and rendering
 */

import {
    ADDITIVE_WARNING_TYPES,
    capitalize,
    CSS_CLASSES,
    ELEMENT_IDS,
    FATTY_ACID_KEYS,
    FATTY_ACID_NAMES,
    MATCH_THRESHOLDS,
    PROPERTY_FATTY_ACIDS,
    PROPERTY_KEYS,
    UI_MESSAGES
} from '../lib/constants.js';

import { checkAdditiveWarnings, generateFatProperties } from '../core/calculator.js';

import {
    $,
    batchUpdateNumbers,
    closePanel,
    delegate,
    onActivate,
    openPanel,
    parseFloatOr,
    parseIntOr,
    populateSelect,
    positionNearAnchor
} from './helpers.js';

import {
    attachRowEventHandlers,
    attachRowEventHandlersWithSignal,
    renderEmptyState,
    renderItemRow,
    renderTotalsRow
} from './components/itemRow.js';

// Re-export final recipe functions from submodule
export { renderFinalRecipe, showFinalRecipe } from './finalRecipe.js';

// ============================================
// Fat Select Dropdown
// ============================================

/**
 * Populate fat select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} fatsDatabase - Fat database object
 * @param {Array} excludeIds - IDs to exclude from the list
 * @param {Function} filterFn - Optional filter function (id, data) => boolean
 */
export function populateFatSelect(selectElement, fatsDatabase, excludeIds = [], filterFn = null) {
    populateSelect(selectElement, fatsDatabase, excludeIds, filterFn);
}

// ============================================
// Recipe Rendering
// ============================================

/**
 * Render the recipe fats list
 * @param {HTMLElement} container - Container element
 * @param {Array} recipe - Recipe array of {id, weight}
 * @param {Object} locks - {weightLocks: Set, percentageLocks: Set}
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Object} callbacks - {onWeightChange, onToggleWeightLock, onTogglePercentageLock, onRemove, onFatInfo}
 */
export function renderRecipe(container, recipe, locks, unit, fatsDatabase, callbacks) {
    // Abort any previous event listeners on this container
    if (container._abortController) {
        container._abortController.abort();
    }
    container._abortController = new AbortController();
    const signal = container._abortController.signal;

    if (recipe.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_FATS_ADDED);
        return;
    }

    const totalWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    const { weightLocks = new Set(), percentageLocks = new Set() } = locks || {};

    const headerRow = `
        <div class="fat-row header-row">
            <span>Fat</span>
            <span>Weight</span>
            <span>%</span>
            <span></span>
        </div>
    `;

    const rows = recipe.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: fat.weight,
            percentage: totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0,
            isWeightLocked: weightLocks.has(i),
            isPercentageLocked: percentageLocks.has(i)
        }, i, {
            showWeightInput: true,
            showLockButton: true,
            showPercentage: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = headerRow + rows + renderTotalsRow('Total Fats', totalWeight, unit, 1);

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onWeightChange: callbacks.onWeightChange,
        onToggleWeightLock: callbacks.onToggleWeightLock,
        onTogglePercentageLock: callbacks.onTogglePercentageLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onFatInfo
    }, 'fat', signal);
}

// ============================================
// Results Display
// ============================================

/**
 * Update results display
 * @param {Object} results - {totalFats, lyeAmount, waterAmount, totalBatch, lyeType}
 */
export function updateResults(results) {
    batchUpdateNumbers([
        [ELEMENT_IDS.totalFats, results.totalFats],
        [ELEMENT_IDS.lyeAmount, results.lyeAmount],
        [ELEMENT_IDS.waterAmount, results.waterAmount],
        [ELEMENT_IDS.totalBatch, results.totalBatch]
    ]);
    const lyeLabel = $(ELEMENT_IDS.lyeTypeLabel);
    if (lyeLabel) lyeLabel.textContent = results.lyeType;
}

/**
 * Update volume estimate display
 * @param {{min: number, max: number}} volume - Volume range
 * @param {string} unit - Volume unit (mL or fl oz)
 */
export function updateVolume(volume, unit) {
    const el = $(ELEMENT_IDS.volumeRange);
    if (!el) return;

    el.textContent = volume.min === 0 ? '0' : `${volume.min.toFixed(0)}-${volume.max.toFixed(0)}`;
    const unitEl = $(ELEMENT_IDS.volumeUnit);
    if (unitEl) unitEl.textContent = unit;
}

/**
 * Update fatty acid display
 * @param {Object} fa - Fatty acid values
 */
export function updateFattyAcids(fa) {
    FATTY_ACID_KEYS.forEach(acid => {
        const el = $(`fa${capitalize(acid)}`);
        if (el) el.textContent = fa[acid].toFixed(0);
    });

    // Update sat:unsat ratio
    const saturated = fa.lauric + fa.myristic + fa.palmitic + fa.stearic;
    const unsaturated = fa.ricinoleic + fa.oleic + fa.linoleic + fa.linolenic;
    const ratioEl = $(ELEMENT_IDS.satUnsatRatio);
    if (ratioEl) ratioEl.textContent = `${saturated.toFixed(0)} : ${unsaturated.toFixed(0)}`;
}

/**
 * Explanations for out-of-range property values
 */
const RANGE_EXPLANATIONS = {
    hardness: {
        low: 'Soft bar: may need longer cure time or additives like sodium lactate',
        high: 'Very hard: may be brittle or waxy, cut soon after unmoulding'
    },
    cleansing: {
        low: 'Low cleansing: very gentle but may feel insufficient for some',
        high: 'High cleansing: good for utility soap, may dry skin with daily use'
    },
    conditioning: {
        low: 'Low conditioning: less moisturising, may feel drying',
        high: 'High conditioning: very moisturising but may reduce lather'
    },
    bubbly: {
        low: 'Low bubbly lather: soap will produce less fluffy foam',
        high: 'High bubbly lather: lots of foam but may feel less creamy'
    },
    creamy: {
        low: 'Low creamy lather: less stable, lotion-like foam',
        high: 'High creamy lather: dense foam but may reduce bubbles'
    },
    iodine: {
        low: 'Low iodine: very stable but may lack skin-conditioning oils',
        high: 'High iodine: prone to rancidity, add antioxidant and cure in cool dark place'
    },
    ins: {
        low: 'Low INS: bar may be soft or slow to trace',
        high: 'High INS: may trace quickly, work fast or use lower temperatures'
    }
};

/**
 * Update a property display with in/out of range styling
 * @param {string} name - Property name (e.g., 'Hardness')
 * @param {number} value - Property value
 * @param {number} min - Min range
 * @param {number} max - Max range
 */
export function updateProperty(name, value, min, max) {
    const elem = $('prop' + name.replace(' ', ''));
    if (!elem) return;

    const inRange = value >= min && value <= max;
    const key = name.toLowerCase().replace(' ', '');
    const explanations = RANGE_EXPLANATIONS[key];

    elem.classList.remove(CSS_CLASSES.inRange, CSS_CLASSES.outRange);
    elem.classList.add(inRange ? CSS_CLASSES.inRange : CSS_CLASSES.outRange);

    // Show value with help icon for out-of-range
    if (!inRange && explanations) {
        const explanation = value < min ? explanations.low : explanations.high;
        elem.innerHTML = `${value.toFixed(0)} <span class="help-tip range-tip" data-range-tip="${explanation}">ⓘ</span>`;
    } else {
        elem.textContent = value.toFixed(0);
    }
}

/**
 * Populate property range cells from PROPERTY_RANGES
 * @param {Object} ranges - PROPERTY_RANGES object
 */
export function populatePropertyRanges(ranges) {
    PROPERTY_KEYS.forEach(prop => {
        const elem = $('range' + capitalize(prop));
        if (elem && ranges[prop]) {
            elem.textContent = `${ranges[prop].min} - ${ranges[prop].max}`;
        }
    });

    // Also populate profile builder input placeholders
    const profileProperties = ['hardness', 'cleansing', 'conditioning', 'bubbly', 'creamy'];
    profileProperties.forEach(prop => {
        const input = $(`target${capitalize(prop)}`);
        if (input && ranges[prop]) {
            input.placeholder = `${ranges[prop].min}-${ranges[prop].max}`;
        }
    });
}

/**
 * Update unit labels throughout the UI
 * @param {string} unit - Unit string (g or oz)
 */
export function updateUnits(unit) {
    [ELEMENT_IDS.fatUnit, ELEMENT_IDS.lyeUnit, ELEMENT_IDS.waterUnit, ELEMENT_IDS.batchUnit]
        .forEach(id => {
            const el = $(id);
            if (el) el.textContent = unit;
        });
}

/**
 * Update percentages without re-rendering inputs
 * @param {Array} recipe - Recipe array
 * @param {string} unit - Unit string
 */
export function updatePercentages(recipe, unit) {
    const container = $(ELEMENT_IDS.recipeFats);
    if (!container) return;

    const totalWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);

    recipe.forEach((fat, i) => {
        const row = container.querySelector(`.fat-row[data-index="${i}"]`);
        if (row) {
            const percentage = totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0;
            const percentSpan = row.querySelector('.fat-percentage');
            if (percentSpan) percentSpan.textContent = `${percentage}%`;
        }
    });

    const totalsRow = container.querySelector('.totals-row');
    if (totalsRow) {
        const spans = totalsRow.querySelectorAll('span');
        if (spans[1]) spans[1].textContent = `${totalWeight.toFixed(2)} ${unit}`;
    }
}

// ============================================
// Recipe Notes
// ============================================

/**
 * Update recipe notes display
 * @param {Array} notes - Array of note objects {type, icon, text}
 * @param {number} recipeLength - Number of fats in recipe
 */
export function updateRecipeNotes(notes, recipeLength) {
    const container = $(ELEMENT_IDS.recipeNotes);
    if (!container) return;

    if (notes.length === 0) {
        const message = recipeLength === 0
            ? 'Add fats to see recipe analysis'
            : 'No specific notes for this recipe';
        container.innerHTML = `
            <div class="recipe-notes-title">Recipe Notes</div>
            <p class="no-notes">${message}</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="recipe-notes-title">Recipe Notes</div>
        ${notes.map(note => `
            <div class="recipe-note ${note.type}">
                <span class="recipe-note-icon">${note.icon}</span>
                <span class="recipe-note-text">${note.text}</span>
            </div>
        `).join('')}
    `;
}

// ============================================
// Info Panels
// ============================================

/**
 * Render references section into a panel
 * @param {HTMLElement} panel - The panel element to append references to
 * @param {Array} references - Array of {source, section, url}
 */
function renderReferences(panel, references) {
    // Remove existing references section if present
    const existing = panel.querySelector('.panel-references-section');
    if (existing) existing.remove();

    if (!references || references.length === 0) return;

    const section = document.createElement('div');
    section.className = 'panel-section panel-references-section';
    section.innerHTML = `
        <h4>References</h4>
        <div class="panel-references">
            ${references.map(ref => `
                <div class="reference-item">
                    <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.source}</a>
                    <span class="reference-section">${ref.section}</span>
                </div>
            `).join('')}
        </div>
    `;
    panel.appendChild(section);
}

/**
 * Show fat info panel
 * @param {string} fatId - Fat id (kebab-case key)
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @param {Function} onFattyAcidClick - Callback when fatty acid is clicked
 */
export function showFatInfo(fatId, fatsDatabase, fattyAcidsData, onFattyAcidClick) {
    if (!fatId || !fatsDatabase[fatId]) return;

    const fat = fatsDatabase[fatId];

    $('fatPanelName').textContent = fat.name;
    $('fatPanelSap').textContent = `NaOH SAP: ${fat.sap.naoh} | KOH SAP: ${fat.sap.koh}`;
    $('fatPanelUsage').textContent = `${fat.usage.min}% to ${fat.usage.max}% of recipe lipids`;
    $('fatPanelDescription').textContent = fat.description;
    $('fatPanelProperties').textContent = generateFatProperties(fat, fattyAcidsData);

    // Fatty acids
    const faContainer = $('fatPanelFattyAcids');
    faContainer.innerHTML = Object.entries(fat.fattyAcids)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => `
            <div class="fa-source-item">
                <span class="fa-source-name fa-link" data-acid="${name}" role="button" tabindex="0">${capitalize(name)}</span>
                <span class="fa-source-percent">${value}%</span>
            </div>
        `).join('');

    if (onFattyAcidClick) {
        delegate(faContainer, '.fa-link', 'click', (_e, el) => {
            onFattyAcidClick(el.dataset.acid);
        });
        delegate(faContainer, '.fa-link', 'keydown', onActivate((e) => {
            const el = e.target.closest('.fa-link');
            if (el) onFattyAcidClick(el.dataset.acid);
        }));
    }

    renderReferences($(ELEMENT_IDS.fatInfoPanel), fat.references);

    openPanel(ELEMENT_IDS.fatInfoPanel, ELEMENT_IDS.panelOverlay);
}

/**
 * Close all info panels - consolidated close function
 * Since only one panel can be open at a time, this closes whichever is open
 */
export function closeAllInfoPanels() {
    const panels = [
        ELEMENT_IDS.fatInfoPanel,
        'glossaryPanel',
        'fattyAcidPanel',
        ELEMENT_IDS.additiveInfoPanel
    ];
    panels.forEach(panelId => {
        const panel = $(panelId);
        if (panel?.classList.contains('open')) {
            closePanel(panelId, ELEMENT_IDS.panelOverlay);
        }
    });
}

/**
 * Calculate property contributors for glossary panel
 */
function calculatePropertyContributors(recipe, fatsDatabase, fattyAcids) {
    const totalWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    if (totalWeight === 0) return [];

    return recipe
        .map(item => {
            const fat = fatsDatabase[item.id];
            if (!fat) return null;
            const contribution = fattyAcids.reduce((sum, fa) => sum + (fat.fattyAcids[fa] || 0), 0);
            const weightedContribution = (contribution * item.weight / totalWeight);
            return { name: fat.name, value: weightedContribution };
        })
        .filter(c => c && c.value > 0)
        .sort((a, b) => b.value - a.value);
}

/**
 * Show glossary info panel
 * @param {string} term - Glossary term key
 * @param {Object} glossaryData - Glossary database
 * @param {Array} recipe - Current recipe array
 * @param {Object} fatsDatabase - Fat database
 * @param {Function} onTermClick - Callback when related term is clicked
 */
export function showGlossaryInfo(term, glossaryData, recipe, fatsDatabase, onTermClick) {
    if (!term || !glossaryData[term]) return;

    const data = glossaryData[term];

    $('glossaryPanelName').textContent = data.term;
    $('glossaryPanelCategory').textContent = data.category;
    $('glossaryPanelDesc').textContent = data.desc;

    // Details section
    const detailsSection = $('glossaryDetailsSection');
    const detailsEl = $('glossaryPanelDetails');
    if (data.details) {
        detailsEl.innerHTML = data.details.replace(/\n/g, '<br>');
        detailsSection.style.display = 'block';
    } else {
        detailsSection.style.display = 'none';
    }

    // Contributing fats (for properties)
    const contributorsSection = $('glossaryContributorsSection');
    const contributorsEl = $('glossaryPanelContributors');

    if (data.category === 'property' && PROPERTY_FATTY_ACIDS[term] && recipe.length > 0) {
        const contributors = calculatePropertyContributors(recipe, fatsDatabase, PROPERTY_FATTY_ACIDS[term]);

        if (contributors.length > 0) {
            contributorsEl.innerHTML = contributors
                .map(c => `
                    <div class="fa-source-item">
                        <span class="fa-source-name">${c.name}</span>
                        <span class="fa-source-percent">${c.value.toFixed(1)}</span>
                    </div>
                `).join('');
            contributorsSection.style.display = 'block';
        } else {
            contributorsSection.style.display = 'none';
        }
    } else {
        contributorsSection.style.display = 'none';
    }

    // Related terms
    const relatedSection = $('glossaryRelatedSection');
    const relatedEl = $('glossaryPanelRelated');
    if (data.related?.length > 0) {
        relatedEl.innerHTML = data.related
            .filter(r => glossaryData[r])
            .map(r => `<span class="panel-tag" data-term="${r}" role="button" tabindex="0">${glossaryData[r].term}</span>`)
            .join('');
        relatedSection.style.display = 'block';

        delegate(relatedEl, '.panel-tag', 'click', (_e, el) => {
            if (onTermClick) onTermClick(el.dataset.term);
        });
        delegate(relatedEl, '.panel-tag', 'keydown', onActivate((e) => {
            const el = e.target.closest('.panel-tag');
            if (onTermClick && el) onTermClick(el.dataset.term);
        }));
    } else {
        relatedSection.style.display = 'none';
    }

    renderReferences($('glossaryPanel'), data.references);

    openPanel('glossaryPanel', ELEMENT_IDS.panelOverlay);
}

/**
 * Find recipe sources for a fatty acid
 */
function findRecipeSourcesForAcid(recipe, fatsDatabase, acidKey) {
    return recipe
        .filter(item => {
            const fat = fatsDatabase[item.id];
            return fat?.fattyAcids?.[acidKey] > 0;
        })
        .map(item => {
            const fat = fatsDatabase[item.id];
            return {
                name: fat.name,
                percent: fat.fattyAcids[acidKey]
            };
        })
        .sort((a, b) => b.percent - a.percent);
}

/**
 * Show fatty acid info panel
 * @param {string} acidKey - Fatty acid key (e.g., 'lauric')
 * @param {Object} fattyAcidsData - Fatty acids database
 * @param {Array} recipe - Current recipe array
 * @param {Object} fatsDatabase - Fat database
 */
export function showFattyAcidInfo(acidKey, fattyAcidsData, recipe, fatsDatabase) {
    if (!acidKey || !fattyAcidsData[acidKey]) return;

    const acid = fattyAcidsData[acidKey];

    $('faName').textContent = acid.name;
    $('faFormula').textContent = `${acid.formula} · ${acid.saturation}`;

    $('faChemistry').innerHTML = `
        <div class="fa-chem-item">
            <div class="fa-chem-label">Carbon Chain</div>
            <div class="fa-chem-value">${acid.carbonChain} carbons</div>
        </div>
        <div class="fa-chem-item">
            <div class="fa-chem-label">Melting Point</div>
            <div class="fa-chem-value">${acid.meltingPoint}°C</div>
        </div>
    `;

    const props = acid.soapProperties;
    $('faContribution').innerHTML = `
        <div class="fa-props-grid">
            <div class="fa-prop-item"><span class="fa-prop-label">Hardness</span><span class="fa-prop-value">${props.hardness}</span></div>
            <div class="fa-prop-item"><span class="fa-prop-label">Cleansing</span><span class="fa-prop-value">${props.cleansing}</span></div>
            <div class="fa-prop-item"><span class="fa-prop-label">Lather</span><span class="fa-prop-value">${props.lather}</span></div>
            <div class="fa-prop-item"><span class="fa-prop-label">Conditioning</span><span class="fa-prop-value">${props.conditioning}</span></div>
        </div>
        ${acid.description ? `<p class="fa-description">${acid.description}</p>` : ''}
    `;

    // Recipe sources
    const recipeSources = findRecipeSourcesForAcid(recipe, fatsDatabase, acidKey);
    const recipeSourcesEl = $('faRecipeSources');

    recipeSourcesEl.innerHTML = recipeSources.length > 0
        ? recipeSources.map(s => `
            <div class="fa-source-item">
                <span class="fa-source-name">${s.name}</span>
                <span class="fa-source-percent">${s.percent}%</span>
            </div>
        `).join('')
        : '<p class="no-sources">No fats in your recipe contain this fatty acid</p>';

    // Common sources
    $('faCommonSources').innerHTML = acid.commonSources
        .map(id => {
            const fat = fatsDatabase[id];
            const name = fat ? fat.name : id;
            return `
                <div class="fa-source-item">
                    <span class="fa-source-name">${name}</span>
                </div>
            `;
        }).join('');

    renderReferences($('fattyAcidPanel'), acid.references);

    openPanel('fattyAcidPanel', ELEMENT_IDS.panelOverlay);
}

// ============================================
// Glossary Tooltips
// ============================================

/**
 * Populate tooltip content
 */
function populateTooltipContent(tooltip, data, glossaryData) {
    tooltip.querySelector('.tooltip-header').innerHTML =
        `${data.term} <span class="tooltip-category">${data.category}</span>`;
    tooltip.querySelector('.tooltip-body').textContent = data.desc;

    const detailsEl = tooltip.querySelector('.tooltip-details');
    if (data.details) {
        detailsEl.innerHTML = data.details.replace(/\n/g, '<br>');
        detailsEl.style.display = 'block';
    } else {
        detailsEl.style.display = 'none';
    }

    const relatedContainer = tooltip.querySelector('.tooltip-related-terms');
    const relatedSection = tooltip.querySelector('.tooltip-related');
    if (data.related?.length > 0) {
        relatedContainer.innerHTML = data.related
            .filter(r => glossaryData[r])
            .map(r => `<span class="related-term" data-term="${r}">${glossaryData[r].term.split(' (')[0]}</span>`)
            .join('');
        relatedSection.style.display = 'block';
    } else {
        relatedSection.style.display = 'none';
    }
}

/**
 * Initialize glossary tooltip system
 * @param {Object} glossaryData - Glossary data object
 */
export function initGlossaryTooltips(glossaryData) {
    const tooltip = document.createElement('div');
    tooltip.className = 'glossary-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header"></div>
        <div class="tooltip-body"></div>
        <div class="tooltip-details"></div>
        <div class="tooltip-related">
            <div class="tooltip-related-label">Related:</div>
            <div class="tooltip-related-terms"></div>
        </div>
    `;
    document.body.appendChild(tooltip);

    let activeTooltipTerm = null;

    function showTooltip(term, anchorEl) {
        const data = glossaryData[term];
        if (!data) return;

        activeTooltipTerm = term;
        populateTooltipContent(tooltip, data, glossaryData);
        tooltip.classList.add('visible');
        positionNearAnchor(tooltip, anchorEl);
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
        tooltip.style.display = '';
        activeTooltipTerm = null;
    }

    function showRangeTip(text, anchorEl) {
        activeTooltipTerm = '__range__';
        tooltip.querySelector('.tooltip-header').textContent = 'Out of range';
        tooltip.querySelector('.tooltip-body').textContent = text;
        tooltip.querySelector('.tooltip-details').style.display = 'none';
        tooltip.querySelector('.tooltip-related').style.display = 'none';
        tooltip.classList.add('visible');
        positionNearAnchor(tooltip, anchorEl);
    }

    let activeTipEl = null;

    document.addEventListener('click', (e) => {
        const tipEl = e.target.closest('.help-tip');
        const relatedEl = e.target.closest('.related-term');
        const inTooltip = e.target.closest('.glossary-tooltip');

        // Clicking related term in tooltip - navigate to that term
        if (relatedEl && inTooltip) {
            showTooltip(relatedEl.dataset.term, relatedEl);
            activeTipEl = relatedEl;
            return;
        }

        // Clicking a help tip icon - toggle if same, show if different
        if (tipEl) {
            // Prevent label from toggling checkbox when clicking help-tip inside it
            e.preventDefault();
            if (tipEl === activeTipEl) {
                hideTooltip();
                activeTipEl = null;
            } else {
                if (tipEl.dataset.rangeTip) {
                    showRangeTip(tipEl.dataset.rangeTip, tipEl);
                } else if (tipEl.dataset.term) {
                    showTooltip(tipEl.dataset.term, tipEl);
                }
                activeTipEl = tipEl;
            }
            return;
        }

        // Any other click dismisses tooltip
        hideTooltip();
        activeTipEl = null;
    });
}

// ============================================
// Profile Builder
// ============================================

/**
 * Render profile builder results
 * @param {Object} result - Result from findOilsForProfile
 * @param {Object} targetProfile - Original target profile
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Set} lockedIndices - Set of locked fat indices
 * @param {Object} callbacks - {onUseRecipe, onFatInfo, onToggleLock}
 */
export function renderProfileResults(result, targetProfile, fatsDatabase, lockedIndices, callbacks) {
    const resultsContainer = $(ELEMENT_IDS.profileResults);
    const suggestedRecipeDiv = $(ELEMENT_IDS.suggestedRecipe);
    const achievedComparisonDiv = $(ELEMENT_IDS.achievedComparison);
    const matchBarFill = $(ELEMENT_IDS.matchBarFill);
    const matchPercent = $(ELEMENT_IDS.matchPercent);
    const useRecipeBtn = $(ELEMENT_IDS.useRecipeBtn);

    // Abort any previous event listeners
    if (suggestedRecipeDiv._abortController) {
        suggestedRecipeDiv._abortController.abort();
    }
    suggestedRecipeDiv._abortController = new AbortController();
    const signal = suggestedRecipeDiv._abortController.signal;

    resultsContainer.classList.remove(CSS_CLASSES.hidden);

    matchBarFill.style.width = `${result.matchQuality}%`;
    matchPercent.textContent = `${result.matchQuality}%`;

    // Use consistent itemRow component for fat list
    const rows = result.recipe.map((fat, index) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            percentage: fat.percentage,
            isPercentageLocked: lockedIndices.has(index)
        }, index, {
            showWeightInput: false,
            showWeightLock: false,
            showLockButton: true,
            showPercentage: true,
            showRemoveButton: false,
            itemType: 'fat',
            className: 'lockable-only'
        });
    }).join('');

    suggestedRecipeDiv.innerHTML = rows;

    // Attach event handlers for fat info and lock toggle
    attachRowEventHandlersWithSignal(suggestedRecipeDiv, {
        onInfo: callbacks.onFatInfo,
        onTogglePercentageLock: callbacks.onToggleLock
    }, 'fat', signal);

    // Render achieved vs target comparison
    const comparisonItems = [];

    for (const [acid, name] of Object.entries(FATTY_ACID_NAMES)) {
        const targetVal = targetProfile[acid];
        if (targetVal === undefined || targetVal === null || targetVal === '') continue;

        const target = parseFloat(targetVal);
        const achieved = result.achieved[acid] || 0;
        const diff = achieved - target;
        const absDiff = Math.abs(diff);

        let statusClass = CSS_CLASSES.good;
        if (absDiff > MATCH_THRESHOLDS.OFF) statusClass = CSS_CLASSES.off;
        else if (absDiff > MATCH_THRESHOLDS.CLOSE) statusClass = CSS_CLASSES.close;

        const diffSign = diff > 0 ? '+' : '';
        const diffClass = diff > 0 ? 'positive' : 'negative';

        comparisonItems.push(`
            <div class="achieved-item ${statusClass}">
                <span class="achieved-acid">${name}</span>
                <span class="achieved-values">
                    <span class="target">${target.toFixed(0)}%</span>
                    <span class="arrow">&rarr;</span>
                    <span class="achieved">${achieved.toFixed(0)}%</span>
                    <span class="diff ${diffClass}">(${diffSign}${diff.toFixed(0)})</span>
                </span>
            </div>
        `);
    }

    achievedComparisonDiv.innerHTML = comparisonItems.join('');
    useRecipeBtn.onclick = () => callbacks.onUseRecipe(result.recipe);
}

/**
 * Hide profile results section
 */
export function hideProfileResults() {
    const resultsContainer = $(ELEMENT_IDS.profileResults);
    if (resultsContainer) resultsContainer.classList.add(CSS_CLASSES.hidden);
}

/**
 * Get property targets from the profile builder inputs
 * @returns {Object} Target property values
 */
export function getPropertyTargets() {
    const targets = {};
    const properties = ['hardness', 'cleansing', 'conditioning', 'bubbly', 'creamy'];

    properties.forEach(prop => {
        const input = $(`target${capitalize(prop)}`);
        if (input && input.value !== '') {
            targets[prop] = parseFloatOr(input.value);
        }
    });

    return targets;
}

/**
 * Get profile builder options
 * @param {Array} excludedFats - Array of fat ids to exclude
 * @returns {Object} Options for findFatsForProfile
 */
export function getProfileBuilderOptions(excludedFats = []) {
    const maxFats = parseIntOr($(ELEMENT_IDS.maxFats)?.value, 5);
    const includeCastor = $(ELEMENT_IDS.includeCastor)?.checked || false;

    return {
        maxFats,
        excludeFats: [...excludedFats],
        requireFats: includeCastor ? ['castor-oil'] : []
    };
}

// ============================================
// Fat Exclusions
// ============================================

/**
 * Render the excluded fats list as removable tags
 * @param {Array} excludedFats - Array of fat ids
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Function} onRemove - Callback when a fat is removed
 */
export function renderExcludedFats(excludedFats, fatsDatabase, onRemove) {
    const container = $(ELEMENT_IDS.excludedFatsList);
    if (!container) return;

    if (excludedFats.length === 0) {
        container.innerHTML = '<span class="no-exclusions">No fats currently selected for exclusion</span>';
        return;
    }

    container.innerHTML = excludedFats.map(id => {
        const fatData = fatsDatabase[id];
        const fatName = fatData ? fatData.name : id;
        return `
            <span class="excluded-fat-tag" data-fat="${id}">
                ${fatName}
                <button class="remove-exclusion" title="Remove">&times;</button>
            </span>
        `;
    }).join('');

    delegate(container, '.remove-exclusion', 'click', (_e, el) => {
        const tag = el.closest('.excluded-fat-tag');
        onRemove(tag.dataset.fat);
    });
}

/**
 * Populate the exclude fat select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} fatsDatabase - Fat database object
 * @param {Array} excludedFats - Already excluded fat ids to filter out
 */
export function populateExcludeFatSelect(selectElement, fatsDatabase, excludedFats = []) {
    populateSelect(selectElement, fatsDatabase, excludedFats);
}

/**
 * Clear profile builder inputs
 */
export function clearProfileInputs() {
    const properties = ['hardness', 'cleansing', 'conditioning', 'bubbly', 'creamy'];

    properties.forEach(prop => {
        const input = $(`target${capitalize(prop)}`);
        if (input) input.value = '';
    });

    hideProfileResults();
}

// ============================================
// Cupboard Cleaner
// ============================================

/**
 * Render cupboard fats (user's fixed fats with weight inputs)
 * @param {HTMLElement} container - Container element
 * @param {Array} cupboardFats - Array of {id, weight}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Set} lockedIndices - Set of locked fat indices
 * @param {Object} callbacks - {onWeightChange, onToggleLock, onRemove, onInfo}
 */
export function renderCupboardFats(container, cupboardFats, fatsDatabase, unit, lockedIndices, callbacks) {
    // Abort any previous event listeners on this container
    if (container._abortController) {
        container._abortController.abort();
    }
    container._abortController = new AbortController();
    const signal = container._abortController.signal;

    if (cupboardFats.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_CUPBOARD_FATS);
        return;
    }

    const totalWeight = cupboardFats.reduce((sum, fat) => sum + fat.weight, 0);

    const headerRow = `
        <div class="fat-row header-row">
            <span>Fat</span>
            <span>Weight</span>
            <span>%</span>
            <span></span>
        </div>
    `;

    const rows = cupboardFats.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: fat.weight,
            percentage: totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0,
            isWeightLocked: false,
            isPercentageLocked: lockedIndices.has(i)
        }, i, {
            showWeightInput: true,
            showWeightLock: false,
            showLockButton: true,
            showPercentage: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = headerRow + rows + renderTotalsRow('Total', totalWeight, unit, 1);

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onWeightChange: callbacks.onWeightChange,
        onTogglePercentageLock: callbacks.onToggleLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    }, 'fat', signal);
}

/**
 * Render cupboard suggestions with lock buttons
 * @param {HTMLElement} container - Container element
 * @param {Array} suggestions - Array of {id, weight, percentage}
 * @param {Set} lockedIndices - Set of locked suggestion indices
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onToggleLock, onRemove, onInfo}
 */
export function renderCupboardSuggestions(container, suggestions, lockedIndices, fatsDatabase, unit, callbacks) {
    // Abort any previous event listeners on this container
    if (container._abortController) {
        container._abortController.abort();
    }
    container._abortController = new AbortController();
    const signal = container._abortController.signal;

    if (suggestions.length === 0) {
        container.innerHTML = '';
        return;
    }

    const totalWeight = suggestions.reduce((sum, s) => sum + s.weight, 0);

    const headerRow = `
        <div class="fat-row header-row">
            <span>Suggested Fat</span>
            <span>Weight</span>
            <span>%</span>
            <span></span>
        </div>
    `;

    const rows = suggestions.map((sugg, i) => {
        const fatData = fatsDatabase[sugg.id];
        return renderItemRow({
            id: sugg.id,
            name: fatData?.name || sugg.id,
            weight: sugg.weight,
            percentage: sugg.percentage,
            isWeightLocked: false,
            isPercentageLocked: lockedIndices.has(i)
        }, i, {
            showWeightInput: true,
            showWeightLock: false,
            showLockButton: true,
            showPercentage: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = headerRow + rows + renderTotalsRow('Total Suggested', totalWeight, unit, 1);

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onWeightChange: callbacks.onWeightChange,
        onTogglePercentageLock: callbacks.onToggleLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    }, 'fat', signal);
}

/**
 * Populate cupboard fat select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} fatsDatabase - Fat database object
 * @param {Array} existingIds - IDs already in cupboard to exclude
 */
export function populateCupboardFatSelect(selectElement, fatsDatabase, existingIds = []) {
    populateSelect(selectElement, fatsDatabase, existingIds);
}

// ============================================
// Settings Helpers
// ============================================

/**
 * Get current settings from form
 * @returns {Object} Settings object
 */
export function getSettings() {
    return {
        lyeType: $(ELEMENT_IDS.lyeType)?.value || 'NaOH',
        superfat: parseFloatOr($(ELEMENT_IDS.superfat)?.value, 0),
        waterRatio: parseFloatOr($(ELEMENT_IDS.waterRatio)?.value, 2),
        unit: $(ELEMENT_IDS.unit)?.value || 'g'
    };
}

// ============================================
// Additives
// ============================================

/**
 * Populate additive select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} additivesDatabase - Additives database object
 * @param {string} category - Category to filter by (essential-oil, colourant, functional)
 * @param {Array} existingIds - IDs already in recipe to exclude
 */
export function populateAdditiveSelect(selectElement, additivesDatabase, category, existingIds = []) {
    populateSelect(selectElement, additivesDatabase, existingIds, (_id, data) => data.category === category);
}

/**
 * Render the recipe additives list
 * @param {HTMLElement} container - Container element
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives database
 * @param {number} totalOilWeight - Total oil weight for percentage calculations
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 * @returns {Array} Array of warning objects from all additives
 */
export function renderAdditives(container, recipeAdditives, additivesDatabase, totalOilWeight, unit, callbacks) {
    const allWarnings = [];

    if (recipeAdditives.length === 0) {
        container.innerHTML = renderEmptyState(
            UI_MESSAGES.NO_ADDITIVES_ADDED,
            '',
            'additive-empty'
        );
        return allWarnings;
    }

    const totalAdditiveWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);

    const rows = recipeAdditives.map((item, i) => {
        const additive = additivesDatabase[item.id];
        if (!additive) return '';

        const percentage = totalOilWeight > 0 ? (item.weight / totalOilWeight) * 100 : 0;
        const warnings = checkAdditiveWarnings(additive, percentage);
        allWarnings.push(...warnings.map(w => ({ ...w, additiveName: additive.name })));

        // Determine warning class (highest severity wins)
        let warningClass = '';
        if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.DANGER)) {
            warningClass = 'danger';
        } else if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.WARNING)) {
            warningClass = 'warning';
        }

        return renderItemRow({
            id: item.id,
            name: additive.name,
            weight: item.weight,
            percentage: percentage.toFixed(1),
            isLocked: false,
            hasWarning: !!warningClass,
            warningClass
        }, i, {
            showWeightInput: true,
            showLockButton: false,
            showPercentage: true,
            unit,
            itemType: 'additive'
        });
    }).join('');

    container.innerHTML = `
        ${rows}
        <div class="totals-row additive-totals">
            <span>Total Additives</span>
            <span>${totalAdditiveWeight.toFixed(2)} ${unit}</span>
            <span></span>
            <span></span>
        </div>
    `;

    // Store callbacks on container for dynamic lookup
    container._callbacks = {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    };

    // Only attach event handlers once per container
    if (!container.dataset.handlersAttached) {
        attachRowEventHandlers(container, container._callbacks, 'additive');
        container.dataset.handlersAttached = 'true';
    }

    return allWarnings;
}

/**
 * Update additives total display
 * @param {number} total - Total additives weight
 * @param {string} unit - Unit string (g or oz)
 */
export function updateAdditivesTotal(total, unit) {
    const el = $(ELEMENT_IDS.additivesTotal);
    if (el) el.textContent = total.toFixed(2);

    const unitEl = $(ELEMENT_IDS.additivesUnit);
    if (unitEl) unitEl.textContent = unit;
}

/**
 * Show additive info panel
 * @param {string} additiveId - Additive id (kebab-case key)
 * @param {Object} additivesDatabase - Additives database
 */
export function showAdditiveInfo(additiveId, additivesDatabase) {
    if (!additiveId || !additivesDatabase[additiveId]) return;

    const additive = additivesDatabase[additiveId];
    const panel = $(ELEMENT_IDS.additiveInfoPanel);

    $('additivePanelName').textContent = additive.name;
    $('additivePanelCategory').textContent = formatCategory(additive.category, additive.subcategory);
    $('additivePanelUsage').textContent = `${additive.usage.min}% to ${additive.usage.max}% of oil weight`;
    $('additivePanelDescription').textContent = additive.description;

    // Safety info
    const safetyContainer = $('additivePanelSafety');
    const safetyItems = [];

    if (additive.safety) {
        if (additive.safety.ifraCategory9Limit) {
            safetyItems.push(`IFRA Category 9 limit: ${additive.safety.ifraCategory9Limit}%`);
        }
        if (additive.safety.maxConcentration) {
            safetyItems.push(`Max concentration: ${additive.safety.maxConcentration}%`);
        }
        if (additive.safety.fdaGras) {
            safetyItems.push('FDA GRAS status');
        }
        if (additive.safety.fdaCfr) {
            safetyItems.push(`FDA: ${additive.safety.fdaCfr}`);
        }
        if (additive.safety.cosIng) {
            safetyItems.push(`CosIng: ${additive.safety.cosIng}`);
        }
        if (additive.safety.casNumber) {
            safetyItems.push(`CAS: ${additive.safety.casNumber}`);
        }
        if (additive.safety.flashPointC) {
            safetyItems.push(`Flash point: ${additive.safety.flashPointC}°C`);
        }
    }

    safetyContainer.innerHTML = safetyItems.length > 0
        ? safetyItems.map(item => `<div class="safety-item">${item}</div>`).join('')
        : '<div class="safety-item">No specific safety data</div>';

    // Category-specific info
    const extraInfo = $('additivePanelExtra');
    const extraSection = $('additivePanelExtraSection');
    const extraItems = [];

    if (additive.scentNote) {
        extraItems.push(`<div class="extra-item"><span class="extra-label">Scent note:</span> ${capitalize(additive.scentNote)}</div>`);
    }
    if (additive.anchoring?.length > 0) {
        const anchorNames = additive.anchoring
            .map(id => additivesDatabase[id]?.name || id)
            .join(', ');
        extraItems.push(`<div class="extra-item"><span class="extra-label">Anchors well with:</span> ${anchorNames}</div>`);
    }
    if (additive.color) {
        extraItems.push(`<div class="extra-item"><span class="extra-label">Color:</span> <span class="color-swatch" style="background-color: ${additive.color}"></span></div>`);
    }
    if (additive.density) {
        extraItems.push(`<div class="extra-item"><span class="extra-label">Density:</span> ${additive.density} g/mL</div>`);
    }

    extraInfo.innerHTML = extraItems.join('');
    if (extraSection) {
        extraSection.style.display = extraItems.length > 0 ? 'block' : 'none';
    }

    renderReferences(panel, additive.references);

    openPanel(ELEMENT_IDS.additiveInfoPanel, ELEMENT_IDS.panelOverlay);
}

/**
 * Format category for display
 * @param {string} category - Main category
 * @param {string} subcategory - Optional subcategory
 * @returns {string} Formatted category string
 */
function formatCategory(category, subcategory) {
    const categoryNames = {
        'essential-oil': 'Essential Oil',
        'colourant': 'Colourant',
        'functional': 'Functional Additive'
    };

    const base = categoryNames[category] || category;
    if (subcategory) {
        return `${base} (${capitalize(subcategory)})`;
    }
    return base;
}

