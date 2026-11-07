# Pentanela design system

## Scene and theme

An operations employee reviews accounts on a laptop in a normally lit office throughout the working day. A light canvas keeps dense records legible; the fixed deep-blue navigation anchors the workspace.

## Brand

Use the original logo at public/assets/Pentanela-logo.png. The emblem supplies deep blue, a secondary medium blue, white, and gold. Gold is an accent for identity, attention, and current selection; it is not used for low-contrast body text.

## Color strategy

Restrained product surfaces with a committed blue navigation region. Colors are implemented as OKLCH custom properties in src/styles.css and exposed through Tailwind v4 @theme.

- Primary blue: oklch(40% .103 248)
- Sidebar blue: oklch(32% .072 249)
- Canvas: oklch(97.6% .006 248)
- White surface: oklch(99.7% .001 248)
- Gold: oklch(79% .151 94)
- Text: oklch(29% .035 248)
- Secondary text: oklch(49% .025 248)
- Success: green plus a text label; errors: red plus a text explanation

## Typography and spacing

Use the system Segoe UI stack without remote font requests. Page headings are 32px desktop and 28px phone, section titles 19px, controls 12–13px, and secondary annotations 10–12px. Use 24–34px page gutters, 20–25px panel padding, and 7–10px corner radii.

## Structure

Desktop: fixed 248px navigation (228px at smaller desktop widths), full-height independent sidebar scrolling, flexible main canvas. Under 1024px: off-canvas drawer with backdrop, focus trap, background inertness, scroll locking, Escape, and focus return. At 767px and below: two-column metrics and stacked content. Wide tables scroll within a labelled region; the page does not scroll sideways.

The top message area is reusable through NoticeService. Messages can be dismissed and restored with the header bell. Overview totals remain explicitly company-wide. Account-scoped records use the working-account selector.

## Components

Use the shared SVG icon component; do not mix Unicode navigation glyphs with icons. Buttons have hover, focus, active, disabled, and loading states. Tables have header scopes, row hover, selection state, search, and pagination where supported. Empty, loading, denied, and failed data have separate presentations. Operational forms open inline above their list, use labelled native controls, disable duplicate submissions, preserve values after errors, and close when account scope changes. Destructive actions require an inline confirmation. Credential inputs use password fields and are cleared after successful submission.

## Motion

Use 150–220ms opacity, transform, background, and color transitions. No layout-property animation. Motion communicates drawer movement, hover affordance, and message changes. Disable animations and transitions when prefers-reduced-motion is set.

## Verification

Playwright covers behavior and five viewport widths. Axe checks desktop screens, mobile screens, and the open navigation drawer. Screenshots use test fixtures only; production source contains no fixture dataset.
