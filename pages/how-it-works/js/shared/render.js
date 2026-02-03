/**
 * Shared rendering utilities for how-it-works SPA
 */

import { resolveReferences } from '../../../../js/lib/references.js';

/**
 * Render references HTML block
 * @param {Array} references - Reference identifiers
 * @param {Object} sourcesData - Sources database
 * @returns {string} HTML string
 */
export function renderReferencesHtml(references, sourcesData) {
    if (!references || references.length === 0) return '';
    const refs = resolveReferences(references, sourcesData);
    return `
        <div class="entry-references">
            <span class="references-label">References:</span>
            ${refs.map(ref => `
                <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="reference-link">${ref.source}</a>
            `).join('')}
        </div>
    `;
}

/**
 * Render a basic entry card
 * @param {string} key - Entry key
 * @param {Object} data - Entry data
 * @param {string} extraContent - Additional HTML content
 * @param {string} modifier - CSS class modifier (e.g., '--property')
 * @returns {string} HTML string
 */
export function renderEntryCard(key, data, extraContent = '', modifier = '') {
    const modifierClass = modifier ? ` entry-card${modifier}` : '';
    return `
        <article class="entry-card${modifierClass}" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
            </header>
            <p class="entry-desc">${data.description}</p>
            ${extraContent}
        </article>
    `;
}
