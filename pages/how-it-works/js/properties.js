/**
 * Properties page functionality for how-it-works section
 * Displays property-related glossary terms and formulas
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { resolveReferences } from '../../../js/lib/references.js';

let glossaryData = {};
let formulasData = {};
let sourcesData = {};

async function loadProperties() {
    const [glossaryResponse, formulasResponse, sourcesResponse] = await Promise.all([
        fetch('../../data/glossary.json'),
        fetch('../../data/formulas.json'),
        fetch('../../data/sources.json')
    ]);
    glossaryData = await glossaryResponse.json();
    formulasData = await formulasResponse.json();
    sourcesData = await sourcesResponse.json();
    renderProperties();
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

function renderProperties() {
    const container = $('propertiesList');

    // Get property terms from glossary (calculator domain, property category)
    const propertyTerms = Object.entries(glossaryData)
        .filter(([_, data]) => data.domain?.includes('calculator') && data.category === 'property')
        .sort((a, b) => a[1].term.localeCompare(b[1].term));

    if (propertyTerms.length === 0) {
        container.innerHTML = '<p class="no-results">No properties found.</p>';
        return;
    }

    container.innerHTML = propertyTerms.map(([key, data]) => {
        // Find related formula if exists
        const relatedFormula = Object.entries(formulasData).find(([fKey, fData]) =>
            fData.related?.includes(key) || fKey.includes(key)
        );

        return `
            <article class="entry-card entry-card--property" data-key="${key}">
                <header class="entry-header">
                    <h2 class="entry-title">${data.term}</h2>
                    <span class="entry-category">Property</span>
                </header>
                <p class="entry-desc">${data.desc}</p>

                ${data.details ? `
                    <div class="property-details">
                        <p>${data.details.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                ${relatedFormula ? `
                    <div class="property-formula">
                        <h3 class="entry-subheading">How it's calculated</h3>
                        <div class="formula-equation">
                            <code>${relatedFormula[1].formula}</code>
                        </div>
                        <p class="formula-explanation">${relatedFormula[1].userFriendly}</p>
                        <a href="formulas.html#${relatedFormula[0]}" class="formula-link">See full formula details →</a>
                    </div>
                ` : ''}

                ${data.related?.filter(r => glossaryData[r] && glossaryData[r].domain?.includes('calculator')).length > 0 ? `
                    <div class="entry-related">
                        <span class="entry-related-label">Related:</span>
                        ${data.related
                            .filter(r => glossaryData[r] && glossaryData[r].domain?.includes('calculator'))
                            .map(r => `<a href="glossary.html#${r}" class="entry-related-link">${glossaryData[r].term}</a>`)
                            .join('')}
                    </div>
                ` : ''}

                ${renderReferencesHtml(data.references)}
            </article>
        `;
    }).join('');
}

// Initialize
loadProperties();
