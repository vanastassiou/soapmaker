/**
 * How-it-works SPA - Router and data loader
 */

import { renderLanding } from './views/landing.js';
import { renderProperties } from './views/properties.js';
import { renderAlgorithms, getValidCategory } from './views/algorithms.js';
import { renderGlossary } from './views/glossary.js';

// Shared data cache
let data = null;

// Route configuration
const routes = {
    '': {
        title: 'The science',
        intro: 'Understand the formulas and methodology behind the soap calculator.',
        showSubNav: false
    },
    'properties': {
        title: 'Properties',
        intro: 'How soap properties are calculated and what they mean.',
        showSubNav: true
    },
    'algorithms': {
        title: 'Algorithms',
        intro: 'How the calculator computes soap properties and amounts.',
        showSubNav: true
    },
    'glossary': {
        title: 'Glossary',
        intro: 'Scientific concepts behind the calculations.',
        showSubNav: true
    }
};

// DOM elements
const pageTitle = document.getElementById('pageTitle');
const pageIntro = document.getElementById('pageIntro');
const subNav = document.getElementById('subNav');
const filterNav = document.getElementById('filterNav');
const content = document.getElementById('content');

/**
 * Load all data files (cached after first load)
 */
async function loadData() {
    if (data) return data;

    const [glossary, formulas, sources] = await Promise.all([
        fetch('../../../data/glossary.json').then(r => r.json()),
        fetch('../../../data/formulas.json').then(r => r.json()),
        fetch('../../../data/sources.json').then(r => r.json())
    ]);

    data = { glossary, formulas, sources };
    return data;
}

/**
 * Parse route from hash
 * @returns {{ section: string, subpath: string }}
 */
function parseRoute() {
    const hash = window.location.hash.slice(1);
    const [section, ...rest] = hash.split('/');
    return {
        section: section || '',
        subpath: rest.join('/')
    };
}

/**
 * Update sub-navigation highlighting
 */
function updateSubNav(activeSection, show) {
    if (!show) {
        subNav.innerHTML = '';
        subNav.hidden = true;
        return;
    }

    subNav.hidden = false;
    const sections = ['properties', 'algorithms', 'glossary'];
    subNav.innerHTML = sections.map(s => `
        <a href="#${s}" class="sub-nav-link"${s === activeSection ? ' aria-current="page"' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</a>
    `).join('');
}

/**
 * Update page title in document
 */
function updateDocumentTitle(title) {
    document.title = title === 'The science'
        ? 'How it works - Soap Recipe Builder'
        : `${title} - How it works`;
}

/**
 * Main navigation handler
 */
async function navigate() {
    const { section, subpath } = parseRoute();
    const config = routes[section] || routes[''];

    // Update header
    pageTitle.textContent = config.title;
    pageIntro.textContent = config.intro;
    updateDocumentTitle(config.title);
    updateSubNav(section, config.showSubNav);

    // Clear filter nav (only algorithms uses it)
    filterNav.innerHTML = '';

    // Load data and render view
    const loadedData = await loadData();

    switch (section) {
        case 'properties':
            renderProperties(loadedData, content);
            break;
        case 'algorithms':
            const category = getValidCategory(subpath);
            renderAlgorithms(loadedData, content, filterNav, category);
            setupAlgorithmFilters();
            break;
        case 'glossary':
            renderGlossary(loadedData, content, subpath || null);
            break;
        default:
            renderLanding(loadedData, content);
    }
}

/**
 * Setup algorithm category filter click handlers
 */
function setupAlgorithmFilters() {
    filterNav.querySelectorAll('.page-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            window.location.hash = category === 'all' ? 'algorithms' : `algorithms/${category}`;
        });
    });
}

// Event listeners
window.addEventListener('hashchange', navigate);

// Restore state when page is restored from bfcache
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        navigate();
    }
});

// Initialize
navigate();
