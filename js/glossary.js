/**
 * Glossary page functionality
 */

import { $ } from './ui/helpers.js';
import { TIMING } from './lib/constants.js';
import { resolveReferences } from './lib/references.js';

let glossaryData = {};
let sourcesData = {};
let currentCategory = 'all';

async function loadGlossary() {
    const [glossaryResponse, sourcesResponse] = await Promise.all([
        fetch('./data/glossary.json'),
        fetch('./data/sources.json')
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

    const entries = Object.entries(glossaryData)
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
                <span class="entry-category">${data.category}</span>
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
                        .filter(r => glossaryData[r])
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
            renderGlossary();
        });
    });
}

function resetFilters() {
    // Reset to 'all' category
    currentCategory = 'all';
    document.querySelectorAll('.page-filter').forEach(btn => {
        const isAll = btn.dataset.category === 'all';
        btn.classList.toggle('active', isAll);
        btn.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
    renderGlossary();
}

// Reset state when page is restored from bfcache (back/forward navigation)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        resetFilters();
    }
});

// Initialize
loadGlossary();
initFilters();
