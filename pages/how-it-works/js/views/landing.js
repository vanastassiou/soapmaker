/**
 * Landing view - Section navigation cards
 */

export function renderLanding(data, container) {
    container.innerHTML = `
        <nav class="section-nav" aria-label="How it works sections">
            <a href="#properties" class="section-card">
                <h2 class="section-card-title">Properties</h2>
                <p class="section-card-desc">How soap properties are calculated and what they mean</p>
            </a>
            <a href="#algorithms" class="section-card">
                <h2 class="section-card-title">Algorithms</h2>
                <p class="section-card-desc">How the calculator computes soap properties and amounts</p>
            </a>
            <a href="#glossary" class="section-card">
                <h2 class="section-card-title">Glossary</h2>
                <p class="section-card-desc">Scientific concepts behind the calculations</p>
            </a>
        </nav>
    `;
}
