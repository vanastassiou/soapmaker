/**
 * Equipment page functionality
 * Displays soapmaking equipment filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { resolveReferences } from '../../../js/lib/references.js';

let equipmentData = {};
let sourcesData = {};
let currentCategory = 'all';

async function loadEquipment() {
    const [equipmentResponse, sourcesResponse] = await Promise.all([
        fetch('../../../data/equipment.json'),
        fetch('../../../data/sources.json')
    ]);
    equipmentData = await equipmentResponse.json();
    sourcesData = await sourcesResponse.json();
    renderEquipment();
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

function renderEquipment() {
    const container = $('equipmentList');

    // Filter by craft domain and category
    const entries = Object.entries(equipmentData)
        .filter(([_, data]) => data.domain?.includes('craft'))
        .filter(([_, data]) => currentCategory === 'all' || data.category === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No equipment found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
                <span class="entry-category">${data.category}</span>
            </header>
            <p class="entry-desc">${data.description}</p>
            ${data.materials?.length > 0 ? `
                <div class="entry-list">
                    <span class="entry-list-label">Materials:</span>
                    <span class="entry-list-items">${data.materials.join(', ')}</span>
                </div>
            ` : ''}
            ${data.details || data.considerations?.length > 0 ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    ${data.details ? `<div class="entry-details-content">${data.details.replace(/\n/g, '<br>')}</div>` : ''}
                    ${data.considerations?.length > 0 ? `
                        <div class="entry-considerations">
                            <h3 class="entry-subheading">Considerations</h3>
                            <ul class="entry-bullet-list">
                                ${data.considerations.map(c => `<li>${c}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </details>
            ` : ''}
            ${data.safetyNotes?.length > 0 ? `
                <div class="entry-safety">
                    <h3 class="entry-subheading">Safety notes</h3>
                    <ul class="entry-bullet-list entry-bullet-list--warning">
                        ${data.safetyNotes.map(n => `<li>${n}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${renderReferencesHtml(data.references)}
        </article>
    `).join('');
}

function setCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.page-filter').forEach(btn => {
        const isActive = btn.dataset.category === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    renderEquipment();
}

function getCategoryFromHash() {
    const hash = window.location.hash.slice(1);
    const validCategories = ['all', 'safety', 'measuring', 'mixing', 'mould'];
    return validCategories.includes(hash) ? hash : 'all';
}

function initFilters() {
    document.querySelectorAll('.page-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            window.location.hash = category === 'all' ? '' : category;
        });
    });

    window.addEventListener('hashchange', () => {
        setCategory(getCategoryFromHash());
    });
}

// Restore state when page is restored from bfcache
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        setCategory(getCategoryFromHash());
    }
});

// Initialize with category from URL hash
currentCategory = getCategoryFromHash();
document.querySelectorAll('.page-filter').forEach(btn => {
    const isActive = btn.dataset.category === currentCategory;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
});
loadEquipment();
initFilters();
