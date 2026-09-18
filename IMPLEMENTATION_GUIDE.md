# CertiSME Admin — Implementation Guide

A single-user admin dashboard that manages the public data of the CertiSME static
storefront. Saves are committed straight to the GitHub repository **Dale-byte/CertiSME**
(branch `main`) through this project's built-in GitHub connection, which triggers the
repo's deploy workflow and then Cloudflare. There is no separate API to deploy, and the
browser never holds a secret.

---

## 1. Files and components

### Routing / shell
| File | Purpose |
| --- | --- |
| `src/routes/__root.tsx` | HTML shell: Plus Jakarta Sans, stylesheet, `<Toaster />` (sonner). |
| `src/routes/index.tsx` | The whole app lives at `/`: `AuthProvider` → `Gate` (loading → spinner, signed in → `Dashboard`, else `LoginScreen`). `noindex, nofollow`. |
| `src/router.tsx` | TanStack Router + React Query client. |
| `src/styles.css` | Design system: storefront palette as oklch tokens, 2px radius, Plus Jakarta Sans, `panel` and `label-caps` utilities. |

### Library
| File | Purpose |
| --- | --- |
| `src/lib/repo.server.ts` | **Server only.** All GitHub work: session signing/verification, catalog read/write, framework & product CRUD, document & image uploads, settings, publish, commit history. |
| `src/lib/admin.functions.ts` | Two server functions: `adminCall` (path + method dispatcher) and `adminUpload` (FormData file upload). Both verify the session token first. |
| `src/lib/api.ts` | Browser-side wrapper: `apiRequest`, `apiUpload`, `ApiError`, `errorMessage`, `SITE_BASE_URL`. Calls the server functions — no HTTP address to configure. |
| `src/lib/auth.tsx` | `AuthProvider`, `useAuth`, `useToken`. Username/password → session in `localStorage` (`certisme-admin-session`), hard 24-hour expiry with an in-tab auto sign-out timer. |
| `src/lib/types.ts` | `Framework`, `Product`, `DocumentStatus`, `SiteSettings`, `DeployResponse`, `DeployStatus`, `AuditEntry`. |

### Admin components
| File | Purpose |
| --- | --- |
| `LoginScreen.tsx` | Dark sign-in card: username and password, inline error state. |
| `AdminShell.tsx` | Dark sidebar (7 tabs), collapses to a mobile top bar; identity + Sign out. |
| `Dashboard.tsx` | Holds the active tab and renders the matching section. |
| `primitives.tsx` | `PageHeader`, `Panel`, `InlineError`, `Loading`, `EmptyState`, `FieldLabel`, `NativeSelect`, `FrameworkBadge`, `formatZar`, `formatBytes`. |
| `tabs/ProductsTab.tsx` | List / create / edit / delete products (framework, name, description, format, file, ZAR price, includes list). |
| `tabs/FrameworksTab.tsx` | List / create / edit / delete frameworks. |
| `tabs/DocumentsTab.tsx` | Per-product document status and upload with progress. |
| `tabs/ImagesTab.tsx` | Per-product image upload with before/after comparison against the live site. |
| `tabs/SettingsTab.tsx` | Site name, site URL, contact email; read-only Set/Not set for payment credentials. |
| `tabs/DeployTab.tsx` | Publish note, confirm-then-publish, last result with commit link, auto-polling build status. |
| `tabs/AuditTab.tsx` | Commit history with GitHub links. |

---

## 2. Where data lives in the storefront repo

| Content | Path |
| --- | --- |
| Site settings, frameworks, products | `tools/certisme/data/catalog.yaml` |
| Product documents | `tools/certisme/documents/<file>` |
| Product images | `tools/certisme/src/product-images/<product-id>.<ext>` |
| Build & deploy | `.github/workflows/deploy-catalog.yml` |

Field mapping: the dashboard's *description* is `summary` in the catalog for frameworks,
and *colour* is `badge`. Products use the catalog's own field names.

---

## 3. Internal call surface

The tabs call `apiRequest(path, { token, method, body })`, which is dispatched server-side:

| Path | Method | Result |
| --- | --- | --- |
| `/auth/login` | POST | `{ token, user: { email } }`; wrong credentials → "Incorrect username or password." |
| `/auth/me` | GET | `{ email, name }`; invalid or expired token → 401 |
| `/frameworks` | GET / POST | full framework list |
| `/frameworks/:id` | PUT / DELETE | full framework list (delete blocked while products use it) |
| `/products` | GET / POST | full product list |
| `/products/:id` | PUT / DELETE | full product list |
| `/documents` | GET | `{ product_id, file, size, present }[]` |
| `/settings` | GET / PUT | `{ site_name, site_url, contact_email, merchant_id_set, merchant_key_set }` |
| `/deploy` | POST | `{ commit_url, commit_sha, message }` |
| `/deploy/status` | GET | `{ status, conclusion, html_url, updated_at }` |
| `/audit` | GET | 50 most recent commits |

Uploads use `apiUpload`: documents (`?product=<id>`, ≤25 MB, .docx/.xlsx/.pdf) and images
(`/images/:productId`, ≤5 MB, .png/.jpg/.webp). Both send the file as FormData with the
session token; the server writes it to the repo and, for documents, updates the product's
`file` field if the path changed.

Errors surface as human-readable messages; a `401:` prefix from the server signs the user
out with "Your session has expired. Please sign in again."

---

## 4. Configuration

Stored securely in the project (server side only, never in the browser):

| Name | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | The one allowed sign-in name |
| `ADMIN_PASSWORD` | The sign-in password (compared timing-safely) |
| `SESSION_SECRET` | Signs the 24-hour session tokens |
| GitHub connection | Provided by the project's GitHub integration; grants repo read/write |

Optional public build value:

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_BASE_URL` | Live storefront URL for image comparison and the "Visit live site" link. Defaults to `https://certisme.net`. |

No `VITE_API_BASE_URL` and no Cloudflare Worker are needed any more.

---

## 5. Auth flow

1. `/` renders the sign-in form (username + password).
2. Submitting calls the `adminCall` server function with `/auth/login`.
3. The server compares the values against `ADMIN_USERNAME` / `ADMIN_PASSWORD` using a
   timing-safe comparison and, on success, issues a stateless HMAC-SHA256 token
   (`base64url(payload).base64url(signature)`, payload `{ u, exp }`, 24-hour expiry).
4. The token plus `{ issuedAt, user }` is stored in `localStorage`. The password is never stored.
5. Every later call sends the token; the server verifies the signature and expiry before
   touching GitHub.
6. On reload the stored session is re-verified via `/auth/me`; sessions older than 24 hours
   are discarded. A timer signs the user out exactly 24 hours after issue.

---

## 6. Publish flow

1. Every save in Products, Frameworks, Documents, Images and Settings is committed to
   `main` immediately.
2. The Deploy tab's **Publish to live site** creates an empty commit on `main` (with the
   optional note as its message), which triggers `deploy-catalog.yml`.
3. The dashboard shows the commit link and polls the workflow run every 5 seconds while it
   is queued or running: Building now / Live and up to date / Last build failed, with a link
   to the build log.
4. GitHub Actions rebuilds the static storefront, Cloudflare serves it, and visitors see the
   new content.

---

## 7. Running locally

```bash
bun install
bun run dev      # http://localhost:8080
bun run build    # production build
```

Sign-in and GitHub access use the project's stored configuration, so no `.env` file is
required. Optionally set `VITE_SITE_BASE_URL` if the live storefront moves.

---

## 8. Assumptions and open items

- Product and framework IDs are admin-supplied lowercase hyphenated slugs and must be unique;
  the ID cannot be changed after creation.
- A framework cannot be deleted while any product references it.
- Payment merchant credentials are shown as Set / Not set only; the dashboard never reads or
  writes their values.
- Document uploads are saved as `<product-id>.<ext>` in the documents folder, keeping any
  sub-folder the product's existing `file` value used.
- Image paths follow the storefront convention `src/product-images/<product-id>.<ext>`.
- The audit log is the repository's commit history, so changes made directly on GitHub also
  appear there.
- Verified end to end: sign-in (correct and incorrect), product/framework/document/settings
  loading, build status and audit history. A full publish has not been triggered from the
  dashboard, and no product has been created or deleted against the live repo yet.
