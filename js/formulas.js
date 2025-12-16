/**
 * Formulas page functionality
 */

import { $ } from './ui/helpers.js';
import { TIMING } from './lib/constants.js';
import { resolveReferences } from './lib/references.js';

let formulasData = {};
let sourcesData = {};
let glossaryData = {};
let currentCategory = 'all';

async function loadFormulas() {
    const [formulasResponse, sourcesResponse, glossaryResponse] = await Promise.all([
        fetch('./data/formulas.json'),
        fetch('./data/sources.json'),
        fetch('./data/glossary.json')
    ]);
    formulasData = await formulasResponse.json();
    sourcesData = await sourcesResponse.json();
    glossaryData = await glossaryResponse.json();
    renderFormulas();
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

function renderFormulas() {
    const container = $('formulasList');

    const entries = Object.entries(formulasData)
        .filter(([_, data]) => currentCategory === 'all' || data.category === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No formulas found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
                <span class="entry-category">${data.category}</span>
            </header>

            <p class="entry-desc">${data.summary}</p>

            <div class="formula-equation">
                <code>${data.formula}</code>
            </div>

            <div class="formula-user-friendly">
                <p>${data.userFriendly}</p>
            </div>

            ${data.variables ? `
                <div class="formula-variables">
                    <h3 class="formula-section-heading">Variables</h3>
                    <dl class="formula-section-box">
                        ${Object.entries(data.variables).map(([varName, desc]) => `
                            <dt>${varName}</dt>
                            <dd>${desc}</dd>
                        `).join('')}
                    </dl>
                </div>
            ` : ''}

            ${data.example ? `
                <div class="formula-example">
                    <h3 class="formula-section-heading">Example</h3>
                    <div class="formula-section-box">
                        <p class="example-scenario">${data.example.scenario}</p>
                        <div class="example-steps">
                            ${data.example.steps.map(step => `<div class="example-step">${step}</div>`).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}

            ${data.recommendedRange ? `
                <div class="formula-range">
                    <span class="range-label">Recommended range:</span>
                    <span class="range-values">${data.recommendedRange.min} - ${data.recommendedRange.max}</span>
                </div>
            ` : ''}

            ${data.technical ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Technical details</span>
                        <span class="details-hide">Hide technical details</span>
                    </summary>
                    <div class="entry-details-content">
                        <p>${data.technical}</p>
                    </div>
                </details>
            ` : ''}

            ${renderReferencesHtml(data.references)}

            ${data.learnMore ? `
                <div class="entry-learn-more">
                    <a href="${data.learnMore.url}" target="_blank" rel="noopener noreferrer" class="learn-more-link">${data.learnMore.text} →</a>
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
            renderFormulas();
        });
    });
}

// Initialize
loadFormulas();
initFilters();
