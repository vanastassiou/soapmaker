/**
 * Final recipe display rendering
 * Generates prose-format recipe with ingredients and procedure
 */

import { CSS_CLASSES, ELEMENT_IDS } from '../lib/constants.js';
import { $, formatProseList } from './helpers.js';

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format a weight value with unit
 * @param {number} weight - Weight value
 * @param {string} unit - Unit string
 * @returns {string} Formatted weight string
 */
function formatWeight(weight, unit) {
    return `${weight.toFixed(2)} ${unit}`;
}

/**
 * Format oil list in prose
 * @param {Array} recipe - Recipe array of {id, weight}
 * @param {Object} fatsDatabase - Fat database
 * @param {string} unit - Unit string
 * @returns {string} Prose list of oils
 */
function formatOilsList(recipe, fatsDatabase, unit) {
    if (recipe.length === 0) return 'No oils added';

    return formatProseList(recipe, fat => {
        const fatData = fatsDatabase[fat.id];
        const name = fatData ? fatData.name : fat.id;
        return `${formatWeight(fat.weight, unit)} ${name}`;
    });
}

/**
 * Format additives list in prose
 * @param {Array} recipeAdditives - Additives array of {id, weight}
 * @param {Object} additivesDatabase - Additives database
 * @param {string} unit - Unit string
 * @returns {string} Prose list of additives
 */
function formatAdditivesList(recipeAdditives, additivesDatabase, unit) {
    if (recipeAdditives.length === 0) return '';

    return formatProseList(recipeAdditives, item => {
        const additive = additivesDatabase[item.id];
        const name = additive ? additive.name : item.id;
        return `${formatWeight(item.weight, unit)} ${name}`;
    });
}

// ============================================
// Recipe Procedure Template
// ============================================

const RECIPE_PROCEDURE = [
    {
        title: 'Prepare fats',
        text: 'Combine fats in a heat-safe, non-reactive container (avoid aluminum). Heat gently until all solid fats are melted, then let cool target soaping temperature (typically 100-130°F / 38-54°C).'
    },
    {
        title: 'Prepare lye solution',
        text: 'Working in a well-ventilated area, slowly add lye to cold water (NEVER add water to lye) and stir until fully dissolved. The solution will heat up significantly; let it cool to your target temperature.'
    },
    {
        title: 'Combine',
        text: 'Slowly pour lye solution into fats, stirring to combine. Use an immersion blender to blend the mixture until it reaches light trace.'
    },
    {
        title: 'Add additives',
        text: 'Add fragrance, colourants, and other additives. Blend briefly to incorporate.',
        conditional: 'additives'
    },
    {
        title: 'Mould',
        text: 'Pour mixture into prepared moulds and tap them gently to release air bubbles.'
    },
    {
        title: 'Unmold and cure',
        text: 'Let mixture saponify for 24 to 48 hours, then unmould and cut into bars if needed. Cure soap on a rack in a cool, dry place for 4 to 6 weeks before use.'
    }
];

// ============================================
// HTML Builders
// ============================================

/**
 * Build ingredients list HTML
 * @param {Object} data - Recipe data
 * @returns {string} HTML for ingredients section
 */
function buildIngredientsList(data) {
    const { recipe, recipeAdditives, fatsDatabase, additivesDatabase, lyeAmount, waterAmount, lyeType, unit } = data;

    let html = '<div class="recipe-section"><h4>Ingredients</h4><ul class="ingredients-list">';

    // Oils
    recipe.forEach(fat => {
        const fatData = fatsDatabase[fat.id];
        const name = fatData ? fatData.name : fat.id;
        html += `<li><span class="ingredient-amount">${formatWeight(fat.weight, unit)}</span> <span class="ingredient-name">${name}</span></li>`;
    });

    // Lye
    const lyeFullName = lyeType === 'NaOH' ? 'Sodium Hydroxide (NaOH)' : 'Potassium Hydroxide (KOH)';
    html += `<li><span class="ingredient-amount">${formatWeight(lyeAmount, unit)}</span> <span class="ingredient-name">${lyeFullName}</span></li>`;

    // Water
    html += `<li><span class="ingredient-amount">${formatWeight(waterAmount, unit)}</span> <span class="ingredient-name">Distilled Water</span></li>`;

    // Additives
    recipeAdditives.forEach(item => {
        const additive = additivesDatabase[item.id];
        const name = additive ? additive.name : item.id;
        html += `<li><span class="ingredient-amount">${formatWeight(item.weight, unit)}</span> <span class="ingredient-name">${name}</span></li>`;
    });

    html += '</ul></div>';
    return html;
}

/**
 * Build procedure list HTML
 * @param {boolean} hasAdditives - Whether recipe has additives
 * @returns {string} HTML for procedure section
 */
function buildProcedureList(hasAdditives) {
    let html = '<div class="recipe-section"><h4>Procedure</h4><ol class="procedure-list">';

    RECIPE_PROCEDURE.forEach(step => {
        // Skip conditional steps if condition not met
        if (step.conditional === 'additives' && !hasAdditives) return;

        html += `<li><strong>${step.title}.</strong> ${step.text}</li>`;
    });

    html += '</ol></div>';
    return html;
}

/**
 * Build recipe summary HTML
 * @param {Object} data - Recipe data
 * @returns {string} HTML for summary section
 */
function buildRecipeSummary(data) {
    const { recipe, recipeAdditives, lyeAmount, waterAmount, lyeType, superfat, waterRatio, unit } = data;
    const totalOilWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    const additivesWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);
    const totalBatch = totalOilWeight + lyeAmount + waterAmount + additivesWeight;

    let html = `
        <div class="recipe-summary">
            <h4>Recipe Summary</h4>
            <ul>
                <li>Total oils: ${formatWeight(totalOilWeight, unit)}</li>
                <li>${lyeType}: ${formatWeight(lyeAmount, unit)}</li>
                <li>Water: ${formatWeight(waterAmount, unit)} (${waterRatio}:1 water to lye)</li>`;

    if (recipeAdditives.length > 0) {
        html += `<li>Additives: ${formatWeight(additivesWeight, unit)}</li>`;
    }

    html += `
                <li>Total batch weight: ${formatWeight(totalBatch, unit)}</li>
                <li>Superfat: ${superfat}%</li>
            </ul>
        </div>`;

    return html;
}

// ============================================
// Exported Functions
// ============================================

/**
 * Render the final recipe with ingredients and procedure
 * @param {HTMLElement} container - Container element
 * @param {Object} data - Recipe data
 * @param {Array} data.recipe - Recipe array of {id, weight}
 * @param {Array} data.recipeAdditives - Additives array
 * @param {Object} data.fatsDatabase - Fat database
 * @param {Object} data.additivesDatabase - Additives database
 * @param {number} data.lyeAmount - Lye amount
 * @param {number} data.waterAmount - Water amount
 * @param {string} data.lyeType - Lye type (NaOH or KOH)
 * @param {number} data.superfat - Superfat percentage
 * @param {number} data.waterRatio - Water to lye ratio
 * @param {string} data.unit - Unit string
 */
export function renderFinalRecipe(container, data) {
    const hasAdditives = data.recipeAdditives.length > 0;

    container.innerHTML = `
        <div class="recipe-prose">
            ${buildIngredientsList(data)}
            ${buildProcedureList(hasAdditives)}
            ${buildRecipeSummary(data)}
        </div>
    `;
}

/**
 * Show the final recipe card
 */
export function showFinalRecipe() {
    const card = $(ELEMENT_IDS.finalRecipeCard);
    if (card) {
        card.classList.remove(CSS_CLASSES.hidden);
        card.scrollIntoView({ behavior: 'smooth' });
    }
}
