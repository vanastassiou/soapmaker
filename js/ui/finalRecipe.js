/**
 * Final recipe display rendering
 * Generates prose-format recipe with ingredients and procedure
 */

import { CSS_CLASSES, ELEMENT_IDS, FATTY_ACID_KEYS, FATTY_ACID_NAMES, PROPERTY_RANGES } from '../lib/constants.js';
import { $, formatProseList } from './helpers.js';

// ============================================
// Qualitative Summary
// ============================================

/**
 * Generate a qualitative description of soap properties
 * @param {Object} properties - {hardness, cleansing, conditioning, bubbly, creamy, iodine, ins}
 * @param {Array} notes - Recipe notes array from calculator
 * @returns {string} HTML for qualitative summary
 */
function buildQualitativeSummary(properties, notes = []) {
    const R = PROPERTY_RANGES;

    // Helper to classify a value relative to its range
    const classify = (value, range) => {
        if (value < range.min) return 'low';
        if (value > range.max) return 'high';
        return 'mid';
    };

    // Hardness description
    const hardnessLevel = classify(properties.hardness, R.hardness);
    const hardnessText = {
        low: 'soft',
        mid: 'firm',
        high: 'very hard'
    }[hardnessLevel];

    // Cleansing description
    const cleansingLevel = classify(properties.cleansing, R.cleansing);
    const cleansingText = {
        low: 'gentle',
        mid: 'moderate',
        high: 'strong'
    }[cleansingLevel];

    // Bubbly description
    const bubblyLevel = classify(properties.bubbly, R.bubbly);
    const bubblyText = {
        low: 'minimal',
        mid: 'good',
        high: 'abundant'
    }[bubblyLevel];

    // Creamy description
    const creamyLevel = classify(properties.creamy, R.creamy);
    const creamyText = {
        low: 'light',
        mid: 'creamy',
        high: 'rich'
    }[creamyLevel];

    // Build main description
    let summary = `Produces a ${hardnessText} bar with ${cleansingText} cleansing ability. `;
    summary += `Lather is ${bubblyText} with a ${creamyText} texture.`;

    // Collect all warnings - start with calculator-generated notes
    const warnings = notes.map(note => note.text);

    // Add property-based warnings for out-of-range values
    const iodineLevel = classify(properties.iodine, R.iodine);
    if (iodineLevel === 'high') {
        warnings.push('High iodine value means an increased risk of rancidity. Store in a cool, dark place, and consider adding an antioxidant like Vitamin E or rosemary oleoresin extract to help preserve the soap.');
    } else if (iodineLevel === 'low') {
        warnings.push('Low iodine value means excellent shelf stability, but the bar may feel less conditioning.');
    }

    const insLevel = classify(properties.ins, R.ins);
    if (insLevel === 'high') {
        warnings.push('High INS value may cause the soap to trace very quickly. Work at lower temperatures and have moulds ready.');
    } else if (insLevel === 'low') {
        warnings.push('Low INS value indicates the bar may be slow to trace and remain soft longer. Consider adding sodium lactate to aid hardening.');
    }

    if (hardnessLevel === 'low') {
        warnings.push('This soft bar will benefit from an extended cure time of 6 to 8 weeks.');
    } else if (hardnessLevel === 'high') {
        warnings.push('Cut bars soon after unmoulding (12 to 24 hours) to prevent cracking.');
    }

    if (cleansingLevel === 'high') {
        warnings.push('High cleansing is great for utility soap (e.g. garage, kitchen) but may be drying for frequent facial use.');
    }

    let html = `<p class="qualitative-summary">${summary}</p>`;

    if (warnings.length > 0) {
        html += `<ul class="qualitative-warnings">`;
        warnings.forEach(w => {
            html += `<li>${w}</li>`;
        });
        html += `</ul>`;
    }

    return html;
}

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
 * Format fat list in prose
 * @param {Array} recipe - Recipe array of {id, weight}
 * @param {Object} fatsDatabase - Fat database
 * @param {string} unit - Unit string
 * @returns {string} Prose list of fats
 */
function formatFatsList(recipe, fatsDatabase, unit) {
    if (recipe.length === 0) return 'No fats added';

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

    // Fats
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
    const totalFatWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    const additivesWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);
    const totalBatch = totalFatWeight + lyeAmount + waterAmount + additivesWeight;

    let html = `
        <div class="recipe-summary">
            <h4>Recipe summary</h4>
            <ul>
                <li>Total fats: ${formatWeight(totalFatWeight, unit)}</li>
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

/**
 * Build fatty acid profile HTML
 * @param {Object} fattyAcids - Fatty acid percentages
 * @returns {string} HTML for fatty acid profile section
 */
function buildFattyAcidProfile(fattyAcids) {
    // Calculate sat:unsat ratio
    const saturated = (fattyAcids.caprylic || 0) + (fattyAcids.capric || 0) +
        fattyAcids.lauric + fattyAcids.myristic + fattyAcids.palmitic +
        fattyAcids.stearic + (fattyAcids.arachidic || 0) + (fattyAcids.behenic || 0);
    const unsaturated = (fattyAcids.palmitoleic || 0) + fattyAcids.oleic +
        fattyAcids.ricinoleic + fattyAcids.linoleic + fattyAcids.linolenic +
        (fattyAcids.erucic || 0);

    // Build table rows for acids with values > 0
    const rows = FATTY_ACID_KEYS
        .filter(acid => (fattyAcids[acid] || 0) > 0)
        .map(acid => `
            <tr>
                <td>${FATTY_ACID_NAMES[acid]}</td>
                <td class="fa-value">${(fattyAcids[acid] || 0).toFixed(0)}%</td>
            </tr>
        `).join('');

    return `
        <div class="recipe-summary fatty-acid-profile">
            <h4>Fatty acid profile</h4>
            <table class="fa-profile-table">
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p class="sat-unsat-summary">Saturated : Unsaturated = ${saturated.toFixed(0)} : ${unsaturated.toFixed(0)}</p>
        </div>
    `;
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
 * @param {Object} data.fattyAcids - Fatty acid percentages
 * @param {Object} data.properties - Soap properties {hardness, cleansing, conditioning, bubbly, creamy, iodine, ins}
 * @param {Array} data.notes - Recipe notes array
 */
export function renderFinalRecipe(container, data) {
    const hasAdditives = data.recipeAdditives.length > 0;

    container.innerHTML = `
        <div class="recipe-prose">
            ${buildQualitativeSummary(data.properties, data.notes)}
            ${buildIngredientsList(data)}
            ${buildProcedureList(hasAdditives)}
            <div class="recipe-details-row">
                ${buildRecipeSummary(data)}
                ${buildFattyAcidProfile(data.fattyAcids)}
            </div>
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
