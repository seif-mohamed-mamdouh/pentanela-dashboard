# Pentanela vendor workspace

## Register

product

## Context

Established from the existing project README, Angular routes, .NET controllers, the supplied company logo, and the November 7, 2026 redesign brief. This is an internal operations application, not a marketing site.

## Users

Pentanela employees manage Amazon Vendor Central accounts, catalog products, purchase orders, and upload history. Administrators also review team membership and configure authorization.

## Product Purpose

Make the company's portfolio understandable, bring exceptions to the front, and help employees select the account they are working on. Employees create catalog drafts, prepare product batches, inspect processing errors, and record purchase-order acknowledgments. Administrators manage vendor accounts, application credentials, profile imports, and team creation while the backend's live Amazon integration is completed.

## Brand Personality

Professional, clear, dependable. The uploaded Pentanela logo is preserved as supplied; the application's existing Pentanela spelling is retained.

## Anti-references

The original interface's generic purple palette, tiny decorative glyphs, nonfunctional mobile menu, and navigation leading to development placeholders. Avoid decorative dashboards with invented metrics or simulated live Amazon success.

## Design Principles

- Make account scope explicit. The existing overview endpoint returns company-wide values.
- Show errors, empty results, and pending checks as distinct states.
- Use consistent navigation and controls across every module.
- Make the next useful action easy to find.
- Keep credential management in administrator workflows and keep secrets out of persistent browser storage. Explain backend processing limits in plain language.

## Accessibility & Inclusion

Implementation baseline: keyboard navigation, visible focus, labelled controls, semantic tables, status announcements, a trapped mobile drawer with Escape and focus return, and reduced-motion support. Check WCAG 2.1 AA rules with axe and inspect layouts manually. Automated checks do not constitute a complete accessibility certification.
