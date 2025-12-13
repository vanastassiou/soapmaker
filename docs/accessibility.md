# Accessibility Implementation

This document describes the accessibility features and design decisions implemented in the Soap Recipe Builder application.

## WCAG Compliance Target

The application targets **WCAG 2.2 Level AA** compliance.

## Implementation Summary

### Semantic HTML Structure

| Element | Purpose |
|---------|---------|
| `<html lang="en">` | Language declaration for screen readers |
| `<main>` | Landmark for main content area |
| `<header>` | Page header landmark |
| `<nav>` | Navigation landmarks |
| `<article>` | Glossary entries (self-contained content) |
| Heading hierarchy | h1 → h2 → h3 → h4 (no skipped levels) |

### Skip Link

A visually hidden skip link appears at the top of each page when focused, allowing keyboard users to bypass navigation and jump directly to main content.

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

CSS positions the link off-screen until focused:

```css
.skip-link {
    position: absolute;
    top: -40px;
    /* ... */
}
.skip-link:focus {
    top: 0;
}
```

### Tab Controls (ARIA Tabs Pattern)

The build mode tabs follow the WAI-ARIA tabs pattern:

```html
<div role="tablist" aria-label="Recipe build mode">
    <button role="tab" aria-selected="true" aria-controls="selectFatsMode">...</button>
    <button role="tab" aria-selected="false" aria-controls="specifyPropertiesMode">...</button>
</div>
<div role="tabpanel" aria-labelledby="tab-fats">...</div>
```

JavaScript updates `aria-selected` when tabs are switched.

### Dialog Panels

Info panels (fat info, glossary, fatty acid) implement the dialog pattern:

```html
<div class="info-panel" role="dialog" aria-modal="true" aria-labelledby="fatPanelName">
    <button class="close-panel" aria-label="Close panel">×</button>
    <h3 id="fatPanelName">...</h3>
</div>
```

Focus management:

- Focus moves to close button when panel opens
- Escape key closes the panel
- Focus returns to the triggering element on close

### Keyboard Accessibility

All interactive elements are keyboard accessible:

| Element | Implementation |
|---------|---------------|
| Buttons | Native `<button>` elements |
| Clickable spans (`.info-link`, `.fa-link`) | `role="button"` + `tabindex="0"` + Enter/Space handlers |
| Fat name links in recipe | `role="button"` + `tabindex="0"` + keyboard handlers |
| Panel tags | `role="button"` + `tabindex="0"` + keyboard handlers |

### Focus Indicators

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

### Color Contrast

All colour combinations meet WCAG AA (4.5:1) contrast ratios:

| Color | Use | Contrast Ratio |
|-------|-----|----------------|
| `--text-primary` (#e8efe9) | Body text | 12.8:1 |
| `--text-secondary` (#a8b5ab) | Secondary text | 6.5:1 |
| `--text-muted` (#7d8a80) | Muted text | 4.5:1 |
| `--accent-gold` (#d4a84b) | Buttons, highlights | 7.0:1 |
| `--accent-green` (#7bc47f) | Links, focus rings | 7.2:1 |

### Typography

The application uses **Atkinson Hyperlegible** as the primary font, designed by the Braille Institute specifically for improved legibility and readability for users with low vision.

### Live Regions

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

### Icon Buttons

Icon-only buttons include descriptive `aria-label` attributes:

```html
<button aria-label="Lock Olive Oil for scaling" aria-pressed="false">🔓</button>
<button aria-label="Remove Olive Oil from recipe">×</button>
```

### Status Indicators

Property values use both colour AND text indicators for in-range/out-of-range status:

- In-range values show a checkmark (✓) prefix
- Color alone is not used to convey information

## File Changes Summary

### HTML (`index.html`, `glossary.html`)

- Added skip links
- Added `<main>` landmarks
- Added ARIA roles to tab controls and panels
- Added `aria-label` to icon buttons
- Added `scope` attributes to table headers
- Added `role="button"` and `tabindex="0"` to clickable spans

### CSS (`styles.css`)

- Added skip link styles with focus visibility
- Existing focus ring styles maintained

### JavaScript (`main.js`, `ui.js`, `glossary.js`)

- Added keyboard handlers (Enter/Space) for custom interactive elements
- Added focus management for panels (move focus, return focus, Escape key)
- Added `aria-selected` state updates for tabs

## Testing Recommendations

1. Keyboard-only navigation: navigate the entire app using only Tab, Shift+Tab, Enter, Space, and Escape
2. Screen reader testing: test with NVDA (Windows), VoiceOver (macOS), or Orca (Linux)
3. Colour contrast: verify with browser dev tools or axe-core
4. Focus visibility: ensure all focused elements have visible indicators
5. Zoom testing: test at 200% and 400% zoom levels

## WCAG 2.2 Specific Criteria

### 2.4.11 Focus Not Obscured (Minimum) - AA

When info panels are open, the main content is marked with the `inert` attribute, preventing keyboard focus from moving to obscured elements behind the panel overlay.

```javascript
// helpers.js
export function openPanel(panelId, overlayId) {
    // ...
    const mainContent = document.querySelector('main, .container');
    if (mainContent) {
        mainContent.setAttribute('inert', '');
    }
}
```

### 2.5.8 Target Size (Minimum) - AA

All interactive elements maintain a minimum target size of 24×24 CSS pixels:

| Element | Implementation |
|---------|---------------|
| `.help-tip` | `min-width: 24px; min-height: 24px` |
| `.info-link` | `min-height: 24px` |
| `.fa-link` | `min-height: 24px` |
| `.panel-tag` | `min-height: 24px` |
| `.related-term` | `min-height: 24px` |
| `.remove-exclusion` | `min-width: 24px; min-height: 24px` |
| `.lock-fat`, `.remove-fat` | 32×32px (28×28px mobile, above minimum) |
| `.close-panel` | 36×36px |

### 2.5.7 Dragging Movements - AA

Not applicable - the application does not use drag-based functionality.

### 3.2.6 Consistent Help - AA

Not applicable - no persistent help mechanism is provided.

### 3.3.7 Redundant Entry - AA

Recipe state is automatically persisted to localStorage, so users don't need to re-enter information after page refresh or navigation.

### 3.3.8 Accessible Authentication (Minimum) - AA

Not applicable - the application does not require authentication.

## Remaining Considerations

- Arrow key navigation within tablists not implemented (optional enhancement per WAI-ARIA best practices)
- Some dynamically generated content may benefit from additional `aria-describedby` associations
