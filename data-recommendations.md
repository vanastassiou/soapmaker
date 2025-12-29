# Data standardization recommendations

Analysis of `data/` directory patterns and recommendations for consolidation.

## Summary

The data structure is well-organized overall. Main issues are schema inconsistencies
and incomplete data.

---

## High priority

### 1. Remove unused `reference` definition

`common-definitions.schema.json` defines both `reference` (singular) and `references`
(array). Only `references` is ever used across all 10 schemas.

**Action:** Delete the unused `reference` definition from
`data/schemas/common-definitions.schema.json`.

### 2. Normalize fats usage pattern

Fats use a simpler structure than other additives:

```json
// fats.json (current)
"usage": { "min": 5, "max": 30 }

// other additives (common-definitions pattern)
"usage": { "min": 1, "max": 3, "basis": "oil-weight" }
```

**Action:** Add `basis: "total-oils"` to fats usage and update the schema to use the
common definition. This enables consistent handling across all additive types.

### 3. Simplify safety-related definitions

`casNumber` and `maxConcentration` are defined as standalone patterns in
common-definitions but only ever used within the `safety` wrapper.

**Action:** Inline these into the `safety` definition rather than maintaining them as
separate reusable patterns.

---

## Medium priority

### 4. Standardize description format

Fats use HTML tags (`<i>Prunus armeniaca</i>`) while all other files use plain text.

**Action:** Convert to a consistent format. Options:

- Strip HTML, use plain text everywhere
- Use markdown-style italics (`*Prunus armeniaca*`) if formatting is needed

### 5. Complete ethicalConcerns data

18 of 59 fats (31%) have empty arrays for all three concern categories
(environmental, social, political). Either:

- Fill in the missing data
- Make the fields optional in the schema with explicit `null` for "not researched"

### 6. Add missing CAS numbers

3 skin-care entries lack CAS numbers: `flax-seed-powder`, `hemp-seed-powder`,
`poppy-seed-powder`. All other additive types have 100% coverage.

---

## Low priority

| Issue                             | Recommendation                                              |
| --------------------------------- | ----------------------------------------------------------- |
| Sparse `commonAllergen` field     | Only 19% of fats flagged - review if more should be marked  |
| References in equipment/processes | 8/10 equipment and both processes have references - consider making universal |
| `tooltips.json` undocumented      | Not in CLAUDE.md - verify if intentional                    |

---

## Current pattern coverage

| Pattern         | Files using         | Notes                        |
| --------------- | ------------------- | ---------------------------- |
| references      | 10/10               | Universal, working well      |
| dietary         | 5/5 additive types  | Good coverage                |
| ethicalConcerns | 5/5 additive types  | 31% incomplete in fats       |
| sourcing        | 5/5 additive types  | Excellent consistency        |
| usage           | 4/5 additive types  | Fats deviate from pattern    |
| safety          | 4/5 additive types  | Not applicable to fats       |

The schema architecture is sound. The main work is aligning fats with the common
usage pattern and cleaning up data quality issues.
