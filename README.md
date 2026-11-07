# Pentanela vendor workspace

Angular 22 + Tailwind CSS 4 frontend, redesigned using the supplied Pentanela logo. The actual source is in D:\Pentanela\Frontend\Pentanela-dashboard-phase1.

## Run

Use a Node version compatible with the package.json engines. Verified here with Node 26.13.0.

```sh
npm ci
npm start
```

npm start serves HTTPS using a local development certificate. npm run start:http is available for local UI tests. The existing proxy.conf.json sends /api requests to https://Pentanela.runasp.net. Real authentication against a Secure cookie should use HTTPS. Tests intercept all API calls and do not contact that server.

## Build and test

```sh
npm run build:production
npx playwright install chromium
npm test
```

The production build is written to dist/Pentanela/browser. The Playwright suite covers navigation, filters, pagination, account context, login/logout, errors, empty/loading states, admin route restrictions, mobile focus trapping, reduced motion, responsive layout, and axe accessibility checks. Fixtures live only under tests/. Screenshots and HTML test results are local test artifacts, not production assets.

## Implemented

- Fixed desktop navigation and accessible mobile drawer.
- Reusable top message area through core/state/notice.service.ts.
- Branded sign-in, overview, account directory, and application configuration.
- Vendor creation, editing, deletion, token exchange tests, and masked credential inspection.
- Product creation, details, confirmed deletion, server search, status filtering, and pagination.
- Purchase order details with validated, per-item local acknowledgments.
- Excel and JSON product batches, template downloads, batch details, item errors, and status refresh.
- Application credential settings, CSV/JSON profile imports, partial import results, and token validation.
- Administrator team listing and user creation.
- Same-origin API access, in-memory account context, and no browser persistence of credentials.
- Clear global totals, local search scope, recorded credential verification, and unverified live synchronization.

All 34 operations in the supplied Swagger document are connected. Credential/account management controls and team creation are shown to administrators. These UI restrictions do not replace server-side authorization. The existing backend still stages feeds and records order acknowledgments locally; the interface states those limits. Production backend hardening remains outside this frontend integration. See BACKEND_INTEGRATION_PLAN.md and SECURITY_BACKEND_HANDOFF.md for backend details.

## Code map

- src/styles.css: Tailwind import, OKLCH tokens, shared components, responsive rules.
- src/app/layout/shell.component.ts: sidebar, drawer, top bar, account selector, messages.
- src/app/features/: route-level views.
- src/app/core/: typed HTTP models, services, session guards, and memory state.
- src/app/shared/icon.component.ts: consistent SVG icon set.
- PRODUCT.md / DESIGN.md: product context and design decisions.
- tests/: isolated browser fixtures and end-to-end checks.

## Deployment

Serve Angular and /api behind the same HTTPS origin. Configure /api routing before SPA fallback. The backend must enforce authorization, antiforgery, secure sessions, safe errors, and trusted proxy settings. Move Swagger away from the public application root or restrict its access.

The logo is preserved as uploaded. Its artwork spells Pentanela; existing application copy retains Pentanela.

## Integration checks

Browser tests intercept API calls, including every mutation. They verify request bodies, multipart field names, template downloads, conflict recovery, deletion confirmation, secret-preserving account updates, local order acknowledgments, profile import results, session expiry, account changes, and desktop/mobile accessibility. No live business records are created by the suite. A separate unauthenticated connectivity check confirmed HTTP 401 from the hosted session endpoint and through the development proxy; authenticated live workflows require a real employee session.
