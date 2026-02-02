/**
 * Glossary page functionality for soapmaking section
 * Displays glossary terms filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { resolveReferences } from '../../../js/lib/references.js';

let glossaryData = {};
let sourcesData = {};
let currentCategory = 'all';

async function loadGlossary() {
    const [glossaryResponse, sourcesResponse] = await Promise.all([
        fetch('../../../data/glossary.json'),
        fetch('../../../data/sources.json')
    ]);
    glossaryData = await glossaryResponse.json();
    sourcesData = await sourcesResponse.json();
    renderGlossary();
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

function renderGlossary() {
    const container = $('glossaryList');

    // Filter by craft domain and category
    const entries = Object.entries(glossaryData)
        .filter(([_, data]) => data.domain?.includes('craft'))
        .filter(([_, data]) => currentCategory === 'all' || data.category === currentCategory)
        .sort((a, b) => a[1].term.localeCompare(b[1].term));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No terms found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${data.term}</h2>
            </header>
            <p class="entry-desc">${data.desc}</p>
            ${data.details ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    <div class="entry-details-content">${data.details.replace(/\n/g, '<br>')}</div>
                </details>
            ` : ''}
            ${data.related?.length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${data.related
                        .filter(r => glossaryData[r] && glossaryData[r].domain?.includes('craft'))
                        .map(r => `<a href="#${r}" class="entry-related-link" data-term="${r}">${glossaryData[r].term}</a>`)
                        .join('')}
                </div>
            ` : ''}
            ${renderReferencesHtml(data.references)}
        </article>
    `).join('');

    // Handle related term clicks
    container.querySelectorAll('.entry-related-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const termKey = link.dataset.term;
            const entry = container.querySelector(`[data-key="${termKey}"]`);
            if (entry) {
                entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                entry.classList.add('highlight');
                setTimeout(() => entry.classList.remove('highlight'), TIMING.HIGHLIGHT_DURATION);
            }
        });
    });
}

function setCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.page-filter').forEach(btn => {
        const isActive = btn.dataset.category === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    renderGlossary();
}

function getCategoryFromHash() {
    const hash = window.location.hash.slice(1);
    const validCategories = ['all', 'property', 'concept', 'additive'];
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
loadGlossary();
initFilters();
