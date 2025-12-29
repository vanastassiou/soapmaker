# Design Decisions

This document describes the architectural decisions and patterns used in the Soap Recipe Builder application.

<!-- toc -->
<!-- tocstop -->

---

## Module Architecture

### Directory Structure

```
js/
├── core/           # Pure business logic (no DOM)
│   ├── calculator.js   # Lye, water, fatty acid calculations
│   └── optimizer.js    # Recipe optimization algorithms
├── lib/            # Shared utilities and constants
│   ├── constants.js    # All magic numbers, IDs, messages
│   └── validation.js   # JSON schema validation
├── state/          # State management
│   └── state.js        # Reactive proxy-based state
├── ui/             # UI layer
│   ├── components/     # Reusable UI components
│   │   ├── itemRow.js      # Fat/additive row rendering
│   │   └── toast.js        # Toast notification system
│   ├── helpers.js      # DOM utilities, event delegation
│   ├── ui.js           # Main UI rendering functions
│   └── finalRecipe.js  # Final recipe display
└── main.js         # Application entry point
```

### Separation of Concerns

- Core layer: pure functions with no DOM dependencies, easily testable
- State layer: centralized reactive state with localStorage persistence
- UI layer: all DOM manipulation isolated here
- Entry point: event binding and orchestration only

---

## Reusable Components

### Item Row Component (`js/ui/components/itemRow.js`)

A unified component for rendering fat and additive rows, eliminating duplication across:

- Main recipe list
- YOLO recipe list
- Additives list

Usage:

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

### Toast Notifications (`js/ui/components/toast.js`)

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

## State Management

### Reactive Proxy Pattern

State changes automatically trigger UI updates via ES6 Proxy:

```javascript
const state = createReactiveState({
    recipe: [],
    lockedFatIndex: null,
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

### Persistence

State is automatically persisted to localStorage:

- Recipe configuration
- Settings (lye type, superfat, water ratio, unit)
- Additives

---

## Error Handling

### Pattern: Toast over Alert

All user-facing errors use the toast system:

| Scenario | Toast Type | Example |
|----------|------------|---------|
| Validation error | `error` | "Hardness + Conditioning should be around 100" |
| Duplicate item | `warning` | "This fat is already in your recipe" |
| Missing input | `info` | "Please enter at least one property target" |
| Generation failure | `warning` | "Could not generate a valid recipe" |

### Centralized Messages

All user-facing messages are in `UI_MESSAGES` constant:

```javascript
import { UI_MESSAGES } from './lib/constants.js';

toast.warning(UI_MESSAGES.FAT_ALREADY_EXISTS);
```

---

## Accessibility Patterns

### Arrow Key Navigation for Tabs

WCAG 2.2 recommended pattern for tab lists:

```javascript
import { enableTabArrowNavigation } from './ui/helpers.js';

const tablist = document.querySelector('[role="tablist"]');
enableTabArrowNavigation(tablist, (tab) => {
    switchMode(tab.dataset.mode);
});
```

Supported keys:

- `ArrowRight`/`ArrowDown`: Next tab
- `ArrowLeft`/`ArrowUp`: Previous tab
- `Home`: First tab
- `End`: Last tab

### Event Delegation with Keyboard Support

```javascript
import { delegate, onActivate } from './ui/helpers.js';

// Click handler
delegate(container, '.clickable', 'click', handler);

// Keyboard handler (Enter/Space)
delegate(container, '.clickable', 'keydown', onActivate(handler));
```

### Focus Management

Info panels implement proper focus trapping:

1. Focus moves to close button on open
2. `inert` attribute prevents focus behind overlay
3. Focus returns to trigger element on close
4. Escape key closes panel

---

## Constants Organization

### Element IDs (`ELEMENT_IDS`)

All DOM element IDs centralized:

```javascript
const el = $(ELEMENT_IDS.recipeFats);
```

### Default Values (`DEFAULTS`)

Magic numbers for recipe defaults:

```javascript
DEFAULTS.FAT_WEIGHT          // 100 - default weight when adding fat
DEFAULTS.ADDITIVE_WEIGHT     // 10 - default weight when adding additive
DEFAULTS.BASE_RECIPE_WEIGHT  // 1000 - for percentage-to-weight conversion
DEFAULTS.YOLO_MIN_FATS       // 3 - minimum fats in YOLO recipe
DEFAULTS.YOLO_MAX_FATS       // 5 - maximum fats in YOLO recipe
```

### Property Ranges (`PROPERTY_RANGES`)

Recommended soap property ranges:

```javascript
PROPERTY_RANGES.hardness         // { min: 29, max: 54 }
PROPERTY_RANGES.degreasing       // { min: 12, max: 22 }
PROPERTY_RANGES.moisturizing     // { min: 44, max: 69 }
PROPERTY_RANGES['lather-volume'] // { min: 14, max: 46 }
PROPERTY_RANGES['lather-density']// { min: 16, max: 48 }
// etc.
```

### Calculation Thresholds (`CALCULATION`)

Thresholds for calculations:

```javascript
CALCULATION.DOMINANT_FATTY_ACID_THRESHOLD  // 10% - minimum for "dominant"
```

---

## CSS Architecture

### Cascade Layers

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

### CSS Custom Properties

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

### Container Queries

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

### Component Styling

Each component has isolated styles within appropriate layers:

- `.fat-row` - Recipe item rows
- `.toast` - Toast notifications
- `.info-panel` - Info panels

---

## Performance Patterns

### Lazy Loading

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

Core data (fats, glossary, formulas) loads at startup; additives (~100KB) are deferred.

### DOM Batching

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

### Production Validation Skip

Schema validation runs only on localhost:

```javascript
export function shouldSkipValidation() {
    const host = window.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
}
```

---

## Schema DRY-ness

### Shared Definitions

`common-definitions.schema.json` contains reusable patterns:

- `references` - Source citation arrays
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

## Future Considerations

### Potential Improvements

1. Module splitting: `ui.js` could be further split into focused modules (recipe, results, panels)

2. CSS utilities: common patterns (flex, grid, spacing) could be extracted to utility classes

3. Unit tests: pure functions in `calculator.js` and `optimizer.js` are ideal candidates for unit testing

4. TypeScript: adding type definitions would improve maintainability

### Deliberately Not Implemented

- State library: custom reactive state is sufficient; no need for Redux/MobX
- Build system: ES modules work natively; no bundler required
- CSS framework: custom CSS matches design needs exactly
- CSS modules: would require build step and break HTML/JS class references
