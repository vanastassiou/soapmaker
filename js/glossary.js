/**
 * Glossary page functionality
 */

import { $ } from './ui/helpers.js';
import { TIMING } from './lib/constants.js';

let glossaryData = {};
let currentCategory = 'all';

async function loadGlossary() {
    const response = await fetch('./data/glossary.json');
    glossaryData = await response.json();
    renderGlossary();
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
        <article class="glossary-entry" data-key="${key}">
            <header class="glossary-entry-header">
                <h2 class="glossary-term">${data.term}</h2>
                <span class="glossary-category">${data.category}</span>
            </header>
            <p class="glossary-desc">${data.desc}</p>
            ${data.details ? `
                <details class="glossary-details">
                    <summary>More details</summary>
                    <div class="glossary-details-content">${data.details.replace(/\n/g, '<br>')}</div>
                </details>
            ` : ''}
            ${data.related?.length > 0 ? `
                <div class="glossary-related">
                    <span class="glossary-related-label">Related:</span>
                    ${data.related
                        .filter(r => glossaryData[r])
                        .map(r => `<a href="#${r}" class="glossary-related-link" data-term="${r}">${glossaryData[r].term}</a>`)
                        .join('')}
                </div>
            ` : ''}
            ${data.references?.length > 0 ? `
                <div class="glossary-references">
                    <span class="glossary-references-label">References:</span>
                    ${data.references.map(ref => `
                        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="glossary-ref-link">${ref.source}</a>
                    `).join('')}
                </div>
            ` : ''}
        </article>
    `).join('');

    // Handle related term clicks
    container.querySelectorAll('.glossary-related-link').forEach(link => {
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
    document.querySelectorAll('.glossary-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.glossary-filter').forEach(b => {
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

// Initialize
loadGlossary();
initFilters();
