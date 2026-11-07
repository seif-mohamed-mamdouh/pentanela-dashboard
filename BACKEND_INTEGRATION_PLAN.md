# Pentanela: technical audit and SP-API integration plan

Reviewed November 7, 2026.

## Implemented frontend

Updated the actual Angular 22 project at D:\Pentanela\Frontend\Pentanela-dashboard-phase1. Added Tailwind CSS 4 with PostCSS, the supplied logo, blue/white/gold design tokens, fixed navigation, an accessible mobile drawer, a dismissible top message area, and redesigned sign-in, overview, and account directory.

The frontend now integrates all 34 operations from the supplied Swagger document. Account selection scopes supported lists; overview totals remain company-wide. Product search and status filters are sent to the server; order text search applies to the loaded page because the API does not provide order search. Array responses have no total, so Next is available when a full 25-record page is returned.

Vendor and application credential management is shown to administrators. Product drafts, bulk processing, and order acknowledgments are available to authenticated employees. Secrets are entered only for the requested management operation, cleared after successful submission, and never persisted to browser storage. All requests use the same-origin `/api` proxy and the existing HttpOnly session cookie. The frontend does not call Amazon directly.

### Endpoint coverage

| Screen | Integrated operations |
| --- | --- |
| Sign in / session | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Overview | `GET /api/dashboard/summary` |
| Vendor directory | `GET`, `POST /api/vendor-accounts`; `GET`, `PUT`, `DELETE /api/vendor-accounts/{id}`; `POST /api/vendor-accounts/{id}/test-connection`; `GET /api/vendor-accounts/{id}/credentials` |
| Products | `GET`, `POST /api/products`; `GET`, `DELETE /api/products/{id}` |
| Purchase orders | `GET /api/purchase-orders`, `GET /api/purchase-orders/{id}`, `POST /api/purchase-orders/acknowledge` |
| Bulk uploads | `POST /api/bulk-upload`, `POST /api/bulk-upload/excel`, `GET /api/bulk-upload/template/excel`, `GET /api/bulk-upload/vendor/{vendorAccountId}`, `GET /api/bulk-upload/batches/{id}`, `POST /api/bulk-upload/batches/{id}/refresh` |
| Amazon connection | `GET`, `POST /api/amazon-credentials`; `GET /api/amazon-credentials/status`; `GET /api/vendor-accounts/credentials`; `POST /api/vendor-accounts/upload-credentials`; `POST /api/vendor-accounts/upload-credentials-file`; `GET /api/vendor-accounts/template/csv`; `POST /api/vendor-accounts/validate-all-credentials` |
| Team members | `GET`, `POST /api/auth/users` |

### Request behavior

- Vendor creation requires name, vendor code, marketplace ID, and refresh token. Updates send an empty refresh token to retain it. Blank custom fields send `null` to preserve current credentials; the explicit removal checkbox sends empty strings, as required by the controller.
- Application saves require a new client secret even when only metadata changes. Date-only rotation input is submitted at midnight UTC.
- Excel uploads use multipart `VendorAccountId`, `File`, and optional `BatchReference`. Profile files use `File`, `OverwriteExisting`, and `ValidateImmediately`. No JSON Content-Type is forced on FormData.
- JSON profile imports send `profiles`, `overwriteExisting`, and `validateTokensImmediately`. The UI defaults overwrite to false and displays each failed/skipped result.
- Acknowledgments send every displayed line's `itemId`, string `status`, integer `acknowledgedQuantity`, and nullable `rejectionReason`. The UI permits acknowledgment of new orders and bounds quantities by ordered quantity.
- Deletes have an inline confirmation. Writes disable repeated submissions, retain input on errors, and surface string, message, error, and validation-problem responses. Credential writes, imports, and team creation clear entered secrets after success.

## Findings that affect integration

The local .NET 10 source was inspected and built. These findings concern that source, not a verified production deployment.

| Priority | Evidence in backend src/                                                                           | Finding and required action                                                                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Pentanela.Infrastructure/Services/AmazonFeedsService.cs:49–79                                      | Only LWA is called. Feed/document IDs are fabricated; even exceptions can return success; status always returns DONE. Replace this staging logic with real submissions, transaction checks, and processing results.                                                                                              |
| P0       | Pentanela.WebApi/Controllers/PurchaseOrdersController.cs:123                                       | Acknowledgment updates the local database only. Call the correct Vendor Orders API and reconcile Amazon transaction results before claiming acceptance.                                                                                                                                                          |
| P0       | Pentanela.WebApi/Program.cs:97 and controller authorization                                        | Credentialed CORS permits arbitrary origins. Account/credential endpoints use broad authenticated-user access without account assignments. Enforce trusted origins, per-user vendor access, and administrator-only credential operations.                                                                        |
| P0       | Program.cs; Controllers/AuthController.cs:72–80                                                    | Cookie authentication has no visible antiforgery validation. Login also returns a JWT in JSON. Issue only an HttpOnly, Secure session cookie and non-sensitive user response; add CSRF issuance/validation and revocable sessions. Ignoring the returned token in Angular does not prevent its browser exposure. |
| P0       | Pentanela.Domain/Entities/VendorAccount.cs; Infrastructure/Persistence/ApplicationDbContext.cs:147 | Secrets are assigned to ordinary string fields without visible encryption in this path. A fixed administrator seed also exists. Use managed secret storage/encryption, secure administrator provisioning, and rotate exposed seed access before deployment.                                                      |
| P1       | Infrastructure/Services/AmazonSpApiAuthService.cs:70–133                                           | Refresh-token/client-ID GetHashCode cache keys can collide and do not include credential version. Full LWA errors are logged/stored. Cache by authorization identity plus credential version, single-flight refresh, bounded expiry, and redacted errors.                                                        |
| P1       | Controllers/DashboardController.cs:48                                                              | Healthy is hard-coded; credential presence is not an SP-API operation check. Return last verified request, freshness, authorization state, and safe error codes.                                                                                                                                                 |
| P1       | Program.cs:26–27; AuthController.cs                                                                | Forwarded-header trust is unrestricted; production Secure cookies depend on request scheme. Configure trusted proxies, enforce HTTPS, validate active users, throttle login, and define session expiration/revocation.                                                                                           |
| P1       | dotnet build output                                                                                | System.Security.Cryptography.Pkcs 9.0.11 has NU1902/NU1903 vulnerability warnings. Update its dependency chain to a supported patched version and rebuild.                                                                                                                                                       |

Existing SECURITY_BACKEND_HANDOFF.md contains further security detail. Frontend guards and hidden controls do not enforce backend authorization.

## Secure authorization and request flow

**Architecture:** Angular → same-origin /api → authenticated .NET service → authorized vendor-group credential store → LWA/SP-API. Return only business data and sanitized connection metadata to Angular.

1. Confirm private vs public application, Vendor Retail Procurement vs Direct Fulfillment, approved roles, and target marketplaces. Amazon approval does not replace account authorization. For a company-only private application, self-authorize through Vendor Central and provision the resulting refresh token into backend secret storage. [Private authorization](https://developer-docs.amazon/sp-api/docs/self-authorization).
2. For a public application, the backend creates a short-lived, single-use state tied to the employee, vendor account, and allowlisted return path. Send the user to the appropriate Vendor Central consent page. The backend callback validates state, then exchanges spapi_oauth_code within five minutes, stores the refresh token, and redirects to a clean frontend URL. Reject mismatches and replays; do not pass tokens or authorization codes into Angular. [Website authorization](https://developer-docs.amazon/sp-api/docs/website-authorization-workflow).
3. Model authorization separately from vendor codes: one vendor group can contain multiple codes. Associate each operation with the correct group's authorization. [Vendor groups](https://developer-docs.amazon/sp-api/docs/authorize-your-application-to-access-vendor-groups).
4. The server exchanges refresh_token, client_id, and client_secret at the LWA token endpoint. Cache access tokens according to expires_in, with an expiry safety margin and invalidation on credential changes. Set x-amz-access-token and required headers on regional SP-API requests. Current SP-API connection examples do not require SigV4 signing. Obtain an RDT only for restricted operations that require one. [Connection and headers](https://developer-docs.amazon/sp-api/docs/connecting-to-the-selling-partner-api).
5. Egypt uses the EU SP-API endpoint. Choose the endpoint from marketplace configuration; do not infer it from the employee's browser location. [Regional endpoints](https://developer-docs.amazon/sp-api/docs/sp-api-endpoints).
6. Run synchronization in background jobs with per-operation/account throttling, bounded exponential backoff with jitter, and safe handling of 429/5xx responses. Reconcile ambiguous writes before retrying; never turn a timeout into success. [Usage plans](https://developer-docs.amazon/sp-api/docs/usage-plans-and-rate-limits).

## Frontend/backend interfaces

**Core list/session contracts; retain these shapes while adding server authorization:**

| Method and route                                              | Browser use                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| POST /api/auth/login; GET /api/auth/me; POST /api/auth/logout | Employee session. Login currently discards token response; backend must remove it.  |
| GET /api/dashboard/summary                                    | Global totals. Do not mix currencies in a monetary total without currency metadata. |
| GET /api/vendor-accounts                                      | Browser-safe account metadata and recorded credential status.                       |
| GET /api/products?vendorAccountId=&page=&pageSize=            | Products; current response is an array without a total.                             |
| GET /api/purchase-orders?vendorAccountId=&page=&pageSize=     | Orders, with explicit currency per row.                                             |
| GET /api/bulk-upload/vendor/{vendorAccountId}                 | Selected-account upload history; recorded statuses are not Amazon acceptance.       |
| GET /api/auth/users                                           | Administrator-only team listing.                                                    |

**Proposed additions, not implemented server endpoints:**

| Interface                                                   | Minimum contract                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/security/csrf                                      | Issue the Angular XSRF-TOKEN cookie; validate X-XSRF-TOKEN on mutations. Bootstrap/renew it before sign-in and after session changes.                                     |
| POST /api/amazon/authorizations                             | Public app only: accountId + allowlisted return path → authorizationUrl. Require administrator permission and CSRF.                                                       |
| GET /api/amazon/authorizations/callback                     | Amazon redirect target; validates state/code server-side, then redirects without secrets.                                                                                 |
| GET /api/vendor-accounts/{id}/connection                    | state, checkedAtUtc, lastSuccessfulSyncAtUtc, grantedCapabilities, safeErrorCode, reauthorizationRequired.                                                                |
| POST /api/vendor-accounts/{id}/sync → GET /api/jobs/{jobId} | 202 with jobId; status queued/running/succeeded/failed, progress, safe errors, timestamps.                                                                                |
| GET /api/announcements                                      | id, severity, title, message, startsAtUtc, expiresAtUtc, dismissible, optional internal action route. Current top messages are local UI state, not fetched announcements. |
| Versioned list/error responses                              | Lists: items + total/hasMore or cursor. Errors: code, safe message, traceId, optional retryAfterSeconds and fieldErrors.                                                  |

All account identifiers are authorization checks, not trusted client input. Keep credentials, raw LWA responses, and token fragments out of every response.

## Delivery order and acceptance

1. Secure sessions, secrets, account assignments, CORS, proxies, and dependency updates.
2. Connect one authorized vendor group; prove one real read request and distinguish LWA validity from actual SP-API access.
3. Implement the appropriate vendor orders, shipments, invoices, and report workflows. Validate catalog operations against granted roles and product-type schemas rather than assuming a generic feed fits every vendor. [Vendor API directory](https://developer-docs.amazon/sp-api/docs/sp-api-vendor-use-cases).
4. Replace staging feeds and local-only acknowledgments with queued, reconcilable operations. Surface accepted, processing, partially failed, and completed states only from actual results.
5. Add announcements and supported Amazon events through the backend. Test expired authorization, revoked roles, account isolation, CSRF, 429s, duplicate writes, and partial processing before production rollout.

No real Amazon credentials were requested or used, and automated tests do not mutate the hosted API. Unauthenticated `GET /api/auth/me` returns HTTP 401 both directly and through the frontend development proxy. Authenticated hosted workflows, live Amazon access, database writes, and production security have not been verified with a real session. Browser contract tests use fixtures from the supplied Swagger and backend DTOs.
