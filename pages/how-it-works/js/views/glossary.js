/**
 * Glossary view - Scientific concept terms
 */

import { renderReferencesHtml } from '../shared/render.js';

const HIGHLIGHT_DURATION = 2000;

export function renderGlossary(data, container, targetKey = null) {
    const { glossary, sources } = data;

    // Filter by calculator domain and concept type only
    const entries = Object.entries(glossary)
        .filter(([_, d]) => d.domain?.includes('calculator'))
        .filter(([_, d]) => d.type === 'concept')
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No concepts found.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, d]) => `
        <article class="entry-card" data-key="${key}">
            <header class="entry-header">
                <h2 class="entry-title">${d.name}</h2>
            </header>
            <p class="entry-desc">${d.description}</p>
            ${d.details ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    <div class="entry-details-content">${d.details.replace(/\n/g, '<br>')}</div>
                </details>
            ` : ''}
            ${d.related?.filter(r => glossary[r] && glossary[r].domain?.includes('calculator')).length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${d.related
                        .filter(r => glossary[r] && glossary[r].domain?.includes('calculator'))
                        .map(r => `<a href="#glossary/${r}" class="entry-related-link" data-term="${r}">${glossary[r].name}</a>`)
                        .join('')}
                </div>
            ` : ''}
            ${renderReferencesHtml(d.references, sources)}
        </article>
    `).join('');

    // Handle related term clicks - scroll within glossary
    container.querySelectorAll('.entry-related-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const termKey = link.dataset.term;
            const entry = container.querySelector(`[data-key="${termKey}"]`);
            if (entry) {
                // Update URL without triggering full navigation
                history.pushState(null, '', `#glossary/${termKey}`);
                scrollToEntry(entry);
            }
        });
    });

    // Scroll to target if specified
    if (targetKey) {
        const entry = container.querySelector(`[data-key="${targetKey}"]`);
        if (entry) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => scrollToEntry(entry));
        }
    }
}

function scrollToEntry(entry) {
    entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
    entry.classList.add('highlight');
    setTimeout(() => entry.classList.remove('highlight'), HIGHLIGHT_DURATION);
}
