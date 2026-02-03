/**
 * Properties view - Property glossary terms with related formulas
 */

import { renderReferencesHtml } from '../shared/render.js';

export function renderProperties(data, container) {
    const { glossary, formulas, sources } = data;

    // Get property terms from glossary (calculator domain, property type)
    const propertyTerms = Object.entries(glossary)
        .filter(([_, d]) => d.domain?.includes('calculator') && d.type === 'property')
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (propertyTerms.length === 0) {
        container.innerHTML = '<p class="no-results">No properties found.</p>';
        return;
    }

    container.innerHTML = propertyTerms.map(([key, d]) => {
        // Find related formula if exists
        const relatedFormula = Object.entries(formulas).find(([fKey, fData]) =>
            fData.related?.includes(key) || fKey.includes(key)
        );

        return `
            <article class="entry-card entry-card--property" data-key="${key}">
                <header class="entry-header">
                    <h2 class="entry-title">${d.name}</h2>
                </header>
                <p class="entry-desc">${d.description}</p>

                ${d.details ? `
                    <div class="property-details">
                        <p>${d.details.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                ${relatedFormula ? `
                    <div class="property-formula">
                        <h3 class="entry-subheading">How it's calculated</h3>
                        <div class="formula-equation">
                            <code>${relatedFormula[1].formula}</code>
                        </div>
                        <p class="formula-explanation">${relatedFormula[1].userFriendly}</p>
                        <a href="#algorithms/${relatedFormula[0]}" class="formula-link">See full formula details →</a>
                    </div>
                ` : ''}

                ${d.related?.filter(r => glossary[r] && glossary[r].domain?.includes('calculator')).length > 0 ? `
                    <div class="entry-related">
                        <span class="entry-related-label">Related:</span>
                        ${d.related
                            .filter(r => glossary[r] && glossary[r].domain?.includes('calculator'))
                            .map(r => `<a href="#glossary/${r}" class="entry-related-link">${glossary[r].name}</a>`)
                            .join('')}
                    </div>
                ` : ''}

                ${renderReferencesHtml(d.references, sources)}
            </article>
        `;
    }).join('');
}
