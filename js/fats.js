/**
 * Fats page functionality
 */

import { $ } from './ui/helpers.js';
import { TIMING } from './lib/constants.js';

let fatsData = {};
let sourcesData = {};
let currentCategory = 'all';

const FATTY_ACID_NAMES = {
    caprylic: 'Caprylic (C8:0)',
    capric: 'Capric (C10:0)',
    lauric: 'Lauric (C12:0)',
    myristic: 'Myristic (C14:0)',
    palmitic: 'Palmitic (C16:0)',
    palmitoleic: 'Palmitoleic (C16:1)',
    stearic: 'Stearic (C18:0)',
    oleic: 'Oleic (C18:1)',
    ricinoleic: 'Ricinoleic (C18:1-OH)',
    linoleic: 'Linoleic (C18:2)',
    linolenic: 'Linolenic (C18:3)',
    arachidic: 'Arachidic (C20:0)',
    behenic: 'Behenic (C22:0)',
    erucic: 'Erucic (C22:1)'
};

async function loadFats() {
    const [fatsRes, sourcesRes] = await Promise.all([
        fetch('./data/fats.json'),
        fetch('./data/sources.json')
    ]);
    fatsData = await fatsRes.json();
    sourcesData = await sourcesRes.json();
    renderFats();
}

function matchesCategory(data, category) {
    switch (category) {
        case 'all':
            return true;
        case 'plant':
            return !data.dietary?.animalBased;
        case 'animal':
            return data.dietary?.animalBased;
        case 'allergen':
            return data.dietary?.commonAllergen;
        case 'sourcing':
            return data.dietary?.sourcingConcerns;
        default:
            return true;
    }
}

function getCategoryLabel(data) {
    if (data.dietary?.animalBased) return 'animal';
    return 'plant';
}

function formatFattyAcids(fattyAcids) {
    if (!fattyAcids) return '';

    const nonZero = Object.entries(fattyAcids)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1]);

    if (nonZero.length === 0) return '<p class="fat-no-data">No fatty acid data available.</p>';

    return `
        <div class="fatty-acid-grid">
            ${nonZero.map(([acid, value]) => `
                <div class="fatty-acid-item">
                    <span class="fatty-acid-name">${FATTY_ACID_NAMES[acid] || acid}</span>
                    <span class="fatty-acid-value">${value}%</span>
                    <div class="fatty-acid-bar" style="width: ${Math.min(value, 100)}%"></div>
                </div>
            `).join('')}
        </div>
    `;
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

function renderFats() {
    const container = $('fatsList');

    const entries = Object.entries(fatsData)
        .filter(([_, data]) => matchesCategory(data, currentCategory))
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No fats found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header fat-entry-header">
                <h2 class="entry-title">${escapeHtml(data.name)}</h2>
                <div class="fat-badges">
                    <span class="fat-category fat-category-${getCategoryLabel(data)}">${getCategoryLabel(data)}</span>
                    ${data.dietary?.commonAllergen ? '<span class="fat-badge fat-badge-allergen">allergen</span>' : ''}
                    ${data.dietary?.sourcingConcerns ? '<span class="fat-badge fat-badge-sourcing">sourcing concerns</span>' : ''}
                </div>
            </header>
            <p class="entry-desc">${data.description}</p>

            <details class="entry-details">
                <summary>
                    <span class="details-toggle">Properties</span>
                    <span class="details-hide">Hide properties</span>
                </summary>
                <div class="entry-details-content fat-stats-content">
                    <div class="fat-stats">
                        <div class="fat-stat">
                            <a href="glossary.html#sap-value" class="fat-stat-label">SAP (NaOH)</a>
                            <span class="fat-stat-value">${data.sap?.naoh || '—'}</span>
                        </div>
                        <div class="fat-stat">
                            <a href="glossary.html#sap-value" class="fat-stat-label">SAP (KOH)</a>
                            <span class="fat-stat-value">${data.sap?.koh || '—'}</span>
                        </div>
                        <div class="fat-stat">
                            <a href="glossary.html#iodine" class="fat-stat-label">Iodine</a>
                            <span class="fat-stat-value">${data.iodine ?? '—'}</span>
                        </div>
                        <div class="fat-stat">
                            <a href="glossary.html#ins" class="fat-stat-label">INS</a>
                            <span class="fat-stat-value">${data.ins ?? '—'}</span>
                        </div>
                        <div class="fat-stat">
                            <a href="glossary.html#usage" class="fat-stat-label">Usage</a>
                            <span class="fat-stat-value">${data.usage ? `${data.usage.min}–${data.usage.max}%` : '—'}</span>
                        </div>
                        <div class="fat-stat">
                            <a href="glossary.html#density" class="fat-stat-label">Density</a>
                            <span class="fat-stat-value">${data.density ? `${data.density} g/mL` : '—'}</span>
                        </div>
                        ${data.meltingPoint != null ? `
                        <div class="fat-stat">
                            <a href="glossary.html#melting-point" class="fat-stat-label">Melting point</a>
                            <span class="fat-stat-value">${data.meltingPoint}°C</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </details>

            <details class="entry-details">
                <summary>
                    <span class="details-toggle">Fatty acid profile</span>
                    <span class="details-hide">Hide profile</span>
                </summary>
                <div class="entry-details-content">
                    ${formatFattyAcids(data.fattyAcids)}
                </div>
            </details>

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
            renderFats();
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
    renderFats();
}

// Reset state when page is restored from bfcache (back/forward navigation)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        resetFilters();
    }
});

// Initialize
loadFats();
initFilters();
