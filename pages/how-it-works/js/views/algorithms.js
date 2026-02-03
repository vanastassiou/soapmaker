/**
 * Algorithms view - Formulas with category filtering
 */

import { renderReferencesHtml } from '../shared/render.js';

let currentCategory = 'all';

export function renderAlgorithms(data, container, filterNav, category = 'all') {
    const { formulas, glossary, sources } = data;
    currentCategory = category;

    // Render filter nav
    renderFilterNav(filterNav, category);

    // Filter by calculator domain and category
    const entries = Object.entries(formulas)
        .filter(([_, d]) => d.domain?.includes('calculator'))
        .filter(([_, d]) => currentCategory === 'all' || d.category === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No formulas found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, d]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${d.name}</h2>
            </header>

            <p class="entry-desc">${d.summary}</p>

            <div class="formula-equation">
                <code>${d.formula}</code>
            </div>

            <div class="formula-user-friendly">
                <p>${d.userFriendly}</p>
            </div>

            ${d.recommendedRange ? `
                <div class="formula-range">
                    <span class="range-label">Recommended range:</span>
                    <span class="range-values">${d.recommendedRange.min} - ${d.recommendedRange.max}</span>
                </div>
            ` : ''}

            ${d.variables || d.example || d.technical ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Technical details</span>
                        <span class="details-hide">Hide technical details</span>
                    </summary>
                    <div class="entry-details-content">
                        ${d.variables ? `
                            <div class="formula-variables">
                                <h3 class="formula-section-heading">Variables</h3>
                                <dl class="formula-section-box">
                                    ${Object.entries(d.variables).map(([varName, desc]) => `
                                        <dt>${varName}</dt>
                                        <dd>${desc}</dd>
                                    `).join('')}
                                </dl>
                            </div>
                        ` : ''}

                        ${d.example ? `
                            <div class="formula-example">
                                <h3 class="formula-section-heading">Example</h3>
                                <div class="formula-section-box">
                                    <p class="example-scenario">${d.example.scenario}</p>
                                    <div class="example-steps">
                                        ${d.example.steps.map(step => `<div class="example-step">${step}</div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        ${d.technical ? `
                            <div class="formula-technical">
                                <p>${d.technical}</p>
                            </div>
                        ` : ''}
                    </div>
                </details>
            ` : ''}

            ${renderReferencesHtml(d.references, sources)}

            ${d.learnMore ? `
                <div class="entry-learn-more">
                    <a href="${d.learnMore.url}" target="_blank" rel="noopener noreferrer" class="learn-more-link">${d.learnMore.text} →</a>
                </div>
            ` : ''}

            ${d.related?.filter(r => glossary[r]).length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${d.related
                        .filter(r => glossary[r])
                        .map(r => `<a href="#glossary/${r}" class="entry-related-link">${glossary[r].name}</a>`)
                        .join('')}
                </div>
            ` : ''}
        </article>
    `).join('');
}

function renderFilterNav(filterNav, activeCategory) {
    const categories = [
        { id: 'all', label: 'All' },
        { id: 'core', label: 'Core' },
        { id: 'properties', label: 'Properties' },
        { id: 'optimization', label: 'Optimization' }
    ];

    filterNav.innerHTML = `
        <nav class="page-nav" role="tablist" aria-label="Filter algorithms by category">
            ${categories.map(cat => `
                <button
                    class="page-filter${cat.id === activeCategory ? ' active' : ''}"
                    data-category="${cat.id}"
                    role="tab"
                    aria-selected="${cat.id === activeCategory ? 'true' : 'false'}"
                    aria-controls="content"
                >${cat.label}</button>
            `).join('')}
        </nav>
    `;
}

export function getValidCategory(category) {
    const validCategories = ['all', 'core', 'properties', 'optimization'];
    return validCategories.includes(category) ? category : 'all';
}
