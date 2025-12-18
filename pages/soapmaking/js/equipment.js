/**
 * Equipment page functionality
 * Displays soapmaking equipment filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { resolveReferences } from '../../../js/lib/references.js';

let equipmentData = {};
let sourcesData = {};
let glossaryData = {};
let currentCategory = 'all';

async function loadEquipment() {
    const [equipmentResponse, sourcesResponse, glossaryResponse] = await Promise.all([
        fetch('../../data/equipment.json'),
        fetch('../../data/sources.json'),
        fetch('../../data/glossary.json')
    ]);
    equipmentData = await equipmentResponse.json();
    sourcesData = await sourcesResponse.json();
    glossaryData = await glossaryResponse.json();
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
    `).join('');
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
            renderEquipment();
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
    renderEquipment();
}

// Reset state when page is restored from bfcache
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        resetFilters();
    }
});

// Initialize
loadEquipment();
initFilters();
