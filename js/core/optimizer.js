/**
 * Recipe optimization algorithms
 * Finds optimal fat combinations to match target fatty acid profiles
 *
 * Algorithm notes:
 * - Uses iterative gradient descent with O(n²) pair comparisons per iteration
 * - Convergence: stops at 100 iterations or error < 0.01
 * - Not globally optimal, but produces good practical results
 */

import {
    PROFILE,
    PROPERTY_CONVERSION,
    isValidTarget,
    allPropertiesInRange
} from '../lib/constants.js';

import { calculateProperties, calculateFattyAcidsFromPercentages } from './calculator.js';

// ============================================
// Dietary Filtering
// ============================================

/**
 * Filter fats based on dietary requirements
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} dietaryFilters - {vegan, kosher, halal, ethical}
 * @returns {Set} Set of fat IDs that should be excluded
 */
export function getDietaryExclusions(fatsDatabase, dietaryFilters = {}) {
    const exclusions = new Set();

    if (!dietaryFilters.animalBased && !dietaryFilters.ethicalConcerns) {
        return exclusions;
    }

    for (const [id, fat] of Object.entries(fatsDatabase)) {
        const dietary = fat.dietary || {};

        // Exclude fats that match the filter criteria
        if (dietaryFilters.animalBased && dietary.animalBased === true) {
            exclusions.add(id);
        } else if (dietaryFilters.ethicalConcerns && dietary.ethicalConcerns === true) {
            exclusions.add(id);
        }
    }

    return exclusions;
}

// ============================================
// Error & Scoring Functions
// ============================================

/**
 * Calculate error between current and target fatty acid profiles
 * Uses sum of squared differences for specified targets only
 * @param {Object} current - Current fatty acid profile
 * @param {Object} target - Target fatty acid percentages (only specified keys are compared)
 * @returns {number} Sum of squared differences
 */
export function calculateProfileError(current, target) {
    let error = 0;
    for (const acid of Object.keys(target)) {
        if (isValidTarget(target[acid])) {
            const targetVal = parseFloat(target[acid]);
            const currentVal = current[acid] || 0;
            error += Math.pow(targetVal - currentVal, 2);
        }
    }
    return error;
}

/**
 * Score a fat by how well it can help achieve target profile
 * Higher score = more helpful
 * @param {Object} fat - Fat data
 * @param {Object} targetProfile - Target fatty acid percentages
 * @param {Object} currentProfile - Current achieved profile (can be empty)
 * @returns {number} Score (higher is better)
 */
function scoreFatForTarget(fat, targetProfile, currentProfile = {}) {
    let score = 0;

    for (const acid of Object.keys(targetProfile)) {
        if (!isValidTarget(targetProfile[acid])) continue;

        const targetVal = parseFloat(targetProfile[acid]);
        const currentVal = currentProfile[acid] || 0;
        const fatVal = fat.fattyAcids[acid] || 0;
        const deficit = targetVal - currentVal;

        // Fat is helpful if it provides what we need more of
        if (deficit > 0 && fatVal > 0) {
            score += Math.min(deficit, fatVal); // Credit for filling the gap
        } else if (deficit < 0 && fatVal < targetVal) {
            score += 5; // Small bonus for not making it worse
        } else if (deficit < 0 && fatVal > targetVal) {
            score -= fatVal - targetVal; // Penalty for overshooting
        }
    }

    return score;
}

// ============================================
// Optimization Algorithm
// ============================================

/**
 * Optimize weights for selected fats to minimize profile error
 * Uses iterative adjustment to find optimal percentages
 *
 * Complexity: O(iterations * n²) where n = number of fats
 *
 * @param {Array} selectedFats - Array of fat ids (kebab-case keys)
 * @param {Object} targetProfile - Target fatty acid percentages
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} constraints - {minFatPercent, maxFatPercent}
 * @returns {Array} Array of {id, percentage} with optimized percentages
 */
export function optimizeWeights(selectedFats, targetProfile, fatsDatabase, constraints = {}) {
    const minPercent = constraints.minFatPercent || PROFILE.MIN_FAT_PERCENT;
    const maxPercent = constraints.maxFatPercent || PROFILE.MAX_FAT_PERCENT;
    const numFats = selectedFats.length;

    if (numFats === 0) return [];
    if (numFats === 1) return [{ id: selectedFats[0], percentage: 100 }];

    // Start with equal distribution
    let recipe = selectedFats.map(id => ({
        id,
        percentage: 100 / numFats
    }));

    // Iterative optimization (gradient descent)
    const stepSize = PROFILE.OPTIMIZER_STEP_SIZE;
    const iterations = PROFILE.OPTIMIZER_ITERATIONS;

    for (let iter = 0; iter < iterations; iter++) {
        const currentFA = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const currentError = calculateProfileError(currentFA, targetProfile);

        if (currentError < PROFILE.CONVERGENCE_THRESHOLD) break;

        // Try adjusting each pair of fats
        let bestRecipe = recipe;
        let bestError = currentError;

        for (let i = 0; i < numFats; i++) {
            for (let j = i + 1; j < numFats; j++) {
                // Try both directions: increase i/decrease j, and vice versa
                const candidates = [
                    createTestRecipe(recipe, i, j, stepSize, minPercent, maxPercent),
                    createTestRecipe(recipe, j, i, stepSize, minPercent, maxPercent)
                ];

                for (const testRecipe of candidates) {
                    const error = calculateProfileError(
                        calculateFattyAcidsFromPercentages(testRecipe, fatsDatabase),
                        targetProfile
                    );

                    if (error < bestError) {
                        bestError = error;
                        bestRecipe = testRecipe;
                    }
                }
            }
        }

        if (bestError >= currentError) break; // No improvement possible
        recipe = bestRecipe;
    }

    // Enforce constraints and normalize
    return normalizeRecipe(recipe, minPercent, maxPercent);
}

/**
 * Create a test recipe with one fat increased and another decreased
 * @param {Array} recipe - Current recipe
 * @param {number} increaseIdx - Index to increase
 * @param {number} decreaseIdx - Index to decrease
 * @param {number} stepSize - Amount to adjust
 * @param {number} minPercent - Minimum percentage
 * @param {number} maxPercent - Maximum percentage
 * @returns {Array} New test recipe
 */
function createTestRecipe(recipe, increaseIdx, decreaseIdx, stepSize, minPercent, maxPercent) {
    const testRecipe = recipe.map((r, idx) => {
        if (idx === increaseIdx) {
            return { ...r, percentage: Math.min(maxPercent, r.percentage + stepSize) };
        }
        if (idx === decreaseIdx) {
            return { ...r, percentage: Math.max(minPercent, r.percentage - stepSize) };
        }
        return { ...r };
    });

    // Normalize to 100%
    const total = testRecipe.reduce((s, r) => s + r.percentage, 0);
    testRecipe.forEach(r => r.percentage = r.percentage / total * 100);

    return testRecipe;
}

/**
 * Normalize recipe percentages to sum to 100%
 * @param {Array} recipe - Recipe to normalize
 * @param {number} minPercent - Minimum percentage
 * @param {number} maxPercent - Maximum percentage
 * @returns {Array} Normalized recipe
 */
function normalizeRecipe(recipe, minPercent, maxPercent) {
    // Enforce constraints
    let result = recipe.map(r => ({
        ...r,
        percentage: Math.max(minPercent, Math.min(maxPercent, r.percentage))
    }));

    // Normalize to 100%
    const total = result.reduce((s, r) => s + r.percentage, 0);
    result.forEach(r => r.percentage = Math.round(r.percentage / total * 100));

    // Fix rounding errors
    const roundedTotal = result.reduce((s, r) => s + r.percentage, 0);
    if (roundedTotal !== 100) {
        const maxIdx = result.reduce((maxI, r, i, arr) =>
            r.percentage > arr[maxI].percentage ? i : maxI, 0);
        result[maxIdx].percentage += (100 - roundedTotal);
    }

    return result;
}

// ============================================
// Profile Matching
// ============================================

/**
 * Find fats that best match target fatty acid profile
 * @param {Object} targetProfile - {oleic: 50, palmitic: 20, ...} - target percentages
 * @param {Object} fatsDatabase - All available fats
 * @param {Object} options - {maxFats, excludeFats, requireFats, minFatPercent, maxFatPercent}
 * @returns {Object} {recipe, achieved, achievedProperties, error, matchQuality}
 */
export function findFatsForProfile(targetProfile, fatsDatabase, options = {}) {
    const maxFats = options.maxFats || PROFILE.DEFAULT_MAX_FATS;
    const excludeFats = new Set(options.excludeFats || []);
    const requireFats = options.requireFats || [];
    const minFatPercent = options.minFatPercent || PROFILE.MIN_FAT_PERCENT;
    const maxFatPercent = options.maxFatPercent || PROFILE.MAX_FAT_PERCENT;

    // Get available fats (filter out excluded)
    const availableFats = Object.entries(fatsDatabase)
        .filter(([id]) => !excludeFats.has(id))
        .map(([id, data]) => ({ id, ...data }));

    // Start with required fats
    let selectedFatIds = [...requireFats];

    // Score and rank remaining fats
    const scoredFats = availableFats
        .filter(fat => !selectedFatIds.includes(fat.id))
        .map(fat => ({
            ...fat,
            score: scoreFatForTarget(fat, targetProfile, {})
        }))
        .sort((a, b) => b.score - a.score);

    // Greedy selection: add fats that best improve the profile
    while (selectedFatIds.length < maxFats && scoredFats.length > 0) {
        const currentRecipe = selectedFatIds.map(id => ({
            id,
            percentage: 100 / selectedFatIds.length
        }));
        const currentProfile = selectedFatIds.length > 0
            ? calculateFattyAcidsFromPercentages(currentRecipe, fatsDatabase)
            : {};

        // Find next best fat to add
        let bestFat = null;
        let bestImprovement = -Infinity;

        for (const fat of scoredFats) {
            if (selectedFatIds.includes(fat.id)) continue;

            const testIds = [...selectedFatIds, fat.id];
            const testRecipe = optimizeWeights(testIds, targetProfile, fatsDatabase, {
                minFatPercent,
                maxFatPercent
            });
            const testProfile = calculateFattyAcidsFromPercentages(testRecipe, fatsDatabase);
            const testError = calculateProfileError(testProfile, targetProfile);

            const currentError = selectedFatIds.length > 0
                ? calculateProfileError(currentProfile, targetProfile)
                : Infinity;

            const improvement = currentError - testError;

            if (improvement > bestImprovement) {
                bestImprovement = improvement;
                bestFat = fat;
            }
        }

        // Only add if it actually improves
        if (bestFat && bestImprovement > 0) {
            selectedFatIds.push(bestFat.id);
            const idx = scoredFats.findIndex(o => o.id === bestFat.id);
            if (idx !== -1) scoredFats.splice(idx, 1);
        } else {
            break;
        }
    }

    // Optimize final weights
    const finalRecipe = optimizeWeights(selectedFatIds, targetProfile, fatsDatabase, {
        minFatPercent,
        maxFatPercent
    });
    const achievedProfile = calculateFattyAcidsFromPercentages(finalRecipe, fatsDatabase);
    const finalError = calculateProfileError(achievedProfile, targetProfile);

    // Calculate match quality (0-100%)
    const matchQuality = calculateMatchQuality(achievedProfile, targetProfile);

    return {
        recipe: finalRecipe,
        achieved: achievedProfile,
        achievedProperties: calculateProperties(achievedProfile),
        error: finalError,
        matchQuality
    };
}

/**
 * Calculate match quality as percentage
 * @param {Object} achieved - Achieved fatty acid profile
 * @param {Object} target - Target profile
 * @returns {number} Match quality 0-100
 */
function calculateMatchQuality(achieved, target) {
    let totalTargets = 0;
    let totalDeviation = 0;

    for (const acid of Object.keys(target)) {
        if (isValidTarget(target[acid])) {
            const targetVal = parseFloat(target[acid]);
            const achievedVal = achieved[acid] || 0;
            totalTargets++;
            totalDeviation += Math.abs(targetVal - achievedVal);
        }
    }

    // 100% if deviation is 0, decreases with deviation
    const avgDeviation = totalTargets > 0 ? totalDeviation / totalTargets : 0;
    return Math.max(0, Math.min(100, Math.round(100 - avgDeviation * PROFILE.MATCH_QUALITY_FACTOR)));
}

// ============================================
// Property-to-Fatty-Acid Conversion
// ============================================

/**
 * Convert property targets to approximate fatty acid targets
 * This is an inverse of calculateProperties() with assumptions
 * @param {Object} propertyTargets - {hardness: 40, cleansing: 18, ...}
 * @returns {Object} Approximate fatty acid targets
 */
export function propertiesToFattyAcidTargets(propertyTargets) {
    const targets = {};
    const C = PROPERTY_CONVERSION;

    // Cleansing = lauric + myristic
    if (isValidTarget(propertyTargets.cleansing)) {
        const cleansing = parseFloat(propertyTargets.cleansing);
        targets.lauric = Math.round(cleansing * C.CLEANSING_LAURIC_RATIO);
        targets.myristic = Math.round(cleansing * C.CLEANSING_MYRISTIC_RATIO);
    }

    // Hardness = lauric + myristic + palmitic + stearic
    if (isValidTarget(propertyTargets.hardness)) {
        const hardness = parseFloat(propertyTargets.hardness);
        const lauricMyristic = (targets.lauric || 0) + (targets.myristic || 0);
        const remaining = hardness - lauricMyristic;
        if (remaining > 0) {
            targets.palmitic = Math.round(remaining * C.HARDNESS_PALMITIC_RATIO);
            targets.stearic = Math.round(remaining * C.HARDNESS_STEARIC_RATIO);
        }
    }

    // Conditioning = oleic + ricinoleic + linoleic + linolenic
    if (isValidTarget(propertyTargets.conditioning)) {
        const conditioning = parseFloat(propertyTargets.conditioning);
        targets.oleic = Math.round(conditioning * C.CONDITIONING_OLEIC_RATIO);
        if (!targets.ricinoleic) {
            targets.ricinoleic = Math.round(conditioning * C.CONDITIONING_RICINOLEIC_RATIO);
        }
        targets.linoleic = Math.round(conditioning * C.CONDITIONING_LINOLEIC_RATIO);
        targets.linolenic = Math.round(conditioning * C.CONDITIONING_LINOLENIC_RATIO);
    }

    // Bubbly = lauric + myristic + ricinoleic
    if (isValidTarget(propertyTargets.bubbly)) {
        const bubbly = parseFloat(propertyTargets.bubbly);
        const lauricMyristic = (targets.lauric || 0) + (targets.myristic || 0);
        const ricinoleicNeeded = bubbly - lauricMyristic;
        if (ricinoleicNeeded > 0) {
            targets.ricinoleic = Math.round(ricinoleicNeeded);
        }
    }

    // Creamy = palmitic + stearic + ricinoleic
    if (isValidTarget(propertyTargets.creamy)) {
        const creamy = parseFloat(propertyTargets.creamy);
        const ricinoleic = targets.ricinoleic || 0;
        const remaining = creamy - ricinoleic;
        if (remaining > 0 && !targets.palmitic && !targets.stearic) {
            targets.palmitic = Math.round(remaining * C.HARDNESS_PALMITIC_RATIO);
            targets.stearic = Math.round(remaining * C.HARDNESS_STEARIC_RATIO);
        }
    }

    return targets;
}

/**
 * Validate property targets for logical consistency
 * @param {Object} targets - Property targets
 * @returns {string|null} Error message or null if valid
 */
export function validatePropertyTargets(targets) {
    const { hardness, cleansing, conditioning, bubbly, creamy } = targets;

    // Hardness + conditioning should be ~100
    if (hardness !== undefined && conditioning !== undefined) {
        const sum = hardness + conditioning;
        if (sum < 85 || sum > 115) {
            return `Hardness + Conditioning should be around 100 (you entered ${sum}). These represent saturated + unsaturated fatty acids.`;
        }
    }

    // Cleansing <= Hardness
    if (cleansing !== undefined && hardness !== undefined && cleansing > hardness) {
        return `Cleansing (${cleansing}) cannot exceed Hardness (${hardness}). Cleansing is a subset of the fatty acids that contribute to hardness.`;
    }

    // Bubbly >= Cleansing
    if (bubbly !== undefined && cleansing !== undefined && bubbly < cleansing) {
        return `Bubbly (${bubbly}) should be at least Cleansing (${cleansing}). Bubbly = Cleansing + ricinoleic.`;
    }

    return null;
}

// ============================================
// YOLO Recipe Generator
// ============================================

/**
 * Generate a random recipe with properties in acceptable ranges
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} options - {excludeFats, minFats, maxFats, maxAttempts}
 * @returns {Object|null} {recipe, properties} or null if no valid recipe found
 */
export function generateRandomRecipe(fatsDatabase, options = {}) {
    const excludeFats = new Set(options.excludeFats || []);
    const lockedFats = options.lockedFats || []; // Array of {id, percentage}
    const minFats = options.minFats || 3;
    const maxFats = options.maxFats || 5;
    const maxAttempts = options.maxAttempts || 50;

    // Calculate remaining percentage after locked fats
    const lockedTotal = lockedFats.reduce((sum, f) => sum + f.percentage, 0);
    const remainingPercent = 100 - lockedTotal;

    // If locked fats take all percentage, just return them
    if (remainingPercent <= 0 && lockedFats.length > 0) {
        const recipe = [...lockedFats];
        const fattyAcids = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const properties = calculateProperties(fattyAcids);
        return { recipe, fattyAcids, properties };
    }

    // Get available fats (exclude locked fat IDs too)
    const lockedIds = new Set(lockedFats.map(f => f.id));
    const availableFats = Object.keys(fatsDatabase).filter(id =>
        !excludeFats.has(id) && !lockedIds.has(id)
    );

    const neededFats = Math.max(0, minFats - lockedFats.length);
    if (availableFats.length < neededFats) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Random number of new fats to add
        const numNewFats = Math.max(neededFats,
            Math.floor(Math.random() * (maxFats - lockedFats.length + 1)));

        // Shuffle and pick random fats
        const shuffled = [...availableFats].sort(() => Math.random() - 0.5);
        const selectedFats = shuffled.slice(0, Math.min(numNewFats, shuffled.length));

        // Generate random percentages for new fats (scaled to remaining percent)
        const newFatRecipe = generateRandomPercentagesScaled(selectedFats, remainingPercent);

        // Combine locked fats with new fats
        const recipe = [...lockedFats, ...newFatRecipe];

        // Calculate fatty acids and properties
        const fattyAcids = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const properties = calculateProperties(fattyAcids);

        // Check if properties are in acceptable ranges
        if (allPropertiesInRange(properties)) {
            return {
                recipe,
                fattyAcids,
                properties
            };
        }
    }

    return null;
}

/**
 * Generate random percentages for selected fats, scaled to a target total
 * @param {Array} fatIds - Array of fat IDs
 * @param {number} targetTotal - Target total percentage (e.g., 60 if 40% is locked)
 * @returns {Array} Array of {id, percentage}
 */
function generateRandomPercentagesScaled(fatIds, targetTotal) {
    if (fatIds.length === 0) return [];

    const minPercent = PROFILE.MIN_FAT_PERCENT;
    const maxPercent = Math.min(PROFILE.MAX_FAT_PERCENT, targetTotal);

    // Generate random weights
    let weights = fatIds.map(() => minPercent + Math.random() * (maxPercent - minPercent));

    // Normalize to target total
    const total = weights.reduce((sum, w) => sum + w, 0);
    let percentages = weights.map(w => Math.round(w / total * targetTotal));

    // Fix rounding to ensure sum is exactly targetTotal
    const roundedTotal = percentages.reduce((sum, p) => sum + p, 0);
    if (roundedTotal !== targetTotal) {
        const maxIdx = percentages.indexOf(Math.max(...percentages));
        percentages[maxIdx] += (targetTotal - roundedTotal);
    }

    // Enforce min/max constraints
    percentages = percentages.map(p => Math.max(minPercent, Math.min(maxPercent, p)));

    return fatIds.map((id, i) => ({ id, percentage: percentages[i] }));
}
