# CertiSME Admin — Implementation Guide

A single-user admin dashboard (pure frontend) that manages the public data of the
CertiSME static storefront. All writes go to a Cloudflare Worker API, which commits
them to a GitHub repository. **The app holds no secrets.**

---

## 1. Files and components

### Routing / shell
| File | Purpose |
| --- | --- |
| `src/routes/__root.tsx` | HTML shell. Loads Plus Jakarta Sans, the Google Identity Services script (`accounts.google.com/gsi/client`), the stylesheet, and mounts `<Toaster />` (sonner). |
| `src/routes/index.tsx` | The whole app lives at `/`. Wraps everything in `AuthProvider`, then `Gate`: loading → spinner, `signed-in` → `Dashboard`, otherwise → `LoginScreen`. Sets `noindex, nofollow` metadata. |
| `src/router.tsx` | TanStack Router + React Query client (unchanged template). |
| `src/styles.css` | Design system: exact storefront palette as oklch tokens (`charcoal`, `charcoal-mid`, `slate`, `coral`, `coral-dark`, `coral-pale`, `coral-border`, `brand-blue`, `navy`, `bg-alt`), 2px radius everywhere, Plus Jakarta Sans, plus `panel` and `label-caps` utilities. |

### Library
| File | Purpose |
| --- | --- |
| `src/lib/api.ts` | API client. Exports `API_BASE_URL`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `SITE_BASE_URL`, `ApiError`, `apiRequest` (JSON, bearer token, human-readable errors), `apiUpload` (XHR upload with progress), `errorMessage`. |
| `src/lib/auth.tsx` | `AuthProvider`, `useAuth`, `useToken`. Google credential → optional client-side admin-email check → `GET /auth/me` verification → session stored in `localStorage` (`certisme-admin-session`) with a hard 24-hour expiry and an in-tab auto sign-out timer. |
| `src/lib/types.ts` | `Framework`, `Product`, `DocumentStatus`, `SiteSettings`, `DeployResponse`, `DeployStatus`, `AuditEntry`. |
| `src/lib/utils.ts` | `cn()` class merge helper. |

### Admin components
| File | Purpose |
| --- | --- |
| `src/components/admin/LoginScreen.tsx` | Dark sign-in card, renders the Google button, shows the "not authorized" state, and warns when `VITE_GOOGLE_CLIENT_ID` / `VITE_API_BASE_URL` are missing. |
| `src/components/admin/AdminShell.tsx` | Dark sidebar (7 tabs) that collapses to a mobile top bar; shows the signed-in identity and Sign out. Exports `TABS` and `TabId`. |
| `src/components/admin/Dashboard.tsx` | Holds the active tab and renders the matching section. |
| `src/components/admin/primitives.tsx` | `PageHeader`, `Panel`, `InlineError`, `Loading`, `EmptyState`, `FieldLabel`, `NativeSelect`, `FrameworkBadge`, `formatZar`, `formatBytes`. |
| `tabs/ProductsTab.tsx` | List, create, edit, delete products (framework, name, description, format, file, ZAR price, includes list). |
| `tabs/FrameworksTab.tsx` | List, create, edit, delete frameworks (id, name, full name, description, colour). |
| `tabs/DocumentsTab.tsx` | Per-product document status (present / size / uploaded date) and upload with progress. |
| `tabs/ImagesTab.tsx` | Per-product image upload with progress and a before/after comparison against the live site image. |
| `tabs/SettingsTab.tsx` | Site name, site URL, contact email; read-only "Set / Not set" indicators for the payment merchant ID and key. |
| `tabs/DeployTab.tsx` | Optional publish note, confirm-then-publish, last publish result with commit link, live build status that auto-polls while a build runs, link to the live site. |
| `tabs/AuditTab.tsx` | Commit history: message, author, short SHA, timestamp, link to details. |

---

## 2. API contract

Base URL: `VITE_API_BASE_URL`. Every request sends `Authorization: Bearer <Google ID token>`.
JSON bodies use `Content-Type: application/json`. Uploads send the raw file body with the
file's own MIME type.

Error format expected on any non-2xx: `{ "error": "message" }` (`{ "message": ... }` also
accepted). The client falls back to friendly text per status code (401 → session expired,
403 → not allowed, 404, 413 → file too large, 5xx → try again).

### Auth
- `GET /auth/me` → `{ email, name?, picture? }`. Must return 401/403 for any token that is not the approved admin.

### Frameworks
- `GET /frameworks` → `Framework[]`
- `POST /frameworks` body `Framework` → `Framework[]` (updated list)
- `PUT /frameworks/:id` body `Framework` → `Framework[]`
- `DELETE /frameworks/:id` → `Framework[]`

`Framework` = `{ id, name, full_name, description?, color? }`

### Products
- `GET /products` → `Product[]`
- `POST /products` body `Product` → `Product[]`
- `PUT /products/:id` body `Product` → `Product[]`
- `DELETE /products/:id` → `Product[]`

`Product` = `{ id, framework, name, description, format: "docx"|"xlsx"|"pdf", file, price (number, ZAR), includes: string[] }`

### Documents
- `GET /documents` → `DocumentStatus[]` = `{ product_id, file?, size?, uploaded_at?, present }`
- `POST /documents?product=<product_id>` raw file body → any JSON (list refetched afterwards)

### Images
- `POST /images/:productId` raw file body → any JSON

### Settings
- `GET /settings` → `SiteSettings` = `{ site_name, site_url, contact_email, merchant_id_set?, merchant_key_set? }`
- `PUT /settings` body `{ site_name, site_url, contact_email }` → `SiteSettings`

### Deploy
- `POST /deploy` body `{ message }` → `{ commit_url?, commit_sha?, run_id?, message? }`
- `GET /deploy/status` → `{ status?: "queued"|"in_progress"|"completed"|..., conclusion?: "success"|"failure"|null, html_url?, updated_at? }`

### Audit
- `GET /audit` → `AuditEntry[]` = `{ sha, author, date, message, url? }`

CORS: the Worker must allow the dashboard origin and the `Authorization` and
`Content-Type` headers, plus `OPTIONS` preflight.

---

## 3. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Cloudflare Worker base URL, no trailing slash. |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth web client ID for the sign-in button. |
| `VITE_ADMIN_EMAIL` | Optional | Client-side convenience check so the wrong account fails fast. The API remains the real gate. |
| `VITE_SITE_BASE_URL` | Optional | Live storefront URL for image comparison and the "Visit live site" link. Defaults to `https://certisme.co.za`. |

All are public build-time values. No secret ever belongs in this app.

---

## 4. Auth flow, step by step

1. `/` renders the login screen; the Google Identity script renders the sign-in button.
2. The user picks their Google account; Google returns an ID token (JWT credential).
3. The app decodes the token's payload only to read email/name/picture (no verification client-side).
4. If `VITE_ADMIN_EMAIL` is set and does not match, status becomes `unauthorized` with a clear message.
5. Otherwise the app calls `GET /auth/me` with the token. The Worker verifies the Google signature, checks the email against its own allow-list, and returns the profile or 401/403.
6. On success the session `{ token, issuedAt, user }` is written to `localStorage` and the dashboard renders.
7. On failure the session is cleared and the "You are not authorized" screen shows.
8. On reload a stored session is re-verified against `/auth/me`; sessions older than 24 hours are discarded.
9. A timer signs the user out exactly 24 hours after issue, even in an open tab. Sign out clears storage and disables Google auto-select.
10. Any 401 from an API call surfaces "Your session has expired. Please sign in again."

---

## 5. Deploy / publish flow

1. All edits in Products, Frameworks, Documents, Images and Settings are saved to the repository immediately by the Worker (each save is a commit to the data files).
2. Deploy tab: the admin optionally writes a note, clicks **Publish to live site**, and confirms in the inline confirmation panel.
3. `POST /deploy` tells the Worker to commit/trigger the build. It responds with the commit SHA/URL and optionally a workflow `run_id`.
4. The dashboard shows the last publish result with a link to the commit and starts polling `GET /deploy/status` every 5 seconds while status is `queued` or `in_progress`.
5. The status card shows Building now / Live and up to date / Last build failed, the last update time, and a link to the build log.
6. GitHub's build/deploy action regenerates the static storefront; once it finishes, visitors see the new content.

---

## 6. Running locally

```bash
bun install
cp .env.example .env   # or create .env
```

`.env`:

```
VITE_API_BASE_URL=https://your-worker.workers.dev
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_ADMIN_EMAIL=you@example.com
VITE_SITE_BASE_URL=https://certisme.co.za
```

```bash
bun run dev      # http://localhost:8080
bun run build    # production build
```

Add `http://localhost:8080` to the Google OAuth client's authorised JavaScript origins,
and allow that origin in the Worker's CORS configuration.

---

## 7. Assumptions and unresolved items

- The Worker verifies the Google ID token itself and enforces the single-admin allow-list; the frontend's email check is only a convenience.
- Write endpoints are assumed to return the full updated list; if they return a single object or 204, the dashboard refetches instead (already handled).
- Product IDs and framework IDs are supplied by the admin and must be unique and URL-safe; there is no server-side uniqueness feedback beyond the error message.
- Document and image uploads send the raw file body with `?product=` (documents) or `/images/:productId` (images). If the Worker expects `multipart/form-data`, `apiUpload` needs one small change.
- Image file naming and the live image path convention are assumed to follow the storefront's existing pattern; the comparison view fetches `VITE_SITE_BASE_URL` + the product image path.
- Audit history reflects repository commits, so changes made directly in GitHub also appear.
- No end-to-end testing against a real Worker has been done — the API is not deployed yet.
