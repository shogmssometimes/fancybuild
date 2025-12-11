# Collapse PWA — Mobile-First UI Redesign

This document contains iterative prompts and practical guidance for refactoring the mobile UI / deck-builder experience into a dense, game-like, mobile-first design.

We provide four iterations:
1. Concise prompt (for design review)
2. Expanded prompt (rationale & examples, for product managers and designers)
3. Developer-focused spec (CSS tokens, layout, component structure)
4. Accessibility & testing checklist (QA + inference rules)

----

## Iteration 1 — Concise Prompt (Designer-friendly)

Goal
- Make the Collapse deck builder feel like a dense, fast, mobile-first deck builder with minimal scrolling. Keep functionality, but reduce visual clutter and increase information density.

Design Principles
- Edge-to-edge content (no big boxes)
- Tight vertical rhythm (~-40% global padding)
- Compact typography scale — three levels only: Page title, Section title, Body/metadata
- Two-line card rows: name + counter on first line, metadata on second line
- Compact controls (tiny counters) aligned inline with names
- Use a 2-column metadata grid for attributes
- No large borders or heavy shadows — dark near-black background with subtle neon accents

Key Acceptance Criteria
- Reduce number of visible sections that use boxed containers
- Increase cards visible per mobile viewport by 25% (visual target)
- One-line summaries where possible; compact two-line card rows

----

## Iteration 2 — Expanded Prompt (Rationale, UX & Visual direction)

High-level intent
- Reduce 'document' feel — the UI should be a compact, tool-like experience for quick decisions.
- Avoid modal/box-heavy visual design — prefer edge-to-edge lists.
- Make it feel like Slay the Spire / MTG Arena lite — readable but tightly packed rows for rapid scanning.

What to remove
- Heavy bordered rectangles and visibly separated boxes for sections. Replace with edge-to-edge blocks or subtle separators (hairlines, faint color differences) and tighter spacing.

Spacing & Rhythm
- Reduce global padding and margins by ~40% from the current scale. Example: if body padding is 16px, use 10px; if list rows were 12px vertical padding, use 6–8px.
- Reduce vertical spacing between titles and rows to 8px or less.
- Use consistent spacing tokens for vertical rhythm: small (4px), medium (8px), large (16px) used only for major separations).

Typography
- Use a compact scale with three levels:
  - Page title: 18–20px, bold
  - Section title: 14–15px, semi-bold
  - Body/metadata: 12–13px, regular
- For dense lists, reduce body text to 12px while preserving legibility (line-height ~1.1–1.25).

Metadata & Layout
- Show attributes in two compact columns. For example:
  - Left cell: Rarity • Skill • Base
  - Right cell: Capacity • Cost • Set
- Ensure values rarely wrap — use ellipsis for overly long names or adjust metadata order priority.

Card Row Design
- Example compact card row:
  - Row 1: Left-aligned `Card Name`, right-aligned `- counter +`
  - Row 2: smaller `Rarity • Skill • Base` (metadata)
- Keep counters small (32–36px high max) and aligned vertically with the name.
- Tap targets should maintain at least 44x44 px overall hit area, but visually the control can be smaller than the hit area.

Controls & Interactivity
- Keep controls inline and minimal: small icons `–` and `+` next to counts; long press shows count input modal.
- Avoid separate buttons in their own box or rows; use inline controls with limited padding.

Colors & Brand
- Keep the existing near-black palette with subtle neon/cyan accents.
- Avoid heavy shadows, use a soft outline for focus states only.

Behavior & Motion
- Use quick, snappy interactions (no long animation delays). A 100–160ms scale or opacity micro-animation is ideal.
- Use Haptic feedback on supported devices for library changes (counts increment/decrement).

----

## Iteration 3 — Developer-Focused Implementation Spec

Global variables / token suggestions (SCSS or CSS variables)
```scss
:root {
  --gap-small: 4px;         // tiny
  --gap-1: 8px;             // small
  --gap-2: 12px;            // medium
  --gap-3: 16px;            // large (rare)

  // typography
  --type-page: 20px;        // Page title
  --type-section: 14px;     // Section title
  --type-body: 12px;        // Body / metadata

  // controls
  --counter-size: 34px;
  --hit-area: 44px;         // minimal touch target, visually less

  // colors
  --bg-dark: #0b0b0c;
  --accent: #0ff6ff;        // neon / cyan accent
  --muted: #9aa4b2;
  --separator: rgba(255,255,255,0.06);
}
```

Layout & CSS rules (compact list)
- Edge-to-edge content in list containers
  - replace `.card-container { box-shadow/rounded/outer-padding }` with `padding: var(--gap-1) 0; border-radius: 0; background: transparent;` or similar.
- Card rows
  - HTML structure:
  ```html
  <div class="card-row">
    <div class="row-top">
      <span class="card-name">Religion</span>
      <div class="card-counter">- 0 +</div>
    </div>
    <div class="row-meta">Rarity • Skill • Base</div>
  </div>
  ```
  - CSS examples (purely approximate):
  ```scss
  .card-row { padding: var(--gap-1) var(--gap-1); display: block; }
  .row-top { display:flex; align-items:center; justify-content: space-between; gap: 8px; }
  .card-name { font-size: var(--type-body); line-height: 1.15; max-width: 70%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-counter { min-width: var(--counter-size); height: var(--counter-size); display:flex; align-items:center; justify-content:center; gap:4px; }
  .row-meta { font-size: var(--type-body); color: var(--muted); margin-top: 2px; }
  ```

- Metadata grid (two columns)
  - Use left-col / right-col grid and reduce spacing.
  ```scss
  .meta-grid { display:grid; grid-template-columns: 1fr 1fr; gap: var(--gap-1); font-size: var(--type-body) }
  .meta-col { display:flex; align-items:center; gap: 8px } 
  ```

- Controls
  - small +/- button styles with condensed padding
  - markup pattern: `button.counter.minus` `span.count` `button.counter.plus`
  - ensure `button` has `min-width` for accessibility but visually small padding.

- Headers & section titles
  - Use small, unobtrusive section headers with `margin-block: var(--gap-1)`
  - Avoid heavy backgrounds.

- Remove card body boxes
  - Convert from `box` to `list` and move background to page layer (e.g. subtle color strip for each list) only if needed.

Edge cases & responsive rules
- Long names: truncate with ellipsis and allow long-press to expand tooltip or overlay.
- Large metadata: reorder by priority to show the most important fields when space is constrained.
- Small screens vs tablets: keep tokens consistent but increase the grid columns on tablets (3 columns maybe).

Developer tasks & PR notes
- Implement CSS variable tokens in `collapse_web/styles` (or the main CSS module)
- Replace `boxed` components with simple row list UI while maintaining accessibility and keyboard navigation.
- Add test ID attributes for critical components for QA / automation.

 - Live preview: add an opt-in `compact` mode toggle to the Deck Builder so designers/devs can test and compare the compact layout with the default layout. (Implementation note: a simple stateful toggle in `DeckBuilder` applies `compact` class to grids/cards.)


## Iteration 4 — Accessibility & QA Checklist (Acceptance Testing)

Functional behavior & touch targets
- All interactive items have at least 44x44 px hit area even if visually smaller.
- Decrement/Increment controls are reachable and keyboard accessible.
- Counter changes are announced via ARIA live regions for screen readers.

Color & contrast
- Primary body text is at least WCAG AA contrast against the near-black background.
- Accent colors used sparingly and with sufficient contrast for disabled states.

ARIA & semantics
- Use `<button>` for interactive items, semantic `list` for card rows.
- Add `aria-label`, `aria-live` regions for counter updates.

Performance & UX
- Goal: 25% more visible cards per mobile viewport than the current UI.
- Scroll depth test: shipping set of UI changes should reduce vertical scroll depth by a measurable margin.
- Micro-interactions are snappy (<160ms) and do not block the main thread.

Testing guidelines
- Use Lighthouse Mobile performance / accessibility tests.
- Use minimal visual snapshot tests in Jest / Cypress per mobile-like viewport (e.g. 360x780).
- A/B test with existing UI to verify improved scanning speed / drop-off.

----

## Implementation Example — Compact Card Row HTML + CSS

A small HTML/CSS snippet to guide the builder. This is to show structure only:

```html
<div class="card-row" role="listitem">
  <div class="row-top">
    <span class="card-name">Religion</span>
    <div class="card-controls">
      <button class="btn minus" aria-label="Remove card">-</button>
      <span class="count" aria-live="polite">0</span>
      <button class="btn plus" aria-label="Add card">+</button>
    </div>
  </div>
  <div class="row-meta">Rarity • Skill • Base</div>
</div>
```

```scss
.card-row { display:block; padding: var(--gap-1) 0; border-bottom: 1px solid var(--separator); }
.row-top { display:flex; align-items:center; justify-content: space-between; gap: 8px; }
.card-name { font-size: var(--type-body); max-width: 66%; white-space: nowrap; overflow:hidden; text-overflow:ellipsis; }
.card-controls { display:flex; align-items:center; gap: 6px; }
.btn { display:inline-flex; align-items:center; justify-content:center; height: var(--counter-size); min-width: var(--counter-size); background: transparent; color: var(--accent); border: none; }
.count { font-size: var(--type-body); color: var(--muted); min-width: 28px; text-align:center; }
.row-meta { font-size: var(--type-body); color: var(--muted); margin-top: 2px; }
```

----

## Acceptance Criteria — Checklist for a PR
- [ ] `collapse_web` header is edge-to-edge on mobile with no boxed container
- [ ] Card rows are in a list layout with compact controls inline
- [ ] Global padding reduced by ~40% (from baseline tokens)
- [ ] Typography follows three-level scale and sizes are updated in tokens
- [ ] Metadata uses a two-column grid on small screens
- [ ] Accessibility: ARIA attributes, 44x44 hit area, counter announcements
- [ ] Performance: no regression in Lighthouse mobile scores
- [ ] QA: screenshot tests for the main list view in mobile screen size

----

## Developer / Design Notes & Prioritization
- Start by reducing container padding and replacing boxed UI with list rows (low risk).  
- Change card row spacing and add the compact counter controls (moderate risk).  
- Replace stacked metadata with a 2-column grid and tune truncation (higher risk — functional testing required).
- Accessibility and performance checks should be done before shipping.

----

## Optional: A/B or rollout approach
- Step 1: Launch an opt-in toggle in the UI for compact view. This allows users to switch if they prefer the older look.
- Step 2: Monitor usage and performance metrics (cards visible per viewport, average scroll depth, user retention in the builder). If metrics are favorable, roll out default for new users.

----

## Quick Mockup / Wireframe Notes (for designers)
- Use a vertical list with small separators and inline counters.
- For metadata, use small label chips in subdued colors or a simple bullet separator.
- Keep the overall dark aesthetic and cyan accents, but reduce glow / neon intensity.

----

## Closing
Use the above spec as a practical starting point for implementation. If you’d like, I can produce a small CSS patch or a prototype PR that implements the `card-row` layout and tokens to show the visual direction in the repository.
