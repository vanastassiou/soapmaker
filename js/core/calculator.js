/**
 * Pure calculation functions for soapmaking
 * No DOM dependencies - can be unit tested independently
 */

import {
    CALCULATION,
    FATTY_ACID_KEYS,
    initFattyAcids,
    NOTE_ICONS,
    NOTE_THRESHOLDS,
    NOTE_TYPES,
    PROPERTY_RANGES,
    SPECIAL_FATS,
    VOLUME
} from '../lib/constants.js';

// ============================================
// Core Calculations
// ============================================

/**
 * Calculate lye amount needed for saponification
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with SAP values
 * @param {string} lyeType - 'NaOH' or 'KOH'
 * @param {number} superfat - Superfat percentage (0-20)
 * @returns {number} Lye amount in same units as fat weights
 */
export function calculateLye(recipe, fatsDatabase, lyeType, superfat) {
    const sapKey = lyeType === 'NaOH' ? 'naoh' : 'koh';
    const totalLye = recipe.reduce((sum, r) => {
        const sap = fatsDatabase[r.id]?.sap?.[sapKey] ?? 0;
        return sum + r.weight * sap;
    }, 0);
    return totalLye * (1 - superfat / 100);
}

/**
 * Calculate water amount based on lye and water ratio
 * @param {number} lyeAmount - Amount of lye
 * @param {number} waterRatio - Water to lye ratio (e.g., 2 for 2:1)
 * @returns {number} Water amount
 */
export function calculateWater(lyeAmount, waterRatio) {
    return lyeAmount * waterRatio;
}

/**
 * Core fatty acid calculation - calculates weighted fatty acid profile
 * @param {Array} recipe - Array of {id, value} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @param {string} valueKey - Property name for the value ('weight' or 'percentage')
 * @returns {Object} Weighted fatty acid percentages
 */
function calculateFattyAcidsCore(recipe, fatsDatabase, valueKey) {
    const fa = initFattyAcids();
    const total = recipe.reduce((sum, item) => sum + item[valueKey], 0);
    if (total === 0) return fa;

    return recipe.reduce((acc, r) => {
        const fat = fatsDatabase[r.id];
        if (fat) {
            const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
            const fraction = r[valueKey] / total;
            FATTY_ACID_KEYS.forEach(acid => {
                acc[acid] += (fattyAcids?.[acid] ?? 0) * fraction;
            });
        }
        return acc;
    }, fa);
}

/**
 * Calculate fatty acid profile for a recipe using weights
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @returns {Object} Weighted fatty acid percentages
 */
export function calculateFattyAcids(recipe, fatsDatabase) {
    return calculateFattyAcidsCore(recipe, fatsDatabase, 'weight');
}

/**
 * Calculate fatty acid profile for a recipe using percentages
 * @param {Array} recipe - Array of {id, percentage} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @returns {Object} Weighted fatty acid percentages
 */
export function calculateFattyAcidsFromPercentages(recipe, fatsDatabase) {
    return calculateFattyAcidsCore(recipe, fatsDatabase, 'percentage');
}

/**
 * Calculate weighted average of a fat property across a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat database
 * @param {string} property - Property name to average (e.g., 'iodine', 'ins')
 * @returns {number} Weighted average value
 */
function calculateWeightedAverage(recipe, fatsDatabase, property) {
    const totalFats = recipe.reduce((sum, r) => sum + r.weight, 0);
    if (totalFats === 0) return 0;

    return recipe.reduce((sum, r) => {
        const fat = fatsDatabase[r.id];
        return sum + (fat?.[property] ?? 0) * (r.weight / totalFats);
    }, 0);
}

/**
 * Calculate iodine value for a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with iodine values
 * @returns {number} Weighted iodine value
 */
export function calculateIodine(recipe, fatsDatabase) {
    return calculateWeightedAverage(recipe, fatsDatabase, 'iodine');
}

/**
 * Calculate INS value for a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with INS values
 * @returns {number} Weighted INS value
 */
export function calculateINS(recipe, fatsDatabase) {
    return calculateWeightedAverage(recipe, fatsDatabase, 'ins');
}

/**
 * Calculate soap properties from fatty acid profile
 * @param {Object} fa - Fatty acid profile
 * @returns {Object} Soap properties (hardness, degreasing, etc.)
 */
export function calculateProperties(fa) {
    return {
        hardness: (fa.caprylic || 0) + (fa.capric || 0) + fa.lauric + fa.myristic + fa.palmitic + fa.stearic + (fa.arachidic || 0) + (fa.behenic || 0),
        degreasing: (fa.caprylic || 0) + (fa.capric || 0) + fa.lauric + fa.myristic,
        moisturizing: (fa.palmitoleic || 0) + fa.oleic + fa.ricinoleic + fa.linoleic + fa.linolenic + (fa.erucic || 0),
        'lather-volume': fa.lauric + fa.myristic + fa.ricinoleic,
        'lather-density': fa.palmitic + fa.stearic + fa.ricinoleic
    };
}

// ============================================
// Fat Property Description Generation
// ============================================

const LEVEL_TO_NUM = {
    'very low': 1,
    'low': 2,
    'moderate': 3,
    'high': 4,
    'very high': 5
};

const NUM_TO_LEVEL = ['', 'very low', 'low', 'moderate', 'high', 'very high'];

/**
 * Get structured soap properties for a fat
 * @param {Object} fat - Fat object with fattyAcids percentages
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @returns {{hardness: string, degreasing: string, lather: string, moisturizing: string}|null}
 */
export function getFatSoapProperties(fat, fattyAcidsData) {
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
    if (!fattyAcids) return null;

    // Get fatty acids above the dominant threshold
    const dominant = Object.entries(fattyAcids)
        .filter(([_, pct]) => pct >= CALCULATION.DOMINANT_FATTY_ACID_THRESHOLD)
        .sort((a, b) => b[1] - a[1]);

    if (dominant.length === 0) return null;

    // Calculate weighted properties
    let totalWeight = 0;
    let weightedHardness = 0;
    let weightedDegreasing = 0;
    let weightedMoisturizing = 0;
    const latherDescriptions = [];

    dominant.forEach(([acidKey, pct]) => {
        const acidData = fattyAcidsData[acidKey];
        if (!acidData?.soapProperties) return;

        const props = acidData.soapProperties;
        totalWeight += pct;

        // Convert qualitative to numeric and weight
        const hardnessNum = LEVEL_TO_NUM[props.hardness] || 3;
        const degreasingNum = LEVEL_TO_NUM[props.degreasing] || 3;
        const moisturizingNum = LEVEL_TO_NUM[props.moisturizing] || 3;

        weightedHardness += hardnessNum * pct;
        weightedDegreasing += degreasingNum * pct;
        weightedMoisturizing += moisturizingNum * pct;

        if (props.lather && !latherDescriptions.includes(props.lather)) {
            latherDescriptions.push(props.lather);
        }
    });

    if (totalWeight === 0) return null;

    // Calculate averages and convert back to levels
    const avgHardness = Math.round(weightedHardness / totalWeight);
    const avgDegreasing = Math.round(weightedDegreasing / totalWeight);
    const avgMoisturizing = Math.round(weightedMoisturizing / totalWeight);

    return {
        hardness: NUM_TO_LEVEL[avgHardness] || 'moderate',
        degreasing: NUM_TO_LEVEL[avgDegreasing] || 'moderate',
        lather: latherDescriptions[0] || 'moderate',
        moisturizing: NUM_TO_LEVEL[avgMoisturizing] || 'moderate'
    };
}

/**
 * Generate qualitative soap properties description for a fat
 * @param {Object} fat - Fat object with fattyAcids percentages
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @returns {string} Prose description of soap properties
 */
export function generateFatProperties(fat, fattyAcidsData) {
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
    if (!fattyAcids) return '';

    // Get fatty acids above the dominant threshold
    const dominant = Object.entries(fattyAcids)
        .filter(([_, pct]) => pct >= CALCULATION.DOMINANT_FATTY_ACID_THRESHOLD)
        .sort((a, b) => b[1] - a[1]);

    if (dominant.length === 0) return 'Minimal fatty acid contribution.';

    // Calculate weighted properties
    let totalWeight = 0;
    let weightedHardness = 0;
    let weightedDegreasing = 0;
    let weightedMoisturizing = 0;
    const latherDescriptions = [];

    dominant.forEach(([acidKey, pct]) => {
        const acidData = fattyAcidsData[acidKey];
        if (!acidData?.soapProperties) return;

        const props = acidData.soapProperties;
        totalWeight += pct;

        // Convert qualitative to numeric and weight
        const hardnessNum = LEVEL_TO_NUM[props.hardness] || 3;
        const degreasingNum = LEVEL_TO_NUM[props.degreasing] || 3;
        const moisturizingNum = LEVEL_TO_NUM[props.moisturizing] || 3;

        weightedHardness += hardnessNum * pct;
        weightedDegreasing += degreasingNum * pct;
        weightedMoisturizing += moisturizingNum * pct;

        // Collect unique lather descriptions
        if (props.lather && !latherDescriptions.includes(props.lather)) {
            latherDescriptions.push(props.lather);
        }
    });

    if (totalWeight === 0) return 'Minimal fatty acid contribution.';

    // Calculate averages and convert back to levels
    const avgHardness = Math.round(weightedHardness / totalWeight);
    const avgDegreasing = Math.round(weightedDegreasing / totalWeight);
    const avgMoisturizing = Math.round(weightedMoisturizing / totalWeight);

    const hardnessLevel = NUM_TO_LEVEL[avgHardness] || 'moderate';
    const degreasingLevel = NUM_TO_LEVEL[avgDegreasing] || 'moderate';
    const moisturizingLevel = NUM_TO_LEVEL[avgMoisturizing] || 'moderate';

    // Build prose description
    const parts = [];

    // Combine similar levels
    if (hardnessLevel === degreasingLevel) {
        parts.push(`${hardnessLevel} hardness and degreasing.`);
    } else {
        parts.push(`${hardnessLevel} hardness. ${degreasingLevel} degreasing.`);
    }

    // Add lather description (pick most descriptive from dominant acids)
    if (latherDescriptions.length > 0) {
        const lather = latherDescriptions[0];
        parts.push(lather + ' lather.');
    }

    parts.push(`${moisturizingLevel} moisturizing.`);

    return parts.join(' ');
}

// ============================================
// Volume Calculation
// ============================================

/**
 * Calculate estimated volume range of soap batch
 * @param {Array} recipe - [{id, weight}, ...]
 * @param {Object} fatsDatabase - Fat data with density values
 * @param {number} lyeAmount - Lye weight (same unit as fat weights)
 * @param {number} waterAmount - Water weight (same unit as fat weights)
 * @param {string} unit - 'g' or 'oz'
 * @returns {{min: number, max: number}} Volume range in mL or fl oz
 */
export function calculateVolume(recipe, fatsDatabase, lyeAmount, waterAmount, unit) {
    const totalFatWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    if (totalFatWeight === 0) return { min: 0, max: 0 };

    // Convert to grams if needed (density is g/mL)
    const isImperial = unit === 'imperial';
    const fatWeightG = isImperial ? totalFatWeight * VOLUME.G_PER_OZ : totalFatWeight;
    const lyeWeightG = isImperial ? lyeAmount * VOLUME.G_PER_OZ : lyeAmount;
    const waterWeightG = isImperial ? waterAmount * VOLUME.G_PER_OZ : waterAmount;

    // Calculate weighted average fat density
    const avgFatDensity = recipe.reduce((sum, fat) => {
        const data = fatsDatabase[fat.id];
        const density = data?.density || VOLUME.DEFAULT_FAT_DENSITY;
        return sum + (fat.weight / totalFatWeight) * density;
    }, 0);

    // Volume components in mL
    const fatVolumeML = fatWeightG / avgFatDensity;
    const waterVolumeML = waterWeightG / VOLUME.WATER_DENSITY;
    const lyeVolumeML = lyeWeightG / VOLUME.NAOH_DENSITY;

    // Base volume with saponification reduction
    const baseVolumeML = (fatVolumeML + waterVolumeML + lyeVolumeML) * VOLUME.SAPONIFICATION_REDUCTION;

    // Apply uncertainty range
    const minML = Math.round(baseVolumeML * VOLUME.UNCERTAINTY_MIN);
    const maxML = Math.round(baseVolumeML * VOLUME.UNCERTAINTY_MAX);

    // Convert to fl oz if user is in imperial mode
    if (isImperial) {
        return {
            min: Math.round(minML / VOLUME.ML_PER_FLOZ),
            max: Math.round(maxML / VOLUME.ML_PER_FLOZ)
        };
    }

    return { min: minML, max: maxML };
}

// ============================================
// Recipe Notes
// ============================================

/**
 * Check hardness and generate note if needed
 */
function checkHardness(properties) {
    const R = PROPERTY_RANGES;

    if (properties.hardness < R.hardness.min) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.SOFT_BAR,
            text: `Soft bar (hardness ${properties.hardness.toFixed(0)}): may need 48-72hrs to unmould. Sodium lactate or salt can help speed this up.`
        };
    }
    if (properties.hardness > R.hardness.max) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.HARD_BAR,
            text: `Very hard bar (hardness ${properties.hardness.toFixed(0)}): may be brittle or waxy. Cut promptly after unmoulding to avoid cracking.`
        };
    }
    return null;
}

/**
 * Check degreasing and generate note if needed
 */
function checkDegreasing(properties) {
    const T = NOTE_THRESHOLDS;

    if (properties.degreasing > T.HIGH_DEGREASING) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.HIGH_CLEANSING,
            text: `High degreasing (${properties.degreasing.toFixed(0)}): excellent for kitchen/utility soap. May strip skin if used daily on face or sensitive areas.`
        };
    }
    if (properties.degreasing < T.LOW_DEGREASING) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.LOW_CLEANSING,
            text: `Low degreasing (${properties.degreasing.toFixed(0)}): very gentle, good for sensitive skin. Some users may feel it doesn't "clean" enough.`
        };
    }
    return null;
}

/**
 * Check shelf stability (polyunsaturated fatty acids)
 */
function checkShelfStability(_properties, fa) {
    const T = NOTE_THRESHOLDS;
    const polyunsaturated = fa.linoleic + fa.linolenic;

    if (polyunsaturated > T.HIGH_POLYUNSATURATED) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.SHELF_STABILITY,
            text: `High polyunsaturates (${polyunsaturated.toFixed(0)}%): prone to DOS (rancidity). Add antioxidant (ROE/Vitamin E), cure in cool dark place, use within 8-12 months.`
        };
    }
    return null;
}

/**
 * Check linolenic acid level
 */
function checkLinolenic(_properties, fa) {
    const T = NOTE_THRESHOLDS;

    if (fa.linolenic > T.HIGH_LINOLENIC) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.LINOLENIC,
            text: `High linolenic acid (${fa.linolenic.toFixed(0)}%): very unstable. Consider reducing high-linolenic fats (hemp, flax) to under 5% of recipe.`
        };
    }
    return null;
}

/**
 * Check lather properties
 */
function checkLather(properties) {
    const R = PROPERTY_RANGES;

    if (properties['lather-volume'] < R['lather-volume'].min && properties['lather-density'] < 20) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.LOW_LATHER,
            text: 'Low lather recipe: consider adding coconut oil (bubbles) or castor oil (lather stability) if more lather is desired.'
        };
    }
    return null;
}

/**
 * Check moisturizing vs hardness balance
 */
function checkMoisturizingBalance(properties) {
    const T = NOTE_THRESHOLDS;

    if (properties.moisturizing > T.HIGH_MOISTURIZING && properties.hardness < T.LOW_HARDNESS) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.CONDITIONING_BALANCE,
            text: 'Highly moisturizing but soft: luxurious feel but bar may not last long in shower. Consider adding palm or tallow for balance.'
        };
    }
    return null;
}

/**
 * Check for castor oil opportunity
 */
function checkCastorOpportunity(properties, _fa, recipe) {
    const T = NOTE_THRESHOLDS;
    const hasCastor = recipe.some(r => r.id === SPECIAL_FATS.CASTOR);

    if (!hasCastor && properties['lather-volume'] < T.LOW_LATHER_VOLUME) {
        return {
            type: NOTE_TYPES.SUCCESS,
            icon: NOTE_ICONS.TIP,
            text: 'Tip: Adding 3-5% castor oil can significantly boost lather stability without affecting other properties much.'
        };
    }
    return null;
}

/**
 * Check if recipe is well-balanced
 */
function checkGoodBalance(properties, fa) {
    const R = PROPERTY_RANGES;
    const T = NOTE_THRESHOLDS;
    const polyunsaturated = fa.linoleic + fa.linolenic;

    const inRange = (prop) => properties[prop] >= R[prop].min && properties[prop] <= R[prop].max;

    if (inRange('hardness') && inRange('degreasing') && inRange('moisturizing') &&
        polyunsaturated <= T.HIGH_POLYUNSATURATED) {
        return {
            type: NOTE_TYPES.SUCCESS,
            icon: NOTE_ICONS.GOOD,
            text: 'Well-balanced recipe: good hardness, degreasing, and moisturizing within recommended ranges.'
        };
    }
    return null;
}

/**
 * Generate recipe notes/warnings based on properties
 * @param {Object} properties - Calculated properties
 * @param {Object} fa - Fatty acid profile
 * @param {Array} recipe - Recipe array
 * @returns {Array} Array of note objects {type, icon, text}
 */
export function getRecipeNotes(properties, fa, recipe) {
    if (recipe.length === 0) return [];

    const noteGenerators = [
        checkHardness,
        checkDegreasing,
        checkShelfStability,
        checkLinolenic,
        checkLather,
        checkMoisturizingBalance,
        checkCastorOpportunity,
        checkGoodBalance
    ];

    return noteGenerators
        .map(gen => gen(properties, fa, recipe))
        .filter(note => note !== null);
}

// ============================================
// Additive Calculations
// ============================================

/**
 * Calculate additive amount based on fat weight
 * @param {Object} additive - Additive data from database
 * @param {number} usagePercent - User-specified usage percentage
 * @param {number} totalFatWeight - Total weight of fats in recipe
 * @param {string} unit - 'g' or 'oz'
 * @returns {number} Calculated weight in specified unit
 */
export function calculateAdditiveAmount(additive, usagePercent, totalFatWeight, unit) {
    if (!additive || totalFatWeight <= 0) return 0;

    // Currently all additives use fat-weight basis
    // If batch-weight is needed, extend logic here
    if (additive.usage.basis === 'oil-weight') {
        return totalFatWeight * (usagePercent / 100);
    }

    return 0;
}

/**
 * Check if additive usage exceeds safety limits
 * @param {Object} additive - Additive data
 * @param {number} usagePercent - User-specified usage percentage
 * @returns {Array} Array of warning objects {type, message}
 */
export function checkAdditiveWarnings(additive, usagePercent) {
    const warnings = [];

    if (!additive || !additive.safety) return warnings;

    // Check against max safe concentration
    if (additive.safety.maxConcentration && usagePercent > additive.safety.maxConcentration) {
        warnings.push({
            type: 'danger',
            message: `Exceeds maximum safe concentration (${additive.safety.maxConcentration}%)`
        });
    }

    // Check IFRA limit for essential oils
    if (additive.safety.ifraCategory9Limit && usagePercent > additive.safety.ifraCategory9Limit) {
        warnings.push({
            type: 'warning',
            message: `Exceeds IFRA Category 9 limit (${additive.safety.ifraCategory9Limit}%)`
        });
    }

    // Check against recommended max (info only)
    if (usagePercent > additive.usage.max) {
        warnings.push({
            type: 'info',
            message: `Above recommended maximum (${additive.usage.max}%)`
        });
    }

    return warnings;
}

/**
 * Calculate total additives weight and breakdown
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives data
 * @param {number} totalFatWeight - Total fat weight
 * @param {string} unit - 'g' or 'oz'
 * @returns {{totalWeight: number, breakdown: Array}}
 */
export function calculateAdditivesTotal(recipeAdditives, additivesDatabase, totalFatWeight, unit) {
    const breakdown = recipeAdditives.map(item => {
        const additive = additivesDatabase[item.id];
        if (!additive) return null;

        const usagePercent = totalFatWeight > 0 ? (item.weight / totalFatWeight) * 100 : 0;
        return {
            id: item.id,
            name: additive.name,
            category: additive.category,
            usagePercent,
            weight: item.weight,
            warnings: checkAdditiveWarnings(additive, usagePercent)
        };
    }).filter(Boolean);

    const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
    return { totalWeight, breakdown };
}

/**
 * Calculate additive volume contribution
 * @param {Array} recipeAdditives - Additives in recipe {id, weight}
 * @param {Object} additivesDatabase - Database
 * @param {number} totalFatWeight - Total fat weight (unused, kept for API compatibility)
 * @param {string} unit - 'metric' or 'imperial'
 * @returns {number} Volume in mL
 */
export function calculateAdditiveVolume(recipeAdditives, additivesDatabase, totalFatWeight, unit) {
    const conversionFactor = unit === 'imperial' ? VOLUME.G_PER_OZ : 1;
    return recipeAdditives.reduce((sum, item) => {
        const density = additivesDatabase[item.id]?.density ?? 1.0;
        return sum + (item.weight * conversionFactor) / density;
    }, 0);
}
