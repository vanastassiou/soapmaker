# Design decisions

This document describes the architectural decisions, patterns, and accessibility
implementation used in the Soap Recipe Builder application.

<!-- toc -->
<!-- tocstop -->

---

## Module architecture

### Directory structure

```text
js/
├── core/               # Pure business logic (no DOM)
│   ├── calculator.js       # Lye, water, fatty acid calculations
│   └── optimizer.js        # Recipe optimization algorithms
├── lib/                # Shared utilities and constants
│   ├── constants.js        # All magic numbers, IDs, messages
│   ├── references.js       # Source reference resolution
│   └── validation.js       # JSON schema validation
├── state/              # State management
│   └── state.js            # Reactive proxy-based state
├── ui/                 # UI layer
│   ├── components/         # Reusable UI components
│   │   ├── itemRow.js          # Fat/additive row rendering
│   │   └── toast.js            # Toast notification system
│   ├── helpers.js          # DOM utilities, event delegation
│   ├── panelManager.js     # Info panel focus management
│   ├── ui.js               # Main UI rendering functions
│   └── finalRecipe.js      # Final recipe display
├── vendor/             # Third-party libraries
│   └── ajv.min.js          # JSON schema validator
├── main.js             # Calculator page entry point
├── glossary.js         # Glossary page entry point
├── fats.js             # Fats reference page entry point
├── additives.js        # Additives page entry point
├── formulas.js         # Formulas page entry point
└── references.js       # References page entry point
```

### Separation of concerns

- Core layer: pure functions with no DOM dependencies, easily testable
- State layer: centralized reactive state with localStorage persistence
- UI layer: all DOM manipulation isolated here
- Entry point: event binding and orchestration only

---

## Reusable components

### Item row component (`js/ui/components/itemRow.js`)

A unified component for rendering fat and additive rows, eliminating duplication
across the main recipe list, YOLO recipe list, and additives list.

```javascript
import { renderItemRow, attachRowEventHandlers } from './components/itemRow.js';

// Render a row
const html = renderItemRow({
    id: 'olive-oil',
    name: 'Olive Oil',
    weight: 100,
    percentage: 25,
    isLocked: false
}, index, {
    showWeightInput: true,
    showLockButton: true,
    itemType: 'fat'
});

// Attach event handlers via delegation
attachRowEventHandlers(container, {
    onWeightChange: (index, value) => { /* ... */ },
    onToggleLock: (index) => { /* ... */ },
    onRemove: (index) => { /* ... */ },
    onInfo: (id) => { /* ... */ }
}, 'fat');
```

### Toast notifications (`js/ui/components/toast.js`)

Non-blocking notifications replacing `alert()` calls.

Types:

- `toast.info()` - Informational messages
- `toast.success()` - Success confirmations
- `toast.warning()` - Warnings (e.g., duplicate item)
- `toast.error()` - Validation errors

Features:

- Auto-dismiss after 4 seconds
- Dismiss button for immediate closure
- Accessible (`role="status"`, `aria-live="polite"`)
- Stacked display for multiple notifications
- Mobile-responsive animation direction

---

## State management

### Reactive proxy pattern

State changes automatically trigger UI updates via ES6 Proxy:

```javascript
export const state = createReactiveState({
    // Recipe state (percentage-based)
    recipe: [],              // Array of {id, percentage}
    recipeLocks: new Set(),  // Locked percentage indices
    recipeAdditives: [],     // Array of {id, weight}

    // Data (loaded from JSON)
    fatsDatabase: {},
    glossaryData: {},
    fragrancesDatabase: {},  // Lazy-loaded
    // ...
});

// Subscribe to specific key changes
state.subscribe('recipe', (newValue) => {
    renderRecipeList();
});

// Subscribe to all changes
state.subscribeAll(() => {
    calculate();
});
```

### Immutable updates

Always create new arrays/objects when updating state:

```javascript
// Correct - creates new array, triggers notification
state.recipe = [...state.recipe, { id: 'olive-oil', percentage: 30 }];

// Wrong - mutates existing array, no notification
state.recipe.push(newFat);
```

### Persistence

State is automatically persisted to localStorage with version migration:

- Recipe configuration (fats, percentages, locks)
- Additives
- Cupboard cleaner state
- Exclusion list

---

## Error handling

### Pattern: toast over alert

All user-facing errors use the toast system:

| Scenario | Toast type | Example |
| -------- | ---------- | ------- |
| Validation error | `error` | "Hardness + Conditioning should be around 100" |
| Duplicate item | `warning` | "This fat is already in your recipe" |
| Missing input | `info` | "Please enter at least one property target" |
| Generation failure | `warning` | "Could not generate a valid recipe" |

### Centralized messages

All user-facing messages are in `UI_MESSAGES` constant:

```javascript
import { UI_MESSAGES } from './lib/constants.js';

toast.warning(UI_MESSAGES.FAT_ALREADY_EXISTS);
```

---

## Reference system

### Normalized sources

References use a two-part structure to avoid duplication:

**`sources.json`** defines each publication once:

```json
{
    "pubchem": {
        "name": "PubChem",
        "description": "Open chemistry database maintained by NCBI",
        "baseUrl": "https://pubchem.ncbi.nlm.nih.gov",
        "accessType": "free"
    }
}
```

**Data files** reference sources by ID with optional DOI and publication date:

```json
{
    "references": [{
        "sourceId": "pubchem",
        "section": "CID 5281",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/5281",
        "doi": "10.xxxx/xxxxx",
        "published": "2020-01"
    }]
}
```

### Runtime resolution

`js/lib/references.js` joins references with source data at runtime:

```javascript
import { resolveReferences } from './lib/references.js';

const enrichedRefs = resolveReferences(item.references, sourcesData);
// Returns: [{ source: "PubChem", sourceDescription: "...", section: "CID 5281", url: "..." }]
```

---

## Constants organization

### Element IDs (`ELEMENT_IDS`)

All DOM element IDs centralized:

```javascript
const el = $(ELEMENT_IDS.recipeFats);
```

### Default values (`DEFAULTS`)

Magic numbers for recipe defaults:

```javascript
DEFAULTS.FAT_WEIGHT          // 100 - default weight when adding fat
DEFAULTS.ADDITIVE_WEIGHT     // 10 - default weight when adding additive
DEFAULTS.BASE_RECIPE_WEIGHT  // 500 - default recipe weight in grams
DEFAULTS.YOLO_MIN_FATS       // 3 - minimum fats in YOLO recipe
DEFAULTS.YOLO_MAX_FATS       // 5 - maximum fats in YOLO recipe
```

### Property ranges (`PROPERTY_RANGES`)

Recommended soap property ranges:

```javascript
PROPERTY_RANGES.hardness         // { min: 29, max: 54 }
PROPERTY_RANGES.degreasing       // { min: 12, max: 22 }
PROPERTY_RANGES.moisturizing     // { min: 44, max: 69 }
PROPERTY_RANGES['lather-volume'] // { min: 14, max: 46 }
PROPERTY_RANGES['lather-density']// { min: 16, max: 48 }
```

### Calculation thresholds (`CALCULATION`)

```javascript
CALCULATION.DOMINANT_FATTY_ACID_THRESHOLD  // 10% - minimum for "dominant"
```

---

## CSS architecture

### Cascade layers

Specificity is controlled via CSS cascade layers:

```css
@layer reset, tokens, components, layouts, pages, utilities;
```

Layer purposes:

- `reset` - Browser normalization
- `tokens` - CSS custom properties applied to elements
- `components` - Reusable UI components (buttons, cards, inputs)
- `layouts` - Page structure (header, main, panels)
- `pages` - Page-specific styles
- `utilities` - Helper classes (visually-hidden, etc.)

### CSS custom properties

All colours, spacing, and breakpoints use CSS variables:

```css
:root {
    --bg-primary: #1a2420;
    --text-primary: #e8e8e0;
    --accent-gold: #e0b050;

    /* Breakpoints (reference values) */
    --bp-xs: 375px;
    --bp-sm: 480px;
    --bp-md: 768px;
    --bp-lg: 1024px;
    --bp-xl: 1200px;
}
```

### Container queries

Cards use container queries for component-level responsiveness:

```css
.card {
    container-type: inline-size;
    container-name: card;
}

@container card (max-width: 400px) {
    .card-header { flex-direction: column; }
}
```

---

## Performance patterns

### Lazy loading

Additive databases load on-demand when user switches tabs:

```javascript
const ADDITIVE_CATEGORY_MAP = {
    fragrance: { stateKey: 'fragrancesDatabase', file: 'fragrances' },
    colourant: { stateKey: 'colourantsDatabase', file: 'colourants' },
    // ...
};

async function loadAdditiveCategory(category) {
    if (state[config.stateKey]) return; // Already loaded
    const data = await fetch(`./data/${config.file}.json`);
    // ...
}
```

Core data (fats, glossary, formulas) loads at startup; additives (~100KB) are
deferred.

### DOM batching

Property updates use `requestAnimationFrame` to batch DOM writes:

```javascript
function batchUpdateProperties(properties) {
    if (pendingPropertyFrame) {
        cancelAnimationFrame(pendingPropertyFrame);
    }
    pendingPropertyFrame = requestAnimationFrame(() => {
        PROPERTY_KEYS.forEach(key => {
            ui.updateProperty(key, properties[key], range.min, range.max);
        });
    });
}
```

### Production validation skip

Schema validation runs only on localhost:

```javascript
export function shouldSkipValidation() {
    const host = window.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
}
```

---

## Schema architecture

### Shared definitions

`common-definitions.schema.json` contains reusable patterns:

- `references` - Source citation arrays with DOI and publication date support
- `usage` - Min/max percentage ranges
- `dietary` - animalBased, commonAllergen flags
- `ethicalConcerns` - Environmental, social, political arrays
- `sourcing` - Production regions and methods
- `safety` - CAS numbers, concentration limits

All schemas use `$ref` to reference these:

```json
{
    "references": {
        "$ref": "common-definitions.schema.json#/definitions/references"
    }
}
```

---

## Accessibility

The application targets **WCAG 2.2 Level AA** compliance.

### Semantic HTML structure

| Element | Purpose |
| ------- | ------- |
| `<html lang="en">` | Language declaration for screen readers |
| `<main>` | Landmark for main content area |
| `<header>` | Page header landmark |
| `<nav>` | Navigation landmarks |
| `<article>` | Glossary entries (self-contained content) |
| Heading hierarchy | h1 → h2 → h3 → h4 (no skipped levels) |

### Skip link

A visually hidden skip link appears at the top of each page when focused,
allowing keyboard users to bypass navigation and jump directly to main content.

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### Tab controls (ARIA tabs pattern)

The build mode tabs follow the WAI-ARIA tabs pattern:

```html
<div role="tablist" aria-label="Recipe build mode">
    <button role="tab" aria-selected="true" aria-controls="selectFatsMode">...</button>
    <button role="tab" aria-selected="false" aria-controls="specifyPropertiesMode">...</button>
</div>
<div role="tabpanel" aria-labelledby="tab-fats">...</div>
```

Arrow key navigation is supported:

- `ArrowRight`/`ArrowDown`: Next tab
- `ArrowLeft`/`ArrowUp`: Previous tab
- `Home`: First tab
- `End`: Last tab

### Dialog panels

Info panels implement the dialog pattern with focus management:

```html
<div class="info-panel" role="dialog" aria-modal="true" aria-labelledby="fatPanelName">
    <button class="close-panel" aria-label="Close panel">×</button>
    <h3 id="fatPanelName">...</h3>
</div>
```

Focus management:

- Focus moves to close button when panel opens
- `inert` attribute prevents focus behind overlay
- Escape key closes the panel
- Focus returns to the triggering element on close

### Keyboard accessibility

All interactive elements are keyboard accessible using native `<button>`
elements with button reset CSS where needed.

| Element | Implementation |
| ------- | -------------- |
| Buttons | Native `<button>` elements |
| Info links | Native `<button>` elements with button reset CSS |
| Panel tags | Native `<button>` elements with button reset CSS |

Event delegation with keyboard support:

```javascript
import { delegate, onActivate } from './ui/helpers.js';

delegate(container, '.clickable', 'click', handler);
delegate(container, '.clickable', 'keydown', onActivate(handler));
```

### Focus indicators

All focusable elements have visible focus indicators:

```css
:focus-visible {
    outline: 2px solid var(--accent-green);
    outline-offset: 2px;
}

button:focus-visible {
    box-shadow: var(--focus-ring-button);
}
```

### Colour contrast

All colour combinations meet WCAG AA (4.5:1) contrast ratios:

| Colour | Use | Contrast ratio |
| ------ | --- | -------------- |
| `--text-primary` (#e8efe9) | Body text | 12.8:1 |
| `--text-secondary` (#a8b5ab) | Secondary text | 6.5:1 |
| `--text-muted` (#7d8a80) | Muted text | 4.5:1 |
| `--accent-gold` (#d4a84b) | Buttons, highlights | 7.0:1 |
| `--accent-green` (#7bc47f) | Links, focus rings | 7.2:1 |

### Typography

The application uses **Atkinson Hyperlegible** as the primary font, designed by
the Braille Institute specifically for improved legibility and readability for
users with low vision.

### Live regions

Dynamic content updates are announced to screen readers:

```html
<div class="results-grid" aria-live="polite">
    <!-- Calculation results update here -->
</div>

<div class="glossary-list" aria-live="polite">
    <!-- Filtered content updates here -->
</div>
```

### Tables

Data tables include proper accessibility markup:

```html
<table aria-label="Soap properties analysis">
    <thead>
        <tr>
            <th scope="col">Property</th>
            <th scope="col">Range</th>
            <th scope="col">Recipe</th>
        </tr>
    </thead>
    ...
</table>
```

### Icon buttons

Icon-only buttons include descriptive `aria-label` attributes:

```html
<button aria-label="Lock Olive Oil for scaling" aria-pressed="false">🔓</button>
<button aria-label="Remove Olive Oil from recipe">×</button>
```

### Status indicators

Property values use both colour AND text indicators for in-range/out-of-range
status. In-range values show a checkmark (✓) prefix; colour alone is not used
to convey information.

### WCAG 2.2 specific criteria

**2.4.11 Focus Not Obscured (Minimum) - AA**: When info panels are open, the
main content is marked with the `inert` attribute, preventing keyboard focus
from moving to obscured elements behind the panel overlay.

**2.5.8 Target Size (Minimum) - AA**: All interactive elements maintain a
minimum target size of 24×24 CSS pixels:

| Element | Size |
| ------- | ---- |
| `.help-tip` | 24×24px minimum |
| `.info-link`, `.fa-link`, `.panel-tag` | 24px minimum height |
| `.lock-fat`, `.remove-fat` | 32×32px (28×28px mobile) |
| `.close-panel` | 36×36px |

**3.3.7 Redundant Entry - AA**: Recipe state is automatically persisted to
localStorage, so users don't need to re-enter information after page refresh.

### Accessibility testing

1. Keyboard-only navigation: Tab, Shift+Tab, Enter, Space, Escape
2. Screen reader testing: NVDA (Windows), VoiceOver (macOS), Orca (Linux)
3. Colour contrast: browser dev tools or axe-core
4. Focus visibility: ensure all focused elements have visible indicators
5. Zoom testing: test at 200% and 400% zoom levels

---

## Future considerations

### Potential improvements

1. Module splitting: `ui.js` could be further split into focused modules
2. CSS utilities: common patterns could be extracted to utility classes
3. Unit tests: pure functions in `calculator.js` and `optimizer.js` are ideal
   candidates
4. TypeScript: adding type definitions would improve maintainability

### Deliberately not implemented

- State library: custom reactive state is sufficient; no need for Redux/MobX
- Build system: ES modules work natively; no bundler required
- CSS framework: custom CSS matches design needs exactly
- CSS modules: would require build step and break HTML/JS class references

### Accessibility enhancements

- Some dynamically generated content may benefit from additional
  `aria-describedby` associations
