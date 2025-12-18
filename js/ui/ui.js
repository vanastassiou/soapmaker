/**
 * UI rendering functions for the soap recipe builder
 * Handles all DOM manipulation and rendering
 */

import {
    ADDITIVE_WARNING_TYPES,
    CSS_CLASSES,
    DEFAULTS,
    ELEMENT_IDS,
    FATTY_ACID_NAMES,
    MATCH_THRESHOLDS,
    PROPERTY_ELEMENT_IDS,
    PROPERTY_FATTY_ACIDS,
    PROPERTY_KEYS,
    UI_MESSAGES
} from '../lib/constants.js';

import { checkAdditiveWarnings, generateFatProperties } from '../core/calculator.js';
import { resolveReferences } from '../lib/references.js';

import {
    $,
    delegate,
    onActivate,
    parseFloatOr,
    parseIntOr,
    populateSelect,
    positionNearAnchor,
    setupAbortSignal
} from './helpers.js';

import {
    closeCurrentPanel,
    openPanel
} from './panelManager.js';

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
 * Render the recipe fats list (Select fats mode - percentage input)
 * @param {HTMLElement} container - Container element
 * @param {Array} recipe - Array of {id, percentage}
 * @param {Set} locks - Set of locked indices
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Object} callbacks - {onPercentageChange, onToggleLock, onRemove, onFatInfo}
 */
export function renderRecipe(container, recipe, locks, fatsDatabase, callbacks) {
    const signal = setupAbortSignal(container);

    if (recipe.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_FATS_ADDED);
        return;
    }

    const totalPercentage = recipe.reduce((sum, fat) => sum + fat.percentage, 0);

    const headerRow = `
        <div class="item-row header-row">
            <span>Fat</span>
            <span>%</span>
            <span></span>
        </div>
    `;

    const rows = recipe.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            percentage: fat.percentage,
            isLocked: locks.has(i)
        }, i, {
            inputType: 'percentage',
            showWeight: false,
            showPercentage: true,
            lockableField: 'percentage',
            itemType: 'fat'
        });
    }).join('');

    // Show total percentage (should be 100%)
    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span class="${Math.abs(totalPercentage - 100) > 0.1 ? 'percentage-warning' : ''}">${totalPercentage.toFixed(1)}%</span>
            <span></span>
        </div>
    `;

    container.innerHTML = headerRow + rows + totalsRow;

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onPercentageChange: callbacks.onPercentageChange,
        onToggleLock: callbacks.onToggleLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onFatInfo
    }, 'fat', signal);
}

// ============================================
// Results Display
// ============================================

/**
 * Explanations for out-of-range property values
 */
const RANGE_EXPLANATIONS = {
    hardness: {
        low: 'Soft bar; may need a longer cure time or additives like sodium lactate',
        high: 'Very hard; may be brittle or waxy, so cut soon after unmoulding to avoid cracking'
    },
    degreasing: {
        low: 'Low degreasing; very gentle on skin, but may feel insufficiently effective',
        high: 'High degreasing; good for utility soap, but frequent use may dry skin'
    },
    moisturizing: {
        low: 'Low moisturizing; less conditioning, may feel drying',
        high: 'High moisturizing; very conditioning, but may reduce lather'
    },
    'lather-volume': {
        low: 'Lathering produces less foam',
        high: 'Lathering produces lots of foam, but it may feel less creamy than desired'
    },
    'lather-density': {
        low: 'Lathering produces a stable, lotion-like foam',
        high: 'Lathering produces a dense foam, but lather volume may be reduced'
    },
    iodine: {
        low: 'Low iodine; very stable but may lack moisturizing fats',
        high: 'High iodine; prone to rancidity, so mitigate this by adding antioxidant and cure in cool dark place'
    },
    ins: {
        low: 'Low INS; bar may be soft or slow to trace',
        high: 'High INS; may trace quickly, so use lower temperatures or work quickly'
    }
};

/**
 * Update a property display with in/out of range styling
 * @param {string} key - Property key (e.g., 'hardness')
 * @param {number} value - Property value
 * @param {number} min - Min range
 * @param {number} max - Max range
 */
export function updateProperty(key, value, min, max) {
    const elem = $(PROPERTY_ELEMENT_IDS.prop[key]);
    if (!elem) return;

    const isInRange = value >= min && value <= max;
    const explanations = RANGE_EXPLANATIONS[key];

    elem.classList.remove(CSS_CLASSES.inRange, CSS_CLASSES.outRange);
    elem.classList.add(isInRange ? CSS_CLASSES.inRange : CSS_CLASSES.outRange);

    // Show value with help icon for out-of-range
    if (!isInRange && explanations) {
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
        const elem = $(PROPERTY_ELEMENT_IDS.range[prop]);
        if (elem && ranges[prop]) {
            elem.textContent = `${ranges[prop].min} - ${ranges[prop].max}`;
        }
    });

    // Also populate profile builder input placeholders
    const profileProperties = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];
    profileProperties.forEach(prop => {
        const input = $(PROPERTY_ELEMENT_IDS.target[prop]);
        if (input && ranges[prop]) {
            input.placeholder = `${ranges[prop].min}-${ranges[prop].max}`;
        }
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
        const row = container.querySelector(`.item-row[data-index="${i}"]`);
        if (row) {
            const percentage = totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0;
            const percentSpan = row.querySelector('.item-percentage');
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
// Info Panels
// ============================================

/**
 * Render references section into a panel
 * @param {HTMLElement} panel - The panel element to append references to
 * @param {Array} references - Array of {sourceId, section, url}
 * @param {Object} sourcesData - Sources database for resolving sourceIds
 */
function renderReferences(panel, references, sourcesData) {
    // Remove existing references section if present
    const existing = panel.querySelector('.panel-references-section');
    if (existing) existing.remove();

    if (!references || references.length === 0) return;

    const resolved = resolveReferences(references, sourcesData);
    const section = document.createElement('div');
    section.className = 'panel-section panel-references-section';
    section.innerHTML = `
        <h4>References</h4>
        <div class="panel-references">
            ${resolved.map(ref => `
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
 * @param {Object} sourcesData - Sources database for resolving references
 * @param {Function} onFattyAcidClick - Callback when fatty acid is clicked
 */
export function showFatInfo(fatId, fatsDatabase, fattyAcidsData, sourcesData, onFattyAcidClick) {
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
                <button type="button" class="fa-source-name fa-link" data-acid="${name}">${name}</button>
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

    renderReferences($(ELEMENT_IDS.fatInfoPanel), fat.references, sourcesData);

    openPanel(ELEMENT_IDS.fatInfoPanel, ELEMENT_IDS.panelOverlay);
}

/**
 * Close all info panels - uses panelManager to close current panel
 * Since only one panel can be open at a time, this closes whichever is open
 */
export function closeAllInfoPanels() {
    closeCurrentPanel();
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
 * @param {Object} sourcesData - Sources database for resolving references
 * @param {Function} onTermClick - Callback when related term is clicked
 */
export function showGlossaryInfo(term, glossaryData, recipe, fatsDatabase, sourcesData, onTermClick) {
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
            .map(r => `<button type="button" class="panel-tag" data-term="${r}">${glossaryData[r].term}</button>`)
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

    renderReferences($('glossaryPanel'), data.references, sourcesData);

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
 * @param {Object} sourcesData - Sources database for resolving references
 */
export function showFattyAcidInfo(acidKey, fattyAcidsData, recipe, fatsDatabase, sourcesData) {
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
            <div class="fa-prop-item"><span class="fa-prop-label">Degreasing</span><span class="fa-prop-value">${props.degreasing}</span></div>
            <div class="fa-prop-item"><span class="fa-prop-label">Lather</span><span class="fa-prop-value">${props.lather}</span></div>
            <div class="fa-prop-item"><span class="fa-prop-label">Moisturizing</span><span class="fa-prop-value">${props.moisturizing}</span></div>
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

    renderReferences($('fattyAcidPanel'), acid.references, sourcesData);

    openPanel('fattyAcidPanel', ELEMENT_IDS.panelOverlay);
}

// ============================================
// Help Popup System (shared by glossary and tooltips)
// ============================================

/**
 * Initialize unified help popup system for both glossary and tooltips
 * @param {Object} glossaryData - Glossary data (soapmaking knowledge)
 * @param {Object} tooltipsData - Tooltips data (UI help)
 * @param {Function} onOpenPanel - Callback to open glossary panel: (term) => void
 */
export function initHelpPopup(glossaryData, tooltipsData, onOpenPanel) {
    const popup = document.createElement('div');
    popup.className = 'help-popup';
    popup.innerHTML = `
        <div class="help-popup-title"></div>
        <div class="help-popup-body"></div>
        <a href="#" class="help-popup-link"></a>
    `;
    document.body.appendChild(popup);

    let activeTipEl = null;
    let currentLinkAction = null;

    function hidePopup() {
        popup.classList.remove('visible');
        popup.style.display = '';  // Clear inline style from positionNearAnchor
        activeTipEl = null;
        currentLinkAction = null;
    }

    function showPopup(anchorEl, { title, desc, linkText, linkAction }) {
        popup.querySelector('.help-popup-title').textContent = title;
        popup.querySelector('.help-popup-body').textContent = desc;

        const linkEl = popup.querySelector('.help-popup-link');
        if (linkText && linkAction) {
            linkEl.textContent = linkText + ' →';
            linkEl.style.display = 'block';
            currentLinkAction = linkAction;
        } else {
            linkEl.style.display = 'none';
            currentLinkAction = null;
        }

        popup.classList.add('visible');
        positionNearAnchor(popup, anchorEl);
    }

    function showRangeTip(text, anchorEl) {
        showPopup(anchorEl, {
            title: 'Out of range',
            desc: text,
            linkText: null,
            linkAction: null
        });
    }

    document.addEventListener('click', (e) => {
        const glossaryTip = e.target.closest('.help-tip[data-term]');
        const uiTip = e.target.closest('.ui-tip[data-tooltip]');
        const rangeTip = e.target.closest('.help-tip[data-range-tip]');
        const linkEl = e.target.closest('.help-popup-link');
        const inPopup = e.target.closest('.help-popup');

        // Clicking the "More details" / "Learn more" link
        if (linkEl && currentLinkAction) {
            e.preventDefault();
            const callback = currentLinkAction;
            hidePopup();
            callback();
            return;
        }

        // Clicking inside popup - don't dismiss
        if (inPopup) {
            return;
        }

        // Clicking a glossary help tip (ⓘ)
        if (glossaryTip) {
            e.preventDefault();
            if (glossaryTip === activeTipEl) {
                hidePopup();
            } else {
                const term = glossaryTip.dataset.term;
                const data = glossaryData[term];
                if (data) {
                    showPopup(glossaryTip, {
                        title: data.term,
                        desc: data.desc,
                        linkText: 'More details',
                        linkAction: () => onOpenPanel(term)
                    });
                    activeTipEl = glossaryTip;
                }
            }
            return;
        }

        // Clicking a UI tooltip (?)
        if (uiTip) {
            e.preventDefault();
            if (uiTip === activeTipEl) {
                hidePopup();
            } else {
                const key = uiTip.dataset.tooltip;
                const data = tooltipsData[key];
                if (data) {
                    const glossaryLink = data.glossaryLink;
                    showPopup(uiTip, {
                        title: data.title,
                        desc: data.desc,
                        linkText: glossaryLink ? 'Learn more' : null,
                        linkAction: glossaryLink ? () => onOpenPanel(glossaryLink) : null
                    });
                    activeTipEl = uiTip;
                }
            }
            return;
        }

        // Clicking a range tip (out of range warning)
        if (rangeTip) {
            e.preventDefault();
            if (rangeTip === activeTipEl) {
                hidePopup();
            } else {
                showRangeTip(rangeTip.dataset.rangeTip, rangeTip);
                activeTipEl = rangeTip;
            }
            return;
        }

        // Any other click dismisses popup
        hidePopup();
    });
}

// ============================================
// Profile Builder
// ============================================

/**
 * Render profile builder results
 * @param {Object} result - Result from findFatsForProfile
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
    const signal = setupAbortSignal(suggestedRecipeDiv);

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
            isLocked: lockedIndices.has(index)
        }, index, {
            showWeight: false,
            showPercentage: true,
            lockableField: 'percentage',
            showRemoveButton: false,
            itemType: 'fat'
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
    const properties = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];

    properties.forEach(prop => {
        const input = $(PROPERTY_ELEMENT_IDS.target[prop]);
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
// Ingredient Exclusions
// ============================================

/**
 * Render the excluded ingredients list as removable tags
 * @param {Array} excludedIds - Array of ingredient ids
 * @param {Object} databases - Object containing all ingredient databases for name lookups
 * @param {Function} onRemove - Callback when an ingredient is removed
 */
export function renderExcludedIngredients(excludedIds, databases, onRemove) {
    const container = $(ELEMENT_IDS.excludedIngredientsList);
    if (!container) return;

    if (excludedIds.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No ingredients excluded</p></div>';
        return;
    }

    container.innerHTML = excludedIds.map(id => {
        const name = lookupIngredientName(id, databases);
        return `
            <span class="excluded-fat-tag" data-fat="${id}">
                ${name}
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
 * Look up an ingredient name from any database
 * @param {string} id - Ingredient ID
 * @param {Object} databases - Object containing all ingredient databases
 * @returns {string} Ingredient name or ID if not found
 */
function lookupIngredientName(id, databases) {
    for (const db of Object.values(databases)) {
        if (db[id]) return db[id].name;
    }
    return id;
}

/**
 * Populate the exclude ingredient select dropdown with all ingredient types
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} databases - Object containing all ingredient databases
 * @param {Array} excludedIds - Already excluded ingredient ids to filter out
 */
export function populateExcludeIngredientSelect(selectElement, databases, excludedIds = []) {
    // Clear existing options (keep placeholder at index 0)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    const excluded = new Set(excludedIds);

    // Combine and sort all ingredients from all databases
    const allIngredients = [];
    for (const db of Object.values(databases)) {
        for (const [id, data] of Object.entries(db)) {
            if (!excluded.has(id)) {
                allIngredients.push({ id, name: data.name });
            }
        }
    }

    // Sort by name
    allIngredients.sort((a, b) => a.name.localeCompare(b.name));

    // Add options
    allIngredients.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

// Legacy wrapper for backward compatibility
export function renderExcludedFats(excludedFats, fatsDatabase, onRemove) {
    renderExcludedIngredients(excludedFats, { fats: fatsDatabase }, onRemove);
}

// Legacy wrapper for backward compatibility
export function populateExcludeFatSelect(selectElement, fatsDatabase, excludedFats = []) {
    populateSelect(selectElement, fatsDatabase, excludedFats);
}

/**
 * Clear profile builder inputs
 */
export function clearProfileInputs() {
    const properties = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];

    properties.forEach(prop => {
        const input = $(PROPERTY_ELEMENT_IDS.target[prop]);
        if (input) input.value = '';
    });

    hideProfileResults();
}

// ============================================
// Cupboard Cleaner
// ============================================

/**
 * Render cupboard fats (weight input, no locks)
 * @param {HTMLElement} container - Container element
 * @param {Array} cupboardFats - Array of {id, weight}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 */
export function renderCupboardFats(container, cupboardFats, fatsDatabase, unit, callbacks) {
    const signal = setupAbortSignal(container);

    if (cupboardFats.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_CUPBOARD_FATS);
        return;
    }

    const totalWeight = cupboardFats.reduce((sum, fat) => sum + fat.weight, 0);

    const headerRow = `
        <div class="item-row header-row cols-3">
            <span>Fat</span>
            <span>Weight</span>
            <span>%</span>
        </div>
    `;

    const rows = cupboardFats.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: fat.weight,
            percentage: totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: true,
            lockableField: null,
            showRemoveButton: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = headerRow + rows + renderTotalsRow('Total Fats', totalWeight, unit, 0);

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    }, 'fat', signal);
}

/**
 * Render cupboard suggestions (display only, no locks)
 * @param {HTMLElement} container - Container element
 * @param {Array} suggestions - Array of {id, weight, percentage}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 */
export function renderCupboardSuggestions(container, suggestions, fatsDatabase, unit, callbacks) {
    const signal = setupAbortSignal(container);

    if (suggestions.length === 0) {
        container.innerHTML = '';
        return;
    }

    const totalWeight = suggestions.reduce((sum, s) => sum + s.weight, 0);

    const headerRow = `
        <div class="item-row header-row">
            <span>Suggested fat</span>
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
            isLocked: false
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: true,
            lockableField: null,  // No locks for suggestions
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = headerRow + rows + renderTotalsRow('Total suggested', totalWeight, unit, 1);

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlersWithSignal(container, {
        onWeightChange: callbacks.onWeightChange,
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
        processType: $(ELEMENT_IDS.processType)?.value || 'cold',
        superfat: parseFloatOr($(ELEMENT_IDS.superfat)?.value, 0),
        waterRatio: parseFloatOr($(ELEMENT_IDS.waterRatio)?.value, 2),
        unit: $(ELEMENT_IDS.unit)?.value || 'metric',
        recipeWeight: parseFloatOr($(ELEMENT_IDS.recipeWeight)?.value, DEFAULTS.BASE_RECIPE_WEIGHT)
    };
}

// ============================================
// Additives
// ============================================

/**
 * Populate additive select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} database - Pre-filtered database for the category
 * @param {Array} existingIds - IDs already in recipe to exclude
 * @param {Function|null} filterFn - Optional filter function (id, data) => boolean
 */
export function populateAdditiveSelect(selectElement, database, existingIds = [], filterFn = null) {
    populateSelect(selectElement, database, existingIds, filterFn);
}

/**
 * Render the recipe additives list
 * @param {HTMLElement} container - Container element
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives database
 * @param {number} totalFatWeight - Total fat weight for percentage calculations
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 * @returns {Array} Array of warning objects from all additives
 */
export function renderAdditives(container, recipeAdditives, additivesDatabase, totalFatWeight, unit, callbacks) {
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

    const headerRow = `
        <div class="item-row header-row cols-3">
            <span>Additive</span>
            <span>${unit}</span>
            <span></span>
        </div>
    `;

    const rows = recipeAdditives.map((item, i) => {
        const additive = additivesDatabase[item.id];
        if (!additive) return '';

        const percentage = totalFatWeight > 0 ? (item.weight / totalFatWeight) * 100 : 0;
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
            inputType: 'weight',
            showWeight: true,
            showPercentage: false,
            lockableField: null,
            unit,
            itemType: 'additive'
        });
    }).join('');

    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${totalAdditiveWeight.toFixed(1)} ${unit}</span>
            <span></span>
        </div>
    `;

    container.innerHTML = headerRow + rows + totalsRow;

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
 * Show additive info panel
 * @param {string} additiveId - Additive id (kebab-case key)
 * @param {Object} additivesDatabase - Additives database
 * @param {Object} sourcesData - Sources database for resolving references
 */
export function showAdditiveInfo(additiveId, additivesDatabase, sourcesData) {
    if (!additiveId || !additivesDatabase[additiveId]) return;

    const additive = additivesDatabase[additiveId];
    const panel = $(ELEMENT_IDS.additiveInfoPanel);

    // Infer category from item properties (separate files don't have category field)
    let category = additive.category;
    if (!category) {
        if (additive.scentNote) {
            category = 'fragrance';
        } else if (additive.color) {
            category = 'colourant';
        } else if (['hardener', 'lather-enhancer', 'antioxidant'].includes(additive.subcategory)) {
            category = 'soap-performance';
        } else if (['emollient', 'exfoliant'].includes(additive.subcategory)) {
            category = 'skin-care';
        }
    }

    $('additivePanelName').textContent = additive.name;
    $('additivePanelCategory').textContent = formatCategory(category, additive.subcategory);
    $('additivePanelUsage').textContent = `${additive.usage.min}% to ${additive.usage.max}% of fat weight`;
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
        extraItems.push(`<div class="extra-item"><span class="extra-label">Scent note:</span> ${additive.scentNote}</div>`);
    }
    if (additive.anchoring?.length > 0) {
        const anchorNames = additive.anchoring
            .map(id => additivesDatabase[id]?.name || id)
            .join(', ');
        extraItems.push(`<div class="extra-item"><span class="extra-label">Anchors well with:</span> ${anchorNames}</div>`);
    }
    if (additive.color) {
        extraItems.push(`<div class="extra-item"><span class="extra-label">Colour:</span> <span class="color-swatch" style="background-color: ${additive.color}"></span></div>`);
    }
    if (additive.density) {
        extraItems.push(`<div class="extra-item"><span class="extra-label">Density:</span> ${additive.density} g/mL</div>`);
    }

    extraInfo.innerHTML = extraItems.join('');
    if (extraSection) {
        extraSection.style.display = extraItems.length > 0 ? 'block' : 'none';
    }

    renderReferences(panel, additive.references, sourcesData);

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
        'fragrance': 'fragrance',
        'colourant': 'colourant',
        'soap-performance': 'soap performance',
        'skin-care': 'skin care'
    };

    const base = categoryNames[category] || category || 'additive';
    if (subcategory) {
        return `${base} (${subcategory})`;
    }
    return base;
}

