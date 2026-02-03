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
 * Render related glossary links
 * @param {Array} related - Related term keys
 * @param {Object} glossary - Glossary database
 * @param {Object} options - Rendering options
 * @param {string} options.linkPrefix - URL prefix for links (default: '#glossary')
 * @param {boolean} options.filterDomain - Filter by calculator domain (default: true)
 * @param {boolean} options.dataAttr - Add data-term attribute (default: false)
 * @returns {string} HTML string
 */
export function renderRelatedLinks(related, glossary, options = {}) {
    const { linkPrefix = '#glossary', filterDomain = true, dataAttr = false } = options;
    const validRelated = related?.filter(r =>
        glossary[r] && (!filterDomain || glossary[r].domain?.includes('calculator'))
    );
    if (!validRelated?.length) return '';

    return `
        <div class="entry-related">
            <span class="entry-related-label">Related:</span>
            ${validRelated.map(r =>
                `<a href="${linkPrefix}/${r}" class="entry-related-link"${dataAttr ? ` data-term="${r}"` : ''}>${glossary[r].name}</a>`
            ).join('')}
        </div>
    `;
}

/**
 * Render collapsible details section
 * @param {string} toggleLabel - Label when collapsed
 * @param {string} hideLabel - Label when expanded
 * @param {string} content - HTML content inside details
 * @returns {string} HTML string
 */
export function renderDetails(toggleLabel, hideLabel, content) {
    if (!content) return '';
    return `
        <details class="entry-details">
            <summary>
                <span class="details-toggle">${toggleLabel}</span>
                <span class="details-hide">${hideLabel}</span>
            </summary>
            <div class="entry-details-content">${content}</div>
        </details>
    `;
}

/**
 * Render empty state message if entries array is empty
 * @param {HTMLElement} container - Container element
 * @param {Array} entries - Entries array to check
 * @param {string} message - Message to display if empty
 * @returns {boolean} True if empty state was rendered
 */
export function renderEmptyState(container, entries, message) {
    if (entries.length === 0) {
        container.innerHTML = `<p class="no-results">${message}</p>`;
        return true;
    }
    return false;
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
