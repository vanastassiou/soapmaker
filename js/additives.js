/**
 * Additives page functionality
 */

import { $ } from './ui/helpers.js';
import { TIMING } from './lib/constants.js';

let additivesData = {};
let sourcesData = {};
let currentCategory = 'all';

const CATEGORY_LABELS = {
    'colourant': 'colourant',
    'essential-oil': 'essential oil',
    'functional': 'functional'
};

async function loadAdditives() {
    const [additivesRes, sourcesRes] = await Promise.all([
        fetch('./data/additives.json'),
        fetch('./data/sources.json')
    ]);
    additivesData = await additivesRes.json();
    sourcesData = await sourcesRes.json();
    renderAdditives();
}

function matchesCategory(data, category) {
    if (category === 'all') return true;
    return data.category === category;
}

function formatReferences(references) {
    if (!references || references.length === 0) return '';

    return references.map(ref => {
        const source = sourcesData[ref.sourceId];
        const sourceName = source?.name || ref.sourceId;

        if (ref.url) {
            return `<a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer" class="reference-link">${escapeHtml(sourceName)}</a>`;
        }
        return `<span>${escapeHtml(sourceName)}</span>`;
    }).join(', ');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatUsage(usage) {
    if (!usage) return '—';
    const basis = usage.basis === 'oil-weight' ? '% of oils' : '%';
    return `${usage.min}–${usage.max}${basis}`;
}

function renderAdditives() {
    const container = $('additivesList');

    const entries = Object.entries(additivesData)
        .filter(([_, data]) => matchesCategory(data, currentCategory))
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No additives found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${escapeHtml(data.name)}</h2>
                <div class="additive-badges">
                    <span class="entry-category">${CATEGORY_LABELS[data.category] || data.category}</span>
                    ${data.subcategory ? `<span class="additive-subcategory">${escapeHtml(data.subcategory)}</span>` : ''}
                    ${data.color ? `<span class="additive-color-swatch" style="background-color: ${data.color}" title="${data.color}"></span>` : ''}
                </div>
            </header>
            <p class="entry-desc">${escapeHtml(data.description)}</p>

            <details class="entry-details">
                <summary>
                    <span class="details-toggle">Properties</span>
                    <span class="details-hide">Hide properties</span>
                </summary>
                <div class="entry-details-content">
                    <div class="additive-stats">
                        <div class="additive-stat">
                            <span class="additive-stat-label">Usage</span>
                            <span class="additive-stat-value">${formatUsage(data.usage)}</span>
                        </div>
                        ${data.density ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">Density</span>
                            <span class="additive-stat-value">${data.density} g/mL</span>
                        </div>
                        ` : ''}
                        ${data.safety?.casNumber ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">CAS number</span>
                            <span class="additive-stat-value">${escapeHtml(data.safety.casNumber)}</span>
                        </div>
                        ` : ''}
                        ${data.safety?.maxConcentration ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">Max concentration</span>
                            <span class="additive-stat-value">${data.safety.maxConcentration}%</span>
                        </div>
                        ` : ''}
                        ${data.safety?.flashPointC ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">Flash point</span>
                            <span class="additive-stat-value">${data.safety.flashPointC}°C</span>
                        </div>
                        ` : ''}
                        ${data.safety?.ifraCategory9Limit ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">IFRA limit (cat. 9)</span>
                            <span class="additive-stat-value">${data.safety.ifraCategory9Limit}%</span>
                        </div>
                        ` : ''}
                        ${data.scentNote ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">Scent note</span>
                            <span class="additive-stat-value">${escapeHtml(data.scentNote)}</span>
                        </div>
                        ` : ''}
                        ${data.dietary?.animalBased !== undefined ? `
                        <div class="additive-stat">
                            <span class="additive-stat-label">Source</span>
                            <span class="additive-stat-value">${data.dietary.animalBased ? 'Animal-based' : 'Plant-based'}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </details>

            ${data.safety?.majorConstituents?.length > 0 ? `
            <details class="entry-details">
                <summary>
                    <span class="details-toggle">Major constituents</span>
                    <span class="details-hide">Hide constituents</span>
                </summary>
                <div class="entry-details-content">
                    <ul class="additive-constituents">
                        ${data.safety.majorConstituents.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                    </ul>
                </div>
            </details>
            ` : ''}

            ${data.references?.length > 0 ? `
                <div class="entry-references">
                    <span class="references-label">References:</span>
                    ${formatReferences(data.references)}
                </div>
            ` : ''}
        </article>
    `).join('');

    // Handle hash navigation
    if (window.location.hash) {
        const key = window.location.hash.slice(1);
        const entry = container.querySelector(`[data-key="${key}"]`);
        if (entry) {
            entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
            entry.classList.add('highlight');
            setTimeout(() => entry.classList.remove('highlight'), TIMING.HIGHLIGHT_DURATION);
        }
    }
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
            renderAdditives();
        });
    });
}

// Initialize
loadAdditives();
initFilters();
