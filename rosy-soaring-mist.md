# Helper Text Usability Evaluation

## Current Helper Text Assessment

### Main Instructions (lines 37-40)
```
1. Adjust settings
2. Add fats
3. Create recipe
```
**Assessment:** Clear and minimal. Good for experienced users, but beginners may not understand *why* these steps matter or what "settings" to adjust.

### Build Mode Descriptions (lines 143-146)

| Mode | Current Text | Issue |
|------|--------------|-------|
| Select fats | "Choose fats to use in your recipe. You may lock a fat at its current weight." | "Lock" concept unexplained |
| Specify properties | "Enter target soap properties and find fats to match." | Assumes user knows what properties are desirable |
| YOLO | "Lock fats you like and re-roll the rest." | Jargon ("re-roll") may confuse non-gamers |
| Cupboard cleaner | "Enter fats you have. Get suggestions to improve your soap." | Clearest of the four |

### Properties Section (line 297)
```
"Derived from the recipe's fatty acid profile."
```
**Assessment:** Technical language that won't help beginners understand what they're looking at.

---

## Recommendations

### For Beginners
1. Add a "What does this mean?" or context sentence for unfamiliar terms like "superfat," "lye concentration," and "lock"
2. Replace jargon: "re-roll" → "randomize" or "generate new"
3. Add brief outcome hints: "Higher cleansing = strips more oils from skin"

### For Tech-Hesitant Users
1. The info icons are good but small — ensure they're easily discoverable
2. Consider adding a "Quick Start" or "Recommended for beginners" preset
3. The numbered steps are helpful but could benefit from a "Done? Click Create Recipe" prompt at the end

### Quick Wins (minimal changes)

**YOLO description:**
- Current: "Lock fats you like and re-roll the rest."
- Proposed: "Lock fats you like and **generate new ones** for the rest."

**Properties helper:**
- Current: "Derived from the recipe's fatty acid profile."
- Proposed: "These numbers predict how your soap will feel and perform."

**Lock buttons:**
- Consider adding tooltips on first interaction explaining what "Lock" does

---

## Files to Modify
- `index.html` (lines 143-146, 297)
