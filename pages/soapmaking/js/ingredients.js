/**
 * Ingredients page functionality
 * Combines fats and additives for the soapmaking section
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { resolveReferences } from '../../../js/lib/references.js';

let fatsData = {};
let fragrancesData = {};
let colourantsData = {};
let soapPerformanceData = {};
let skinCareData = {};
let sourcesData = {};
let glossaryData = {};
let currentCategory = 'all';

async function loadIngredients() {
    const [
        fatsResponse, fragrancesResponse, colourantsResponse,
        soapPerformanceResponse, skinCareResponse, sourcesResponse, glossaryResponse
    ] = await Promise.all([
        fetch('../../data/fats.json'),
        fetch('../../data/fragrances.json'),
        fetch('../../data/colourants.json'),
        fetch('../../data/soap-performance.json'),
        fetch('../../data/skin-care.json'),
        fetch('../../data/sources.json'),
        fetch('../../data/glossary.json')
    ]);
    fatsData = await fatsResponse.json();
    fragrancesData = await fragrancesResponse.json();
    colourantsData = await colourantsResponse.json();
    soapPerformanceData = await soapPerformanceResponse.json();
    skinCareData = await skinCareResponse.json();
    sourcesData = await sourcesResponse.json();
    glossaryData = await glossaryResponse.json();
    renderIngredients();
}

function renderReferencesHtml(references) {
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

function renderFatCard(key, data) {
    return `
        <article class="entry-card" data-key="${key}" data-type="fat">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
                <span class="entry-category">Fat/oil</span>
            </header>
            ${data.description ? `<p class="entry-desc">${data.description}</p>` : ''}

            <div class="fat-properties">
                ${data.sap?.naoh ? `<span class="property-item"><strong>SAP (NaOH):</strong> ${data.sap.naoh}</span>` : ''}
                ${data.sap?.koh ? `<span class="property-item"><strong>SAP (KOH):</strong> ${data.sap.koh}</span>` : ''}
                ${data.iodine ? `<span class="property-item"><strong>Iodine:</strong> ${data.iodine}</span>` : ''}
                ${data.ins ? `<span class="property-item"><strong>INS:</strong> ${data.ins}</span>` : ''}
            </div>

            ${data.usageLimits ? `
                <div class="fat-usage">
                    <span class="usage-label">Recommended usage:</span>
                    <span class="usage-range">${data.usageLimits.min || 0}% - ${data.usageLimits.max || 100}%</span>
                    ${data.usageLimits.note ? `<span class="usage-note">${data.usageLimits.note}</span>` : ''}
                </div>
            ` : ''}

            ${data.fattyAcids ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Fatty acid profile</span>
                        <span class="details-hide">Hide profile</span>
                    </summary>
                    <div class="entry-details-content">
                        <dl class="fatty-acid-list">
                            ${Object.entries(data.fattyAcids)
                                .filter(([_, v]) => v > 0)
                                .sort((a, b) => b[1] - a[1])
                                .map(([acid, pct]) => `
                                    <div class="fatty-acid-item">
                                        <dt>${acid}</dt>
                                        <dd>${pct}%</dd>
                                    </div>
                                `).join('')}
                        </dl>
                    </div>
                </details>
            ` : ''}

            ${data.tags?.length > 0 ? `
                <div class="entry-tags">
                    ${data.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}

            ${renderReferencesHtml(data.references)}
        </article>
    `;
}

function renderAdditiveCard(key, data) {
    return `
        <article class="entry-card" data-key="${key}" data-type="additive">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
                <span class="entry-category">${data.category || 'Additive'}</span>
            </header>
            <p class="entry-desc">${data.description}</p>

            ${data.details ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    <div class="entry-details-content">${data.details.replace(/\n/g, '<br>')}</div>
                </details>
            ` : ''}

            ${data.usageRate ? `
                <div class="additive-usage">
                    <span class="usage-label">Usage rate:</span>
                    <span class="usage-range">${data.usageRate.min || 0}% - ${data.usageRate.max}%</span>
                    ${data.usageRate.note ? `<span class="usage-note">${data.usageRate.note}</span>` : ''}
                </div>
            ` : ''}

            ${data.whenToAdd ? `
                <div class="additive-timing">
                    <span class="timing-label">When to add:</span>
                    <span class="timing-value">${data.whenToAdd}</span>
                </div>
            ` : ''}

            ${data.related?.filter(r => glossaryData[r]).length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${data.related
                        .filter(r => glossaryData[r])
                        .map(r => `<a href="glossary.html#${r}" class="entry-related-link">${glossaryData[r].term}</a>`)
                        .join('')}
                </div>
            ` : ''}

            ${renderReferencesHtml(data.references)}
        </article>
    `;
}

function addEntries(entries, data, type) {
    Object.entries(data).forEach(([key, item]) => {
        entries.push({ key, data: item, type, name: item.name });
    });
}

function renderIngredients() {
    const container = $('ingredientsList');

    let entries = [];

    if (currentCategory === 'all' || currentCategory === 'fats') {
        addEntries(entries, fatsData, 'fat');
    }
    if (currentCategory === 'all' || currentCategory === 'fragrances') {
        addEntries(entries, fragrancesData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'colourants') {
        addEntries(entries, colourantsData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'soap-performance') {
        addEntries(entries, soapPerformanceData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'skin-care') {
        addEntries(entries, skinCareData, 'additive');
    }

    // Sort alphabetically
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No ingredients found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(entry => {
        if (entry.type === 'fat') {
            return renderFatCard(entry.key, entry.data);
        } else {
            return renderAdditiveCard(entry.key, entry.data);
        }
    }).join('');
}

function initFilters() {
    document.querySelectorAll('.page-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.page-filter').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            currentCategory = btn.dataset.category;
            renderIngredients();
        });
    });
}

function resetFilters() {
    currentCategory = 'all';
    document.querySelectorAll('.page-filter').forEach(btn => {
        const isAll = btn.dataset.category === 'all';
        btn.classList.toggle('active', isAll);
        btn.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
    renderIngredients();
}

// Reset state when page is restored from bfcache
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        resetFilters();
    }
});

// Initialize
loadIngredients();
initFilters();
